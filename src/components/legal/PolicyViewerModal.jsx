import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '../providers/LanguageContext';
import PrivacyContent from './PrivacyContent';
import TermsContent from './TermsContent';
import { X, ChevronLeft, ChevronRight, FileText, Shield } from 'lucide-react';

export default function PolicyViewerModal({ initialTab = 'terms', onClose }) {
  const { language, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState(initialTab); // terms, privacy

  const t = {
    en: {
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
      close: 'Close',
    },
    he: {
      terms: 'תנאי שימוש',
      privacy: 'מדיניות פרטיות',
      close: 'סגור',
    }
  }[language];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
             <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                    onClick={() => setActiveTab('terms')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'terms' ? 'bg-white dark:bg-slate-700 shadow-sm text-[#114B5F] dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                >
                    <FileText className="w-4 h-4" />
                    {t.terms}
                </button>
                <button
                    onClick={() => setActiveTab('privacy')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'privacy' ? 'bg-white dark:bg-slate-700 shadow-sm text-[#114B5F] dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                >
                    <Shield className="w-4 h-4" />
                    {t.privacy}
                </button>
             </div>

             <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                 <X className="w-5 h-5" />
             </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
            <ScrollArea className="h-full p-6">
                <AnimatePresence mode="wait">
                    {activeTab === 'terms' ? (
                        <motion.div
                            key="terms"
                            initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <TermsContent minimal={true} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="privacy"
                            initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <PrivacyContent minimal={true} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </ScrollArea>
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex justify-between items-center">
             <div className="text-xs text-slate-400">
                tariff.ai legal documents
             </div>
             
             <div className="flex gap-2">
                 {activeTab === 'privacy' && (
                     <Button variant="outline" size="sm" onClick={() => setActiveTab('terms')}>
                         {isRTL ? <ChevronRight className="w-4 h-4 me-2" /> : <ChevronLeft className="w-4 h-4 me-2" />}
                         {t.terms}
                     </Button>
                 )}
                 {activeTab === 'terms' && (
                     <Button variant="outline" size="sm" onClick={() => setActiveTab('privacy')}>
                         {t.privacy}
                         {isRTL ? <ChevronLeft className="w-4 h-4 ms-2" /> : <ChevronRight className="w-4 h-4 ms-2" />}
                     </Button>
                 )}
             </div>
        </div>
      </motion.div>
    </div>
  );
}