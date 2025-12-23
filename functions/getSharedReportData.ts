import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { token } = await req.json();
    
    if (!token) {
      return Response.json({ error: 'Token is required' }, { status: 400 });
    }
    
    // Find shareable record using service role (no auth needed for public access)
    const shareableRecords = await base44.asServiceRole.entities.ShareableReport.filter({ token });
    const shareableRecord = shareableRecords[0];
    
    if (!shareableRecord) {
      return Response.json({ error: 'Invalid or expired link' }, { status: 404 });
    }
    
    // Check if token has expired
    const now = new Date();
    const expiryDate = new Date(shareableRecord.expiry_date);
    
    if (now > expiryDate) {
      return Response.json({ error: 'Link has expired' }, { status: 410 });
    }
    
    // Get the report using service role
    const reports = await base44.asServiceRole.entities.ClassificationReport.filter({ 
      id: shareableRecord.report_id 
    });
    const report = reports[0];
    
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }
    
    return Response.json({
      success: true,
      report
    });
    
  } catch (error) {
    console.error('Error getting shared report:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});