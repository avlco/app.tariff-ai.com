import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        // Security Check: Allow if Admin User OR if correct Admin Secret Header is present
        const user = await base44.auth.me().catch(() => null);
        const adminSecret = req.headers.get('x-admin-secret');
        const envAdminSecret = Deno.env.get('ADMIN_ACTION_SECRET'); // Optional: Set this in secrets if needed

        const isAdminUser = user && user.role === 'admin';
        const isSecretValid = envAdminSecret && adminSecret === envAdminSecret;

        if (!isAdminUser && !isSecretValid) {
            return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
        }

        const { version_number, terms_content, privacy_content, change_summary } = await req.json();

        if (!version_number || !terms_content || !privacy_content) {
            return Response.json({ error: 'version_number, terms_content, and privacy_content are required' }, { status: 400 });
        }

        // 1. Deactivate current active documents
        const activeDocs = await base44.entities.LegalDocumentVersion.filter({ is_active: true });
        
        // Use service role to ensure we can update regardless of RLS (though logic is usually admin anyway)
        const updatePromises = activeDocs.map(doc => 
            base44.asServiceRole.entities.LegalDocumentVersion.update(doc.id, { is_active: false })
        );
        await Promise.all(updatePromises);

        // 2. Create new active document
        const newDoc = await base44.asServiceRole.entities.LegalDocumentVersion.create({
            version_number,
            terms_content,
            privacy_content,
            change_summary: change_summary || {},
            is_active: true,
            published_at: new Date().toISOString(),
            published_by: user?.email || 'system'
        });

        return Response.json({ success: true, document: newDoc });

    } catch (error) {
        console.error('Publish Legal Document Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});