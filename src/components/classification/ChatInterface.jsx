import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Image, FileText, Link as LinkIcon } from 'lucide-react';
import { useLanguage } from '../providers/LanguageContext';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function ChatInterface({ messages, onSendMessage, onFileUpload, onLinkAdd }) {
  const { language, isRTL } = useLanguage();
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };
  
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setUploading(true);
    try {
      const uploadPromises = files.map(file => 
        base44.integrations.Core.UploadFile({ file })
      );
      const results = await Promise.all(uploadPromises);
      const urls = results.map(r => r.file_url);
      onFileUpload(urls);
      toast.success(language === 'he' ? 'הקבצים הועלו בהצלחה' : 'Files uploaded successfully');
    } catch (error) {
      toast.error(language === 'he' ? 'שגיאה בהעלאת קבצים' : 'Error uploading files');
    } finally {
      setUploading(false);
    }
  };
  
  const handleLinkAdd = () => {
    const url = prompt(language === 'he' ? 'הזן קישור:' : 'Enter URL:');
    if (url) {
      onLinkAdd(url);
    }
  };
  
  return (
    <div className="flex flex-col h-[400px] border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            {language === 'he' 
              ? 'ספר לי עוד על המוצר שלך...' 
              : 'Tell me more about your product...'}
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-[#114B5F] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-3">
        <div className="flex items-end gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            className="hidden"
            accept="image/*,.pdf,.doc,.docx"
          />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title={language === 'he' ? 'העלה קובץ' : 'Upload file'}
          >
            <FileText className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLinkAdd}
            title={language === 'he' ? 'הוסף קישור' : 'Add link'}
          >
            <LinkIcon className="w-4 h-4" />
          </Button>
          
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={language === 'he' ? 'כתוב הודעה...' : 'Type a message...'}
            className="flex-1 min-h-[40px] max-h-[120px] resize-none"
            dir={isRTL ? 'rtl' : 'ltr'}
          />
          
          <Button
            onClick={handleSend}
            disabled={!input.trim()}
            size="icon"
            className="bg-[#42C0B9] hover:bg-[#35A89E]"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}