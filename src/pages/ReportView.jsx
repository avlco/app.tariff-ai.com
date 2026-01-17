import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '../api/base44Client';
import { useLanguage } from '../components/providers/LanguageContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Skeleton } from '../components/ui/skeleton';
import { 
  FileText, Share2, Download, AlertCircle, CheckCircle2, 
  Clock, TrendingUp, Package, Globe, MapPin, DollarSign,
  Copy, Check, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '../utils';

export default function ReportView() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  
  // Get and validate reportId
  const urlParams = new URLSearchParams(window.location.search);
  const reportId = urlParams.get('id')?.trim();
  
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Validate reportId format
  const isValidReportId = useCallback((id) => {
    if (!id) return false;
    // Allow alphanumeric, hyphens, and underscores
    return /^[a-zA-Z0-9_-]+$/.test(id);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      // Validation check
      if (!reportId) {
        setError('missing_id');
        setLoading(false);
        toast.error(language === 'he' ? 'מזהה דוח חסר' : 'Report ID is missing');
        setTimeout(() => navigate(createPageUrl('Reports')), 2000);
        return;
      }

      if (!isValidReportId(reportId)) {
        setError('invalid_id');
        setLoading(false);
        toast.error(language === 'he' ? 'מזהה דוח לא תקין' : 'Invalid report ID');
        setTimeout(() => navigate(createPageUrl('Reports')), 2000);
        return;
      }

      try {
        const reportRes = await base44.entities.ClassificationReport.filter({ id: reportId });
        
        // Check if report exists
        if (!reportRes || reportRes.length === 0) {
          setError('not_found');
          setLoading(false);
          toast.error(language === 'he' ? 'דוח לא נמצא' : 'Report not found');
          setTimeout(() => navigate(createPageUrl('Reports')), 2000);
          return;
        }
        
        const reportData = reportRes[0];
        setReport(reportData);
        setError(null);
      } catch (error) {
        console.error('Error loading report:', error);
        setError('load_error');
        toast.error(
          language === 'he' 
            ? `שגיאה בטעינת דוח: ${error.message}` 
            : `Failed to load report: ${error.message}`
        );
        setTimeout(() => navigate(createPageUrl('Reports')), 3000);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [reportId, language, navigate, isValidReportId]);

  // Memoized data
  const primaryResult = useMemo(() => 
    report?.classification_results?.primary || {},
    [report?.classification_results]
  );
  
  const alternatives = useMemo(() => 
    report?.classification_results?.alternatives || [],
    [report?.classification_results]
  );
  
  const regulatoryPrimary = useMemo(() => 
    report?.regulatory_data?.primary || {},
    [report?.regulatory_data]
  );
  
  const qa = useMemo(() => 
    report?.qa_assessment || {},
    [report?.qa_assessment]
  );

  const getRegulatoryForCode = useCallback((code) => {
    if (primaryResult.hs_code === code) return regulatoryPrimary;
    const altReg = report?.regulatory_data?.alternatives?.find(r => r.hs_code === code);
    return altReg || {};
  }, [primaryResult.hs_code, regulatoryPrimary, report?.regulatory_data]);

  const handleShareReport = useCallback(async () => {
    try {
      const result = await base44.functions.invoke('generateShareableReportLink', { reportId });
      if (result?.shareUrl) {
        setShareLink(result.shareUrl);
        setShowShareDialog(true);
        toast.success(language === 'he' ? 'קישור שיתוף נוצר בהצלחה' : 'Share link generated successfully');
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error(language === 'he' ? 'שגיאה ביצירת קישור שיתוף' : 'Failed to generate share link');
    }
  }, [reportId, language]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success(language === 'he' ? 'הקישור הועתק' : 'Link copied');
    setTimeout(() => setCopied(false), 2000);
  }, [shareLink, language]);

  const handleExportPdf = useCallback(async () => {
    setExporting(true);
    try {
      const result = await base44.functions.invoke('generateReportPdf', { reportId });
      if (result?.pdfUrl) {
        window.open(result.pdfUrl, '_blank');
        toast.success(language === 'he' ? 'PDF נוצר בהצלחה' : 'PDF generated successfully');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error(language === 'he' ? 'שגיאה ביצירת PDF' : 'Failed to generate PDF');
    } finally {
      setExporting(false);
    }
  }, [reportId, language]);

  // Loading state
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-96" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>
            {language === 'he' ? 'שגיאה' : 'Error'}
          </AlertTitle>
          <AlertDescription>
            {error === 'missing_id' && (language === 'he' ? 'מזהה דוח חסר' : 'Report ID is missing')}
            {error === 'invalid_id' && (language === 'he' ? 'מזהה דוח לא תקין' : 'Invalid report ID')}
            {error === 'not_found' && (language === 'he' ? 'הדוח לא נמצא במערכת' : 'Report not found in system')}
            {error === 'load_error' && (language === 'he' ? 'שגיאה בטעינת הדוח' : 'Failed to load report')}
          </AlertDescription>
        </Alert>
        <div className="mt-6 text-center">
          <Button onClick={() => navigate(createPageUrl('Reports'))}>
            {language === 'he' ? 'חזרה לדוחות' : 'Back to Reports'}
          </Button>
        </div>
      </div>
    );
  }

  // No report data
  if (!report) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <AlertCircle className="w-16 h-16 mx-auto text-slate-400 mb-4" />
        <h2 className="text-2xl font-semibold mb-2">
          {language === 'he' ? 'לא נמצא דוח' : 'No Report Found'}
        </h2>
        <Button onClick={() => navigate(createPageUrl('Reports'))} className="mt-4">
          {language === 'he' ? 'חזרה לדוחות' : 'Back to Reports'}
        </Button>
      </div>
    );
  }

  const statusConfig = {
    completed: { color: 'bg-green-500', text: language === 'he' ? 'הושלם' : 'Completed', icon: CheckCircle2 },
    processing: { color: 'bg-blue-500', text: language === 'he' ? 'מעבד' : 'Processing', icon: Clock },
    pending: { color: 'bg-yellow-500', text: language === 'he' ? 'ממתין' : 'Pending', icon: Clock },
    failed: { color: 'bg-red-500', text: language === 'he' ? 'נכשל' : 'Failed', icon: AlertCircle },
  };

  const currentStatus = statusConfig[report.status] || statusConfig.pending;
  const StatusIcon = currentStatus.icon;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {report.product_name || t('classificationReport')}
          </h1>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="flex items-center gap-1">
              <StatusIcon className="w-3 h-3" />
              {currentStatus.text}
            </Badge>
            <span className="text-sm text-slate-500">
              {new Date(report.created_date).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}
            </span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleShareReport}>
            <Share2 className="w-4 h-4 me-2" />
            {t('share')}
          </Button>
          <Button variant="outline" onClick={handleExportPdf} disabled={exporting}>
            <Download className="w-4 h-4 me-2" />
            {exporting ? t('exporting') : t('exportPdf')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* QA Score */}
          {qa.score !== undefined && (
            <Card className="border-0 shadow-sm overflow-hidden">
              <div className={`h-2 ${qa.score >= 80 ? 'bg-[#42C0B9]' : qa.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} />
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{t('qaScore')}</h3>
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {qa.score}/100
                  </Badge>
                </div>
                
                {qa.score < 80 && qa.user_explanation && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t('attentionNeeded')}</AlertTitle>
                    <AlertDescription>{qa.user_explanation}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Primary Classification */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#42C0B9]" />
                {t('primaryClassification')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{t('hsCode')}</p>
                  <p className="text-2xl font-bold font-mono text-[#42C0B9]">
                    {primaryResult.hs_code || 'N/A'}
                  </p>
                </div>
                <Badge className="text-lg px-4 py-2">
                  {primaryResult.confidence_score}% {t('confidence')}
                </Badge>
              </div>

              {primaryResult.reasoning && (
                <div>
                  <h4 className="font-semibold mb-2">{t('reasoning')}</h4>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {primaryResult.reasoning}
                  </p>
                </div>
              )}

              {regulatoryPrimary.tariff_rate && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{t('tariffRate')}</p>
                    <p className="text-lg font-semibold">{regulatoryPrimary.tariff_rate}</p>
                  </div>
                  {regulatoryPrimary.duty_amount && (
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{t('estimatedDuty')}</p>
                      <p className="text-lg font-semibold">${regulatoryPrimary.duty_amount}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alternatives */}
          {alternatives.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('alternativeClassifications')}</CardTitle>
                <CardDescription>{t('otherPossibleCodes')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('hsCode')}</TableHead>
                      <TableHead>{t('confidence')}</TableHead>
                      <TableHead>{t('tariffRate')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alternatives.map((alt, idx) => {
                      const reg = getRegulatoryForCode(alt.hs_code);
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-mono font-semibold">{alt.hs_code}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{alt.confidence_score}%</Badge>
                          </TableCell>
                          <TableCell>{reg.tariff_rate || 'N/A'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Product Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('productDetails')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {report.destination_country && (
                <div className="flex items-start gap-2">
                  <Globe className="w-4 h-4 text-slate-500 mt-0.5" />
                  <div>
                    <p className="text-slate-600 dark:text-slate-400">{t('destination')}</p>
                    <p className="font-semibold">{report.destination_country}</p>
                  </div>
                </div>
              )}
              
              {report.country_of_manufacture && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-500 mt-0.5" />
                  <div>
                    <p className="text-slate-600 dark:text-slate-400">{t('origin')}</p>
                    <p className="font-semibold">{report.country_of_manufacture}</p>
                  </div>
                </div>
              )}

              {report.user_input_text && (
                <div>
                  <p className="text-slate-600 dark:text-slate-400 mb-1">{t('description')}</p>
                  <p className="text-slate-900 dark:text-white whitespace-pre-wrap">
                    {report.user_input_text}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'he' ? 'שתף דוח' : 'Share Report'}</DialogTitle>
            <DialogDescription>
              {language === 'he' ? 'העתק את הקישור לשיתוף הדוח' : 'Copy the link to share this report'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <input
              type="text"
              value={shareLink}
              readOnly
              className="flex-1 px-3 py-2 border rounded-md bg-slate-50 dark:bg-slate-900"
            />
            <Button onClick={handleCopyLink} variant="outline">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
