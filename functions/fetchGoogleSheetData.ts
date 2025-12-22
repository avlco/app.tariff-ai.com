import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get request payload
    const { spreadsheetId, range, countries } = await req.json();
    
    // Get Google Sheets access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken("googlesheets");
    
    // Fetch data from Google Sheets
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
    const response = await fetch(sheetsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Process and filter data based on countries if provided
    let processedData = data.values || [];
    
    if (countries && countries.length > 0) {
      // Assuming first row is headers and countries are in specific columns
      processedData = processedData.filter((row, index) => {
        if (index === 0) return true; // Keep header row
        return countries.some(country => row.join('').includes(country));
      });
    }
    
    return Response.json({
      success: true,
      data: processedData,
      rowCount: processedData.length
    });
    
  } catch (error) {
    console.error('Error fetching Google Sheet data:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});