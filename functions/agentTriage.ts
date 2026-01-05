import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import OpenAI from 'npm:openai@^4.28.0';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { reportId } = await req.json();
        if (!reportId) return Response.json({ error: 'Report ID required' }, { status: 400 });

        const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
        const report = reports[0];
        
        if (!report || !report.structural_analysis) {
             return Response.json({ error: 'Report or analysis missing' }, { status: 400 });
        }

        const spec = report.structural_analysis;
        
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) return Response.json({ error: 'OpenAI API Key missing' }, { status: 500 });

        const openai = new OpenAI({ apiKey });

        const prompt = `
            You are a Senior Trade Compliance Officer performing initial risk assessment. Analyze the input product data.
            
            Product Name: ${spec.standardized_name}
            Function: ${spec.function}
            Material: ${spec.material_composition}
            Description: ${spec.essential_character || ''}
            
            Classification Criteria:
            - LOW Complexity: Simple consumer goods, textiles, standard furniture, simple foodstuff. (Output: complexity: 'low')
            - MEDIUM Complexity: Electronics, machinery, automotive parts, mixtures. (Output: complexity: 'medium')
            - HIGH Complexity: Chemicals (requires CAS), Medical devices, Dual-Use/Defense items, encryption tech. (Output: complexity: 'high')
            
            Output JSON Schema:
            {
              "complexity": "low" | "medium" | "high",
              "category": "string",
              "reasoning": "string"
            }
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;
        const result = JSON.parse(content);

        return Response.json(result);

    } catch (error) {
        console.error('Agent Triage Error:', error);
        // Default to medium if fails to be safe
        return Response.json({ 
            complexity: 'medium', 
            category: 'Error Fallback', 
            reasoning: 'Triage agent failed, defaulting to standard flow.' 
        });
    }
});