/**
 * BTI (Binding Tariff Information) Database & Parser
 * 
 * Provides structured access to BTI precedents for classification validation.
 */

/**
 * BTI relevance scoring factors
 */
const RELEVANCE_FACTORS = {
  EXACT_HS_MATCH: 30,
  HEADING_MATCH: 20,
  CHAPTER_MATCH: 10,
  KEYWORD_MATCH: 5,
  RECENT_DATE: 10,  // Within 3 years
  EU_SOURCE: 5,
  WCO_SOURCE: 15
};

/**
 * Parse BTI reference number to extract metadata
 */
export function parseBtiReference(reference) {
  // Common formats: DE-BTI-123456, DEBTI123456, FR123456-2023
  const patterns = [
    /^([A-Z]{2})[-]?BTI[-]?(\d+)/i,
    /^([A-Z]{2})(\d{6,})/i,
    /^BTI[-]?([A-Z]{2})[-]?(\d+)/i
  ];
  
  for (const pattern of patterns) {
    const match = reference.match(pattern);
    if (match) {
      return {
        country_code: match[1].toUpperCase(),
        number: match[2],
        full_reference: reference,
        parsed: true
      };
    }
  }
  
  return {
    country_code: 'XX',
    number: reference,
    full_reference: reference,
    parsed: false
  };
}

/**
 * Calculate relevance score for a BTI case
 */
export function calculateBtiRelevance(btiCase, targetHsCode, productKeywords) {
  let score = 0;
  const details = [];
  
  const btiHs = btiCase.hs_code || btiCase.classification || '';
  const targetChapter = targetHsCode.substring(0, 2);
  const targetHeading = targetHsCode.substring(0, 4);
  
  // HS code matching
  if (btiHs === targetHsCode) {
    score += RELEVANCE_FACTORS.EXACT_HS_MATCH;
    details.push('Exact HS match');
  } else if (btiHs.substring(0, 4) === targetHeading) {
    score += RELEVANCE_FACTORS.HEADING_MATCH;
    details.push('Same 4-digit heading');
  } else if (btiHs.substring(0, 2) === targetChapter) {
    score += RELEVANCE_FACTORS.CHAPTER_MATCH;
    details.push('Same chapter');
  }
  
  // Keyword matching
  const btiText = [
    btiCase.product_description,
    btiCase.goods_description,
    btiCase.classification_justification
  ].filter(Boolean).join(' ').toLowerCase();
  
  const keywords = productKeywords.toLowerCase().split(/\s+/).filter(k => k.length > 3);
  const matchedKeywords = keywords.filter(k => btiText.includes(k));
  
  if (matchedKeywords.length > 0) {
    score += RELEVANCE_FACTORS.KEYWORD_MATCH * Math.min(matchedKeywords.length, 5);
    details.push(`${matchedKeywords.length} keyword matches`);
  }
  
  // Date relevance
  if (btiCase.date || btiCase.issue_date) {
    const btiDate = new Date(btiCase.date || btiCase.issue_date);
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    
    if (btiDate > threeYearsAgo) {
      score += RELEVANCE_FACTORS.RECENT_DATE;
      details.push('Recent (within 3 years)');
    }
  }
  
  // Source authority
  if (btiCase.source === 'WCO' || btiCase.authority === 'WCO') {
    score += RELEVANCE_FACTORS.WCO_SOURCE;
    details.push('WCO source');
  } else if (btiCase.source?.includes('EU') || btiCase.country_code?.match(/^(DE|FR|NL|BE|IT|ES)$/)) {
    score += RELEVANCE_FACTORS.EU_SOURCE;
    details.push('EU source');
  }
  
  return {
    score,
    max_score: Object.values(RELEVANCE_FACTORS).reduce((a, b) => a + b, 0),
    normalized: Math.round((score / 75) * 100), // Normalize to 0-100
    details
  };
}

/**
 * Analyze BTI cases for consensus
 */
export function analyzeBtiConsensus(btiCases, targetHsCode) {
  if (!btiCases || btiCases.length === 0) {
    return {
      has_consensus: false,
      consensus_code: null,
      agreement_rate: 0,
      conflicting_cases: [],
      supporting_cases: [],
      analysis: 'No BTI cases found'
    };
  }
  
  // Group by HS code
  const codeGroups = {};
  for (const bti of btiCases) {
    const code = bti.hs_code || bti.classification || 'unknown';
    if (!codeGroups[code]) {
      codeGroups[code] = [];
    }
    codeGroups[code].push(bti);
  }
  
  // Find majority code
  const sortedGroups = Object.entries(codeGroups).sort((a, b) => b[1].length - a[1].length);
  const majorityCode = sortedGroups[0]?.[0];
  const majorityCount = sortedGroups[0]?.[1]?.length || 0;
  const totalCases = btiCases.length;
  
  const agreementRate = majorityCount / totalCases;
  
  // Identify conflicts
  const supporting = codeGroups[majorityCode] || [];
  const conflicting = btiCases.filter(b => (b.hs_code || b.classification) !== majorityCode);
  
  // Check if target matches consensus
  const targetMatches = majorityCode === targetHsCode || 
                        majorityCode?.substring(0, 4) === targetHsCode.substring(0, 4);
  
  return {
    has_consensus: agreementRate >= 0.7,
    consensus_code: majorityCode,
    agreement_rate: agreementRate,
    total_cases: totalCases,
    target_matches_consensus: targetMatches,
    supporting_cases: supporting.map(b => ({
      reference: b.reference || b.bti_number,
      hs_code: b.hs_code || b.classification,
      country: b.country_code,
      date: b.date || b.issue_date
    })),
    conflicting_cases: conflicting.map(b => ({
      reference: b.reference || b.bti_number,
      hs_code: b.hs_code || b.classification,
      country: b.country_code,
      conflict_reason: `Classified as ${b.hs_code || b.classification} instead of ${majorityCode}`
    })),
    analysis: generateConsensusAnalysis(agreementRate, majorityCode, targetHsCode, conflicting.length)
  };
}

/**
 * Generate human-readable consensus analysis
 */
function generateConsensusAnalysis(agreementRate, consensusCode, targetCode, conflictCount) {
  if (agreementRate >= 0.9) {
    return `Strong consensus (${Math.round(agreementRate * 100)}%) for ${consensusCode}. ${conflictCount > 0 ? `${conflictCount} outlier(s) exist.` : ''}`;
  } else if (agreementRate >= 0.7) {
    return `Moderate consensus (${Math.round(agreementRate * 100)}%) for ${consensusCode}. ${conflictCount} case(s) suggest alternative classifications.`;
  } else if (agreementRate >= 0.5) {
    return `Weak consensus (${Math.round(agreementRate * 100)}%) for ${consensusCode}. Significant variation in BTI decisions - careful analysis required.`;
  } else {
    return `No clear consensus. BTI cases are split across multiple codes. Expert review recommended.`;
  }
}

/**
 * Build BTI context for LLM prompts
 */
export function buildBtiContext(btiCases, targetHsCode, productKeywords) {
  const consensus = analyzeBtiConsensus(btiCases, targetHsCode);
  
  let context = '## BTI Precedent Analysis\n\n';
  context += `**Consensus Status:** ${consensus.analysis}\n\n`;
  
  if (consensus.supporting_cases.length > 0) {
    context += '**Supporting BTI Cases:**\n';
    consensus.supporting_cases.slice(0, 5).forEach(bti => {
      context += `- ${bti.reference}: HS ${bti.hs_code} (${bti.country}, ${bti.date || 'date unknown'})\n`;
    });
    context += '\n';
  }
  
  if (consensus.conflicting_cases.length > 0) {
    context += '**Conflicting BTI Cases:**\n';
    consensus.conflicting_cases.slice(0, 3).forEach(bti => {
      context += `- ${bti.reference}: ${bti.conflict_reason}\n`;
    });
    context += '\n';
  }
  
  // Add relevance-scored cases
  const scoredCases = btiCases.map(bti => ({
    ...bti,
    relevance: calculateBtiRelevance(bti, targetHsCode, productKeywords)
  })).sort((a, b) => b.relevance.score - a.relevance.score);
  
  if (scoredCases.length > 0) {
    context += '**Most Relevant Cases (by score):**\n';
    scoredCases.slice(0, 3).forEach(bti => {
      context += `- ${bti.reference || 'Unknown'}: Score ${bti.relevance.normalized}/100 - ${bti.relevance.details.join(', ')}\n`;
    });
  }
  
  return context;
}

/**
 * Validate classification against BTI precedents
 */
export function validateAgainstBti(hsCode, btiCases, productKeywords) {
  const consensus = analyzeBtiConsensus(btiCases, hsCode);
  const issues = [];
  const confirmations = [];
  
  if (!consensus.target_matches_consensus && consensus.has_consensus) {
    issues.push({
      type: 'bti_consensus_conflict',
      severity: 'high',
      message: `Classification ${hsCode} conflicts with BTI consensus ${consensus.consensus_code}`,
      consensus_rate: consensus.agreement_rate,
      conflicting_cases: consensus.supporting_cases.slice(0, 3)
    });
  }
  
  if (consensus.target_matches_consensus && consensus.has_consensus) {
    confirmations.push({
      type: 'bti_consensus_match',
      message: `Classification matches BTI consensus (${Math.round(consensus.agreement_rate * 100)}% agreement)`,
      supporting_cases: consensus.supporting_cases.length
    });
  }
  
  if (consensus.conflicting_cases.length > 0 && !consensus.has_consensus) {
    issues.push({
      type: 'bti_no_consensus',
      severity: 'medium',
      message: 'BTI cases show no clear consensus - classification requires careful justification',
      conflicting_cases: consensus.conflicting_cases
    });
  }
  
  return {
    valid: issues.filter(i => i.severity === 'high').length === 0,
    issues,
    confirmations,
    consensus,
    confidence_impact: consensus.target_matches_consensus ? 10 : (consensus.has_consensus ? -15 : -5)
  };
}

export { RELEVANCE_FACTORS };