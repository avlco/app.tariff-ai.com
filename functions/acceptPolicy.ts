import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        const user = await base44.auth.me();
        if (!user || !user.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { version } = await req.json(); // Accept specific version from client
        if (!version) return Response.json({ error: 'Version required' }, { status: 400 });

        const normalizedEmail = user.email.toLowerCase();
        const timestamp = new Date().toISOString();

        // 1. Search existing record (Service Role bypasses RLS)
        const records = await base44.asServiceRole.entities.UserMasterData.filter({ 
            user_email: normalizedEmail 
        });
        
        if (records.length > 0) {
            // Update: Set Accepted = true AND save the specific version
            await base44.asServiceRole.entities.UserMasterData.update(records[0].id, {
                policy_accepted: true,
                policy_accepted_date: timestamp,
                policy_version: version, // Critical for audit trail
                last_login: timestamp
            });
        } else {
            // Create New
            await base44.asServiceRole.entities.UserMasterData.create({
                user_email: normalizedEmail,
                policy_accepted: true,
                policy_accepted_date: timestamp,
                policy_version: version,
                full_name: user.user_metadata?.full_name || normalizedEmail.split('@')[0],
                account_status: 'active',
                role: 'user',
                registration_date: timestamp
            });
        }

        return Response.json({ success: true, version_accepted: version });

    } catch (error) {
        console.error('Policy Accept Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});