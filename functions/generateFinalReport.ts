import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { reportId } = await req.json();
    
    if (!reportId) {
      return Response.json({ error: 'Report ID is required' }, { status: 400 });
    }
    
    // Get the report
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }
    
    // Update status
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'qa_pending'
    });
    
    // Perform quality assurance
    const qaPrompt = `
You are a quality assurance expert for customs classification reports.

Review the following classification report for accuracy, consistency, and completeness:

REPORT DATA:
${JSON.stringify(report, null, 2)}

QUALITY CHECKS:
1. Is the HS code format correct for the destination country?
2. Is the classification reasoning clear and well-supported?
3. Are the alternative classifications relevant and explained?
4. Is the tariff information accurate and complete?
5. Are all import requirements properly documented?
6. Are official sources credible and accessible?
7. Is the confidence score justified?

Provide:
- Overall quality score (0-100)
- List of any issues found
- Suggestions for improvement
- Final approval status (approved/needs_revision)
`;
    
    const qaResult = await base44.integrations.Core.InvokeLLM({
      prompt: qaPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          quality_score: { type: "number" },
          issues: {
            type: "array",
            items: { type: "string" }
          },
          suggestions: {
            type: "array",
            items: { type: "string" }
          },
          approval_status: {
            type: "string",
            enum: ["approved", "needs_revision"]
          }
        }
      }
    });
    
    // Determine final status
    const finalStatus = qaResult.approval_status === 'approved' && qaResult.quality_score >= 70
      ? 'completed'
      : 'failed';
    
    // Update report with final status
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: finalStatus,
      status: finalStatus
    });
    
    // Update user statistics
    if (finalStatus === 'completed') {
      const userDataList = await base44.asServiceRole.entities.UserMasterData.filter({
        user_email: user.email
      });
      
      if (userDataList.length > 0) {
        const userData = userDataList[0];
        await base44.asServiceRole.entities.UserMasterData.update(userData.id, {
          reports_used_this_month: (userData.reports_used_this_month || 0) + 1,
          total_reports_created: (userData.total_reports_created || 0) + 1
        });
      }
    }
    
    return Response.json({
      success: true,
      qaResult,
      finalStatus,
      message: `Report ${finalStatus === 'completed' ? 'completed successfully' : 'failed quality checks'}`
    });
    
  } catch (error) {
    console.error('Error generating final report:', error);
    
    // Update report status to failed
    if (req.json) {
      const { reportId } = await req.json();
      if (reportId) {
        await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
          processing_status: 'failed',
          status: 'failed'
        });
      }
    }
    
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});