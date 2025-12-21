import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { fileUrls } = await req.json();

        if (!fileUrls || fileUrls.length === 0) {
            return Response.json({ error: 'No files provided for analysis' }, { status: 400 });
        }

        // Build comprehensive prompt for LLM
        const llmPrompt = `You are an expert in international trade, customs classification, and logistics. Analyze the provided documents (invoices, packing lists, bills of lading, certificates, product images, etc.) and extract all relevant information for creating an international shipment record.

Your task:
1. Identify product details: description, characteristics, materials, purpose
2. Extract shipping information: origin, destination, incoterms, weight, volume, value
3. Classify the product with an HS code (Harmonized System) and provide detailed reasoning
4. Identify the customer/buyer from the documents (name, email, address)
5. Estimate duties, taxes, and shipping costs based on current regulations
6. List any import requirements or regulatory notes for the destination country

Be thorough and precise. Use internet context to access current tariff rates, HS code databases, and shipping cost estimates.`;

        const llmResponseSchema = {
            type: "object",
            properties: {
                customer_name: { type: "string", description: "Identified customer/buyer name" },
                customer_email: { type: "string", description: "Identified customer email if available" },
                shipment_description: { type: "string", description: "Clear description of shipment contents" },
                incoterms: { 
                    type: "string", 
                    enum: ["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FAS", "FOB", "CFR", "CIF"],
                    description: "Identified Incoterms from documents"
                },
                origin_country: { type: "string" },
                origin_city: { type: "string" },
                origin_port_airport: { type: "string" },
                destination_country: { type: "string" },
                destination_city: { type: "string" },
                destination_port_airport: { type: "string" },
                manufacture_country: { type: "string", description: "Country where product was manufactured" },
                total_product_value: { type: "number", description: "Total value in base currency" },
                currency: { type: "string", description: "Currency code (USD, EUR, etc.)" },
                total_weight_kg: { type: "number", description: "Total weight in kilograms" },
                total_volume_cbm: { type: "number", description: "Total volume in cubic meters" },
                hs_code: { type: "string", description: "6-10 digit HS code for the product" },
                classification_reasoning: { type: "string", description: "Detailed explanation of why this HS code was chosen" },
                product_characteristics: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "List of key product features/characteristics"
                },
                tariff_description: { type: "string", description: "Description of tariff rates and regulations" },
                import_requirements: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            title: { type: "string" },
                            description: { type: "string" }
                        }
                    },
                    description: "List of import requirements for destination country"
                },
                ai_analysis_summary: { type: "string", description: "Brief summary of analysis and key findings" },
                estimated_duties_and_taxes: {
                    type: "object",
                    properties: {
                        total_amount: { type: "number" },
                        currency: { type: "string" },
                        breakdown: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    type: { type: "string", description: "Type of duty/tax" },
                                    rate: { type: "string", description: "Rate percentage or amount" },
                                    amount: { type: "number" }
                                }
                            }
                        },
                        regulatory_notes: {
                            type: "array",
                            items: { type: "string" }
                        }
                    }
                },
                estimated_shipping_costs: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            carrier: { type: "string" },
                            service: { type: "string" },
                            estimated_cost: { type: "number" },
                            currency: { type: "string" },
                            estimated_transit_time: { type: "string" },
                            mode: { type: "string", enum: ["Air", "Sea", "Courier", "Land"] }
                        }
                    }
                },
                confidence_score: { type: "number", description: "Confidence in analysis (0-100)" }
            },
            required: ["shipment_description", "destination_country", "hs_code", "classification_reasoning"]
        };

        // Invoke LLM with uploaded files
        const llmResult = await base44.integrations.Core.InvokeLLM({
            prompt: llmPrompt,
            add_context_from_internet: true,
            response_json_schema: llmResponseSchema,
            file_urls: fileUrls
        });

        if (!llmResult) {
            return Response.json({ error: 'AI analysis failed' }, { status: 500 });
        }

        // Try to identify existing customer
        let customerId = null;
        let identifiedCustomer = null;

        if (llmResult.customer_name || llmResult.customer_email) {
            const customers = await base44.asServiceRole.entities.Customer.list();
            
            // Try to match by email first (most reliable)
            if (llmResult.customer_email) {
                const match = customers.find(c => 
                    c.email?.toLowerCase() === llmResult.customer_email.toLowerCase()
                );
                if (match) customerId = match.id;
            }
            
            // If no email match, try by name
            if (!customerId && llmResult.customer_name) {
                const match = customers.find(c => 
                    c.customer_name?.toLowerCase().includes(llmResult.customer_name.toLowerCase()) ||
                    llmResult.customer_name.toLowerCase().includes(c.customer_name?.toLowerCase())
                );
                if (match) customerId = match.id;
            }

            // If customer not found, prepare data for potential creation
            if (!customerId) {
                identifiedCustomer = {
                    customer_name: llmResult.customer_name,
                    email: llmResult.customer_email
                };
            }
        }

        // Build shipment data object
        const shipmentData = {
            customer_id: customerId,
            description: llmResult.shipment_description,
            incoterms: llmResult.incoterms,
            origin: {
                country: llmResult.origin_country,
                city: llmResult.origin_city,
                port_airport_name: llmResult.origin_port_airport || ""
            },
            destination: {
                country: llmResult.destination_country,
                city: llmResult.destination_city,
                port_airport_name: llmResult.destination_port_airport || ""
            },
            manufacture_country: llmResult.manufacture_country,
            total_product_value: llmResult.total_product_value,
            currency: llmResult.currency || 'USD',
            total_weight: {
                value: llmResult.total_weight_kg,
                unit: 'kg'
            },
            total_volume: {
                value: llmResult.total_volume_cbm,
                unit: 'cbm'
            },
            hs_code: llmResult.hs_code,
            classification_reasoning: llmResult.classification_reasoning,
            product_characteristics: llmResult.product_characteristics || [],
            tariff_description: llmResult.tariff_description,
            import_requirements: llmResult.import_requirements || [],
            ai_analysis_summary: llmResult.ai_analysis_summary,
            estimated_duties_and_taxes: llmResult.estimated_duties_and_taxes,
            estimated_shipping_costs: llmResult.estimated_shipping_costs || [],
            uploaded_documents: fileUrls.map(url => ({
                file_url: url,
                file_name: url.split('/').pop(),
                file_type: url.split('.').pop(),
                analysis_status: 'processed'
            })),
            confidence_score: llmResult.confidence_score
        };

        return Response.json({
            status: "success",
            shipmentData: shipmentData,
            identifiedCustomer: identifiedCustomer,
            customerId: customerId
        });

    } catch (error) {
        console.error("Error in aiAnalyzeShipment:", error);
        return Response.json({ 
            error: error.message,
            details: error.toString()
        }, { status: 500 });
    }
});