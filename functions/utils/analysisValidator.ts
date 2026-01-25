/**
 * Analysis Output Validator
 * Validates agentAnalyze LLM output for completeness and consistency
 */

export function validateAnalysisOutput(spec) {
  const errors = [];
  const warnings = [];

  // Check 1: Required basic fields
  if (!spec.standardized_name) {
    errors.push({ code: 'MISSING_NAME', message: 'standardized_name is required' });
  }
  
  if (!spec.function) {
    errors.push({ code: 'MISSING_FUNCTION', message: 'function is required' });
  }

  // Check 2: If composite → must have components
  if (spec.is_composite === true) {
    if (!spec.components_breakdown || spec.components_breakdown.length < 2) {
      errors.push({ 
        code: 'COMPOSITE_MISSING_COMPONENTS', 
        message: 'Product marked as composite but components_breakdown missing or has <2 items',
        fix: 'List ALL components with name, material, weight_percent, value_percent'
      });
    }
    
    if (!spec.essential_character) {
      errors.push({ 
        code: 'COMPOSITE_MISSING_EC', 
        message: 'Composite product requires essential_character field',
        fix: 'Identify which component gives essential character and WHY'
      });
    }
  }

  // Check 3: If GIR path is 3b → must have composite analysis
  if (spec.potential_gir_path?.includes('3b') || spec.potential_gir_path?.includes('3(b)')) {
    if (!spec.components_breakdown) {
      errors.push({ 
        code: 'GRI3B_MISSING_COMPONENTS', 
        message: 'GRI 3(b) path indicated but no components_breakdown',
        fix: 'Provide Nature/Bulk/Value/Role analysis for each component'
      });
    }
  }

  // Check 4: Components validation
  if (spec.components_breakdown && spec.components_breakdown.length > 0) {
    let totalWeight = 0;
    let totalValue = 0;
    
    for (const comp of spec.components_breakdown) {
      if (!comp.name) {
        warnings.push({ code: 'COMPONENT_MISSING_NAME', component: comp });
      }
      if (comp.weight_percent !== undefined) totalWeight += comp.weight_percent;
      if (comp.value_percent !== undefined) totalValue += comp.value_percent;
    }
    
    // Check percentage sums
    if (totalWeight > 0 && (totalWeight < 90 || totalWeight > 110)) {
      warnings.push({ 
        code: 'WEIGHT_SUM_MISMATCH', 
        message: `Weight percentages sum to ${totalWeight}%, expected ~100%` 
      });
    }
    if (totalValue > 0 && (totalValue < 90 || totalValue > 110)) {
      warnings.push({ 
        code: 'VALUE_SUM_MISMATCH', 
        message: `Value percentages sum to ${totalValue}%, expected ~100%` 
      });
    }
  }

  // Check 5: readiness_score consistency
  const calculatedReadiness = calculateReadinessScore(spec);
  if (spec.readiness_score && Math.abs(spec.readiness_score - calculatedReadiness) > 20) {
    warnings.push({ 
      code: 'READINESS_MISMATCH', 
      message: `Reported readiness ${spec.readiness_score}% doesn't match calculated ${calculatedReadiness}%` 
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    needsRetry: errors.length > 0
  };
}

export function calculateReadinessScore(spec) {
  let score = 0;
  if (spec.standardized_name) score += 20;
  if (spec.material_composition) score += 15;
  if (spec.function) score += 20;
  if (spec.state) score += 10;
  if (spec.essential_character) score += 15;
  if (spec.components_breakdown?.length > 0) score += 10;
  if (spec.industry_specific_data && Object.keys(spec.industry_specific_data).length > 0) score += 10;
  return Math.min(100, score);
}

export function buildAnalyzeFeedback(errors) {
  const messages = {
    'MISSING_NAME': '• standardized_name is required - provide precise product name',
    'MISSING_FUNCTION': '• function is required - describe PRIMARY function',
    'COMPOSITE_MISSING_COMPONENTS': `
• Product marked as composite but components_breakdown is incomplete.
  Required format:
  components_breakdown: [
    { name: "Component A", material: "...", weight_percent: 60, value_percent: 40, function: "..." },
    { name: "Component B", material: "...", weight_percent: 40, value_percent: 60, function: "..." }
  ]`,
    'COMPOSITE_MISSING_EC': '• essential_character is required for composite products - which component gives it identity?',
    'GRI3B_MISSING_COMPONENTS': '• GRI 3(b) path requires full component analysis with Nature/Bulk/Value/Role'
  };
  
  return errors.map(e => messages[e.code] || `• ${e.message}`).join('\n');
}