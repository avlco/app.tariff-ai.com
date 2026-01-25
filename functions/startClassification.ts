import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * startClassification - Entry point for classification workflow
 * 
 * TARIFF-AI 2.0: "Retrieve & Deduce" Architecture
 * ================================================
 * 
 * Agent Pipeline (in order):
 * 1. agentAnalyze - Product Analysis with Composite Detection
 * 2. agentResearch - Legal Text Retrieval from CountryTradeResource
 * 3. agentJudge - GIR Classification with Citation Protocol
 * 4. agentTax - Tax Rate Extraction with Source Citations
 * 5. agentCompliance - Compliance Requirements Extraction
 * 6. agentQA - Citation Validation & Retrieval Quality Audit
 * 
 * Delegates to Conversation-Based Orchestrator for intelligent,
 * confidence-driven decisions and self-healing with citation enforcement.
 * 
 * Legacy linear pipeline preserved as fallback.
 */

const USE_CONVERSATION_ORCHESTRATOR = true; // Toggle to switch between new and legacy

export default Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    let reportId = null;

    // Helper to log progress
    const logProgress = async (id, stage, message, status = 'success') => {
        try {
            const reports = await base44.asServiceRole.entities.ClassificationReport.filter({ id });
            const currentLog = reports[0]?.processing_log || [];
            await base44.asServiceRole.entities.ClassificationReport.update(id, {
                processing_log: [...currentLog, { timestamp: new Date().toISOString(), stage, message, status }]
            });
        } catch (e) {
            console.error('Logging failed:', e);
        }
    };

    try {
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await req.json();
        reportId = payload.reportId;
        const intendedUse = payload.intendedUse || payload.description;

        if (!reportId) {
            return Response.json({ error: 'Report ID is required' }, { status: 400 });
        }

        // === NEW: Use Conversation-Based Orchestrator ===
        if (USE_CONVERSATION_ORCHESTRATOR) {
            await logProgress(reportId, 'initialization', 'Starting Conversation-Based Classification (v2.0)');
            
            try {
                const result = await base44.functions.invoke('conversationOrchestrator', {
                    reportId,
                    intendedUse
                });
                
                return Response.json(result.data);
            } catch (orchestratorError) {
                console.error('Conversation Orchestrator failed, falling back to legacy:', orchestratorError);
                await logProgress(reportId, 'initialization', `Orchestrator failed: ${orchestratorError.message}, falling back to legacy pipeline`, 'warning');
                // Fall through to legacy pipeline
            }
        }

        // === LEGACY PIPELINE (Fallback) ===
        await logProgress(reportId, 'initialization', 'Starting legacy classification workflow');

        // Ping Check
        try {
            const pingRes = await base44.functions.invoke('ping');
            await logProgress(reportId, 'initialization', `System Ping: ${JSON.stringify(pingRes.data)}`);
        } catch (e) {
            await logProgress(reportId, 'initialization', `Ping failed: ${e.message}`, 'warning');
        }

        // Fetch Knowledge Base
        let knowledgeBase = null;
        try {
            const reportData = await base44.entities.ClassificationReport.filter({ id: reportId });
            if (reportData[0]?.destination_country) {
                 const kb = await base44.asServiceRole.entities.CountryKnowledgeBase.filter({ country: reportData[0].destination_country });
                 knowledgeBase = kb[0] || null;
            }
        } catch (e) {
             console.warn('KB fetch failed:', e);
        }

        // Step 1: Analyst
        await logProgress(reportId, 'analyst', 'Starting structural analysis (Agent A)');
        const analystRes = await base44.functions.invoke('agentAnalyze', { reportId, knowledgeBase });

        if (analystRes.data.status === 'waiting_for_user' || analystRes.data.status === 'insufficient_data') {
            return Response.json({ success: true, status: 'waiting_for_user', action: 'input_required', question: analystRes.data.question });
        }

        // Step 2: Researcher
        await logProgress(reportId, 'researcher', 'Starting research (Agent B)');
        await base44.functions.invoke('agentResearch', { reportId, knowledgeBase });

        // Step 3: Judge
        await logProgress(reportId, 'judge', 'Starting classification (Agent C)');
        await base44.functions.invoke('agentJudge', { reportId, intendedUse });

        // Step 4: Tax & Compliance
        await logProgress(reportId, 'tax', 'Calculating duties');
        await base44.functions.invoke('agentTax', { reportId, knowledgeBase });
        await base44.functions.invoke('agentCompliance', { reportId, knowledgeBase });

        // Step 5: QA Loop
        await logProgress(reportId, 'qa', 'Starting QA Audit');
        
        let attempts = 0;
        const maxAttempts = 3;
        let qaPassed = false;
        let qaAudit = null;

        while (attempts < maxAttempts) {
            const qaRes = await base44.functions.invoke('agentQA', { reportId });
            qaAudit = qaRes.data.audit;

            if (qaAudit.status === 'passed') {
                qaPassed = true;
                await logProgress(reportId, 'qa', `QA Passed with score ${qaAudit.score}/100`);
                break;
            }

            attempts++;
            const faultyAgent = qaAudit.faulty_agent?.toLowerCase() || '';
            const instructions = qaAudit.fix_instructions || '';

            await logProgress(reportId, 'self-healing', `QA Failed. Attempt ${attempts}/${maxAttempts}`, 'warning');

            if (faultyAgent.includes('analyst')) {
                await base44.functions.invoke('agentAnalyze', { reportId, knowledgeBase, feedback: instructions });
                await base44.functions.invoke('agentResearch', { reportId, knowledgeBase });
                await base44.functions.invoke('agentJudge', { reportId, intendedUse });
                await base44.functions.invoke('agentTax', { reportId, knowledgeBase });
                await base44.functions.invoke('agentCompliance', { reportId, knowledgeBase });
            } else if (faultyAgent.includes('research')) {
                await base44.functions.invoke('agentResearch', { reportId, knowledgeBase, feedback: instructions });
                await base44.functions.invoke('agentJudge', { reportId, intendedUse });
                await base44.functions.invoke('agentTax', { reportId, knowledgeBase });
                await base44.functions.invoke('agentCompliance', { reportId, knowledgeBase });
            } else {
                await base44.functions.invoke('agentJudge', { reportId, intendedUse, feedback: instructions });
                await base44.functions.invoke('agentTax', { reportId, knowledgeBase });
                await base44.functions.invoke('agentCompliance', { reportId, knowledgeBase });
            }
        }

        if (!qaPassed) {
             return Response.json({ success: false, status: 'failed', message: `QA Failed after ${maxAttempts} retries`, audit: qaAudit });
        }

        await base44.asServiceRole.entities.ClassificationReport.update(reportId, { status: 'completed', processing_status: 'completed' });
        await logProgress(reportId, 'workflow', 'Classification completed successfully');

        return Response.json({ success: true, status: 'completed', report_id: reportId });

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