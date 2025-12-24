import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Handshake, FileText, User, CreditCard, Wrench, ShieldCheck, Gavel, LifeBuoy, RefreshCcw, Mail } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../../components/providers/LanguageContext';

export default function TermsContent({ minimal = false }) {
  const { language, isRTL } = useLanguage();

  const content = {
    en: {
      title: 'Terms of Service',
      subtitle: 'This document outlines the legally binding agreement between you and tariff.ai regarding your use of our services.',
      lastUpdated: 'Last updated: December 22, 2025 | Version 1.0',
      back: 'Back to Home',
      sections: [
        {
          icon: Handshake,
          title: '1. Acceptance of Terms',
          content: `By accessing or using any part of the tariff.ai website, platform, or services (collectively, \"the Service\"), you agree to be bound by these Terms of Service (\"Terms\"). If you do not agree to all the terms and conditions of this agreement, then you may not access the Service or use any services. These Terms constitute a legally binding agreement between you and tariff.ai. Your continued use of the Service signifies your acceptance of any updated Terms.`
        },
        {
          icon: FileText,
          title: '2. Description of Service',
          content: `tariff.ai provides AI-powered tariff analysis, trade intelligence, and related services designed to assist businesses with international trade compliance and strategy. The Service includes various features, subscription plans, and usage limits as described on our website and pricing pages. We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time, with or without notice.`
        },
        {
          icon: User,
          title: '3. User Accounts and Responsibilities',
          content: `To access and use certain features of the Service, you must register for a user account. You agree to:\\n\\n* **Provide Accurate Information:** Maintain accurate, complete, and current registration information.\\n* **Account Security:** Keep your username and password confidential and prevent unauthorized access to your account. You are solely responsible for all activities that occur under your account.\\n* **Prohibited Conduct:** Not use the Service for any unlawful purpose, or in any way that violates these Terms.\\n* **Age Restriction:** Confirm you are at least 18 years of age or the legal age of majority in your jurisdiction.`
        },
        {
          icon: CreditCard,
          title: '4. Payment Terms and Subscriptions',
          content: `**4.1 Subscription Fees:** Access to certain features of the Service requires a paid subscription. Subscription fees are billed in advance on a recurring basis (e.g., monthly or annually) as per your chosen plan.\n\n**4.2 Automatic Renewal:** Subscriptions automatically renew unless you cancel at least 24 hours before the end of the current billing period.\n\n**4.3 Price Changes:** We reserve the right to change our subscription fees upon 30 days\' prior notice. Your continued use after the price change constitutes your agreement to pay the modified amount.\n\n**4.4 Refunds and Cancellations:** All subscription fees are non-refundable, except as required by law. You may cancel your subscription at any time, and access will continue until the end of the current billing cycle.`
        },
        {
          icon: Wrench,
          title: '5. Use of Service and Prohibited Conduct',
          content: `You agree to use the Service only for lawful purposes and in accordance with these Terms. You shall not:\\n\\n* **Misuse:** Engage in any activity that interferes with or disrupts the Service.\\n* **Unauthorized Access:** Attempt to gain unauthorized access to any part of the Service, other accounts, computer systems, or networks.\\n* **Data Scraping:** Use any automated system or software to extract data from the Service without express written permission.\\n* **Harmful Content:** Transmit any malicious code, viruses, or other harmful data.\\n* **Resale:** Reproduce, duplicate, copy, sell, resell, or exploit any portion of the Service without our express written permission.`
        },
        {
          icon: ShieldCheck,
          title: '6. Data Accuracy and Disclaimers',
          content: `While tariff.ai strives to provide accurate and up-to-date tariff information and trade intelligence, we do not guarantee the accuracy, completeness, or timeliness of any data provided through the Service. The information is for general informational purposes only and does not constitute legal, financial, or professional advice. You are solely responsible for verifying critical information with official sources and for all decisions made based on the Service\'s output.`
        },
        {
          icon: Gavel,
          title: '7. Intellectual Property',
          content: `All content, features, and functionality of tariff.ai are the exclusive property of tariff.ai and its licensors and are protected by international copyright, trademark, patent, and trade secret laws. We grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your internal business purposes, subject to these Terms.`
        },
        {
          icon: LifeBuoy,
          title: '8. Limitation of Liability',
          content: `In no event shall tariff.ai, its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.`
        },
        {
          icon: User,
          title: '9. Termination',
          content: `We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease.`
        },
        {
          icon: Gavel,
          title: '10. Governing Law',
          content: `These Terms shall be governed and construed in accordance with the laws of the State of California, United States, without regard to its conflict of law provisions.`
        },
        {
          icon: RefreshCcw,
          title: '11. Changes to Terms',
          content: `We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days\' notice. By continuing to access or use our Service after revisions become effective, you agree to be bound by the revised terms.`
        },
        {
          icon: FileText,
          title: '12. Miscellaneous',
          content: `These Terms constitute the entire agreement between you and tariff.ai regarding our Service. Our failure to enforce any right or provision will not be considered a waiver. If any provision is held invalid, the remaining provisions will remain in effect.`
        },
        {
          icon: Mail,
          title: '13. Contact Information',
          content: `For any questions regarding these Terms of Service, please contact us at info@tariff-ai.com. We will respond to all inquiries within 5 business days.`
        }
      ]
    },
    he: {
      title: 'תנאי שירות',
      subtitle: 'מסמך זה מתאר את ההסכם המחייב מבחינה משפטית בינך לבין tariff.ai בנוגע לשימושך בשירותינו.',
      lastUpdated: 'עדכון אחרון: 22 בדצמבר 2025 | גרסה 1.0',
      back: 'חזרה לדף הבית',
      sections: [
        {
          icon: Handshake,
          title: '1. קבלת התנאים',
          content: `על ידי גישה או שימוש בכל חלק מאתר, פלטפורמה או שירותי tariff.ai (יחד, \"השירות\"), אתה מסכים להיות מחויב לתנאי שירות אלה (\"התנאים\"). אם אינך מסכים לכל התנאים וההגבלות של הסכם זה, אינך רשאי לגשת לשירות או להשתמש בשירותים כלשהם.`
        },
        {
          icon: FileText,
          title: '2. תיאור השירות',
          content: `tariff.ai מספקת ניתוח מכסים מבוסס AI, מודיעין סחר ושירותים קשורים שנועדו לסייע לעסקים בעמידה בתקנות סחר בינלאומיות ובאסטרטגיה. השירות כולל תכונות שונות, תוכניות מנוי ומגבלות שימוש כמתואר באתר.`
        },
        {
          icon: User,
          title: '3. חשבונות משתמש ואחריות',
          content: `לשימוש בתכונות מסוימות, עליך להירשם לחשבון. אתה מסכים לספק מידע מדויק, לשמור על אבטחת החשבון, ולא להשתמש בשירות למטרה בלתי חוקית. אתה האחראי הבלעדי לכל הפעילויות בחשבונך.`
        },
        {
          icon: CreditCard,
          title: '4. תנאי תשלום ומנויים',
          content: `דמי המנוי מחויבים מראש על בסיס חוזר. מנויים מתחדשים אוטומטית אלא אם תבטל לפחות 24 שעות לפני סיום תקופת החיוב. דמי המנוי אינם ניתנים להחזר, למעט כנדרש על פי חוק.`
        },
        {
          icon: Wrench,
          title: '5. שימוש בשירות והתנהגות אסורה',
          content: `אתה מסכים להשתמש בשירות למטרות חוקיות בלבד. אסור לבצע שימוש לרעה, גישה בלתי מורשית, גירוד נתונים, העברת תוכן מזיק, מכירה חוזרת או הנדסה לאחור של השירות.`
        },
        {
          icon: ShieldCheck,
          title: '6. דיוק נתונים והצהרות ויתור',
          content: `בעוד ש-tariff.ai שואפת לספק מידע מדויק, איננו מבטיחים דיוק, שלמות או עדכניות של נתונים. המידע הוא למטרות מידע כללי בלבד ואינו מהווה ייעוץ משפטי או פיננסי. אתה האחראי הבלעדי לוודא מידע קריטי.`
        },
        {
          icon: Gavel,
          title: '7. קניין רוחני',
          content: `כל התוכן והפונקציונליות של tariff.ai הם רכוש בלעדי שלנו ומוגנים על ידי חוקי קניין רוחני בינלאומיים. אנו מעניקים לך רישיון מוגבל, בלתי ניתן להעברה, לגשת ולהשתמש בשירות למטרות עסקיות פנימיות בלבד.`
        },
        {
          icon: LifeBuoy,
          title: '8. הגבלת אחריות',
          content: `tariff.ai לא תהיה אחראית לכל נזק עקיף, מקרי, מיוחד, תוצאתי או עונשי, לרבות אובדן רווחים, נתונים או שימוש, הנובע מגישתך או שימושך בשירות.`
        },
        {
          icon: User,
          title: '9. סיום השירות',
          content: `אנו רשאים לסיים או להשעות את חשבונך באופן מיידי, ללא הודעה מוקדמת, מכל סיבה שהיא, במיוחד אם הפרת את התנאים. עם סיום, זכותך להשתמש בשירות תופסק.`
        },
        {
          icon: Gavel,
          title: '10. חוק חל',
          content: `תנאים אלה יחולו ויפורשו בהתאם לחוקי מדינת קליפורניה, ארצות הברית, ללא התייחסות להוראות ניגוד החוקים.`
        },
        {
          icon: RefreshCcw,
          title: '11. שינויים בתנאים',
          content: `אנו שומרים לעצמנו את הזכות לשנות תנאים אלה בכל עת. אם שינוי הוא מהותי, אנו נספק הודעה מוקדמת של 30 יום. המשך השימוש לאחר תיקונים מהווה הסכמה לתנאים המעודכנים.`
        },
        {
          icon: FileText,
          title: '12. שונות',
          content: `תנאים אלה מהווים את ההסכם המלא בינך לבין tariff.ai. כשלנו לאכוף זכות לא ייחשב כוויתור. אם הוראה תיחשב בלתי תקפה, יתר ההוראות יישארו בתוקף.`
        },
        {
          icon: Mail,
          title: '13. פרטי התקשרות',
          content: `לכל שאלה בנוגע לתנאי שימוש אלה, אנא צור קשר ב-info@tariff-ai.com. אנו נגיב תוך 5 ימי עסקים.`
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