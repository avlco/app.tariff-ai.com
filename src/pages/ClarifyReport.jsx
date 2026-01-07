import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/providers/LanguageContext';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, FileText, UploadCloud, Loader2, ArrowLeft, ExternalLink, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

import { ArrowRight } from 'lucide-react';

export default function ClarifyReport() {
  const { t, language, isRTL } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reportId = searchParams.get('id');
  
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);

  const [responseText, setResponseText] = useState('');
  const [files, setFiles] = useState([]);
  const [newLink, setNewLink] = useState('');
  const [links, setLinks] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadReport = async () => {
      if (!reportId) return;
      try {
        const res = await base44.entities.ClassificationReport.filter({ id: reportId });
        if (res.length > 0) setReport(res[0]);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    loadReport();
  }, [reportId]);

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    setUploading(true);
    try {
      const uploadPromises = selectedFiles.map(file => base44.integrations.Core.UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      setFiles(prev => [...prev, ...results.map(r => r.file_url)]);
      toast.success('Files uploaded');
    } catch (error) { toast.error('Upload failed'); } finally { setUploading(false); }
  };

  const handleAddLink = () => {
    if (newLink) { setLinks(prev => [...prev, newLink]); setNewLink(''); }
  };

  const handleUpdate = async () => {
    if (!responseText && files.length === 0 && links.length === 0) {
        toast.error(t('provideInfo'));
        return;
    }
    setSubmitting(true);
    try {
      const updatedUserInput = (report.user_input_text || '') + `\n\n[User Clarification]: ${responseText}`;
      const updatedFiles = [...(report.uploaded_file_urls || []), ...files];
      const updatedLinks = [...(report.external_link_urls || []), ...links];

      // 1. Update DB synchronously
      await base44.entities.ClassificationReport.update(reportId, {
        user_input_text: updatedUserInput,
        uploaded_file_urls: updatedFiles,
        external_link_urls: updatedLinks,
        status: 'processing',
        processing_status: 'collecting_info',
        missing_info_question: null
      });

      // 2. Fire and Forget - Restart Workflow
      base44.functions.invoke('startClassification', { reportId }).catch(console.error);

      // 3. Show Feedback & Delay Navigate
      setShowProcessing(true);
      setTimeout(() => {
        navigate(createPageUrl('Dashboard'));
      }, 2500);

    } catch (e) { 
        toast.error('Error updating report'); 
        console.error(e);
        setSubmitting(false); 
    } 
  };

  const handleProceedAnyway = async () => {
    if (!confirm(t('forceProceed'))) return;
    setSubmitting(true);
    try {
        // Fire and Forget
        base44.functions.invoke('startClassification', { reportId, forceProceed: true }).catch(console.error);
        
        // Show Feedback & Delay Navigate
        setShowProcessing(true);
        setTimeout(() => {
            navigate(createPageUrl('Dashboard'));
        }, 2500);
    } catch (e) { 
        toast.error('Error initiating force proceed');
        setSubmitting(false);
    }
  };

  if (loading) return <Loader2 className="w-8 h-8 animate-spin mx-auto mt-10"/>;
  if (!report) return <div>Report not found</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <Button variant="ghost" onClick={() => navigate(-1)} className={`mb-2 ${isRTL ? 'pr-0' : 'pl-0'} hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl`}>
                {isRTL ? <ArrowRight className="w-4 h-4 me-2" /> : <ArrowLeft className="w-4 h-4 me-2" />} 
                {t('back')}
            </Button>
            <h1 className="text-3xl font-bold font-heading text-slate-900 dark:text-white">{t('missingInformation')}</h1>
            <p className="text-slate-500 dark:text-slate-400">{t('reportId')}: <span className="font-mono">{report.report_id}</span></p>
        </div>
        <Badge variant="outline" className="bg-[#E5A840]/10 text-[#E5A840] border-[#E5A840]/30">{t('action_required')}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Context (Read Only) */}
        <Card className="bg-slate-50/80 dark:bg-[hsl(222,40%,8%)] border border-slate-200/80 dark:border-[hsl(222,30%,15%)] rounded-2xl h-full">
            <CardHeader><CardTitle className="text-lg font-heading flex items-center gap-2"><FileText className="w-5 h-5 text-[#42C0B9]"/> {t('caseContext')}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-[hsl(222,35%,12%)] p-3 rounded-xl border border-slate-200/80 dark:border-[hsl(222,30%,15%)]"><span className="text-xs text-[hsl(200,15%,60%)] block uppercase tracking-wide">{t('product')}</span><span className="font-medium text-[#114B5F] dark:text-[hsl(0,0%,98%)]">{report.product_name}</span></div>
                    <div className="bg-white dark:bg-[hsl(222,35%,12%)] p-3 rounded-xl border border-slate-200/80 dark:border-[hsl(222,30%,15%)]"><span className="text-xs text-[hsl(200,15%,60%)] block uppercase tracking-wide">{t('destination')}</span><span className="font-medium text-[#114B5F] dark:text-[hsl(0,0%,98%)]">{report.destination_country}</span></div>
                </div>
                <div>
                    <span className="text-xs text-slate-400 block mb-2 uppercase tracking-wide">{t('originalInput')}</span>
                    <div className="bg-white dark:bg-[hsl(222,35%,12%)] p-4 rounded-xl border border-slate-200/80 dark:border-[hsl(222,30%,15%)] text-sm max-h-60 overflow-y-auto whitespace-pre-wrap text-[#1E6B7F] dark:text-[hsl(200,15%,75%)]">{report.user_input_text || 'None'}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {(report.uploaded_file_urls || []).map((_, i) => <Badge key={i} variant="secondary" className="rounded-full">{t('file')} {i+1}</Badge>)}
                    {(report.external_link_urls || []).map((_, i) => <Badge key={i} variant="secondary" className="rounded-full">{t('link')} {i+1}</Badge>)}
                </div>
            </CardContent>
        </Card>

        {/* Right: Action */}
        <div className="space-y-6">
            <Alert className="bg-[#E5A840]/10 border-[#E5A840]/30 text-[#E5A840] rounded-2xl">
                <AlertTriangle className="h-5 w-5"/>
                <AlertTitle className="font-heading">{t('expertRequest')}</AlertTitle>
                <AlertDescription className="text-slate-700 dark:text-slate-300">{report.missing_info_question || t('provideInfo')}</AlertDescription>
            </Alert>

            <Card className="border border-slate-200/80 dark:border-[hsl(222,30%,15%)] rounded-2xl overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-[#42C0B9] to-[#E5A840]" />
                <CardHeader><CardTitle className="font-heading">{t('provideInfo')}</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                    <Textarea value={responseText} onChange={e => setResponseText(e.target.value)} placeholder="Type your answer..." className="min-h-[100px] rounded-xl border-slate-200 dark:border-[hsl(222,30%,15%)] dark:bg-[hsl(222,35%,12%)] focus:border-[#42C0B9] focus:ring-[#42C0B9]/20"/>
                    
                    <div className="flex gap-2 items-center">
                        <Button variant="outline" disabled={uploading} className="relative w-full">
                            <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} />
                            <UploadCloud className="w-4 h-4 me-2"/> {uploading ? 'Uploading...' : 'Upload Files'}
                        </Button>
                    </div>
                    {files.length > 0 && <div className="text-xs text-green-600">{files.length} new files</div>}

                    <div className="flex gap-2">
                        <Input value={newLink} onChange={e => setNewLink(e.target.value)} placeholder="Add URL..." />
                        <Button variant="secondary" onClick={handleAddLink}>Add</Button>
                    </div>
                    {links.map((l, i) => <Badge key={i} variant="outline">{l}</Badge>)}

                    <div className="pt-6 border-t border-slate-200/80 dark:border-[hsl(222,30%,15%)] flex justify-between items-center">
                        <Button variant="ghost" onClick={handleProceedAnyway} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 text-xs rounded-full">{t('forceProceed')}</Button>
                        <Button onClick={handleUpdate} disabled={submitting} className="bg-gradient-to-r from-[#42C0B9] to-[#2DA39D] hover:from-[#4DD4CC] hover:to-[#42C0B9] text-white rounded-full px-6 shadow-lg hover:shadow-[0_0_25px_rgba(66,192,185,0.4)] transition-all duration-300 font-semibold">
                            {submitting && <Loader2 className="w-4 h-4 me-2 animate-spin"/>} {t('submitUpdate')}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>

      <Dialog open={showProcessing}>
        <DialogContent className="sm:max-w-md text-center outline-none rounded-2xl" hideClose>
            <div className="flex flex-col items-center p-6">
                <Loader2 className="w-12 h-12 text-[#42C0B9] animate-spin mb-4" />
                <h2 className="text-lg font-bold font-heading text-slate-900 dark:text-white">Processing Resumed</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
                    We received your input. The expert system is analyzing it now.
                    You will be notified once the classification is ready.
                </p>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}