/**
 * LLM Cross-Validation Utility
 * Provides second opinion using Claude for low-confidence classifications
 */

import Anthropic from 'npm:@anthropic-ai/sdk@^0.18.0';

// Helper to sanitize JSON response from LLM
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

export async function crossValidateWithClaude(originalPrompt, primaryResult) {
  const crossValidationPrompt = `
You are a CUSTOMS CLASSIFICATION EXPERT providing a SECOND OPINION.

═══════════════════════════════════════════════════════════════════
ORIGINAL CLASSIFICATION (by GPT-4o):
═══════════════════════════════════════════════════════════════════
HS Code: ${primaryResult.hs_code}
GRI Applied: ${primaryResult.gri_applied || primaryResult.gir_applied || 'Not specified'}
Confidence: ${primaryResult.confidence_score}

Key Reasoning:
${primaryResult.reasoning.substring(0, 2000)}

═══════════════════════════════════════════════════════════════════
YOUR TASK:
═══════════════════════════════════════════════════════════════════
1. Review the original classification
2. Apply GRI rules INDEPENDENTLY
3. Either CONFIRM or PROPOSE ALTERNATIVE

If you CONFIRM: Return the same HS code with brief explanation why you agree.
If you DISAGREE: Return your proposed HS code with detailed GRI analysis.

${originalPrompt.substring(0, 15000)}

RESPOND WITH JSON:
{
  "hs_code": "XXXX.XX.XX",
  "agrees_with_primary": true,
  "brief_reasoning": "..."
}
`;

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set for Claude cross-validation");

    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: crossValidationPrompt }]
    });
    
    const content = msg.content[0].text;
    const result = cleanJson(content);
    
    return {
      hs_code: result.hs_code,
      agrees: result.agrees_with_primary,
      reasoning: result.brief_reasoning
    };
  } catch (e) {
    throw new Error(`Cross-validation failed with Claude: ${e.message}`);
  }
}