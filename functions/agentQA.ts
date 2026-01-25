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
  const girApplied = classificationResults?.primary?.gri_applied || classificationResults?.primary?.gir_applied || '';
  const stateLog = classificationResults?.primary?.gir_state_log || [];
  
  // Check 1: GIR state log exists for non-GRI-1 classifications
  const isGRI1 = girApplied.includes('GRI 1') || girApplied.includes('GRI_1') || girApplied === '1';
  if (!isGRI1 && stateLog.length === 0) {
    issues.push({
      type: 'gir_hierarchy_violation',
      severity: 'high',
      description: `GRI ${girApplied} was applied but no gir_state_log provided. Cannot verify hierarchy compliance.`
    });
  }
  
  // Check 2: GIR 3(b) requires COMPLETE essential character analysis
  const isGRI3b = girApplied.includes('3(b)') || girApplied.includes('3b') || girApplied.includes('3B');
  if (isGRI3b) {
    const ecAnalysis = classificationResults?.primary?.essential_character_analysis;
    
    if (!ecAnalysis) {
      issues.push({
        type: 'essential_character_missing',
        severity: 'high',
        description: 'GRI 3(b) Essential Character claimed but essential_character_analysis object is completely missing'
      });
    } else {
      // Check components array
      if (!ecAnalysis.components || ecAnalysis.components.length === 0) {
        issues.push({
          type: 'essential_character_no_components',
          severity: 'high',
          description: 'GRI 3(b) requires component breakdown but essential_character_analysis.components is empty'
        });
      } else {
        // Validate component fields
        let hasIncompleteComponent = false;
        for (const comp of ecAnalysis.components) {
          if (!comp.name || !comp.functional_role) {
            hasIncompleteComponent = true;
            break;
          }
        }
        if (hasIncompleteComponent) {
          issues.push({
            type: 'essential_character_incomplete_components',
            severity: 'medium',
            description: 'Some components in essential_character_analysis missing name or functional_role'
          });
        }
        
        // Check for bulk/value percentages
        const hasPercentages = ecAnalysis.components.some(c => 
          c.bulk_percent !== undefined || c.value_percent !== undefined
        );
        if (!hasPercentages) {
          issues.push({
            type: 'essential_character_no_percentages',
            severity: 'medium',
            description: 'Essential character analysis should include bulk_percent and value_percent for components'
          });
        }
      }
      
      // Check essential_component identified
      if (!ecAnalysis.essential_component) {
        issues.push({
          type: 'essential_character_no_conclusion',
          severity: 'high',
          description: 'essential_character_analysis.essential_component not specified - which component gives essential character?'
        });
      }
      
      // Check justification
      if (!ecAnalysis.justification || ecAnalysis.justification.length < 30) {
        issues.push({
          type: 'essential_character_weak_justification',
          severity: 'medium',
          description: 'essential_character_analysis.justification is missing or too brief'
        });
      }
    }
  }
  
  // Check 3: Hierarchy was followed (no skipping states)
  const girOrder = ['GRI 1', 'GRI 2', 'GRI 3(a)', 'GRI 3(b)', 'GRI 3(c)', 'GRI 4'];
  let appliedIndex = -1;
  
  for (let i = 0; i < girOrder.length; i++) {
    const girNum = girOrder[i].replace('GRI ', '').replace('(', '').replace(')', '');
    if (girApplied.includes(girNum)) {
      appliedIndex = i;
      break;
    }
  }
  
  // If GRI 2+ used, verify GRI 1 was at least considered
  if (appliedIndex >= 1 && stateLog.length > 0) {
    const visitedStates = stateLog.map(s => (s.state || '').toLowerCase());
    const gri1Visited = visitedStates.some(v => v.includes('1') || v.includes('gri_1') || v.includes('gri 1'));
    
    if (!gri1Visited) {
      issues.push({
        type: 'gir_skipped_gri1',
        severity: 'high',
        description: `GRI ${girApplied} applied but GRI 1 analysis not found in state log. Must start at GRI 1.`
      });
    }
    
    // If GRI 3(b) used, verify 3(a) was considered
    if (isGRI3b) {
      const gri3aVisited = visitedStates.some(v => v.includes('3a') || v.includes('3(a)'));
      if (!gri3aVisited) {
        issues.push({
          type: 'gir_skipped_gri3a',
          severity: 'medium',
          description: 'GRI 3(b) applied but GRI 3(a) analysis not in state log. Should explain why 3(a) was insufficient.'
        });
      }
    }
  }
  
  // Check 4: State log entries have required fields
  if (stateLog.length > 0) {
    for (const entry of stateLog) {
      if (!entry.state || !entry.result) {
        issues.push({
          type: 'gir_incomplete_state_log',
          severity: 'low',
          description: 'Some gir_state_log entries missing state or result fields'
        });
        break;
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

// --- TASK 2.2: ESSENTIAL CHARACTER TABLE VALIDATION ---

/**
 * Validate Essential Character analysis when GRI 3(b) is used
 * This is the comprehensive validation per WCO guidelines
 */
function validateEssentialCharacter(classificationResults) {
  const girApplied = classificationResults?.primary?.gri_applied || classificationResults?.primary?.gir_applied || '';
  
  // Check if GRI 3(b) was applied
  const isGRI3b = girApplied.includes('3(b)') || girApplied.includes('3b') || girApplied.includes('3B');
  
  if (!isGRI3b) {
    return { required: false, valid: true, issues: [] };
  }
  
  const issues = [];
  const ecAnalysis = classificationResults?.primary?.essential_character_analysis;
  
  // Check 1: Essential character analysis object exists
  if (!ecAnalysis) {
    issues.push({
      type: 'ec_missing',
      severity: 'high',
      description: 'GRI 3(b) used but essential_character_analysis object is completely missing'
    });
    return { required: true, valid: false, issues };
  }
  
  // Check 2: Components array exists with at least 2 components
  if (!ecAnalysis.components || !Array.isArray(ecAnalysis.components)) {
    issues.push({
      type: 'ec_no_components_array',
      severity: 'high',
      description: 'Essential character requires components array'
    });
  } else if (ecAnalysis.components.length < 2) {
    issues.push({
      type: 'ec_insufficient_components',
      severity: 'high',
      description: `Essential character requires at least 2 components, found ${ecAnalysis.components.length}`
    });
  } else {
    // Validate each component has required fields
    let missingFields = [];
    let totalBulk = 0;
    let totalValue = 0;
    let hasBulkPercent = false;
    let hasValuePercent = false;
    
    for (let i = 0; i < ecAnalysis.components.length; i++) {
      const comp = ecAnalysis.components[i];
      
      // Check name
      if (!comp.name) {
        missingFields.push(`Component ${i + 1}: missing name`);
      }
      
      // Check functional_role
      if (!comp.functional_role) {
        missingFields.push(`Component ${i + 1} (${comp.name || 'unnamed'}): missing functional_role`);
      }
      
      // Check bulk_percent
      if (comp.bulk_percent !== undefined && comp.bulk_percent !== null) {
        hasBulkPercent = true;
        totalBulk += Number(comp.bulk_percent) || 0;
      }
      
      // Check value_percent
      if (comp.value_percent !== undefined && comp.value_percent !== null) {
        hasValuePercent = true;
        totalValue += Number(comp.value_percent) || 0;
      }
    }
    
    if (missingFields.length > 0) {
      issues.push({
        type: 'ec_incomplete_components',
        severity: 'medium',
        description: `Component fields missing: ${missingFields.join('; ')}`
      });
    }
    
    // Check percentages exist
    if (!hasBulkPercent) {
      issues.push({
        type: 'ec_no_bulk_percent',
        severity: 'medium',
        description: 'Essential character analysis should include bulk_percent for components'
      });
    }
    
    if (!hasValuePercent) {
      issues.push({
        type: 'ec_no_value_percent',
        severity: 'medium',
        description: 'Essential character analysis should include value_percent for components'
      });
    }
    
    // Check percentages sum to ~100%
    if (hasBulkPercent && (totalBulk < 90 || totalBulk > 110)) {
      issues.push({
        type: 'ec_bulk_sum_invalid',
        severity: 'medium',
        description: `Bulk percentages sum to ${totalBulk.toFixed(1)}%, expected ~100%`
      });
    }
    
    if (hasValuePercent && (totalValue < 90 || totalValue > 110)) {
      issues.push({
        type: 'ec_value_sum_invalid',
        severity: 'medium',
        description: `Value percentages sum to ${totalValue.toFixed(1)}%, expected ~100%`
      });
    }
  }
  
  // Check 3: Essential component identified
  if (!ecAnalysis.essential_component) {
    issues.push({
      type: 'ec_no_conclusion',
      severity: 'high',
      description: 'essential_character_analysis.essential_component not specified - which component gives essential character?'
    });
  }
  
  // Check 4: Justification provided
  if (!ecAnalysis.justification) {
    issues.push({
      type: 'ec_no_justification',
      severity: 'high',
      description: 'essential_character_analysis.justification is missing - must explain why this component gives essential character'
    });
  } else if (ecAnalysis.justification.length < 50) {
    issues.push({
      type: 'ec_weak_justification',
      severity: 'medium',
      description: `Justification too brief (${ecAnalysis.justification.length} chars) - should cite value/bulk/function dominance`
    });
  }
  
  // Check 5: Verify essential_component matches one of the components
  if (ecAnalysis.essential_component && ecAnalysis.components?.length > 0) {
    const essentialLower = ecAnalysis.essential_component.toLowerCase();
    const matchFound = ecAnalysis.components.some(c => 
      c.name?.toLowerCase().includes(essentialLower) || 
      essentialLower.includes(c.name?.toLowerCase())
    );
    
    if (!matchFound) {
      issues.push({
        type: 'ec_component_mismatch',
        severity: 'medium',
        description: `essential_component "${ecAnalysis.essential_component}" doesn't match any component name in the list`
      });
    }
  }
  
  const highSeverityCount = issues.filter(i => i.severity === 'high').length;
  
  return { 
    required: true, 
    valid: highSeverityCount === 0,
    issues,
    summary: {
      components_count: ecAnalysis.components?.length || 0,
      has_essential_component: !!ecAnalysis.essential_component,
      has_justification: !!ecAnalysis.justification,
      justification_length: ecAnalysis.justification?.length || 0
    }
  };
}

// --- TASK 2.4: HS CODE FORMAT VALIDATION PER COUNTRY ---

/**
 * HS Code format specifications per country
 */
const HS_FORMATS = {
  'IL': { 
    digits: 10, 
    pattern: /^\d{4}[.\s]?\d{2}[.\s]?\d{2}[.\s]?\d{2}$/, 
    example: '8471.30.00.10',
    description: 'Israel uses 10-digit codes'
  },
  'US': { 
    digits: 10, 
    pattern: /^\d{4}[.\s]?\d{2}[.\s]?\d{4}$/, 
    example: '8471.30.0150',
    description: 'US HTS uses 10-digit codes'
  },
  'EU': { 
    digits: 8, 
    pattern: /^\d{4}[.\s]?\d{2}[.\s]?\d{2}$/, 
    example: '8471.30.00',
    description: 'EU TARIC uses 8-digit codes'
  },
  'UK': { 
    digits: 10, 
    pattern: /^\d{4}[.\s]?\d{2}[.\s]?\d{2}[.\s]?\d{2}$/, 
    example: '8471.30.00.00',
    description: 'UK uses 10-digit codes'
  },
  'CN': { 
    digits: 10, 
    pattern: /^\d{4}[.\s]?\d{2}[.\s]?\d{2}[.\s]?\d{2}$/, 
    example: '8471.30.00.10',
    description: 'China uses 10-digit codes'
  },
  'JP': { 
    digits: 9, 
    pattern: /^\d{4}[.\s]?\d{2}[.\s]?\d{3}$/, 
    example: '8471.30.000',
    description: 'Japan uses 9-digit codes'
  },
  'AU': { 
    digits: 8, 
    pattern: /^\d{4}[.\s]?\d{2}[.\s]?\d{2}$/, 
    example: '8471.30.00',
    description: 'Australia uses 8-digit codes'
  },
  'DEFAULT': { 
    digits: 6, 
    pattern: /^\d{4}[.\s]?\d{2}$/, 
    example: '8471.30',
    description: 'International HS uses 6-digit codes'
  }
};

/**
 * Validate HS code format for destination country
 */
function validateHsCodeFormat(hsCode, destinationCountry) {
  const issues = [];
  
  if (!hsCode) {
    issues.push({
      type: 'hs_code_missing',
      severity: 'high',
      description: 'HS code is missing from classification'
    });
    return { valid: false, issues };
  }
  
  // Normalize the HS code (remove dots and spaces for digit counting)
  const cleanCode = hsCode.replace(/[.\s]/g, '');
  
  // Check it contains only digits
  if (!/^\d+$/.test(cleanCode)) {
    issues.push({
      type: 'hs_code_invalid_chars',
      severity: 'high',
      description: `HS code "${hsCode}" contains non-numeric characters`
    });
    return { valid: false, issues };
  }
  
  // Get format for destination country
  const countryCode = (destinationCountry || '').toUpperCase();
  const format = HS_FORMATS[countryCode] || HS_FORMATS['DEFAULT'];
  
  // Check minimum length (at least 6 digits for international)
  if (cleanCode.length < 6) {
    issues.push({
      type: 'hs_code_too_short',
      severity: 'high',
      description: `HS code "${hsCode}" has only ${cleanCode.length} digits, minimum is 6`
    });
    return { valid: false, issues };
  }
  
  // Check against country-specific format
  if (cleanCode.length < format.digits) {
    issues.push({
      type: 'hs_code_insufficient_digits',
      severity: 'medium',
      description: `HS code for ${countryCode || 'destination'} requires ${format.digits} digits, got ${cleanCode.length}. Expected format: ${format.example}`
    });
  }
  
  // Check first 4 digits are valid chapter/heading (01-99 for chapter)
  const chapter = parseInt(cleanCode.substring(0, 2), 10);
  if (chapter < 1 || chapter > 99) {
    issues.push({
      type: 'hs_code_invalid_chapter',
      severity: 'high',
      description: `HS code chapter "${cleanCode.substring(0, 2)}" is invalid (must be 01-99)`
    });
  }
  
  // Common chapter validations
  const heading = cleanCode.substring(0, 4);
  if (heading === '0000' || heading === '9999') {
    issues.push({
      type: 'hs_code_placeholder',
      severity: 'high',
      description: `HS code heading "${heading}" appears to be a placeholder, not a real classification`
    });
  }
  
  const highSeverityCount = issues.filter(i => i.severity === 'high').length;
  
  return { 
    valid: highSeverityCount === 0, 
    issues,
    normalized_code: cleanCode,
    expected_digits: format.digits,
    actual_digits: cleanCode.length,
    country_format: format.description
  };
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
  
  // Task 4.3: Enhanced cross-reference validation
  // Check if exact_quote appears in raw_legal_text_corpus
  if (rawCorpus.length > 100) {
    for (const citation of legalCitations) {
      if (citation.exact_quote && citation.exact_quote.length > 20) {
        // Normalize both strings for comparison
        const normalizedQuote = citation.exact_quote.toLowerCase().replace(/\s+/g, ' ').substring(0, 50);
        const normalizedCorpus = rawCorpus.toLowerCase().replace(/\s+/g, ' ');
        
        // Check if quote appears in corpus (fuzzy - first 50 chars)
        if (!normalizedCorpus.includes(normalizedQuote.substring(0, 30))) {
          // Also check in candidate_headings explanatory notes
          const foundInEN = candidateHeadings.some(h => 
            h.explanatory_note_summary?.toLowerCase().includes(normalizedQuote.substring(0, 30))
          );
          
          if (!foundInEN) {
            issues.push({
              type: 'citation_not_in_corpus',
              severity: 'medium',
              description: `Citation "${citation.source_type}/${citation.source_reference}" quote not found in retrieved legal text corpus - may be fabricated`
            });
          }
        }
      }
    }
  }
  
  // Verify WCO citations exist in research
  const wcoCitations = legalCitations.filter(c => c.source_type === 'WCO_OPINION');
  for (const citation of wcoCitations) {
    const foundInResearch = wcoOpinions.some(op => 
      citation.source_reference?.includes(op.opinion_number) ||
      citation.exact_quote?.includes(op.reasoning?.substring(0, 30))
    );
    if (!foundInResearch && wcoOpinions.length > 0) {
      issues.push({
        type: 'unverified_wco_citation',
        severity: 'medium',
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
  
  // Check BTI citations
  const btiCitations = legalCitations.filter(c => c.source_type === 'BTI');
  const btiCases = researchFindings?.bti_cases || [];
  for (const citation of btiCitations) {
    const foundInResearch = btiCases.some(b => 
      citation.source_reference?.includes(b.reference) ||
      citation.exact_quote?.includes(b.product_description?.substring(0, 20))
    );
    if (!foundInResearch && btiCases.length > 0) {
      issues.push({
        type: 'unverified_bti_citation',
        severity: 'low',
        description: `BTI citation ${citation.source_reference} not found in research findings`
      });
    }
  }
  
  return issues;
}

/**
 * Task 4.1: Validate tax and compliance extraction quality
 * Updated to use tax_data and compliance_data (TARIFF-AI 2.0)
 */
function validateExtractionQuality(taxData, complianceData) {
  const issues = [];
  
  // === TAX DATA VALIDATION ===
  if (taxData) {
    const primary = taxData.primary || {};
    const extractionMeta = taxData.extraction_metadata || {};
    
    // Check if legal context was available
    if (extractionMeta.legal_context_available === false) {
      issues.push({
        type: 'tax_no_context',
        severity: 'medium',
        description: 'Tax rates extracted without legal context - may be estimates'
      });
    }
    
    // Check duty rate has source citation
    if (primary.duty_rate && !primary.duty_rate.includes('NOT_FOUND')) {
      if (!primary.duty_rate_source) {
        issues.push({
          type: 'tax_no_citation',
          severity: 'medium',
          description: 'Duty rate provided without duty_rate_source citation'
        });
      }
    }
    
    // Check VAT rate has source citation
    if (primary.vat_rate && !primary.vat_rate.includes('NOT_FOUND')) {
      if (!primary.vat_rate_source) {
        issues.push({
          type: 'vat_no_citation',
          severity: 'medium',
          description: 'VAT rate provided without vat_rate_source citation'
        });
      }
    }
    
    // Check for NOT_FOUND markers
    if (primary.duty_rate?.includes('NOT_FOUND') || primary.vat_rate?.includes('NOT_FOUND')) {
      issues.push({
        type: 'tax_data_gap',
        severity: 'low',
        description: 'Some tax rates not found in retrieved context - manual verification recommended'
      });
    }
    
    // Check data_gaps array
    if (taxData.data_gaps?.length > 0) {
      issues.push({
        type: 'tax_gaps_flagged',
        severity: 'low',
        description: `${taxData.data_gaps.length} tax data gaps acknowledged: ${taxData.data_gaps.slice(0, 2).join(', ')}`
      });
    }
    
    // Check extraction confidence
    if (taxData.extraction_confidence === 'low' && !taxData.data_gaps?.length) {
      issues.push({
        type: 'tax_low_confidence_unexplained',
        severity: 'medium',
        description: 'Tax extraction confidence is low but no data_gaps provided to explain why'
      });
    }
  } else {
    issues.push({
      type: 'tax_data_missing',
      severity: 'medium',
      description: 'tax_data object is missing from report'
    });
  }
  
  // === COMPLIANCE DATA VALIDATION ===
  if (complianceData) {
    const extractionMeta = complianceData.extraction_metadata || {};
    
    // Check if legal context was available
    if (extractionMeta.legal_context_available === false) {
      issues.push({
        type: 'compliance_no_context',
        severity: 'medium',
        description: 'Compliance requirements extracted without legal context - may be generic'
      });
    }
    
    // Check import_requirements have source citations
    const requirements = complianceData.import_requirements || [];
    const reqsWithoutSource = requirements.filter(r => !r.source_citation);
    if (reqsWithoutSource.length > 0 && requirements.length > 0) {
      issues.push({
        type: 'compliance_requirements_no_citation',
        severity: 'medium',
        description: `${reqsWithoutSource.length}/${requirements.length} import requirements lack source citations`
      });
    }
    
    // Check mandatory_standards have source citations
    const standards = complianceData.mandatory_standards || [];
    const standardsWithoutSource = standards.filter(s => !s.source_citation);
    if (standardsWithoutSource.length > 0 && standards.length > 0) {
      issues.push({
        type: 'compliance_standards_no_citation',
        severity: 'medium',
        description: `${standardsWithoutSource.length}/${standards.length} mandatory standards lack source citations`
      });
    }
    
    // Check data_gaps array
    if (complianceData.data_gaps?.length > 0) {
      issues.push({
        type: 'compliance_gaps_flagged',
        severity: 'low',
        description: `${complianceData.data_gaps.length} compliance data gaps acknowledged`
      });
    }
    
    // Check extraction confidence
    if (complianceData.extraction_confidence === 'low' && !complianceData.data_gaps?.length) {
      issues.push({
        type: 'compliance_low_confidence_unexplained',
        severity: 'medium',
        description: 'Compliance extraction confidence is low but no data_gaps provided'
      });
    }
  } else {
    issues.push({
      type: 'compliance_data_missing',
      severity: 'medium',
      description: 'compliance_data object is missing from report'
    });
  }
  
  return issues;
}

/**
 * Task 4.2: Validate composite analysis consistency between Analyst and Judge
 */
function validateCompositeConsistency(structuralAnalysis, classificationResults) {
  const issues = [];
  
  const compositeAnalysis = structuralAnalysis?.composite_analysis;
  const girApplied = classificationResults?.primary?.gri_applied || classificationResults?.primary?.gir_applied || '';
  const ecAnalysis = classificationResults?.primary?.essential_character_analysis;
  
  // Check 1: If Analyst detected composite, Judge should have handled it
  if (compositeAnalysis?.is_composite === true) {
    const isGRI3b = girApplied.includes('3(b)') || girApplied.includes('3b') || girApplied.includes('3B');
    
    if (!isGRI3b) {
      // Not using GRI 3(b) for composite - check if GRI 1 is justified
      const isGRI1 = girApplied.includes('GRI 1') || girApplied.includes('GRI_1') || girApplied === '1';
      
      if (isGRI1) {
        // GRI 1 for composite is unusual - should have explanation
        issues.push({
          type: 'composite_gri1_unusual',
          severity: 'medium',
          description: `Analyst detected composite (${compositeAnalysis.composite_type}) but Judge used GRI 1. Verify if heading explicitly covers composite.`
        });
      } else {
        issues.push({
          type: 'composite_not_gri3b',
          severity: 'medium',
          description: `Analyst detected composite product but Judge used ${girApplied} instead of GRI 3(b). Verify essential character was considered.`
        });
      }
    }
    
    // Check 2: If composite detected, essential_character_component should match between agents
    if (compositeAnalysis.essential_character_component && ecAnalysis?.essential_component) {
      const analystEC = compositeAnalysis.essential_character_component.toLowerCase();
      const judgeEC = ecAnalysis.essential_component.toLowerCase();
      
      // Fuzzy match - check if they refer to same component
      if (!analystEC.includes(judgeEC) && !judgeEC.includes(analystEC)) {
        issues.push({
          type: 'essential_character_mismatch',
          severity: 'high',
          description: `Analyst identified "${compositeAnalysis.essential_character_component}" as essential character, but Judge identified "${ecAnalysis.essential_component}". Resolve inconsistency.`
        });
      }
    }
    
    // Check 3: Analyst's composite_type should align with Judge's approach
    if (compositeAnalysis.composite_type === 'retail_set' && !girApplied.includes('3(b)')) {
      issues.push({
        type: 'retail_set_not_3b',
        severity: 'medium',
        description: 'Analyst identified "retail_set" which typically requires GRI 3(b) essential character analysis'
      });
    }
  }
  
  // Check 4: If Judge used GRI 3(b) but Analyst didn't detect composite
  if (compositeAnalysis?.is_composite === false) {
    const isGRI3b = girApplied.includes('3(b)') || girApplied.includes('3b');
    if (isGRI3b) {
      issues.push({
        type: 'gri3b_but_not_composite',
        severity: 'high',
        description: 'Judge used GRI 3(b) but Analyst marked is_composite=false. Inconsistent analysis.'
      });
    }
  }
  
  // Check 5: Validation metadata from agentAnalyze
  if (structuralAnalysis?.self_healing_applied && structuralAnalysis?.validation_issues_count > 0) {
    issues.push({
      type: 'analyst_self_healed',
      severity: 'low',
      description: `Analyst self-healed with ${structuralAnalysis.validation_issues_count} validation issues. Review composite analysis quality.`
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
  const startTime = Date.now();
  console.log('[AgentQA] ═══════════════════════════════════════════');
  console.log('[AgentQA] Starting QA Audit (TARIFF-AI 2.0)');
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { reportId } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });
    
    console.log(`[AgentQA] Report: ${reportId}`);
    
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });

    console.log(`[AgentQA] HS Code: ${report.classification_results?.primary?.hs_code}`);
    console.log(`[AgentQA] Citations: ${report.classification_results?.primary?.legal_citations?.length || 0}`);
    
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'qa_pending'
    });
    
    // Pre-validate using rule-based checks
    const girIssues = validateGirHierarchy(report.classification_results);
    const enIssues = validateEnAlignment(report.classification_results, report.research_findings);
    const precedentIssues = validatePrecedentConsistency(report.classification_results, report.research_findings);
    
    // Task 2.2: Essential Character Table validation
    const ecValidation = validateEssentialCharacter(report.classification_results);
    const ecIssues = ecValidation.issues || [];
    
    // Task 2.4: HS Code Format validation per country
    const hsFormatValidation = validateHsCodeFormat(
      report.classification_results?.primary?.hs_code,
      report.destination_country
    );
    const hsFormatIssues = hsFormatValidation.issues || [];
    
    // TARIFF-AI 2.0: Citation validation
    const citationIssues = validateCitations(report.classification_results, report.research_findings);
    // Task 4.1: Use tax_data and compliance_data instead of regulatory_data
    const extractionIssues = validateExtractionQuality(report.tax_data, report.compliance_data);
    // Task 4.2: Composite consistency check
    const compositeIssues = validateCompositeConsistency(report.structural_analysis, report.classification_results);
    const retrievalScore = calculateRetrievalScore(report.research_findings, report.classification_results);
    
    // Task 4.5: Enhanced logging
    console.log(`[AgentQA] GIR issues: ${girIssues.length}, EN issues: ${enIssues.length}`);
    console.log(`[AgentQA] Essential Character validation: required=${ecValidation.required}, valid=${ecValidation.valid}, issues=${ecIssues.length}`);
    console.log(`[AgentQA] HS Format validation: valid=${hsFormatValidation.valid}, digits=${hsFormatValidation.actual_digits}/${hsFormatValidation.expected_digits}`);
    console.log(`[AgentQA] Citation issues: ${citationIssues.length}, Extraction issues: ${extractionIssues.length}`);
    console.log(`[AgentQA] Composite consistency issues: ${compositeIssues.length}`);
    console.log(`[AgentQA] Retrieval quality score: ${retrievalScore}`);
    
    const preValidationIssues = [...girIssues, ...enIssues, ...precedentIssues, ...ecIssues, ...hsFormatIssues, ...citationIssues, ...extractionIssues, ...compositeIssues];
    const criticalIssues = preValidationIssues.filter(i => i.severity === 'high');
    
    // Build essential character context for LLM
    const ecContext = ecValidation.required ? `
ESSENTIAL CHARACTER ANALYSIS STATUS:
- Required: YES (GRI 3(b) used)
- Valid: ${ecValidation.valid ? 'YES' : 'NO'}
- Components Found: ${ecValidation.summary?.components_count || 0}
- Essential Component Identified: ${ecValidation.summary?.has_essential_component ? 'YES' : 'NO'}
- Justification Provided: ${ecValidation.summary?.has_justification ? 'YES' : 'NO'} (${ecValidation.summary?.justification_length || 0} chars)
` : '';

    // Build HS format context for LLM
    const hsFormatContext = `
HS CODE FORMAT CHECK:
- HS Code: ${report.classification_results?.primary?.hs_code || 'MISSING'}
- Destination: ${report.destination_country || 'Unknown'}
- Expected Digits: ${hsFormatValidation.expected_digits}
- Actual Digits: ${hsFormatValidation.actual_digits}
- Format Valid: ${hsFormatValidation.valid ? 'YES' : 'NO'}
${hsFormatValidation.country_format ? `- Note: ${hsFormatValidation.country_format}` : ''}
`;
    
    const preValidationContext = preValidationIssues.length > 0 ? `
═══════════════════════════════════════════════════════════════════
PRE-VALIDATION ISSUES DETECTED (Rule-Based):
═══════════════════════════════════════════════════════════════════
${preValidationIssues.map(i => `• [${i.severity.toUpperCase()}] ${i.type}: ${i.description}`).join('\n')}

${ecContext}
${hsFormatContext}

RETRIEVAL QUALITY SCORE: ${retrievalScore}/100
${citationIssues.length > 0 ? `CITATION ISSUES: ${citationIssues.length} - Review legal citations carefully` : ''}
${ecIssues.length > 0 ? `ESSENTIAL CHARACTER ISSUES: ${ecIssues.length} - Review GRI 3(b) analysis` : ''}
${hsFormatIssues.length > 0 ? `HS FORMAT ISSUES: ${hsFormatIssues.length} - Check country-specific code format` : ''}
${criticalIssues.length > 0 ? 'CRITICAL ISSUES FOUND - Likely FAIL unless reasoning explains why these are acceptable.' : ''}
` : `
${ecContext}
${hsFormatContext}
`;

    // Task 4.4: Updated context to use tax_data and compliance_data
    const context = `
REPORT ID: ${reportId}
Technical Spec: ${JSON.stringify(report.structural_analysis)}
Research: ${JSON.stringify(report.research_findings)}
Judge Results: ${JSON.stringify(report.classification_results)}
Tax Data: ${JSON.stringify(report.tax_data)}
Compliance Data: ${JSON.stringify(report.compliance_data)}

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
**CHECK 2: CITATION VALIDATION (Retrieve & Deduce Protocol)**
═══════════════════════════════════════════════════════════════════

TARIFF-AI 2.0 CRITICAL: All classifications must cite from LEGAL_TEXT_CONTEXT

Review the legal_citations array in classification_results.primary:

For EACH citation, verify:
✓ source_type is specified (HEADING_TEXT, EN, WCO_OPINION, BTI, TARIC, etc.)
✓ source_reference identifies the specific source
✓ exact_quote contains actual quoted text (not paraphrased)
✓ The quote is relevant to the classification decision

Required citations (at minimum):
□ At least ONE heading text citation OR EN citation
□ If GRI 3(b) used: Citation supporting essential character determination
□ If precedent mentioned: WCO_OPINION or BTI citation

Citation RED FLAGS:
❌ No legal_citations array at all → FAIL
❌ Citations with empty exact_quote → FAIL
❌ Generic statements without source → FAIL
❌ Citations not traceable to research_findings → WARNING

If citations missing or fabricated → status: "failed", faulty_agent: "judge"
fix_instructions: "Provide explicit citations from LEGAL_TEXT_CONTEXT with exact quotes"

═══════════════════════════════════════════════════════════════════
**CHECK 3: EXPLANATORY NOTES ALIGNMENT**
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
**CHECK 11: EXTRACTION QUALITY (Retrieve & Deduce Protocol)**
═══════════════════════════════════════════════════════════════════

For Tax and Compliance agents, verify extraction quality:

TAX DATA:
✓ Does duty_rate have duty_rate_source citation?
✓ Does vat_rate have vat_rate_source citation?
✓ Are data_gaps flagged for rates not found in context?
✓ Is extraction_confidence provided (high/medium/low)?

COMPLIANCE DATA:
✓ Do import_requirements have source_citation for each?
✓ Do mandatory_standards have source_citation for each?
✓ Are data_gaps flagged for requirements not in context?
✓ Is extraction_confidence provided?

Extraction RED FLAGS:
❌ Rates/requirements without source citations → WARNING
❌ "NOT_FOUND_IN_CONTEXT" not flagged when data missing → WARNING
❌ Low extraction_confidence without explanation → WARNING

These are warnings, not failures - but reduce score by 5-15 points

═══════════════════════════════════════════════════════════════════
**CHECK 12: CONTEXT GAPS ANALYSIS**
═══════════════════════════════════════════════════════════════════

Review context_gaps arrays across all agents:

For classification context_gaps:
✓ Are gaps legitimate (info truly not in corpus)?
✓ Are gaps critical to classification or minor?
✓ Did Judge make assumptions despite gaps?

For tax/compliance data_gaps:
✓ Are gaps acknowledged to user?
✓ Is manual verification recommended where needed?

If critical gaps not acknowledged → Reduce score by 10 points

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

RETRIEVE & DEDUCE DEDUCTIONS:
- No legal_citations at all: -25 (CRITICAL - FAIL)
- Citations without exact_quote: -15
- Unverified/fabricated citations: -20 (CRITICAL - FAIL)
- Tax rates without source: -10
- Compliance requirements without source: -10
- Excessive context_gaps (>5): -10
- Low extraction_confidence without justification: -5

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
                                essential_character_complete: { type: "boolean" },
                                essential_character_validation: {
                                    type: "object",
                                    properties: {
                                        required: { type: "boolean" },
                                        valid: { type: "boolean" },
                                        components_count: { type: "number" },
                                        has_justification: { type: "boolean" }
                                    },
                                    description: "Task 2.2: Essential Character Table validation results"
                                }
                            }
                        },
                        hs_format_validation: {
                            type: "object",
                            properties: {
                                valid: { type: "boolean" },
                                expected_digits: { type: "number" },
                                actual_digits: { type: "number" },
                                country_specific: { type: "string" }
                            },
                            description: "Task 2.4: HS Code format validation per country"
                        },
                        citation_validation: {
                            type: "object",
                            properties: {
                                citations_present: { type: "boolean" },
                                citation_count: { type: "number" },
                                citations_verified: { type: "boolean" },
                                fabrication_suspected: { type: "boolean" },
                                missing_citation_types: { type: "array", items: { type: "string" } }
                            },
                            description: "Retrieve & Deduce citation validation results"
                        },
                        extraction_validation: {
                            type: "object",
                            properties: {
                                tax_sources_cited: { type: "boolean" },
                                compliance_sources_cited: { type: "boolean" },
                                data_gaps_acknowledged: { type: "boolean" },
                                extraction_confidence_reasonable: { type: "boolean" }
                            },
                            description: "Tax and compliance extraction validation"
                        },
                        retrieval_quality_score: {
                            type: "number",
                            description: "Score for Retrieve & Deduce compliance (0-100)"
                        }
                    }
                }
            }
        },
        base44_client: base44
    });

    const duration = Date.now() - startTime;
    
    const audit = result.qa_audit;
    
    // Enrich audit with pre-validation results
    const enrichedAudit = {
        ...audit,
        pre_validation_issues: preValidationIssues,
        retrieval_quality_score: audit.retrieval_quality_score || retrievalScore,
        retrieve_deduce_compliant: citationIssues.filter(i => i.severity === 'high').length === 0,
        // Task 2.2: Essential Character validation results
        essential_character_validation: {
            required: ecValidation.required,
            valid: ecValidation.valid,
            components_count: ecValidation.summary?.components_count || 0,
            has_justification: ecValidation.summary?.has_justification || false,
            issues_count: ecIssues.length
        },
        // Task 2.4: HS Format validation results
        hs_format_validation: {
            valid: hsFormatValidation.valid,
            expected_digits: hsFormatValidation.expected_digits,
            actual_digits: hsFormatValidation.actual_digits,
            country_format: hsFormatValidation.country_format,
            issues_count: hsFormatIssues.length
        }
    };
    
    let finalStatus = 'completed';
    let processingStatus = 'completed';

    if (enrichedAudit.status === 'failed') {
        finalStatus = 'failed';
        processingStatus = 'failed';
    }

    // Log QA results
    console.log(`[AgentQA] ✓ QA Audit complete:`);
    console.log(`[AgentQA]   - Status: ${enrichedAudit.status?.toUpperCase()}`);
    console.log(`[AgentQA]   - Score: ${enrichedAudit.score}/100`);
    console.log(`[AgentQA]   - Retrieval Quality: ${enrichedAudit.retrieval_quality_score}/100`);
    console.log(`[AgentQA]   - R&D Compliant: ${enrichedAudit.retrieve_deduce_compliant ? 'YES' : 'NO'}`);
    console.log(`[AgentQA]   - Pre-validation Issues: ${preValidationIssues.length}`);
    console.log(`[AgentQA]   - GIR Issues: ${girIssues.length}`);
    console.log(`[AgentQA]   - Essential Character: required=${ecValidation.required}, valid=${ecValidation.valid}, issues=${ecIssues.length}`);
    console.log(`[AgentQA]   - HS Format: valid=${hsFormatValidation.valid}, ${hsFormatValidation.actual_digits}/${hsFormatValidation.expected_digits} digits`);
    console.log(`[AgentQA]   - Citation Issues: ${citationIssues.length}`);
    console.log(`[AgentQA]   - Extraction Issues: ${extractionIssues.length}`);
    console.log(`[AgentQA]   - Composite Issues: ${compositeIssues.length}`);
    if (enrichedAudit.status === 'failed') {
        console.log(`[AgentQA]   - Faulty Agent: ${enrichedAudit.faulty_agent}`);
        console.log(`[AgentQA]   - Fix Instructions: ${enrichedAudit.fix_instructions?.substring(0, 100)}...`);
    }
    console.log(`[AgentQA]   - Duration: ${duration}ms`);
    console.log(`[AgentQA] ═══════════════════════════════════════════`);

    // Build update object only with defined values to avoid overwriting with undefined
    const updateData = {
        qa_audit: enrichedAudit,
        status: finalStatus,
        processing_status: processingStatus
    };
    
    // Only add score if it exists
    if (enrichedAudit.score !== undefined && enrichedAudit.score !== null) {
        updateData.confidence_score = enrichedAudit.score;
    }
    
    // Only add qa_notes if user_explanation exists and is not empty
    if (enrichedAudit.user_explanation) {
        updateData.qa_notes = [enrichedAudit.user_explanation];
    }
    
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, updateData);
    
    return Response.json({ 
        success: true, 
        status: finalStatus, 
        audit: enrichedAudit,
        retrieval_metadata: {
            retrieval_quality_score: retrievalScore,
            citation_issues_count: citationIssues.length,
            extraction_issues_count: extractionIssues.length,
            composite_issues_count: compositeIssues.length,
            gir_issues_count: girIssues.length
        },
        duration_ms: duration
    });

  } catch (error) {
    console.error('[AgentQA] ❌ ERROR:', error.message);
    console.error('[AgentQA] Stack:', error.stack);
    console.log(`[AgentQA] ═══════════════════════════════════════════`);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});