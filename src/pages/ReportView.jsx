import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '../components/providers/LanguageContext';
import ReportContentWrapper from '@/components/report/ReportContentWrapper';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Download, 
  Share2,
  ArrowLeft,
  ExternalLink,
  Scale,
  Shield,
  Globe
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function ReportView() {
  const { t, language } = useLanguage();
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  
  useEffect(() => {
    const loadReport = async () => {
      if (!reportId) {
        setError('invalidReport');
        setLoading(false);
        return;
      }
      
      try {
        const response = await base44.entities.ClassificationReport.get(reportId);
        setReport(response);
      } catch (err) {
        console.error('Error loading report:', err);
        setError('reportNotFound');
      } finally {
        setLoading(false);
      }
    };
    
    loadReport();
  }, [reportId]);
  
  const handleExportPDF = async () => {
    if (!report) return;
    
    setIsExporting(true);
    try {
      const response = await base44.functions.invoke('generateReportPDF', { 
        reportId: report.report_id 
      });
      
      if (response.data.pdfUrl) {
        window.open(response.data.pdfUrl, '_blank');
        toast.success(t('pdfExported'));
      }
    } catch (err) {
      console.error('Error exporting PDF:', err);
      toast.error(t('exportFailed'));
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleShare = async () => {
    if (!report) return;
    
    setIsSharing(true);
    try {
      const response = await base44.functions.invoke('generateShareableReportLink', { 
        reportId: report.report_id 
      });
      
      if (response.data.shareUrl) {
        await navigator.clipboard.writeText(response.data.shareUrl);
        toast.success(t('linkCopied'));
      }
    } catch (err) {
      console.error('Error generating share link:', err);
      toast.error(t('shareFailed'));
    } finally {
      setIsSharing(false);
    }
  };
  
  const statusConfig = {
    pending: { icon: Clock, color: 'bg-[#D89C42]/10 text-[#D89C42]', label: t('processing') },
    completed: { icon: CheckCircle2, color: 'bg-[#42C0B9]/10 text-[#42C0B9]', label: t('completed') },
    failed: { icon: AlertCircle, color: 'bg-red-100 text-red-600', label: t('failed') },
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFBFC] dark:bg-[#0B1120] p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-64" />
              <Skeleton className="h-48" />
            </div>
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }
  
  if (error || !report) {
    return (
      <div className="min-h-screen bg-[#FAFBFC] dark:bg-[#0B1120] flex items-center justify-center p-6">
        <div className="text-center">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            {t(error) || t('reportDetails')}
          </h2>
          <p className="text-slate-500 mb-4">
            {t('reportNotFound')}
          </p>
          <Button onClick={() => navigate('/reports')}>
            <ArrowLeft className="w-4 h-4 me-2" />
            {t('backToReports')}
          </Button>
        </div>
      </div>
    );
  }
  
  const StatusIcon = statusConfig[report.status]?.icon || Clock;
  
  return (
    <div className="min-h-screen bg-[#FAFBFC] dark:bg-[#0B1120] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Actions */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/reports')}
              className="text-slate-600 dark:text-slate-400"
            >
              <ArrowLeft className="w-4 h-4 me-2" />
              {t('backToReports')}
            </Button>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleShare}
                disabled={isSharing || report.status !== 'completed'}
              >
                <Share2 className="w-4 h-4 me-2" />
                {t('share')}
              </Button>
              <Button
                onClick={handleExportPDF}
                disabled={isExporting || report.status !== 'completed'}
              >
                <Download className="w-4 h-4 me-2" />
                {isExporting ? t('exporting') : t('exportPDF')}
              </Button>
            </div>
          </div>
          
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge className={`${statusConfig[report.status]?.color} border-0`}>
                <StatusIcon className="w-3 h-3 me-1" />
                {statusConfig[report.status]?.label}
              </Badge>
              <span className="text-sm text-slate-500">
                {t('reportId')}: {report.report_id}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              {report.product_name}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {format(new Date(report.created_date), 'dd/MM/yyyy HH:mm')}
            </p>
          </div>
        </motion.div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* HS Code Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-gradient-to-br from-[#114B5F] to-[#0D3A4A] text-white border-0 overflow-hidden">
                <CardContent className="p-6 relative">
                  <div className="absolute top-0 end-0 w-40 h-40 bg-[#42C0B9]/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="relative">
                    <p className="text-sm text-white/70 mb-2">{t('hsCode')}</p>
                    <p className="text-4xl font-bold mb-4">{report.hs_code || '---'}</p>
                    
                    {report.classification_results?.primary?.legal_basis && (
                      <div className="mb-4 inline-flex items-center bg-white/10 px-3 py-1.5 rounded-lg text-sm text-white/90">
                        <Scale className="w-4 h-4 me-2" />
                        <span className="font-semibold opacity-70 me-1">{t('legalBasis')}:</span>
                        <ReportContentWrapper languageCode="en" className="font-medium">
                          {report.classification_results.primary.legal_basis}
                        </ReportContentWrapper>
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm text-white/70">{t('confidenceScore')}</p>
                        <p className="text-2xl font-semibold text-[#42C0B9]">
                          {report.confidence_score || 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            
            {/* Tabs Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="w-full grid grid-cols-4 mb-6">
                  <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
                  <TabsTrigger value="tariffs">{t('tariffs')}</TabsTrigger>
                  <TabsTrigger value="legal">{t('legal')}</TabsTrigger>
                  <TabsTrigger value="standards">{t('standards')}</TabsTrigger>
                </TabsList>
                
                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6">
                  {/* Classification Reasoning */}
                  <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg">{t('classificationReasoning')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ReportContentWrapper languageCode={report.target_language}>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                          {report.classification_reasoning || '---'}
                        </p>
                      </ReportContentWrapper>
                    </CardContent>
                  </Card>
                  
                  {/* Product Characteristics */}
                  <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg">{t('productCharacteristics')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ReportContentWrapper languageCode={report.target_language}>
                        <ul className="space-y-2">
                          {(report.product_characteristics || []).map((char, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#42C0B9] mt-2 flex-shrink-0" />
                              <span className="text-slate-600 dark:text-slate-300">{char}</span>
                            </li>
                          ))}
                        </ul>
                      </ReportContentWrapper>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                {/* Tariffs Tab */}
                <TabsContent value="tariffs" className="space-y-6">
                  {/* Tariff Information */}
                  {report.tariff_description && (
                    <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FileText className="w-5 h-5 text-[#42C0B9]" />
                          {t('tariffInformation')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ReportContentWrapper languageCode={report.target_language}>
                          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                            {report.tariff_description}
                          </p>
                        </ReportContentWrapper>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Customs and Taxes */}
                  {(report.customs_duty || report.vat_rate || report.additional_taxes) && (
                    <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-lg">{t('customsAndTaxes')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {report.customs_duty && (
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                              <p className="text-sm text-slate-500 dark:text-slate-400">{t('customsDuty')}</p>
                              <p className="text-xl font-semibold text-slate-900 dark:text-white">
                                {report.customs_duty}
                              </p>
                            </div>
                          )}
                          {report.vat_rate && (
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                              <p className="text-sm text-slate-500 dark:text-slate-400">{t('vatRate')}</p>
                              <p className="text-xl font-semibold text-slate-900 dark:text-white">
                                {report.vat_rate}
                              </p>
                            </div>
                          )}
                          {report.additional_taxes && report.additional_taxes.length > 0 && (
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{t('additionalTaxes')}</p>
                              <ReportContentWrapper languageCode={report.target_language}>
                                <ul className="space-y-1">
                                  {report.additional_taxes.map((tax, index) => (
                                    <li key={index} className="text-slate-700 dark:text-slate-300">
                                      • {tax}
                                    </li>
                                  ))}
                                </ul>
                              </ReportContentWrapper>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                
                {/* Legal Tab */}
                <TabsContent value="legal" className="space-y-6">
                  {/* Import Requirements */}
                  {report.import_requirements && report.import_requirements.length > 0 && (
                    <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Shield className="w-5 h-5 text-[#42C0B9]" />
                          {t('importRequirements')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ReportContentWrapper languageCode={report.target_language}>
                          <div className="space-y-4">
                            {report.import_requirements.map((req, index) => (
                              <div key={index} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border-s-4 border-[#42C0B9]">
                                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                                  {req.title}
                                </h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  {req.description}
                                </p>
                                {req.authority && (
                                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                                    {t('authority')}: {req.authority}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </ReportContentWrapper>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Restrictions and Prohibitions */}
                  {report.restrictions && report.restrictions.length > 0 && (
                    <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-lg">{t('restrictionsAndProhibitions')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ReportContentWrapper languageCode={report.target_language}>
                          <div className="space-y-3">
                            {report.restrictions.map((restriction, index) => (
                              <div key={index} className="p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border-s-4 border-red-500">
                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                  {restriction}
                                </p>
                              </div>
                            ))}
                          </div>
                        </ReportContentWrapper>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                
                {/* Standards Tab */}
                <TabsContent value="standards" className="space-y-6">
                  {/* International Standards */}
                  {report.international_standards && report.international_standards.length > 0 && (
                    <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Globe className="w-5 h-5 text-[#42C0B9]" />
                          {t('internationalStandards')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ReportContentWrapper languageCode={report.target_language}>
                          <div className="space-y-4">
                            {report.international_standards.map((standard, index) => (
                              <div key={index} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
                                      {standard.standard_name}
                                    </h4>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                      {standard.description}
                                    </p>
                                  </div>
                                  {standard.compliance_status && (
                                    <Badge className={`${
                                      standard.compliance_status === 'compliant' 
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-amber-100 text-amber-700'
                                    } border-0 ms-2`}>
                                      {t(standard.compliance_status)}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ReportContentWrapper>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Certifications Required */}
                  {report.certifications_required && report.certifications_required.length > 0 && (
                    <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-lg">{t('certificationsRequired')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ReportContentWrapper languageCode={report.target_language}>
                          <div className="space-y-3">
                            {report.certifications_required.map((cert, index) => (
                              <div key={index} className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl">
                                <p className="font-medium text-slate-900 dark:text-white">
                                  {cert}
                                </p>
                              </div>
                            ))}
                          </div>
                        </ReportContentWrapper>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </motion.div>
            
            {/* Official Sources */}
            {report.official_sources && report.official_sources.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('officialSources')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {report.official_sources.map((source, index) => (
                        <a
                          key={index}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                        >
                          <ExternalLink className="w-4 h-4 text-[#42C0B9] group-hover:scale-110 transition-transform" />
                          <span className="text-slate-700 dark:text-slate-300 group-hover:text-[#42C0B9] transition-colors">
                            {source.label}
                          </span>
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Trade Details */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">{t('tradeDetails')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t('countryOfManufacture')}
                    </p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {report.country_of_manufacture || '---'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t('countryOfOrigin')}
                    </p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {report.country_of_origin || '---'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t('destinationCountry')}
                    </p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {report.destination_country || '---'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            
            {/* Alternative Classifications */}
            {report.alternative_classifications && report.alternative_classifications.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('alternativeClassifications')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ReportContentWrapper languageCode={report.target_language}>
                      <div className="space-y-3">
                        {report.alternative_classifications.map((alt, index) => (
                          <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border-s-2 border-slate-300 dark:border-slate-600">
                            <p className="font-mono font-semibold text-[#114B5F] dark:text-[#42C0B9] mb-1">
                              {alt.hs_code}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {alt.explanation}
                            </p>
                            {alt.confidence_score && (
                              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                                {t('confidence')}: {alt.confidence_score}%
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </ReportContentWrapper>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
        
        {/* Disclaimer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center py-6 border-t border-slate-200 dark:border-slate-700"
        >
          <p className="text-sm text-slate-400 max-w-3xl mx-auto">
            {t('disclaimer')}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
