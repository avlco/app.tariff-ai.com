import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '../providers/LanguageContext';
import PrivacyContent from '../legal/PrivacyContent';
import TermsContent from '../legal/TermsContent';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { ShieldCheck, ArrowRight, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';

export default function PolicyConsentModal({ user, onAccept, requiredVersion }) {
  const { language, isRTL } = useLanguage();
  const [step, setStep] = useState(1);
  const [accepted, setAccepted] = useState({ terms: false, privacy: false });
  const [isProcessing, setIsProcessing] = useState(false);

  // Step 1: Terms
  // Step 2: Privacy
  // Step 3: Confirm

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinalConfirm = async () => {
    if (!accepted.terms || !accepted.privacy) return;
    
    setIsProcessing(true);
    try {
      await base44.functions.invoke('acceptPolicy', { 
          version: requiredVersion,
          user_agent: window.navigator.userAgent,
          // IP address handled by backend
      });
      
      toast.success(language === 'he' ? 'התנאים אושרו בהצלחה' : 'Terms accepted successfully');
      if (onAccept) onAccept();
      
    } catch (error) {
      console.error("Policy error:", error);
      toast.error('Error saving consent.');
    } finally {
      setIsProcessing(false);
    }
  };

  const t = {
    en: {
      title: 'Legal Consent',
      step1: 'Terms of Use',
      step2: 'Privacy Policy',
      step3: 'Confirmation',
      confirmTerms: 'I confirm I have read and agree to the Terms of Service.',
      confirmPrivacy: 'I confirm I have read and agree to the Privacy Policy.',
      finalMsg: `You are accepting Policy Version ${requiredVersion}. This action is legally binding.`,
      next: 'Next',
      back: 'Back',
      confirm: 'Confirm & Enter',
      processing: 'Securing Consent...'
    },
    he: {
      title: 'הסכמה משפטית',
      step1: 'תנאי שימוש',
      step2: 'מדיניות פרטיות',
      step3: 'אישור סופי',
      confirmTerms: 'אני מאשר שקראתי ומסכים לתנאי השימוש.',
      confirmPrivacy: 'אני מאשר שקראתי ומסכים למדיניות הפרטיות.',
      finalMsg: `הנך מאשר את גרסת מדיניות ${requiredVersion}. פעולה זו מחייבת משפטית.`,
      next: 'הבא',
      back: 'חזור',
      confirm: 'אשר וכנס',
      processing: 'מאשר הסכמה...'
    }
  }[language];

  const variants = {
    enter: (direction) => ({
      x: direction > 0 ? (isRTL ? -20 : 20) : (isRTL ? 20 : -20),
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction) => ({
      x: direction < 0 ? (isRTL ? -20 : 20) : (isRTL ? 20 : -20),
      opacity: 0
    })
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header with Progress */}
        <div className="p-6 bg-[#114B5F] text-white shrink-0">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#42C0B9]" />
                    {t.title}
                </h2>
                <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">
                    {step} / 3
                </span>
            </div>
            {/* Progress Bar */}
            <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-[#42C0B9] transition-all duration-300 ease-out"
                    style={{ width: `${(step / 3) * 100}%` }}
                />
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 relative">
             <AnimatePresence mode="wait" custom={step}>
                {step === 1 && (
                    <motion.div key="step1" variants={variants} initial="enter" animate="center" exit="exit" className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t.step1}</h3>
                        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 max-h-[40vh] overflow-y-auto shadow-sm">
                            <TermsContent minimal={true} />
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                            <Checkbox id="terms" checked={accepted.terms} onCheckedChange={(c) => setAccepted(p => ({...p, terms: c}))} />
                            <label htmlFor="terms" className="text-sm font-medium cursor-pointer flex-1">{t.confirmTerms}</label>
                        </div>
                    </motion.div>
                )}
                {step === 2 && (
                    <motion.div key="step2" variants={variants} initial="enter" animate="center" exit="exit" className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t.step2}</h3>
                        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 max-h-[40vh] overflow-y-auto shadow-sm">
                            <PrivacyContent minimal={true} />
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                            <Checkbox id="privacy" checked={accepted.privacy} onCheckedChange={(c) => setAccepted(p => ({...p, privacy: c}))} />
                            <label htmlFor="privacy" className="text-sm font-medium cursor-pointer flex-1">{t.confirmPrivacy}</label>
                        </div>
                    </motion.div>
                )}
                {step === 3 && (
                    <motion.div key="step3" variants={variants} initial="enter" animate="center" exit="exit" className="flex flex-col items-center justify-center text-center h-full py-10 space-y-6">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                            <ShieldCheck className="w-8 h-8" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t.step3}</h3>
                        <p className="text-slate-600 dark:text-slate-400 max-w-md">
                            {t.finalMsg}
                        </p>
                        <div className="flex flex-col gap-2 w-full max-w-xs bg-slate-100 dark:bg-slate-800 p-4 rounded-lg text-sm text-left">
                           <div className="flex justify-between"><span>Terms:</span> <CheckCircle2 className="w-4 h-4 text-green-500"/></div>
                           <div className="flex justify-between"><span>Privacy:</span> <CheckCircle2 className="w-4 h-4 text-green-500"/></div>
                        </div>
                    </motion.div>
                )}
             </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 flex justify-between items-center">
            {step > 1 ? (
                <Button variant="ghost" onClick={handleBack} disabled={isProcessing}>
                    {isRTL ? <ArrowRight className="w-4 h-4 me-2"/> : <ArrowLeft className="w-4 h-4 me-2"/>}
                    {t.back}
                </Button>
            ) : <div/>}

            {step < 3 ? (
                <Button 
                    onClick={handleNext} 
                    disabled={step === 1 ? !accepted.terms : !accepted.privacy}
                    className="bg-[#114B5F] hover:bg-[#0d3a4a] text-white min-w-[100px]"
                >
                    {t.next}
                    {isRTL ? <ArrowLeft className="w-4 h-4 ms-2"/> : <ArrowRight className="w-4 h-4 ms-2"/>}
                </Button>
            ) : (
                <Button 
                    onClick={handleFinalConfirm} 
                    disabled={isProcessing}
                    className="bg-[#42C0B9] hover:bg-[#35A89E] text-white min-w-[140px]"
                >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin me-2"/> : <ShieldCheck className="w-4 h-4 me-2"/>}
                    {isProcessing ? t.processing : t.confirm}
                </Button>
            )}
        </div>
      </motion.div>
    </div>
  );
}