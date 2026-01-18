// 📁 File: functions/getSecureReport.ts
// [האפליקציה - app.tariff-ai.com]

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { decrypt } from './utils/encryption.ts';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // 1. אימות משתמש
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // קבלת ה-ID של הדוח מהבקשה
    const { reportId } = await req.json();
    if (!reportId) {
      return Response.json({ error: 'Report ID is required' }, { status: 400 });
    }
    
    // 2. שליפת הדוח הגולמי (המוצפן) מהמסד
    // אנו משתמשים ב-service role כדי לעקוף מגבלות RLS ולוודא שליטה מלאה בלוגיקה
    const reports = await base44.asServiceRole.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }

    // 3. בדיקת הרשאות: האם הדוח שייך למשתמש?
    // (מאפשרים גם לאדמין לגשת אם צריך, אבל כרגע נתמקד בבעלות ישירה)
    const isOwner = report.created_by === user.id || report.user_id === user.id;
    if (!isOwner && user.role !== 'admin') {
      console.warn(`Unauthorized access attempt: User ${user.id} tried to access report ${reportId}`);
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 4. פענוח שדות רגישים (Decryption)
    // אם השדות עדיין לא מוצפנים (דוחות ישנים), הפונקציה תחזיר אותם כמו שהם
    const decryptedReport = {
      ...report,
      product_name: await decrypt(report.product_name),
      user_input_text: await decrypt(report.user_input_text),
      classification_reasoning: await decrypt(report.classification_reasoning),
      tariff_description: await decrypt(report.tariff_description),
      product_characteristics: report.product_characteristics, // מערך מחרוזות - כרגע נשאר כפי שהוא או דורש טיפול מיוחד אם הוא רגיש
      
      // פענוח שדות נוספים לפי הצורך
      structural_analysis: report.structural_analysis, // אובייקט JSON - לרוב לא מצפינים את המבנה כולו אלא שדות בתוכו
      ai_analysis_summary: await decrypt(report.ai_analysis_summary),
    };

    return Response.json(decryptedReport);

  } catch (error) {
    console.error('Error fetching secure report:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
