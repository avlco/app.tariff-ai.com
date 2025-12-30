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

export default function ClarifyReport() {
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reportId = searchParams.get('id');
  
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
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
        toast.error(language === 'he' ? 'אנא ספק מידע' : 'Please provide information.');
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

      // 3. Navigate immediately
      toast.success(language === 'he' ? 'המידע עודכן, הסיווג נמשך ברקע.' : 'Updated. Classification resumed in background.');
      navigate(createPageUrl('Dashboard'));

    } catch (e) { 
        toast.error('Error updating report'); 
        console.error(e);
        setSubmitting(false); 
    } 
  };

  const handleProceedAnyway = async () => {
    if (!confirm(language === 'he' ? 'להמשיך ללא מידע? הדיוק עלול להיפגע.' : 'Proceed without info? Accuracy might be reduced.')) return;
    setSubmitting(true);
    try {
        // Fire and Forget
        base44.functions.invoke('startClassification', { reportId, forceProceed: true }).catch(console.error);
        
        toast.success(language === 'he' ? 'התהליך נכפה ברקע.' : 'Process forced in background.');
        navigate(createPageUrl('Dashboard'));
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
            <Button variant="ghost" onClick={() => navigate(-1)} className="mb-2 pl-0"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
            <h1 className="text-3xl font-bold">Missing Information</h1>
            <p className="text-slate-500">Report ID: {report.report_id}</p>
        </div>
        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Action Required</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Context (Read Only) */}
        <Card className="bg-slate-50/80 h-full">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5"/> Case Context</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded border"><span className="text-xs text-slate-400 block">PRODUCT</span><span className="font-medium">{report.product_name}</span></div>
                    <div className="bg-white p-3 rounded border"><span className="text-xs text-slate-400 block">DESTINATION</span><span className="font-medium">{report.destination_country}</span></div>
                </div>
                <div>
                    <span className="text-xs text-slate-400 block mb-2">ORIGINAL INPUT</span>
                    <div className="bg-white p-4 rounded border text-sm max-h-60 overflow-y-auto whitespace-pre-wrap">{report.user_input_text || 'None'}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {(report.uploaded_file_urls || []).map((_, i) => <Badge key={i} variant="secondary">File {i+1}</Badge>)}
                    {(report.external_link_urls || []).map((_, i) => <Badge key={i} variant="secondary">Link {i+1}</Badge>)}
                </div>
            </CardContent>
        </Card>

        {/* Right: Action */}
        <div className="space-y-6">
            <Alert variant="destructive" className="bg-orange-50 border-orange-200 text-orange-900">
                <AlertTriangle className="h-5 w-5"/>
                <AlertTitle>Expert Request</AlertTitle>
                <AlertDescription>{report.missing_info_question || "Please provide details."}</AlertDescription>
            </Alert>

            <Card className="border-t-4 border-t-[#114B5F]">
                <CardHeader><CardTitle>Provide Info</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                    <Textarea value={responseText} onChange={e => setResponseText(e.target.value)} placeholder="Type your answer..." className="min-h-[100px]"/>
                    
                    <div className="flex gap-2 items-center">
                        <Button variant="outline" disabled={uploading} className="relative w-full">
                            <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} />
                            <UploadCloud className="w-4 h-4 mr-2"/> {uploading ? 'Uploading...' : 'Upload Files'}
                        </Button>
                    </div>
                    {files.length > 0 && <div className="text-xs text-green-600">{files.length} new files</div>}

                    <div className="flex gap-2">
                        <Input value={newLink} onChange={e => setNewLink(e.target.value)} placeholder="Add URL..." />
                        <Button variant="secondary" onClick={handleAddLink}>Add</Button>
                    </div>
                    {links.map((l, i) => <Badge key={i} variant="outline">{l}</Badge>)}

                    <div className="pt-6 border-t flex justify-between items-center">
                        <Button variant="ghost" onClick={handleProceedAnyway} className="text-red-600 text-xs">Force Proceed (Risk Low Accuracy)</Button>
                        <Button onClick={handleUpdate} disabled={submitting} className="bg-[#114B5F] text-white">
                            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>} Submit Update
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}