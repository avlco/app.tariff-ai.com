import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
        }

        const { version, terms_content, privacy_content, change_summary } = await req.json();

        if (!version || !terms_content || !privacy_content) {
            return Response.json({ error: 'Version, terms content, and privacy content are required' }, { status: 400 });
        }

        // 1. Deactivate current active documents
        const activeDocs = await base44.entities.LegalDocumentVersion.filter({ is_active: true });
        
        // Use service role to ensure we can update
        const updatePromises = activeDocs.map(doc => 
            base44.asServiceRole.entities.LegalDocumentVersion.update(doc.id, { is_active: false })
        );
        await Promise.all(updatePromises);

        // 2. Create new active document
        const newDoc = await base44.asServiceRole.entities.LegalDocumentVersion.create({
            version_number: version,
            terms_content: terms_content,
            privacy_content: privacy_content,
            change_summary: change_summary || {},
            is_active: true,
            published_at: new Date().toISOString(),
            published_by: user.email
        });

        return Response.json({ success: true, document: newDoc });

    } catch (error) {
        console.error('Publish Legal Document Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});