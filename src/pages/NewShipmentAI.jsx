import React, { useState } from 'react';
import { useLanguage } from '../components/providers/LanguageContext';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Upload, FileText, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ShipmentForm from '../components/shipments/ShipmentForm';
import { toast } from 'sonner';

export default function NewShipmentAI() {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedFileUrls, setUploadedFileUrls] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [aiAnalyzedData, setAiAnalyzedData] = useState(null);
  const [identifiedCustomer, setIdentifiedCustomer] = useState(null);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadAndAnalyze = async () => {
    if (selectedFiles.length === 0) {
      toast.error(isRTL ? 'אנא בחר קבצים להעלאה' : 'Please select files to upload');
      return;
    }

    try {
      // Upload files
      setIsUploading(true);
      const urls = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        setAnalysisProgress(isRTL ? `מעלה קובץ ${i + 1} מתוך ${selectedFiles.length}...` : `Uploading file ${i + 1} of ${selectedFiles.length}...`);
        const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFiles[i] });
        urls.push(file_url);
      }
      setUploadedFileUrls(urls);
      setIsUploading(false);

      // Analyze with AI
      setIsAnalyzing(true);
      setAnalysisProgress(isRTL ? 'מנתח מסמכים עם AI...' : 'Analyzing documents with AI...');
      
      const response = await base44.functions.invoke('aiAnalyzeShipment', { fileUrls: urls });
      
      if (response.data.status === 'success') {
        setAiAnalyzedData(response.data.shipmentData);
        setIdentifiedCustomer(response.data.identifiedCustomer);
        setIsAnalyzing(false);
        toast.success(isRTL ? 'ניתוח AI הושלם בהצלחה!' : 'AI analysis completed successfully!');
      } else {
        throw new Error(response.data.error || 'Analysis failed');
      }
    } catch (error) {
      setIsUploading(false);
      setIsAnalyzing(false);
      toast.error(isRTL ? `שגיאה: ${error.message}` : `Error: ${error.message}`);
    }
  };

  const createShipmentMutation = useMutation({
    mutationFn: async (formData) => {
      const shipmentId = `SHP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const shipmentData = {
        ...formData,
        shipment_id: shipmentId,
        status: 'draft'
      };
      return await base44.entities.Shipment.create(shipmentData);
    },
    onSuccess: (newShipment) => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      toast.success(isRTL ? 'משלוח נוצר בהצלחה!' : 'Shipment created successfully!');
      navigate(createPageUrl('Shipments'));
    },
    onError: (error) => {
      toast.error(isRTL ? 'שגיאה ביצירת משלוח' : 'Error creating shipment');
    }
  });

  const handleSubmit = (formData) => {
    createShipmentMutation.mutate(formData);
  };

  // Loading state during analysis
  if (isUploading || isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
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

  // Review and edit state after analysis
  if (aiAnalyzedData) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#42C0B9] to-[#D89C42] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {isRTL ? 'בדוק ושלים פרטים' : 'Review & Complete Details'}
              </h1>
              {aiAnalyzedData.confidence_score && (
                <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
                  {isRTL ? 'רמת ביטחון AI: ' : 'AI Confidence: '}
                  <span className="font-semibold text-[#42C0B9]">{aiAnalyzedData.confidence_score}%</span>
                </p>
              )}
            </div>
          </div>
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
            {isRTL 
              ? 'ה-AI מילא את הפרטים הבאים מהמסמכים. אנא סקור, ערוך והשלם במידת הצורך לפני שמירה.'
              : 'AI has pre-filled the following details from your documents. Please review, edit, and complete as needed before saving.'
            }
          </p>
        </motion.div>

        {identifiedCustomer && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    {isRTL ? 'לקוח חדש זוהה' : 'New Customer Identified'}
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    {isRTL ? 'מצאנו לקוח חדש במסמכים: ' : 'Found a new customer in documents: '}
                    <span className="font-semibold">{identifiedCustomer.customer_name}</span>
                    {identifiedCustomer.email && ` (${identifiedCustomer.email})`}
                    <br />
                    {isRTL ? 'תצטרך ליצור לקוח זה במערכת או לבחור לקוח קיים בטופס למטה.' : 'You will need to create this customer or select an existing one in the form below.'}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6">
            <ShipmentForm
              initialData={aiAnalyzedData}
              customers={customers}
              onSubmit={handleSubmit}
              isLoading={createShipmentMutation.isPending}
              isAiGenerated={true}
            />
          </Card>
        </motion.div>
      </div>
    );
  }

  // Initial file upload state
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#114B5F] to-[#42C0B9] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            {isRTL ? 'צור משלוח עם AI' : 'Create Shipment with AI'}
          </h1>
        </div>
        <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
          {isRTL
            ? 'העלה מסמכים רלוונטיים (חשבוניות, רשימות אריזה, תעודות מקור, תמונות) וה-AI ימלא אוטומטית את כל פרטי המשלוח.'
            : 'Upload relevant documents (invoices, packing lists, certificates of origin, images) and AI will automatically fill in all shipment details.'
          }
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6">
          <div className="space-y-4">
            {/* File upload area */}
            <div className="border-2 border-dashed border-[#CBD5E1] dark:border-[#475569] rounded-lg p-8 text-center hover:border-[#42C0B9] transition-colors">
              <Upload className="w-12 h-12 text-[#CBD5E1] dark:text-[#475569] mx-auto mb-4" />
              <h3 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-2">
                {isRTL ? 'גרור קבצים לכאן או לחץ לבחירה' : 'Drag files here or click to select'}
              </h3>
              <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mb-4">
                {isRTL ? 'תומך ב-PDF, JPG, PNG, DOCX, XLSX' : 'Supports PDF, JPG, PNG, DOCX, XLSX'}
              </p>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.csv"
              />
              <label htmlFor="file-upload">
                <Button type="button" variant="outline" asChild>
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

            {/* Analyze button */}
            <Button
              onClick={handleUploadAndAnalyze}
              disabled={selectedFiles.length === 0}
              className="w-full bg-gradient-to-r from-[#114B5F] to-[#42C0B9] hover:from-[#0D3A4A] hover:to-[#3AB0A8] text-white"
            >
              <Sparkles className="w-4 h-4 me-2" />
              {isRTL ? 'העלה ונתח עם AI' : 'Upload & Analyze with AI'}
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <h4 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] text-sm mb-1">
            {isRTL ? '🎯 סיווג אוטומטי' : '🎯 Auto Classification'}
          </h4>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            {isRTL ? 'AI מזהה קוד HS ומעריך מיסים' : 'AI identifies HS code and estimates duties'}
          </p>
        </Card>
        <Card className="p-4">
          <h4 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] text-sm mb-1">
            {isRTL ? '📊 חילוץ נתונים' : '📊 Data Extraction'}
          </h4>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            {isRTL ? 'מילוי אוטומטי של כל פרטי המשלוח' : 'Auto-fill all shipment details'}
          </p>
        </Card>
        <Card className="p-4">
          <h4 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] text-sm mb-1">
            {isRTL ? '💰 הערכת עלויות' : '💰 Cost Estimation'}
          </h4>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            {isRTL ? 'חישוב עלויות שילוח ומכס' : 'Calculate shipping and customs costs'}
          </p>
        </Card>
      </div>
    </div>
  );
}