import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Cookie, CheckCircle2, XCircle, Clock, Settings, Globe, Database, Shield, Lock, FileText, Mail } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../../components/providers/LanguageContext';

export default function CookiesContent({ minimal = false }) {
  const { language, isRTL } = useLanguage();

  const content = {
    en: {
      title: 'Cookie Policy',
      subtitle: 'Understanding how we use cookies and similar technologies on tariff.ai',
      lastUpdated: 'Last updated: December 22, 2025 | Version 1.0',
      back: 'Back to Home',
      sections: [
        {
          icon: Cookie,
          title: '1. What Are Cookies',
          content: `Cookies are small text files stored on your device (computer, tablet, or mobile phone) when you visit a website. They help websites remember your preferences, understand how you use them, and provide a better user experience.\\n\\n**Key Characteristics:**\\n* Text files (not programs or viruses)\\n* Store information about your visit\\n* Can be deleted or blocked at any time\\n* Come in different types with different purposes`
        },
        {
          icon: Settings,
          title: '2. How We Use Cookies',
          content: `tariff.ai uses cookies for the following purposes:\\n\\n**Essential Functions:**\\n* Maintain your logged-in session\\n* Remember your language and theme preferences\\n* Secure your connection to our services\\n\\n**Analytics & Performance:**\\n* Understand which pages are most popular\\n* Analyze user behavior to improve our service\\n* Track technical errors and bugs\\n\\n**User Experience:**\\n* Remember your cookie consent preferences\\n* Personalize content based on your interests\\n* Optimize site performance`
        },
        {
          icon: CheckCircle2,
          title: '3. Types of Cookies We Use',
          content: `**3.1 Essential Cookies (Always Active)**\\nThese cookies are necessary for the website to function and cannot be disabled.\\n\\n* **Session Management:** Keeps you logged in as you navigate\\n* **Security:** Protects against CSRF and other attacks\\n* **Load Balancing:** Distributes traffic across servers\\n\\nExamples: session_id, csrf_token, auth_state\\n\\n**3.2 Analytics Cookies (Requires Consent)**\\nHelp us understand how visitors interact with our website.\\n\\n* **Page Views:** Track which pages are visited (PageView entity)\\n* **User Actions:** Monitor clicks, form submissions, scrolling (UserAction entity)\\n* **Session Data:** Analyze user journey and engagement\\n* **Device Info:** Browser type, OS, screen resolution, language\\n\\nExamples: Google Analytics\\n\\n**3.3 Marketing Cookies (Requires Consent)**\\nUsed to deliver relevant advertisements and measure campaign effectiveness.\\n\\n* **Ad Targeting:** Show relevant ads based on interests\\n* **Conversion Tracking:** Measure effectiveness of campaigns\\n* **Retargeting:** Display ads to previous visitors\\n\\nExamples: Facebook Pixel, Google Ads\\n\\nNote: Marketing cookies are currently not active on tariff.ai`
        },
        {
          icon: Clock,
          title: '4. Cookie Duration',
          content: `**Session Cookies (Temporary)**\\nThese cookies expire when you close your browser.\\n\\n* Duration: Until browser closes\\n* Purpose: Maintain active session, navigation state\\n* Examples: PHPSESSID, session_token\\n* Storage: Browser memory only\\n\\n**Persistent Cookies (Long-term)**\\nThese cookies remain on your device for a specified period.\\n\\n* **Short-term:** 24 hours to 30 days (analytics)\\n* **Medium-term:** 30 days to 1 year (preferences)\\n* **Long-term:** 1-2 years (consent records)\\n\\nExamples:\\n* Cookie Consent: 1 year (stores your cookie preferences)\\n* Analytics Session: 12 months (tracks returning visitors)\\n* Language Preference: 6 months (remembers your language choice)`
        },
        {
          icon: Database,
          title: '5. Cookies We Use - Detailed List',
          content: `**Essential Cookies:**\n\n| Cookie Name | Purpose | Duration | Type |\n|---|---|---|---|\n| session_id | User session management | Session | First-party |\n| analytics_session_id | Analytics tracking ID | 12 months | First-party |\n| cookie_consent | Stores consent preferences | 1 year | First-party |\n\n**Analytics Cookies (with consent):**\n\n| Cookie Name | Purpose | Duration | Type |\n|---|---|---|---|\n| Page tracking | Records page views | 12 months | First-party |\n| Action tracking | Records user interactions | 12 months | First-party |\n| Session data | Tracks user sessions | 30 minutes | First-party |`
        },
        {
          icon: Globe,
          title: '6. Third-Party Cookies',
          content: `Currently, tariff.ai minimizes the use of third-party cookies. However, we may use:\\n\\n**Base44 Platform (Infrastructure Provider):**\\n* Essential for application functionality\\n* Secure data processing\\n* Covered by our Data Processing Agreement (DPA)\\n\\n**Future Third-Party Services:**\\nIf we integrate additional third-party services (analytics, payment processors, etc.), we will:\\n* Update this policy with details\\n* Request your consent where required\\n* Provide opt-out mechanisms\\n* Ensure GDPR/LGPD compliance\\n\\n**Note:** We do NOT use third-party advertising networks or social media tracking pixels.`
        },
        {
          icon: Settings,
          title: '7. Managing Your Cookie Preferences',
          content: `**7.1 Through Our Cookie Banner:**\nWhen you first visit tariff.ai, you\'ll see a cookie consent banner allowing you to:\n* Accept all cookies\n* Accept only essential cookies\n* Customize your preferences (choose which categories to allow)\n\nYour preferences are saved and can be changed at any time.\n\n**7.2 Through Your Browser:**\nAll modern browsers allow you to control cookies:\n\n**Google Chrome:**\n1. Settings → Privacy and security → Cookies and other site data\n2. Choose: Allow all, Block third-party, or Block all\n\n\n**Mozilla Firefox:**\n1. Settings → Privacy & Security → Cookies and Site Data\n2. Choose standard, strict, or custom blocking\n\n\n**Safari (Mac/iOS):**\n1. Preferences → Privacy → Cookies and website data\n2. Block all cookies or allow from current website only\n\n\n**Microsoft Edge:**\n1. Settings → Cookies and site permissions → Manage cookies\n2. Choose blocking level\n\n\n**Important:** Blocking essential cookies will prevent the site from functioning properly.`
        },
        {
          icon: XCircle,
          title: '8. Disabling Cookies - Impact',
          content: `**If You Disable All Cookies:**\\n* ❌ Cannot stay logged in\\n* ❌ Settings and preferences won\'t be saved\\n* ❌ Some features may not work\\n* ❌ You\'ll need to set preferences on every visit\\n\\n**If You Disable Only Non-Essential Cookies:**\\n* ✅ Website will function normally\\n* ✅ You\'ll stay logged in\\n* ❌ We won\'t be able to improve the site based on usage data\\n* ❌ You may see less relevant content\\n\\n**Recommendation:** Keep essential cookies enabled, customize analytics/marketing based on your privacy preferences.`
        },
        {
          icon: Shield,
          title: '9. Do Not Track (DNT)',
          content: `Some browsers offer a \"Do Not Track\" (DNT) signal that indicates you don\'t want to be tracked.\\n\\n**Our Approach:**\\n* We honor your cookie consent choices through our banner\\n* DNT signals are not universally standardized\\n* Your explicit cookie preferences take precedence\\n* We provide granular control through our cookie settings\\n\\n**Best Practice:** Use our cookie consent banner for precise control over tracking.`
        },
        {
          icon: Lock,
          title: '10. Data Collected Through Cookies',
          content: `The data collected through cookies includes:\\n\\n**Device Information:**\\n* IP address (anonymized after 90 days)\\n* Browser type and version\\n* Operating system\\n* Device type (mobile, tablet, desktop)\\n* Screen resolution\\n\\n**Usage Information:**\\n* Pages visited and time spent\\n* Click patterns and interactions\\n* Referrer URL (where you came from)\\n* Session duration\\n* Scroll depth\\n\\n**Technical Information:**\\n* Language preference\\n* Timezone\\n* Connection type\\n* Viewport size\\n\\nAll data is processed in accordance with our Privacy Policy and GDPR/LGPD requirements.`
        },
        {
          icon: FileText,
          title: '11. Your Rights',
          content: `Under GDPR and LGPD, you have the right to:\\n\\n✓ **Be Informed:** This Cookie Policy explains our practices\\n\\n✓ **Give or Withdraw Consent:** Control which cookies are used\\n\\n✓ **Access Your Data:** Request information about cookies stored\\n\\n✓ **Delete Data:** Request deletion of cookie data\\n\\n✓ **Object to Processing:** Opt out of non-essential cookies\\n\\nTo exercise these rights, visit our Privacy Policy page or contact info@tariff-ai.com`
        },
        {
          icon: Globe,
          title: '12. International Users',
          content: `**For EU Users (GDPR):**\\n* We obtain explicit consent before non-essential cookies\\n* You can withdraw consent at any time\\n* Data transfers comply with Standard Contractual Clauses (SCCs)\\n\\n**For Brazilian Users (LGPD):**\\n* We obtain consent for non-essential cookies\\n* You have the right to revoke consent\\n* Data processing complies with LGPD requirements\\n\\n**For All Users:**\\nCookie data is subject to the same protections as other personal data under our Privacy Policy.`
        },
        {
          icon: Settings,
          title: '13. Updates to This Cookie Policy',
          content: `We may update this Cookie Policy to reflect:\\n* Changes in technology or cookie usage\\n* New features or services\\n* Legal or regulatory requirements\\n* User feedback and best practices\\n\\n**When We Update:**\\n* The \"Last Updated\" date will change\\n* Material changes will be highlighted\\n* You may be asked to review and accept new terms\\n* Previous versions will be archived\\n\\n**Staying Informed:**\\nReview this policy periodically to stay informed about how we use cookies.`
        },
        {
          icon: Mail,
          title: '14. Contact Us',
          content: `If you have questions about our use of cookies:\\n\\n**Email:** info@tariff-ai.com\\n\\n**Subject Line:** \"Cookie Policy Inquiry\"\\n\\n**What to Include:**\\n* Your question or concern\\n* Browser and device information (if technical issue)\\n* Screenshots (if helpful)\\n\\nWe respond to all cookie-related inquiries within 48 hours.\\n\\n**For GDPR/LGPD-specific inquiries:**\\n* EU: info@tariff-ai.com\\n* Brazil: info@tariff-ai.com`
        }
      ]
    },
    he: {
      title: 'מדיניות עוגיות',
      subtitle: 'הבנת אופן השימוש שלנו בעוגיות וטכנולוגיות דומות ב-tariff.ai',
      lastUpdated: 'עדכון אחרון: 22 בדצמבר 2025 | גרסה 1.0',
      back: 'חזרה לדף הבית',
      sections: [
        {
          icon: Cookie,
          title: '1. מה הן עוגיות',
          content: `עוגיות הן קבצי טקסט קטנים המאוחסנים במכשיר שלך (מחשב, טאבלט או טלפון נייד) כאשר אתה מבקר באתר אינטרנט. הן עוזרות לאתרים לזכור את ההעדפות שלך, להבין כיצד אתה משתמש בהם ולספק חוויית משתמש טובה יותר.\\n\\n**מאפיינים מרכזיים:**\\n* קבצי טקסט (לא תוכניות או וירוסים)\\n* מאחסנים מידע על הביקור שלך\\n* ניתן למחוק או לחסום בכל עת\\n* מגיעים בסוגים שונים עם מטרות שונות`
        },
        {
          icon: Settings,
          title: '2. כיצד אנו משתמשים בעוגיות',
          content: `tariff.ai משתמש בעוגיות למטרות הבאות:\\n\\n**פונקציות חיוניות:**\\n* שמירה על הסשן המחובר שלך\\n* זכירת העדפות השפה והעיצוב שלך\\n* אבטחת החיבור שלך לשירותים שלנו\\n\\n**אנליטיקה וביצועים:**\\n* הבנת אילו דפים הכי פופולריים\\n* ניתוח התנהגות משתמשים לשיפור השירות\\n* מעקב אחר שגיאות טכניות ובאגים\\n\\n**חוויית משתמש:**\\n* זכירת העדפות הסכמת העוגיות שלך\\n* התאמה אישית של תוכן על בסיס תחומי עניין\\n* אופטימיזציה של ביצועי האתר`
        },
        {
          icon: CheckCircle2,
          title: '3. סוגי העוגיות שבהן אנו משתמשים',
          content: `**3.1 עוגיות חיוניות (פעילות תמיד)**\\nעוגיות אלו נחוצות לתפקוד האתר ולא ניתן להשבית אותן.\\n\\n* **ניהול סשן:** שומר אותך מחובר בזמן הניווט\\n* **אבטחה:** מגן מפני CSRF והתקפות אחרות\\n* **איזון עומסים:** מפזר תעבורה בין שרתים\\n\\nדוגמאות: session_id, csrf_token, auth_state\\n\\n**3.2 עוגיות אנליטיות (דורש הסכמה)**\\nעוזרות לנו להבין כיצד מבקרים מתקשרים עם האתר שלנו.\\n\\n* **צפיות בדפים:** מעקב אחר אילו דפים מבקרים (ישות PageView)\\n* **פעולות משתמש:** ניטור קליקים, הגשות טפסים, גלילה (ישות UserAction)\\n* **נתוני סשן:** ניתוח מסע משתמש ומעורבות\\n* **מידע על מכשיר:** סוג דפדפן, מערכת הפעלה, רזולוציית מסך, שפה\\n\\nדוגמאות: Google Analytics\\n\\n**3.3 עוגיות שיווקיות (דורש הסכמה)**\\nמשמשות להצגת פרסומות רלוונטיות ולמדידת יעילות קמפיינים.\\n\\n* **מיקוד מודעות:** הצגת מודעות רלוונטיות על בסיס תחומי עניין\\n* **מעקב המרות:** מדידת יעילות קמפיינים\\n* **מיקוד מחדש:** הצגת מודעות למבקרים קודמים\\n\\nדוגמאות: Facebook Pixel, Google Ads\\n\\nהערה: עוגיות שיווקיות אינן פעילות כרגע ב-tariff.ai`
        },
        {
          icon: Clock,
          title: '4. משך העוגיות',
          content: `**עוגיות סשן (זמניות)**\\nעוגיות אלו פגות כאשר אתה סוגר את הדפדפן.\\n\\n* משך: עד סגירת הדפדפן\\n* מטרה: שמירה על סשן פעיל, מצב ניווט\\n* דוגמאות: PHPSESSID, session_token\\n* אחסון: זיכרון דפדפן בלבד\\n\\n**עוגיות קבועות (ארוכות טווח)**\\nעוגיות אלו נשארות במכשיר שלך לתקופה מוגדרת.\\n\\n* **קצר טווח:** 24 שעות עד 30 יום (אנליטיקה)\\n* **בינוני טווח:** 30 יום עד שנה (העדפות)\\n* **ארוך טווח:** 1-2 שנים (רשומות הסכמה)\\n\\nדוגמאות:\\n* Cookie Consent: שנה (שומר את העדפות העוגיות שלך)\\n* Analytics Session: 12 חודשים (עוקב אחר מבקרים חוזרים)\\n* Language Preference: 6 חודשים (זוכר את בחירת השפה שלך)`
        },
        {
          icon: Database,
          title: '5. עוגיות שאנו משתמשים בהן - רשימה מפורטת',
          content: `**עוגיות חיוניות:**\n\n| שם עוגייה | מטרה | משך | סוג |\n|---|---|---|---|\n| session_id | ניהול סשן משתמש | סשן | צד ראשון |\n| analytics_session_id | מזהה מעקב אנליטיקה | 12 חודשים | צד ראשון |\n| cookie_consent | שומר העדפות הסכמה | שנה | צד ראשון |\n\n**עוגיות אנליטיות (עם הסכמה):**\n\n| שם עוגייה | מטרה | משך | סוג |\n|---|---|---|---|\n| מעקב דפים | רישום צפיות בדפים | 12 חודשים | צד ראשון |\n| מעקב פעולות | רישום אינטראקציות משתמש | 12 חודשים | צד ראשון |\n| נתוני סשן | מעקב סשני משתמש | 30 דקות | צד ראשון |`
        },
        {
          icon: Globe,
          title: '6. עוגיות צד שלישי',
          content: `כרגע, tariff.ai ממזער את השימוש בעוגיות צד שלישי. עם זאת, אנו עשויים להשתמש:\\n\\n**פלטפורמת Base44 (ספק תשתית):**\\n* חיוני לתפקוד האפליקציה\\n* עיבוד נתונים מאובטח\\n* מכוסה בהסכם עיבוד הנתונים (DPA) שלנו\\n\\n**שירותי צד שלישי עתידיים:**\\nאם נשלב שירותי צד שלישי נוספים (אנליטיקה, מעבדי תשלומים וכו\'), אנו:\\n* נעדכן מדיניות זו עם הפרטים\\n* נבקש את הסכמתך כנדרש\\n* נספק מנגנוני ביטול\\n* נבטיח עמידה ב-GDPR/LGPD\\n\\n**הערה:** איננו משתמשים ברשתות פרסום צד שלישי או בפיקסלי מעקב של מדיה חברתית.`
        },
        {
          icon: Settings,
          title: '7. ניהול העדפות העוגיות שלך',
          content: `**7.1 דרך באנר העוגיות שלנו:**\nכאשר אתה מבקר לראשונה ב-tariff.ai, תראה באנר הסכמת עוגיות המאפשר לך:\n* לקבל את כל העוגיות\n* לקבל רק עוגיות חיוניות\n* להתאים אישית את ההעדפות שלך (לבחור אילו קטגוריות לאפשר)\n\nההעדפות שלך נשמרות וניתן לשנות אותן בכל עת.\n\n**7.2 דרך הדפדפן שלך:**\nכל הדפדפנים המודרניים מאפשרים לך לשלוט בעוגיות:\n\n**Google Chrome:**\n1. הגדרות ← פרטיות ואבטחה ← עוגיות ונתוני אתרים אחרים\n2. בחר: אפשר הכל, חסום צד שלישי, או חסום הכל\n\n\n**Mozilla Firefox:**\n1. הגדרות ← פרטיות ואבטחה ← עוגיות ונתוני אתרים\n2. בחר חסימה סטנדרטית, מחמירה או מותאמת אישית\n\n\n**Safari (Mac/iOS):**\n1. העדפות ← פרטיות ← עוגיות ונתוני אתרים\n2. חסום את כל העוגיות או אפשר מאתר נוכחי בלבד\n\n\n**Microsoft Edge:**\n1. הגדרות ← הרשאות עוגיות ואתרים ← נהל עוגיות\n2. בחר רמת חסימה\n\n\n**חשוב:** חסימת עוגיות חיוניות תמנע מהאתר לפעול כראוי.`
        },
        {
          icon: XCircle,
          title: '8. השבתת עוגיות - השפעה',
          content: `**אם תשבית את כל העוגיות:**\\n* ❌ לא תוכל להישאר מחובר\\n* ❌ הגדרות והעדפות לא יישמרו\\n* ❌ תכונות מסוימות עלולות לא לעבוד\\n* ❌ תצטרך להגדיר העדפות בכל ביקור\\n\\n**אם תשבית רק עוגיות לא חיוניות:**\\n* ✅ האתר יפעל כרגיל\\n* ✅ תישאר מחובר\\n* ❌ לא נוכל לשפר את האתר על בסיס נתוני שימוש\\n* ❌ עלול לראות תוכן פחות רלוונטי\\n\\n**המלצה:** השאר עוגיות חיוניות מופעלות, התאם אישית אנליטיקה/שיווק על בסיס העדפות הפרטיות שלך.`
        },
        {
          icon: Shield,
          title: '9. אל תעקוב (DNT)',
          content: `חלק מהדפדפנים מציעים אות \"אל תעקוב\" (DNT) המציין שאתה לא רוצה שיעקבו אחריך.\\n\\n**הגישה שלנו:**\\n* אנו מכבדים את בחירות הסכמת העוגיות שלך דרך הבאנר שלנו\\n* אותות DNT אינם סטנדרטיים באופן אוניברסלי\\n* העדפות העוגיות המפורשות שלך גוברות\\n* אנו מספקים שליטה מפורטת דרך הגדרות העוגיות שלנו\\n\\n**Best Practice:** Use our cookie consent banner for precise control over tracking.`
        },
        {
          icon: Lock,
          title: '10. נתונים שנאספים דרך עוגיות',
          content: `הנתונים הנאספים דרך עוגיות כוללים:\\n\\n**מידע על מכשיר:**\\n* IP address (מאונמת לאחר 90 יום)\\n* סוג דפדפן וגרסה\\n* מערכת הפעלה\\n* סוג מכשיר (נייד, טאבלט, שולחני)\\n* רזולוציית מסך\\n\\n**מידע על שימוש:**\\n* Pages visited and time spent\\n* Click patterns and interactions\\n* Referrer URL (where you came from)\\n* Session duration\\n* Scroll depth\\n\\n**Technical Information:**\\n* Language preference\\n* Timezone\\n* Connection type\\n* Viewport size\\n\\nAll data is processed in accordance with our Privacy Policy and GDPR/LGPD requirements.`
        },
        {
          icon: FileText,
          title: '11. Your Rights',
          content: `Under GDPR and LGPD, you have the right to:\\n\\n✓ **Be Informed:** This Cookie Policy explains our practices\\n\\n✓ **Give or Withdraw Consent:** Control which cookies are used\\n\\n✓ **Access Your Data:** Request information about cookies stored\\n\\n✓ **Delete Data:** Request deletion of cookie data\\n\\n✓ **Object to Processing:** Opt out of non-essential cookies\\n\\nTo exercise these rights, visit our Privacy Policy page or contact info@tariff-ai.com`
        },
        {
          icon: Globe,
          title: '12. International Users',
          content: `**For EU Users (GDPR):**\\n* We obtain explicit consent before non-essential cookies\\n* You can withdraw consent at any time\\n* Data transfers comply with Standard Contractual Clauses (SCCs)\\n\\n**For Brazilian Users (LGPD):**\\n* We obtain consent for non-essential cookies\\n* You have the right to revoke consent\\n* Data processing complies with LGPD requirements\\n\\n**For All Users:**\\nCookie data is subject to the same protections as other personal data under our Privacy Policy.`
        },
        {
          icon: Settings,
          title: '13. Updates to This Cookie Policy',
          content: `We may update this Cookie Policy to reflect:\\n* Changes in technology or cookie usage\\n* New features or services\\n* Legal or regulatory requirements\\n* User feedback and best practices\\n\\n**When We Update:**\\n* The \"Last Updated\" date will change\\n* Material changes will be highlighted\\n* You may be asked to review and accept new terms\\n* Previous versions will be archived\\n\\n**Staying Informed:**\\nReview this policy periodically to stay informed about how we use cookies.`
        },
        {
          icon: Mail,
          title: '14. Contact Us',
          content: `If you have questions about our use of cookies:\\n\\n**Email:** info@tariff-ai.com\\n\\n**Subject Line:** \"Cookie Policy Inquiry\"\\n\\n**What to Include:**\\n* Your question or concern\\n* Browser and device information (if technical issue)\\n* Screenshots (if helpful)\\n\\nWe respond to all cookie-related inquiries within 48 hours.\\n\\n**For GDPR/LGPD-specific inquiries:**\\n* EU: info@tariff-ai.com\\n* Brazil: info@tariff-ai.com`
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
                      table: ({ children }) => (
                        <div className="w-full overflow-x-auto rounded-lg border border-[#114B5F]/20 dark:border-white/20 my-4 shadow-sm">
                          <table className="w-full text-left text-sm">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => <thead className="bg-gradient-to-r from-[#42C0B9]/10 to-[#114B5F]/10 dark:from-[#42C0B9]/20 dark:to-[#114B5F]/20">{children}</thead>,
                      th: ({ children }) => <th className="px-4 py-3 font-semibold text-[#114B5F] dark:text-white text-xs uppercase tracking-wider border-b-2 border-[#42C0B9]/30">{children}</th>,
                      tbody: ({ children }) => <tbody className="divide-y divide-[#114B5F]/10 dark:divide-white/10">{children}</tbody>,
                      tr: ({ children }) => <tr className="hover:bg-[#42C0B9]/5 dark:hover:bg-[#42C0B9]/10 transition-colors">{children}</tr>,
                      td: ({ children }) => <td className="px-4 py-3 text-[#114B5F]/80 dark:text-gray-300">{children}</td>,
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