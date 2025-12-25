import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { invokeSpecializedLLM } from './utils/llmGateway.js';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { reportId } = await req.json();
    if (!reportId) {
      return Response.json({ error: 'Report ID is required' }, { status: 400 });
    }
    
    // Fetch Report
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }

    if (!report.structural_analysis) {
        return Response.json({ error: 'Structural analysis missing. Run Agent A first.' }, { status: 400 });
    }
    
    // Update status to researching
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'researching'
    });
    
    // Prepare Data for Researcher
    const spec = report.structural_analysis;
    const destCountry = report.destination_country;
    
    const context = `
Destination Country: ${destCountry}
Technical Specification:
- Name: ${spec.standardized_name}
- Material: ${spec.material_composition}
- Function: ${spec.function}
- State: ${spec.state}
- Essential Character: ${spec.essential_character}
`;

    // System Prompt for Agent B
    const systemPrompt = `
You are a Customs Researcher. 
Task: Intelligence gathering for HS Classification (No final decision).

Objectives:
1. Find the 2025 Customs Tariff for [${destCountry}].
2. Search for legal notes/exclusions relevant to: ${spec.standardized_name} (${spec.material_composition}).
3. Search for previous rulings or precedents for similar items in ${destCountry} or WCO.
4. Find 3-5 potential HS Headings (4-digit) that might fit.

Output JSON Schema:
{
  "verified_sources": [
    { "title": "string", "url": "string", "date": "string", "snippet": "string" }
  ],
  "candidate_headings": [
    { "code_4_digit": "string", "description": "string" }
  ],
  "legal_notes_found": ["string"]
}
`;

    const fullPrompt = `${systemPrompt}\n\nDATA TO RESEARCH:\n${context}`;

    // Invoke Researcher (Perplexity/Browsing)
    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        task_type: 'research',
        response_schema: {
            type: "object",
            properties: {
                verified_sources: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            title: { type: "string" },
                            url: { type: "string" },
                            date: { type: "string" },
                            snippet: { type: "string" }
                        }
                    }
                },
                candidate_headings: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            code_4_digit: { type: "string" },
                            description: { type: "string" }
                        }
                    }
                },
                legal_notes_found: {
                    type: "array",
                    items: { type: "string" }
                }
            }
        },
        base44_client: base44
    });

    // Update DB with research findings
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        processing_status: 'research_completed',
        research_findings: result
    });
    
    return Response.json({
        success: true,
        status: 'research_completed',
        findings: result
    });

  } catch (error) {
    console.error('Agent B (Researcher) Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});