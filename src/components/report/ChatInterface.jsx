import React, { useState, useRef } from 'react';
import { useLanguage } from '../providers/LanguageContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Send, Upload, Image, FileText, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatInterface({ onSubmit, isLoading }) {
  const { t, isRTL } = useLanguage();
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  const handleFileUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    setUploading(true);
    
    try {
      const uploadedFiles = await Promise.all(
        selectedFiles.map(async (file) => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          return {
            name: file.name,
            url: file_url,
            type: file.type.startsWith('image/') ? 'image' : 'document'
          };
        })
      );
      setFiles(prev => [...prev, ...uploadedFiles]);
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };
  
  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleSubmit = () => {
    if (!message.trim() && files.length === 0) return;
    onSubmit({
      text: message,
      files: files.map(f => f.url)
    });
    setMessage('');
    setFiles([]);
  };
  
  return (
    <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm p-6">
      {/* File Preview */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            <div className="flex flex-wrap gap-3">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="relative group bg-slate-100 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2"
                >
                  {file.type === 'image' ? (
                    <Image className="w-5 h-5 text-[#42C0B9]" />
                  ) : (
                    <FileText className="w-5 h-5 text-[#114B5F]" />
                  )}
                  <span className="text-sm text-slate-600 dark:text-slate-300 max-w-32 truncate">
                    {file.name}
                  </span>
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute -top-2 -end-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Input Area */}
      <div className="space-y-4">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('describeProduct')}
          className="min-h-32 resize-none border-slate-200 dark:border-slate-700 focus:border-[#42C0B9] focus:ring-[#42C0B9]/20"
          dir={isRTL ? 'rtl' : 'ltr'}
        />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              accept="image/*,.pdf,.doc,.docx"
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="border-slate-200 dark:border-slate-700"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 me-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 me-2" />
              )}
              {t('uploadFiles')}
            </Button>
          </div>
          
          <Button
            onClick={handleSubmit}
            disabled={isLoading || (!message.trim() && files.length === 0)}
            className="bg-[#42C0B9] hover:bg-[#42C0B9]/90 shadow-lg shadow-[#42C0B9]/25"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 me-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 me-2" />
            )}
            {isLoading ? t('generating') : t('generateReport')}
          </Button>
        </div>
      </div>
    </Card>
  );
}