import React, { useState } from 'react';
import { useLanguage } from '../providers/LanguageContext';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Upload, FileText, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function NewShipmentAIDialog({ onAnalysisComplete, onCancel }) {
  const { isRTL } = useLanguage();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [freeText, setFreeText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadAndAnalyze = async () => {
    if (selectedFiles.length === 0 && !freeText.trim()) {
      toast.error(isRTL ? 'אנא העלה קבצים או הזן טקסט' : 'Please upload files or enter text');
      return;
    }

    try {
      let fileUrls = [];

      // Upload files if any
      if (selectedFiles.length > 0) {
        setIsUploading(true);
        for (let i = 0; i < selectedFiles.length; i++) {
          setAnalysisProgress(isRTL ? `מעלה קובץ ${i + 1} מתוך ${selectedFiles.length}...` : `Uploading file ${i + 1} of ${selectedFiles.length}...`);
          const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFiles[i] });
          fileUrls.push(file_url);
        }
        setIsUploading(false);
      }

      // Analyze with AI
      setIsAnalyzing(true);
      setAnalysisProgress(isRTL ? 'מנתח מסמכים עם AI...' : 'Analyzing documents with AI...');
      
      const response = await base44.functions.invoke('aiAnalyzeShipment', { 
        fileUrls: fileUrls,
        freeText: freeText.trim() || null
      });
      
      setIsAnalyzing(false);
      
      if (response.data.status === 'success') {
        toast.success(isRTL ? 'ניתוח AI הושלם בהצלחה!' : 'AI analysis completed successfully!');
        onAnalysisComplete(response.data);
      } else {
        toast.error(isRTL ? `שגיאה: ${response.data.details || 'הניתוח נכשל'}` : `Error: ${response.data.details || 'Analysis failed'}`);
        throw new Error(response.data.details || 'Analysis failed');
      }
    } catch (error) {
      setIsUploading(false);
      setIsAnalyzing(false);
      toast.error(isRTL ? `שגיאה: ${error.message}` : `Error: ${error.message}`);
    }
  };

  // Loading state during analysis
  if (isUploading || isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-6"
        >
          <div className="relative">
            <Loader2 className="w-16 h-16 text-[#42C0B9] animate-spin" />
            <Sparkles className="w-8 h-8 text-[#D89C42] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
        </motion.div>
        <h2 className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-2">
          {isUploading ? (isRTL ? 'מעלה קבצים...' : 'Uploading files...') : (isRTL ? 'מנתח עם AI...' : 'Analyzing with AI...')}
        </h2>
        <p className="text-[#64748B] dark:text-[#94A3B8] mb-4">
          {analysisProgress}
        </p>
        <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
          {isRTL ? 'תהליך זה עשוי לקחת 30-60 שניות' : 'This process may take 30-60 seconds'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#114B5F] to-[#42C0B9] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              {isRTL ? 'צור משלוח עם AI' : 'Create Shipment with AI'}
            </h2>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
              {isRTL
                ? 'העלה מסמכים או הזן מידע, וה-AI ימלא אוטומטית את פרטי המשלוח'
                : 'Upload documents or enter information, and AI will auto-fill shipment details'
              }
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Free text input */}
        <div>
          <Label htmlFor="free-text" className="text-sm font-medium text-[#0F172A] dark:text-[#F8FAFC] mb-2 block">
            {isRTL ? 'תאר את המשלוח (אופציונלי)' : 'Describe the shipment (optional)'}
          </Label>
          <Textarea
            id="free-text"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder={isRTL 
              ? 'לדוגמה: משלוח של 100 יחידות טלפונים סלולריים מסין לישראל, ערך 50,000 דולר...'
              : 'e.g., Shipment of 100 units of mobile phones from China to Israel, value $50,000...'
            }
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
            {isRTL 
              ? 'ה-AI ישתמש במידע זה יחד עם המסמכים שהעלית'
              : 'AI will use this information together with uploaded documents'
            }
          </p>
        </div>

        {/* File upload area */}
        <div className="border-2 border-dashed border-[#CBD5E1] dark:border-[#475569] rounded-lg p-6 text-center hover:border-[#42C0B9] transition-colors">
          <Upload className="w-10 h-10 text-[#CBD5E1] dark:text-[#475569] mx-auto mb-3" />
          <h3 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1 text-sm">
            {isRTL ? 'גרור קבצים לכאן או לחץ לבחירה' : 'Drag files here or click to select'}
          </h3>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mb-3">
            {isRTL ? 'תומך ב-PDF, JPG, PNG, DOCX, XLSX' : 'Supports PDF, JPG, PNG, DOCX, XLSX'}
          </p>
          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload-ai"
            accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.csv"
          />
          <label htmlFor="file-upload-ai">
            <Button type="button" variant="outline" size="sm" asChild>
              <span className="cursor-pointer">
                <FileText className="w-4 h-4 me-2" />
                {isRTL ? 'בחר קבצים' : 'Select Files'}
              </span>
            </Button>
          </label>
        </div>

        {/* Selected files list */}
        <AnimatePresence>
          {selectedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <h4 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] text-sm">
                {isRTL ? `${selectedFiles.length} קבצים נבחרו` : `${selectedFiles.length} files selected`}
              </h4>
              {selectedFiles.map((file, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-[#42C0B9]" />
                    <span className="text-sm text-[#475569] dark:text-[#CBD5E1]">{file.name}</span>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-[#64748B] hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1"
          >
            {isRTL ? 'ביטול' : 'Cancel'}
          </Button>
          <Button
            onClick={handleUploadAndAnalyze}
            disabled={selectedFiles.length === 0 && !freeText.trim()}
            className="flex-1 bg-gradient-to-r from-[#114B5F] to-[#42C0B9] hover:from-[#0D3A4A] hover:to-[#3AB0A8] text-white"
          >
            <Sparkles className="w-4 h-4 me-2" />
            {isRTL ? 'נתח עם AI' : 'Analyze with AI'}
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t">
        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="text-xl mb-1">🎯</div>
          <p className="text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC]">
            {isRTL ? 'סיווג אוטומטי' : 'Auto Classification'}
          </p>
        </div>
        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="text-xl mb-1">📊</div>
          <p className="text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC]">
            {isRTL ? 'חילוץ נתונים' : 'Data Extraction'}
          </p>
        </div>
        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="text-xl mb-1">💰</div>
          <p className="text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC]">
            {isRTL ? 'הערכת עלויות' : 'Cost Estimation'}
          </p>
        </div>
      </div>
    </div>
  );
}