import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '../providers/LanguageContext';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function PolicyConsentModal({ user, onAccept, policyContent, isReacceptance }) {
  const { language, isRTL } = useLanguage();
  const [accepted, setAccepted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      await base44.functions.invoke('acceptPolicy', { 
          version_number: policyContent.version_number,
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
      title: 'Terms of Service & Privacy Policy',
      subtitle: `Version ${policyContent?.version_number}`,
      updatedTitle: 'Policy Updated',
      accept: 'I have read and accept the Terms of Service and Privacy Policy',
      continue: 'Accept & Continue',
      loading: 'Loading...'
    },
    he: {
      title: 'תנאי שימוש ומדיניות פרטיות',
      subtitle: `גרסה ${policyContent?.version_number}`,
      updatedTitle: 'המדיניות עודכנה',
      accept: 'קראתי ואני מאשר את תנאי השימוש ומדיניות הפרטיות',
      continue: 'אשר והמשך',
      loading: 'טוען...'
    }
  }[language];

  if (!policyContent) return null;

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
            {isReacceptance && policyContent.change_summary && (
                <Alert variant="default" className="bg-orange-50 border-orange-200 text-orange-900 shrink-0">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertTitle>{labels.updatedTitle}</AlertTitle>
                    <AlertDescription>
                        {policyContent.change_summary}
                    </AlertDescription>
                </Alert>
            )}

            <ScrollArea className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                <div 
                    className="prose dark:prose-invert max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: policyContent.content_html }}
                />
            </ScrollArea>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors mb-6">
                <Checkbox 
                    id="policy-check" 
                    checked={accepted}
                    onCheckedChange={setAccepted}
                />
                <label htmlFor="policy-check" className="text-sm font-medium cursor-pointer select-none flex-1">
                    {labels.accept}
                </label>
            </div>

            <div className="flex justify-end">
                <Button 
                    onClick={handleAccept} 
                    disabled={!accepted || isProcessing}
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