import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // 1. Authentication & Authorization
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const isPremium = ['pay_per_use', 'basic', 'pro', 'agency', 'enterprise'].includes(user.subscription_plan);
    if (!isPremium) return Response.json({ error: 'Premium subscription required' }, { status: 403 });
    
    const { reportId } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID is required' }, { status: 400 });
    
    // 2. Fetch Report
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    
    if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });
    
    if (report.created_by !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    // 3. SMART CACHING CHECK
    // Check if we already have a valid link that hasn't expired
    if (report.public_share_url && report.public_share_expires_at) {
        const expiresAt = new Date(report.public_share_expires_at);
        const now = new Date();
        
        // If link is valid for at least another hour, return it directly
        if (expiresAt > now) {
            return Response.json({
                success: true,
                shareUrl: report.public_share_url,
                expiryDate: report.public_share_expires_at,
                cached: true // Debug info
            });
        }
    }
    
    // 4. Generate New Link (External API Call)
    const payload = {
      ...report,
      created_by_email: user.email,
      original_report_id: report.id
    };

    const baseUrl = Deno.env.get('PUBLIC_SITE_BASE_URL') || 'https://test.tariff-ai.com';
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const PUBLIC_SITE_API_URL = `${cleanBaseUrl}/functions/createPublicReport`;
    
    const response = await fetch(PUBLIC_SITE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': Deno.env.get('TARIFFAI_API_KEY') || ''
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`External site error: ${errorText}`);
    }

    const result = await response.json();

    // 5. Update DB with new link (Cache it)
    await base44.asServiceRole.entities.ClassificationReport.update(report.id, {
        public_share_url: result.shareUrl,
        public_share_expires_at: result.expiryDate
    });

    return Response.json({
      success: true,
      shareUrl: result.shareUrl,
      expiryDate: result.expiryDate,
      cached: false
    });
    
  } catch (error) {
    console.error('Error generating link:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
