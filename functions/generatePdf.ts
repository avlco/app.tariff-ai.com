import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Try to get user for logging, but don't require authentication
        let userEmail = null;
        try {
            const user = await base44.auth.me();
            userEmail = user?.email;
        } catch (e) {
            // No authenticated user - OK for service role operations
        }

        const { reportId } = await req.json();
        if (!reportId) return Response.json({ error: 'Report ID required' }, { status: 400 });

        // Use asServiceRole for all entity operations (bypasses user auth requirement)
        const reports = await base44.asServiceRole.entities.ClassificationReport.filter({ id: reportId });
        const report = reports[0];
        if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });

        // Generate Token
        const token = crypto.randomUUID();
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 7); // 7 days validity
        
        // Create ShareableReport record using asServiceRole
        await base44.asServiceRole.entities.ShareableReport.create({
            token: token,
            report_id: reportId,
            expiry_date: expiry.toISOString()
        });

        // 2. Construct the URL for ReportView with token (allows bot access)
        const baseUrl = Deno.env.get('PUBLIC_SITE_BASE_URL') || 'https://test.tariff-ai.com';
        const targetUrl = `${baseUrl}/ReportView?id=${reportId}&token=${token}&mode=pdf`;

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