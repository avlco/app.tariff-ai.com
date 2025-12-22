import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { reportId, spreadsheetId } = await req.json();
    
    if (!reportId) {
      return Response.json({ error: 'Report ID is required' }, { status: 400 });
    }
    
    // Execute classification workflow
    // Step 1: Initialize and process input
    const initResult = await base44.asServiceRole.functions.invoke('initializeReportProcessing', {
      reportId
    });
    
    if (!initResult.data.success) {
      throw new Error('Failed to initialize report processing');
    }
    
    // Step 2: Perform HS classification
    const classifyResult = await base44.asServiceRole.functions.invoke('performHsClassification', {
      reportId,
      spreadsheetId: spreadsheetId || null
    });
    
    if (!classifyResult.data.success) {
      throw new Error('Failed to perform HS classification');
    }
    
    // Step 3: Calculate duties and regulations
    const dutiesResult = await base44.asServiceRole.functions.invoke('calculateDutiesAndRegulations', {
      reportId,
      spreadsheetId: spreadsheetId || null
    });
    
    if (!dutiesResult.data.success) {
      throw new Error('Failed to calculate duties');
    }
    
    // Step 4: Generate final report and QA
    const finalResult = await base44.asServiceRole.functions.invoke('generateFinalReport', {
      reportId
    });
    
    if (!finalResult.data.success) {
      throw new Error('Failed to generate final report');
    }
    
    return Response.json({
      success: true,
      message: 'Classification workflow completed successfully',
      reportId,
      finalStatus: finalResult.data.finalStatus
    });
    
  } catch (error) {
    console.error('Error in classification workflow:', error);
    
    // Update report status to failed
    const { reportId } = await req.json();
    if (reportId) {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
        processing_status: 'failed',
        status: 'failed'
      });
    }
    
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});