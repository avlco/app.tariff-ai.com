/**
 * Confidence Calculator - Calculates overall confidence based on multiple factors
 * 
 * Components:
 * - Product Understanding (20%)
 * - Legal Foundation (25%)
 * - GIR Strength (30%)
 * - Precedent Support (15%)
 * - Validation Success (10%)
 */

const WEIGHTS = {
  PRODUCT: 0.20,
  LEGAL: 0.25,
  GIR: 0.30,
  PRECEDENT: 0.15,
  VALIDATION: 0.10
};

const GIR_STRENGTH_SCORES = {
  'GIR1': 95,      // Unambiguous
  'GRI 1': 95,
  'GIR2': 90,      // Clear rule
  'GRI 2': 90,
  'GIR2a': 90,
  'GRI 2(a)': 90,
  'GIR2b': 88,
  'GRI 2(b)': 88,
  'GIR3a': 85,     // Most specific
  'GRI 3(a)': 85,
  'GIR3b': 75,     // Subjective (essential character)
  'GRI 3(b)': 75,
  'GIR3c': 60,     // Last resort
  'GRI 3(c)': 60,
  'GIR4': 55,      // Most akin (vague)
  'GRI 4': 55,
  'GIR6': 80,      // Subheading level
  'GRI 6': 80
};

/**
 * Calculate overall confidence from conversation state
 */
export function calculateConfidence(conversationState) {
  const { current_state } = conversationState;
  
  const productScore = calculateProductScore(current_state.product_profile, current_state.product_readiness);
  const legalScore = calculateLegalScore(current_state.legal_research);
  const girScore = calculateGIRScore(current_state.gir_decision);
  const precedentScore = calculatePrecedentScore(current_state.precedents);
  const validationScore = calculateValidationScore(current_state.validation_result);
  
  const weightedScore = (
    productScore * WEIGHTS.PRODUCT +
    legalScore * WEIGHTS.LEGAL +
    girScore * WEIGHTS.GIR +
    precedentScore * WEIGHTS.PRECEDENT +
    validationScore * WEIGHTS.VALIDATION
  );
  
  // Apply penalty factors
  const penalties = calculatePenalties(current_state);
  const finalScore = Math.max(0, Math.min(100, weightedScore - penalties));
  
  return {
    overall: Math.round(finalScore),
    breakdown: {
      product: { score: productScore, weight: WEIGHTS.PRODUCT, contribution: productScore * WEIGHTS.PRODUCT },
      legal: { score: legalScore, weight: WEIGHTS.LEGAL, contribution: legalScore * WEIGHTS.LEGAL },
      gir: { score: girScore, weight: WEIGHTS.GIR, contribution: girScore * WEIGHTS.GIR },
      precedent: { score: precedentScore, weight: WEIGHTS.PRECEDENT, contribution: precedentScore * WEIGHTS.PRECEDENT },
      validation: { score: validationScore, weight: WEIGHTS.VALIDATION, contribution: validationScore * WEIGHTS.VALIDATION }
    },
    penalties,
    raw_weighted: weightedScore
  };
}

/**
 * Product understanding score (0-100)
 */
function calculateProductScore(profile, readiness) {
  if (!profile) return 0;
  
  let score = readiness || 50;
  
  // Bonus for detailed data
  if (profile.material_composition?.includes('%')) score += 10;
  if (profile.essential_character) score += 10;
  if (profile.industry_specific_data && Object.keys(profile.industry_specific_data).length > 3) score += 5;
  
  return Math.min(100, score);
}

/**
 * Legal foundation score (0-100)
 */
function calculateLegalScore(legalResearch) {
  if (!legalResearch) return 0;
  
  let score = 40; // Base score for having legal research
  
  // EN quality
  if (legalResearch.en_documents?.length > 0) {
    score += 20;
    // Bonus for full EN text (not just summary)
    if (legalResearch.en_documents.some(en => en.text?.length > 500)) score += 10;
  }
  
  // Notes quality
  if (legalResearch.notes?.length > 0) {
    score += 15;
    // Bonus for Section notes
    if (legalResearch.notes.some(n => n.type === 'Section Note')) score += 5;
  }
  
  // Source quality
  if (legalResearch.verified_sources?.length > 0) {
    const tier1Sources = legalResearch.verified_sources.filter(s => s.authority_tier === '1' || s.authority_tier === 1);
    score += Math.min(10, tier1Sources.length * 3);
  }
  
  return Math.min(100, score);
}

/**
 * GIR strength score (0-100)
 */
function calculateGIRScore(girDecision) {
  if (!girDecision) return 0;
  
  const girApplied = girDecision.gir_applied || girDecision.gri_applied || '';
  
  // Find the GIR rule used
  let baseScore = 70; // Default
  
  for (const [rule, score] of Object.entries(GIR_STRENGTH_SCORES)) {
    if (girApplied.includes(rule)) {
      baseScore = score;
      break;
    }
  }
  
  // Adjust by decision confidence
  if (girDecision.confidence) {
    const decisionConfidence = girDecision.confidence > 1 ? girDecision.confidence / 100 : girDecision.confidence;
    baseScore = baseScore * 0.7 + (decisionConfidence * 100) * 0.3;
  }
  
  // Bonus for complete audit trail
  if (girDecision.audit_trail?.length >= 2) {
    baseScore += 5;
  }
  
  return Math.min(100, baseScore);
}

/**
 * Precedent support score (0-100)
 */
function calculatePrecedentScore(precedents) {
  if (!precedents) return 70; // Neutral if no precedents searched
  
  let score = 50; // Base for having searched
  
  const btiCases = precedents.bti_cases || [];
  const wcoOpinions = precedents.wco_opinions || [];
  
  // WCO opinions are very strong
  if (wcoOpinions.length > 0) {
    score += 30;
  }
  
  // BTI cases support
  if (btiCases.length > 0) {
    score += Math.min(20, btiCases.length * 5);
  }
  
  // Consensus analysis
  if (precedents.consensus) {
    if (precedents.consensus.agreement_rate > 0.8) {
      score += 15;
    } else if (precedents.consensus.conflicting_cases?.length > 0) {
      score -= 20; // Penalty for conflicts
    }
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Validation success score (0-100)
 */
function calculateValidationScore(validationResult) {
  if (!validationResult) return 50; // Neutral if not validated
  
  if (!validationResult.passed) return 20;
  
  return validationResult.score || 80;
}

/**
 * Calculate penalty factors
 */
function calculatePenalties(currentState) {
  let penalty = 0;
  
  // No precedents found at all
  if (currentState.precedents && (!currentState.precedents.bti_cases || currentState.precedents.bti_cases.length === 0)) {
    penalty += 5;
  }
  
  // Conflicting precedents
  if (currentState.precedents?.consensus?.conflicting_cases?.length > 0) {
    penalty += 10;
  }
  
  // GIR 3c or 4 used (genuine ambiguity)
  const girApplied = currentState.gir_decision?.gir_applied || currentState.gir_decision?.gri_applied || '';
  if (girApplied.includes('3c') || girApplied.includes('3(c)') || girApplied.includes('GIR4') || girApplied.includes('GRI 4')) {
    penalty += 10;
  }
  
  // Validation issues
  if (currentState.validation_result?.issues?.length > 0) {
    penalty += currentState.validation_result.issues.length * 3;
  }
  
  return penalty;
}

/**
 * Get confidence trend from conversation rounds
 */
export function getConfidenceTrend(conversationState) {
  return conversationState.confidence_trajectory || [];
}

/**
 * Analyze why confidence is at current level
 */
export function analyzeConfidenceFactors(conversationState) {
  const result = calculateConfidence(conversationState);
  
  const analysis = {
    overall_score: result.overall,
    breakdown: result.breakdown,
    penalties: result.penalties,
    recommendations: []
  };
  
  // Generate recommendations
  if (result.breakdown.product.score < 80) {
    analysis.recommendations.push({
      area: 'product',
      issue: 'Product data incomplete',
      suggestion: 'Gather more technical specifications or material composition details'
    });
  }
  
  if (result.breakdown.legal.score < 70) {
    analysis.recommendations.push({
      area: 'legal',
      issue: 'Legal foundation weak',
      suggestion: 'Fetch official Explanatory Notes and Section/Chapter Notes'
    });
  }
  
  if (result.breakdown.gir.score < 70) {
    analysis.recommendations.push({
      area: 'gir',
      issue: 'Classification rule ambiguous',
      suggestion: 'GIR 3(b)/3(c)/4 used - consider additional product analysis or user clarification'
    });
  }
  
  if (result.breakdown.precedent.score < 60) {
    analysis.recommendations.push({
      area: 'precedent',
      issue: 'Precedent support lacking or conflicting',
      suggestion: 'Search for additional BTI cases or WCO opinions'
    });
  }
  
  return analysis;
}