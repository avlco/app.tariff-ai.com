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
  console.log(`[LLM Gateway - QA] Using Claude Sonnet 4`);
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  const fullPrompt = prompt + jsonInstruction;

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
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

// --- GIR VALIDATION LOGIC ---

function validateGirHierarchy(classificationResults) {
  const issues = [];
  const girApplied = classificationResults?.primary?.gri_applied || '';
  const stateLog = classificationResults?.primary?.gir_state_log || [];
  
  // Check if GIR state log exists
  if (stateLog.length === 0 && !girApplied.includes('GRI 1')) {
    issues.push({
      type: 'gir_hierarchy_violation',
      severity: 'high',
      description: 'No GIR state log provided - cannot verify hierarchy compliance'
    });
  }
  
  // Check GIR 3(b) requires essential character analysis
  if (girApplied.includes('3(b)') || girApplied.includes('3b')) {
    const ecAnalysis = classificationResults?.primary?.essential_character_analysis;
    if (!ecAnalysis || !ecAnalysis.components || ecAnalysis.components.length === 0) {
      issues.push({
        type: 'essential_character_incomplete',
        severity: 'high',
        description: 'GRI 3(b) used but no essential character component analysis provided'
      });
    } else if (!ecAnalysis.justification) {
      issues.push({
        type: 'essential_character_incomplete',
        severity: 'medium',
        description: 'Essential character analysis missing justification'
      });
    }
  }
  
  // Check hierarchy was followed
  const girOrder = ['GRI 1', 'GRI 2', 'GRI 3(a)', 'GRI 3(b)', 'GRI 3(c)', 'GRI 4'];
  const appliedIndex = girOrder.findIndex(g => girApplied.includes(g.replace('GRI ', '').replace('(', '').replace(')', '')));
  
  if (appliedIndex > 0 && stateLog.length > 0) {
    // Verify all prior states were visited
    const visitedStates = stateLog.map(s => s.state);
    for (let i = 0; i < appliedIndex; i++) {
      const expectedState = girOrder[i].replace('GRI ', 'GRI_').replace('(', '').replace(')', '');
      const found = visitedStates.some(v => v.includes(expectedState) || v.includes(girOrder[i]));
      if (!found) {
        issues.push({
          type: 'gir_hierarchy_violation',
          severity: 'high',
          description: `${girOrder[i]} was skipped before applying ${girApplied}`,
          missing_state: girOrder[i]
        });
      }
    }
  }
  
  return issues;
}

function validateEnAlignment(classificationResults, researchFindings) {
  const issues = [];
  const reasoning = classificationResults?.primary?.reasoning || '';
  const enReference = classificationResults?.primary?.explanatory_note_reference || '';
  
  // Check if EN was referenced
  if (!reasoning.toLowerCase().includes('explanatory note') && !enReference) {
    issues.push({
      type: 'en_not_referenced',
      severity: 'medium',
      description: 'Explanatory Notes not explicitly referenced in reasoning'
    });
  }
  
  // Check for EN exclusion violations
  const candidateHeadings = researchFindings?.candidate_headings || [];
  const selectedCode = classificationResults?.primary?.hs_code?.substring(0, 4);
  
  for (const heading of candidateHeadings) {
    if (heading.code_4_digit === selectedCode && heading.en_exclusions) {
      // Check if any exclusion might apply
      issues.push({
        type: 'en_exclusion_check_needed',
        severity: 'low',
        description: `Heading ${selectedCode} has EN exclusions that should be verified`,
        exclusions: heading.en_exclusions
      });
    }
  }
  
  return issues;
}

function validatePrecedentConsistency(classificationResults, researchFindings) {
  const issues = [];
  const selectedCode = classificationResults?.primary?.hs_code;
  const wcoOpinions = researchFindings?.wco_precedents || [];
  
  // Check for conflicting WCO opinions
  for (const opinion of wcoOpinions) {
    const opinionCode = opinion.hs_code || opinion.classification;
    if (opinionCode && opinionCode.substring(0, 4) !== selectedCode?.substring(0, 4)) {
      issues.push({
        type: 'precedent_conflict',
        severity: 'medium',
        description: `WCO opinion suggests ${opinionCode} but classification is ${selectedCode}`,
        bti_case: opinion
      });
    }
  }
  
  return issues;
}

// --- END GIR VALIDATION LOGIC ---

// --- TARIFF-AI 2.0: CITATION VALIDATION LOGIC ---

/**
 * Validate that legal citations reference actual content from the retrieved corpus
 * This is the KEY validation for "Retrieve & Deduce" architecture
 */
function validateCitations(classificationResults, researchFindings) {
  const issues = [];
  const legalCitations = classificationResults?.primary?.legal_citations || [];
  const contextGaps = classificationResults?.primary?.context_gaps || [];
  
  // Check if citations exist at all
  if (legalCitations.length === 0) {
    issues.push({
      type: 'no_citations',
      severity: 'high',
      description: 'No legal citations provided - Retrieve & Deduce protocol requires explicit citations from LEGAL_TEXT_CONTEXT'
    });
  }
  
  // Check citation types distribution
  const citationTypes = legalCitations.map(c => c.source_type);
  const hasHeadingText = citationTypes.includes('HEADING_TEXT');
  const hasEN = citationTypes.includes('EN');
  const hasOfficialSource = citationTypes.some(t => 
    ['TARIC', 'WCO_OPINION', 'BTI', 'NATIONAL_TARIFF', 'SECTION_NOTE', 'CHAPTER_NOTE'].includes(t)
  );
  
  if (!hasHeadingText && !hasEN) {
    issues.push({
      type: 'missing_core_citations',
      severity: 'medium',
      description: 'Classification missing HEADING_TEXT or EN citations - core legal basis not explicitly cited'
    });
  }
  
  // Validate citations have actual quotes
  for (const citation of legalCitations) {
    if (!citation.exact_quote || citation.exact_quote.length < 10) {
      issues.push({
        type: 'empty_citation',
        severity: 'medium',
        description: `Citation ${citation.source_type}/${citation.source_reference} has no exact quote`
      });
    }
  }
  
  // Check context gaps are flagged
  if (contextGaps.length > 3) {
    issues.push({
      type: 'excessive_context_gaps',
      severity: 'medium',
      description: `${contextGaps.length} context gaps flagged - classification may need more research`
    });
  }
  
  // Cross-reference citations with research findings
  const rawCorpus = researchFindings?.raw_legal_text_corpus || '';
  const candidateHeadings = researchFindings?.candidate_headings || [];
  const wcoOpinions = researchFindings?.wco_precedents || [];
  
  // Verify WCO citations exist in research
  const wcoCitations = legalCitations.filter(c => c.source_type === 'WCO_OPINION');
  for (const citation of wcoCitations) {
    const foundInResearch = wcoOpinions.some(op => 
      citation.source_reference?.includes(op.opinion_number) ||
      citation.exact_quote?.includes(op.reasoning?.substring(0, 30))
    );
    if (!foundInResearch && wcoOpinions.length > 0) {
      issues.push({
        type: 'unverified_citation',
        severity: 'low',
        description: `WCO citation ${citation.source_reference} not found in research findings - may be fabricated`
      });
    }
  }
  
  // Check if EN citations align with candidate headings
  const enCitations = legalCitations.filter(c => c.source_type === 'EN');
  for (const citation of enCitations) {
    const headingCode = citation.source_reference?.match(/\d{4}/)?.[0];
    if (headingCode) {
      const foundInCandidates = candidateHeadings.some(h => h.code_4_digit === headingCode);
      if (!foundInCandidates) {
        issues.push({
          type: 'citation_heading_mismatch',
          severity: 'medium',
          description: `EN citation for heading ${headingCode} but heading not in candidate list from research`
        });
      }
    }
  }
  
  return issues;
}

/**
 * Validate tax and compliance extraction quality
 */
function validateExtractionQuality(regulatoryData) {
  const issues = [];
  
  // Check tax extraction
  const taxMeta = regulatoryData?.tax_extraction_metadata;
  const compMeta = regulatoryData?.compliance_extraction_metadata;
  
  if (taxMeta) {
    if (!taxMeta.legal_context_available) {
      issues.push({
        type: 'tax_no_context',
        severity: 'medium',
        description: 'Tax rates extracted without legal context - may be estimates'
      });
    }
  }
  
  if (compMeta) {
    if (!compMeta.legal_context_available) {
      issues.push({
        type: 'compliance_no_context',
        severity: 'medium',
        description: 'Compliance requirements extracted without legal context - may be generic'
      });
    }
  }
  
  // Check for "NOT_FOUND_IN_CONTEXT" markers
  const primary = regulatoryData?.primary || {};
  if (primary.duty_rate?.includes('NOT_FOUND') || primary.vat_rate?.includes('NOT_FOUND')) {
    issues.push({
      type: 'tax_data_gap',
      severity: 'low',
      description: 'Some tax rates not found in retrieved context - manual verification recommended'
    });
  }
  
  // Check source citations exist for rates
  if (!primary.duty_rate_source && primary.duty_rate && !primary.duty_rate.includes('NOT_FOUND')) {
    issues.push({
      type: 'tax_no_citation',
      severity: 'medium',
      description: 'Duty rate provided without source citation'
    });
  }
  
  return issues;
}

/**
 * Calculate retrieval quality score
 */
function calculateRetrievalScore(researchFindings, classificationResults) {
  let score = 100;
  
  // Raw legal text corpus presence (+20 if exists, -10 if missing)
  if (researchFindings?.raw_legal_text_corpus?.length > 1000) {
    score += 10;
  } else if (!researchFindings?.raw_legal_text_corpus) {
    score -= 10;
  }
  
  // Citation count (expect at least 3)
  const citationCount = classificationResults?.primary?.legal_citations?.length || 0;
  if (citationCount >= 5) score += 10;
  else if (citationCount >= 3) score += 5;
  else if (citationCount === 0) score -= 20;
  
  // Context gaps penalty
  const gapCount = classificationResults?.primary?.context_gaps?.length || 0;
  score -= gapCount * 3;
  
  // Legal text used flag
  if (classificationResults?.primary?.legal_text_based) {
    score += 5;
  }
  
  return Math.max(0, Math.min(100, score));
}

// --- END CITATION VALIDATION LOGIC ---

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
    
    // Pre-validate using rule-based checks
    const girIssues = validateGirHierarchy(report.classification_results);
    const enIssues = validateEnAlignment(report.classification_results, report.research_findings);
    const precedentIssues = validatePrecedentConsistency(report.classification_results, report.research_findings);
    
    const preValidationIssues = [...girIssues, ...enIssues, ...precedentIssues];
    const criticalIssues = preValidationIssues.filter(i => i.severity === 'high');
    
    const preValidationContext = preValidationIssues.length > 0 ? `
═══════════════════════════════════════════════════════════════════
PRE-VALIDATION ISSUES DETECTED (Rule-Based):
═══════════════════════════════════════════════════════════════════
${preValidationIssues.map(i => `• [${i.severity.toUpperCase()}] ${i.type}: ${i.description}`).join('\n')}

${criticalIssues.length > 0 ? 'CRITICAL ISSUES FOUND - Likely FAIL unless reasoning explains why these are acceptable.' : ''}
` : '';

    const context = `
REPORT ID: ${reportId}
Technical Spec: ${JSON.stringify(report.structural_analysis)}
Research: ${JSON.stringify(report.research_findings)}
Judge Results: ${JSON.stringify(report.classification_results)}
Regulatory Data: ${JSON.stringify(report.regulatory_data)}

${preValidationContext}
`;

    const systemPrompt = `
You are a SENIOR QUALITY ASSURANCE AUDITOR for customs classification reports.
Your role is the FINAL GATE before the report is delivered to the user.

═══════════════════════════════════════════════════════════════════
QA AUDIT PROTOCOL - COMPREHENSIVE CHECKS:
═══════════════════════════════════════════════════════════════════

**CHECK 1: GRI COMPLIANCE VALIDATION (ENHANCED)**

Review the classification reasoning from Agent C (Judge).

MANDATORY: Check the gir_state_log if provided. This shows the GRI states visited.

Verify:
✓ Was a specific GRI rule cited? (GRI 1, 2a, 2b, 3a, 3b, 3c, 4, 5, or 6)
✓ Was the GRI sequence followed correctly? (Check gir_state_log)
  → Each state must show analysis BEFORE transitioning to next
  → If GRI 3 was used: Was GRI 1 truly ambiguous? (If not, ERROR)
  → If GRI 3(b) was used: Check essential_character_analysis object
    - Must have components array with Nature/Bulk/Value/Role for EACH component
    - Must have clear justification for which component gives essential character
  → If GRI 3(c) was used: Were 3(a) and 3(b) genuinely unable to resolve?

GRI 3(b) ESSENTIAL CHARACTER - DETAILED CHECK:
If GRI 3(b) is claimed:
□ Does essential_character_analysis.components exist?
□ Does it list ALL major components?
□ Are bulk_percent and value_percent provided?
□ Is the functional_role explained for each?
□ Is the essential_component clearly identified with justification?

If ANY of the above is missing → status: "failed", faulty_agent: "judge"
fix_instructions: "GRI 3(b) requires complete essential character analysis with component breakdown"

Common GRI ERRORS to catch:
❌ Jumping to GRI 3 when GRI 1 was sufficient (heading was unambiguous)
❌ Using GRI 3(b) Essential Character without analyzing all components
❌ Using GRI 3(c) without trying 3(a) and 3(b) first
❌ Misapplying GRI 2(a) to complete goods
❌ Empty gir_state_log when GRI > 1 is used

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
                        fix_instructions: { type: "string" },
                        issues_found: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    type: { type: "string" },
                                    severity: { type: "string", enum: ["high", "medium", "low"] },
                                    description: { type: "string" }
                                }
                            },
                            description: "Detailed list of issues found during QA"
                        },
                        gir_compliance: {
                            type: "object",
                            properties: {
                                hierarchy_followed: { type: "boolean" },
                                states_visited: { type: "array", items: { type: "string" } },
                                essential_character_complete: { type: "boolean" }
                            }
                        }
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