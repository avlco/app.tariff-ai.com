import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Authenticate user
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { reportId } = await req.json();
        if (!reportId) return Response.json({ error: 'Report ID required' }, { status: 400 });

        // Retrieve Report (User role)
        const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
        const report = reports[0];
        if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });

        let token;
        const now = new Date();
        const expiresAt = report.public_share_expires_at ? new Date(report.public_share_expires_at) : null;

        // Smart Token Logic: Check if valid token exists
        if (report.public_share_url && expiresAt && expiresAt > now) {
            const urlParts = report.public_share_url.split('/shared/');
            if (urlParts.length > 1) {
                token = urlParts[1];
            }
        }

        const host = req.headers.get("host");

        // If no valid token, generate new one
        if (!token) {
             token = crypto.randomUUID();
             const expiry = new Date();
             expiry.setDate(expiry.getDate() + 7); // 7 days validity
             
             // Update DB (Admin) - Using asServiceRole as requested
             await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
                 public_share_url: `https://${host}/shared/${token}`,
                 public_share_expires_at: expiry.toISOString()
             });
        }

        const protocol = host.includes('localhost') ? 'http' : 'https';
        const targetUrl = `${protocol}://${host}/shared/${token}?mode=pdf`;

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

        // Stream back the PDF
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