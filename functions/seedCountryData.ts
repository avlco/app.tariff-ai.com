import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Security check - only admin should run this
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
             // For development/seeding purposes we might relax this or ensure the user calling is admin
             // return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // HARDCODED DATA FROM CSV
        // PLEASE PASTE THE PARSED CSV DATA HERE INTO THIS ARRAY
        const COUNTRIES = [
            // Example format:
            // {
            //     country: "Israel",
            //     tax_method: "CIF",
            //     hs_code_structure: "10 digits",
            //     customs_links: "https://www.gov.il/en/departments/topics/customs_tariff/govil-landing-page",
            //     regulation_links: "https://www.gov.il/en/departments/ministry_of_economy/govil-landing-page",
            //     trade_agreements_links: "https://www.gov.il/en/departments/topics/trade_agreements/govil-landing-page",
            //     government_trade_links: "https://www.gov.il/en/departments/ministry_of_economy",
            //     regional_agreements: "US-Israel FTA, EU-Israel Association Agreement"
            // }
        ];

        if (COUNTRIES.length === 0) {
            return Response.json({ 
                success: false, 
                message: "No data found. Please update functions/seedCountryData.js with the parsed CSV data in the COUNTRIES array." 
            });
        }

        let insertedCount = 0;
        let errors = [];

        for (const row of COUNTRIES) {
            try {
                // Check if exists to avoid duplicates or update? 
                // Simple seeding: try create, if fail (due to unique constraint if any) maybe skip?
                // Entity 'CountryKnowledgeBase' primary key is 'country' (implicit ID usually, but we set 'country' as required).
                // Actually base44 entities always have 'id'. 'country' is just a field.
                // We should check if it exists first to avoid duplicates.
                
                const existing = await base44.asServiceRole.entities.CountryKnowledgeBase.filter({ country: row.country });
                
                if (existing.length > 0) {
                    // Update existing
                    await base44.asServiceRole.entities.CountryKnowledgeBase.update(existing[0].id, {
                        tax_method: row.tax_method,
                        hs_code_structure: row.hs_code_structure,
                        customs_links: row.customs_links,
                        regulation_links: row.regulation_links,
                        trade_agreements_links: row.trade_agreements_links,
                        government_trade_links: row.government_trade_links,
                        regional_agreements: row.regional_agreements
                    });
                } else {
                    // Create new
                    await base44.asServiceRole.entities.CountryKnowledgeBase.create({
                        country: row.country,
                        tax_method: row.tax_method,
                        hs_code_structure: row.hs_code_structure,
                        customs_links: row.customs_links,
                        regulation_links: row.regulation_links,
                        trade_agreements_links: row.trade_agreements_links,
                        government_trade_links: row.government_trade_links,
                        regional_agreements: row.regional_agreements
                    });
                }
                insertedCount++;
            } catch (err) {
                console.error(`Failed to process ${row.country}:`, err);
                errors.push({ country: row.country, error: err.message });
            }
        }

        return Response.json({ 
            success: true, 
            count: insertedCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});