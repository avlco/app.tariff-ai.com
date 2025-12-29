import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Bot, User, CheckCircle2, AlertCircle, MapPin, Globe, Factory, Play } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { base44 } from "@/api/base44Client";
import { useLanguage } from './providers/LanguageContext';
import { toast } from "sonner";
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ReactMarkdown from 'react-markdown';

export default function SmartClassificationChat({ reportId }) {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  
  // The 3 Critical Fields
  const [extractionState, setExtractionState] = useState({
    product_name: null,
    destination_country: null,
    origin_country: null
  });
  
  const scrollRef = useRef(null);
  
  // Generate button visible only after user interaction
  const hasInteracted = messages.some(m => m.role === 'user');

  useEffect(() => {
    const loadReport = async () => {
      if (!reportId) return;
      try {
        const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
        if (reports.length > 0) {
          const report = reports[0];
          setMessages(report.chat_history || []);
          setExtractionState({
            product_name: report.product_name || null,
            destination_country: report.destination_country || null,
            origin_country: report.country_of_origin || report.country_of_manufacture || null
          });
          
          if (!report.chat_history || report.chat_history.length === 0) {
             const welcomeMsg = {
                 role: 'assistant',
                 content: language === 'he' 
                    ? 'שלום! כדי להתחיל בסיווג, אנא ספר לי: מה המוצר? לאן הוא נשלח? והיכן יוצר?' 
                    : 'Hello! To start classification, please tell me: What is the product? Where is it going? And where was it made?',
                 timestamp: new Date().toISOString()
             };
             setMessages([welcomeMsg]);
          }
        }
      } catch (error) { console.error("Load error", error); }
    };
    loadReport();
  }, [reportId, language]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input, timestamp: new Date().toISOString() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setIsAnalyzing(true);
    
    try {
        await base44.entities.ClassificationReport.update(reportId, { chat_history: newHistory });

        const extractRes = await base44.functions.invoke('agentExtract', { chat_history: newHistory });
        
        if (extractRes.data?.success) {
            const { extracted, bot_question } = extractRes.data.data;
            
            setExtractionState(prev => ({ ...prev, ...extracted }));
            
            await base44.entities.ClassificationReport.update(reportId, {
                product_name: extracted.product_name || extractionState.product_name,
                destination_country: extracted.destination_country || extractionState.destination_country,
                country_of_origin: extracted.origin_country || extractionState.origin_country,
                country_of_manufacture: extracted.origin_country || extractionState.origin_country
            });

            // If bot has a specific question about missing fields, use it.
            let botText = bot_question;
            if (!botText) {
                botText = language === 'he' 
                    ? 'תודה. יש לי את כל המידע. לחץ על "צור דוח" או המשך לשוחח.' 
                    : 'Thanks. I have the required info. Click "Generate Report" or continue chatting.';
            }

            const botMsg = { role: 'assistant', content: botText, timestamp: new Date().toISOString() };
            const finalHistory = [...newHistory, botMsg];
            setMessages(finalHistory);
            await base44.entities.ClassificationReport.update(reportId, { chat_history: finalHistory });
        }
    } catch (error) {
        console.error("Chat Error:", error);
        toast.error("AI Analysis failed. Please try again.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleGenerateClick = () => {
      // Logic: If fields are missing, show warning. Else, generate.
      const missing = [];
      if (!extractionState.product_name) missing.push('Product Name');
      if (!extractionState.destination_country) missing.push('Destination');
      if (!extractionState.origin_country) missing.push('Origin');

      if (missing.length > 0) {
          setShowWarning(true);
      } else {
          executeGeneration();
      }
  };

  const executeGeneration = async () => {
      setShowWarning(false);
      setIsGenerating(true);
      try {
          const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || "";
          await base44.functions.invoke('startClassification', { 
              reportId, 
              intendedUse: "Commercial Import",
              description: lastUserMsg
          });
          toast.success("Report generation started!");
          navigate(createPageUrl('ReportView') + `?id=${reportId}`);
      } catch (e) { toast.error("Failed to start generation"); } 
      finally { setIsGenerating(false); }
  };

  const StatusChip = ({ label, value, icon: Icon }) => (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${value ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
          <Icon className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{value || label}</span>
          {value ? <CheckCircle2 className="w-3.5 h-3.5 ml-1" /> : <AlertCircle className="w-3.5 h-3.5 ml-1" />}
      </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] max-w-5xl mx-auto w-full bg-white rounded-xl shadow-sm border overflow-hidden">
      
      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === 'he' ? 'חסר מידע' : 'Missing Information'}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'he' 
                ? 'חסרים פרטים (מוצר, יעד או מקור). הדוח עשוי להיות לא מדויק. להמשיך?'
                : 'Key details (Product, Origin, or Destination) are missing. The report might be inaccurate. Proceed anyway?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'he' ? 'חזור' : 'Back'}</AlertDialogCancel>
            <AlertDialogAction onClick={executeGeneration}>{language === 'he' ? 'המשך' : 'Proceed'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="bg-white border-b p-4 flex flex-col md:flex-row items-center justify-between gap-4 z-10">
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
              <StatusChip label={language === 'he' ? 'מוצר' : 'Product'} value={extractionState.product_name} icon={CheckCircle2} />
              <StatusChip label={language === 'he' ? 'יעד' : 'Destination'} value={extractionState.destination_country} icon={MapPin} />
              <StatusChip label={language === 'he' ? 'מקור' : 'Origin'} value={extractionState.origin_country} icon={Factory} />
          </div>
          
          {hasInteracted && (
              <Button 
                onClick={handleGenerateClick} 
                disabled={isGenerating} 
                className="bg-gradient-to-r from-[#114B5F] to-[#42C0B9] hover:opacity-90 shadow-md animate-in fade-in zoom-in"
              >
                  {isGenerating ? <Loader2 className="animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2 fill-current" />} 
                  {language === 'he' ? 'צור דוח' : 'Generate Report'}
              </Button>
          )}
      </div>

      <ScrollArea className="flex-1 bg-slate-50/50 p-4">
          <div className="space-y-4 max-w-3xl mx-auto pb-4">
              {messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-3 ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                      {msg.role === 'assistant' && <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 border border-blue-200"><Bot className="w-4 h-4 text-blue-600" /></div>}
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${msg.role === 'assistant' ? 'bg-white border text-slate-800 rounded-tl-none' : 'bg-[#114B5F] text-white rounded-tr-none'}`}>
                          <ReactMarkdown className="prose prose-sm max-w-none break-words dark:prose-invert">{msg.content}</ReactMarkdown>
                      </div>
                  </div>
              ))}
              {isAnalyzing && <div className="flex gap-3"><div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><Bot className="w-4 h-4 text-blue-600" /></div><div className="bg-white border px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /><span className="text-sm text-slate-500">Analyzing...</span></div></div>}
              <div ref={scrollRef} />
          </div>
      </ScrollArea>

      <div className="p-4 bg-white border-t">
          <div className="max-w-3xl mx-auto relative flex gap-2">
              <Input 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
                placeholder={language === 'he' ? 'כתוב כאן...' : 'Type here...'} 
                className="flex-1 pr-12 rounded-full" 
                disabled={isAnalyzing} 
              />
              <Button onClick={handleSend} disabled={!input.trim() || isAnalyzing} size="icon" className="absolute right-1 top-1 bottom-1 rounded-full bg-[#114B5F]"><Send className="w-4 h-4" /></Button>
          </div>
      </div>
    </div>
  );
}