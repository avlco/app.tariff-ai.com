import React from 'react';
import { useLanguage } from '../providers/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-12 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500 text-sm">
        <p>© {new Date().getFullYear()} tariff.ai. All rights reserved.</p>
        <p className="mt-2 text-xs">
            AI-Powered Trade Intelligence
        </p>
      </div>
    </footer>
  );
}