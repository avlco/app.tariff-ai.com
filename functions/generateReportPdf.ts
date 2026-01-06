import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6'; // שיניתי ל-0.8.6

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { reportId } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID required' }, { status: 400 });

    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });

    const siteBaseUrl = Deno.env.get('PUBLIC_SITE_BASE_URL') || 'https://test.tariff-ai.com';
    // הסרת לוכסן בסוף אם קיים
    const cleanUrl = siteBaseUrl.replace(/\/$/, '');
    const siteApiUrl = `${cleanUrl}/functions/createPublicReport`;
    
    const sitePayload = {
      ...report,
      created_by_email: user.email,
      expiryMinutes: 15,
      isPdf: true
    };

    const siteRes = await fetch(siteApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': Deno.env.get('TARIFFAI_API_KEY') || ''
      },
      body: JSON.stringify(sitePayload)
    });

    if (!siteRes.ok) {
        const errText = await siteRes.text();
        throw new Error(`Site API Error: ${errText}`);
    }
    
    const siteData = await siteRes.json();
    const tempPublicUrl = siteData.shareUrl;

    const pdfShiftKey = Deno.env.get('PDFSHIFT_API_KEY');
    if (!pdfShiftKey) throw new Error("PDFSHIFT_API_KEY not set");

    const pdfRes = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${btoa('api:' + pdfShiftKey)}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            source: tempPublicUrl,
            landscape: false,
            format: 'A4',
            margin: '10mm',
            // חזרנו לשם הישן כדי להתאים למה שהשרת "זוכר" או מצפה לו
            wait_for: 'report-ready', 
            wait_for_network: true,
            filename: `tariff-ai-report-${report.report_id || reportId}.pdf`,
            sandbox: false
        })
    });

    if (!pdfRes.ok) {
        const errText = await pdfRes.text();
        throw new Error(`PDFShift Error: ${errText}`);
    }

    const pdfData = await pdfRes.json();

    return Response.json({ 
        success: true, 
        pdfUrl: pdfData.url,
        message: 'PDF generated successfully'
    });

  } catch (error) {
    console.error('PDF Generation Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});