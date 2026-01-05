import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { reportId } = await req.json();
        if (!reportId) return Response.json({ error: 'Report ID required' }, { status: 400 });

        // Get report to check existing token or generate new one
        const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
        const report = reports[0];
        if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });

        let token = report.public_share_url; // Assuming this field stores the token or full url, logic below adapts
        // Extract token if it's a full URL in the DB (based on generateShareableReportLink behavior)
        if (token && token.includes('/shared/')) {
            token = token.split('/shared/')[1];
        }

        // If no token exists, we must generate one (similar to generateShareableReportLink logic)
        if (!token) {
             token = crypto.randomUUID();
             // Store it - reusing the field meant for share URL for now or just transient use? 
             // To be safe and consistent with "generateShareableReportLink", let's call it or replicate logic.
             // Replicating simple update here for speed/efficiency without full external call overhead if simple.
             const expiry = new Date();
             expiry.setDate(expiry.getDate() + 7); // 7 days validity
             
             // We need to construct the full URL usually, but for internal use here just the token is enough
             // Updating DB to ensure the view works
             await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
                 public_share_url: `https://${req.headers.get("host")}/shared/${token}`,
                 public_share_expires_at: expiry.toISOString()
             });
        }

        const host = req.headers.get("host");
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
                params: {
                    format: 'A4',
                    margin: '15mm',
                    print_background: true,
                    wait_for: 'networkidle0' 
                }
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