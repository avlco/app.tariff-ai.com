import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user has premium subscription (keeping existing logic)
    const isPremium = ['pay_per_use', 'basic', 'pro', 'agency', 'enterprise'].includes(user.subscription_plan);
    if (!isPremium) {
      return Response.json({ error: 'Premium subscription required' }, { status: 403 });
    }
    
    const { reportId } = await req.json();
    
    if (!reportId) {
      return Response.json({ error: 'Report ID is required' }, { status: 400 });
    }
    
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    let report = reports[0];
    
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }
    
    // Check ownership
    if (report.created_by !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    // --- NEW: Smart Caching Logic ---
    const now = new Date();
    if (report.public_share_url && report.public_share_expires_at && new Date(report.public_share_expires_at) > now) {
      // Cache Hit: Return existing valid link
      return Response.json({
        success: true,
        shareUrl: report.public_share_url,
        expiryDate: report.public_share_expires_at,
        cached: true
      });
    }
    // --- END NEW: Smart Caching Logic ---
    
    // Prepare the payload for the public site
    const payload = {
      ...report,
      created_by_email: user.email,
      original_report_id: report.id
    };

    // Call the public site API
    // Note: PUBLIC_SITE_BASE_URL should be hardcoded on the Site side, but for calling it, we use the env var from this app.
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
      console.error('Public site API error:', response.status, errorText);
      throw new Error(`Failed to create public report on external site: ${errorText}`);
    }

    const result = await response.json();

    // --- NEW: Store the new link and expiry in the report entity ---
    await base44.entities.ClassificationReport.update(reportId, {
      public_share_url: result.shareUrl,
      public_share_expires_at: result.expiryDate
    });
    // --- END NEW: Store the new link and expiry ---

    return Response.json({
      success: true,
      shareUrl: result.shareUrl,
      expiryDate: result.expiryDate,
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