import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/providers/LanguageContext';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UploadCloud, Link as LinkIcon, Loader2, FileText, X, CheckCircle, ArrowRight, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { motion } from 'framer-motion';

const COUNTRIES = [
  "United States", "China", "European Union", "United Kingdom", "Canada",
  "Japan", "South Korea", "Australia", "India", "Brazil", "Israel",
  "Turkey", "Vietnam", "Thailand", "Mexico"
].sort();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;
const MAX_LINKS = 10;
const DESCRIPTION_MIN_LENGTH = 10;
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export default function NewReport() {
  const { t, language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  
  const [formData, setFormData] = useState({
    product_name: '',
    destination_country: '',
    country_of_manufacture: '',
    description: '',
  });
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [newLink, setNewLink] = useState('');
  const [uploading, setUploading] = useState(false);

  // Auto-Save Draft
  useEffect(() => {
    const saved = localStorage.getItem('newReportDraft');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.formData) setFormData(parsed.formData);
        if (parsed.links) setLinks(parsed.links);
      } catch (e) {
        console.error("Failed to load draft", e);
        localStorage.removeItem('newReportDraft');
      }
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('newReportDraft', JSON.stringify({ formData, links }));
    } catch (e) {
      console.error("Failed to save draft", e);
    }
  }, [formData, links]);

  const validateFile = (file) => {
    const errors = [];
    
    if (file.size > MAX_FILE_SIZE) {
      errors.push(language === 'he' ? 'קובץ גדול מדי (מקסימום 10MB)' : 'File too large (max 10MB)');
    }
    
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      errors.push(language === 'he' ? 'סוג קובץ לא נתמך' : 'File type not supported');
    }
    
    return errors;
  };

  const validateUrl = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    // Check total number of files
    if (files.length + selectedFiles.length > MAX_FILES) {
      toast.error(language === 'he' ? `ניתן להעלות עד ${MAX_FILES} קבצים` : `Maximum ${MAX_FILES} files allowed`);
      return;
    }

    // Validate each file
    const validFiles = [];
    for (const file of selectedFiles) {
      const errors = validateFile(file);
      if (errors.length > 0) {
        toast.error(`${file.name}: ${errors.join(', ')}`);
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) return;

    setUploading(true);
    const uploadedFiles = [];
    const failedFiles = [];

    try {
      for (const file of validFiles) {
        try {
          const result = await base44.integrations.Core.UploadFile({ file });
          if (result?.file_url) {
            uploadedFiles.push(result.file_url);
          } else {
            failedFiles.push(file.name);
          }
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          failedFiles.push(file.name);
        }
      }

      if (uploadedFiles.length > 0) {
        setFiles(prev => [...prev, ...uploadedFiles]);
        toast.success(
          language === 'he' 
            ? `${uploadedFiles.length} קבצים הועלו בהצלחה` 
            : `${uploadedFiles.length} files uploaded successfully`
        );
      }

      if (failedFiles.length > 0) {
        toast.error(
          language === 'he'
            ? `שגיאה בהעלאת: ${failedFiles.join(', ')}`
            : `Failed to upload: ${failedFiles.join(', ')}`
        );
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(language === 'he' ? 'שגיאה בהעלאת קבצים' : 'Failed to upload files');
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleAddLink = () => {
    const trimmedLink = newLink.trim();
    
    if (!trimmedLink) {
      toast.error(language === 'he' ? 'נא להזין קישור' : 'Please enter a link');
      return;
    }

    if (links.length >= MAX_LINKS) {
      toast.error(language === 'he' ? `ניתן להוסיף עד ${MAX_LINKS} קישורים` : `Maximum ${MAX_LINKS} links allowed`);
      return;
    }

    if (!validateUrl(trimmedLink)) {
      toast.error(language === 'he' ? 'קישור לא תקין' : 'Invalid URL');
      return;
    }

    if (links.includes(trimmedLink)) {
      toast.error(language === 'he' ? 'קישור כבר קיים' : 'Link already added');
      return;
    }

    setLinks(prev => [...prev, trimmedLink]);
    setNewLink('');
    toast.success(language === 'he' ? 'קישור נוסף' : 'Link added');
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.product_name?.trim()) {
      errors.product_name = language === 'he' ? 'שדה חובה' : 'Required field';
    }

    if (!formData.destination_country) {
      errors.destination_country = language === 'he' ? 'נא לבחור מדינה' : 'Please select a country';
    }

    if (!formData.country_of_manufacture) {
      errors.country_of_manufacture = language === 'he' ? 'נא לבחור מדינה' : 'Please select a country';
    }

    const hasDescription = formData.description?.trim().length >= DESCRIPTION_MIN_LENGTH;
    const hasFiles = files.length > 0;
    const hasLinks = links.length > 0;

    if (!hasDescription && !hasFiles && !hasLinks) {
      errors.content = language === 'he' 
        ? `נא להוסיף תיאור (לפחות ${DESCRIPTION_MIN_LENGTH} תווים), קבצים או קישורים`
        : `Please add description (min ${DESCRIPTION_MIN_LENGTH} chars), files, or links`;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isFormValid = () => {
    const hasBasicFields = formData.product_name?.trim() && 
                          formData.destination_country && 
                          formData.country_of_manufacture;
    const hasContent = (formData.description?.trim().length >= DESCRIPTION_MIN_LENGTH) || 
                       files.length > 0 || 
                       links.length > 0;
    return hasBasicFields && hasContent;
  };

  const handleSubmit = async () => {
    // Clear previous errors
    setValidationErrors({});

    // Validate form
    if (!validateForm()) {
      toast.error(language === 'he' ? 'נא למלא את כל השדות הנדרשים' : 'Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      // Create report entity
      const report = await base44.entities.ClassificationReport.create({
        product_name: formData.product_name.trim(),
        destination_country: formData.destination_country,
        country_of_manufacture: formData.country_of_manufacture,
        user_input_text: formData.description?.trim() || '',
        uploaded_file_urls: files,
        external_link_urls: links,
        status: 'processing',
        processing_status: 'collecting_info',
        report_id: `RPT-${Date.now()}`
      });

      if (!report?.id) {
        throw new Error('Failed to create report - no ID returned');
      }

      // Start classification (async - with proper error handling)
      base44.functions.invoke('startClassification', { 
        reportId: report.id,
        intendedUse: formData.description?.trim() || ''
      }).then(() => {
        console.log('Classification started successfully');
      }).catch(err => {
        console.error("Classification start error:", err);
        // Show warning to user but don't block success
        toast.warning(
          language === 'he' 
            ? 'הדוח נוצר אך התהליך עשוי להיות מושהה' 
            : 'Report created but processing may be delayed'
        );
      });

      // Clear draft
      localStorage.removeItem('newReportDraft');
      
      // Show success modal
      setShowSuccessModal(true);

    } catch (error) {
      console.error('Report creation error:', error);
      
      // Show detailed error message
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      toast.error(
        language === 'he' 
          ? `שגיאה ביצירת הדוח: ${errorMessage}` 
          : `Failed to create report: ${errorMessage}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-heading text-slate-900 dark:text-white">
          {language === 'he' ? 'סיווג מוצר חדש' : 'New Product Classification'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          {language === 'he' 
            ? 'מלא את פרטי המוצר. המערכת תנתח את המידע ותפנה אליך אם יידרשו הבהרות.'
            : 'Fill in product details. Our system will analyze the data and contact you if clarifications are needed.'}
        </p>
      </div>

      {/* Global validation error */}
      {validationErrors.content && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationErrors.content}</AlertDescription>
        </Alert>
      )}

      <Card className="bg-white dark:bg-[#1E293B]/50 border border-slate-200/80 dark:border-white/[0.08] rounded-2xl">
        <CardHeader>
          <CardTitle className="font-heading">{language === 'he' ? 'פרטי בסיס (חובה)' : 'Core Details (Required)'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{language === 'he' ? 'שם מוצר' : 'Product Name'} *</Label>
              <Input 
                value={formData.product_name}
                onChange={e => {
                  setFormData({...formData, product_name: e.target.value});
                  if (validationErrors.product_name) {
                    setValidationErrors({...validationErrors, product_name: null});
                  }
                }}
                placeholder="e.g., Wireless Mouse M120"
                className={validationErrors.product_name ? 'border-red-500' : ''}
              />
              {validationErrors.product_name && (
                <p className="text-xs text-red-500">{validationErrors.product_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{language === 'he' ? 'מדינת יעד' : 'Destination Country'} *</Label>
              <Select 
                value={formData.destination_country} 
                onValueChange={val => {
                  setFormData({...formData, destination_country: val});
                  if (validationErrors.destination_country) {
                    setValidationErrors({...validationErrors, destination_country: null});
                  }
                }}
              >
                <SelectTrigger className={validationErrors.destination_country ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.destination_country && (
                <p className="text-xs text-red-500">{validationErrors.destination_country}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>{language === 'he' ? 'מדינת ייצור' : 'Country of Manufacture'} *</Label>
              <Select 
                value={formData.country_of_manufacture} 
                onValueChange={val => {
                  setFormData({...formData, country_of_manufacture: val});
                  if (validationErrors.country_of_manufacture) {
                    setValidationErrors({...validationErrors, country_of_manufacture: null});
                  }
                }}
              >
                <SelectTrigger className={validationErrors.country_of_manufacture ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.country_of_manufacture && (
                <p className="text-xs text-red-500">{validationErrors.country_of_manufacture}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-[#1E293B]/50 border border-slate-200/80 dark:border-white/[0.08] rounded-2xl">
        <CardHeader>
          <CardTitle className="font-heading">{language === 'he' ? 'תיאור מעמיק' : 'Deep Description'}</CardTitle>
          <CardDescription>
            {language === 'he' ? 'תאר חומרים, תפקוד, ושימוש (לפחות 10 תווים)...' : 'Describe material, function, usage (min 10 chars)...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea 
            className="min-h-[150px] rounded-xl border-slate-200 dark:border-white/[0.1] dark:bg-white/[0.04] focus:border-[#42C0B9] focus:ring-[#42C0B9]/20"
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
            placeholder={language === 'he' 
              ? 'לדוגמה: עשוי 80% פלדה, משמש ל...' 
              : 'e.g., Made of 80% steel, used for...'}
          />
          <p className="text-xs text-slate-500 mt-2">
            {formData.description?.length || 0} / {DESCRIPTION_MIN_LENGTH} {language === 'he' ? 'תווים מינימום' : 'chars minimum'}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-[#1E293B]/50 border border-slate-200/80 dark:border-white/[0.08] rounded-2xl">
        <CardHeader>
          <CardTitle className="font-heading">{language === 'he' ? 'מרכז הראיות' : 'Evidence Center'}</CardTitle>
          <CardDescription>
            {language === 'he' ? `מקסימום ${MAX_FILES} קבצים, ${MAX_LINKS} קישורים` : `Max ${MAX_FILES} files, ${MAX_LINKS} links`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload */}
          <div className="border-2 border-dashed border-slate-200 dark:border-white/[0.1] rounded-2xl p-8 text-center hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:border-[#42C0B9]/50 transition-all duration-200">
            <input 
              type="file" 
              multiple 
              className="hidden" 
              id="file-upload"
              onChange={handleFileChange}
              disabled={uploading || files.length >= MAX_FILES}
              accept=".pdf,.jpg,.jpeg,.png,.csv,.xls,.xlsx,.doc,.docx"
            />
            <label htmlFor="file-upload" className={`cursor-pointer flex flex-col items-center ${(uploading || files.length >= MAX_FILES) ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <UploadCloud className="w-10 h-10 text-slate-400 mb-2" />
              <span className="text-sm font-medium text-slate-700">
                {uploading ? (language === 'he' ? 'מעלה...' : 'Uploading...') : 
                 files.length >= MAX_FILES ? (language === 'he' ? 'מקסימום קבצים הושג' : 'Maximum files reached') :
                 (language === 'he' ? 'לחץ להעלאת קבצים' : 'Click to upload files')}
              </span>
              <span className="text-xs text-slate-500 mt-1">PDF, Images, CSV, Docs (max 10MB each)</span>
            </label>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((url, idx) => (
                <Badge key={idx} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  File {idx + 1}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-4 w-4 ml-1 hover:bg-slate-200 rounded-full" 
                    onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}

          {/* Links */}
          <div className="flex gap-2">
            <Input 
              value={newLink}
              onChange={e => setNewLink(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleAddLink()}
              placeholder="https://..."
              disabled={links.length >= MAX_LINKS}
            />
            <Button 
              variant="outline" 
              onClick={handleAddLink} 
              type="button"
              disabled={links.length >= MAX_LINKS || !newLink.trim()}
            >
              <LinkIcon className="w-4 h-4 mr-2" />
              {language === 'he' ? 'הוסף' : 'Add'}
            </Button>
          </div>
          
          {links.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {links.map((link, idx) => (
                <Badge key={idx} variant="outline" className="pl-2 pr-1 py-1 flex items-center gap-1 max-w-xs">
                  <span className="truncate">{link}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-4 w-4 ml-1 hover:bg-slate-100 rounded-full flex-shrink-0" 
                    onClick={() => setLinks(links.filter((_, i) => i !== idx))}
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end pt-4">
        <Button 
          size="lg"
          onClick={handleSubmit} 
          disabled={loading || !isFormValid()}
          className="w-full md:w-auto bg-gradient-to-r from-[#42C0B9] to-[#2DA39D] hover:from-[#4DD4CC] hover:to-[#42C0B9] text-white rounded-full px-8 shadow-lg hover:shadow-[0_0_25px_rgba(66,192,185,0.4)] transition-all duration-300 font-semibold disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {language === 'he' ? 'התחל סיווג' : 'Start Classification'}
        </Button>
      </div>

      <Dialog open={showSuccessModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md text-center" hideClose>
          <div className="flex flex-col items-center py-6">
             <motion.div 
               initial={{ scale: 0 }}
               animate={{ scale: 1 }}
               type="spring"
               className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4"
             >
                <CheckCircle className="w-8 h-8 text-green-600" />
             </motion.div>
             
             <h2 className="text-xl font-bold text-slate-900 mb-2">
               {language === 'he' ? 'הדוח נוצר בהצלחה!' : 'Report Created Successfully!'}
             </h2>
             <p className="text-slate-500 mb-8 max-w-xs mx-auto">
               {language === 'he' 
                 ? 'העברנו את המידע לניתוח מומחה. אנו נעדכן אותך כשהתוצאות יהיו מוכנות.'
                 : 'We have forwarded the data for expert analysis. We will notify you when results are ready.'}
             </p>
             
             <Button 
               onClick={() => navigate(createPageUrl('Dashboard'))}
               className="w-full bg-gradient-to-r from-[#42C0B9] to-[#2DA39D] hover:from-[#4DD4CC] hover:to-[#42C0B9] text-white rounded-full font-semibold"
             >
               {language === 'he' ? 'חזור ללוח הבקרה' : 'Back to Dashboard'}
               <ArrowRight className="w-4 h-4 ml-2" />
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
