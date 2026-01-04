import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        const user = await base44.auth.me();
        if (!user || !user.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { version, user_agent: clientUA, ip_address: clientIP } = body;
        
        if (!version) return Response.json({ error: 'Version required' }, { status: 400 });

        const normalizedEmail = user.email.toLowerCase();
        const timestamp = new Date().toISOString();
        const ip = clientIP || req.headers.get("x-forwarded-for") || "unknown";
        const ua = clientUA || req.headers.get("user-agent") || "unknown";

        // 1. Audit Trail - Insert Immutable Record
        try {
            await base44.asServiceRole.entities.UserConsentLog.create({
                user_id: user.id || normalizedEmail,
                consent_version: version,
                accepted_at: timestamp,
                ip_address: ip,
                user_agent: ua,
                accepted_terms: true, // Enforced by UI flow
                accepted_privacy: true // Enforced by UI flow
            });
        } catch (logError) {
            console.error("Failed to create audit log:", logError);
            // We continue even if log fails, but ideally this should be atomic. 
            // For now, prioritising user flow but logging error.
        }

        // 2. State Sync - Update UserMasterData
        try {
            const records = await base44.asServiceRole.entities.UserMasterData.filter({ 
                user_email: normalizedEmail 
            });
            
            const updateData = {
                policy_accepted: true,
                policy_version: version,            // Legacy field support
                policy_accepted_date: timestamp,    // Legacy field support
                policy_version_accepted: version,   // New Audit field
                policy_accepted_at: timestamp,      // New Audit field
                last_login: timestamp
            };

            if (records.length > 0) {
                await base44.asServiceRole.entities.UserMasterData.update(records[0].id, updateData);
            } else {
                await base44.asServiceRole.entities.UserMasterData.create({
                    user_email: normalizedEmail,
                    full_name: user.user_metadata?.full_name || normalizedEmail.split('@')[0],
                    account_status: 'active',
                    role: 'user',
                    registration_date: timestamp,
                    ...updateData
                });
            }
        } catch (masterDataError) {
            console.error("Failed to update UserMasterData:", masterDataError);
            throw new Error(`Failed to update user record: ${masterDataError.message}`);
        }

        return Response.json({ success: true, version_accepted: version });

    } catch (error) {
        console.error('Policy Accept Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});