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

        // Verify report exists before proceeding
        console.log(`[startClassification] Looking for report with id: ${reportId}`);
        const existingReports = await base44.entities.ClassificationReport.filter({ id: reportId });
        if (!existingReports || existingReports.length === 0) {
            console.error(`[startClassification] Report not found: ${reportId}`);
            return Response.json({ error: `Report not found: ${reportId}` }, { status: 404 });
        }
        console.log(`[startClassification] Found report: ${existingReports[0].product_name}`);

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

        // === LEGACY PIPELINE (Fallback) - TARIFF-AI 2.0 ENHANCED ===
        await logProgress(reportId, 'initialization', 'Starting legacy classification workflow (Retrieve & Deduce v2.0)');

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

        // Step 1: Analyst (with Composite Analysis)
        await logProgress(reportId, 'analyst', 'Starting structural analysis with composite detection (Agent Analyze)');
        const analystRes = await base44.functions.invoke('agentAnalyze', { reportId, knowledgeBase });

        if (analystRes.data.status === 'waiting_for_user' || analystRes.data.status === 'insufficient_data') {
            return Response.json({ success: true, status: 'waiting_for_user', action: 'input_required', question: analystRes.data.question });
        }
        
        // Log composite detection
        if (analystRes.data.composite_detected) {
            await logProgress(reportId, 'analyst', `Composite product detected: ${analystRes.data.gir_path || 'GRI_3b likely'}`);
        }

        // Step 2: Researcher (with Legal Text Retrieval)
        await logProgress(reportId, 'researcher', 'Starting legal text retrieval from CountryTradeResource (Agent Research)');
        const researchRes = await base44.functions.invoke('agentResearch', { reportId, knowledgeBase });
        
        // Log retrieval quality
        const retrievalSummary = researchRes.data?.retrieval_summary || {};
        await logProgress(reportId, 'researcher', `Retrieved ${retrievalSummary.official_sources_used || 0} official sources, legal text: ${retrievalSummary.legal_text_available ? 'YES' : 'NO'}`);

        // Step 3: Judge (with Citation Protocol)
        await logProgress(reportId, 'judge', 'Starting GIR classification with citation protocol (Agent Judge)');
        const judgeRes = await base44.functions.invoke('agentJudge', { reportId, intendedUse, enforceHierarchy: true });
        
        // Log citation count
        const citationCount = judgeRes.data?.results?.primary?.legal_citations?.length || 0;
        await logProgress(reportId, 'judge', `Classification complete with ${citationCount} legal citations`);

        // Step 4: Tax & Compliance (with Source Extraction)
        await logProgress(reportId, 'tax', 'Extracting duty rates with source citations (Agent Tax)');
        await base44.functions.invoke('agentTax', { reportId, knowledgeBase });
        
        await logProgress(reportId, 'compliance', 'Extracting compliance requirements with source citations (Agent Compliance)');
        await base44.functions.invoke('agentCompliance', { reportId, knowledgeBase });

        // Step 5: QA Loop (with Citation Validation)
        await logProgress(reportId, 'qa', 'Starting QA Audit with citation validation');
        
        let attempts = 0;
        const maxAttempts = 3;
        let qaPassed = false;
        let qaAudit = null;

        while (attempts < maxAttempts) {
            const qaRes = await base44.functions.invoke('agentQA', { reportId });
            qaAudit = qaRes.data.audit;
            
            // Log retrieval quality score
            const retrievalScore = qaRes.data.retrieval_metadata?.retrieval_quality_score || qaAudit?.retrieval_quality_score;
            if (retrievalScore) {
                await logProgress(reportId, 'qa', `Retrieval quality score: ${retrievalScore}/100`);
            }

            if (qaAudit.status === 'passed') {
                qaPassed = true;
                await logProgress(reportId, 'qa', `QA Passed with score ${qaAudit.score}/100, R&D compliant: ${qaAudit.retrieve_deduce_compliant ? 'YES' : 'NO'}`);
                break;
            }

            attempts++;
            const faultyAgent = qaAudit.faulty_agent?.toLowerCase() || '';
            const instructions = qaAudit.fix_instructions || '';
            const issueType = qaAudit.issues_found?.[0]?.type || 'unknown';

            await logProgress(reportId, 'self-healing', `QA Failed (${issueType}). Attempt ${attempts}/${maxAttempts}`, 'warning');

            // TARIFF-AI 2.0: Enhanced self-healing based on issue type
            if (issueType.includes('citation') || issueType.includes('no_citations')) {
                // Citation issues - re-run Judge with citation enforcement
                await logProgress(reportId, 'self-healing', 'Re-running Judge with citation enforcement');
                await base44.functions.invoke('agentJudge', { reportId, intendedUse, feedback: instructions, enforceHierarchy: true, enforceCitations: true });
                await base44.functions.invoke('agentTax', { reportId, knowledgeBase });
                await base44.functions.invoke('agentCompliance', { reportId, knowledgeBase });
            } else if (issueType.includes('tax_no_citation') || issueType.includes('tax_data_gap')) {
                // Tax extraction issues - re-run Tax
                await logProgress(reportId, 'self-healing', 'Re-running Tax agent with source enforcement');
                await base44.functions.invoke('agentTax', { reportId, knowledgeBase, feedback: instructions });
            } else if (issueType.includes('compliance_no_context')) {
                // Compliance extraction issues - re-run Compliance
                await logProgress(reportId, 'self-healing', 'Re-running Compliance agent with source enforcement');
                await base44.functions.invoke('agentCompliance', { reportId, knowledgeBase, feedback: instructions });
            } else if (faultyAgent.includes('analyst') || issueType.includes('essential_character')) {
                await logProgress(reportId, 'self-healing', 'Re-running full pipeline from Analyst');
                await base44.functions.invoke('agentAnalyze', { reportId, knowledgeBase, feedback: instructions });
                await base44.functions.invoke('agentResearch', { reportId, knowledgeBase });
                await base44.functions.invoke('agentJudge', { reportId, intendedUse, enforceHierarchy: true, enforceCitations: true });
                await base44.functions.invoke('agentTax', { reportId, knowledgeBase });
                await base44.functions.invoke('agentCompliance', { reportId, knowledgeBase });
            } else if (faultyAgent.includes('research') || issueType.includes('legal_context')) {
                await logProgress(reportId, 'self-healing', 'Re-running from Research with expanded search');
                await base44.functions.invoke('agentResearch', { reportId, knowledgeBase, feedback: instructions, expandSearch: true });
                await base44.functions.invoke('agentJudge', { reportId, intendedUse, enforceHierarchy: true, enforceCitations: true });
                await base44.functions.invoke('agentTax', { reportId, knowledgeBase });
                await base44.functions.invoke('agentCompliance', { reportId, knowledgeBase });
            } else {
                // Default: re-run Judge with feedback and citation enforcement
                await logProgress(reportId, 'self-healing', 'Re-running Judge with feedback');
                await base44.functions.invoke('agentJudge', { reportId, intendedUse, feedback: instructions, enforceHierarchy: true, enforceCitations: true });
                await base44.functions.invoke('agentTax', { reportId, knowledgeBase });
                await base44.functions.invoke('agentCompliance', { reportId, knowledgeBase });
            }
        }

        if (!qaPassed) {
             return Response.json({ success: false, status: 'failed', message: `QA Failed after ${maxAttempts} retries`, audit: qaAudit });
        }

        await base44.asServiceRole.entities.ClassificationReport.update(reportId, { status: 'completed', processing_status: 'completed' });
        await logProgress(reportId, 'workflow', 'Classification completed successfully (Retrieve & Deduce v2.0)');

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