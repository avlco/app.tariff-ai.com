/**
 * HS Code Format Validator
 * Validates and formats HS codes according to country-specific requirements
 */

export const HS_FORMATS = {
  'IL': { 
    digits: 10, 
    pattern: /^\d{4}\.\d{2}\.\d{2}\.\d{2}$/, 
    example: '8471.30.00.10',
    separator: '.'
  },
  'US': { 
    digits: 10, 
    pattern: /^\d{4}\.\d{2}\.\d{4}$/, 
    example: '8471.30.0150',
    separator: '.'
  },
  'EU': { 
    digits: 8, 
    pattern: /^\d{4}\.\d{2}\.\d{2}$/, 
    example: '8471.30.00',
    separator: '.'
  },
  'UK': { 
    digits: 10, 
    pattern: /^\d{4}\.\d{2}\.\d{2}\.\d{2}$/, 
    example: '8471.30.00.00',
    separator: '.'
  },
  'CN': { 
    digits: 10, 
    pattern: /^\d{4}\.\d{2}\.\d{2}\.\d{2}$/, 
    example: '8471.30.00.10',
    separator: '.'
  },
  'DEFAULT': { 
    digits: 6, 
    pattern: /^\d{4}\.\d{2}$/, 
    example: '8471.30',
    separator: '.'
  }
};

export function validateHsFormat(hsCode, destinationCountry) {
  const format = HS_FORMATS[destinationCountry] || HS_FORMATS['DEFAULT'];
  
  // Normalize - remove dots
  const cleanCode = hsCode.replace(/\./g, '');
  
  // Check for digits only
  if (!/^\d+$/.test(cleanCode)) {
    return {
      valid: false,
      error: 'HS code must contain only digits',
      received: hsCode
    };
  }
  
  // Check minimum length
  if (cleanCode.length < 4) {
    return {
      valid: false,
      error: 'HS code must have at least 4 digits (heading)',
      received: hsCode
    };
  }
  
  // Check if code is too short
  if (cleanCode.length < format.digits) {
    return {
      valid: false,
      error: `HS code for ${destinationCountry} requires ${format.digits} digits, got ${cleanCode.length}`,
      suggestion: `Add national subheading digits. Expected format: ${format.example}`,
      received: hsCode,
      truncated: false
    };
  }
  
  // Check if code is too long
  if (cleanCode.length > format.digits) {
    const truncated = formatHsCode(cleanCode.substring(0, format.digits), destinationCountry);
    return {
      valid: true,
      warning: `HS code has ${cleanCode.length} digits, ${destinationCountry} uses ${format.digits}. Truncated.`,
      original: hsCode,
      corrected: truncated,
      truncated: true
    };
  }
  
  // Check format with dots
  if (!format.pattern.test(hsCode)) {
    const corrected = formatHsCode(cleanCode, destinationCountry);
    return {
      valid: true,
      warning: 'HS code format corrected',
      original: hsCode,
      corrected: corrected
    };
  }
  
  return { valid: true, code: hsCode };
}

export function formatHsCode(cleanCode, country) {
  const format = HS_FORMATS[country] || HS_FORMATS['DEFAULT'];
  
  // Format based on country pattern
  switch (country) {
    case 'IL':
    case 'UK':
    case 'CN':
      // XXXX.XX.XX.XX
      if (cleanCode.length >= 10) return `${cleanCode.slice(0,4)}.${cleanCode.slice(4,6)}.${cleanCode.slice(6,8)}.${cleanCode.slice(8,10)}`;
      if (cleanCode.length >= 8) return `${cleanCode.slice(0,4)}.${cleanCode.slice(4,6)}.${cleanCode.slice(6,8)}`;
      if (cleanCode.length >= 6) return `${cleanCode.slice(0,4)}.${cleanCode.slice(4,6)}`;
      return cleanCode;
    case 'US':
      // XXXX.XX.XXXX
      if (cleanCode.length >= 10) return `${cleanCode.slice(0,4)}.${cleanCode.slice(4,6)}.${cleanCode.slice(6,10)}`;
      if (cleanCode.length >= 6) return `${cleanCode.slice(0,4)}.${cleanCode.slice(4,6)}`;
      return cleanCode;
    case 'EU':
      // XXXX.XX.XX
      if (cleanCode.length >= 8) return `${cleanCode.slice(0,4)}.${cleanCode.slice(4,6)}.${cleanCode.slice(6,8)}`;
      if (cleanCode.length >= 6) return `${cleanCode.slice(0,4)}.${cleanCode.slice(4,6)}`;
      return cleanCode;
    default:
      // XXXX.XX
      if (cleanCode.length >= 6) return `${cleanCode.slice(0,4)}.${cleanCode.slice(4,6)}`;
      return cleanCode;
  }
}

/**
 * Validate essential character analysis for composite products
 */
export function validateEssentialCharacterAnalysis(ecAnalysis) {
  if (!ecAnalysis || !ecAnalysis.components) {
    return { valid: false, errors: ['Missing essential_character_analysis or components'] };
  }
  
  if (ecAnalysis.components.length < 2) {
    return { valid: false, errors: ['Essential character requires at least 2 components for analysis'] };
  }
  
  let totalBulk = 0;
  let totalValue = 0;
  const errors = [];
  
  for (const comp of ecAnalysis.components) {
    if (!comp.name) errors.push(`Component missing name`);
    if (comp.bulk_percent === undefined) errors.push(`Component "${comp.name}" missing bulk_percent`);
    if (comp.value_percent === undefined) errors.push(`Component "${comp.name}" missing value_percent`);
    if (!comp.functional_role) errors.push(`Component "${comp.name}" missing functional_role`);
    
    totalBulk += comp.bulk_percent || 0;
    totalValue += comp.value_percent || 0;
  }
  
  if (totalBulk < 90 || totalBulk > 110) {
    errors.push(`Bulk percentages sum to ${totalBulk}%, expected ~100%`);
  }
  
  if (totalValue < 90 || totalValue > 110) {
    errors.push(`Value percentages sum to ${totalValue}%, expected ~100%`);
  }
  
  if (!ecAnalysis.essential_component) errors.push('Missing essential_component identification');
  if (!ecAnalysis.justification) errors.push('Missing justification for essential character');
  
  return {
    valid: errors.length === 0,
    errors,
    totals: { bulk: totalBulk, value: totalValue }
  };
}