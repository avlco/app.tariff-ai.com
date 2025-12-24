import React, { useEffect } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LanguageProvider, useLanguage } from '../components/providers/LanguageContext';
import Footer from '../components/home/Footer';
import ScrollToTop from '../components/home/ScrollToTop';
import TermsContent from '../components/legal/TermsContent';

function TermsWrapper() {
  const { language, isRTL } = useLanguage();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const t = {
    en: { back: 'Back to Home', title: 'Terms of Service', lastUpdated: 'Last updated: December 22, 2025 | Version 1.0', subtitle: 'This document outlines the legally binding agreement between you and tariff.ai regarding your use of our services.' },
    he: { back: 'חזרה לדף הבית', title: 'תנאי שירות', lastUpdated: 'עדכון אחרון: 22 בדצמבר 2025 | גרסה 1.0', subtitle: 'מסמך זה מתאר את ההסכם המחייב מבחינה משפטית בינך לבין tariff.ai בנוגע לשימושך בשירותינו.' }
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
              <FileText className="w-10 h-10 text-[#42C0B9]" />
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2">{t.title}</h1>
              <p className="text-white/70 text-sm">{t.lastUpdated}</p>
            </div>
          </div>
          <p className="text-white/80 text-lg max-w-3xl">{t.subtitle}</p>
        </div>
      </div>

      <TermsContent />

      <Footer />
      <ScrollToTop />
    </div>
  );
}

export default function Terms() {
  return (
    <LanguageProvider>
      <TermsWrapper />
    </LanguageProvider>
  );
}