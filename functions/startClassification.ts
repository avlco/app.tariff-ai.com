import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    let reportId = null;

    // Helper to log progress
    const logProgress = async (id, stage, message, status = 'success') => {
        try {
            // Fetch current log
            const reports = await base44.asServiceRole.entities.ClassificationReport.filter({ id });
            const currentLog = reports[0]?.processing_log || [];
            
            // Append new entry
            const newEntry = {
                timestamp: new Date().toISOString(),
                stage,
                message,
                status
            };
            
            await base44.asServiceRole.entities.ClassificationReport.update(id, {
                processing_log: [...currentLog, newEntry]
            });
        } catch (e) {
            console.error('Logging failed:', e);
        }
    };

    try {
        // Initialization
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await req.json();
        reportId = payload.reportId;
        const intendedUse = payload.intendedUse || payload.description; // fallback if needed

        if (!reportId) {
            return Response.json({ error: 'Report ID is required' }, { status: 400 });
        }

        await logProgress(reportId, 'initialization', 'Starting classification workflow');

        // Step 1: The Analyst (Agent A)
        await logProgress(reportId, 'analyst', 'Starting structural analysis (Agent A)');
        const analystRes = await base44.functions.invoke('agentAnalyze', { reportId });
        
        if (analystRes.data.status === 'waiting_for_user' || analystRes.data.status === 'insufficient_data') {
            await logProgress(reportId, 'analyst', 'Insufficient data, waiting for user', 'pending');
            return Response.json({
                success: true,
                status: 'waiting_for_user',
                action: 'input_required',
                question: analystRes.data.question
            });
        }
        await logProgress(reportId, 'analyst', 'Structural analysis completed');

        // Step 2: The Researcher (Agent B)
        await logProgress(reportId, 'researcher', 'Starting research (Agent B)');
        await base44.functions.invoke('agentResearch', { reportId });
        await logProgress(reportId, 'researcher', 'Research completed');

        // Step 3: The Judge (Agent C)
        await logProgress(reportId, 'judge', 'Starting classification (Agent C)');
        await base44.functions.invoke('agentJudge', { reportId, intendedUse });
        await logProgress(reportId, 'judge', 'Classification completed');

        // Step 4: The Regulator (Agent D)
        await logProgress(reportId, 'regulator', 'Calculating duties and regulations (Agent D)');
        await base44.functions.invoke('agentRegulate', { reportId });
        await logProgress(reportId, 'regulator', 'Regulations calculated');

        // Step 5: QA & Self-Healing Loop (Agent E)
        await logProgress(reportId, 'qa', 'Starting QA Audit (Agent E)');
        
        let attempts = 0;
        const maxAttempts = 2;
        let qaPassed = false;
        let qaAudit = null;

        while (attempts < maxAttempts) {
            const qaRes = await base44.functions.invoke('agentQA', { reportId });
            qaAudit = qaRes.data.audit;

            if (qaAudit.status === 'passed') {
                qaPassed = true;
                await logProgress(reportId, 'qa', `QA Passed with score ${qaAudit.score}`);
                break;
            }

            // Failed - Self Healing
            attempts++;
            const faultyAgent = qaAudit.faulty_agent?.toLowerCase();
            const instructions = qaAudit.fix_instructions;
            
            await logProgress(reportId, 'self-healing', `QA Failed. Triggering self-correction for ${faultyAgent}. Attempt ${attempts}/${maxAttempts}`, 'warning');

            if (faultyAgent.includes('judge') || faultyAgent.includes('classification')) {
                // Re-run Judge with feedback
                await base44.functions.invoke('agentJudge', { 
                    reportId, 
                    intendedUse, 
                    feedback: instructions 
                });
                
                // MUST re-run Regulator after Judge changes codes
                await base44.functions.invoke('agentRegulate', { reportId });
            } else if (faultyAgent.includes('regulator') || faultyAgent.includes('duties')) {
                // Re-run Regulator with feedback
                await base44.functions.invoke('agentRegulate', { 
                    reportId, 
                    feedback: instructions 
                });
            } else {
                // Unknown agent or generic failure, just retry Judge? 
                // Defaulting to re-run Judge as it's the most critical
                await base44.functions.invoke('agentJudge', { 
                    reportId, 
                    intendedUse, 
                    feedback: instructions 
                });
                await base44.functions.invoke('agentRegulate', { reportId });
            }
        }

        if (!qaPassed) {
             await logProgress(reportId, 'qa', 'QA Failed after max retries. Marking report as failed.', 'failed');
             // agentQA already sets status to 'failed' in DB if it fails, so we just return
             return Response.json({
                 success: false,
                 status: 'failed',
                 message: 'QA Check Failed',
                 audit: qaAudit
             });
        }

        // Finalization
        await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
            status: 'completed',
            processing_status: 'completed'
        });
        
        await logProgress(reportId, 'workflow', 'Classification workflow completed successfully');

        return Response.json({
            success: true,
            status: 'completed',
            report_id: reportId
        });

    } catch (error) {
        console.error('Orchestration Error:', error);
        
        if (reportId) {
            await logProgress(reportId, 'error', `Workflow crashed: ${error.message}`, 'failed');
            await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
                status: 'failed',
                processing_status: 'failed',
                error_details: error.message
            });
        }
        
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});