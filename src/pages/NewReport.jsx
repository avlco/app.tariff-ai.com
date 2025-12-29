import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/providers/LanguageContext';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UploadCloud, Link as LinkIcon, Loader2, FileText, X } from 'lucide-react';
import { motion } from 'framer-motion';

const COUNTRIES = [
  "United States", "China", "European Union", "United Kingdom", "Canada",
  "Japan", "South Korea", "Australia", "India", "Brazil", "Israel",
  "Turkey", "Vietnam", "Thailand", "Mexico"
].sort();

export default function NewReport() {
  const { t, language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    product_name: '',
    destination_country: '',
    description: '',
  });

  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [newLink, setNewLink] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = selectedFiles.map(file => 
        base44.integrations.Core.UploadFile({ file })
      );
      const results = await Promise.all(uploadPromises);
      const newFileUrls = results.map(r => r.file_url);
      setFiles(prev => [...prev, ...newFileUrls]);
      toast.success(language === 'he' ? 'קבצים הועלו בהצלחה' : 'Files uploaded successfully');
    } catch (error) {
      console.error(error);
      toast.error(language === 'he' ? 'שגיאה בהעלאה' : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAddLink = () => {
    if (!newLink) return;
    setLinks(prev => [...prev, newLink]);
    setNewLink('');
  };

  const handleSubmit = async () => {
    if (!formData.product_name || !formData.destination_country) {
      toast.error(language === 'he' ? 'נא למלא שדות חובה' : 'Required fields missing');
      return;
    }

    setLoading(true);
    try {
      // 1. Create Entity
      const report = await base44.entities.ClassificationReport.create({
        product_name: formData.product_name,
        destination_country: formData.destination_country,
        user_input_text: formData.description,
        uploaded_file_urls: files,
        external_link_urls: links,
        status: 'processing',
        processing_status: 'collecting_info',
        report_id: `RPT-${Date.now()}`
      });

      // 2. Async Call (Fire and Forget)
      base44.functions.invoke('startClassification', { 
        reportId: report.id,
        intendedUse: formData.description 
      }).catch(err => console.error("Async startClassification error (expected if fire-and-forget):", err));

      // 3. Redirect immediately
      toast.success(language === 'he' ? 'הדוח נוצר. נעדכן אותך בהמשך.' : 'Report started. We will notify you when action is needed.');
      navigate(createPageUrl('Dashboard'));

    } catch (error) {
      console.error(error);
      toast.error(language === 'he' ? 'שגיאה ביצירת הדוח' : 'Failed to start report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          {language === 'he' ? 'סיווג מוצר חדש' : 'New Product Classification'}
        </h1>
        <p className="text-slate-500 mt-2">
          {language === 'he' 
            ? 'מלא את פרטי המוצר. המערכת תנתח את המידע ותפנה אליך אם יידרשו הבהרות.'
            : 'Fill in product details. Our system will analyze the data and contact you if clarifications are needed.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === 'he' ? 'פרטי בסיס (חובה)' : 'Core Details (Required)'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{language === 'he' ? 'שם מוצר' : 'Product Name'}</Label>
              <Input 
                value={formData.product_name}
                onChange={e => setFormData({...formData, product_name: e.target.value})}
                placeholder="e.g., Wireless Mouse M120"
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'he' ? 'מדינת יעד' : 'Destination Country'}</Label>
              <Select 
                value={formData.destination_country} 
                onValueChange={val => setFormData({...formData, destination_country: val})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{language === 'he' ? 'תיאור מעמיק' : 'Deep Description'}</CardTitle>
          <CardDescription>
            {language === 'he' ? 'תאר חומרים, תפקוד, ושימוש...' : 'Describe material, function, usage...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea 
            className="min-h-[150px]"
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
            placeholder={language === 'he' 
              ? 'לדוגמה: עשוי 80% פלדה, משמש ל...' 
              : 'e.g., Made of 80% steel, used for...'}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{language === 'he' ? 'מרכז הראיות' : 'Evidence Center'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload */}
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:bg-slate-50 transition-colors">
            <input 
              type="file" 
              multiple 
              className="hidden" 
              id="file-upload"
              onChange={handleFileChange}
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
              <UploadCloud className="w-10 h-10 text-slate-400 mb-2" />
              <span className="text-sm font-medium text-slate-700">
                {uploading ? (language === 'he' ? 'מעלה...' : 'Uploading...') : (language === 'he' ? 'לחץ להעלאת קבצים' : 'Click to upload files')}
              </span>
              <span className="text-xs text-slate-500 mt-1">PDF, Images, CSV, Docs</span>
            </label>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((url, idx) => (
                <Badge key={idx} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  File {idx + 1}
                  <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 hover:bg-slate-200 rounded-full" onClick={() => setFiles(files.filter((_, i) => i !== idx))}>
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
              placeholder="https://..."
            />
            <Button variant="outline" onClick={handleAddLink} type="button">
              <LinkIcon className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
          
          {links.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {links.map((link, idx) => (
                <Badge key={idx} variant="outline" className="pl-2 pr-1 py-1 flex items-center gap-1">
                  {link}
                  <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 hover:bg-slate-100 rounded-full" onClick={() => setLinks(links.filter((_, i) => i !== idx))}>
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
          disabled={loading}
          className="w-full md:w-auto bg-gradient-to-r from-[#114B5F] to-[#42C0B9] hover:from-[#0D3A4A] hover:to-[#35A89E]"
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {language === 'he' ? 'התחל סיווג' : 'Start Classification'}
        </Button>
      </div>
    </div>
  );
}