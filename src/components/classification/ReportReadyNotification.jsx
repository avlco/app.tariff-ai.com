import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '../providers/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ReportReadyNotification({ show, reportId, onClose }) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  const handleViewReport = () => {
    navigate(createPageUrl(`ReportView?id=${reportId}`));
    onClose();
  };
  
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -100 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-green-200 dark:border-green-800 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                  {language === 'he' ? 'הדוח מוכן!' : 'Report Ready!'}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  {language === 'he' 
                    ? 'הסיווג הושלם בהצלחה. לחץ לצפייה בדוח המלא.'
                    : 'Classification completed successfully. Click to view the full report.'}
                </p>
                
                <Button
                  onClick={handleViewReport}
                  size="sm"
                  className="bg-gradient-to-r from-[#114B5F] to-[#42C0B9] hover:from-[#0D3A4A] hover:to-[#35A89E]"
                >
                  <Eye className="w-4 h-4 me-2" />
                  {language === 'he' ? 'צפה בדוח' : 'View Report'}
                </Button>
              </div>
              
              <button
                onClick={onClose}
                className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}