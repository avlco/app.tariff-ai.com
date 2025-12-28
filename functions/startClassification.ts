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

        const payload = await req.json();
        reportId = payload.reportId;
        const intendedUse = payload.intendedUse;

        if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });

        await logProgress(reportId, 'initialization', 'Starting classification workflow');

        // Fetch Knowledge Base
        let knowledgeBase = null;
        try {
            const reportData = await base44.entities.ClassificationReport.filter({ id: reportId });
            if (reportData[0]?.destination_country) {
                 const kb = await base44.asServiceRole.entities.CountryKnowledgeBase.filter({ country: reportData[0].destination_country });
                 knowledgeBase = kb[0] || null;
                 if(knowledgeBase) await logProgress(reportId, 'initialization', `Knowledge Base found for ${reportData[0].destination_country}`);
            }
        } catch (e) { console.warn('KB fetch failed:', e); }

        // Step 1: Agent A (Analyst)
        await logProgress(reportId, 'analyst', 'Starting structural analysis (Agent A)');
        const analystRes = await base44.functions.invoke('agentAnalyze', { reportId, knowledgeBase });
        if (analystRes.data.status === 'waiting_for_user') {
            return Response.json({ success: true, status: 'waiting_for_user', question: analystRes.data.question });
        }

        // Step 2: Agent B (Researcher)
        await logProgress(reportId, 'researcher', 'Starting research (Agent B)');
        await base44.functions.invoke('agentResearch', { reportId, knowledgeBase });

        // Step 3: Agent C (Judge)
        await logProgress(reportId, 'judge', 'Starting classification (Agent C)');
        await base44.functions.invoke('agentJudge', { reportId, intendedUse });

        // Step 4: Tax & Compliance (Parallel)
        await logProgress(reportId, 'tax', 'Calculating duties & compliance');
        await Promise.all([
            base44.functions.invoke('agentTax', { reportId, knowledgeBase }),
            base44.functions.invoke('agentCompliance', { reportId, knowledgeBase })
        ]);

        // Step 5: QA & Self-Healing
        await logProgress(reportId, 'qa', 'Starting QA Audit');
        let attempts = 0;
        let qaPassed = false;
        let qaAudit = null;

        while (attempts < 2) {
            const qaRes = await base44.functions.invoke('agentQA', { reportId });
            qaAudit = qaRes.data.audit;

            if (qaAudit.status === 'passed') {
                qaPassed = true;
                break;
            }

            attempts++;
            const faultyAgent = qaAudit.faulty_agent?.toLowerCase() || 'general';
            const instructions = qaAudit.fix_instructions;
            await logProgress(reportId, 'self-healing', `QA Failed. Retrying ${faultyAgent}. Attempt ${attempts}/2`, 'warning');

            if (faultyAgent.includes('judge') || faultyAgent.includes('classification') || faultyAgent === 'general') {
                await base44.functions.invoke('agentJudge', { reportId, intendedUse, feedback: instructions });
                // Re-run downstream agents because HS code might have changed
                await Promise.all([
                    base44.functions.invoke('agentTax', { reportId, knowledgeBase }),
                    base44.functions.invoke('agentCompliance', { reportId, knowledgeBase })
                ]);
            } else if (faultyAgent.includes('tax')) {
                await base44.functions.invoke('agentTax', { reportId, knowledgeBase, feedback: instructions });
            } else if (faultyAgent.includes('compliance')) {
                await base44.functions.invoke('agentCompliance', { reportId, knowledgeBase, feedback: instructions });
            }
        }

        // Finalize
        await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
            status: 'completed',
            processing_status: 'completed',
            qa_audit: qaAudit
        });

        return Response.json({ success: true, status: 'completed', report_id: reportId });

    } catch (error) {
        console.error('Orchestration Error:', error);
        if (reportId) {
            await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
                status: 'failed', 
                error_details: error.message
            });
        }
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});