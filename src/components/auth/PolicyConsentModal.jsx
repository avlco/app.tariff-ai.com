import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '../providers/LanguageContext';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { ShieldCheck, AlertCircle, Loader2, FileText, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function PolicyConsentModal({ user, onAccept, policyContent, isReacceptance }) {
  const { language, isRTL } = useLanguage();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('terms');

  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      await base44.functions.invoke('acceptPolicy', { 
          version_number: policyContent.version_number,
          accepted_terms: true,
          accepted_privacy: true,
          user_agent: navigator.userAgent
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

  const labels = {
    en: {
      title: 'Terms & Privacy Updates',
      subtitle: `Version ${policyContent?.version_number}`,
      updatedTitle: 'Policy Updated',
      termsTab: 'Terms of Service',
      privacyTab: 'Privacy Policy',
      acceptTerms: 'I have read and accept the Terms of Service',
      acceptPrivacy: 'I have read and accept the Privacy Policy',
      continue: 'Accept & Continue',
      loading: 'Loading...'
    },
    he: {
      title: 'עדכוני תנאים ופרטיות',
      subtitle: `גרסה ${policyContent?.version_number}`,
      updatedTitle: 'המדיניות עודכנה',
      termsTab: 'תנאי שימוש',
      privacyTab: 'מדיניות פרטיות',
      acceptTerms: 'קראתי ואני מאשר את תנאי השימוש',
      acceptPrivacy: 'קראתי ואני מאשר את מדיניות הפרטיות',
      continue: 'אשר והמשך',
      loading: 'טוען...'
    }
  }[language];

  if (!policyContent) return null;

  // Safe access to content based on language with fallback
  const termsHtml = policyContent.terms_content?.[language] || policyContent.terms_content?.['en'] || '<p>No content available.</p>';
  const privacyHtml = policyContent.privacy_content?.[language] || policyContent.privacy_content?.['en'] || '<p>No content available.</p>';
  const changeSummary = policyContent.change_summary?.[language] || policyContent.change_summary?.['en'] || '';

  return (
    <Dialog open={true}>
      <DialogContent 
        className="sm:max-w-4xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden" 
        hideClose={true}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="p-6 bg-[#114B5F] text-white shrink-0">
            <DialogHeader>
                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-[#42C0B9]" />
                    {labels.title}
                </DialogTitle>
                <DialogDescription className="text-white/80 mt-1">
                    {labels.subtitle}
                </DialogDescription>
            </DialogHeader>
        </div>

        <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950 p-6 flex flex-col gap-4">
            {isReacceptance && changeSummary && (
                <Alert variant="default" className="bg-orange-50 border-orange-200 text-orange-900 shrink-0">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertTitle>{labels.updatedTitle}</AlertTitle>
                    <AlertDescription>
                        {changeSummary}
                    </AlertDescription>
                </Alert>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="w-full justify-start border-b rounded-none p-0 h-auto bg-transparent">
                    <TabsTrigger 
                        value="terms" 
                        className="rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-[#114B5F] data-[state=active]:bg-white px-6 py-3"
                    >
                        <FileText className="w-4 h-4 me-2"/> {labels.termsTab}
                    </TabsTrigger>
                    <TabsTrigger 
                        value="privacy" 
                        className="rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-[#114B5F] data-[state=active]:bg-white px-6 py-3"
                    >
                        <Lock className="w-4 h-4 me-2"/> {labels.privacyTab}
                    </TabsTrigger>
                </TabsList>

                <div className="flex-1 bg-white dark:bg-slate-900 border border-t-0 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative">
                    <TabsContent value="terms" className="h-full m-0">
                        <ScrollArea className="h-full p-6">
                            <div 
                                className="prose dark:prose-invert max-w-none text-sm"
                                dangerouslySetInnerHTML={{ __html: termsHtml }}
                            />
                        </ScrollArea>
                    </TabsContent>
                    
                    <TabsContent value="privacy" className="h-full m-0">
                        <ScrollArea className="h-full p-6">
                            <div 
                                className="prose dark:prose-invert max-w-none text-sm"
                                dangerouslySetInnerHTML={{ __html: privacyHtml }}
                            />
                        </ScrollArea>
                    </TabsContent>
                </div>
            </Tabs>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer" onClick={() => setAcceptedTerms(!acceptedTerms)}>
                <Checkbox 
                    id="terms-check" 
                    checked={acceptedTerms}
                    onCheckedChange={setAcceptedTerms}
                />
                <label htmlFor="terms-check" className="text-sm font-medium cursor-pointer select-none flex-1 pointer-events-none">
                    {labels.acceptTerms}
                </label>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer" onClick={() => setAcceptedPrivacy(!acceptedPrivacy)}>
                <Checkbox 
                    id="privacy-check" 
                    checked={acceptedPrivacy}
                    onCheckedChange={setAcceptedPrivacy}
                />
                <label htmlFor="privacy-check" className="text-sm font-medium cursor-pointer select-none flex-1 pointer-events-none">
                    {labels.acceptPrivacy}
                </label>
            </div>

            <div className="flex justify-end pt-2">
                <Button 
                    onClick={handleAccept} 
                    disabled={!acceptedTerms || !acceptedPrivacy || isProcessing}
                    className="bg-[#42C0B9] hover:bg-[#35A89E] text-white w-full sm:w-auto min-w-[150px]"
                >
                    {isProcessing ? <Loader2 className="animate-spin w-4 h-4"/> : labels.continue}
                </Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}