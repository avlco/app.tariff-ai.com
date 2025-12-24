import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Database, Lock, Globe, UserX, Mail, Shield } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../../components/providers/LanguageContext';

export default function PrivacyContent({ minimal = false }) {
  const { language, isRTL } = useLanguage();

  const content = {
    en: {
      title: 'Privacy Policy',
      subtitle: 'Your privacy is our priority. This policy explains how we collect, use, protect, and handle your personal data in compliance with GDPR and LGPD.',
      lastUpdated: 'Last updated: December 22, 2025 | Version 1.0',
      back: 'Back to Home',
      sections: [
        {
          icon: FileText,
          title: '1. Data Controller',
          content: `tariff.ai (\"we\", \"our\", \"us\") is the data controller responsible for your personal information. You can contact us at:\\n\\nEmail: info@tariff-ai.com\\nAddress: tariff.ai Privacy Team, San Francisco, CA\\n\\nFor GDPR-related inquiries, our EU representative can be contacted at info@tariff-ai.com`
        },
        {
          icon: Database,
          title: '2. Information We Collect',
          content: `We collect the following types of personal data:\\n\\n**2.1 Information You Provide:**\\n* Account Information: Full name, email address, company name\\n* Newsletter Subscriptions: Email address, consent timestamp\\n* Contact Forms: Name, email, company, subject, message\\n\\n**2.2 Information Collected Automatically:**\\n* Analytics Data: Page views, page URLs, referrer URLs, session IDs\\n* Device Information: IP address (anonymized after 90 days), browser type, operating system, device type, screen resolution\\n* Location Data: Country and city (derived from IP address)\\n* Interaction Data: Clicks, form submissions, scroll depth, element interactions, viewport size\\n* Technical Data: User agent, language preferences, timezone\\n\\n**2.3 Cookies and Tracking:**\\n* Essential Cookies: Session management (necessary for functionality)\\n* Analytics Cookies: Usage patterns and site performance (requires consent)\\n* Marketing Cookies: User preferences for marketing communications (requires consent)\\n\\nFor detailed cookie information, see our Cookie Policy.`
        },
        {
          icon: Lock,
          title: '3. Legal Basis for Processing',
          content: `Under GDPR and LGPD, we process your personal data based on:\\n\\n* **Consent:** Newsletter subscriptions, analytics cookies, marketing communications (you may withdraw consent at any time)\\n* **Contractual Necessity:** Account management and service delivery\\n* **Legitimate Interests:** Site security, fraud prevention, product improvements (balanced against your privacy rights)\\n* **Legal Obligations:** Compliance with tax, accounting, and other legal requirements`
        },
        {
          icon: Shield,
          title: '4. How We Use Your Information',
          content: `We use your personal data for the following purposes:\\n\\n* **Service Delivery:** Provide tariff analysis reports, maintain your account, process transactions\\n* **Communication:** Respond to inquiries, send service updates, deliver newsletters (with consent)\\n* **Analytics & Improvement:** Understand usage patterns, optimize user experience, develop new features\\n* **Security:** Detect and prevent fraud, abuse, and security incidents\\n* **Compliance:** Meet legal and regulatory obligations\\n\\nWe do NOT:\\n* Sell your personal data to third parties\\n* Use your data for automated decision-making that significantly affects you\\n* Process sensitive personal data (health, biometric, political opinions) without explicit consent`
        },
        {
          icon: Globe,
          title: '5. Information Sharing and Third Parties',
          content: `We share your personal data only in the following circumstances:\\n\\n**5.1 Service Providers:**\\n* Base44 Platform: Infrastructure and database hosting\\n* Email Service Providers: Transactional and marketing emails\\n* Payment Processors: Secure payment handling (we don\'t store payment card details)\\n\\nAll service providers are bound by Data Processing Agreements (DPAs) and process data only as instructed.\\n\\n**5.2 Legal Requirements:**\\nWe may disclose your data if required by law, court order, or to protect our legal rights.\\n\\n**5.3 Business Transfers:**\\nIn the event of a merger or acquisition, your data may be transferred to the new entity, subject to the same privacy protections.\\n\\nWe do NOT sell, rent, or trade your personal data.`
        },
        {
          icon: Lock,
          title: '6. International Data Transfers',
          content: `Your data may be transferred to and processed in countries outside your residence, including the United States.\\n\\nFor EU users: We ensure adequate protection through:\\n* Standard Contractual Clauses (SCCs) approved by the European Commission\\n* Adequacy decisions where applicable\\n\\nFor Brazilian users (LGPD): We comply with cross-border transfer requirements and implement appropriate safeguards.`
        },
        {
          icon: Database,
          title: '7. Data Retention',
          content: `We retain your personal data only as long as necessary:\\n\\n* **Account Data:** Duration of account + 90 days after closure\\n* **Analytics Data:** 12 months from collection\\n* **Newsletter Subscriptions:** Until you unsubscribe + 30 days\\n* **Contact Form Submissions:** 24 months after last interaction\\n* **Consent Records:** 3 years (for compliance proof)\\n* **Financial Records:** 7 years (legal requirement)\\n\\nAfter retention periods expire, data is permanently deleted or anonymized.`
        },
        {
          icon: Shield,
          title: '8. Data Security',
          content: `We implement industry-standard security measures:\\n\\n* **Encryption:** Data encrypted in transit (TLS/SSL) and at rest (AES-256)\\n* **Access Control:** Role-based access, principle of least privilege\\n* **Authentication:** Multi-factor authentication for administrative access\\n* **Monitoring:** 24/7 security monitoring and incident response\\n* **Regular Audits:** Periodic security assessments and penetration testing\\n\\nWhile we take every reasonable precaution, no system is 100% secure. We will notify you of any data breaches as required by law.`
        },
        {
          icon: UserX,
          title: '9. Your Rights (GDPR & LGPD)',
          content: `You have the following rights regarding your personal data:\\n\\n**Right to Access:** Obtain a copy of your personal data\\n**Right to Rectification:** Correct inaccurate or incomplete data\\n**Right to Erasure ("Right to be Forgotten"):** Request deletion of your data\\n**Right to Restriction:** Limit how we process your data\\n**Right to Data Portability:** Receive your data in a machine-readable format\\n**Right to Object:** Object to processing based on legitimate interests\\n**Right to Withdraw Consent:** Withdraw consent at any time (does not affect prior lawful processing)\\n**Right to Lodge a Complaint:** File a complaint with your data protection authority\\n\\nTo exercise these rights, use the data request form below or contact info@tariff-ai.com`
        },
        {
          icon: FileText,
          title: '10. Children\\\'s Privacy',
          content: `Our services are not intended for individuals under 18 years of age. We do not knowingly collect personal data from children. If we discover we have collected data from a child, we will delete it immediately. Parents or guardians who believe we may have collected data from a child should contact us at info@tariff-ai.com`
        },
        {
          icon: Database,
          title: '11. Automated Decision-Making',
          content: `We do not use automated decision-making or profiling that produces legal or similarly significant effects on you. Any analytics or personalization features are used solely to improve user experience and can be opted out of via cookie preferences.`
        },
        {
          icon: Mail,
          title: '12. Marketing Communications',
          content: `With your consent, we may send you:\\n* Product updates and new features\\n* Industry insights and educational content\\n* Special offers and promotions\\n\\nYou can opt out at any time by:\\n* Clicking \"unsubscribe\" in any email\\n* Updating your account preferences\\n* Contacting info@tariff-ai.com`
        },
        {
          icon: Shield,
          title: '13. Data Breach Notification',
          content: `In the event of a data breach that poses a risk to your rights and freedoms, we will:\\n* Notify the relevant supervisory authority within 72 hours (GDPR) or as required by LGPD\\n* Inform affected individuals without undue delay\\n* Provide information about the nature of the breach and remedial actions\\n* Document all breaches for regulatory compliance`
        },
        {
          icon: Globe,
          title: '14. Changes to This Policy',
          content: `We may update this Privacy Policy periodically to reflect changes in our practices or legal requirements. We will:\\n* Post the updated policy on this page\\n* Update the \"Last Updated\" date\\n* Notify you of material changes via email or prominent notice\\n* Obtain fresh consent where required by law\\n\\nContinued use of our services after changes constitutes acceptance of the updated policy.`
        },
        {
          icon: Mail,
          title: '15. Contact & Data Protection Officer',
          content: `For any privacy-related questions or to exercise your rights:\\n\\n**General Inquiries:**\\nEmail: info@tariff-ai.com\\n\\n**EU GDPR Inquiries:**\\nEU Representative: info@tariff-ai.com\\n\\n**Brazil LGPD Inquiries:**\\nBrazil Representative: info@tariff-ai.com\\n\\n**Mailing Address:**\\ntariff.ai Privacy Team\\nSan Francisco, CA\\n\\n**Supervisory Authorities:**\\nEU: Your local Data Protection Authority\\nBrazil: Autoridade Nacional de Proteção de Dados (ANPD)`
        }
      ]
    },
    he: {
      title: 'מדיניות פרטיות',
      subtitle: 'הפרטיות שלך היא בראש סדר העדיפויות שלנו. מדיניות זו מסבירה כיצד אנו אוספים, משתמשים, מגנים ומטפלים בנתונים האישיים שלך בהתאם ל-GDPR ו-LGPD.',
      lastUpdated: 'עדכון אחרון: 22 בדצמבר 2025 | גרסה 1.0',
      back: 'חזרה לדף הבית',
      sections: [
        {
          icon: FileText,
          title: '1. מנהל הנתונים',
          content: `tariff.ai (\"אנחנו\", \"שלנו\") הוא מנהל הנתונים האחראי על המידע האישי שלך. ניתן ליצור איתנו קשר:\\n\\nדוא\"ל: info@tariff-ai.com\\nכתובת: tariff.ai Privacy Team, San Francisco, CA\\n\\nלפניות הקשורות ל-GDPR, ניתן ליצור קשר עם הנציג שלנו באיחוד האירופי בכתובת info@tariff-ai.com`
        },
        {
          icon: Database,
          title: '2. מידע שאנו אוספים',
          content: `אנו אוספים את סוגי הנתונים האישיים הבאים:\\n\\n**2.1 מידע שאתה מספק:**\\n* פרטי חשבון: שם מלא, כתובת דוא\"ל, שם החברה\\n* רישום לניוזלטר: כתובת דוא\"ל, חותמת זמן של הסכמה\\n* טפסי יצירת קשר: שם, דוא\"ל, חברה, נושא, הודעה\\n\\n**2.2 מידע שנאסף אוטומטית:**\\n* נתוני אנליטיקה: צפיות בדפים, כתובות URL של דפים, מפנים, מזהי סשן\\n* מידע על המכשיר: כתובת IP (מאונמת לאחר 90 יום), סוג דפדפן, מערכת הפעלה, סוג מכשיר, רזולוציית מסך\\n* נתוני מיקום: מדינה ועיר (נגזרים מכתובת IP)\\n* נתוני אינטראקציה: קליקים, הגשות טפסים, עומק גלילה, אינטראקציות עם אלמנטים, גודל viewport\\n* נתונים טכניים: user agent, העדפות שפה, אזור זמן\\n\\n**2.3 עוגיות ומעקב:**\\n* עוגיות חיוניות: ניהול סשן (נדרש לתפקוד)\\n* עוגיות אנליטיות: דפוסי שימוש וביצועי אתר (דורש הסכמה)\\n* עוגיות שיווקיות: העדפות למסרים שיווקיים (דורש הסכמה)\\n\\nלמידע מפורט על עוגיות, ראה את מדיניות העוגיות שלנו.`
        },
        {
          icon: Lock,
          title: '3. בסיס חוקי לעיבוד',
          content: `תחת GDPR ו-LGPD, אנו מעבדים את הנתונים האישיים שלך על בסיס:\\n\\n* **הסכמה:** רישום לניוזלטר, עוגיות אנליטיות, תקשורת שיווקית (ניתן למשוך הסכמה בכל עת)\\n* **הכרח חוזי:** ניהול חשבון ומתן שירותים\\n* **אינטרסים לגיטימיים:** אבטחת אתר, מניעת הונאות, שיפורי מוצר (מאוזן מול זכויות הפרטיות שלך)\\n* **חובות חוקיות:** עמידה בדרישות מס, חשבונאות ודרישות חוקיות אחרות`
        },
        {
          icon: Shield,
          title: '4. כיצד אנו משתמשים במידע שלך',
          content: `אנו משתמשים בנתונים האישיים שלך למטרות הבאות:\\n\\n* **אספקת שירות:** מתן דוחות ניתוח מכס, תחזוקת חשבון, עיבוד עסקאות\\n* **תקשורת:** מענה לפניות, שליחת עדכוני שירות, משלוח ניוזלטרים (עם הסכמה)\\n* **אנליטיקה ושיפור:** הבנת דפוסי שימוש, אופטימיזציה של חוויית משתמש, פיתוח פיצ\'רים חדשים\\n* **אבטחה:** זיהוי ומניעת הונאות, שימוש לרעה ואירועי אבטחה\\n* **עמידה בדרישות:** עמידה בחובות חוקיות ורגולטוריות\\n\\nאנו לא:\\n* מוכרים את הנתונים האישיים שלך לצדדים שלישיים\\n* משתמשים בנתונים שלך לקבלת החלטות אוטומטיות שמשפיעות משמעותית עליך\\n* מעבדים נתונים רגישים (בריאות, ביומטרי, דעות פוליטיות) ללא הסכמה מפורשת`
        },
        {
          icon: Globe,
          title: '5. שיתוף מידע וצדדים שלישיים',
          content: `אנו משתפים את הנתונים האישיים שלך רק בנסיבות הבאות:\\n\\n**5.1 ספקי שירות:**\\n* פלטפורמת Base44: אירוח תשתית ומסד נתונים\\n* ספקי שירותי דוא\"ל: דוא\"ל טרנזאקציוני ושיווקי\\n* מעבדי תשלומים: טיפול מאובטח בתשלומים (איננו שומרים פרטי כרטיס)\\n\\nכל ספקי השירות מחויבים בהסכמי עיבוד נתונים (DPAs) ומעבדים נתונים רק לפי הוראות.\\n\\n**5.2 דרישות חוקיות:**\\nאנו עשויים לחשוף את הנתונים שלך אם נדרש על פי חוק, צו בית משפט, או כדי להגן על זכויותינו החוקיות.\\n\\n**5.3 העברות עסקיות:**\\nבמקרה של מיזוג או רכישה, הנתונים שלך עשויים להיות מועברים לישות החדשה, בכפוף לאותן הגנות פרטיות.\\n\\nאנו לא מוכרים, משכירים או סוחרים בנתונים האישיים שלך.`
        },
        {
          icon: Lock,
          title: '6. העברות נתונים בינלאומיות',
          content: `הנתונים שלך עשויים להיות מועברים ומעובדים במדינות מחוץ למקום מגוריך, כולל ארצות הברית.\\n\\nעבור משתמשים באיחוד האירופי: אנו מבטיחים הגנה מספקת באמצעות:\\n* סעיפים חוזיים סטנדרטיים (SCCs) שאושרו על ידי הנציבות האירופית\\n* החלטות התאמה כשרלוונטי\\n\\nעבור משתמשים בברזיל (LGPD): אנו עומדים בדרישות העברה חוצת גבולות ומיישמים אמצעי הגנה מתאימים.`
        },
        {
          icon: Database,
          title: '7. שמירת נתונים',
          content: `אנו שומרים את הנתונים האישיים שלך רק כל עוד זה נדרש:\\n\\n* **נתוני חשבון:** משך החשבון + 90 יום לאחר סגירה\\n* **נתוני אנליטיקה:** 12 חודשים מאיסוף\\n* **רישום לניוזלטר:** עד שתבטל מנוי + 30 יום\\n* **הגשות טפסי יצירת קשר:** 24 חודשים לאחר אינטראקציה אחרונה\\n* **רשומות הסכמה:** 3 שנים (להוכחת עמידה)\\n* **רשומות פיננסיות:** 7 שנים (דרישה חוקית)\\n\\nלאחר תקופות השמירה, הנתונים נמחקים לצמיתות או מאונמים.`
        },
        {
          icon: Shield,
          title: '8. אבטחת נתונים',
          content: `אנו מיישמים אמצעי אבטחה תקניים:\\n\\n* **הצפנה:** נתונים מוצפנים בתעבורה (TLS/SSL) ובמנוחה (AES-256)\\n* **בקרת גישה:** גישה מבוססת תפקיד, עקרון הרשאות מינימליות\\n* **אימות:** אימות רב-גורמי לגישה מנהלית\\n* **ניטור:** ניטור אבטחה 24/7 ותגובה לאירועים\\n* **ביקורות קבועות:** הערכות אבטחה תקופתיות ובדיקות חדירה\\n\\nלמרות שאנו נוקטים בכל אמצעי זהירות סביר, אין מערכת מאובטחת ב-100%. נודיע לך על כל פרצות נתונים כנדרש על פי חוק.`
        },
        {
          icon: UserX,
          title: '9. הזכויות שלך (GDPR ו-LGPD)',
          content: `יש לך את הזכויות הבאות בנוגע לנתונים האישיים שלך:\\n\\n**זכות גישה:** קבל עותק של הנתונים האישיים שלך\\n**זכות תיקון:** תקן נתונים לא מדויקים או לא שלמים\\n**זכות למחיקה (\"הזכות להישכח\"):** בקש מחיקת הנתונים שלך\\n**זכות הגבלה:** הגבל כיצד אנו מעבדים את הנתונים שלך\\n**זכות לניוד נתונים:** קבל את הנתונים שלך בפורמט קריא למחשב\\n**זכות להתנגד:** התנגד לעיבוד המבוסס על אינטרסים לגיטימיים\\n**זכות למשוך הסכמה:** משוך הסכמה בכל עת (לא משפיע על עיבוד חוקי קודם)\\n**זכות להגיש תלונה:** הגש תלונה לרשות הגנת הנתונים שלך\\n\\nלמימוש זכויות אלה, השתמש בטופס בקשת נתונים למטה או צור קשר ב-info@tariff-ai.com`
        },
        {
          icon: FileText,
          title: '10. פרטיות ילדים',
          content: `השירותים שלנו אינם מיועדים לאנשים מתחת לגיל 18. איננו אוספים ביודעין נתונים אישיים מילדים. אם נגלה שאספנו נתונים מילד, נמחק אותם מיד. הורים או אפוטרופסים שמאמינים שאספנו נתונים מילד צריכים ליצור איתנו קשר ב-info@tariff-ai.com`
        },
        {
          icon: Database,
          title: '11. קבלת החלטות אוטומטית',
          content: `איננו משתמשים בקבלת החלטות אוטומטית או פרופילינג שמייצר השפעות משפטיות או דומות עליך. כל פיצ\'רי האנליטיקה או הפרסונליזציה משמשים אך ורק לשיפור חוויית המשתמש וניתן לבטל אותם דרך העדפות העוגיות.`
        },
        {
          icon: Mail,
          title: '12. תקשורת שיווקית',
          content: `בהסכמתך, אנו עשויים לשלוח לך:\\n* עדכוני מוצר ופיצ\'רים חדשים\\n* תובנות תעשייתיות ותוכן חינוכי\\n* הצעות מיוחדות וקידומי מכירות\\n\\nניתן לבטל מנוי בכל עת על ידי:\\n* לחיצה על \"ביטול מנוי\" בכל דוא\"ל\\n* עדכון העדפות החשבון שלך\\n* יצירת קשר ב-info@tariff-ai.com`
        },
        {
          icon: Shield,
          title: '13. הודעה על פרצת נתונים',
          content: `במקרה של פרצת נתונים שמהווה סיכון לזכויות ולחירויות שלך, אנו:\\n* נודיע לרשות הפיקוח הרלוונטית תוך 72 שעות (GDPR) או כנדרש על פי LGPD\\n* נודיע לאנשים המושפעים ללא עיכוב מיותר\\n* נספק מידע על אופי הפריצה ופעולות תיקון\\n* נתעד את כל הפריצות לציות רגולטורי`
        },
        {
          icon: Globe,
          title: '14. שינויים במדיניות זו',
          content: `אנו עשויים לעדכן מדיניות פרטיות זו מעת לעת כדי לשקף שינויים בפרקטיקות שלנו או בדרישות חוקיות. אנו:\\n* נפרסם את המדיניות המעודכנת בדף זה\\n* נעדכן את תאריך \"עדכון אחרון\"\\n* נודיע לך על שינויים מהותיים באמצעות דוא\"ל או הודעה בולטת\\n* נקבל הסכמה חדשה כנדרש על פי חוק\\n\\nמשך השימוש בשירותים שלנו לאחר שינויים מהווה קבלה של המדיניות המעודכנת.`
        },
        {
          icon: Mail,
          title: '15. יצירת קשר וקצין הגנת נתונים',
          content: `לכל שאלה הקשורה לפרטיות או למימוש זכויותיך:\\n\\n**פניות כלליות:**\\nדוא\"ל: info@tariff-ai.com\\n\\n**פניות GDPR באיחוד האירופי:**\\nנציג איחוד אירופי: info@tariff-ai.com\\n\\n**פניות LGPD בברזיל:**\\nנציג ברזיל: info@tariff-ai.com\\n\\n**כתובת דואר:**\\ntariff.ai Privacy Team\\nSan Francisco, CA\\n\\n**רשויות פיקוח:**\\nאיחוד אירופי: רשות הגנת הנתונים המקומית שלך\\nברזיל: Autoridade Nacional de Proteção de Dados (ANPD)`
        }
      ]
    }
  };

  const t = content[language];

  return (
    <div className={minimal ? "p-4" : "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16"}>
      {!minimal && (
        <div className="mb-8">
           <h1 className="text-4xl sm:text-5xl font-bold text-[#114B5F] dark:text-white mb-2">{t.title}</h1>
           <p className="text-[#114B5F]/70 dark:text-gray-400">{t.lastUpdated}</p>
        </div>
      )}
      <div className="space-y-8">
        {t.sections.map((section, index) => {
          const Icon = section.icon;
          return (
            <motion.div
              key={index}
              initial={!minimal ? { opacity: 0, y: 20 } : undefined}
              animate={!minimal ? { opacity: 1, y: 0 } : undefined}
              transition={!minimal ? { delay: index * 0.03 } : undefined}
              className={`p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1a2d42] border border-[#114B5F]/10 dark:border-white/10 shadow-sm ${!minimal ? 'hover:shadow-md transition-shadow' : ''}`}
            >
              <div className={`flex items-start gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="p-3 rounded-xl bg-[#42C0B9]/10 flex-shrink-0">
                  <Icon className="w-6 h-6 text-[#42C0B9]" />
                </div>
                <div className="flex-1">
                  <h2 className={`text-xl font-semibold text-[#114B5F] dark:text-white mb-3 ${isRTL ? 'text-right' : ''}`}>
                    {section.title}
                  </h2>
                  <ReactMarkdown 
                    className={`text-[#114B5F]/70 dark:text-gray-400 leading-relaxed prose prose-sm max-w-none dark:prose-invert ${isRTL ? 'text-right' : ''}`}
                    components={{
                      p: ({ children }) => <p className="mb-3">{children}</p>,
                      ul: ({ children }) => <ul className="space-y-2 mb-4">{children}</ul>,
                      li: ({ children }) => (
                        <li className="flex items-start gap-2">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#42C0B9] mt-2 flex-shrink-0" />
                          <span>{children}</span>
                        </li>
                      ),
                      strong: ({ children }) => <strong className="font-semibold text-[#114B5F] dark:text-white">{children}</strong>,
                    }}
                  >
                    {section.content}
                  </ReactMarkdown>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}