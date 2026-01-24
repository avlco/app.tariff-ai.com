/**
 * Conversation State Manager - Manages conversation state lifecycle
 */

/**
 * Create initial conversation state
 */
export function createInitialState(reportId) {
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

/**
 * Append a new round to conversation state
 */
export function appendRound(state, roundData) {
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

/**
 * Update current state with new data
 */
export function updateCurrentState(state, updates) {
  return {
    ...state,
    current_state: {
      ...state.current_state,
      ...updates
    }
  };
}

/**
 * Update conversation status
 */
export function updateStatus(state, newStatus, reason = null) {
  return {
    ...state,
    status: newStatus,
    termination_reason: reason || state.termination_reason
  };
}

/**
 * Set pending action
 */
export function setPendingAction(state, action) {
  return {
    ...state,
    pending_action: action
  };
}

/**
 * Increment self-healing attempts
 */
export function incrementSelfHealing(state) {
  return {
    ...state,
    self_healing_attempts: state.self_healing_attempts + 1
  };
}

/**
 * Update overall confidence
 */
export function updateConfidence(state, newConfidence) {
  return {
    ...state,
    overall_confidence: newConfidence
  };
}

/**
 * Generate escalation summary for human review
 */
export function generateEscalationSummary(state) {
  const lastRounds = state.rounds.slice(-5);
  
  const summary = {
    report_id: state.report_id,
    total_rounds: state.current_round,
    final_confidence: state.overall_confidence,
    termination_reason: state.termination_reason,
    current_classification: state.current_state.gir_decision?.hs_code || 'Not determined',
    product: state.current_state.product_profile?.standardized_name || 'Unknown',
    issues: state.current_state.validation_result?.issues || [],
    recent_actions: lastRounds.map(r => ({
      round: r.round,
      agent: r.agent,
      action: r.action,
      confidence: r.confidence_after
    })),
    recommendations: []
  };
  
  // Add recommendations based on state
  if (state.self_healing_attempts >= 3) {
    summary.recommendations.push('Self-healing exhausted - manual review of classification logic needed');
  }
  
  if (state.current_round >= state.max_rounds) {
    summary.recommendations.push('Maximum rounds reached - consider simplifying product description or providing more details');
  }
  
  if (state.current_state.precedents?.consensus?.conflicting_cases?.length > 0) {
    summary.recommendations.push('Conflicting precedents found - legal expert review recommended');
  }
  
  return JSON.stringify(summary, null, 2);
}

/**
 * Prepare state for database storage (flatten complex objects)
 */
export function prepareForStorage(state) {
  return {
    report_id: state.report_id,
    current_round: state.current_round,
    max_rounds: state.max_rounds,
    rounds: state.rounds,
    current_state: state.current_state,
    overall_confidence: state.overall_confidence,
    confidence_trajectory: state.confidence_trajectory,
    status: state.status,
    termination_reason: state.termination_reason,
    pending_action: state.pending_action,
    self_healing_attempts: state.self_healing_attempts,
    escalation_summary: state.escalation_summary
  };
}

/**
 * Load state from database record
 */
export function loadFromStorage(record) {
  return {
    report_id: record.report_id,
    current_round: record.current_round || 0,
    max_rounds: record.max_rounds || 10,
    rounds: record.rounds || [],
    current_state: record.current_state || {
      product_profile: null,
      product_readiness: 0,
      candidate_headings: null,
      legal_research: null,
      precedents: null,
      gir_decision: null,
      validation_result: null,
      regulatory_status: null
    },
    overall_confidence: record.overall_confidence || 0,
    confidence_trajectory: record.confidence_trajectory || [],
    status: record.status || 'initializing',
    termination_reason: record.termination_reason,
    pending_action: record.pending_action,
    self_healing_attempts: record.self_healing_attempts || 0,
    escalation_summary: record.escalation_summary
  };
}