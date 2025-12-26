import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import OpenAI from 'npm:openai@^4.28.0';

// --- INLINED GATEWAY LOGIC (COMPLIANCE SPECIALIST - SONAR) ---

function cleanJson(text) {
  if (typeof text === 'object') return text;
  try { return JSON.parse(text); } catch (e) {
    const match = text.match(/```(?:json)?\n([\s\S]*?)\n```/);
    if (match) { try { return JSON.parse(match[1]); } catch (e2) {} }
    const firstOpen = text.indexOf('{');
    const lastClose = text.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) {
      try { return JSON.parse(text.substring(firstOpen, lastClose + 1)); } catch (e3) {}
    }
    throw new Error("Failed to parse JSON response");
  }
}

async function invokeSpecializedLLM({ prompt, response_schema, base44_client }) {
  console.log(`[LLM Gateway - Compliance Specialist] Using Sonar Deep Research`);
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  const fullPrompt = prompt + jsonInstruction;

  try {
    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) throw new Error("PERPLEXITY_API_KEY missing");

    const perplexity = new OpenAI({ 
        apiKey, 
        baseURL: 'https://api.perplexity.ai' 
    });
    
    const completion = await perplexity.chat.completions.create({
        model: "sonar-deep-research",
        messages: [{ role: "user", content: fullPrompt }]
    });
    const content = completion.choices[0].message.content;
    return response_schema ? cleanJson(content) : content;
  } catch (e) {
     console.error(`[LLM Gateway] Primary strategy failed:`, e.message);
     return await base44_client.integrations.Core.InvokeLLM({
        prompt: fullPrompt,
        response_json_schema: response_schema,
        add_context_from_internet: true
    });
  }
}

// --- END INLINED GATEWAY ---

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { reportId, knowledgeBase } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });
    
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });

    const kbContext = knowledgeBase ? `
Knowledge Base for ${knowledgeBase.country}:
Regulation Links: ${knowledgeBase.regulation_links}
Government Trade Links: ${knowledgeBase.government_trade_links}
` : '';

    const context = `
Destination Country: ${report.destination_country}
Product: ${report.product_name}
Intended Use: ${report.user_input_text}
HS Code: ${report.classification_results?.primary?.hs_code}
${kbContext}
`;

    const systemPrompt = `
You are a Compliance Specialist (Legal).
Task: Search for official import requirements, mandatory standards, and labeling laws. Look for official documentation in ANY format (Official Government Portals, PDF, DOC, HTML gazettes). Do NOT limit to PDFs. Prioritize sources from the Standardization Institute and Ministries of the destination country.

Output JSON Schema:
{
  "compliance_data": {
    "import_requirements": ["string"],
    "mandatory_standards": ["string"],
    "labeling_laws": ["string"],
    "prohibitions": ["string"]
  }
}
`;

    const fullPrompt = `${systemPrompt}\n\nDATA:\n${context}`;

    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        response_schema: {
            type: "object",
            properties: {
                compliance_data: {
                    type: "object",
                    properties: {
                        import_requirements: { type: "array", items: { type: "string" } },
                        mandatory_standards: { type: "array", items: { type: "string" } },
                        labeling_laws: { type: "array", items: { type: "string" } },
                        prohibitions: { type: "array", items: { type: "string" } }
                    }
                }
            }
        },
        base44_client: base44
    });

    // Merge into regulatory_data
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        regulatory_data: {
            ...(report.regulatory_data || {}),
            primary: {
                ...(report.regulatory_data?.primary || {}),
                import_requirements: result.compliance_data.import_requirements
            },
            // Store extra details in custom fields if needed or mapped
            compliance_details: result.compliance_data
        }
    });
    
    return Response.json({ success: true, status: 'compliance_checked', data: result.compliance_data });

  } catch (error) {
    console.error('Agent Compliance Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});