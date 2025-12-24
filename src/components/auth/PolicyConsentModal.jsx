import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '../providers/LanguageContext';
import PrivacyContent from '../legal/PrivacyContent';
import TermsContent from '../legal/TermsContent';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { ShieldCheck, LogOut, ChevronRight, ChevronLeft } from 'lucide-react';

export default function PolicyConsentModal({ user, onAccept }) {
  const { language, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState('terms'); // terms, privacy
  const [accepted, setAccepted] = useState({ terms: false, privacy: false });
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      // 1. Update user record (UserMasterData)
      const userData = await base44.entities.UserMasterData.filter({ user_email: user.email });
      if (userData.length > 0) {
        await base44.entities.UserMasterData.update(userData[0].id, {
          policy_accepted: true,
          policy_accepted_date: new Date().toISOString()
        });
      } else {
         // Create if doesn't exist (edge case)
         await base44.entities.UserMasterData.create({
            user_email: user.email,
            full_name: user.full_name,
            policy_accepted: true,
            policy_accepted_date: new Date().toISOString()
         });
      }
      
      onAccept();
      toast.success(language === 'he' ? 'התנאים אושרו בהצלחה' : 'Terms accepted successfully');
    } catch (error) {
      console.error(error);
      toast.error(language === 'he' ? 'שגיאה באישור התנאים' : 'Error accepting terms');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!confirm(language === 'he' ? 'האם אתה בטוח? סירוב יגרום למחיקת החשבון.' : 'Are you sure? Rejecting will delete your account.')) {
        return;
    }

    setIsProcessing(true);
    try {
      await base44.functions.invoke('deleteUserAccount');
      await base44.auth.logout();
      window.location.href = '/';
    } catch (error) {
      console.error(error);
      toast.error(language === 'he' ? 'שגיאה במחיקת החשבון' : 'Error deleting account');
      setIsProcessing(false);
    }
  };

  const canAccept = accepted.terms && accepted.privacy;

  const t = {
    en: {
      title: 'Welcome to tariff.ai',
      subtitle: 'Please review and accept our policies to continue.',
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
      acceptTerms: 'I have read and accept the Terms of Service',
      acceptPrivacy: 'I have read and accept the Privacy Policy',
      continue: 'Accept & Continue',
      decline: 'Decline & Delete Account',
      next: 'Next',
      prev: 'Previous',
      readRequired: 'Please scroll to read',
    },
    he: {
      title: 'ברוכים הבאים ל-tariff.ai',
      subtitle: 'אנא קראו ואשרו את המדיניות שלנו כדי להמשיך.',
      terms: 'תנאי שימוש',
      privacy: 'מדיניות פרטיות',
      acceptTerms: 'קראתי ואני מאשר את תנאי השימוש',
      acceptPrivacy: 'קראתי ואני מאשר את מדיניות הפרטיות',
      continue: 'אשר והמשך',
      decline: 'סרב ומחק חשבון',
      next: 'הבא',
      prev: 'הקודם',
      readRequired: 'אנא גלול לקריאה',
    }
  }[language];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 bg-[#114B5F] text-white flex justify-between items-center shrink-0">
            <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-[#42C0B9]" />
                    {t.title}
                </h2>
                <p className="text-white/80 mt-1">{t.subtitle}</p>
            </div>
            
            {/* Steps indicator */}
            <div className="flex gap-2">
                <div className={`h-2 w-8 rounded-full transition-colors ${activeTab === 'terms' ? 'bg-[#42C0B9]' : 'bg-white/20'}`} />
                <div className={`h-2 w-8 rounded-full transition-colors ${activeTab === 'privacy' ? 'bg-[#42C0B9]' : 'bg-white/20'}`} />
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-50 dark:bg-slate-950">
            <ScrollArea className="flex-1 p-6 h-full">
                <AnimatePresence mode="wait">
                    {activeTab === 'terms' ? (
                        <motion.div
                            key="terms"
                            initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
                            className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800"
                        >
                             <TermsContent minimal={true} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="privacy"
                            initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
                            className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800"
                        >
                            <PrivacyContent minimal={true} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </ScrollArea>
        </div>

        {/* Footer */}
        <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-4">
            
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <Checkbox 
                        id="terms-check" 
                        checked={accepted.terms}
                        onCheckedChange={(checked) => setAccepted(prev => ({ ...prev, terms: checked }))}
                    />
                    <label htmlFor="terms-check" className="text-sm font-medium cursor-pointer select-none flex-1">
                        {t.acceptTerms}
                    </label>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <Checkbox 
                        id="privacy-check" 
                        checked={accepted.privacy}
                        onCheckedChange={(checked) => setAccepted(prev => ({ ...prev, privacy: checked }))}
                    />
                    <label htmlFor="privacy-check" className="text-sm font-medium cursor-pointer select-none flex-1">
                        {t.acceptPrivacy}
                    </label>
                </div>
            </div>

            <div className="flex justify-between items-center pt-2">
                <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={handleReject}>
                    <LogOut className="w-4 h-4 me-2" />
                    {t.decline}
                </Button>

                <div className="flex gap-3">
                    {activeTab === 'privacy' && (
                        <Button variant="outline" onClick={() => setActiveTab('terms')}>
                             {isRTL ? <ChevronRight className="w-4 h-4 me-2" /> : <ChevronLeft className="w-4 h-4 me-2" />}
                             {t.prev}
                        </Button>
                    )}
                    
                    {activeTab === 'terms' ? (
                        <Button onClick={() => setActiveTab('privacy')} className="bg-[#114B5F] hover:bg-[#0d3a4a]">
                            {t.next}
                            {isRTL ? <ChevronLeft className="w-4 h-4 ms-2" /> : <ChevronRight className="w-4 h-4 ms-2" />}
                        </Button>
                    ) : (
                        <Button 
                            onClick={handleAccept} 
                            disabled={!canAccept || isProcessing}
                            className="bg-[#42C0B9] hover:bg-[#35A89E] text-white"
                        >
                            {t.continue}
                        </Button>
                    )}
                </div>
            </div>
        </div>
      </motion.div>
    </div>
  );
}