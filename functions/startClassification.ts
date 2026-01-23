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

        // Ping Check
        try {
            await logProgress(reportId, 'initialization', 'Pinging system...');
            const pingRes = await base44.functions.invoke('ping');
            await logProgress(reportId, 'initialization', `System Ping: ${JSON.stringify(pingRes.data)}`);
        } catch (e) {
            await logProgress(reportId, 'initialization', `Ping failed: ${e.message}`, 'warning');
        }

        // Fetch Knowledge Base
        let knowledgeBase = null;
        try {
            // Need to fetch report to get destination country
            const reportData = await base44.entities.ClassificationReport.filter({ id: reportId });
            if (reportData[0]?.destination_country) {
                 const kb = await base44.asServiceRole.entities.CountryKnowledgeBase.filter({ country: reportData[0].destination_country });
                 knowledgeBase = kb[0] || null;
                 if(knowledgeBase) await logProgress(reportId, 'initialization', `Knowledge Base found for ${reportData[0].destination_country}`);
            }
        } catch (e) {
             console.warn('KB fetch failed:', e);
        }

        // Step 1: The Analyst (Agent A) - Enhanced with industry-specific analysis
        await logProgress(reportId, 'analyst', 'Starting enhanced structural analysis (Agent A) - Industry-specific frameworks');
        const analystRes = await base44.functions.invoke('agentAnalyze', { reportId, knowledgeBase });

        if (analystRes.data.status === 'waiting_for_user' || analystRes.data.status === 'insufficient_data') {
            await logProgress(reportId, 'analyst', 'Insufficient data, waiting for user', 'pending');
            return Response.json({
                success: true,
                status: 'waiting_for_user',
                action: 'input_required',
                question: analystRes.data.question
            });
        }
        await logProgress(reportId, 'analyst', 'Structural analysis completed with industry-specific details');

        // Step 2: The Researcher (Agent B) - Enhanced with hierarchical search
        await logProgress(reportId, 'researcher', 'Starting comprehensive research (Agent B) - Hierarchical HS search + WCO precedents');
        const researchRes = await base44.functions.invoke('agentResearch', { reportId, knowledgeBase });
        const candidateCount = researchRes.data?.findings?.candidate_headings?.length || 0;
        const wcoCount = researchRes.data?.findings?.wco_precedents?.length || 0;
        await logProgress(reportId, 'researcher', `Research completed. Found ${candidateCount} candidate headings and ${wcoCount} WCO precedents`);

        // Step 3: The Judge (Agent C) - Enhanced with GRI framework
        await logProgress(reportId, 'judge', 'Starting GRI-based classification (Agent C) - Applying GRI 1-6 framework');
        const judgeRes = await base44.functions.invoke('agentJudge', { reportId, intendedUse });
        const griUsed = judgeRes.data?.results?.primary?.gri_applied || 'GRI';
        const judgeConfidence = judgeRes.data?.results?.primary?.confidence_score || 0;
        await logProgress(reportId, 'judge', `Classification completed using ${griUsed} with confidence ${judgeConfidence}`);

        // Step 4: Tax & Compliance (Agent Tax & Agent Compliance)
        await logProgress(reportId, 'tax', 'Calculating duties (Agent Tax)');
        await base44.functions.invoke('agentTax', { reportId, knowledgeBase });
        await logProgress(reportId, 'tax', 'Duties calculated');

        await logProgress(reportId, 'compliance', 'Checking compliance (Agent Compliance)');
        await base44.functions.invoke('agentCompliance', { reportId, knowledgeBase });
        await logProgress(reportId, 'compliance', 'Compliance checks completed');

        // Step 5: QA & Self-Healing Loop (Agent F)
        await logProgress(reportId, 'qa', 'Starting comprehensive QA Audit (Agent F) - GRI validation + EN alignment');

        let attempts = 0;
        const maxAttempts = 3; // Increased from 2 to 3 for better self-correction
        let qaPassed = false;
        let qaAudit = null;

        while (attempts < maxAttempts) {
            const qaRes = await base44.functions.invoke('agentQA', { reportId });
            qaAudit = qaRes.data.audit;

            if (qaAudit.status === 'passed') {
                qaPassed = true;
                await logProgress(reportId, 'qa', `QA Passed with holistic score ${qaAudit.score}/100`);
                break;
            }

            // Failed - Enhanced Self Healing
            attempts++;
            const faultyAgent = qaAudit.faulty_agent?.toLowerCase() || '';
            const instructions = qaAudit.fix_instructions || 'No specific instructions provided';

            await logProgress(reportId, 'self-healing', `QA Failed (Score: ${qaAudit.score}). Issue: ${instructions.substring(0, 100)}... Attempt ${attempts}/${maxAttempts}`, 'warning');

            // Enhanced self-healing with specific agent feedback
            if (faultyAgent.includes('analyst') || faultyAgent.includes('technical')) {
                await logProgress(reportId, 'self-healing', 'Re-running Analyst with feedback');
                await base44.functions.invoke('agentAnalyze', { reportId, knowledgeBase, feedback: instructions });
                // Re-run downstream agents
                await base44.functions.invoke('agentResearch', { reportId, knowledgeBase });
                await base44.functions.invoke('agentJudge', { reportId, intendedUse });
                await base44.functions.invoke('agentTax', { reportId, knowledgeBase });
                await base44.functions.invoke('agentCompliance', { reportId, knowledgeBase });
            } else if (faultyAgent.includes('research')) {
                await logProgress(reportId, 'self-healing', 'Re-running Researcher with feedback');
                await base44.functions.invoke('agentResearch', { reportId, knowledgeBase, feedback: instructions });
                // Re-run dependent agents
                await base44.functions.invoke('agentJudge', { reportId, intendedUse });
                await base44.functions.invoke('agentTax', { reportId, knowledgeBase });
                await base44.functions.invoke('agentCompliance', { reportId, knowledgeBase });
            } else if (faultyAgent.includes('judge') || faultyAgent.includes('classification')) {
                await logProgress(reportId, 'self-healing', 'Re-running Judge with feedback (GRI correction)');
                // Re-run Judge with feedback
                await base44.functions.invoke('agentJudge', {
                    reportId,
                    intendedUse,
                    feedback: instructions
                });

                // MUST re-run Tax & Compliance after Judge changes codes
                await base44.functions.invoke('agentTax', { reportId, knowledgeBase });
                await base44.functions.invoke('agentCompliance', { reportId, knowledgeBase });
            } else if (faultyAgent.includes('tax') || faultyAgent.includes('duties')) {
                await logProgress(reportId, 'self-healing', 'Re-running Tax Agent with feedback');
                await base44.functions.invoke('agentTax', { reportId, knowledgeBase, feedback: instructions });
            } else if (faultyAgent.includes('compliance') || faultyAgent.includes('regulatory')) {
                await logProgress(reportId, 'self-healing', 'Re-running Compliance Agent with feedback');
                await base44.functions.invoke('agentCompliance', { reportId, knowledgeBase, feedback: instructions });
            } else {
                // Unknown agent - re-run Judge as default (most likely culprit)
                await logProgress(reportId, 'self-healing', 'Unknown faulty agent, defaulting to Judge re-run');
                await base44.functions.invoke('agentJudge', {
                    reportId,
                    intendedUse,
                    feedback: instructions
                });
                await base44.functions.invoke('agentTax', { reportId, knowledgeBase });
                await base44.functions.invoke('agentCompliance', { reportId, knowledgeBase });
            }
        }

        if (!qaPassed) {
             await logProgress(reportId, 'qa', `QA Failed after ${maxAttempts} attempts. Final score: ${qaAudit.score}/100. Issue: ${qaAudit.fix_instructions}`, 'failed');
             // agentQA already sets status to 'failed' in DB if it fails, so we just return
             return Response.json({
                 success: false,
                 status: 'failed',
                 message: `QA Check Failed after ${maxAttempts} retries`,
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