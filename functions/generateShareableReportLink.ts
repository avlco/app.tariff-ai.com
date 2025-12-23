import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user has premium subscription
    const isPremium = ['pay_per_use', 'basic', 'pro', 'agency', 'enterprise'].includes(user.subscription_plan);
    if (!isPremium) {
      return Response.json({ error: 'Premium subscription required' }, { status: 403 });
    }
    
    const { reportId } = await req.json();
    
    if (!reportId) {
      return Response.json({ error: 'Report ID is required' }, { status: 400 });
    }
    
    // Get the report to verify it exists and user has access
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }
    
    // Check ownership
    if (report.created_by !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Generate unique token
    const token = crypto.randomUUID();
    
    // Calculate expiry date (7 days from now)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);
    
    // Create shareable record
    await base44.asServiceRole.entities.ShareableReport.create({
      token,
      report_id: reportId,
      expiry_date: expiryDate.toISOString(),
      created_by_email: user.email
    });
    
    // Generate share URL
    const shareUrl = `https://app.tariff-ai.com/PublicReportView?token=${token}`;
    
    return Response.json({
      success: true,
      shareUrl,
      expiryDate: expiryDate.toISOString()
    });
    
  } catch (error) {
    console.error('Error generating shareable link:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});