import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useLanguage } from '../providers/LanguageContext';
import { Brain, CheckCircle, Sparkles, Search, FileText, Calculator, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const processingSteps = [
  { 
    key: 'collecting_info', 
    icon: Search,
    he: 'איסוף מידע על המוצר',
    en: 'Collecting product information'
  },
  { 
    key: 'analyzing_data', 
    icon: Brain,
    he: 'ניתוח נתונים',
    en: 'Analyzing data'
  },
  { 
    key: 'classifying_hs', 
    icon: FileText,
    he: 'סיווג קוד HS',
    en: 'Classifying HS code'
  },
  { 
    key: 'calculating_duties', 
    icon: Calculator,
    he: 'חישוב מכסים ומיסים',
    en: 'Calculating duties and taxes'
  },
  { 
    key: 'checking_regulations', 
    icon: Shield,
    he: 'בדיקת רגולציות',
    en: 'Checking regulations'
  },
  { 
    key: 'generating_report', 
    icon: Sparkles,
    he: 'יצירת הדוח הסופי',
    en: 'Generating final report'
  }
];

export default function ProcessingModal({ open, onClose, currentStatus }) {
  const { language } = useLanguage();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  
  useEffect(() => {
    const stepIndex = processingSteps.findIndex(s => s.key === currentStatus);
    if (stepIndex >= 0) {
      setCurrentStepIndex(stepIndex);
    }
  }, [currentStatus]);
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg" hideClose>
        <div className="py-8 px-4">
          {/* Animated Brain */}
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="flex justify-center mb-6"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#42C0B9] to-[#114B5F] rounded-full blur-xl opacity-50" />
              <Brain className="w-20 h-20 text-[#114B5F] relative" />
            </div>
          </motion.div>
          
          {/* Title */}
          <h2 className="text-2xl font-bold text-center mb-2 text-slate-900 dark:text-white">
            {language === 'he' ? 'מעבד את הדוח שלך' : 'Processing Your Report'}
          </h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-8">
            {language === 'he' 
              ? 'ה-AI שלנו עובד קשה כדי לנתח ולסווג את המוצר שלך'
              : 'Our AI is working hard to analyze and classify your product'}
          </p>
          
          {/* Processing Steps */}
          <div className="space-y-3">
            {processingSteps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const isPending = index > currentStepIndex;
              
              return (
                <motion.div
                  key={step.key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                    isCurrent 
                      ? 'bg-gradient-to-r from-[#42C0B9]/10 to-[#114B5F]/10 border border-[#42C0B9]' 
                      : isCompleted
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-slate-50 dark:bg-slate-800/50'
                  }`}
                >
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    isCompleted 
                      ? 'bg-green-500' 
                      : isCurrent
                      ? 'bg-gradient-to-r from-[#42C0B9] to-[#114B5F]'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5 text-white" />
                    ) : (
                      <Icon className={`w-5 h-5 ${isCurrent ? 'text-white' : 'text-slate-500'}`} />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <p className={`font-medium ${
                      isCurrent 
                        ? 'text-[#114B5F] dark:text-[#42C0B9]' 
                        : isCompleted
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {language === 'he' ? step.he : step.en}
                    </p>
                  </div>
                  
                  {isCurrent && (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="flex-shrink-0"
                    >
                      <div className="w-5 h-5 border-2 border-[#42C0B9] border-t-transparent rounded-full" />
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
          
          {/* Close Option */}
          <div className="mt-8 text-center">
            <button
              onClick={onClose}
              className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline"
            >
              {language === 'he' 
                ? 'סגור והמשך לעבוד - נעדכן אותך כשהדוח מוכן'
                : 'Close and continue working - we\'ll notify you when ready'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}