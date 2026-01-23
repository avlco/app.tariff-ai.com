import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Anthropic from 'npm:@anthropic-ai/sdk@^0.18.0';

// --- INLINED GATEWAY LOGIC (ANALYST SPECIFIC) ---

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
  console.log(`[LLM Gateway - Analyst] Using Claude Sonnet 4.5`);
  const jsonInstruction = response_schema 
    ? `\n\nCRITICAL: Return the output EXCLUSIVELY in valid JSON format matching this schema:\n${JSON.stringify(response_schema, null, 2)}` 
    : '';
  const fullPrompt = prompt + jsonInstruction;

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
        model: "claude-sonnet-4.5",
        max_tokens: 8192, // High context window support
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

// --- END INLINED GATEWAY ---

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { reportId, knowledgeBase } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });
    
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });
    
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'analyzing_data'
    });
    
    const context = `
Product Name: ${report.product_name}
Country of Manufacture: ${report.country_of_manufacture}
Country of Origin: ${report.country_of_origin}
Destination Country: ${report.destination_country}

User Input:
${report.user_input_text || 'No text description provided.'}

Files/Links:
${JSON.stringify(report.uploaded_file_urls || [])}
${JSON.stringify(report.external_link_urls || [])}

Chat History:
${JSON.stringify(report.chat_history || [])}
`;

    const kbContext = knowledgeBase ? `
Knowledge Base for ${knowledgeBase.country}:
HS Structure: ${knowledgeBase.hs_code_structure}
Customs Links: ${knowledgeBase.customs_links}
` : '';

    const systemPrompt = `
You are a FORENSIC PRODUCT ANALYST specializing in customs classification preparation.

YOUR TASK: Transform raw user input into a STANDARDIZED TECHNICAL SPECIFICATION suitable for HS classification.

═══════════════════════════════════════════════════════════════════
INDUSTRY-SPECIFIC ANALYSIS FRAMEWORK:
═══════════════════════════════════════════════════════════════════

Based on initial product description, identify the industry sector:

**Chapter 1-24: FOOD, BEVERAGES, TOBACCO**
If food/beverage, determine:
• Processing level (raw, processed, preserved)
• Preservation method (fresh, frozen, dried, canned)
• Composition percentages (sugar %, fat %, protein %)
• Edibility (fit for human consumption?)

**Chapter 25-27: MINERALS, FUELS**
If mineral/fuel, determine:
• Purity/concentration percentage
• Chemical form (oxide, carbonate, etc.)
• Origin (natural vs. synthetic)

**Chapter 28-38: CHEMICALS**
If chemical, determine:
• CAS Registry Number (if available)
• Chemical formula
• Purity percentage
• Form (liquid, solid, gas, powder)
• Intended use (industrial, pharmaceutical, agricultural)
• Mixture vs. single compound

**Chapter 39-40: PLASTICS, RUBBER**
If plastic/rubber, determine:
• Polymer type (polyethylene, PVC, polypropylene)
• Form (raw material, semi-finished, finished article)
• Primary form (blocks, sheets, film, rods)
• Cellular vs. non-cellular

**Chapter 50-63: TEXTILES**
If textile, determine:
• Fiber composition by weight (e.g., 60% cotton, 40% polyester)
• Yarn vs. fabric vs. made-up article
• Woven, knitted, or non-woven
• Weight per m² (if fabric)
• Bleached, dyed, printed, or grey

**Chapter 64-67: FOOTWEAR, HEADGEAR, LEATHER**
If footwear/leather, determine:
• Outer sole material
• Upper material
• Type (covering ankle or not)

**Chapter 68-71: STONE, CERAMICS, GLASS, PRECIOUS STONES**
If stone/glass/jewelry, determine:
• Material (granite, marble, glass)
• Worked vs. unworked
• For jewelry: precious vs. semi-precious

**Chapter 72-83: METALS (BASE METALS)**
If metal article, determine:
• Metal type (iron, steel, aluminum, copper)
• Form (ingot, wire, sheet, tube, finished article)
• Alloy composition
• Worked vs. unworked

**Chapter 84-85: MACHINERY, ELECTRICAL EQUIPMENT**
If machinery/electronics, determine:
• Primary function (data processing, telecommunications, industrial machinery)
• Power source (electric, battery, manual)
• Voltage/Power rating
• Automatic vs. manual
• For computers: CPU type, RAM, storage
• For electronics: Wireless capabilities (WiFi, Bluetooth, Cellular)
• Certifications (CE, FCC, UL)

**Chapter 86-89: VEHICLES, TRANSPORTATION**
If vehicle/transport, determine:
• Type (road, rail, air, water)
• Engine type (electric, gasoline, diesel, hybrid)
• Cylinder capacity
• Gross vehicle weight
• Passenger vs. cargo

**Chapter 90-92: OPTICAL, MEDICAL, MUSICAL INSTRUMENTS**
If instruments, determine:
• Precision/accuracy specifications
• Intended use (medical, laboratory, industrial)
• Optical vs. electronic

**Chapter 93-97: ARMS, FURNITURE, TOYS, ART**
Specific to category

═══════════════════════════════════════════════════════════════════
ESSENTIAL CHARACTER DETERMINATION (Critical for GRI 3(b)):
═══════════════════════════════════════════════════════════════════

For composite goods (multiple materials/components):

Analyze EACH component:
1. Component name
2. Material
3. % of total value (estimate if unknown)
4. % of total weight/bulk
5. Function it provides

Then determine Essential Character by:
• Which component gives the product its FUNDAMENTAL identity?
• If sold without component X, would it still be this product?
• What is the PRIMARY commercial purpose?

Example:
Product: "Gaming laptop in carrying case, sold together"
Components:
1. Laptop: 95% value, 80% weight, data processing function
2. Case: 5% value, 20% weight, protection function
Essential Character: LAPTOP → Classification direction: Chapter 84

═══════════════════════════════════════════════════════════════════
FAIL-FAST with GUIDED QUESTIONS:
═══════════════════════════════════════════════════════════════════

If information is insufficient:

Step 1: Attempt inference from context
Example: "Laptop" → Can infer it's electronics, Chapter 84/85

Step 2: Generate industry-specific targeted questions (in user's language)
Example for electronics: "What is the primary function? Data processing, telecommunications, or entertainment?"

Step 3: Only return "insufficient_data" if truly cannot proceed

Questions should be SPECIFIC, not generic:
✓ "What is the exact fiber composition by weight percentage?" (textiles)
✓ "Is this a woven or knitted fabric?" (textiles)
✓ "What is the CAS number or chemical formula?" (chemicals)
✓ "What is the primary function: data processing or telecommunications?" (electronics)

✗ "Can you provide more details?" (too vague)

═══════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS:
═══════════════════════════════════════════════════════════════════

Return JSON with:
- status: "success" or "insufficient_data"
- If insufficient: specific question in user's language
- If success: complete technical_spec with industry-specific details
`;

    const fullPrompt = `${systemPrompt}\n\nINPUT DATA:\n${context}\n${kbContext}`;

    const result = await invokeSpecializedLLM({
        prompt: fullPrompt,
        task_type: 'analysis',
        response_schema: {
            type: "object",
            properties: {
                status: {
                    type: "string",
                    enum: ["success", "insufficient_data"],
                    description: "success if enough info, insufficient_data if critical info missing"
                },
                missing_info_question: {
                    type: "string",
                    description: "Specific question in user's language (Hebrew/English) to get missing info - ONLY if status is insufficient_data"
                },
                technical_spec: {
                    type: "object",
                    properties: {
                        standardized_name: {
                            type: "string",
                            description: "Precise product name (e.g., 'Portable automatic data processing machine' not just 'laptop')"
                        },
                        material_composition: {
                            type: "string",
                            description: "Detailed breakdown with percentages if composite (e.g., '60% cotton, 40% polyester')"
                        },
                        function: {
                            type: "string",
                            description: "PRIMARY function, then secondary functions"
                        },
                        state: {
                            type: "string",
                            description: "Physical state: liquid/solid/gas/powder/frozen/etc."
                        },
                        essential_character: {
                            type: "string",
                            description: "For composite goods: which component/material gives essential character and WHY (cite value/bulk/function)"
                        },
                        industry_specific_data: {
                            type: "object",
                            description: "Industry-specific details - adapt fields based on product type",
                            properties: {
                                cpu: { type: "string" },
                                ram: { type: "string" },
                                wireless_capabilities: { type: "string" },
                                fiber_composition: { type: "string" },
                                weight_per_m2: { type: "string" },
                                cas_number: { type: "string" },
                                purity: { type: "string" },
                                polymer_type: { type: "string" },
                                voltage: { type: "string" },
                                power_rating: { type: "string" }
                            }
                        }
                    },
                    description: "Complete technical specification - only if status is success"
                },
                industry_category: {
                    type: "string",
                    description: "HS Chapter range and name (e.g., 'Chapter 84-85: Machinery and Electrical Equipment')"
                },
                classification_guidance_notes: {
                    type: "string",
                    description: "Initial guidance for classifier (e.g., 'Check if telecom is primary function vs. data processing')"
                }
            },
            required: ["status"]
        },
        base44_client: base44
    });

    if (result.status === 'insufficient_data') {
        await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
            status: 'waiting_for_user',
            processing_status: 'waiting_for_user',
            missing_info_question: result.missing_info_question,
            chat_history: [
                ...(report.chat_history || []),
                {
                    role: 'assistant',
                    content: result.missing_info_question,
                    timestamp: new Date().toISOString()
                }
            ]
        });
        return Response.json({ success: true, status: 'waiting_for_user', question: result.missing_info_question });
    } else {
        await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
            processing_status: 'analyzing_completed',
            structural_analysis: result.technical_spec
        });
        return Response.json({ success: true, status: 'analyzing_completed', spec: result.technical_spec });
    }

  } catch (error) {
    console.error('Agent A (Analyst) Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});