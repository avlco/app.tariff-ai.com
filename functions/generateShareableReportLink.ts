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
    
    // Get the full report data
    // using filter instead of get to safely handle 'not found' without try/catch around lookup if preferred, 
    // but .get() is fine if we handle null. SDK .get usually returns null or throws. 
    // Let's use filter to be consistent with previous code style
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }
    
    // Check ownership
    if (report.created_by !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Prepare the payload for the public site
    // We send the entire report object plus the creator's email
    const payload = {
      ...report,
      created_by_email: user.email,
      original_report_id: report.id
    };

    // Call the public site API
    // Using the project ID domain for direct access to the function
    const PUBLIC_SITE_API_URL = "https://6943f4e2bf8334936af2edbc.deno.dev/createPublicReport";
    
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

    return Response.json({
      success: true,
      shareUrl: result.shareUrl,
      expiryDate: result.expiryDate
    });
    
  } catch (error) {
    console.error('Error generating shareable link:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});