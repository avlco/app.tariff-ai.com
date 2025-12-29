import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/providers/LanguageContext';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, FileText, UploadCloud, Loader2, ArrowLeft } from 'lucide-react';

export default function ClarifyReport() {
  const { t, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reportId = searchParams.get('id');
  
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [responseText, setResponseText] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadReport = async () => {
      if (!reportId) return;
      try {
        const res = await base44.entities.ClassificationReport.filter({ id: reportId });
        if (res.length > 0) setReport(res[0]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadReport();
  }, [reportId]);

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
      toast.success('Files uploaded');
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async () => {
    if (!responseText && files.length === 0) {
      toast.error(language === 'he' ? 'אנא ספק מידע' : 'Please provide information');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Update Report Entity
      const updatedUserInput = (report.user_input_text || '') + `\n\n[User Clarification]: ${responseText}`;
      const updatedFiles = [...(report.uploaded_file_urls || []), ...files];

      await base44.entities.ClassificationReport.update(reportId, {
        user_input_text: updatedUserInput,
        uploaded_file_urls: updatedFiles,
        status: 'processing',
        processing_status: 'collecting_info',
        missing_info_question: null // Clear the question
      });

      // 2. Trigger Analysis again (Async)
      base44.functions.invoke('startClassification', { reportId }).catch(console.error);

      // 3. Redirect
      toast.success(language === 'he' ? 'המידע עודכן. ממשיכים בניתוח.' : 'Updated. Resuming analysis.');
      navigate(createPageUrl('Dashboard'));

    } catch (e) {
      console.error(e);
      toast.error('Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto"/></div>;
  if (!report) return <div className="p-8 text-center">Report not found</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          {language === 'he' ? 'נדרשת הבהרה' : 'Clarification Needed'}
          <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
             {report.product_name}
          </Badge>
        </h1>
      </div>

      {/* Read Only Zone */}
      <Card className="bg-slate-50 border-dashed">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">
             {language === 'he' ? 'פרטי דוח (קריאה בלבד)' : 'Report Context (Read Only)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
           <div>
              <span className="text-xs text-slate-400 block">Product</span>
              <span className="font-medium">{report.product_name}</span>
           </div>
           <div>
              <span className="text-xs text-slate-400 block">Destination</span>
              <span className="font-medium">{report.destination_country}</span>
           </div>
        </CardContent>
      </Card>

      {/* Expert Feedback */}
      <Alert variant="destructive" className="bg-orange-50 border-orange-200 text-orange-900">
        <AlertCircle className="h-5 w-5" />
        <AlertTitle className="font-bold mb-2">
           {language === 'he' ? 'דרישת המומחה' : 'Expert Request'}
        </AlertTitle>
        <AlertDescription className="text-lg">
           {report.missing_info_question || "Please provide additional technical details."}
        </AlertDescription>
      </Alert>

      {/* Response Zone */}
      <Card>
        <CardHeader>
           <CardTitle>{language === 'he' ? 'תשובתך' : 'Your Response'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <Textarea 
                value={responseText}
                onChange={e => setResponseText(e.target.value)}
                placeholder={language === 'he' ? 'כתוב את ההבהרה כאן...' : 'Type your clarification here...'}
                className="min-h-[120px]"
            />
            
            <div className="flex items-center gap-4">
                <Button variant="outline" className="relative" disabled={uploading}>
                    <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} />
                    <UploadCloud className="w-4 h-4 mr-2" />
                    {uploading ? 'Uploading...' : (language === 'he' ? 'צרף קבצים' : 'Attach Files')}
                </Button>
                {files.length > 0 && <span className="text-sm text-green-600">{files.length} files attached</span>}
            </div>

            <div className="pt-4 border-t flex justify-end gap-3">
                <Button 
                    variant="ghost" 
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => {
                        if (!confirm(language === 'he' ? 'האם אתה בטוח? הדיוק עלול להיפגע.' : 'Are you sure? Accuracy might be compromised.')) return;
                        setSubmitting(true);
                        // Trigger Analysis with FORCE flag
                        base44.functions.invoke('startClassification', { reportId, force_proceed: true })
                            .then(() => {
                                toast.success(language === 'he' ? 'המשך כפוי בוצע' : 'Forced Proceed Executed');
                                navigate(createPageUrl('Dashboard'));
                            })
                            .catch((e) => {
                                console.error(e);
                                setSubmitting(false);
                            });
                    }}
                    disabled={submitting}
                >
                    {language === 'he' ? 'התעלם והמשך (לא מומלץ)' : 'Ignore & Proceed (Not Recommended)'}
                </Button>

                <Button 
                    onClick={handleUpdate} 
                    disabled={submitting}
                    className="bg-[#114B5F] hover:bg-[#0D3A4A] text-white"
                >
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {language === 'he' ? 'עדכן והמשך ניתוח' : 'Update & Resume Analysis'}
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}