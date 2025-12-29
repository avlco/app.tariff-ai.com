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
        
        if (qaRes.data.status !== 'failed') {
             await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
                status: 'completed',
                processing_status: 'completed'
            });
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
        }
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});