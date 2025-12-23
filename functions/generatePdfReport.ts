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
    
    // Get the report
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }
    
    // Check ownership
    if (report.created_by !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Build HTML for PDF
    const html = `
<!DOCTYPE html>
<html dir="${report.destination_country === 'Israel' ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 40px;
      color: #0F172A;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 3px solid #114B5F;
      padding-bottom: 20px;
    }
    .header h1 {
      color: #114B5F;
      margin: 0 0 10px 0;
      font-size: 32px;
    }
    .header p {
      color: #64748B;
      margin: 5px 0;
    }
    .hs-code-box {
      background: linear-gradient(135deg, #114B5F 0%, #0D3A4A 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      text-align: center;
      margin: 30px 0;
    }
    .hs-code-box h2 {
      margin: 0 0 10px 0;
      font-size: 48px;
      font-weight: bold;
    }
    .hs-code-box p {
      margin: 0;
      opacity: 0.9;
    }
    .section {
      margin: 30px 0;
      padding: 20px;
      background: #F8FAFC;
      border-radius: 8px;
      border-right: 4px solid #42C0B9;
    }
    .section h3 {
      color: #114B5F;
      margin-top: 0;
      font-size: 20px;
    }
    .section p, .section li {
      color: #475569;
    }
    .characteristics {
      list-style: none;
      padding: 0;
    }
    .characteristics li:before {
      content: "• ";
      color: #42C0B9;
      font-weight: bold;
      margin-left: 10px;
    }
    .trade-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin: 20px 0;
    }
    .trade-item {
      background: white;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #E2E8F0;
    }
    .trade-item strong {
      color: #114B5F;
      display: block;
      margin-bottom: 5px;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #E2E8F0;
      text-align: center;
      color: #94A3B8;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${report.product_name}</h1>
    <p>ID דוח: ${report.report_id}</p>
    <p>תאריך: ${new Date(report.created_date).toLocaleDateString('he-IL')}</p>
  </div>
  
  <div class="hs-code-box">
    <p style="font-size: 14px; margin-bottom: 5px;">קוד HS</p>
    <h2>${report.hs_code || '---'}</h2>
    <p>רמת ביטחון: ${report.confidence_score || 0}%</p>
  </div>
  
  <div class="trade-details">
    <div class="trade-item">
      <strong>מדינת ייצור</strong>
      <span>${report.country_of_manufacture || '---'}</span>
    </div>
    <div class="trade-item">
      <strong>מדינת מוצא</strong>
      <span>${report.country_of_origin || '---'}</span>
    </div>
    <div class="trade-item">
      <strong>מדינת יעד</strong>
      <span>${report.destination_country || '---'}</span>
    </div>
  </div>
  
  <div class="section">
    <h3>נימוק הסיווג</h3>
    <p>${report.classification_reasoning || 'לא זמין'}</p>
  </div>
  
  ${report.product_characteristics && report.product_characteristics.length > 0 ? `
  <div class="section">
    <h3>מאפייני המוצר</h3>
    <ul class="characteristics">
      ${report.product_characteristics.map(char => `<li>${char}</li>`).join('')}
    </ul>
  </div>
  ` : ''}
  
  ${report.tariff_description ? `
  <div class="section">
    <h3>מידע על מכסים</h3>
    <p>${report.tariff_description}</p>
  </div>
  ` : ''}
  
  ${report.import_requirements && report.import_requirements.length > 0 ? `
  <div class="section">
    <h3>דרישות יבוא</h3>
    ${report.import_requirements.map(req => `
      <div style="margin-bottom: 15px;">
        <strong style="color: #114B5F;">${req.title}</strong>
        <p style="margin: 5px 0 0 0;">${req.description}</p>
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  <div class="footer">
    <p>דוח זה נוצר באמצעות AI ואינו מהווה ייעוץ משפטי או מכסי רשמי.</p>
    <p>יש לאמת את המידע מול רשויות המכס הרשמיות.</p>
  </div>
</body>
</html>
    `;
    
    // Call PDFShift API
    const pdfShiftApiKey = Deno.env.get('PDFSHIFT_API_KEY');
    console.log('PDFShift API Key:', pdfShiftApiKey ? `${pdfShiftApiKey.substring(0, 10)}...` : 'EMPTY OR UNDEFINED');

    const pdfResponse = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
      method: 'POST',
      headers: {
        'X-API-Key': pdfShiftApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: html,
        landscape: false,
        use_print: false,
        format: 'A4'
      })
    });
    
    if (!pdfResponse.ok) {
      const errorData = await pdfResponse.text();
      console.error('PDFShift Error:', errorData);
      throw new Error(`Failed to generate PDF: ${errorData}`);
    }
    
    const pdfBuffer = await pdfResponse.arrayBuffer();
    
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${report.report_id}.pdf"`
      }
    });
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});