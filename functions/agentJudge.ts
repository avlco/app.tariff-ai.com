import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import OpenAI from 'npm:openai@^4.28.0';

// --- TARIFF-AI 2.0: JURIST - GRI STATE MACHINE WITH LEGAL TEXT INJECTION ---
// This agent now operates on RETRIEVED legal text, not general AI knowledge.
// All citations must reference the LEGAL_TEXT_CORPUS provided.

// --- INLINED GATEWAY LOGIC (JUDGE SPECIFIC) ---

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
  console.log(`[LLM Gateway - Judge] Using GPT-4o`);
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  const fullPrompt = prompt + jsonInstruction;

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: fullPrompt }],
        response_format: response_schema ? { type: "json_object" } : undefined
    });
    
    const content = completion.choices[0].message.content;
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

// --- GIR STATE MACHINE ---
const GIR_STATES = ['GRI_1', 'GRI_2a', 'GRI_2b', 'GRI_3a', 'GRI_3b', 'GRI_3c', 'GRI_4', 'GRI_5', 'GRI_6'];

function buildGirStateMachinePrompt(currentState, productProfile, candidates, legalNotes, feedback) {
  const stateInstructions = {
    'GRI_1': `
CURRENT STATE: GRI 1 - Classification by Terms of Headings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TASK: Determine if the product can be classified UNAMBIGUOUSLY under ONE heading.

PROCESS:
1. Read each candidate heading text LITERALLY
2. Check Section Notes for scope/exclusions
3. Check Chapter Notes for definitions/exclusions  
4. Consult Explanatory Notes for each heading

DECISION:
- If ONE heading CLEARLY covers the product → RESOLVED at GRI 1
- If MULTIPLE headings could apply → TRANSITION to GRI 2
- If NO heading applies → TRANSITION to GRI 4

OUTPUT your decision with full reasoning.`,

    'GRI_2a': `
CURRENT STATE: GRI 2(a) - Incomplete/Unfinished Articles
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE: "Any reference to an article includes that article incomplete or unfinished, 
provided it has the ESSENTIAL CHARACTER of the complete article."

TASK: Determine if product is incomplete/unfinished but has essential character.

ANALYSIS REQUIRED:
1. Is the product COMPLETE or INCOMPLETE?
2. If incomplete, does it have the ESSENTIAL CHARACTER of the complete article?
3. Which heading would the COMPLETE article fall under?

DECISION:
- If GRI 2(a) resolves classification → RESOLVED at GRI 2(a)
- If not applicable → TRANSITION to GRI 2(b)`,

    'GRI_2b': `
CURRENT STATE: GRI 2(b) - Mixtures and Combinations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE: "Any reference to a material/substance includes mixtures/combinations 
of that material with other materials/substances."

TASK: Determine if product is a mixture that can be classified by constituent material.

ANALYSIS REQUIRED:
1. Is the product a MIXTURE or COMBINATION of materials?
2. Can it be classified under a heading for ONE of its constituent materials?

DECISION:
- If GRI 2(b) resolves classification → RESOLVED at GRI 2(b)
- If ambiguity remains → TRANSITION to GRI 3(a)`,

    'GRI_3a': `
CURRENT STATE: GRI 3(a) - Most Specific Description
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE: "The heading providing the MOST SPECIFIC description shall be preferred 
over headings providing a more GENERAL description."

TASK: Compare candidate headings and determine which is MOST SPECIFIC.

ANALYSIS REQUIRED:
1. List each candidate heading description
2. Rank by SPECIFICITY (most specific = mentions exact product type, materials, function)
3. General descriptions = broad categories

DECISION:
- If ONE heading is clearly MORE SPECIFIC → RESOLVED at GRI 3(a)
- If headings are EQUALLY SPECIFIC → TRANSITION to GRI 3(b)`,

    'GRI_3b': `
CURRENT STATE: GRI 3(b) - Essential Character
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE: "Mixtures, composite goods, and sets → classify by the material/component 
which gives them their ESSENTIAL CHARACTER."

CRITICAL: This is the MOST COMPLEX rule. You MUST analyze:

1. NATURE of each component (what it fundamentally IS)
2. BULK (volume, quantity, weight of each)
3. VALUE (cost contribution of each component)
4. ROLE (functional importance in the use of the goods)

REQUIRED OUTPUT:
| Component | Nature | Bulk % | Value % | Functional Role |
|-----------|--------|--------|---------|-----------------|
| [List each component with analysis] |

ESSENTIAL CHARACTER DETERMINATION:
Based on the above analysis, which component gives the product its essential character?
Justify your answer with specific reference to Nature, Bulk, Value, and Role.

DECISION:
- If Essential Character is CLEAR → RESOLVED at GRI 3(b)
- If EQUAL essential character → TRANSITION to GRI 3(c)`,

    'GRI_3c': `
CURRENT STATE: GRI 3(c) - Last in Numerical Order
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE: "When goods cannot be classified by 3(a) or 3(b), classify under 
the heading which occurs LAST in numerical order."

TASK: Since GRI 3(a) and 3(b) failed, apply GRI 3(c).

REQUIRED:
1. List candidate headings that "equally merit consideration"
2. Select the heading with the HIGHEST numerical code

DECISION: RESOLVED at GRI 3(c) with the last heading numerically.`,

    'GRI_4': `
CURRENT STATE: GRI 4 - Most Akin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE: "Goods which cannot be classified by GRI 1-3 → classify under 
the heading for the goods to which they are MOST AKIN (most similar)."

TASK: Find the heading for goods MOST SIMILAR to this product.

ANALYSIS:
1. What existing product category is this MOST SIMILAR to?
2. Consider: materials, appearance, purpose, function, trade name

DECISION: RESOLVED at GRI 4 with the most akin heading.`
  };

  return stateInstructions[currentState] || stateInstructions['GRI_1'];
}

// --- END GIR STATE MACHINE ---

/**
 * Extract and format legal text corpus for prompt injection
 * This is the KEY to "Retrieve & Deduce" - we inject ACTUAL legal text
 */
function buildLegalTextContext(researchFindings, structuralAnalysis) {
  const sections = [];
  
  // 1. Raw Legal Text Corpus (from WebScraper)
  if (researchFindings?.raw_legal_text_corpus) {
    sections.push(`
═══════════════════════════════════════════════════════════════════
LEGAL TEXT CORPUS (Retrieved from Official Sources)
USE THIS AS PRIMARY REFERENCE. Quote from this text directly.
═══════════════════════════════════════════════════════════════════
${researchFindings.raw_legal_text_corpus.substring(0, 25000)}
═══════════════════════════════════════════════════════════════════`);
  }
  
  // 2. Candidate Headings with EN Summaries
  if (researchFindings?.candidate_headings?.length > 0) {
    const headingsText = researchFindings.candidate_headings.map(h => `
HEADING ${h.code_4_digit}: ${h.description}
Likelihood: ${h.likelihood}
${h.explanatory_note_summary ? `Explanatory Notes: "${h.explanatory_note_summary}"` : ''}
${h.section_chapter_notes?.length > 0 ? `Section/Chapter Notes: ${h.section_chapter_notes.join('; ')}` : ''}
`).join('\n');
    
    sections.push(`
═══════════════════════════════════════════════════════════════════
CANDIDATE HEADINGS WITH EXPLANATORY NOTES
═══════════════════════════════════════════════════════════════════
${headingsText}`);
  }
  
  // 3. WCO Precedents
  if (researchFindings?.wco_precedents?.length > 0) {
    const precedentsText = researchFindings.wco_precedents.map(p => `
WCO Opinion ${p.opinion_number} (${p.date}):
Product: ${p.product}
Classification: ${p.classification}
Reasoning: ${p.reasoning}
Source: ${p.url || 'WCO CROSS Database'}
`).join('\n');
    
    sections.push(`
═══════════════════════════════════════════════════════════════════
WCO CLASSIFICATION PRECEDENTS
═══════════════════════════════════════════════════════════════════
${precedentsText}`);
  }
  
  // 4. BTI Cases
  if (researchFindings?.bti_cases?.length > 0) {
    const btiText = researchFindings.bti_cases.map(b => `
BTI ${b.reference} (${b.country}, ${b.date}):
Product: ${b.product_description}
Classification: ${b.hs_code}
`).join('\n');
    
    sections.push(`
═══════════════════════════════════════════════════════════════════
BINDING TARIFF INFORMATION (BTI) CASES
═══════════════════════════════════════════════════════════════════
${btiText}`);
  }
  
  // 5. Section/Chapter Notes
  if (researchFindings?.legal_notes_found?.length > 0) {
    sections.push(`
═══════════════════════════════════════════════════════════════════
SECTION & CHAPTER NOTES
═══════════════════════════════════════════════════════════════════
${researchFindings.legal_notes_found.join('\n\n')}`);
  }
  
  // 6. EN Exclusions
  if (researchFindings?.en_exclusions?.length > 0) {
    const exclusionsText = researchFindings.en_exclusions.map(e => 
      `Heading ${e.heading}: "${e.exclusion_text}" → See ${e.redirect_heading}`
    ).join('\n');
    
    sections.push(`
═══════════════════════════════════════════════════════════════════
EXPLANATORY NOTE EXCLUSIONS
(These explicitly redirect products to other headings)
═══════════════════════════════════════════════════════════════════
${exclusionsText}`);
  }
  
  // 7. Composite Analysis from Agent Analyze
  if (structuralAnalysis?.composite_analysis?.is_composite) {
    const ca = structuralAnalysis.composite_analysis;
    sections.push(`
═══════════════════════════════════════════════════════════════════
COMPOSITE GOODS ANALYSIS (from Product Analyst)
═══════════════════════════════════════════════════════════════════
Composite Type: ${ca.composite_type}
Essential Character Component: ${ca.essential_character_component}
Reasoning: ${ca.essential_character_reasoning}
Factors:
- Value Dominant: ${ca.essential_character_factors?.value_dominant || 'N/A'}
- Bulk Dominant: ${ca.essential_character_factors?.bulk_dominant || 'N/A'}
- Function Dominant: ${ca.essential_character_factors?.function_dominant || 'N/A'}
- User Perception: ${ca.essential_character_factors?.user_perception || 'N/A'}`);
  }
  
  return sections.join('\n\n');
}

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { reportId, intendedUse, feedback, enforceHierarchy } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });
    
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });
    
    if (!report.structural_analysis || !report.research_findings) {
        return Response.json({ error: 'Prerequisites missing. Run Agent A & B first.' }, { status: 400 });
    }
    
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'classifying_hs'
    });
    
    // ═══════════════════════════════════════════════════════════════════
    // TARIFF-AI 2.0: Build LEGAL_TEXT_CONTEXT from retrieved sources
    // ═══════════════════════════════════════════════════════════════════
    console.log('[AgentJudge] Building legal text context from retrieved sources');
    const legalTextContext = buildLegalTextContext(report.research_findings, report.structural_analysis);
    console.log(`[AgentJudge] Legal text context: ${legalTextContext.length} chars`);
    
    // Extract Explanatory Notes guidance from research findings
    const enGuidance = report.research_findings?.candidate_headings?.map(h =>
      `Heading ${h.code_4_digit}: ${h.explanatory_note_summary || 'See research findings'}`
    ).join('\n') || 'Refer to research findings for Explanatory Notes';
    
    // Build GIR state context if enforcing hierarchy
    const girStateContext = enforceHierarchy ? `
═══════════════════════════════════════════════════════════════════
GIR STATE MACHINE - STRICT SEQUENTIAL ENFORCEMENT
═══════════════════════════════════════════════════════════════════

You MUST process GRI rules as a STATE MACHINE:
1. Start at GRI 1
2. Only transition to next state if current state CANNOT resolve
3. Document the TRANSITION REASON for each state change
4. Record your decision at EACH state visited

STATE TRANSITION LOG (you must fill this):
┌─────────┬──────────────────────────────────────────┬─────────────┐
│ State   │ Analysis Result                          │ Transition  │
├─────────┼──────────────────────────────────────────┼─────────────┤
│ GRI 1   │ [Your analysis here]                     │ [RESOLVED/NEXT] │
│ GRI 2   │ [If reached - your analysis]             │ [RESOLVED/NEXT] │
│ GRI 3(a)│ [If reached - your analysis]             │ [RESOLVED/NEXT] │
│ GRI 3(b)│ [If reached - FULL component analysis]   │ [RESOLVED/NEXT] │
│ GRI 3(c)│ [If reached - last numerical]            │ [RESOLVED/NEXT] │
└─────────┴──────────────────────────────────────────┴─────────────┘

CRITICAL: If GRI 3(b) is reached, you MUST provide:
- Component breakdown table with Nature/Bulk/Value/Role
- Clear justification for essential character determination
` : '';

    const context = `
Product Spec: ${JSON.stringify(report.structural_analysis, null, 2)}
Research Findings: ${JSON.stringify(report.research_findings, null, 2)}
Intended Use: ${intendedUse || 'General purpose'}
Destination Country: ${report.destination_country}

EXPLANATORY NOTES AVAILABLE:
${enGuidance}
`;

    const systemPrompt = `
You are a SENIOR CUSTOMS CLASSIFICATION JUDGE with expertise in HS 2022 and WCO General Rules for Interpretation (GRI).

═══════════════════════════════════════════════════════════════════
TARIFF-AI 2.0: RETRIEVE & DEDUCE PROTOCOL
═══════════════════════════════════════════════════════════════════

CRITICAL INSTRUCTION: You have been provided with LEGAL_TEXT_CONTEXT containing:
- Retrieved legal text from official customs sources
- Explanatory Notes summaries
- WCO precedents and BTI cases
- Section/Chapter Notes

YOUR DEDUCTION MUST:
1. CITE DIRECTLY from the LEGAL_TEXT_CONTEXT provided
2. Use exact quotes with source attribution
3. NOT rely on general knowledge - ONLY what is in the context
4. If context is insufficient, FLAG IT (don't hallucinate)

Citation Format Required:
"Per [Source Type]: '[exact quote from context]' (Line/Section reference if available)"

Examples:
✓ "Per EU TARIC: 'Heading 8471 covers automatic data processing machines...'"
✓ "Per WCO Opinion 8471.30/1: 'Portable computers with wireless capability...'"
✓ "Per Chapter 84 Note 5(A): 'automatic data processing machines means...'"

✗ "HS codes typically classify laptops under 8471" (no citation)
✗ "Based on my knowledge of customs law..." (not from context)

═══════════════════════════════════════════════════════════════════

YOUR TASK: Classify the product by applying GRI 1-6 in STRICT SEQUENTIAL ORDER.

═══════════════════════════════════════════════════════════════════
MANDATORY CLASSIFICATION PROTOCOL - FOLLOW EXACTLY:
═══════════════════════════════════════════════════════════════════

**STEP 1: GRI 1 - Classification by Terms of Headings and Section/Chapter Notes**

Process:
a) Read the candidate heading text LITERALLY
b) Check Section Notes for scope/exclusions
c) Check Chapter Notes for definitions/exclusions
d) Consult HS 2022 Explanatory Notes (EN) for the heading
e) Determine: Does product CLEARLY and UNAMBIGUOUSLY fit ONE heading?

If YES → Classification complete. Document reasoning and STOP.
If NO (ambiguous or multiple headings possible) → Proceed to GRI 2.

**STEP 2: GRI 2 - Incomplete/Unfinished Articles and Mixtures**

Rule 2(a): "Any reference to an article includes that article incomplete or unfinished,
           provided it has the ESSENTIAL CHARACTER of the complete article."

Rule 2(b): "Any reference to a material/substance includes mixtures/combinations of that
           material with other materials/substances."

Determine: Does GRI 2 resolve the classification?
If YES → Document and STOP.
If NO → Proceed to GRI 3.

**STEP 3: GRI 3 - Goods Prima Facie Classifiable Under Multiple Headings**

This is the MOST COMPLEX rule. Apply in strict order:

**GRI 3(a): Most Specific Description Prevails**
"The heading providing the MOST SPECIFIC description shall be preferred over headings
providing a more GENERAL description."

Test: Compare headings - most specific wins.

If GRI 3(a) resolves → Document and STOP.
If not → Proceed to GRI 3(b).

**GRI 3(b): Essential Character**
"Mixtures, composite goods consisting of different materials/components, and goods put up
in sets for retail sale → classify by the material/component which gives them their
ESSENTIAL CHARACTER."

CRITICAL: How to determine Essential Character:
1. NATURE of material/component (what it fundamentally is)
2. BULK (volume/quantity/weight)
3. VALUE (which component costs most)
4. ROLE the material plays in relation to the use of the goods

You MUST analyze ALL components and justify which gives Essential Character.

If GRI 3(b) resolves → Document and STOP.
If not (equal essential character) → Proceed to GRI 3(c).

**GRI 3(c): Heading Last in Numerical Order**
"When goods cannot be classified by 3(a) or 3(b), classify under the heading which
occurs LAST in numerical order among those which equally merit consideration."

**STEP 4: GRI 4 - Goods Not Elsewhere Specified**
"Goods which cannot be classified by GRI 1-3 → classify under the heading for the goods
to which they are MOST AKIN (most similar)."

**STEP 5: GRI 5 - Specific Rules for Containers and Packing**
[Camera cases, instrument cases, etc.]

**STEP 6: GRI 6 - Classification at Subheading Level**
"Apply GRI 1-5 AGAIN for subheadings within the determined heading."

═══════════════════════════════════════════════════════════════════
MANDATORY CITATION REQUIREMENTS (Retrieve & Deduce):
═══════════════════════════════════════════════════════════════════

For EVERY classification decision, you MUST include:

1. **HEADING TEXT CITATION**
   Quote the exact heading text from LEGAL_TEXT_CONTEXT:
   "Heading [XXXX]: '[exact text from context]'"

2. **EXPLANATORY NOTES CITATION**
   Quote the EN summary from candidate_headings:
   "Per EN to Heading [XXXX]: '[quote from explanatory_note_summary]'"

3. **SECTION/CHAPTER NOTES CITATION** (if applicable)
   Quote from legal_notes_found:
   "Per [Section/Chapter] Note [X]: '[exact quote]'"

4. **PRECEDENT CITATION** (if applicable)
   Quote from wco_precedents or bti_cases:
   "Per WCO Opinion [number]: '[quote]'"
   "Per BTI [reference]: '[quote]'"

5. **ALIGNMENT ANALYSIS** (Required Format):
   Based on [Source Citation]:
   ✓ [Criterion from EN] - Product satisfies because [reason with evidence]
   ✓ [Criterion from EN] - Product satisfies because [reason with evidence]
   ✗ [Exclusion from EN] - Does NOT apply because [reason]
   
   Conclusion: Product IS/IS NOT covered by heading [XXXX].

6. **CONTEXT SUFFICIENCY FLAG**
   If the LEGAL_TEXT_CONTEXT does not contain sufficient information:
   "⚠️ CONTEXT GAP: [Specific information missing]. Classification based on available context only."

CRITICAL: If you cannot find a citation in the provided context, do NOT make up citations.
Instead, note: "No explicit citation available in retrieved context for [X]."

═══════════════════════════════════════════════════════════════════
ALTERNATIVE CLASSIFICATIONS:
═══════════════════════════════════════════════════════════════════

You must provide 2 alternative classifications.

For EACH alternative:
1. Which heading it COULD fit under (with GRI analysis)
2. Why it is REJECTED in favor of primary
3. Under what CONDITIONS it might apply instead

═══════════════════════════════════════════════════════════════════
CONFIDENCE SCORE CALIBRATION:
═══════════════════════════════════════════════════════════════════

Score 90-100 (CERTAIN):
✓ Product explicitly mentioned in HS EN
✓ WCO Classification Opinion exists and supports
✓ GRI 1 classification (unambiguous heading)
✓ Multiple official sources agree

Score 75-89 (HIGH):
✓ Clear GRI 1 or GRI 3(a) classification
✓ Section/Chapter Notes support
✓ No conflicting interpretations

Score 60-74 (MODERATE):
• GRI 3(b) Essential Character used (subjective element)
• Limited official precedent
• Alternatives are viable but less likely

Score 40-59 (LOW):
• Borderline case between multiple headings
• Conflicting precedents
• Novel product type

Score 0-39 (VERY LOW - Flag for expert review):
• Highly complex composite goods
• No clear precedent
• Multiple valid GRI paths

═══════════════════════════════════════════════════════════════════
CRITICAL SELF-CHECK BEFORE FINALIZING:
═══════════════════════════════════════════════════════════════════

□ Did I apply GRI rules in correct sequential order (1→2→3→4)?
□ Did I stop as soon as classification was determined (not continue unnecessarily)?
□ Did I reference Explanatory Note text from research findings?
□ Did I analyze ALL components for Essential Character (if GRI 3(b) used)?
□ Did I cite Section/Chapter Notes that apply?
□ Did I provide detailed rejection reasoning for alternatives?
□ Is my confidence score justified by the evidence quality?

If ANY box is unchecked → REVISE your analysis before submitting.

═══════════════════════════════════════════════════════════════════
OUTPUT FORMAT: You must return valid JSON matching the schema provided.
Include in the "reasoning" field your complete GRI analysis with EN references.
═══════════════════════════════════════════════════════════════════
`;

    // Inject the LEGAL_TEXT_CONTEXT at the beginning for maximum visibility
    let fullPrompt = `${systemPrompt}\n\n${legalTextContext}\n\n${girStateContext}\n\nCASE EVIDENCE:\n${context}`;
    
    if (feedback) {
      fullPrompt += `\n\nIMPORTANT - PREVIOUS ATTEMPT FEEDBACK:\nThe QA Auditor rejected the previous classification with these instructions:\n${feedback}\nPlease correct the analysis based on this feedback. Pay special attention to GRI hierarchy compliance and CITATION REQUIREMENTS.`;
    }
    
    console.log(`[AgentJudge] Full prompt length: ${fullPrompt.length} chars`);

    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        task_type: 'reasoning',
        response_schema: {
            type: "object",
            properties: {
                classification_results: {
                    type: "object",
                    properties: {
                        primary: {
                            type: "object",
                            properties: {
                                hs_code: {
                                    type: "string",
                                    description: "Full HS code (8-10 digits) specific to destination country"
                                },
                                confidence_score: {
                                    type: "number",
                                    description: "Confidence score 0-100 based on calibration rubric"
                                },
                                reasoning: {
                                    type: "string",
                                    description: "Complete GRI analysis with Explanatory Notes references and step-by-step logic"
                                },
                                gri_applied: {
                                    type: "string",
                                    description: "Which GRI rule determined the classification (e.g., 'GRI 1', 'GRI 3(b) Essential Character', 'GRI 6')"
                                },
                                gir_state_log: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            state: { type: "string" },
                                            analysis: { type: "string" },
                                            result: { type: "string", enum: ["resolved", "next", "skipped"] },
                                            reason: { type: "string" }
                                        }
                                    },
                                    description: "Log of GIR states visited with analysis at each step"
                                },
                                essential_character_analysis: {
                                    type: "object",
                                    properties: {
                                        components: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    name: { type: "string" },
                                                    nature: { type: "string" },
                                                    bulk_percent: { type: "number" },
                                                    value_percent: { type: "number" },
                                                    functional_role: { type: "string" }
                                                }
                                            }
                                        },
                                        essential_component: { type: "string" },
                                        justification: { type: "string" }
                                    },
                                    description: "Detailed essential character analysis (required if GRI 3(b) used)"
                                },
                                explanatory_note_reference: {
                                    type: "string",
                                    description: "EXACT QUOTE from EN in LEGAL_TEXT_CONTEXT with alignment analysis"
                                },
                                section_chapter_notes_applied: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "List of Section/Chapter Notes with EXACT QUOTES from context"
                                },
                                legal_citations: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            source_type: { 
                                                type: "string", 
                                                enum: ["HEADING_TEXT", "EN", "SECTION_NOTE", "CHAPTER_NOTE", "WCO_OPINION", "BTI", "TARIC", "NATIONAL_TARIFF"] 
                                            },
                                            source_reference: { type: "string" },
                                            exact_quote: { type: "string" },
                                            relevance: { type: "string" }
                                        }
                                    },
                                    description: "All legal citations used in reasoning - MUST cite from LEGAL_TEXT_CONTEXT"
                                },
                                context_gaps: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "List any information that was NOT found in LEGAL_TEXT_CONTEXT"
                                }
                            },
                            required: ["hs_code", "confidence_score", "reasoning", "gri_applied"]
                        },
                        alternatives: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    hs_code: {
                                        type: "string",
                                        description: "Alternative HS code that could potentially fit"
                                    },
                                    confidence_score: {
                                        type: "number",
                                        description: "Confidence score for this alternative (should be lower than primary)"
                                    },
                                    reasoning: {
                                        type: "string",
                                        description: "Why this alternative COULD fit (GRI analysis)"
                                    },
                                    rejection_reason: {
                                        type: "string",
                                        description: "Specific reason why it is REJECTED in favor of primary (cite GRI rule or EN exclusion)"
                                    },
                                    might_apply_if: {
                                        type: "string",
                                        description: "Under what specific conditions this alternative would be correct instead"
                                    }
                                },
                                required: ["hs_code", "rejection_reason", "might_apply_if"]
                            },
                            minItems: 2,
                            maxItems: 2,
                            description: "Exactly 2 viable alternative classifications with detailed rejection reasoning"
                        }
                    },
                    required: ["primary", "alternatives"]
                }
            },
            required: ["classification_results"]
        },
        base44_client: base44
    });

    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        classification_results: result.classification_results,
        hs_code: result.classification_results.primary.hs_code,
        confidence_score: result.classification_results.primary.confidence_score,
        classification_reasoning: result.classification_results.primary.reasoning
    });
    
    return Response.json({ success: true, status: 'classification_completed', results: result.classification_results });

  } catch (error) {
    console.error('Agent C (Judge) Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});