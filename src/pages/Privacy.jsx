import React, { useEffect } from 'react';
import { ArrowLeft, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LanguageProvider, useLanguage } from '../components/providers/LanguageContext';
import Footer from '../components/home/Footer';
import ScrollToTop from '../components/home/ScrollToTop';
import DataRequestForm from '../components/DataRequestForm';
import PrivacyContent from '../components/legal/PrivacyContent';
import { motion } from 'framer-motion';

function PrivacyWrapper() {
  const { language, isRTL } = useLanguage();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const t = {
    en: { back: 'Back to Home', title: 'Privacy Policy', lastUpdated: 'Last updated: December 22, 2025 | Version 1.0', subtitle: 'Your privacy is our priority. This policy explains how we collect, use, protect, and handle your personal data in compliance with GDPR and LGPD.', dataRequest: 'Exercise Your Data Rights', dataRequestDesc: 'Request access, correction, or deletion of your personal data' },
    he: { back: 'חזרה לדף הבית', title: 'מדיניות פרטיות', lastUpdated: 'עדכון אחרון: 22 בדצמבר 2025 | גרסה 1.0', subtitle: 'הפרטיות שלך היא בראש סדר העדיפויות שלנו. מדיניות זו מסבירה כיצד אנו אוספים, משתמשים, מגנים ומטפלים בנתונים האישיים שלך בהתאם ל-GDPR ו-LGPD.', dataRequest: 'מימוש זכויות הנתונים שלך', dataRequestDesc: 'בקש גישה, תיקון או מחיקה של הנתונים האישיים שלך' }
  }[language];

  return (
    <div className={`min-h-screen bg-gradient-to-b from-white to-[#f8fafa] dark:from-[#0a1628] dark:to-[#0d1f35] ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#114B5F] via-[#0d3a4a] to-[#114B5F] dark:from-[#0d1f35] dark:via-[#0a1628] dark:to-[#0d1f35] py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link 
            to={createPageUrl('Home')}
            className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
            {t.back}
          </Link>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm">
              <Shield className="w-10 h-10 text-[#42C0B9]" />
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2">{t.title}</h1>
              <p className="text-white/70 text-sm">{t.lastUpdated}</p>
            </div>
          </div>
          <p className="text-white/80 text-lg max-w-3xl">{t.subtitle}</p>
        </div>
      </div>

      <PrivacyContent />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8"
        >
            <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-[#114B5F] dark:text-white mb-3">
                {t.dataRequest}
            </h2>
            <p className="text-[#114B5F]/70 dark:text-gray-400">
                {t.dataRequestDesc}
            </p>
            </div>
            <DataRequestForm />
        </motion.div>
      </div>

      <Footer />
      <ScrollToTop />
    </div>
  );
}

export default function Privacy() {
  return (
    <LanguageProvider>
      <PrivacyWrapper />
    </LanguageProvider>
  );
}