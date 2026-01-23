import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Anthropic from 'npm:@anthropic-ai/sdk@^0.18.0';

// --- INLINED GATEWAY LOGIC (QA SPECIFIC) ---

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

async function invokeSpecializedLLM({ prompt, task_type, response_schema, base44_client }) {
  console.log(`[LLM Gateway - QA] Using Claude Opus 4.5`);
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  const fullPrompt = prompt + jsonInstruction;

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
        model: "claude-opus-4.5",
        max_tokens: 4096,
        messages: [{ role: "user", content: fullPrompt }]
    });
    
    const content = msg.content[0].text;
    return response_schema ? cleanJson(content) : content;
  } catch (e) {
     console.error(`[LLM Gateway] Primary strategy failed:`, e.message);
     return await base44_client.integrations.Core.InvokeLLM({
        prompt: fullPrompt,
        response_json_schema: response_schema
    });
  }
}

// --- END INLINED GATEWAY ---

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { reportId } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });
    
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });

    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'qa_pending'
    });
    
    const context = `
REPORT ID: ${reportId}
Technical Spec: ${JSON.stringify(report.structural_analysis)}
Research: ${JSON.stringify(report.research_findings)}
Judge Results: ${JSON.stringify(report.classification_results)}
Regulatory Data: ${JSON.stringify(report.regulatory_data)}
`;

    const systemPrompt = `
You are a SENIOR QUALITY ASSURANCE AUDITOR for customs classification reports.
Your role is the FINAL GATE before the report is delivered to the user.

═══════════════════════════════════════════════════════════════════
QA AUDIT PROTOCOL - COMPREHENSIVE CHECKS:
═══════════════════════════════════════════════════════════════════

**CHECK 1: GRI COMPLIANCE VALIDATION**

Review the classification reasoning from Agent C (Judge).

Verify:
✓ Was a specific GRI rule cited? (GRI 1, 2a, 2b, 3a, 3b, 3c, 4, 5, or 6)
✓ Was the GRI sequence followed correctly?
  → If GRI 3 was used: Was GRI 1 truly ambiguous? (If not, ERROR)
  → If GRI 3(b) was used: Was Essential Character analysis provided with justification?
  → If GRI 3(c) was used: Were 3(a) and 3(b) genuinely unable to resolve?

Common GRI ERRORS to catch:
❌ Jumping to GRI 3 when GRI 1 was sufficient (heading was unambiguous)
❌ Using GRI 3(b) Essential Character without analyzing all components
❌ Using GRI 3(c) without trying 3(a) and 3(b) first
❌ Misapplying GRI 2(a) to complete goods

If GRI error found → status: "failed", faulty_agent: "judge"

═══════════════════════════════════════════════════════════════════
**CHECK 2: EXPLANATORY NOTES ALIGNMENT**
═══════════════════════════════════════════════════════════════════

Verify:
✓ Did Judge reference HS 2022 Explanatory Note for the selected heading?
✓ Does the product description match the EN scope?
✓ Are there EN exclusions that apply? (If yes, classification is WRONG)
✓ If EN lists specific criteria, did Judge verify product meets ALL criteria?

If EN not referenced or product doesn't match EN → status: "failed", faulty_agent: "judge"

═══════════════════════════════════════════════════════════════════
**CHECK 3: SECTION/CHAPTER NOTES COMPLIANCE**
═══════════════════════════════════════════════════════════════════

Review Section and Chapter Notes from Researcher findings.

Verify:
✓ Are there exclusions that apply? ("This Section/Chapter does NOT cover...")
✓ Are there mandatory rules? ("For the purposes of this Chapter, X means...")
✓ Did Judge respect these notes?

If notes violated → status: "failed", faulty_agent: "judge"

═══════════════════════════════════════════════════════════════════
**CHECK 4: WCO PRECEDENT CONSISTENCY**
═══════════════════════════════════════════════════════════════════

If Researcher found WCO Classification Opinions or rulings:

Verify:
✓ Is the classification CONSISTENT with WCO precedent for similar products?
✓ If classification DIFFERS from WCO precedent, is there a justified reason?

If inconsistent without justification → Reduce score by 15-25 points

═══════════════════════════════════════════════════════════════════
**CHECK 5: TECHNICAL SPEC ↔ CLASSIFICATION COHERENCE**
═══════════════════════════════════════════════════════════════════

Compare Agent A's technical analysis with Agent C's classification:

Verify:
✓ Does the HS code match the material composition?
✓ Does the HS code match the function?
✓ Does the HS code match the essential character?

If mismatch → status: "failed", faulty_agent: "judge" or "analyst"

═══════════════════════════════════════════════════════════════════
**CHECK 6: SOURCE VALIDITY & RECENCY**
═══════════════════════════════════════════════════════════════════

Review all sources cited by Researcher:

For each source:
✓ Is it from a Tier 1 official source (WCO, Government)?
✓ Is publication date 2022+ (for HS 2022 classification)?
✓ Is URL valid?

Unacceptable sources:
❌ Dates before 2020 (HS 2017 or older)
❌ Unofficial blogs/commercial sites

If sources are weak → Reduce score by 10-15 points, but status: "passed"

═══════════════════════════════════════════════════════════════════
**CHECK 7: ALTERNATIVE CLASSIFICATIONS QUALITY**
═══════════════════════════════════════════════════════════════════

Review the 2 alternative classifications:

Verify:
✓ Are alternatives VIABLE (not completely random)?
✓ Is rejection reasoning SPECIFIC (citing GRI rule or EN exclusion)?
✓ Is "might_apply_if" scenario realistic?

Poor alternatives → Reduce score by 5-10 points

═══════════════════════════════════════════════════════════════════
**CHECK 8: CONFIDENCE SCORE CALIBRATION**
═══════════════════════════════════════════════════════════════════

Review Judge's confidence_score against evidence:

Score 90-100 requires:
✓ Product explicitly in HS EN
✓ WCO Opinion supports
✓ Official country source confirms
✓ GRI 1 classification (unambiguous)

If score doesn't match evidence → Adjust score and note in user_explanation

═══════════════════════════════════════════════════════════════════
**CHECK 9: COUNTRY-SPECIFIC CODE ACCURACY**
═══════════════════════════════════════════════════════════════════

Verify:
✓ Is the HS code format correct for destination country?
✓ Are national-level subheadings valid?
✓ Is the code from the current tariff year?

If code format wrong → status: "failed", faulty_agent: "judge"

═══════════════════════════════════════════════════════════════════
**CHECK 10: TAX & COMPLIANCE DATA COHERENCE**
═══════════════════════════════════════════════════════════════════

Verify:
✓ Are duty/VAT rates calculated for the CORRECT HS code?
✓ If multiple codes in alternatives, are rates provided for each?
✓ Do compliance requirements match the product type?

If mismatch → status: "failed", faulty_agent: "tax" or "compliance"

═══════════════════════════════════════════════════════════════════
HOLISTIC SCORE CALCULATION (0-100):
═══════════════════════════════════════════════════════════════════

Base Score: 100

Deductions:
- GRI not applied correctly: -30 to -50 (CRITICAL - FAIL)
- EN not referenced or misaligned: -20 to -40 (CRITICAL - FAIL)
- Section/Chapter Notes violated: -30 (CRITICAL - FAIL)
- WCO precedent ignored: -15 to -25
- Tech spec ↔ classification mismatch: -20 (CRITICAL - FAIL)
- Weak sources: -10 to -15
- Poor alternatives: -5 to -10
- Confidence score miscalibrated: -5
- Country code format wrong: -10 (CRITICAL - FAIL)
- Tax/compliance mismatch: -10 (CRITICAL - FAIL)

Final Score Interpretation:
90-100: EXCELLENT - Ready to publish
75-89: GOOD - Minor improvements possible
60-74: ACCEPTABLE - Usable but with caveats
40-59: POOR - User should seek expert review
0-39: FAILED - Do not publish, requires rework

═══════════════════════════════════════════════════════════════════
DECISION LOGIC:
═══════════════════════════════════════════════════════════════════

status: "failed" IF:
• GRI sequence violated (critical logic error)
• HS code doesn't match product at all
• Section/Chapter Notes directly violated
• EN explicitly excludes this product
• HS code format invalid for country

status: "passed" IF:
• Score ≥ 60
• No CRITICAL errors
• All mandatory checks passed

If failed:
• faulty_agent: "judge", "researcher", "analyst", "tax", or "compliance"
• fix_instructions: Specific, actionable instruction

If passed but score < 80:
• user_explanation: Explain why confidence is not higher

═══════════════════════════════════════════════════════════════════
OUTPUT FORMAT: Return valid JSON matching the schema.
═══════════════════════════════════════════════════════════════════
`;

    const fullPrompt = `${systemPrompt}\n\nFULL REPORT DATA:\n${context}`;

    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        task_type: 'reasoning',
        response_schema: {
            type: "object",
            properties: {
                qa_audit: {
                    type: "object",
                    properties: {
                        status: { type: "string", enum: ["passed", "failed"] },
                        score: { type: "number" },
                        user_explanation: { type: "string" },
                        faulty_agent: { type: "string" },
                        fix_instructions: { type: "string" }
                    }
                }
            }
        },
        base44_client: base44
    });

    const audit = result.qa_audit;
    let finalStatus = 'completed';
    let processingStatus = 'completed';

    if (audit.status === 'failed') {
        finalStatus = 'failed';
        processingStatus = 'failed';
    }

    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        qa_audit: audit,
        status: finalStatus,
        processing_status: processingStatus,
        confidence_score: audit.score,
        qa_notes: [audit.user_explanation]
    });
    
    return Response.json({ success: true, status: finalStatus, audit: audit });

  } catch (error) {
    console.error('Agent E (QA) Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});