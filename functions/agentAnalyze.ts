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
  console.log(`[LLM Gateway - Analyst] Using Claude Sonnet 4`);
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
        max_tokens: 8192,
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
  const startTime = Date.now();
  console.log('[AgentAnalyze] ═══════════════════════════════════════════');
  console.log('[AgentAnalyze] Starting Product Analysis (TARIFF-AI 2.0)');
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { reportId, knowledgeBase, feedback, conversationContext } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });
    
    console.log(`[AgentAnalyze] Report: ${reportId}`);
    if (feedback) console.log(`[AgentAnalyze] Feedback received: ${feedback.substring(0, 100)}...`);
    if (conversationContext) console.log(`[AgentAnalyze] Conversation round: ${conversationContext.round}, focus: ${conversationContext.focus}`);
    
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });
    
    console.log(`[AgentAnalyze] Product: ${report.product_name}, Destination: ${report.destination_country}`);
    
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
COMPOSITE GOODS DETECTION & ESSENTIAL CHARACTER (GRI 3 Analysis):
═══════════════════════════════════════════════════════════════════

**STEP 1: Is this a COMPOSITE GOOD?**

A composite good exists when:
• Multiple materials are physically combined (e.g., wood + steel furniture)
• Multiple components form a set (e.g., first-aid kit)
• Multiple items sold together as one SKU (e.g., laptop + charger + case)
• The product spans multiple potential HS headings

Classification: 
- is_composite: true/false
- composite_type: "mixture" | "set" | "combined_article" | "retail_set" | "single_component"

**STEP 2: ESSENTIAL CHARACTER MATRIX (if composite)**

Analyze EACH component using the WCO Essential Character factors:

| Factor | Component A | Component B | Component C |
|--------|-------------|-------------|-------------|
| Value % | | | |
| Weight/Bulk % | | | |
| Functional Role | primary/secondary/auxiliary | | |
| User Perception | "What would buyer call this?" | | |
| Marketing Emphasis | | | |

**STEP 3: ESSENTIAL CHARACTER DETERMINATION**

Apply WCO criteria in order:
1. NATURE OF THE MATERIAL - what material dominates by nature?
2. BULK/QUANTITY - which component is largest by volume/weight?
3. VALUE - which component represents most of the cost?
4. ROLE IN RELATION TO USE - which component is essential for the intended use?

Conclusion format:
"Essential Character: [COMPONENT NAME] because it provides [VALUE/BULK/FUNCTION] dominance ([X]% of total). 
Without [COMPONENT], the product would not function as a [PRODUCT TYPE]."

**STEP 4: GRI PATH PREDICTION**

Based on composite analysis:
- GRI 1: Unambiguous single-heading product
- GRI 2(a): Incomplete/unfinished goods
- GRI 2(b): Mixtures/combinations
- GRI 3(a): Most specific description wins
- GRI 3(b): Essential character determines heading
- GRI 3(c): Last in numerical order
- GRI 4: Most akin goods
- GRI 5: Packaging
- GRI 6: Subheading level

Example Analysis:
Product: "Gaming laptop with external GPU dock, sold as bundle"
Components:
1. Laptop: 70% value, 40% weight, primary data processing
2. GPU Dock: 25% value, 55% weight, enhances graphics processing
3. Cables: 5% value, 5% weight, connectivity

Essential Character Matrix:
- Value dominance: Laptop (70%)
- Bulk dominance: GPU Dock (55%)
- Functional role: Laptop is PRIMARY (can work standalone)
- User perception: "Gaming laptop" (not "GPU dock with laptop")

ESSENTIAL CHARACTER: LAPTOP
GRI Path: GRI 3(b) → Classify by laptop (Chapter 84)
Reasoning: Laptop provides primary function; GPU dock is accessory

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
SEARCH QUERY GENERATION (Multi-Lingual):
═══════════════════════════════════════════════════════════════════

Generate targeted search queries in MULTIPLE LANGUAGES for research phase:

1. **English (International)** - Always include
   Format: "[product type] HS classification [specific attribute]"
   Example: "laptop computer HS classification data processing machine"

2. **Destination Country Language** - Required
   For Israel: Hebrew queries
   For EU: English + French/German if relevant
   For China: Simplified Chinese + English
   
   Example for Israel destination:
   - Hebrew: "מחשב נייד סיווג מכס קוד HS"
   - Hebrew: "ציוד עיבוד נתונים אוטומטי פרק 84"

3. **WCO/Trade Terms** - Technical queries
   Format: "[HS heading] explanatory notes [product feature]"
   Example: "8471 explanatory notes portable computer"

Query Categories:
- hs_search_queries: Direct HS lookup queries
- legal_notes_queries: Explanatory notes searches
- precedent_queries: BTI/ruling searches
- country_specific_queries: National tariff queries

═══════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS:
═══════════════════════════════════════════════════════════════════

Return JSON with:
- status: "success" or "insufficient_data"
- If insufficient: specific question in user's language
- If success: complete technical_spec with industry-specific details
- ALWAYS include search_queries object for research phase
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
                        },
                        components_breakdown: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    material: { type: "string" },
                                    value_percent: { type: "number" },
                                    weight_percent: { type: "number" },
                                    function: { type: "string", enum: ["primary", "secondary", "auxiliary"] }
                                }
                            },
                            description: "Component breakdown for composite goods (required for GRI 3(b) analysis)"
                        },
                        readiness_score: {
                            type: "number",
                            description: "Data completeness score 0-100"
                        },
                        suggested_hs_code: {
                            type: "string",
                            description: "Initial 4-digit HS heading suggestion based on analysis (e.g., '8471')"
                        }
                    },
                    description: "Complete technical specification - only if status is success"
                },
                composite_analysis: {
                    type: "object",
                    properties: {
                        is_composite: {
                            type: "boolean",
                            description: "True if product consists of multiple materials/components"
                        },
                        composite_type: {
                            type: "string",
                            enum: ["single_component", "mixture", "set", "combined_article", "retail_set"],
                            description: "Type of composite if applicable"
                        },
                        essential_character_component: {
                            type: "string",
                            description: "Name of component providing essential character"
                        },
                        essential_character_reasoning: {
                            type: "string",
                            description: "Detailed reasoning citing value/bulk/function dominance"
                        },
                        essential_character_factors: {
                            type: "object",
                            properties: {
                                value_dominant: { type: "string" },
                                bulk_dominant: { type: "string" },
                                function_dominant: { type: "string" },
                                user_perception: { type: "string" }
                            }
                        }
                    },
                    description: "Composite goods analysis per WCO guidelines"
                },
                industry_category: {
                    type: "string",
                    description: "HS Chapter range and name (e.g., 'Chapter 84-85: Machinery and Electrical Equipment')"
                },
                classification_guidance_notes: {
                    type: "string",
                    description: "Initial guidance for classifier (e.g., 'Check if telecom is primary function vs. data processing')"
                },
                potential_gir_path: {
                    type: "string",
                    enum: ["GRI_1", "GRI_2a", "GRI_2b", "GRI_3a", "GRI_3b", "GRI_3c", "GRI_4", "GRI_5", "GRI_6"],
                    description: "Likely GIR rule needed for classification"
                },
                search_queries: {
                    type: "object",
                    properties: {
                        hs_search_queries: {
                            type: "array",
                            items: { type: "string" },
                            description: "Queries for HS code lookup (English)"
                        },
                        legal_notes_queries: {
                            type: "array",
                            items: { type: "string" },
                            description: "Queries for Explanatory Notes"
                        },
                        precedent_queries: {
                            type: "array",
                            items: { type: "string" },
                            description: "Queries for BTI/WCO rulings"
                        },
                        country_specific_queries: {
                            type: "array",
                            items: { type: "string" },
                            description: "Queries in destination country language"
                        }
                    },
                    description: "Multi-lingual search queries for research phase"
                }
            },
            required: ["status"]
        },
        base44_client: base44
    });

    const duration = Date.now() - startTime;
    console.log(`[AgentAnalyze] LLM call completed in ${duration}ms`);
    
    if (result.status === 'insufficient_data') {
        console.log(`[AgentAnalyze] ⚠️ Insufficient data - asking user: ${result.missing_info_question?.substring(0, 80)}...`);
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
        
        // Send notification to user about missing information
        try {
            await base44.functions.invoke('sendUserNotification', {
                userEmail: user.email,
                type: 'clarification_needed',
                reportId: reportId,
                reportName: report.product_name || 'Classification Report',
                question: result.missing_info_question,
                sendEmail: true
            });
        } catch (notifError) {
            console.error('Failed to send notification:', notifError);
        }
        
        console.log(`[AgentAnalyze] ═══════════════════════════════════════════`);
        return Response.json({ success: true, status: 'waiting_for_user', question: result.missing_info_question });
    } else {
        // Enrich technical_spec with composite analysis and search queries
        const enrichedSpec = {
            ...result.technical_spec,
            composite_analysis: result.composite_analysis || { is_composite: false, composite_type: 'single_component' },
            search_queries: result.search_queries || {},
            industry_category: result.industry_category,
            potential_gir_path: result.potential_gir_path,
            classification_guidance_notes: result.classification_guidance_notes
        };
        
        // Log analysis results
        console.log(`[AgentAnalyze] ✓ Analysis complete:`);
        console.log(`[AgentAnalyze]   - Standardized name: ${enrichedSpec.standardized_name}`);
        console.log(`[AgentAnalyze]   - Industry: ${enrichedSpec.industry_category}`);
        console.log(`[AgentAnalyze]   - Composite: ${enrichedSpec.composite_analysis?.is_composite ? 'YES - ' + enrichedSpec.composite_analysis.composite_type : 'NO'}`);
        console.log(`[AgentAnalyze]   - Essential character: ${enrichedSpec.essential_character || 'N/A'}`);
        console.log(`[AgentAnalyze]   - GIR path prediction: ${enrichedSpec.potential_gir_path || 'GRI_1'}`);
        console.log(`[AgentAnalyze]   - Readiness score: ${enrichedSpec.readiness_score || 'N/A'}`);
        console.log(`[AgentAnalyze]   - Duration: ${duration}ms`);
        console.log(`[AgentAnalyze] ═══════════════════════════════════════════`);
        
        await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
            processing_status: 'analyzing_completed',
            structural_analysis: enrichedSpec
        });
        
        return Response.json({ 
            success: true, 
            status: 'analyzing_completed', 
            spec: enrichedSpec,
            composite_detected: result.composite_analysis?.is_composite || false,
            gir_path: result.potential_gir_path,
            duration_ms: duration
        });
    }

  } catch (error) {
    console.error('[AgentAnalyze] ❌ ERROR:', error.message);
    console.error('[AgentAnalyze] Stack:', error.stack);
    console.log(`[AgentAnalyze] ═══════════════════════════════════════════`);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});