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
    
    // Get current date for LLM context
    const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    // Update status
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'qa_pending'
    });
    
    // Perform quality assurance
    const qaPrompt = `
CURRENT DATE: ${today}

You are a quality assurance expert for customs classification reports.

Review the following classification report for accuracy, consistency, and completeness:

REPORT DATA:
${JSON.stringify(report, null, 2)}

CRITICAL INSTRUCTIONS:
1. Today's date is ${today}. Any dates on or before this date are NOT in the future.
2. Distinguish between CRITICAL FAILURES and QUALITY IMPROVEMENTS:
   - CRITICAL FAILURES: Missing HS code, invalid format, completely wrong classification, processing errors
   - QUALITY IMPROVEMENTS: Minor details missing, could be more explicit, suggestions for better wording

QUALITY CHECKS:
1. Is the HS code present and in a valid format?
2. Is the classification reasoning clear and well-supported?
3. Are the alternative classifications relevant and explained?
4. Is the tariff information present?
5. Are import requirements documented?
6. Are all dates valid (not in the future relative to ${today})?

Provide:
- is_failed: true ONLY if there are CRITICAL FAILURES (missing HS code, invalid data, processing error)
- is_failed: false if the report is complete and usable, even if there are quality improvement suggestions
- quality_score: Overall score (0-100)
- qa_notes: List of quality improvement suggestions (e.g., "Classification reasoning could be more explicit", "Country of origin details could be expanded")
- critical_errors: List ONLY truly critical errors that prevent the report from being used
`;
    
    const qaResult = await base44.integrations.Core.InvokeLLM({
      prompt: qaPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          is_failed: { 
            type: "boolean",
            description: "True only if there are critical failures that prevent the report from being used"
          },
          quality_score: { type: "number" },
          qa_notes: {
            type: "array",
            items: { type: "string" },
            description: "Quality improvement suggestions, not critical errors"
          },
          critical_errors: {
            type: "array",
            items: { type: "string" },
            description: "Only truly critical errors"
          }
        }
      }
    });
    
    // Determine final status based on is_failed flag from LLM
    const finalStatus = qaResult.is_failed ? 'failed' : 'completed';
    
    // Prepare error details only if truly failed
    const errorDetails = finalStatus === 'failed' && qaResult.critical_errors?.length > 0
      ? `שגיאות קריטיות: ${qaResult.critical_errors.join(', ')}`
      : undefined;
    
    // Update report with final status and QA notes
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: finalStatus,
      status: finalStatus,
      qa_notes: qaResult.qa_notes || [],
      ...(errorDetails && { error_details: errorDetails })
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
    try {
      const body = await req.json();
      if (body.reportId) {
        await base44.asServiceRole.entities.ClassificationReport.update(body.reportId, {
          processing_status: 'failed',
          status: 'failed',
          error_details: error.message || 'שגיאה לא צפויה ביצירת הדוח הסופי'
        });
      }
    } catch (e) {
      // Ignore if can't parse request body
    }
    
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});