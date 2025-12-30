import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Search for existing record
        const records = await base44.asServiceRole.entities.UserMasterData.filter({ user_email: user.email });
        
        const timestamp = new Date().toISOString();
        
        if (records.length > 0) {
            // Update existing
            await base44.asServiceRole.entities.UserMasterData.update(records[0].id, {
                policy_accepted: true,
                policy_accepted_date: timestamp
            });
        } else {
            // Create new record for new user
            await base44.asServiceRole.entities.UserMasterData.create({
                user_email: user.email,
                policy_accepted: true,
                policy_accepted_date: timestamp,
                full_name: user.full_name || user.email.split('@')[0], // Fallback name
                role: 'user',
                account_status: 'active'
            });
        }

        return Response.json({ success: true });

    } catch (error) {
        console.error('Policy Accept Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});