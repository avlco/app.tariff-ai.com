import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

        // Generate Token
        const token = crypto.randomUUID();
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 7); // 7 days validity
        
        // 1. Create ShareableReport record (Critical for PublicReportView to work)
        await base44.asServiceRole.entities.ShareableReport.create({
            token: token,
            report_id: reportId,
            expiry_date: expiry.toISOString(),
            created_by: user.email
        });

        // 2. Construct the CORRECT public URL using configured domain
        const baseUrl = Deno.env.get('PUBLIC_SITE_BASE_URL') || 'https://test.tariff-ai.com';
        const targetUrl = `${baseUrl}/PublicReport?token=${token}&mode=pdf`;

        const pdfShiftApiKey = Deno.env.get('PDFSHIFT_API_KEY');
        if (!pdfShiftApiKey) return Response.json({ error: 'PDFShift API Key missing' }, { status: 500 });

        console.log(`Generating PDF for: ${targetUrl}`);

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