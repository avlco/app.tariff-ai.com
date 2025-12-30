import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        const user = await base44.auth.me();
        if (!user || !user.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const email = user.email.toLowerCase();
        
        // 1. Try to find by Email (Standardizing to lowercase)
        const records = await base44.asServiceRole.entities.UserMasterData.filter({ 
            user_email: email 
        });
        
        const timestamp = new Date().toISOString();
        
        if (records.length > 0) {
            // FOUND: Update the existing record
            const recordId = records[0].id;
            console.log(`Updating existing user record: ${recordId}`);
            
            await base44.asServiceRole.entities.UserMasterData.update(recordId, {
                policy_accepted: true,
                policy_accepted_date: timestamp,
                last_login: timestamp
            });
        } else {
            // NOT FOUND: Create new record
            console.log(`Creating new record for: ${email}`);
            
            await base44.asServiceRole.entities.UserMasterData.create({
                user_email: email,
                policy_accepted: true,
                policy_accepted_date: timestamp,
                full_name: user.full_name || email.split('@')[0],
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