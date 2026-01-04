import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        // Public endpoint, but arguably we might want to check auth. 
        // For now, allowing public read of the policy seems appropriate or checking for user.
        // If strict, we can add: await base44.auth.me();

        const activeDocs = await base44.entities.LegalDocumentVersion.filter({ is_active: true });
        
        const latestDoc = activeDocs.length > 0 ? activeDocs[0] : null;

        return Response.json(latestDoc);

    } catch (error) {
        console.error('Get Latest Legal Document Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});