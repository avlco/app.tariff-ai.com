/**
 * Explanatory Notes (EN) Database & Parser
 * 
 * Provides structured access to WCO Explanatory Notes content.
 * Combines scraped data with cached knowledge for offline/fast access.
 */

/**
 * Common EN patterns and their meanings for classification
 */
const EN_KEYWORDS = {
  INCLUDES: ['this heading covers', 'includes', 'comprising', 'such as', 'for example', 'e.g.'],
  EXCLUDES: ['excludes', 'does not cover', 'not including', 'except', 'other than'],
  CONDITION: ['provided that', 'on condition that', 'if', 'when', 'where'],
  ESSENTIAL: ['essential character', 'principal material', 'chief value', 'predominant'],
  COMPOSITE: ['composite goods', 'sets', 'mixtures', 'combinations', 'assembled']
};

/**
 * GRI-relevant EN interpretations
 */
const GRI_EN_MAPPINGS = {
  'GRI 1': {
    keywords: ['terms of the headings', 'section notes', 'chapter notes', 'legal notes'],
    weight: 'primary'
  },
  'GRI 2(a)': {
    keywords: ['incomplete', 'unfinished', 'unassembled', 'disassembled', 'essential character'],
    weight: 'secondary'
  },
  'GRI 2(b)': {
    keywords: ['mixtures', 'combinations', 'composite goods', 'mixed materials'],
    weight: 'secondary'
  },
  'GRI 3(a)': {
    keywords: ['most specific description', 'specific heading', 'more specifically'],
    weight: 'primary'
  },
  'GRI 3(b)': {
    keywords: ['essential character', 'predominant material', 'chief value', 'bulk', 'weight'],
    weight: 'primary'
  },
  'GRI 3(c)': {
    keywords: ['last in numerical order', 'equally specific'],
    weight: 'fallback'
  }
};

/**
 * Parse EN text to extract structured information
 */
export function parseEnText(enText, hsCode) {
  const result = {
    hs_code: hsCode,
    heading_description: null,
    includes: [],
    excludes: [],
    conditions: [],
    essential_character_guidance: [],
    gri_relevance: [],
    raw_text: enText
  };
  
  if (!enText) return result;
  
  const sentences = enText.split(/[.;]\s+/).filter(s => s.length > 10);
  
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    
    // Check for includes
    if (EN_KEYWORDS.INCLUDES.some(k => lower.includes(k))) {
      result.includes.push(sentence.trim());
    }
    
    // Check for excludes
    if (EN_KEYWORDS.EXCLUDES.some(k => lower.includes(k))) {
      result.excludes.push(sentence.trim());
    }
    
    // Check for conditions
    if (EN_KEYWORDS.CONDITION.some(k => lower.includes(k))) {
      result.conditions.push(sentence.trim());
    }
    
    // Check for essential character guidance
    if (EN_KEYWORDS.ESSENTIAL.some(k => lower.includes(k))) {
      result.essential_character_guidance.push(sentence.trim());
    }
  }
  
  // Determine GRI relevance
  for (const [gri, config] of Object.entries(GRI_EN_MAPPINGS)) {
    const relevanceScore = config.keywords.filter(k => enText.toLowerCase().includes(k)).length;
    if (relevanceScore > 0) {
      result.gri_relevance.push({
        rule: gri,
        score: relevanceScore,
        weight: config.weight
      });
    }
  }
  
  // Sort by relevance
  result.gri_relevance.sort((a, b) => b.score - a.score);
  
  return result;
}

/**
 * Extract Section/Chapter Notes from text
 */
export function extractLegalNotes(text, sectionOrChapter) {
  const notes = [];
  
  // Pattern for numbered notes
  const notePattern = /(?:Note|Notes?)\s*(\d+)[.:\s]+([^.]{20,500})/gi;
  let match;
  
  while ((match = notePattern.exec(text)) !== null) {
    notes.push({
      number: parseInt(match[1]),
      text: match[2].trim(),
      type: sectionOrChapter.includes('Section') ? 'Section Note' : 'Chapter Note',
      source: sectionOrChapter
    });
  }
  
  // Pattern for lettered sub-notes (a), (b), etc.
  const subNotePattern = /\(([a-z])\)[.:\s]+([^;]{20,300})/gi;
  while ((match = subNotePattern.exec(text)) !== null) {
    notes.push({
      number: match[1],
      text: match[2].trim(),
      type: 'Sub-note',
      source: sectionOrChapter
    });
  }
  
  return notes;
}

/**
 * Check if product matches EN criteria
 */
export function checkEnMatch(productProfile, parsedEn) {
  const result = {
    matches_includes: false,
    matches_excludes: false,
    condition_issues: [],
    confidence_adjustment: 0,
    notes: []
  };
  
  const productTerms = [
    productProfile.standardized_name,
    productProfile.function,
    productProfile.material_composition,
    productProfile.essential_character
  ].filter(Boolean).join(' ').toLowerCase();
  
  // Check includes
  for (const include of parsedEn.includes) {
    const includeTerms = include.toLowerCase().split(/\s+/);
    const matchCount = includeTerms.filter(t => t.length > 4 && productTerms.includes(t)).length;
    if (matchCount >= 2) {
      result.matches_includes = true;
      result.confidence_adjustment += 5;
      result.notes.push(`Product matches EN include: "${include.substring(0, 100)}..."`);
    }
  }
  
  // Check excludes (negative match)
  for (const exclude of parsedEn.excludes) {
    const excludeTerms = exclude.toLowerCase().split(/\s+/);
    const matchCount = excludeTerms.filter(t => t.length > 4 && productTerms.includes(t)).length;
    if (matchCount >= 2) {
      result.matches_excludes = true;
      result.confidence_adjustment -= 20;
      result.notes.push(`WARNING: Product may match EN exclusion: "${exclude.substring(0, 100)}..."`);
    }
  }
  
  // Check conditions
  for (const condition of parsedEn.conditions) {
    result.condition_issues.push({
      condition: condition.substring(0, 200),
      needs_verification: true
    });
  }
  
  return result;
}

/**
 * Build EN context for LLM prompts
 */
export function buildEnContext(parsedEnList, productProfile) {
  let context = '## Relevant Explanatory Notes\n\n';
  
  for (const en of parsedEnList) {
    context += `### HS ${en.hs_code}\n`;
    
    if (en.includes.length > 0) {
      context += '**This heading INCLUDES:**\n';
      en.includes.slice(0, 5).forEach(i => context += `- ${i}\n`);
    }
    
    if (en.excludes.length > 0) {
      context += '**This heading EXCLUDES:**\n';
      en.excludes.slice(0, 5).forEach(e => context += `- ${e}\n`);
    }
    
    if (en.essential_character_guidance.length > 0) {
      context += '**Essential Character Guidance:**\n';
      en.essential_character_guidance.slice(0, 3).forEach(g => context += `- ${g}\n`);
    }
    
    if (en.gri_relevance.length > 0) {
      context += '**GRI Relevance:** ';
      context += en.gri_relevance.map(g => `${g.rule} (score: ${g.score})`).join(', ');
      context += '\n';
    }
    
    context += '\n';
  }
  
  return context;
}

/**
 * Validate classification against EN rules
 */
export function validateAgainstEn(hsCode, productProfile, parsedEnList) {
  const issues = [];
  const confirmations = [];
  
  for (const en of parsedEnList) {
    if (en.hs_code.substring(0, 4) !== hsCode.substring(0, 4)) continue;
    
    const matchResult = checkEnMatch(productProfile, en);
    
    if (matchResult.matches_excludes) {
      issues.push({
        type: 'en_exclusion',
        severity: 'high',
        message: `Product may be excluded from ${en.hs_code} based on EN`,
        details: matchResult.notes.filter(n => n.includes('WARNING'))
      });
    }
    
    if (matchResult.matches_includes) {
      confirmations.push({
        type: 'en_inclusion',
        message: `Product matches EN inclusion criteria for ${en.hs_code}`,
        details: matchResult.notes.filter(n => !n.includes('WARNING'))
      });
    }
    
    if (matchResult.condition_issues.length > 0) {
      issues.push({
        type: 'en_condition',
        severity: 'medium',
        message: 'EN contains conditions that need verification',
        details: matchResult.condition_issues
      });
    }
  }
  
  return {
    valid: issues.filter(i => i.severity === 'high').length === 0,
    issues,
    confirmations,
    confidence_impact: issues.length > 0 ? -10 : (confirmations.length > 0 ? 5 : 0)
  };
}

export { EN_KEYWORDS, GRI_EN_MAPPINGS };