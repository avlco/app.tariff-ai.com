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

// --- END GIR VALIDATION LOGIC ---

// --- TARIFF-AI 2.0: CITATION VALIDATION LOGIC ---

/**
 * Normalize text for comparison (remove extra whitespace, lowercase)
 */
function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Check if a quote appears in corpus using fuzzy matching
 * Returns true if found, false otherwise
 */
function findQuoteInCorpus(quote, corpus, minMatchLength = 30) {
  if (!quote || !corpus || quote.length < 10) return true; // Skip validation for short quotes
  
  const normalizedQuote = normalizeText(quote);
  const normalizedCorpus = normalizeText(corpus);
  
  // Try progressively shorter matches
  for (let len = Math.min(50, normalizedQuote.length); len >= minMatchLength; len -= 5) {
    const searchTerm = normalizedQuote.substring(0, len);
    if (normalizedCorpus.includes(searchTerm)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Validate that legal citations reference actual content from the retrieved corpus
 * This is the KEY validation for "Retrieve & Deduce" architecture
 * Enhanced in Task 3.2 with better fuzzy matching and duplicate detection
 */
function validateCitations(classificationResults, researchFindings) {
  const issues = [];
  const legalCitations = classificationResults?.primary?.legal_citations || [];
  const contextGaps = classificationResults?.primary?.context_gaps || [];
  
  // === Check 1: Citations exist at all ===
  if (legalCitations.length === 0) {
    issues.push({
      type: 'no_citations',
      severity: 'high',
      description: 'No legal citations provided - Retrieve & Deduce protocol requires explicit citations from LEGAL_TEXT_CONTEXT'
    });
    return issues; // No point checking further
  }
  
  // === Check 2: Minimum citation count ===
  if (legalCitations.length < 2) {
    issues.push({
      type: 'insufficient_citations',
      severity: 'medium',
      description: `Only ${legalCitations.length} citation provided. Robust classification requires at least 2 citations from different sources.`
    });
  }
  
  // === Check 3: Citation types distribution ===
  const citationTypes = legalCitations.map(c => c.source_type);
  const hasHeadingText = citationTypes.includes('HEADING_TEXT');
  const hasEN = citationTypes.includes('EN');
  
  if (!hasHeadingText && !hasEN) {
    issues.push({
      type: 'missing_core_citations',
      severity: 'high',
      description: 'Classification missing HEADING_TEXT or EN citations - these are the primary legal basis and MUST be cited'
    });
  }
  
  // === Check 4: Duplicate citations (Task 3.2b) ===
  const seenCitations = new Set();
  const duplicates = [];
  for (const citation of legalCitations) {
    const key = `${citation.source_type}|${citation.source_reference || ''}`.toLowerCase();
    if (seenCitations.has(key)) {
      duplicates.push(citation.source_reference || citation.source_type);
    } else {
      seenCitations.add(key);
    }
  }
  
  if (duplicates.length > 0) {
    issues.push({
      type: 'duplicate_citations',
      severity: 'low',
      description: `Duplicate citations detected: ${duplicates.join(', ')}. Each source should be cited once.`
    });
  }
  
  // === Check 5: Validate citations have actual quotes ===
  const emptyCitations = [];
  const shortCitations = [];
  for (const citation of legalCitations) {
    if (!citation.exact_quote) {
      emptyCitations.push(`${citation.source_type}/${citation.source_reference || 'unknown'}`);
    } else if (citation.exact_quote.length < 15) {
      shortCitations.push(`${citation.source_type}/${citation.source_reference || 'unknown'} (${citation.exact_quote.length} chars)`);
    }
  }
  
  if (emptyCitations.length > 0) {
    issues.push({
      type: 'empty_citation_quotes',
      severity: 'high',
      description: `Citations with no exact_quote: ${emptyCitations.join(', ')}. Each citation MUST include the actual quoted text.`
    });
  }
  
  if (shortCitations.length > 0) {
    issues.push({
      type: 'short_citation_quotes',
      severity: 'medium',
      description: `Citations with very short quotes: ${shortCitations.join(', ')}. Quotes should be substantial enough to verify.`
    });
  }
  
  // === Check 6: Context gaps ===
  if (contextGaps.length > 3) {
    issues.push({
      type: 'excessive_context_gaps',
      severity: 'medium',
      description: `${contextGaps.length} context gaps flagged - classification may need more research`
    });
  }
  
  // === Check 7: Cross-reference citations with corpus (Task 3.2a - improved fuzzy match) ===
  const rawCorpus = researchFindings?.raw_legal_text_corpus || '';
  const candidateHeadings = researchFindings?.candidate_headings || [];
  const wcoOpinions = researchFindings?.wco_precedents || [];
  const btiCases = researchFindings?.bti_cases || [];
  const legalNotes = researchFindings?.legal_notes_found || [];
  
  // Build combined searchable corpus from all sources
  const combinedCorpus = [
    rawCorpus,
    ...candidateHeadings.map(h => `${h.description || ''} ${h.explanatory_note_summary || ''}`),
    ...legalNotes,
    ...wcoOpinions.map(w => `${w.reasoning || ''} ${w.product || ''}`),
    ...btiCases.map(b => `${b.product_description || ''} ${b.hs_code || ''}`)
  ].join(' ');
  
  if (combinedCorpus.length > 100) {
    const unverifiedCitations = [];
    
    for (const citation of legalCitations) {
      if (citation.exact_quote && citation.exact_quote.length >= 20) {
        const foundInCorpus = findQuoteInCorpus(citation.exact_quote, combinedCorpus, 25);
        
        if (!foundInCorpus) {
          unverifiedCitations.push(`${citation.source_type}/${citation.source_reference || 'unknown'}`);
        }
      }
    }
    
    if (unverifiedCitations.length > 0) {
      issues.push({
        type: 'citations_not_in_corpus',
        severity: 'high',
        description: `${unverifiedCitations.length} citation(s) could not be verified against retrieved corpus: ${unverifiedCitations.slice(0, 3).join(', ')}${unverifiedCitations.length > 3 ? '...' : ''}. These may be fabricated.`
      });
    }
  }
  
  // === Check 8: EN citations align with candidate headings (Task 3.2c) ===
  const candidateCodes = candidateHeadings.map(h => h.code_4_digit).filter(Boolean);
  const enCitations = legalCitations.filter(c => c.source_type === 'EN');
  
  for (const citation of enCitations) {
    const headingCode = citation.source_reference?.match(/\d{4}/)?.[0];
    if (headingCode && candidateCodes.length > 0) {
      if (!candidateCodes.includes(headingCode)) {
        issues.push({
          type: 'en_heading_not_researched',
          severity: 'medium',
          description: `EN citation references heading ${headingCode} but this heading was not in research candidates (${candidateCodes.join(', ')}). Citation may be unverifiable.`
        });
      }
    }
  }
  
  // === Check 9: Verify WCO citations ===
  const wcoCitations = legalCitations.filter(c => c.source_type === 'WCO_OPINION');
  for (const citation of wcoCitations) {
    if (wcoOpinions.length > 0) {
      const foundInResearch = wcoOpinions.some(op => 
        citation.source_reference?.includes(op.opinion_number) ||
        (citation.exact_quote && op.reasoning && findQuoteInCorpus(citation.exact_quote, op.reasoning, 20))
      );
      if (!foundInResearch) {
        issues.push({
          type: 'unverified_wco_citation',
          severity: 'medium',
          description: `WCO citation "${citation.source_reference}" not found in research findings - may be fabricated`
        });
      }
    }
  }
  
  // === Check 10: Verify BTI citations ===
  const btiCitations = legalCitations.filter(c => c.source_type === 'BTI');
  for (const citation of btiCitations) {
    if (btiCases.length > 0) {
      const foundInResearch = btiCases.some(b => 
        citation.source_reference?.includes(b.reference) ||
        (citation.exact_quote && b.product_description && findQuoteInCorpus(citation.exact_quote, b.product_description, 15))
      );
      if (!foundInResearch) {
        issues.push({
          type: 'unverified_bti_citation',
          severity: 'low',
          description: `BTI citation "${citation.source_reference}" not found in research findings`
        });
      }
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

/**
 * Task 4.2c: Validate research data completeness
 * Check if research_findings have sufficient data for classification
 */
function validateResearchCompleteness(researchFindings) {
  const issues = [];
  
  // Check 1: raw_legal_text_corpus length (Task 4.2c.1)
  const corpusLength = researchFindings?.raw_legal_text_corpus?.length || 0;
  if (corpusLength === 0) {
    issues.push({
      type: 'research_no_corpus',
      severity: 'high',
      description: 'raw_legal_text_corpus is missing - no legal text was retrieved for citation. Classification cannot be properly grounded.',
      action_needed: 'expand_search'
    });
  } else if (corpusLength < 500) {
    issues.push({
      type: 'research_corpus_insufficient',
      severity: 'high',
      description: `raw_legal_text_corpus is only ${corpusLength} chars (< 500 minimum). Legal text retrieved is insufficient for robust citation.`,
      action_needed: 'expand_search'
    });
  } else if (corpusLength < 1500) {
    issues.push({
      type: 'research_corpus_thin',
      severity: 'medium',
      description: `raw_legal_text_corpus is ${corpusLength} chars - may be thin for complex products. Consider expanding search.`,
      action_needed: 'optional_expand'
    });
  }
  
  // Check 2: candidate_headings exist (Task 4.2c.2)
  const candidateHeadings = researchFindings?.candidate_headings || [];
  if (candidateHeadings.length === 0) {
    issues.push({
      type: 'research_no_candidates',
      severity: 'high',
      description: 'No candidate_headings identified by research. Cannot proceed with classification without heading candidates.',
      action_needed: 'expand_search'
    });
  } else if (candidateHeadings.length < 2) {
    issues.push({
      type: 'research_few_candidates',
      severity: 'medium',
      description: `Only ${candidateHeadings.length} candidate heading found. Consider if more alternatives exist.`,
      action_needed: 'optional_expand'
    });
  }
  
  // Check 3: verified_sources exist (Task 4.2c.2)
  const verifiedSources = researchFindings?.verified_sources || [];
  if (verifiedSources.length === 0) {
    issues.push({
      type: 'research_no_sources',
      severity: 'high',
      description: 'No verified_sources found by research. Classification relies on unverified data.',
      action_needed: 'expand_search'
    });
  } else {
    // Check for Tier 1 sources
    const tier1Sources = verifiedSources.filter(s => s.authority_tier === '1' || s.authority_tier === 1);
    if (tier1Sources.length === 0) {
      issues.push({
        type: 'research_no_tier1_sources',
        severity: 'medium',
        description: 'No Tier 1 (official government/WCO) sources found. Classification relies on lower-authority sources.',
        action_needed: 'optional_expand'
      });
    }
  }
  
  // Check 4: legal_notes_found
  const legalNotes = researchFindings?.legal_notes_found || [];
  if (legalNotes.length === 0) {
    issues.push({
      type: 'research_no_legal_notes',
      severity: 'medium',
      description: 'No Section/Chapter notes retrieved. These are important for accurate classification.',
      action_needed: 'optional_expand'
    });
  }
  
  // Check 5: EN summaries in candidate_headings
  const headingsWithEN = candidateHeadings.filter(h => h.explanatory_note_summary);
  if (candidateHeadings.length > 0 && headingsWithEN.length === 0) {
    issues.push({
      type: 'research_no_en_summaries',
      severity: 'medium',
      description: 'Candidate headings lack explanatory_note_summary. EN guidance not retrieved.',
      action_needed: 'optional_expand'
    });
  }
  
  return issues;
}

/**
 * Task 4.2b: Generate detailed self-healing feedback based on issues
 * Returns structured feedback for the orchestrator to pass to faulty agent
 */
function generateDetailedFeedback(issues, faultyAgent) {
  const highIssues = issues.filter(i => i.severity === 'high');
  const mediumIssues = issues.filter(i => i.severity === 'medium');
  
  let feedback = `
═══════════════════════════════════════════════════════════════════
QA AUDIT FAILED - SELF-HEALING REQUIRED
Faulty Agent: ${faultyAgent}
═══════════════════════════════════════════════════════════════════

`;

  // Group issues by type for clearer feedback
  const issuesByCategory = {
    gir: issues.filter(i => i.type?.includes('gir') || i.type?.includes('hierarchy') || i.type?.includes('essential_character')),
    citation: issues.filter(i => i.type?.includes('citation') || i.type?.includes('no_citations')),
    research: issues.filter(i => i.type?.includes('research')),
    extraction: issues.filter(i => i.type?.includes('tax') || i.type?.includes('compliance') || i.type?.includes('vat')),
    composite: issues.filter(i => i.type?.includes('composite'))
  };
  
  // GIR Issues
  if (issuesByCategory.gir.length > 0) {
    feedback += `**GIR/CLASSIFICATION ISSUES (${issuesByCategory.gir.length}):**\n`;
    for (const issue of issuesByCategory.gir) {
      feedback += `• [${issue.severity.toUpperCase()}] ${issue.description}\n`;
    }
    feedback += `
FIX GUIDANCE FOR GIR ISSUES:
1. Review gir_state_log - ensure GRI 1 is always analyzed first
2. If GRI 3(b) is used, provide COMPLETE essential_character_analysis:
   - components[] with name, nature, bulk_percent, value_percent, functional_role
   - essential_component clearly identified
   - justification (100+ chars) citing Nature/Bulk/Value/Role factors
3. Document transition reasoning for each GRI state visited

`;
  }
  
  // Citation Issues
  if (issuesByCategory.citation.length > 0) {
    feedback += `**CITATION ISSUES (${issuesByCategory.citation.length}):**\n`;
    for (const issue of issuesByCategory.citation) {
      feedback += `• [${issue.severity.toUpperCase()}] ${issue.description}\n`;
    }
    feedback += `
FIX GUIDANCE FOR CITATION ISSUES:
1. Each citation MUST have: source_type, source_reference, exact_quote
2. exact_quote must be ACTUAL text from LEGAL_TEXT_CONTEXT (not paraphrased)
3. Include at least 2 citations, with at least one EN or HEADING_TEXT
4. Do NOT fabricate citations - if text not found, add to context_gaps

`;
  }
  
  // Research Issues
  if (issuesByCategory.research.length > 0) {
    feedback += `**RESEARCH DATA ISSUES (${issuesByCategory.research.length}):**\n`;
    for (const issue of issuesByCategory.research) {
      feedback += `• [${issue.severity.toUpperCase()}] ${issue.description}\n`;
      if (issue.action_needed) {
        feedback += `  → Action: ${issue.action_needed}\n`;
      }
    }
    feedback += `
FIX GUIDANCE FOR RESEARCH ISSUES:
1. Re-run agentResearch with expand_search: true
2. Focus on official sources (WCO, government customs sites)
3. Retrieve full heading text and explanatory notes
4. Ensure raw_legal_text_corpus has >500 chars of legal text

`;
  }
  
  // Extraction Issues
  if (issuesByCategory.extraction.length > 0) {
    feedback += `**TAX/COMPLIANCE EXTRACTION ISSUES (${issuesByCategory.extraction.length}):**\n`;
    for (const issue of issuesByCategory.extraction) {
      feedback += `• [${issue.severity.toUpperCase()}] ${issue.description}\n`;
    }
    feedback += `
FIX GUIDANCE FOR EXTRACTION ISSUES:
1. Each rate MUST have a source citation (duty_rate_source, vat_rate_source)
2. Each requirement MUST have source_citation
3. If data not found in context, mark as "NOT_FOUND_IN_CONTEXT"
4. Provide data_gaps array listing missing information

`;
  }
  
  // Composite Issues
  if (issuesByCategory.composite.length > 0) {
    feedback += `**COMPOSITE CONSISTENCY ISSUES (${issuesByCategory.composite.length}):**\n`;
    for (const issue of issuesByCategory.composite) {
      feedback += `• [${issue.severity.toUpperCase()}] ${issue.description}\n`;
    }
    feedback += `
FIX GUIDANCE FOR COMPOSITE ISSUES:
1. If Analyst detected composite, Judge should use GRI 3(b) or explain why not
2. essential_character_component should match between Analyst and Judge
3. Review composite_analysis and align classification approach

`;
  }
  
  // Summary counts
  feedback += `
═══════════════════════════════════════════════════════════════════
SUMMARY: ${highIssues.length} CRITICAL issues, ${mediumIssues.length} MEDIUM issues
${highIssues.length > 0 ? 'CRITICAL issues MUST be fixed before approval.' : ''}
═══════════════════════════════════════════════════════════════════
`;

  return feedback;
}

// --- END CITATION VALIDATION LOGIC ---

// --- TARIFF-AI 2.0: BTI CONSENSUS CHECK (Task 4.3a) ---

/**
 * Analyze BTI precedents and calculate consensus score
 * Used to validate classification against existing rulings
 */
function analyzeBtiConsensus(btiCases, selectedHsCode) {
  const result = {
    total_cases: 0,
    matching_cases: 0,
    conflicting_cases: [],
    consensus_score: 0,
    recommendations: []
  };
  
  if (!btiCases || btiCases.length === 0) {
    return { ...result, recommendations: ['No BTI precedents found for comparison'] };
  }
  
  result.total_cases = btiCases.length;
  const selectedHeading = selectedHsCode?.substring(0, 4);
  
  for (const bti of btiCases) {
    const btiHeading = bti.hs_code?.substring(0, 4);
    
    if (btiHeading === selectedHeading) {
      result.matching_cases++;
    } else if (btiHeading) {
      result.conflicting_cases.push({
        reference: bti.reference,
        hs_code: bti.hs_code,
        product: bti.product_description?.substring(0, 100)
      });
    }
  }
  
  // Calculate consensus score
  if (result.total_cases > 0) {
    result.consensus_score = Math.round((result.matching_cases / result.total_cases) * 100);
  }
  
  // Generate recommendations
  if (result.conflicting_cases.length > result.matching_cases) {
    result.recommendations.push(
      `WARNING: ${result.conflicting_cases.length} BTI cases suggest different heading than selected ${selectedHeading}. Review classification.`
    );
  }
  
  if (result.consensus_score < 50 && result.total_cases >= 3) {
    result.recommendations.push(
      `LOW CONSENSUS (${result.consensus_score}%): BTI precedents are mixed. Consider alternative headings.`
    );
  }
  
  return result;
}

// --- TARIFF-AI 2.0: EN EXCLUSION CHECK (Task 4.3b) ---

/**
 * Check if product may be excluded by EN exclusions
 * Returns potential exclusion conflicts
 */
function checkEnExclusions(researchFindings, productDescription) {
  const conflicts = [];
  const enExclusions = researchFindings?.en_exclusions || [];
  const candidateHeadings = researchFindings?.candidate_headings || [];
  
  const productLower = (productDescription || '').toLowerCase();
  
  for (const exclusion of enExclusions) {
    const exclusionText = (exclusion.exclusion_text || '').toLowerCase();
    
    // Check for keyword overlap
    const exclusionKeywords = exclusionText.split(/\s+/).filter(w => w.length > 4);
    const matchingKeywords = exclusionKeywords.filter(kw => productLower.includes(kw));
    
    if (matchingKeywords.length >= 2) {
      conflicts.push({
        type: 'en_exclusion_match',
        heading: exclusion.heading,
        exclusion_text: exclusion.exclusion_text,
        redirect_heading: exclusion.redirect_heading,
        matching_keywords: matchingKeywords,
        severity: matchingKeywords.length >= 3 ? 'high' : 'medium'
      });
    }
  }
  
  // Also check structured EN from candidate headings
  for (const heading of candidateHeadings) {
    if (heading.exclusion_conflicts?.length > 0) {
      for (const conflict of heading.exclusion_conflicts) {
        conflicts.push({
          type: 'structured_en_conflict',
          heading: heading.code_4_digit,
          exclusion_text: conflict.exclusion_text,
          redirect_heading: conflict.redirect_heading,
          matching_keywords: conflict.matching_keywords,
          severity: conflict.confidence === 'high' ? 'high' : 'medium'
        });
      }
    }
  }
  
  return conflicts;
}

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
    
    // TARIFF-AI 2.0: Citation validation
    const citationIssues = validateCitations(report.classification_results, report.research_findings);
    // Task 4.1: Use tax_data and compliance_data instead of regulatory_data
    const extractionIssues = validateExtractionQuality(report.tax_data, report.compliance_data);
    // Task 4.2: Composite consistency check
    const compositeIssues = validateCompositeConsistency(report.structural_analysis, report.classification_results);
    // Task 4.2c: Research completeness validation
    const researchIssues = validateResearchCompleteness(report.research_findings);
    const retrievalScore = calculateRetrievalScore(report.research_findings, report.classification_results);
    
    // Task 4.3a: BTI consensus check
    const btiConsensus = analyzeBtiConsensus(
      report.research_findings?.bti_cases,
      report.classification_results?.primary?.hs_code
    );
    
    // Task 4.3b: EN exclusion check
    const enExclusionConflicts = checkEnExclusions(
      report.research_findings,
      report.structural_analysis?.standardized_name || report.product_name
    );
    
    console.log(`[AgentQA] BTI Consensus: ${btiConsensus.consensus_score}% (${btiConsensus.matching_cases}/${btiConsensus.total_cases})`);
    console.log(`[AgentQA] EN Exclusion Conflicts: ${enExclusionConflicts.length}`);
    
    // Task 4.5: Enhanced logging
    console.log(`[AgentQA] GIR issues: ${girIssues.length}, EN issues: ${enIssues.length}`);
    console.log(`[AgentQA] Research completeness issues: ${researchIssues.length}`);
    console.log(`[AgentQA] Citation issues: ${citationIssues.length}, Extraction issues: ${extractionIssues.length}`);
    console.log(`[AgentQA] Composite consistency issues: ${compositeIssues.length}`);
    console.log(`[AgentQA] Retrieval quality score: ${retrievalScore}`);
    
    // Add BTI consensus issues if low
    const btiIssues = [];
    if (btiConsensus.consensus_score < 50 && btiConsensus.total_cases >= 3) {
      btiIssues.push({
        type: 'bti_low_consensus',
        severity: 'medium',
        description: `BTI consensus is only ${btiConsensus.consensus_score}% (${btiConsensus.matching_cases}/${btiConsensus.total_cases}). ${btiConsensus.recommendations.join(' ')}`
      });
    }
    
    if (btiConsensus.conflicting_cases.length > 0 && btiConsensus.conflicting_cases.length > btiConsensus.matching_cases) {
      btiIssues.push({
        type: 'bti_majority_conflict',
        severity: 'high',
        description: `Majority of BTI cases (${btiConsensus.conflicting_cases.length}/${btiConsensus.total_cases}) suggest different headings. Review classification.`,
        conflicting_headings: btiConsensus.conflicting_cases.map(c => c.hs_code?.substring(0, 4)).filter(Boolean)
      });
    }
    
    // Add EN exclusion issues
    const enExclusionIssues = enExclusionConflicts.map(conflict => ({
      type: 'en_exclusion_conflict',
      severity: conflict.severity,
      description: `EN for heading ${conflict.heading} may EXCLUDE this product: "${conflict.exclusion_text?.substring(0, 100)}..." → Redirect to ${conflict.redirect_heading || 'other heading'}`,
      matching_keywords: conflict.matching_keywords
    }));

    const preValidationIssues = [...girIssues, ...enIssues, ...precedentIssues, ...citationIssues, ...extractionIssues, ...compositeIssues, ...researchIssues, ...btiIssues, ...enExclusionIssues];
    const criticalIssues = preValidationIssues.filter(i => i.severity === 'high');
    
    // Task 4.2c.3: Check if research needs expansion
    const researchNeedsExpansion = researchIssues.some(i => i.action_needed === 'expand_search');
    
    const preValidationContext = preValidationIssues.length > 0 ? `
═══════════════════════════════════════════════════════════════════
PRE-VALIDATION ISSUES DETECTED (Rule-Based):
═══════════════════════════════════════════════════════════════════
${preValidationIssues.map(i => `• [${i.severity.toUpperCase()}] ${i.type}: ${i.description}`).join('\n')}

RETRIEVAL QUALITY SCORE: ${retrievalScore}/100
${citationIssues.length > 0 ? `CITATION ISSUES: ${citationIssues.length} - Review legal citations carefully` : ''}
${researchIssues.length > 0 ? `RESEARCH ISSUES: ${researchIssues.length} - Research data may be incomplete` : ''}
${researchNeedsExpansion ? '⚠️ RESEARCH EXPANSION RECOMMENDED - Insufficient legal text corpus for reliable classification' : ''}
${criticalIssues.length > 0 ? 'CRITICAL ISSUES FOUND - Likely FAIL unless reasoning explains why these are acceptable.' : ''}
` : '';

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
                                essential_character_complete: { type: "boolean" }
                            }
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
        research_needs_expansion: researchNeedsExpansion,
        research_issues: researchIssues,
        // Task 4.3: BTI consensus and EN exclusion results
        bti_consensus: btiConsensus,
        en_exclusion_conflicts: enExclusionConflicts
    };
    
    // Task 4.2b: Generate detailed self-healing feedback if failed
    if (enrichedAudit.status === 'failed') {
        const detailedFeedback = generateDetailedFeedback(preValidationIssues, enrichedAudit.faulty_agent || 'unknown');
        enrichedAudit.detailed_fix_instructions = detailedFeedback;
    }
    
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
    console.log(`[AgentQA]   - Citation Issues: ${citationIssues.length}`);
    console.log(`[AgentQA]   - Extraction Issues: ${extractionIssues.length}`);
    console.log(`[AgentQA]   - Composite Issues: ${compositeIssues.length}`);
    console.log(`[AgentQA]   - Research Issues: ${researchIssues.length}`);
    console.log(`[AgentQA]   - Research Needs Expansion: ${researchNeedsExpansion ? 'YES' : 'NO'}`);
    console.log(`[AgentQA]   - BTI Consensus: ${btiConsensus.consensus_score}%`);
    console.log(`[AgentQA]   - EN Exclusion Conflicts: ${enExclusionConflicts.length}`);
    if (enrichedAudit.status === 'failed') {
        console.log(`[AgentQA]   - Faulty Agent: ${enrichedAudit.faulty_agent}`);
        console.log(`[AgentQA]   - Fix Instructions: ${enrichedAudit.fix_instructions?.substring(0, 100)}...`);
        console.log(`[AgentQA]   - Detailed Feedback Generated: YES`);
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
            gir_issues_count: girIssues.length,
            research_issues_count: researchIssues.length,
            research_needs_expansion: researchNeedsExpansion,
            bti_consensus_score: btiConsensus.consensus_score,
            en_exclusion_conflicts_count: enExclusionConflicts.length
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