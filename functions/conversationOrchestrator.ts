import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Conversation-Based Classification Orchestrator
 * 
 * Replaces the linear pipeline with an intelligent conversation loop:
 * - Dynamic decision making based on current state
 * - Confidence-driven actions
 * - Self-healing with targeted fixes
 * - Full audit trail
 */

// ============== INLINED MODULES ==============

// --- State Manager ---
function createInitialState(reportId) {
  return {
    report_id: reportId,
    current_round: 0,
    max_rounds: 10,
    rounds: [],
    current_state: {
      product_profile: null,
      product_readiness: 0,
      candidate_headings: null,
      legal_research: null,
      precedents: null,
      gir_decision: null,
      validation_result: null,
      regulatory_status: null
    },
    overall_confidence: 0,
    confidence_trajectory: [],
    status: 'initializing',
    termination_reason: null,
    pending_action: null,
    self_healing_attempts: 0,
    escalation_summary: null
  };
}

function appendRound(state, roundData) {
  const newRound = {
    round: state.current_round + 1,
    agent: roundData.agent,
    action: roundData.action,
    input: roundData.input || {},
    output: roundData.output || {},
    confidence_after: roundData.confidence_after || state.overall_confidence,
    duration_ms: roundData.duration_ms || 0,
    timestamp: new Date().toISOString()
  };
  
  return {
    ...state,
    current_round: state.current_round + 1,
    rounds: [...state.rounds, newRound],
    confidence_trajectory: [...state.confidence_trajectory, roundData.confidence_after || state.overall_confidence]
  };
}

function updateCurrentState(state, updates) {
  return { ...state, current_state: { ...state.current_state, ...updates } };
}

function updateStatus(state, newStatus, reason = null) {
  return { ...state, status: newStatus, termination_reason: reason || state.termination_reason };
}

function incrementSelfHealing(state) {
  return { ...state, self_healing_attempts: state.self_healing_attempts + 1 };
}

function generateEscalationSummary(state) {
  const lastRounds = state.rounds.slice(-5);
  return JSON.stringify({
    report_id: state.report_id,
    total_rounds: state.current_round,
    final_confidence: state.overall_confidence,
    termination_reason: state.termination_reason,
    current_classification: state.current_state.gir_decision?.hs_code || 'Not determined',
    product: state.current_state.product_profile?.standardized_name || 'Unknown',
    issues: state.current_state.validation_result?.issues || [],
    recent_actions: lastRounds.map(r => ({ round: r.round, agent: r.agent, action: r.action, confidence: r.confidence_after }))
  }, null, 2);
}

// --- Confidence Calculator ---
// TARIFF-AI 2.0: Updated weights to emphasize legal text retrieval quality
const WEIGHTS = { 
  PRODUCT: 0.15,      // Product understanding
  LEGAL: 0.25,        // Legal text corpus quality  
  GIR: 0.25,          // GIR classification strength
  CITATION: 0.15,     // NEW: Citation quality (Retrieve & Deduce)
  PRECEDENT: 0.10,    // Precedent support
  VALIDATION: 0.10    // QA validation
};
const GIR_STRENGTH = { 'GIR1': 95, 'GRI 1': 95, 'GIR3a': 85, 'GRI 3(a)': 85, 'GIR3b': 75, 'GRI 3(b)': 75, 'GIR3c': 60, 'GRI 3(c)': 60, 'GIR4': 55 };

function calculateConfidence(state) {
  const cs = state.current_state;
  
  // Product Score - includes composite analysis from agentAnalyze
  const hasCompositeAnalysis = cs.product_profile?.composite_analysis?.is_composite !== undefined;
  const productScore = cs.product_profile 
    ? Math.min(100, (cs.product_readiness || 50) + (cs.product_profile.essential_character ? 10 : 0) + (hasCompositeAnalysis ? 10 : 0)) 
    : 0;
  
  // Legal Score - emphasize raw_legal_text_corpus from agentResearch
  let legalScore = 0;
  if (cs.legal_research) {
    legalScore = 40;
    if (cs.legal_research.raw_legal_text_corpus_length > 1000) legalScore += 25;  // Rich legal text
    if (cs.legal_research.en_documents?.length > 0) legalScore += 15;
    if (cs.legal_research.notes?.length > 0) legalScore += 10;
    if (cs.legal_research.verified_sources?.some(s => s.authority_tier === '1')) legalScore += 10;
    legalScore = Math.min(100, legalScore);
  }
  
  // GIR Score
  let girScore = 70;
  if (cs.gir_decision) {
    const girApplied = cs.gir_decision.gir_applied || cs.gir_decision.gri_applied || '';
    for (const [rule, score] of Object.entries(GIR_STRENGTH)) {
      if (girApplied.includes(rule)) { girScore = score; break; }
    }
    // Bonus for complete essential character analysis
    if (cs.gir_decision.essential_character_analysis?.components?.length > 0) {
      girScore = Math.min(100, girScore + 5);
    }
  } else { girScore = 0; }
  
  // NEW: Citation Score (Retrieve & Deduce compliance)
  let citationScore = 50; // Default
  if (cs.gir_decision?.legal_citations) {
    const citations = cs.gir_decision.legal_citations;
    citationScore = 30;
    if (citations.length >= 3) citationScore += 20;
    if (citations.length >= 5) citationScore += 15;
    if (citations.some(c => c.source_type === 'EN')) citationScore += 15;
    if (citations.some(c => c.source_type === 'WCO_OPINION')) citationScore += 10;
    if (citations.every(c => c.exact_quote?.length > 10)) citationScore += 10;
    citationScore = Math.min(100, citationScore);
  } else if (cs.gir_decision) {
    citationScore = 30; // Penalty for no citations
  }
  
  // Precedent Score
  const precedentScore = cs.precedents 
    ? Math.min(100, 50 + (cs.precedents.wco_opinions?.length ? 30 : 0) + (cs.precedents.bti_cases?.length ? 10 : 0)) 
    : 70;
  
  // Validation Score - include retrieval quality
  let validationScore = 50;
  if (cs.validation_result) {
    validationScore = cs.validation_result.passed ? (cs.validation_result.score || 80) : 20;
    // Factor in retrieval quality score from QA
    if (cs.validation_result.retrieval_quality_score) {
      validationScore = (validationScore + cs.validation_result.retrieval_quality_score) / 2;
    }
  }
  
  // Penalties
  let penalty = 0;
  if (cs.precedents?.consensus?.conflicting_cases?.length > 0) penalty += 10;
  if (cs.gir_decision?.gir_applied?.includes('3c')) penalty += 10;
  if (cs.gir_decision?.context_gaps?.length > 3) penalty += 5; // Penalty for too many context gaps
  
  const weighted = 
    productScore * WEIGHTS.PRODUCT + 
    legalScore * WEIGHTS.LEGAL + 
    girScore * WEIGHTS.GIR + 
    citationScore * WEIGHTS.CITATION +
    precedentScore * WEIGHTS.PRECEDENT + 
    validationScore * WEIGHTS.VALIDATION;
    
  return Math.round(Math.max(0, Math.min(100, weighted - penalty)));
}

// --- Decision Engine ---
const ACTIONS = {
  ANALYZE_PRODUCT: 'analyze_product', REFINE_PRODUCT: 'refine_product', REQUEST_USER_INPUT: 'request_user_input',
  IDENTIFY_CANDIDATES: 'identify_candidates', FETCH_LEGAL_SOURCES: 'fetch_legal_sources', SEARCH_PRECEDENTS: 'search_precedents',
  CLASSIFY: 'classify', VALIDATE: 'validate', SELF_HEAL: 'self_heal', CHECK_REGULATORY: 'check_regulatory',
  FINALIZE: 'finalize', ESCALATE: 'escalate', CALCULATE_TAX: 'calculate_tax', CHECK_COMPLIANCE: 'check_compliance'
};

function decideNextAction(state) {
  const { current_state, current_round, max_rounds, overall_confidence, self_healing_attempts } = state;
  
  // Termination checks
  if (current_round >= max_rounds) return { action: ACTIONS.ESCALATE, reason: 'Maximum rounds reached' };
  if (self_healing_attempts >= 3) return { action: ACTIONS.ESCALATE, reason: 'Self-healing failed after 3 attempts' };
  
  // Stage 1: Product Understanding
  if (!current_state.product_profile) return { action: ACTIONS.ANALYZE_PRODUCT, agent: 'ProductAnalyst', reason: 'Need initial product understanding' };
  if ((current_state.product_readiness || 0) < 80) {
    if (!current_state.product_profile.standardized_name || !current_state.product_profile.function) {
      return { action: ACTIONS.REQUEST_USER_INPUT, reason: 'Critical product data missing', questions: ['What is the exact product name?', 'What is the primary function?'] };
    }
    return { action: ACTIONS.REFINE_PRODUCT, agent: 'ProductAnalyst', specific_request: { type: 'refine' }, reason: 'Product readiness below 80%' };
  }
  
  // Stage 2: Legal Research (uses existing agentResearch which does both candidates + EN)
  if (!current_state.candidate_headings || !current_state.legal_research) {
    return { action: ACTIONS.FETCH_LEGAL_SOURCES, agent: 'HSLegalExpert', reason: 'Need candidate headings and legal sources' };
  }
  
  // Stage 3: Precedents (included in agentResearch output)
  if (!current_state.precedents) {
    return { action: ACTIONS.SEARCH_PRECEDENTS, agent: 'PrecedentResearcher', reason: 'Need precedent research' };
  }
  
  // Stage 4: Classification
  if (!current_state.gir_decision) {
    return { action: ACTIONS.CLASSIFY, agent: 'GIRStateMachine', reason: 'Ready to classify' };
  }
  
  // Stage 5: Validation
  if (!current_state.validation_result) {
    return { action: ACTIONS.VALIDATE, agent: 'QualityValidator', reason: 'Need to validate classification' };
  }
  
  if (!current_state.validation_result.passed) {
    return generateSelfHealingAction(current_state.validation_result, state);
  }
  
  // Stage 6: Tax & Compliance (existing agents)
  if (!current_state.tax_data) {
    return { action: ACTIONS.CALCULATE_TAX, agent: 'TaxAgent', reason: 'Calculate duties and taxes' };
  }
  
  if (!current_state.compliance_data) {
    return { action: ACTIONS.CHECK_COMPLIANCE, agent: 'ComplianceAgent', reason: 'Check compliance requirements' };
  }
  
  // Stage 7: Finalization
  if (overall_confidence >= 60) {
    return { action: ACTIONS.FINALIZE, reason: overall_confidence >= 80 ? 'High confidence classification complete' : 'Moderate confidence - complete with caveats' };
  }
  
  return { action: ACTIONS.ESCALATE, reason: 'Low confidence after all stages' };
}

function generateSelfHealingAction(validationResult, state) {
  const issues = validationResult.issues || [];
  const firstIssue = issues[0];
  
  if (!firstIssue) {
    return { action: ACTIONS.CLASSIFY, agent: 'GIRStateMachine', specific_request: { feedback: 'QA failed - please re-analyze' }, reason: 'Generic validation failure' };
  }
  
  // TARIFF-AI 2.0: Enhanced self-healing for Retrieve & Deduce issues
  
  // Citation issues - re-run Judge with detailed citation enforcement (Task 3.2d)
  if (firstIssue.type?.includes('citation') || firstIssue.type?.includes('no_citations')) {
    let citationFeedback = `CITATION VALIDATION FAILED: ${firstIssue.description}\n\n`;
    
    // Add specific guidance based on issue type
    if (firstIssue.type === 'no_citations' || firstIssue.type === 'empty_citation_quotes') {
      citationFeedback += `REQUIRED FORMAT FOR EACH CITATION:
{
  "source_type": "EN" | "HEADING_TEXT" | "WCO_OPINION" | "BTI" | etc.,
  "source_reference": "Heading 8471" | "WCO Opinion 8471.30/1" | etc.,
  "exact_quote": "[COPY THE ACTUAL TEXT from LEGAL_TEXT_CONTEXT - minimum 20 characters]",
  "relevance": "Why this citation supports the classification"
}

You MUST provide at least 2 citations, including at least one EN or HEADING_TEXT citation.`;
    } else if (firstIssue.type === 'citations_not_in_corpus') {
      citationFeedback += `Your citations could not be verified against the retrieved legal text.
DO NOT fabricate citations. Only quote text that ACTUALLY appears in the LEGAL_TEXT_CONTEXT provided.
If you cannot find supporting text, add it to context_gaps array instead.`;
    } else if (firstIssue.type === 'en_heading_not_researched') {
      citationFeedback += `You cited an EN for a heading that was not in the research candidates.
Only cite ENs for headings that appear in the candidate_headings from research.`;
    } else if (firstIssue.type === 'insufficient_citations') {
      citationFeedback += `Only ${issues.length} citation provided. Robust classification requires at least 2 citations.
Add citations from different source types (EN, HEADING_TEXT, WCO_OPINION, etc.)`;
    }
    
    return { 
      action: ACTIONS.CLASSIFY, 
      agent: 'GIRStateMachine', 
      specific_request: { 
        feedback: citationFeedback,
        enforce_hierarchy: true,
        enforce_citations: true
      }, 
      reason: `Citation issue: ${firstIssue.description}` 
    };
  }
  
  // Legal context issues OR research completeness issues - re-run Research (Task 4.2c.3)
  if (firstIssue.type?.includes('legal_context') || 
      firstIssue.type?.includes('context_gap') ||
      firstIssue.type?.includes('research_no_corpus') ||
      firstIssue.type?.includes('research_corpus_insufficient') ||
      firstIssue.type?.includes('research_no_candidates') ||
      firstIssue.type?.includes('research_no_sources') ||
      firstIssue.action_needed === 'expand_search') {
    
    // Collect all research-related issues for focused expansion
    const researchIssueDescriptions = validationResult.issues
      ?.filter(i => i.type?.includes('research'))
      ?.map(i => i.description)
      ?.join('; ') || firstIssue.description;
    
    return { 
      action: ACTIONS.FETCH_LEGAL_SOURCES, 
      agent: 'HSLegalExpert', 
      specific_request: { 
        expand_search: true,
        focus_areas: researchIssueDescriptions
      }, 
      reason: `Research data insufficient: ${firstIssue.description}` 
    };
  }
  
  // Tax extraction issues - re-run Tax agent
  if (firstIssue.type?.includes('tax_no_citation') || firstIssue.type?.includes('tax_data_gap')) {
    return { 
      action: ACTIONS.CALCULATE_TAX, 
      agent: 'TaxAgent', 
      specific_request: { 
        feedback: `TAX SOURCE REQUIRED: ${firstIssue.description}. Cite duty/VAT sources explicitly.`
      }, 
      reason: `Tax extraction issue: ${firstIssue.description}` 
    };
  }
  
  // Compliance extraction issues - re-run Compliance agent
  if (firstIssue.type?.includes('compliance_no_context')) {
    return { 
      action: ACTIONS.CHECK_COMPLIANCE, 
      agent: 'ComplianceAgent', 
      specific_request: { 
        feedback: `COMPLIANCE SOURCE REQUIRED: ${firstIssue.description}. Cite requirement sources explicitly.`
      }, 
      reason: `Compliance extraction issue: ${firstIssue.description}` 
    };
  }
  
  // GIR hierarchy issues
  if (firstIssue.type?.includes('gir') || firstIssue.type?.includes('hierarchy')) {
    return { 
      action: ACTIONS.CLASSIFY, 
      agent: 'GIRStateMachine', 
      specific_request: { 
        feedback: firstIssue.description, 
        enforce_hierarchy: true 
      }, 
      reason: `GIR issue: ${firstIssue.description}` 
    };
  }
  
  // Essential character issues - need more product analysis
  if (firstIssue.type?.includes('essential_character')) {
    return { 
      action: ACTIONS.REFINE_PRODUCT, 
      agent: 'ProductAnalyst', 
      specific_request: { 
        focus: 'composite_analysis', 
        reason: firstIssue.description 
      }, 
      reason: 'Need detailed composite analysis for essential character' 
    };
  }
  
  // Product data issues
  if (firstIssue.type?.includes('product')) {
    return { 
      action: ACTIONS.REFINE_PRODUCT, 
      agent: 'ProductAnalyst', 
      specific_request: { 
        focus: 'materials', 
        reason: firstIssue.description 
      }, 
      reason: 'Product data insufficient for classification' 
    };
  }
  
  // Default: re-run classification with feedback and citation enforcement
  return { 
    action: ACTIONS.CLASSIFY, 
    agent: 'GIRStateMachine', 
    specific_request: { 
      feedback: firstIssue.description,
      enforce_citations: true
    }, 
    reason: `Validation issue: ${firstIssue.description}` 
  };
}

// ============== MAIN HANDLER ==============

export default Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let reportId = null;
  let conversationState = null;
  let conversationId = null;

  const logProgress = async (stage, message, status = 'success') => {
    if (!reportId) return;
    try {
      const reports = await base44.asServiceRole.entities.ClassificationReport.filter({ id: reportId });
      const currentLog = reports[0]?.processing_log || [];
      await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        processing_log: [...currentLog, { timestamp: new Date().toISOString(), stage, message, status }]
      });
    } catch (e) { console.error('Logging failed:', e); }
  };

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    reportId = payload.reportId;
    const intendedUse = payload.intendedUse || payload.description;

    if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });

    // Verify report exists before proceeding
    console.log(`[Orchestrator] Looking for report with id: ${reportId}`);
    const existingReports = await base44.entities.ClassificationReport.filter({ id: reportId });
    if (!existingReports || existingReports.length === 0) {
        console.error(`[Orchestrator] Report not found: ${reportId}`);
        return Response.json({ error: `Report not found: ${reportId}` }, { status: 404 });
    }
    console.log(`[Orchestrator] Found report: ${existingReports[0].product_name}`);

    // Initialize or load conversation state
    const existingStates = await base44.asServiceRole.entities.ConversationState.filter({ report_id: reportId });
    
    if (existingStates.length > 0 && existingStates[0].status === 'in_progress') {
      conversationState = existingStates[0];
      conversationId = existingStates[0].id;
      await logProgress('orchestrator', `Resuming conversation at round ${conversationState.current_round}`);
    } else {
      conversationState = createInitialState(reportId);
      const created = await base44.asServiceRole.entities.ConversationState.create(conversationState);
      conversationId = created.id;
      conversationState = { ...conversationState, id: conversationId };
      await logProgress('orchestrator', 'Starting new conversation-based classification');
    }

    // Fetch knowledge base
    let knowledgeBase = null;
    try {
      const reportData = await base44.entities.ClassificationReport.filter({ id: reportId });
      if (reportData[0]?.destination_country) {
        const kb = await base44.asServiceRole.entities.CountryTradeResource.filter({ country_name: reportData[0].destination_country });
        knowledgeBase = kb[0] || null;
      }
    } catch (e) { console.warn('KB fetch failed:', e); }

    // Update status
    conversationState = updateStatus(conversationState, 'in_progress');
    await base44.asServiceRole.entities.ConversationState.update(conversationId, { status: 'in_progress' });

    // === CONVERSATION LOOP ===
    const MAX_ITERATIONS = 15; // Safety limit
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      
      // Calculate current confidence
      const confidence = calculateConfidence(conversationState);
      conversationState = { ...conversationState, overall_confidence: confidence };

      // Decide next action
      const decision = decideNextAction(conversationState);
      await logProgress('decision', `Round ${conversationState.current_round + 1}: ${decision.action} - ${decision.reason}`);

      const startTime = Date.now();
      let actionOutput = null;
      let newStateUpdates = {};

      // === EXECUTE ACTION ===
      switch (decision.action) {
        case ACTIONS.ANALYZE_PRODUCT:
        case ACTIONS.REFINE_PRODUCT: {
          await base44.asServiceRole.entities.ClassificationReport.update(reportId, { processing_status: 'analyzing_data' });
          
          let res;
          try {
            res = await base44.functions.invoke('agentAnalyze', { 
              reportId, 
              knowledgeBase, 
              feedback: decision.specific_request?.reason,
              conversationContext: { round: conversationState.current_round, focus: decision.specific_request?.focus }
            });
          } catch (invokeError) {
            console.error('[Orchestrator] agentAnalyze invocation failed:', invokeError.message);
            await logProgress('error', `agentAnalyze invocation failed: ${invokeError.message}`);
            actionOutput = { error: invokeError.message };
            break;
          }

          // Null safety: validate response
          if (!res || !res.data) {
            await logProgress('error', 'agentAnalyze returned null/undefined response');
            actionOutput = { error: 'Agent returned no data' };
            break;
          }
          
          if (res.data.error) {
            await logProgress('error', `agentAnalyze returned error: ${res.data.error}`);
            actionOutput = { error: res.data.error };
            break;
          }

          if (res.data.status === 'waiting_for_user') {
            conversationState = updateStatus(conversationState, 'waiting_for_user', 'Awaiting user input');
            await base44.asServiceRole.entities.ConversationState.update(conversationId, conversationState);
            return Response.json({ success: true, status: 'waiting_for_user', question: res.data.question });
          }

          actionOutput = res.data;
          
          // Defensive access to spec with fallbacks
          const spec = res.data.spec || res.data.technical_spec || {};
          const readinessScore = typeof spec.readiness_score === 'number' ? spec.readiness_score : 85;
          
          newStateUpdates = { 
            product_profile: {
              standardized_name: spec.standardized_name || null,
              material_composition: spec.material_composition || null,
              function: spec.function || null,
              state: spec.state || null,
              essential_character: spec.essential_character || null,
              industry_specific_data: spec.industry_specific_data || {},
              components_breakdown: spec.components_breakdown || [],
              composite_analysis: spec.composite_analysis || { is_composite: false },
              search_queries: spec.search_queries || {},
              industry_category: spec.industry_category || null,
              potential_gir_path: spec.potential_gir_path || null,
              classification_guidance_notes: spec.classification_guidance_notes || null
            },
            product_readiness: readinessScore
          };
          break;
        }

        case ACTIONS.REQUEST_USER_INPUT: {
          const questionText = decision.questions?.join('\n') || decision.reason;
          await base44.asServiceRole.entities.ClassificationReport.update(reportId, { 
            status: 'waiting_for_user', 
            processing_status: 'waiting_for_user',
            missing_info_question: questionText
          });
          conversationState = updateStatus(conversationState, 'waiting_for_user', 'Awaiting user input');
          await base44.asServiceRole.entities.ConversationState.update(conversationId, conversationState);
          
          // Send notification to user
          try {
            const reportData = await base44.entities.ClassificationReport.filter({ id: reportId });
            const report = reportData[0];
            await base44.functions.invoke('sendUserNotification', {
              userEmail: user.email,
              type: 'clarification_needed',
              reportId: reportId,
              reportName: report?.product_name || 'Classification Report',
              question: questionText,
              sendEmail: true
            });
          } catch (notifError) {
            console.error('Failed to send notification:', notifError);
          }
          
          return Response.json({ success: true, status: 'waiting_for_user', questions: decision.questions });
        }

        case ACTIONS.FETCH_LEGAL_SOURCES:
        case ACTIONS.IDENTIFY_CANDIDATES:
        case ACTIONS.SEARCH_PRECEDENTS: {
          await base44.asServiceRole.entities.ClassificationReport.update(reportId, { processing_status: 'researching' });
          
          let res;
          try {
            res = await base44.functions.invoke('agentResearch', { 
              reportId, 
              knowledgeBase,
              expandSearch: decision.specific_request?.expand_search,
              focusAreas: decision.specific_request?.focus_areas
            });
          } catch (invokeError) {
            console.error('[Orchestrator] agentResearch invocation failed:', invokeError.message);
            await logProgress('error', `agentResearch invocation failed: ${invokeError.message}`);
            actionOutput = { error: invokeError.message };
            break;
          }

          // Null safety: validate response
          if (!res || !res.data) {
            await logProgress('error', 'agentResearch returned null/undefined response');
            actionOutput = { error: 'Agent returned no data' };
            break;
          }
          
          if (res.data.error) {
            await logProgress('error', `agentResearch returned error: ${res.data.error}`);
            actionOutput = { error: res.data.error };
            break;
          }

          actionOutput = res.data;

          // Defensive access to findings with fallbacks
          const findings = res.data.findings || res.data.research_findings || {};
          const candidateHeadings = findings.candidate_headings || [];
          const legalNotesFound = findings.legal_notes_found || [];
          const verifiedSources = findings.verified_sources || [];
          const btiCases = findings.bti_cases || [];
          const wcoPrecedents = findings.wco_precedents || [];

          // TARIFF-AI 2.0: Track raw legal text corpus quality
          const rawCorpusLength = findings.raw_legal_text_corpus?.length || 0;
          console.log(`[Orchestrator] Raw legal text corpus: ${rawCorpusLength} chars`);
          console.log(`[Orchestrator] Candidate headings: ${candidateHeadings.length}`);
          console.log(`[Orchestrator] Verified sources: ${verifiedSources.length}`);

          newStateUpdates = {
            candidate_headings: candidateHeadings.map(h => h.code_4_digit || h).filter(Boolean),
            legal_research: {
              en_documents: candidateHeadings,
              notes: legalNotesFound,
              verified_sources: verifiedSources,
              raw_legal_text_corpus_length: rawCorpusLength,
              retrieval_metadata: res.data.retrieval_metadata || {}
            },
            precedents: {
              bti_cases: btiCases,
              wco_opinions: wcoPrecedents,
              consensus: { agreement_rate: wcoPrecedents.length > 0 ? 0.7 : 0 }
            }
          };
          break;
        }

        case ACTIONS.CLASSIFY: {
          // TARIFF-AI 2.0: Reset validation before reclassifying (prevent infinite loop)
          conversationState = updateCurrentState(conversationState, { 
            validation_result: null,
            gir_decision: null
          });

          await base44.asServiceRole.entities.ClassificationReport.update(reportId, { processing_status: 'classifying_hs' });
          
          let res;
          try {
            res = await base44.functions.invoke('agentJudge', { 
              reportId, 
              intendedUse,
              feedback: decision.specific_request?.feedback,
              enforceHierarchy: decision.specific_request?.enforce_hierarchy,
              enforceCitations: decision.specific_request?.enforce_citations
            });
          } catch (invokeError) {
            console.error('[Orchestrator] agentJudge invocation failed:', invokeError.message);
            await logProgress('error', `agentJudge invocation failed: ${invokeError.message}`);
            actionOutput = { error: invokeError.message };
            break;
          }

          // Null safety: validate response
          if (!res || !res.data) {
            await logProgress('error', 'agentJudge returned null/undefined response');
            actionOutput = { error: 'Agent returned no data' };
            break;
          }
          
          if (res.data.error) {
            await logProgress('error', `agentJudge returned error: ${res.data.error}`);
            actionOutput = { error: res.data.error };
            break;
          }

          actionOutput = res.data;

          // Defensive access to results with fallbacks
          const results = res.data.results || res.data.classification_results || {};
          const primary = results.primary || {};
          const hsCode = primary.hs_code || null;
          const girApplied = primary.gri_applied || primary.gir_applied || null;
          const confidenceScore = typeof primary.confidence_score === 'number' ? primary.confidence_score : 0;

          // Validate critical field
          if (!hsCode) {
            await logProgress('warning', 'agentJudge returned no HS code');
          }

          // TARIFF-AI 2.0: Track citation and retrieval metadata
          const legalCitations = Array.isArray(primary.legal_citations) ? primary.legal_citations : [];
          const contextGaps = Array.isArray(primary.context_gaps) ? primary.context_gaps : [];
          const girStateLog = Array.isArray(primary.gir_state_log) ? primary.gir_state_log : [];
          
          console.log(`[Orchestrator] HS Code: ${hsCode || 'N/A'}, GIR: ${girApplied || 'N/A'}`);
          console.log(`[Orchestrator] Classification with ${legalCitations.length} citations, ${contextGaps.length} context gaps`);

          newStateUpdates = {
            gir_decision: {
              hs_code: hsCode,
              gir_applied: girApplied,
              confidence: confidenceScore,
              reasoning: primary.reasoning || '',
              audit_trail: girStateLog.length > 0 ? girStateLog : [{ state: girApplied || 'unknown', result: 'resolved', timestamp: new Date().toISOString() }],
              essential_character_analysis: primary.essential_character_analysis || null,
              legal_citations: legalCitations,
              context_gaps: contextGaps,
              legal_text_based: primary.legal_text_based || false
            }
          };
          break;
        }

        case ACTIONS.VALIDATE: {
          await base44.asServiceRole.entities.ClassificationReport.update(reportId, { processing_status: 'qa_pending' });
          
          let res;
          try {
            res = await base44.functions.invoke('agentQA', { reportId });
          } catch (invokeError) {
            console.error('[Orchestrator] agentQA invocation failed:', invokeError.message);
            await logProgress('error', `agentQA invocation failed: ${invokeError.message}`);
            actionOutput = { error: invokeError.message };
            break;
          }

          // Null safety: validate response
          if (!res || !res.data) {
            await logProgress('error', 'agentQA returned null/undefined response');
            actionOutput = { error: 'Agent returned no data' };
            break;
          }
          
          if (res.data.error) {
            await logProgress('error', `agentQA returned error: ${res.data.error}`);
            actionOutput = { error: res.data.error };
            break;
          }

          actionOutput = res.data;

          // Defensive access to audit object
          const audit = res.data.audit || res.data.qa_audit || {};
          const auditStatus = audit.status || 'unknown';
          const auditScore = typeof audit.score === 'number' ? audit.score : 0;

          // TARIFF-AI 2.0: Extract all QA validation results including R&D checks
          const retrievalMetadata = res.data.retrieval_metadata || {};
          console.log(`[Orchestrator] QA Status: ${auditStatus}, Score: ${auditScore}`);
          console.log(`[Orchestrator] QA Retrieval Score: ${retrievalMetadata.retrieval_quality_score || audit.retrieval_quality_score || 'N/A'}`);
          console.log(`[Orchestrator] Citation Issues: ${retrievalMetadata.citation_issues_count || 'N/A'}`);

          // Collect all issues from QA including pre-validation
          const allIssues = [];
          if (auditStatus !== 'passed' && audit.fix_instructions) {
            allIssues.push({ type: 'qa_failed', description: audit.fix_instructions, severity: 'high' });
          }
          if (Array.isArray(audit.issues_found)) {
            allIssues.push(...audit.issues_found);
          }
          if (Array.isArray(audit.pre_validation_issues)) {
            allIssues.push(...audit.pre_validation_issues);
          }

          // Task 4.2c.3: Track if research needs expansion
          const researchNeedsExpansion = audit.research_needs_expansion || 
            retrievalMetadata.research_needs_expansion || false;
          
          console.log(`[Orchestrator] Research needs expansion: ${researchNeedsExpansion}`);

          newStateUpdates = {
            validation_result: {
              passed: auditStatus === 'passed',
              score: auditScore,
              issues: allIssues,
              gir_compliance: audit.gir_compliance || null,
              citation_validation: audit.citation_validation || null,
              extraction_validation: audit.extraction_validation || null,
              retrieval_quality_score: audit.retrieval_quality_score || retrievalMetadata.retrieval_quality_score || null,
              retrieve_deduce_compliant: audit.retrieve_deduce_compliant || false,
              research_needs_expansion: researchNeedsExpansion,
              detailed_fix_instructions: audit.detailed_fix_instructions || null
            }
          };

          if (auditStatus !== 'passed') {
            conversationState = incrementSelfHealing(conversationState);
          }
          break;
        }

        case ACTIONS.CALCULATE_TAX: {
          await base44.asServiceRole.entities.ClassificationReport.update(reportId, { processing_status: 'calculating_duties' });
          
          let res;
          try {
            res = await base44.functions.invoke('agentTax', { 
              reportId, 
              knowledgeBase,
              feedback: decision.specific_request?.feedback
            });
          } catch (invokeError) {
            console.error('[Orchestrator] agentTax invocation failed:', invokeError.message);
            await logProgress('error', `agentTax invocation failed: ${invokeError.message}`);
            actionOutput = { error: invokeError.message };
            break;
          }

          // Null safety: validate response
          if (!res || !res.data) {
            await logProgress('error', 'agentTax returned null/undefined response');
            actionOutput = { error: 'Agent returned no data' };
            break;
          }
          
          if (res.data.error) {
            await logProgress('error', `agentTax returned error: ${res.data.error}`);
            actionOutput = { error: res.data.error };
            break;
          }

          actionOutput = res.data;

          // TARIFF-AI 2.0: Track extraction metadata with defensive access
          const taxData = res.data.data || res.data.tax_data || {};
          const taxPrimary = taxData.primary || {};
          console.log(`[Orchestrator] Tax extraction confidence: ${taxData.extraction_confidence || 'N/A'}`);
          console.log(`[Orchestrator] Duty rate: ${taxPrimary.duty_rate || 'N/A'}`);

          newStateUpdates = { 
            tax_data: {
              primary: taxPrimary,
              preferential_rates: taxData.preferential_rates || [],
              alternatives: taxData.alternatives || [],
              data_gaps: taxData.data_gaps || [],
              extraction_confidence: taxData.extraction_confidence || 'unknown',
              extraction_metadata: taxData.extraction_metadata || res.data.retrieval_metadata || {}
            }
          };
          break;
        }

        case ACTIONS.CHECK_COMPLIANCE: {
          await base44.asServiceRole.entities.ClassificationReport.update(reportId, { processing_status: 'checking_regulations' });
          
          let res;
          try {
            res = await base44.functions.invoke('agentCompliance', { 
              reportId, 
              knowledgeBase,
              feedback: decision.specific_request?.feedback
            });
          } catch (invokeError) {
            console.error('[Orchestrator] agentCompliance invocation failed:', invokeError.message);
            await logProgress('error', `agentCompliance invocation failed: ${invokeError.message}`);
            actionOutput = { error: invokeError.message };
            break;
          }

          // Null safety: validate response
          if (!res || !res.data) {
            await logProgress('error', 'agentCompliance returned null/undefined response');
            actionOutput = { error: 'Agent returned no data' };
            break;
          }
          
          if (res.data.error) {
            await logProgress('error', `agentCompliance returned error: ${res.data.error}`);
            actionOutput = { error: res.data.error };
            break;
          }

          actionOutput = res.data;

          // TARIFF-AI 2.0: Track extraction metadata with defensive access
          const complianceData = res.data.data || res.data.compliance_data || {};
          console.log(`[Orchestrator] Compliance extraction confidence: ${complianceData.extraction_confidence || 'N/A'}`);
          console.log(`[Orchestrator] Import legality: ${complianceData.import_legality || 'N/A'}`);

          newStateUpdates = { 
            compliance_data: {
              import_requirements: complianceData.import_requirements || [],
              mandatory_standards: complianceData.mandatory_standards || [],
              labeling_laws: complianceData.labeling_laws || [],
              prohibitions: complianceData.prohibitions || [],
              licenses_required: complianceData.licenses_required || [],
              certifications_needed: complianceData.certifications_needed || [],
              import_legality: complianceData.import_legality || 'unknown',
              data_gaps: complianceData.data_gaps || [],
              extraction_confidence: complianceData.extraction_confidence || 'unknown',
              extraction_metadata: complianceData.extraction_metadata || res.data.retrieval_metadata || {}
            }
          };
          break;
        }

        case ACTIONS.FINALIZE: {
          // TARIFF-AI 2.0: Call generateFinalReport for QA and stats update
          await logProgress('orchestrator', 'Running final QA and statistics update');

          try {
            const finalResult = await base44.functions.invoke('generateFinalReport', { reportId });

            if (finalResult.data?.finalStatus === 'failed') {
              // QA failed - escalate
              conversationState = updateStatus(conversationState, 'failed', 'Final QA failed');
              await base44.asServiceRole.entities.ConversationState.update(conversationId, {
                ...conversationState,
                overall_confidence: conversationState.overall_confidence
              });
              await logProgress('orchestrator', `Final QA failed: ${finalResult.data?.qaResult?.critical_errors?.join(', ') || 'Unknown reason'}`, 'error');

              return Response.json({ 
                success: false, 
                status: 'failed', 
                reason: 'Final QA failed',
                qa_notes: finalResult.data?.qaResult?.qa_notes || []
              });
            }

            // QA passed - finalize
            conversationState = updateStatus(conversationState, 'completed', decision.reason);
            await base44.asServiceRole.entities.ConversationState.update(conversationId, {
              ...conversationState,
              overall_confidence: conversationState.overall_confidence
            });
            await logProgress('orchestrator', `Classification completed with confidence ${conversationState.overall_confidence}%`);

            // Send completion notification
            try {
              const reportData = await base44.entities.ClassificationReport.filter({ id: reportId });
              const report = reportData[0];
              await base44.functions.invoke('sendUserNotification', {
                userEmail: user.email,
                type: 'report_completed',
                reportId: reportId,
                reportName: report?.product_name || 'Classification Report',
                sendEmail: true
              });
            } catch (notifError) {
              console.error('Failed to send notification:', notifError);
            }

            return Response.json({ 
              success: true, 
              status: 'completed', 
              report_id: reportId, 
              confidence: conversationState.overall_confidence,
              qa_notes: finalResult.data?.qaResult?.qa_notes || []
            });

          } catch (finalError) {
            console.error('generateFinalReport failed:', finalError);
            await logProgress('orchestrator', `generateFinalReport error: ${finalError.message}`, 'error');

            // Fallback: complete without final QA
            await base44.asServiceRole.entities.ClassificationReport.update(reportId, { 
              status: 'completed', 
              processing_status: 'completed',
              confidence_score: conversationState.overall_confidence
            });
            conversationState = updateStatus(conversationState, 'completed', 'Completed (final QA skipped)');
            await base44.asServiceRole.entities.ConversationState.update(conversationId, conversationState);

            return Response.json({ success: true, status: 'completed', report_id: reportId, confidence: conversationState.overall_confidence });
          }
        }

        case ACTIONS.ESCALATE: {
          const summary = generateEscalationSummary(conversationState);
          await base44.asServiceRole.entities.ClassificationReport.update(reportId, { 
            status: 'failed', 
            processing_status: 'failed',
            error_details: `Escalated: ${decision.reason}`,
            qa_notes: [summary]
          });
          conversationState = updateStatus(conversationState, 'escalated', decision.reason);
          conversationState = { ...conversationState, escalation_summary: summary };
          await base44.asServiceRole.entities.ConversationState.update(conversationId, conversationState);
          await logProgress('orchestrator', `Escalated: ${decision.reason}`, 'warning');
          
          // Send failure notification
          try {
            const reportData = await base44.entities.ClassificationReport.filter({ id: reportId });
            const report = reportData[0];
            await base44.functions.invoke('sendUserNotification', {
              userEmail: user.email,
              type: 'report_failed',
              reportId: reportId,
              reportName: report?.product_name || 'Classification Report',
              sendEmail: true
            });
          } catch (notifError) {
            console.error('Failed to send notification:', notifError);
          }
          
          return Response.json({ success: false, status: 'escalated', reason: decision.reason, summary });
        }

        default:
          await logProgress('orchestrator', `Unknown action: ${decision.action}`, 'error');
          break;
      }

      // Update state
      const duration = Date.now() - startTime;
      conversationState = updateCurrentState(conversationState, newStateUpdates);
      const newConfidence = calculateConfidence(conversationState);
      conversationState = appendRound(conversationState, {
        agent: decision.agent || 'Orchestrator',
        action: decision.action,
        input: decision.specific_request || {},
        output: { success: true, ...newStateUpdates },
        confidence_after: newConfidence,
        duration_ms: duration
      });
      conversationState = { ...conversationState, overall_confidence: newConfidence };

      // Persist state
      await base44.asServiceRole.entities.ConversationState.update(conversationId, {
        current_round: conversationState.current_round,
        rounds: conversationState.rounds,
        current_state: conversationState.current_state,
        overall_confidence: conversationState.overall_confidence,
        confidence_trajectory: conversationState.confidence_trajectory,
        self_healing_attempts: conversationState.self_healing_attempts
      });
    }

    // Safety: max iterations reached
    await logProgress('orchestrator', 'Max iterations reached - escalating', 'error');
    return Response.json({ success: false, status: 'escalated', reason: 'Max iterations reached' });

  } catch (error) {
    console.error('Orchestrator Error:', error);
    
    if (reportId) {
      await logProgress('error', `Orchestrator crashed: ${error.message}`, 'failed');
      await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        status: 'failed',
        processing_status: 'failed',
        error_details: error.message
      });
    }
    
    if (conversationId) {
      await base44.asServiceRole.entities.ConversationState.update(conversationId, {
        status: 'failed',
        termination_reason: error.message
      });
    }
    
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});