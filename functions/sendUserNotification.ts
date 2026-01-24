import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * sendUserNotification - Creates an internal notification and optionally sends an email
 * 
 * This function is called when:
 * - A report needs additional user input (clarification_needed)
 * - A report is completed (report_completed)
 * - A report failed (report_failed)
 * - Any system notification
 */

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { 
      userEmail, 
      type, 
      reportId, 
      reportName,
      question,
      sendEmail = true 
    } = await req.json();

    if (!userEmail || !type) {
      return Response.json({ error: 'userEmail and type are required' }, { status: 400 });
    }

    // Define notification content based on type
    const notificationContent = getNotificationContent(type, reportName, question, reportId);

    // Create internal notification
    const notification = await base44.asServiceRole.entities.Notification.create({
      type,
      title_he: notificationContent.title_he,
      title_en: notificationContent.title_en,
      message_he: notificationContent.message_he,
      message_en: notificationContent.message_en,
      status: 'unread',
      priority: notificationContent.priority,
      related_entity_type: 'ClassificationReport',
      related_entity_id: reportId,
      action_url: notificationContent.action_url,
      action_label_he: notificationContent.action_label_he,
      action_label_en: notificationContent.action_label_en,
      created_by: userEmail
    });

    console.log(`[Notification] Created notification ${notification.id} for ${userEmail}`);

    // Send email if requested
    if (sendEmail) {
      try {
        const emailSubject = notificationContent.email_subject_en; // Default to English for email
        const emailBody = buildEmailBody(notificationContent, reportId, reportName);

        await base44.integrations.Core.SendEmail({
          to: userEmail,
          subject: emailSubject,
          body: emailBody,
          from_name: 'ACE Classification System'
        });

        console.log(`[Notification] Email sent to ${userEmail}`);
      } catch (emailError) {
        console.error('[Notification] Failed to send email:', emailError);
        // Don't fail the whole request if email fails
      }
    }

    return Response.json({ 
      success: true, 
      notification_id: notification.id,
      email_sent: sendEmail 
    });

  } catch (error) {
    console.error('sendUserNotification Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});

function getNotificationContent(type, reportName, question, reportId) {
  const baseUrl = Deno.env.get('PUBLIC_SITE_BASE_URL') || '';
  const reportUrl = reportId ? `${createPageUrl('ReportView')}?id=${reportId}` : '';

  const contents = {
    clarification_needed: {
      title_he: '📋 נדרש מידע נוסף',
      title_en: '📋 Additional Information Required',
      message_he: `הדוח "${reportName}" דורש מידע נוסף להשלמת תהליך הסיווג. ${question || ''}`,
      message_en: `The report "${reportName}" requires additional information to complete classification. ${question || ''}`,
      priority: 'high',
      action_url: reportUrl,
      action_label_he: 'השלם מידע',
      action_label_en: 'Complete Info',
      email_subject_en: `Action Required: Additional information needed for "${reportName}"`,
      email_subject_he: `נדרשת פעולה: מידע נוסף נדרש עבור "${reportName}"`
    },
    report_completed: {
      title_he: '✅ הדוח הושלם',
      title_en: '✅ Report Completed',
      message_he: `הדוח "${reportName}" הושלם בהצלחה וניתן לצפייה.`,
      message_en: `The report "${reportName}" has been completed successfully and is ready for viewing.`,
      priority: 'medium',
      action_url: reportUrl,
      action_label_he: 'צפה בדוח',
      action_label_en: 'View Report',
      email_subject_en: `Your classification report "${reportName}" is ready`,
      email_subject_he: `דוח הסיווג שלך "${reportName}" מוכן`
    },
    report_failed: {
      title_he: '❌ הדוח נכשל',
      title_en: '❌ Report Failed',
      message_he: `הדוח "${reportName}" נכשל בתהליך הסיווג. אנא נסה שוב או פנה לתמיכה.`,
      message_en: `The report "${reportName}" failed during classification. Please try again or contact support.`,
      priority: 'urgent',
      action_url: reportUrl,
      action_label_he: 'צפה בפרטים',
      action_label_en: 'View Details',
      email_subject_en: `Classification failed for "${reportName}"`,
      email_subject_he: `הסיווג נכשל עבור "${reportName}"`
    },
    report_processing: {
      title_he: '⏳ הדוח בעיבוד',
      title_en: '⏳ Report Processing',
      message_he: `הדוח "${reportName}" נמצא כעת בתהליך עיבוד.`,
      message_en: `The report "${reportName}" is currently being processed.`,
      priority: 'low',
      action_url: reportUrl,
      action_label_he: 'צפה בסטטוס',
      action_label_en: 'View Status',
      email_subject_en: `Your report "${reportName}" is being processed`,
      email_subject_he: `הדוח שלך "${reportName}" בעיבוד`
    },
    system: {
      title_he: '🔔 הודעת מערכת',
      title_en: '🔔 System Notification',
      message_he: reportName || 'הודעת מערכת חדשה',
      message_en: reportName || 'New system notification',
      priority: 'medium',
      action_url: '',
      action_label_he: '',
      action_label_en: '',
      email_subject_en: 'ACE System Notification',
      email_subject_he: 'התראת מערכת ACE'
    }
  };

  return contents[type] || contents.system;
}

function createPageUrl(pageName) {
  return `/${pageName}`;
}

function buildEmailBody(content, reportId, reportName) {
  const baseUrl = Deno.env.get('PUBLIC_SITE_BASE_URL') || 'https://app.example.com';
  const reportLink = reportId ? `${baseUrl}/ReportView?id=${reportId}` : baseUrl;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #114B5F; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #42C0B9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;">ACE Classification System</h1>
    </div>
    <div class="content">
      <h2>${content.title_en}</h2>
      <p>${content.message_en}</p>
      ${reportId ? `<a href="${reportLink}" class="button">${content.action_label_en || 'View Report'}</a>` : ''}
    </div>
    <div class="footer">
      <p>This is an automated message from the ACE Classification System.</p>
      <p>If you have any questions, please contact our support team.</p>
    </div>
  </div>
</body>
</html>
  `;
}