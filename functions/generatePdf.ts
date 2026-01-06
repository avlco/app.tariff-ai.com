import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. זיהוי משתמש (לא חובה, רק לתיעוד)
        let userEmail = 'system_pdf_generator';
        try {
            const user = await base44.auth.me();
            if (user) userEmail = user.email;
        } catch (e) {}

        const { reportId } = await req.json();
        if (!reportId) return Response.json({ error: 'Report ID required' }, { status: 400 });

        // 2. בדיקת קיום הדוח (Service Role עוקף הרשאות רגילות)
        const reports = await base44.asServiceRole.entities.ClassificationReport.filter({ id: reportId });
        const report = reports[0];
        if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });

        // 3. יצירת מפתח כניסה (Token) לבוט
        const token = crypto.randomUUID();
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 1); // תוקף קצר ל-PDF
        
        await base44.asServiceRole.entities.ShareableReport.create({
            token: token,
            report_id: reportId,
            expiry_date: expiry.toISOString(),
            created_by: userEmail
        });

        // 4. בניית ה-URL - מפנה לדף הציבורי PublicReport
        const baseUrl = Deno.env.get('PUBLIC_SITE_BASE_URL') || 'https://test.tariff-ai.com';
        const targetUrl = `${baseUrl}/PublicReport?token=${token}&mode=pdf`;

        console.log(`Generating PDF for: ${targetUrl}`);

        const pdfShiftApiKey = Deno.env.get('PDFSHIFT_API_KEY');
        if (!pdfShiftApiKey) return Response.json({ error: 'PDFShift API Key missing' }, { status: 500 });

        const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${btoa('api:' + pdfShiftApiKey)}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                source: targetUrl,
                format: 'A4',
                margin: '10mm',
                wait_for_network: true,
                disable_backgrounds: false
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('PDFShift Error:', errText);
            throw new Error(`PDF Generation failed: ${response.statusText}`);
        }

        return new Response(response.body, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="report-${reportId}.pdf"`
            }
        });

    } catch (error) {
        console.error('Generate PDF Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});