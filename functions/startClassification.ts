import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    let reportId = null;

    const logProgress = async (id, stage, message, status = 'success') => {
        try {
            const reports = await base44.asServiceRole.entities.ClassificationReport.filter({ id });
            const currentLog = reports[0]?.processing_log || [];
            await base44.asServiceRole.entities.ClassificationReport.update(id, {
                processing_log: [...currentLog, { timestamp: new Date().toISOString(), stage, message, status }]
            });
        } catch (e) { console.error('Logging failed:', e); }
    };

    try {
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { reportId: reqReportId, intendedUse, forceProceed } = await req.json();
        reportId = reqReportId;

        if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });

        await logProgress(reportId, 'initialization', 'Starting classification workflow');

        // Step 1: The Analyst (With Force Proceed override)
        await logProgress(reportId, 'analyst', 'Starting structural analysis (Agent A)');
        
        const analystRes = await base44.functions.invoke('agentAnalyze', { 
            reportId,
            forceProceed: forceProceed === true
        });
        
        // STOP only if clarification needed AND NOT forced
        if (analystRes.data.status === 'waiting_for_user') {
            await logProgress(reportId, 'analyst', 'Insufficient data, stopped for clarification', 'pending');
            return Response.json({
                success: true,
                status: 'waiting_for_user',
                action: 'stopped_for_clarification',
                question: analystRes.data.question
            });
        }
        await logProgress(reportId, 'analyst', 'Structural analysis completed');

        // Step 2: Researcher
        await logProgress(reportId, 'researcher', 'Starting research (Agent B)');
        await base44.functions.invoke('agentResearch', { reportId });

        // Step 3: Judge
        await logProgress(reportId, 'judge', 'Starting classification (Agent C)');
        await base44.functions.invoke('agentJudge', { reportId, intendedUse });

        // Step 4: Regulator
        await logProgress(reportId, 'regulator', 'Calculating duties (Agent D)');
        await base44.functions.invoke('agentRegulate', { reportId });

        // Step 5: QA
        await logProgress(reportId, 'qa', 'Starting QA Audit (Agent E)');
        const qaRes = await base44.functions.invoke('agentQA', { reportId });
        
        // --- FINALIZATION & NOTIFICATION ---

        if (qaRes.data.status !== 'failed') {
             await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
                status: 'completed',
                processing_status: 'completed'
            });

            // Create in-app notification
            try {
                await base44.functions.invoke('createNotification', {
                    type: 'report_completed',
                    titleHe: 'הדוח מוכן לצפייה',
                    titleEn: 'Report Ready',
                    messageHe: `הסיווג עבור הדוח #${reportId} הושלם בהצלחה`,
                    messageEn: `Classification for report #${reportId} completed successfully`,
                    priority: 'medium',
                    relatedEntityType: 'ClassificationReport',
                    relatedEntityId: reportId,
                    actionUrl: `/ReportView?id=${reportId}`,
                    actionLabelHe: 'צפה בדוח',
                    actionLabelEn: 'View Report',
                    expiresInHours: 168
                });
            } catch (notifErr) {
                console.error("Failed to create notification:", notifErr);
            }

            // Send Success Email
            try {
                if (user.email) {
                    const appUrl = Deno.env.get('PUBLIC_SITE_BASE_URL') || 'https://app.base44.com';
                    const reportLink = `${appUrl}/reports/view?id=${reportId}`;
                    // Attempt to extract HS code from QA result or fetch updated report (simplified here)
                    // We assume the agentJudge saved it, or we could fetch it. 
                    // For now, generic success message.
                    
                    await base44.integrations.Core.SendEmail({
                        to: user.email,
                        subject: `Classification Complete: Report #${reportId}`,
                        body: `
                            <h2>Your Report is Ready</h2>
                            <p>The classification process for report #${reportId} has successfully completed.</p>
                            <p><a href="${reportLink}" style="background-color: #42C0B9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Report</a></p>
                        `
                    });
                }
            } catch (emailErr) {
                console.error("Success email failed:", emailErr);
            }

        } else {
             // QA Failed -> Handled below or here if we want explicit email
             // Usually QA failure flows into the main catch if it throws, or we handle it here.
             // Based on code structure, if qaRes.data.status === 'failed', we consider it a soft failure or need logic.
             // Let's assume we want to notify failure too if it didn't throw.
             if (user.email) {
                 try {
                     await base44.integrations.Core.SendEmail({
                        to: user.email,
                        subject: `Classification Failed: Report #${reportId}`,
                        body: `The classification process encountered quality issues. Please check the dashboard for details.`
                    });
                 } catch(e) {}
             }
        }

        return Response.json({ success: true, status: 'completed', report_id: reportId });

    } catch (error) {
        console.error('Orchestration Error:', error);
        if (reportId) {
            await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
                status: 'failed',
                processing_status: 'failed',
                error_details: error.message
            });
            
            // Create failure notification
            try {
               await base44.functions.invoke('createNotification', {
                   type: 'report_failed',
                   titleHe: 'הסיווג נכשל',
                   titleEn: 'Classification Failed',
                   messageHe: `הסיווג עבור הדוח #${reportId} נכשל. נדרשת בדיקה`,
                   messageEn: `Classification for report #${reportId} failed. Review required`,
                   priority: 'high',
                   relatedEntityType: 'ClassificationReport',
                   relatedEntityId: reportId,
                   actionUrl: `/ReportView?id=${reportId}`,
                   actionLabelHe: 'צפה בפרטים',
                   actionLabelEn: 'View Details',
                   expiresInHours: 336
               });
            } catch (notifErr) {
               console.error("Failed to create notification:", notifErr);
            }

            // Send Failure Email
            try {
               if (user && user.email) {
                   await base44.integrations.Core.SendEmail({
                       to: user.email,
                       subject: `Classification Error: Report #${reportId}`,
                       body: `
                           <h2>Process Failed</h2>
                           <p>We encountered an error while processing your report.</p>
                           <p><strong>Error:</strong> ${error.message}</p>
                           <p>Please try again or contact support.</p>
                       `
                   });
               }
            } catch (emailErr) {
               console.error("Failure email failed:", emailErr);
            }
        }
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});