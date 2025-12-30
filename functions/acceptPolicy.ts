import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        const user = await base44.auth.me();
        if (!user || !user.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // FIX: Normalize email to prevent duplicates/mismatches
        const normalizedEmail = user.email.toLowerCase();

        // Search using Service Role (Bypass RLS)
        const records = await base44.asServiceRole.entities.UserMasterData.filter({ 
            user_email: normalizedEmail 
        });
        
        const timestamp = new Date().toISOString();
        
        if (records.length > 0) {
            // Update existing record
            await base44.asServiceRole.entities.UserMasterData.update(records[0].id, {
                policy_accepted: true,
                policy_accepted_date: timestamp
            });
        } else {
            // Create new record
            // FIX: Use correct schema fields (full_name, account_status)
            await base44.asServiceRole.entities.UserMasterData.create({
                user_email: normalizedEmail,
                policy_accepted: true,
                policy_accepted_date: timestamp,
                full_name: user.user_metadata?.full_name || normalizedEmail.split('@')[0],
                account_status: 'active',
                role: 'user'
            });
        }

        return Response.json({ success: true });

    } catch (error) {
        console.error('Policy Accept Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});