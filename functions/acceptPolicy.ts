import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export default Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        const user = await base44.auth.me();
        if (!user || !user.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { version_number, ip_address, user_agent, accepted_terms, accepted_privacy } = await req.json();
        
        if (!version_number) {
            return Response.json({ error: 'Version number required' }, { status: 400 });
        }

        const normalizedEmail = user.email.toLowerCase();
        const timestamp = new Date().toISOString();
        const isFullyAccepted = accepted_terms && accepted_privacy;

        // 1. Find or Create UserMasterData
        const records = await base44.asServiceRole.entities.UserMasterData.filter({ 
            user_email: normalizedEmail 
        });
        
        if (records.length > 0) {
            await base44.asServiceRole.entities.UserMasterData.update(records[0].id, {
                policy_accepted: isFullyAccepted,
                policy_accepted_date: timestamp,
                policy_version: version_number,
                last_login: timestamp
            });
        } else {
            await base44.asServiceRole.entities.UserMasterData.create({
                user_email: normalizedEmail,
                policy_accepted: isFullyAccepted,
                policy_accepted_date: timestamp,
                policy_version: version_number,
                full_name: user.user_metadata?.full_name || normalizedEmail.split('@')[0],
                account_status: 'active',
                role: 'user',
                registration_date: timestamp
            });
        }

        // 2. Create Consent Log
        await base44.asServiceRole.entities.UserConsentLog.create({
            user_id: user.id,
            version_number: version_number,
            accepted_terms: !!accepted_terms,
            accepted_privacy: !!accepted_privacy,
            accepted_at: timestamp,
            ip_address: ip_address || 'unknown',
            user_agent: user_agent || 'unknown'
        });

        return Response.json({ success: true, version_accepted: version_number });

    } catch (error) {
        console.error('Policy Accept Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});