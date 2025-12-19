import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify admin access
        const currentUser = await base44.auth.me();
        if (!currentUser || currentUser.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
        }

        // Get all users from built-in User entity
        const users = await base44.asServiceRole.entities.User.list();
        
        // Get all classification reports
        const allReports = await base44.asServiceRole.entities.ClassificationReport.list();
        
        // Get all support tickets
        const allTickets = await base44.asServiceRole.entities.SupportTicket.list();
        
        const syncedUsers = [];
        
        for (const user of users) {
            // Calculate reports statistics for this user
            const userReports = allReports.filter(r => r.created_by === user.email);
            const completedReports = userReports.filter(r => r.status === 'completed').length;
            const pendingReports = userReports.filter(r => r.status === 'pending').length;
            const failedReports = userReports.filter(r => r.status === 'failed').length;
            
            // Get most recent report date
            const sortedReports = userReports.sort((a, b) => 
                new Date(b.created_date) - new Date(a.created_date)
            );
            const mostRecentReportDate = sortedReports.length > 0 ? sortedReports[0].created_date : null;
            
            // Calculate support tickets statistics
            const userTickets = allTickets.filter(t => t.created_by === user.email);
            const openTickets = userTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
            const resolvedTickets = userTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
            
            // Get most recent ticket date
            const sortedTickets = userTickets.sort((a, b) => 
                new Date(b.created_date) - new Date(a.created_date)
            );
            const lastTicketDate = sortedTickets.length > 0 ? sortedTickets[0].created_date : null;
            
            // Check if user already exists in UserMasterData
            const existingUserData = await base44.asServiceRole.entities.UserMasterData.filter({ 
                user_email: user.email 
            });
            
            const userData = {
                user_email: user.email,
                full_name: user.full_name || '',
                company_name: user.company_name || '',
                phone: user.phone || '',
                role: user.role || 'user',
                subscription_plan: user.subscription_plan || 'free',
                reports_used_this_month: user.reports_used_this_month || 0,
                total_reports_created: userReports.length,
                preferred_language: user.preferred_language || 'he',
                theme: user.theme || 'light',
                registration_date: user.created_date,
                last_login: user.last_login || user.created_date,
                account_status: 'active',
                activities: existingUserData[0]?.activities || [],
                sessions: existingUserData[0]?.sessions || [],
                reports_summary: {
                    total_reports: userReports.length,
                    completed_reports: completedReports,
                    pending_reports: pendingReports,
                    failed_reports: failedReports,
                    most_recent_report_date: mostRecentReportDate
                },
                support_tickets_summary: {
                    total_tickets: userTickets.length,
                    open_tickets: openTickets,
                    resolved_tickets: resolvedTickets,
                    last_ticket_date: lastTicketDate
                },
                billing_info: existingUserData[0]?.billing_info || {},
                notes: existingUserData[0]?.notes || ''
            };
            
            if (existingUserData.length > 0) {
                // Update existing record
                await base44.asServiceRole.entities.UserMasterData.update(
                    existingUserData[0].id,
                    userData
                );
            } else {
                // Create new record
                await base44.asServiceRole.entities.UserMasterData.create(userData);
            }
            
            syncedUsers.push(user.email);
        }
        
        return Response.json({
            success: true,
            message: `Successfully synced ${syncedUsers.length} users`,
            synced_users: syncedUsers
        });
        
    } catch (error) {
        console.error('Sync error:', error);
        return Response.json({ 
            error: error.message,
            details: error.stack
        }, { status: 500 });
    }
});