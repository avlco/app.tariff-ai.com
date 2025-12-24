import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Authenticate User
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const email = user.email;
        const userId = user.id;

        // 2. Delete UserMasterData Record
        const userMasterRecords = await base44.asServiceRole.entities.UserMasterData.filter({ user_email: email });
        for (const record of userMasterRecords) {
            await base44.asServiceRole.entities.UserMasterData.delete(record.id);
        }

        // 3. Delete or Deactivate Auth User
        // Note: Deleting the auth user might not be directly supported via standard entity delete if it's a system entity.
        // We will try to delete it via service role. If that fails, we can assume manual cleanup or soft delete.
        try {
            await base44.asServiceRole.entities.User.delete(userId);
        } catch (e) {
            console.error("Failed to delete auth user entity:", e);
            // If we can't delete, we might want to update status if possible, or just proceed since MasterData is gone.
            // But the requirement is to delete the account.
            return Response.json({ error: "Failed to delete user account system record" }, { status: 500 });
        }

        return Response.json({ success: true, message: "Account deleted successfully" });

    } catch (error) {
        console.error("Delete account error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});