import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { reportId } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });
    
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });
    
    // Check ownership
    if (report.created_by !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    // Generate Local Token
    const token = crypto.randomUUID();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7); // Valid for 7 days
    
    // Create ShareableReport record locally
    await base44.asServiceRole.entities.ShareableReport.create({
        token: token,
        report_id: reportId,
        expiry_date: expiryDate.toISOString(),
        created_by: user.email
    });

    // Construct Public URL using configured domain
    const baseUrl = Deno.env.get('PUBLIC_SITE_BASE_URL') || 'https://test.tariff-ai.com';
    const shareUrl = `${baseUrl}/PublicReport?token=${token}`;

    // Update report with the new link (for cache/UI display)
    await base44.entities.ClassificationReport.update(reportId, {
      public_share_url: shareUrl,
      public_share_expires_at: expiryDate.toISOString()
    });

    return Response.json({
      success: true,
      shareUrl: shareUrl,
      expiryDate: expiryDate.toISOString(),
      cached: false
    });
    
  } catch (error) {
    console.error('Error generating shareable link:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});