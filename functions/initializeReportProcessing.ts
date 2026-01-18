// 📁 File: functions/initializeReportProcessing.ts
// [האפליקציה - app.tariff-ai.com]

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { encrypt } from './utils/encryption.ts'; // ✅ ייבוא מנוע ההצפנה

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // אימות משתמש
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { reportId } = await req.json();
    
    if (!reportId) {
      return Response.json({ error: 'Report ID is required' }, { status: 400 });
    }
    
    // קבלת הדוח (בשלב זה המידע עשוי להיות עדיין גלוי אם נוצר ע"י הקליינט)
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }
    
    // עיבוד היסטוריית הצ'אט
    const chatSummary = report.chat_history && report.chat_history.length > 0
      ? report.chat_history.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n')
      : 'No additional chat information provided';
    
    const today = new Date().toISOString().split('T')[0];
    
    // ניתוח המידע באמצעות LLM (משתמשים במידע הגלוי כרגע)
    const analysisPrompt = `
CURRENT DATE: ${today}

You are an expert in product analysis for customs classification. 
Analyze the following product information and extract key details:

Product Name: ${report.product_name}
Country of Manufacture: ${report.country_of_manufacture}
Country of Origin: ${report.country_of_origin}
Destination Country: ${report.destination_country}

Chat History:
${chatSummary}

Extract and return the following in JSON format:
- product_characteristics: Array of key product features and materials
- additional_details: Any other relevant information for HS classification
- user_intent: What the user wants to achieve with this classification
`;
    
    const analysis = await base44.integrations.Core.InvokeLLM({
      prompt: analysisPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          product_characteristics: {
            type: "array",
            items: { type: "string" }
          },
          additional_details: { type: "string" },
          user_intent: { type: "string" }
        }
      }
    });
    
    // הכנת המידע לשמירה
    const finalUserInputText = `${chatSummary}\n\nAdditional Details: ${analysis.additional_details}`;

    // 🔐 הצפנת שדות רגישים לפני השמירה ב-DB
    const encryptedUserInput = await encrypt(finalUserInputText);
    
    // אנו מצפינים מחדש גם את שם המוצר כדי להבטיח שהוא מאובטח מכאן והלאה
    const encryptedProductName = await encrypt(report.product_name); 

    // עדכון הדוח עם המידע המוצפן
    await base44.asServiceRole.entities.ClassificationReport.update(reportId, {
      processing_status: 'analyzing_data',
      product_characteristics: analysis.product_characteristics,
      user_input_text: encryptedUserInput, // ✅ נשמר מוצפן
      product_name: encryptedProductName   // ✅ נשמר מוצפן
    });
    
    return Response.json({
      success: true,
      analysis,
      message: 'Initial processing completed'
    });
    
  } catch (error: any) {
    console.error('Error initializing report processing:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});
