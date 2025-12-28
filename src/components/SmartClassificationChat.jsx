import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Send, 
  Paperclip, 
  Bot, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Globe, 
  Factory, 
  MapPin,
  Play
} from 'lucide-react';
import { base44 } from "@/api/base44Client";
import { useLanguage } from '@/components/providers/LanguageContext';
import { toast } from "sonner";
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ReactMarkdown from 'react-markdown';

export default function SmartClassificationChat({ reportId }) {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [extractionState, setExtractionState] = useState({
    origin_country: null,
    destination_country: null,
    manufacture_country: null,
    product_name: null
  });
  const scrollRef = useRef(null);
  
  // Load initial data
  useEffect(() => {
    const loadReport = async () => {
      try {
        const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
        if (reports.length > 0) {
          const report = reports[0];
          setMessages(report.chat_history || []);
          
          // Initialize extraction state from report if available
          setExtractionState({
            origin_country: report.country_of_origin || null,
            destination_country: report.destination_country || null,
            manufacture_country: report.country_of_manufacture || null,
            product_name: report.product_name || null
          });
          
          // If no messages, add welcome message
          if (!report.chat_history || report.chat_history.length === 0) {
             const welcomeMsg = {
                 role: 'assistant',
                 content: language === 'he' 
                    ? 'שלום! אני הבוט החכם לסיווג מכס. כדי להתחיל, אנא ספר לי על המוצר שתרצה לסווג ולאיזו מדינה הוא נשלח.'
                    : 'Hello! I am your AI Customs Classifier. To begin, please tell me about the product you wish to classify and its destination country.',
                 timestamp: new Date().toISOString()
             };
             setMessages([welcomeMsg]);
             // Save welcome message
             await base44.entities.ClassificationReport.update(reportId, {
                 chat_history: [welcomeMsg]
             });
          }
        }
      } catch (error) {
        console.error("Failed to load report", error);
        toast.error("Failed to load chat history");
      } finally {
        setLoading(false);
      }
    };
    
    if (reportId) loadReport();
  }, [reportId, language]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = {
        role: 'user',
        content: input,
        timestamp: new Date().toISOString()
    };
    
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setIsAnalyzing(true);
    
    try {
        // 1. Save user message to DB
        await base44.entities.ClassificationReport.update(reportId, {
            chat_history: newHistory
        });

        // 2. Call Extraction Agent
        const extractRes = await base44.functions.invoke('agentExtract', { 
            chat_history: newHistory 
        });
        
        const { extracted, missing_info, ready_to_generate } = extractRes.data.data;
        
        // 3. Update Extraction State
        setExtractionState(prev => ({
            ...prev,
            ...extracted
        }));
        
        // 4. Update Report Entity with extracted fields
        await base44.entities.ClassificationReport.update(reportId, {
            product_name: extracted.product_name || extractionState.product_name, // keep existing if null
            country_of_origin: extracted.origin_country || extractionState.origin_country,
            destination_country: extracted.destination_country || extractionState.destination_country,
            country_of_manufacture: extracted.manufacture_country || extractionState.manufacture_country,
        });

        // 5. Determine Bot Reply
        let botText = '';
        if (ready_to_generate) {
            botText = language === 'he' 
                ? 'נראה שיש לי את כל המידע הנדרש! לחץ על כפתור "צור דוח" כדי להתחיל בתהליך הסיווג.'
                : 'I have all the necessary information! Click "Generate Report" to start the classification process.';
        } else if (missing_info && missing_info.length > 0) {
            // Use the missing info from agent directly or format it
            // The agent returns an array of strings describing what's missing
            const missingStr = missing_info.join(', ');
            botText = language === 'he'
                ? `חסר לי מידע לגבי: ${missingStr}. אנא השלם זאת.`
                : `I am missing information regarding: ${missingStr}. Please provide details.`;
            
            // Or better yet, ask the agent to generate the question? 
            // The current agentExtract prompt says "Identify if critical info is missing", outputting a list.
            // I'll frame it simply.
        } else {
             botText = language === 'he'
                ? 'תודה. האם יש פרטים נוספים?'
                : 'Thank you. Any other details?';
        }

        const botMsg = {
            role: 'assistant',
            content: botText,
            timestamp: new Date().toISOString()
        };
        
        const finalHistory = [...newHistory, botMsg];
        setMessages(finalHistory);
        
        await base44.entities.ClassificationReport.update(reportId, {
            chat_history: finalHistory
        });

    } catch (error) {
        console.error("Chat error:", error);
        toast.error("Error analyzing message");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleManualOverride = async (field, value) => {
      const newState = { ...extractionState, [field]: value };
      setExtractionState(newState);
      
      // Update DB
      try {
          const updateData = {};
          if (field === 'origin_country') updateData.country_of_origin = value;
          if (field === 'destination_country') updateData.destination_country = value;
          if (field === 'manufacture_country') updateData.country_of_manufacture = value;
          if (field === 'product_name') updateData.product_name = value;
          
          await base44.entities.ClassificationReport.update(reportId, updateData);
          toast.success("Updated");
      } catch (e) {
          toast.error("Failed to update");
      }
  };

  const handleGenerateReport = async () => {
      setIsGenerating(true);
      try {
          // Trigger the orchestrator
          // Note: startClassification expects reportId and intendedUse
          // We should grab intendedUse from extraction or just pass the whole user input text as description?
          // The updated startClassification reads 'intendedUse' or 'description' from payload.
          // We'll pass the last user input or just trigger it and let it use the report data
          
          await base44.functions.invoke('startClassification', { 
              reportId,
              intendedUse: "Commercial Import" // Default or extracted? AgentExtract didn't extract intended_use in the prompt.
              // Phase 4 requirements didn't specify extracting intended_use, but it's good to have.
              // We'll stick to what we have.
          });
          
          toast.success("Classification started!");
          navigate(createPageUrl('ReportView') + `?id=${reportId}`);
      } catch (e) {
          console.error(e);
          toast.error("Failed to start classification");
      } finally {
          setIsGenerating(false);
      }
  };

  const StatusChip = ({ label, field, value, icon: Icon }) => {
      const isSet = !!value;
      const [isOpen, setIsOpen] = useState(false);
      const [tempValue, setTempValue] = useState(value || '');

      return (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
              <PopoverTrigger asChild>
                  <div 
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-all ${
                        isSet 
                        ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{value || label}</span>
                      {isSet ? <CheckCircle2 className="w-3.5 h-3.5 ml-1" /> : <AlertCircle className="w-3.5 h-3.5 ml-1" />}
                  </div>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3">
                  <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-slate-500">{label}</Label>
                      <div className="flex gap-2">
                          <Input 
                            value={tempValue} 
                            onChange={(e) => setTempValue(e.target.value)} 
                            className="h-8 text-sm"
                            placeholder={`Enter ${label}...`}
                          />
                          <Button 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => {
                                handleManualOverride(field, tempValue);
                                setIsOpen(false);
                            }}
                          >
                              <CheckCircle2 className="w-4 h-4" />
                          </Button>
                      </div>
                  </div>
              </PopoverContent>
          </Popover>
      );
  };

  const canGenerate = extractionState.product_name && extractionState.destination_country;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] max-w-5xl mx-auto w-full bg-white rounded-xl shadow-sm border overflow-hidden">
      
      {/* Header / Bubbles */}
      <div className="bg-white border-b p-4 flex flex-col md:flex-row items-center justify-between gap-4 z-10">
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
              <StatusChip 
                label={language === 'he' ? 'מוצר' : 'Product'} 
                field="product_name" 
                value={extractionState.product_name} 
                icon={CheckCircle2} 
              />
              <StatusChip 
                label={language === 'he' ? 'מדינת יעד' : 'Destination'} 
                field="destination_country" 
                value={extractionState.destination_country} 
                icon={MapPin} 
              />
              <StatusChip 
                label={language === 'he' ? 'מדינת מוצא' : 'Origin'} 
                field="origin_country" 
                value={extractionState.origin_country} 
                icon={Globe} 
              />
              <StatusChip 
                label={language === 'he' ? 'ייצור' : 'Manufacture'} 
                field="manufacture_country" 
                value={extractionState.manufacture_country} 
                icon={Factory} 
              />
          </div>
          
          <Button 
            onClick={handleGenerateReport} 
            disabled={!canGenerate || isGenerating}
            className={`
                shadow-lg transition-all
                ${canGenerate ? 'bg-gradient-to-r from-[#114B5F] to-[#42C0B9] hover:opacity-90' : 'bg-slate-200 text-slate-400'}
            `}
          >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2 fill-current" />}
              {language === 'he' ? 'צור דוח סיווג' : 'Generate Report'}
          </Button>
      </div>

      {/* Chat Area */}
      <ScrollArea className="flex-1 bg-slate-50/50 p-4">
          <div className="space-y-4 max-w-3xl mx-auto pb-4">
              {messages.map((msg, idx) => {
                  const isBot = msg.role === 'assistant';
                  return (
                      <div key={idx} className={`flex gap-3 ${isBot ? 'justify-start' : 'justify-end'}`}>
                          {isBot && (
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 border border-blue-200">
                                  <Bot className="w-4 h-4 text-blue-600" />
                              </div>
                          )}
                          
                          <div className={`
                            max-w-[80%] rounded-2xl px-4 py-3 shadow-sm
                            ${isBot 
                                ? 'bg-white border border-slate-100 text-slate-800 rounded-tl-none' 
                                : 'bg-[#114B5F] text-white rounded-tr-none'
                            }
                          `}>
                              <ReactMarkdown className="prose prose-sm max-w-none break-words dark:prose-invert">
                                  {msg.content}
                              </ReactMarkdown>
                              <p className={`text-[10px] mt-1 opacity-70 ${isBot ? 'text-left' : 'text-right'}`}>
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                          </div>

                          {!isBot && (
                              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 border border-slate-300">
                                  <User className="w-4 h-4 text-slate-600" />
                              </div>
                          )}
                      </div>
                  );
              })}
              
              {isAnalyzing && (
                  <div className="flex gap-3">
                       <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 border border-blue-200">
                          <Bot className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                          <span className="text-sm text-slate-500">Analyzing...</span>
                      </div>
                  </div>
              )}
              <div ref={scrollRef} />
          </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 bg-white border-t">
          <div className="max-w-3xl mx-auto relative flex gap-2">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
                  <Paperclip className="w-5 h-5" />
              </Button>
              
              <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={language === 'he' ? 'כתוב הודעה...' : 'Type a message...'}
                className="flex-1 pr-12 rounded-full border-slate-200 focus-visible:ring-[#114B5F]"
                disabled={isAnalyzing || isGenerating}
              />
              
              <Button 
                onClick={handleSend}
                disabled={!input.trim() || isAnalyzing || isGenerating}
                size="icon"
                className="absolute right-1 top-1 bottom-1 w-8 h-8 rounded-full bg-[#114B5F] hover:bg-[#0e3f50] text-white"
              >
                  <Send className="w-4 h-4" />
              </Button>
          </div>
          <div className="text-center mt-2">
              <p className="text-xs text-slate-400">
                {language === 'he' ? 'AI יכול לעשות טעויות. אנא ודא את המידע.' : 'AI can make mistakes. Please verify important information.'}
              </p>
          </div>
      </div>
    </div>
  );
}