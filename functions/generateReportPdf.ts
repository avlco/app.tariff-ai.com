import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // 1. Auth Check
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { reportId } = await req.json();
    if (!reportId) return Response.json({ error: 'Report ID required' }, { status: 400 });

    // 2. Fetch Report Data
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });

    // 3. Create Temporary Access Token on the Public Site
    // משתמשים ב-URL של האתר הציבורי כפי שמוגדר ב-ENV או ברירת מחדל
    const siteBaseUrl = Deno.env.get('PUBLIC_SITE_BASE_URL') || 'https://test.tariff-ai.com';
    const siteApiUrl = `${siteBaseUrl.replace(/\/$/, '')}/functions/createPublicReport`;
    
    // שליחת כל המידע הנחוץ ליצירת הדוח באופן מפורש
    const sitePayload = {
      // Basic Info
      product_name: report.product_name,
      report_id: report.report_id || report.id,
      destination_country: report.destination_country,
      country_of_origin: report.country_of_origin,
      country_of_manufacture: report.country_of_manufacture,
      status: report.status,
      created_date: report.created_date,
      target_language: report.target_language,
      
      // User Input Data
      user_input_text: report.user_input_text,
      uploaded_image_urls: report.uploaded_image_urls,
      uploaded_file_urls: report.uploaded_file_urls,
      external_link_urls: report.external_link_urls,
      chat_history: report.chat_history,
      
      // Agent Results - All nested objects
      structural_analysis: report.structural_analysis,
      research_findings: report.research_findings,
      classification_results: report.classification_results,
      regulatory_data: report.regulatory_data,
      qa_audit: report.qa_audit,
      
      // Legacy/Flat fields for backwards compatibility
      hs_code: report.hs_code,
      confidence_score: report.confidence_score,
      classification_reasoning: report.classification_reasoning,
      tariff_description: report.tariff_description,
      
      // Metadata
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
    const tempPublicUrl = siteData.shareUrl; // זה ה-URL ש-PDFShift ייגש אליו

    // 4. Generate PDF via PDFShift
    const pdfShiftKey = Deno.env.get('PDFSHIFT_API_KEY');
    if (!pdfShiftKey) throw new Error("PDFSHIFT_API_KEY not set in environment variables");

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
            wait_for: 'reportReady', 
            wait_for_network: true, // מחכה שכל בקשות הרשת יסתיימו
            filename: `tariff-ai-report-${report.report_id || reportId}.pdf`,
            sandbox: false // שנה ל-true אם אתה רוצה לבדוק ללא חיוב קרדיטים
        })
    });

    if (!pdfRes.ok) {
        const errText = await pdfRes.text();
        throw new Error(`PDFShift Error: ${errText}`);
    }

    const pdfData = await pdfRes.json();

    // 5. Return the PDF URL
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