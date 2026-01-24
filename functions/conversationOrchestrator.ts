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
const WEIGHTS = { PRODUCT: 0.20, LEGAL: 0.25, GIR: 0.30, PRECEDENT: 0.15, VALIDATION: 0.10 };
const GIR_STRENGTH = { 'GIR1': 95, 'GRI 1': 95, 'GIR3a': 85, 'GRI 3(a)': 85, 'GIR3b': 75, 'GRI 3(b)': 75, 'GIR3c': 60, 'GRI 3(c)': 60, 'GIR4': 55 };

function calculateConfidence(state) {
  const cs = state.current_state;
  
  const productScore = cs.product_profile ? Math.min(100, (cs.product_readiness || 50) + (cs.product_profile.essential_character ? 10 : 0)) : 0;
  const legalScore = cs.legal_research ? Math.min(100, 40 + (cs.legal_research.en_documents?.length ? 20 : 0) + (cs.legal_research.notes?.length ? 15 : 0)) : 0;
  
  let girScore = 70;
  if (cs.gir_decision) {
    const girApplied = cs.gir_decision.gir_applied || cs.gir_decision.gri_applied || '';
    for (const [rule, score] of Object.entries(GIR_STRENGTH)) {
      if (girApplied.includes(rule)) { girScore = score; break; }
    }
  } else { girScore = 0; }
  
  const precedentScore = cs.precedents ? Math.min(100, 50 + (cs.precedents.wco_opinions?.length ? 30 : 0) + (cs.precedents.bti_cases?.length ? 10 : 0)) : 70;
  const validationScore = cs.validation_result ? (cs.validation_result.passed ? (cs.validation_result.score || 80) : 20) : 50;
  
  let penalty = 0;
  if (cs.precedents?.consensus?.conflicting_cases?.length > 0) penalty += 10;
  if (cs.gir_decision?.gir_applied?.includes('3c')) penalty += 10;
  
  const weighted = productScore * WEIGHTS.PRODUCT + legalScore * WEIGHTS.LEGAL + girScore * WEIGHTS.GIR + precedentScore * WEIGHTS.PRECEDENT + validationScore * WEIGHTS.VALIDATION;
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
  
  if (firstIssue.type?.includes('gir') || firstIssue.type?.includes('hierarchy')) {
    return { action: ACTIONS.CLASSIFY, agent: 'GIRStateMachine', specific_request: { feedback: firstIssue.description, enforce_hierarchy: true }, reason: `GIR issue: ${firstIssue.description}` };
  }
  
  if (firstIssue.type?.includes('product') || firstIssue.type?.includes('essential')) {
    return { action: ACTIONS.REFINE_PRODUCT, agent: 'ProductAnalyst', specific_request: { focus: 'materials', reason: firstIssue.description }, reason: 'Product data insufficient for classification' };
  }
  
  // Default: re-run classification with feedback
  return { action: ACTIONS.CLASSIFY, agent: 'GIRStateMachine', specific_request: { feedback: firstIssue.description }, reason: `Validation issue: ${firstIssue.description}` };
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
        const kb = await base44.asServiceRole.entities.CountryKnowledgeBase.filter({ country: reportData[0].destination_country });
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
          const res = await base44.functions.invoke('agentAnalyze', { 
            reportId, 
            knowledgeBase, 
            feedback: decision.specific_request?.reason,
            conversationContext: { round: conversationState.current_round, focus: decision.specific_request?.focus }
          });
          
          if (res.data.status === 'waiting_for_user') {
            conversationState = updateStatus(conversationState, 'waiting_for_user', 'Awaiting user input');
            await base44.asServiceRole.entities.ConversationState.update(conversationId, conversationState);
            return Response.json({ success: true, status: 'waiting_for_user', question: res.data.question });
          }
          
          actionOutput = res.data;
          newStateUpdates = { 
            product_profile: res.data.spec || res.data.technical_spec,
            product_readiness: res.data.spec?.readiness_score || 85
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
          const res = await base44.functions.invoke('agentResearch', { reportId, knowledgeBase });
          actionOutput = res.data;
          
          const findings = res.data.findings || {};
          newStateUpdates = {
            candidate_headings: findings.candidate_headings?.map(h => h.code_4_digit) || [],
            legal_research: {
              en_documents: findings.candidate_headings || [],
              notes: findings.legal_notes_found || [],
              verified_sources: findings.verified_sources || []
            },
            precedents: {
              bti_cases: findings.wco_precedents || [],
              wco_opinions: [],
              consensus: { agreement_rate: findings.wco_precedents?.length > 0 ? 0.7 : 0 }
            }
          };
          break;
        }

        case ACTIONS.CLASSIFY: {
          await base44.asServiceRole.entities.ClassificationReport.update(reportId, { processing_status: 'classifying_hs' });
          const res = await base44.functions.invoke('agentJudge', { 
            reportId, 
            intendedUse,
            feedback: decision.specific_request?.feedback,
            enforceHierarchy: decision.specific_request?.enforce_hierarchy
          });
          actionOutput = res.data;
          
          const results = res.data.results || res.data.classification_results;
          newStateUpdates = {
            gir_decision: {
              hs_code: results?.primary?.hs_code,
              gir_applied: results?.primary?.gri_applied || results?.primary?.gir_applied,
              confidence: results?.primary?.confidence_score,
              reasoning: results?.primary?.reasoning,
              audit_trail: [{ state: results?.primary?.gri_applied, result: 'resolved', timestamp: new Date().toISOString() }]
            }
          };
          break;
        }

        case ACTIONS.VALIDATE: {
          await base44.asServiceRole.entities.ClassificationReport.update(reportId, { processing_status: 'qa_pending' });
          const res = await base44.functions.invoke('agentQA', { reportId });
          actionOutput = res.data;
          
          const audit = res.data.audit || res.data.qa_audit;
          newStateUpdates = {
            validation_result: {
              passed: audit?.status === 'passed',
              score: audit?.score,
              issues: audit?.status !== 'passed' ? [{ type: 'qa_failed', description: audit?.fix_instructions }] : []
            }
          };
          
          if (audit?.status !== 'passed') {
            conversationState = incrementSelfHealing(conversationState);
          }
          break;
        }

        case ACTIONS.CALCULATE_TAX: {
          await base44.asServiceRole.entities.ClassificationReport.update(reportId, { processing_status: 'calculating_duties' });
          const res = await base44.functions.invoke('agentTax', { reportId, knowledgeBase });
          actionOutput = res.data;
          newStateUpdates = { tax_data: res.data };
          break;
        }

        case ACTIONS.CHECK_COMPLIANCE: {
          await base44.asServiceRole.entities.ClassificationReport.update(reportId, { processing_status: 'checking_regulations' });
          const res = await base44.functions.invoke('agentCompliance', { reportId, knowledgeBase });
          actionOutput = res.data;
          newStateUpdates = { compliance_data: res.data };
          break;
        }

        case ACTIONS.FINALIZE: {
          await base44.asServiceRole.entities.ClassificationReport.update(reportId, { 
            status: 'completed', 
            processing_status: 'completed',
            confidence_score: conversationState.overall_confidence
          });
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
          
          return Response.json({ success: true, status: 'completed', report_id: reportId, confidence: conversationState.overall_confidence });
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