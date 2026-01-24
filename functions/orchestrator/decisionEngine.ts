/**
 * Decision Engine - Determines the next action in the conversation
 * Rule-based system (not AI) with priority: product → legal → precedents → classify → validate → regulatory
 */

const STAGES = {
  PRODUCT_UNDERSTANDING: 'product_understanding',
  LEGAL_RESEARCH: 'legal_research',
  PRECEDENT_SEARCH: 'precedent_search',
  CLASSIFICATION: 'classification',
  VALIDATION: 'validation',
  REGULATORY: 'regulatory',
  FINALIZATION: 'finalization'
};

const ACTIONS = {
  ANALYZE_PRODUCT: 'analyze_product',
  REFINE_PRODUCT: 'refine_product',
  REQUEST_USER_INPUT: 'request_user_input',
  IDENTIFY_CANDIDATES: 'identify_candidates',
  FETCH_LEGAL_SOURCES: 'fetch_legal_sources',
  SEARCH_PRECEDENTS: 'search_precedents',
  CLASSIFY: 'classify',
  VALIDATE: 'validate',
  SELF_HEAL: 'self_heal',
  CHECK_REGULATORY: 'check_regulatory',
  FINALIZE: 'finalize',
  ESCALATE: 'escalate'
};

const AGENTS = {
  PRODUCT_ANALYST: 'ProductAnalyst',
  HS_LEGAL_EXPERT: 'HSLegalExpert',
  PRECEDENT_RESEARCHER: 'PrecedentResearcher',
  GIR_STATE_MACHINE: 'GIRStateMachine',
  QUALITY_VALIDATOR: 'QualityValidator',
  REGULATORY_EXPERT: 'RegulatoryExpert'
};

/**
 * Main decision function - determines next action based on conversation state
 */
export function decideNextAction(conversationState) {
  const { current_state, current_round, max_rounds, overall_confidence, self_healing_attempts } = conversationState;
  
  // === TERMINATION CHECKS ===
  
  // Check max rounds
  if (current_round >= max_rounds) {
    return {
      action: ACTIONS.ESCALATE,
      reason: 'Maximum rounds reached - complex case requiring human review',
      stage: STAGES.FINALIZATION
    };
  }
  
  // Check for stuck self-healing
  if (self_healing_attempts >= 3) {
    return {
      action: ACTIONS.ESCALATE,
      reason: 'Self-healing failed after 3 attempts',
      stage: STAGES.FINALIZATION
    };
  }
  
  // === STAGE 1: PRODUCT UNDERSTANDING ===
  
  if (!current_state?.product_profile) {
    return {
      action: ACTIONS.ANALYZE_PRODUCT,
      agent: AGENTS.PRODUCT_ANALYST,
      reason: 'Need initial product understanding',
      stage: STAGES.PRODUCT_UNDERSTANDING
    };
  }
  
  const productReadiness = current_state.product_readiness || 0;
  
  if (productReadiness < 80) {
    // Check what's missing
    const missingFields = identifyMissingProductData(current_state.product_profile);
    
    if (missingFields.critical.length > 0) {
      return {
        action: ACTIONS.REQUEST_USER_INPUT,
        reason: 'Insufficient product data - critical information missing',
        questions: generateQuestions(missingFields.critical),
        stage: STAGES.PRODUCT_UNDERSTANDING
      };
    }
    
    // Try to refine with inference
    return {
      action: ACTIONS.REFINE_PRODUCT,
      agent: AGENTS.PRODUCT_ANALYST,
      specific_request: {
        type: 'refine',
        focus: missingFields.optional[0] || 'general',
        reason: 'Improve product data completeness'
      },
      reason: 'Product readiness below 80%, attempting refinement',
      stage: STAGES.PRODUCT_UNDERSTANDING
    };
  }
  
  // Check if GIR 3b needs material percentages
  if (current_state.gir_decision?.gir_applied?.includes('3b')) {
    const profile = current_state.product_profile;
    if (!hasDetailedMaterialBreakdown(profile)) {
      return {
        action: ACTIONS.REFINE_PRODUCT,
        agent: AGENTS.PRODUCT_ANALYST,
        specific_request: {
          type: 'refine',
          focus: 'materials',
          reason: 'GIR 3(b) requires detailed material composition with %weight and %value'
        },
        reason: 'GIR 3(b) essential character analysis needs material breakdown',
        stage: STAGES.PRODUCT_UNDERSTANDING
      };
    }
  }
  
  // === STAGE 2: LEGAL RESEARCH ===
  
  if (!current_state.candidate_headings || current_state.candidate_headings.length === 0) {
    return {
      action: ACTIONS.IDENTIFY_CANDIDATES,
      agent: AGENTS.HS_LEGAL_EXPERT,
      reason: 'Need to identify potential HS headings',
      stage: STAGES.LEGAL_RESEARCH
    };
  }
  
  if (!current_state.legal_research) {
    return {
      action: ACTIONS.FETCH_LEGAL_SOURCES,
      agent: AGENTS.HS_LEGAL_EXPERT,
      specific_request: {
        headings: current_state.candidate_headings
      },
      reason: 'Need Explanatory Notes and Section/Chapter Notes for classification',
      stage: STAGES.LEGAL_RESEARCH
    };
  }
  
  // === STAGE 3: PRECEDENT SEARCH ===
  
  if (!current_state.precedents) {
    return {
      action: ACTIONS.SEARCH_PRECEDENTS,
      agent: AGENTS.PRECEDENT_RESEARCHER,
      specific_request: {
        product_name: current_state.product_profile?.standardized_name,
        candidate_headings: current_state.candidate_headings
      },
      reason: 'Need to check existing classifications and precedents',
      stage: STAGES.PRECEDENT_SEARCH
    };
  }
  
  // === STAGE 4: CLASSIFICATION ===
  
  if (!current_state.gir_decision) {
    return {
      action: ACTIONS.CLASSIFY,
      agent: AGENTS.GIR_STATE_MACHINE,
      specific_request: {
        product: current_state.product_profile,
        legal: current_state.legal_research,
        precedents: current_state.precedents
      },
      reason: 'Ready to classify - all prerequisites gathered',
      stage: STAGES.CLASSIFICATION
    };
  }
  
  // === STAGE 5: VALIDATION ===
  
  if (!current_state.validation_result) {
    return {
      action: ACTIONS.VALIDATE,
      agent: AGENTS.QUALITY_VALIDATOR,
      reason: 'Need to validate classification logic',
      stage: STAGES.VALIDATION
    };
  }
  
  // Handle validation failure
  if (!current_state.validation_result.passed) {
    return generateSelfHealingAction(current_state.validation_result, conversationState);
  }
  
  // === STAGE 6: REGULATORY CHECK ===
  
  if (!current_state.regulatory_status) {
    return {
      action: ACTIONS.CHECK_REGULATORY,
      agent: AGENTS.REGULATORY_EXPERT,
      specific_request: {
        hs_code: current_state.gir_decision.hs_code
      },
      reason: 'Need to check import legality and requirements',
      stage: STAGES.REGULATORY
    };
  }
  
  // === STAGE 7: CONFIDENCE CHECK & FINALIZATION ===
  
  if (overall_confidence < 70) {
    return analyzeAndBoostConfidence(conversationState);
  }
  
  // All stages complete with good confidence
  if (overall_confidence >= 80 && allStagesComplete(current_state)) {
    return {
      action: ACTIONS.FINALIZE,
      reason: 'High confidence, all checks passed',
      stage: STAGES.FINALIZATION
    };
  }
  
  // Moderate confidence - still finalize but note in report
  if (overall_confidence >= 60 && allStagesComplete(current_state)) {
    return {
      action: ACTIONS.FINALIZE,
      reason: 'Moderate confidence - classification complete with caveats',
      confidence_note: 'Recommend verification for high-value shipments',
      stage: STAGES.FINALIZATION
    };
  }
  
  // Low confidence after all stages - escalate
  return {
    action: ACTIONS.ESCALATE,
    reason: 'Low confidence after all stages - requires expert review',
    stage: STAGES.FINALIZATION
  };
}

/**
 * Identify missing product data fields
 */
function identifyMissingProductData(profile) {
  const critical = [];
  const optional = [];
  
  if (!profile.standardized_name) critical.push('product_name');
  if (!profile.function) critical.push('primary_function');
  if (!profile.material_composition) optional.push('materials');
  if (!profile.essential_character) optional.push('essential_character');
  if (!profile.industry_specific_data) optional.push('industry_details');
  
  return { critical, optional };
}

/**
 * Check if profile has detailed material breakdown for GIR 3b
 */
function hasDetailedMaterialBreakdown(profile) {
  if (!profile.material_composition) return false;
  
  // Check if it's detailed (contains percentages)
  const hasPercentages = typeof profile.material_composition === 'string' 
    ? profile.material_composition.includes('%')
    : Array.isArray(profile.materials) && profile.materials.some(m => m.weight_percent || m.value_percent);
    
  return hasPercentages;
}

/**
 * Generate targeted questions for missing data
 */
function generateQuestions(missingFields) {
  const questionMap = {
    product_name: 'What is the exact product name or commercial description?',
    primary_function: 'What is the primary function/purpose of this product?',
    materials: 'What materials is the product made of (with approximate percentages)?',
    essential_character: 'Which component gives this product its main identity/value?',
    industry_details: 'Can you provide technical specifications (e.g., power rating, dimensions)?'
  };
  
  return missingFields.map(field => questionMap[field] || `Please provide details about: ${field}`);
}

/**
 * Generate self-healing action based on validation issues
 */
function generateSelfHealingAction(validationResult, conversationState) {
  const issues = validationResult.issues || [];
  
  for (const issue of issues) {
    switch (issue.type) {
      case 'gir_hierarchy_violation':
        return {
          action: ACTIONS.SELF_HEAL,
          agent: AGENTS.GIR_STATE_MACHINE,
          specific_request: {
            type: 're_run_gir',
            constraints: {
              enforce_hierarchy: true,
              start_from: issue.missing_state || 'GIR1'
            }
          },
          reason: `GIR hierarchy violation: ${issue.description}`,
          stage: STAGES.CLASSIFICATION
        };
        
      case 'essential_character_incomplete':
        return {
          action: ACTIONS.REFINE_PRODUCT,
          agent: AGENTS.PRODUCT_ANALYST,
          specific_request: {
            type: 'refine',
            focus: 'material_value_breakdown',
            reason: 'Need detailed material analysis for GIR 3(b) essential character'
          },
          reason: 'Essential character analysis incomplete',
          stage: STAGES.PRODUCT_UNDERSTANDING
        };
        
      case 'en_contradiction':
        return {
          action: ACTIONS.SELF_HEAL,
          agent: AGENTS.GIR_STATE_MACHINE,
          specific_request: {
            type: 're_classify',
            constraints: {
              exclude_headings: [issue.conflicting_heading],
              notes_to_respect: [issue.note_text]
            }
          },
          reason: `EN contradiction: ${issue.description}`,
          stage: STAGES.CLASSIFICATION
        };
        
      case 'precedent_conflict':
        return {
          action: ACTIONS.SELF_HEAL,
          agent: AGENTS.HS_LEGAL_EXPERT,
          specific_request: {
            type: 'reconcile_precedent',
            our_classification: conversationState.current_state.gir_decision,
            conflicting_bti: issue.bti_case
          },
          reason: `Precedent conflict with ${issue.bti_case?.bti_number}`,
          stage: STAGES.LEGAL_RESEARCH
        };
        
      case 'confidence_below_threshold':
        return analyzeAndBoostConfidence(conversationState);
        
      default:
        // Generic re-run of judge
        return {
          action: ACTIONS.SELF_HEAL,
          agent: AGENTS.GIR_STATE_MACHINE,
          specific_request: {
            type: 're_run_gir',
            feedback: issue.description
          },
          reason: `Validation issue: ${issue.description}`,
          stage: STAGES.CLASSIFICATION
        };
    }
  }
  
  // No specific issue identified
  return {
    action: ACTIONS.ESCALATE,
    reason: 'Validation failed with unidentified issues',
    stage: STAGES.FINALIZATION
  };
}

/**
 * Analyze why confidence is low and suggest boost action
 */
function analyzeAndBoostConfidence(conversationState) {
  const { current_state, overall_confidence } = conversationState;
  const girDecision = current_state.gir_decision;
  const precedents = current_state.precedents;
  
  // GIR 3c used = genuine ambiguity
  if (girDecision?.gir_applied?.includes('3c')) {
    return {
      action: ACTIONS.REQUEST_USER_INPUT,
      reason: 'GIR 3(c) used - true ambiguity exists. Need user intent clarification.',
      questions: ['What is the PRIMARY intended use of this product?', 'How would you describe this product to a customer?'],
      stage: STAGES.PRODUCT_UNDERSTANDING
    };
  }
  
  // Not enough precedents
  if (!precedents?.bti_cases || precedents.bti_cases.length < 2) {
    return {
      action: ACTIONS.SEARCH_PRECEDENTS,
      agent: AGENTS.PRECEDENT_RESEARCHER,
      specific_request: {
        type: 'deep_search',
        expanded_terms: true,
        product_name: current_state.product_profile?.standardized_name
      },
      reason: 'Low confidence - need more supporting precedents',
      stage: STAGES.PRECEDENT_SEARCH
    };
  }
  
  // Conflicting precedents
  if (precedents?.consensus?.conflicting_cases?.length > 0) {
    return {
      action: ACTIONS.SELF_HEAL,
      agent: AGENTS.HS_LEGAL_EXPERT,
      specific_request: {
        type: 'reconcile_conflicts',
        conflicts: precedents.consensus.conflicting_cases
      },
      reason: 'Conflicting precedents need legal analysis',
      stage: STAGES.LEGAL_RESEARCH
    };
  }
  
  // Missing legal notes
  if (!current_state.legal_research?.notes || current_state.legal_research.notes.length === 0) {
    return {
      action: ACTIONS.FETCH_LEGAL_SOURCES,
      agent: AGENTS.HS_LEGAL_EXPERT,
      specific_request: {
        focus: 'section_chapter_notes',
        headings: current_state.candidate_headings
      },
      reason: 'Low confidence - need Section/Chapter Notes verification',
      stage: STAGES.LEGAL_RESEARCH
    };
  }
  
  // Default: try product refinement
  return {
    action: ACTIONS.REFINE_PRODUCT,
    agent: AGENTS.PRODUCT_ANALYST,
    specific_request: {
      type: 'deep_analysis',
      focus: 'essential_character',
      reason: 'Improve confidence through detailed product analysis'
    },
    reason: 'Low confidence - attempting deeper product analysis',
    stage: STAGES.PRODUCT_UNDERSTANDING
  };
}

/**
 * Check if all required stages are complete
 */
function allStagesComplete(currentState) {
  return !!(
    currentState.product_profile &&
    currentState.legal_research &&
    currentState.precedents &&
    currentState.gir_decision &&
    currentState.validation_result?.passed &&
    currentState.regulatory_status
  );
}

/**
 * Check if conversation should terminate
 */
export function shouldTerminate(conversationState) {
  const { current_state, current_round, max_rounds, overall_confidence, status } = conversationState;
  
  // Already in terminal state
  if (['completed', 'failed', 'escalated'].includes(status)) {
    return { should_stop: true, reason: `Already in terminal state: ${status}`, status };
  }
  
  // Max rounds reached
  if (current_round >= max_rounds) {
    return { 
      should_stop: true, 
      reason: 'Maximum rounds reached',
      status: 'escalated'
    };
  }
  
  // Success conditions
  if (allStagesComplete(current_state) && overall_confidence >= 80) {
    return {
      should_stop: true,
      reason: 'High confidence classification complete',
      status: 'completed'
    };
  }
  
  if (allStagesComplete(current_state) && overall_confidence >= 60) {
    return {
      should_stop: true,
      reason: 'Moderate confidence classification complete',
      status: 'completed'
    };
  }
  
  // Continue
  return { should_stop: false };
}

export { STAGES, ACTIONS, AGENTS };