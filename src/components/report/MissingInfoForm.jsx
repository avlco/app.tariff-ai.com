import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '../providers/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Send, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function MissingInfoForm({ report, onSubmitted }) {
  const { language, isRTL } = useLanguage();
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!response.trim()) {
      toast.error(language === 'he' ? 'נא להזין תשובה' : 'Please enter a response');
      return;
    }

    setIsSubmitting(true);
    try {
      // Update report with user's response
      const updatedChatHistory = [
        ...(report.chat_history || []),
        {
          role: 'user',
          content: response,
          timestamp: new Date().toISOString()
        }
      ];

      // Also append original input if available
      const updatedUserInput = report.user_input_text 
        ? `${report.user_input_text}\n\n---\nAdditional info: ${response}`
        : response;

      await base44.entities.ClassificationReport.update(report.id, {
        status: 'processing',
        processing_status: 'collecting_info',
        chat_history: updatedChatHistory,
        user_input_text: updatedUserInput,
        missing_info_question: null // Clear the question
      });

      toast.success(language === 'he' ? 'המידע נשלח בהצלחה!' : 'Information submitted successfully!');
      
      // Restart classification process
      try {
        await base44.functions.invoke('startClassification', {
          reportId: report.id,
          description: updatedUserInput
        });
      } catch (e) {
        console.log('Classification restart initiated');
      }

      if (onSubmitted) {
        onSubmitted();
      }

    } catch (error) {
      console.error('Failed to submit response:', error);
      toast.error(language === 'he' ? 'שגיאה בשליחת המידע' : 'Failed to submit information');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="border-2 border-yellow-300 bg-yellow-50/50 dark:bg-yellow-900/10 dark:border-yellow-700">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="w-5 h-5" />
            {language === 'he' ? 'נדרש מידע נוסף' : 'Additional Information Required'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-white dark:bg-slate-800 border-yellow-200">
            <MessageSquare className="w-4 h-4 text-yellow-600" />
            <AlertDescription className="text-slate-700 dark:text-slate-200">
              {report.missing_info_question || (language === 'he' 
                ? 'נדרש מידע נוסף להשלמת תהליך הסיווג.'
                : 'Additional information is needed to complete the classification process.')}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {language === 'he' ? 'התשובה שלך:' : 'Your Response:'}
            </label>
            <Textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder={language === 'he' 
                ? 'הזן את המידע הנדרש כאן...'
                : 'Enter the required information here...'}
              className="min-h-[120px] bg-white dark:bg-slate-800"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>

          {/* Chat History Preview */}
          {report.chat_history && report.chat_history.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-xs font-medium text-slate-500 mb-2">
                {language === 'he' ? 'היסטוריית שיחה:' : 'Conversation History:'}
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {report.chat_history.slice(-4).map((msg, idx) => (
                  <div 
                    key={idx}
                    className={`text-sm p-2 rounded ${
                      msg.role === 'user' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200' 
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span className="font-medium">
                      {msg.role === 'user' 
                        ? (language === 'he' ? 'אתה: ' : 'You: ')
                        : (language === 'he' ? 'מערכת: ' : 'System: ')}
                    </span>
                    {msg.content}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !response.trim()}
            className="w-full bg-[#114B5F] hover:bg-[#0D3A4A]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 me-2 animate-spin" />
                {language === 'he' ? 'שולח...' : 'Submitting...'}
              </>
            ) : (
              <>
                <Send className="w-4 h-4 me-2" />
                {language === 'he' ? 'שלח והמשך בסיווג' : 'Submit & Continue Classification'}
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}