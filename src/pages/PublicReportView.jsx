import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '../components/providers/LanguageContext';
import ReportContentWrapper from '@/components/report/ReportContentWrapper';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ExternalLink,
  Scale,
  Lock,
  LayoutList,
  BookOpen
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

export default function PublicReportView() {
  const { t, language, setLanguage } = useLanguage();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  
  useEffect(() => {
    let originalLanguage = language;
    
    const loadReport = async () => {
      if (!token) {
        setError('invalidLink');
        setLoading(false);
        return;
      }
      
      try {
        const response = await base44.functions.invoke('getSharedReportData', { token });
        const reportData = response.data.report;
        setReport(reportData);
        if (reportData && reportData.target_language) {
             setLanguage(reportData.target_language);
        }
      } catch (err) {
        console.error('Error loading shared report:', err);
        setError('linkExpired');
      } finally {
        setLoading(false);
      }
    };
    
    loadReport();

    return () => {
        setLanguage(originalLanguage);
    };
  }, [token, setLanguage]);
  
  const statusConfig = {
    pending: { icon: Clock, color: 'bg-[#D89C42]/10 text-[#D89C42]', label: t('processing') },
    completed: { icon: CheckCircle2, color: 'bg-[#42C0B9]/10 text-[#42C0B9]', label: t('completed') },
    failed: { icon: AlertCircle, color: 'bg-red-100 text-red-600', label: t('failed') },
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFBFC] dark:bg-[#0B1120] p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-96" />
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
        </div>
      </div>
    );
  }
  
  const StatusIcon = statusConfig[report.status]?.icon || Clock;

  // חילוץ נתונים מתקדם (כמו בדוח המלא)
  const primaryResult = report.classification_results?.primary || {};
  const regulatoryPrimary = report.regulatory_data?.primary || {};
  const spec = report.structural_analysis || {};
  const research = report.research_findings || {};
  const alternatives = report.classification_results?.alternatives || [];
  
  return (
    <div className="min-h-screen bg-[#FAFBFC] dark:bg-[#0B1120] p-6 print:bg-white print:p-0">
      <div className="max-w-5xl mx-auto space-y-6 print:max-w-none print:space-y-4">
        
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="bg-[#114B5F] text-white p-4 rounded-lg print:hidden">
            <p className="text-sm opacity-90 mb-1">{t('publicReport')}</p>
            <p className="text-xs opacity-70">{t('sharedVia')}</p>
          </div>
          
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge className={`${statusConfig[report.status]?.color} border-0 print:border print:border-slate-300`}>
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
        </div>
        
        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block print:space-y-6">
          
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 1. HS Code Card */}
            <Card className="bg-gradient-to-br from-[#114B5F] to-[#0D3A4A] text-white border-0 overflow-hidden print:bg-none print:text-black print:border print:border-slate-300">
                <CardContent className="p-6 relative">
                  {/* Decorative Circle - Hidden in print */}
                  <div className="absolute top-0 end-0 w-40 h-40 bg-[#42C0B9]/10 rounded-full -translate-y-1/2 translate-x-1/2 print:hidden" />
                  <div className="relative">
                    <p className="text-sm text-white/70 mb-2 print:text-slate-500">{t('hsCode')}</p>
                    <p className="text-5xl font-mono font-bold tracking-tight mb-4">{primaryResult.hs_code || '---'}</p>
                    
                    {primaryResult.legal_basis && (
                        <div className="mb-4 inline-flex items-center bg-white/10 px-2 py-1 rounded text-xs text-white/90 print:bg-slate-100 print:text-slate-800">
                            <span className="font-semibold opacity-70 me-1">{t('legalBasis')}:</span>
                            <ReportContentWrapper languageCode="en" className="font-medium">
                                {primaryResult.legal_basis}
                            </ReportContentWrapper>
                        </div>
                    )}

                    <div className="flex items-center gap-8">
                      <div>
                        <p className="text-sm text-white/70 print:text-slate-500">{t('confidenceScore')}</p>
                        <p className="text-2xl font-semibold text-[#42C0B9] print:text-slate-900">
                          {primaryResult.confidence_score || 0}%
                        </p>
                      </div>
                      <div>
                         <p className="text-sm text-white/70 print:text-slate-500">Duty Rate</p>
                         <p className="text-2xl font-semibold text-[#42C0B9] print:text-slate-900">
                            {regulatoryPrimary.duty_rate || 'N/A'}
                         </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
            </Card>

            {/* 2. Technical Specifications (Expanded Grid) */}
            <Card className="border-0 shadow-sm print:border print:shadow-none break-inside-avoid">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <LayoutList className="w-5 h-5 text-slate-500" />
                        {t('technicalSpec')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-lg print:bg-transparent print:border print:border-slate-100">
                            <h4 className="font-semibold text-sm text-slate-500 mb-1">{t('standardizedName')}</h4>
                            <ReportContentWrapper languageCode={report.target_language}>
                                <p className="text-slate-900">{spec.standardized_name || '---'}</p>
                            </ReportContentWrapper>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-lg print:bg-transparent print:border print:border-slate-100">
                            <h4 className="font-semibold text-sm text-slate-500 mb-1">{t('materialComposition')}</h4>
                            <ReportContentWrapper languageCode={report.target_language}>
                                <p className="text-slate-900">{spec.material_composition || '---'}</p>
                            </ReportContentWrapper>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-lg print:bg-transparent print:border print:border-slate-100">
                            <h4 className="font-semibold text-sm text-slate-500 mb-1">{t('function')}</h4>
                            <ReportContentWrapper languageCode={report.target_language}>
                                <p className="text-slate-900">{spec.function || '---'}</p>
                            </ReportContentWrapper>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-lg print:bg-transparent print:border print:border-slate-100">
                            <h4 className="font-semibold text-sm text-slate-500 mb-1">{t('essentialCharacter')}</h4>
                            <ReportContentWrapper languageCode={report.target_language}>
                                <p className="text-slate-900">{spec.essential_character || '---'}</p>
                            </ReportContentWrapper>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            {/* 3. Classification Reasoning */}
            <Card className="border-0 shadow-sm print:border print:shadow-none break-inside-avoid">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-slate-500" />
                    {t('classificationReasoning')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ReportContentWrapper languageCode={report.target_language}>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {primaryResult.reasoning || report.classification_reasoning || '---'}
                      </p>
                  </ReportContentWrapper>
                </CardContent>
            </Card>

            {/* 4. Taxes & Duties Table (The Missing Part!) */}
            <Card className="border-0 shadow-sm print:border print:shadow-none break-inside-avoid">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Scale className="w-5 h-5 text-slate-500" />
                        {t('taxesDuties')} & {t('complianceRegulation')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Taxes Table */}
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50 print:bg-slate-100">
                                    <TableHead>Type</TableHead>
                                    <TableHead>Rate/Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-medium">Duty Rate</TableCell>
                                    <TableCell>{regulatoryPrimary.duty_rate || '0%'}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">VAT</TableCell>
                                    <TableCell>{regulatoryPrimary.vat_rate || '---'}</TableCell>
                                </TableRow>
                                {regulatoryPrimary.excise_tax && (
                                    <TableRow>
                                        <TableCell className="font-medium">Excise Tax</TableCell>
                                        <TableCell>{regulatoryPrimary.excise_tax}</TableCell>
                                    </TableRow>
                                )}
                                {regulatoryPrimary.anti_dumping_duty && (
                                    <TableRow>
                                        <TableCell className="font-medium text-red-600">Anti-Dumping</TableCell>
                                        <TableCell className="text-red-600">{regulatoryPrimary.anti_dumping_duty}</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Import Requirements List */}
                    {Array.isArray(regulatoryPrimary.import_requirements) && regulatoryPrimary.import_requirements.length > 0 && (
                        <div>
                             <h4 className="font-semibold text-sm text-slate-900 mb-2">{t('importRequirements')}</h4>
                             <ul className="space-y-2">
                                {regulatoryPrimary.import_requirements.map((item, idx) => {
                                    const text = typeof item === 'object' ? item.requirement : item;
                                    return (
                                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                                            <CheckCircle2 className="w-4 h-4 text-[#42C0B9] mt-0.5 shrink-0" />
                                            <span>{text}</span>
                                        </li>
                                    );
                                })}
                             </ul>
                        </div>
                    )}
                    
                    {/* Legality */}
                    {regulatoryPrimary.import_legality && (
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 print:bg-transparent">
                            <h4 className="font-semibold text-sm text-slate-500 mb-1 flex items-center gap-2">
                                <Lock className="w-4 h-4" />
                                {t('importLegality')}
                            </h4>
                            <p className="text-slate-900 whitespace-pre-wrap text-sm">{regulatoryPrimary.import_legality}</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            
            {/* 5. Verified Sources */}
            {research.verified_sources && research.verified_sources.length > 0 && (
              <Card className="border-0 shadow-sm print:border print:shadow-none break-inside-avoid">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <ExternalLink className="w-5 h-5 text-slate-500" />
                        {t('officialSources')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {research.verified_sources.map((source, index) => (
                        <div key={index} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 print:border-slate-200 print:bg-white">
                          <div className="flex-1">
                              <a href={source.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#114B5F] hover:underline block">
                                  {source.title}
                              </a>
                              {source.snippet && <span className="text-xs text-slate-500 line-clamp-2">{source.snippet}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
              </Card>
            )}
          </div>
          
          {/* Sidebar Column */}
          <div className="space-y-6 print:hidden"> 
             {/* Note: Sidebar content is often hidden in print to save space, 
                 but vital info is moved to main column above. 
                 Kept hidden in print for better A4 flow. */}
            
            <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm print:border">
                <CardHeader>
                  <CardTitle className="text-lg">{t('tradeDetails')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
            
            {/* Alternatives */}
            {alternatives && alternatives.length > 0 && (
              <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm print:border">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('alternativeClassifications')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ReportContentWrapper languageCode={report.target_language}>
                        <div className="space-y-3">
                          {alternatives.map((alt, index) => (
                            <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl print:border print:bg-white">
                              <div className="flex justify-between items-center mb-1">
                                <p className="font-mono font-medium text-[#114B5F] dark:text-[#42C0B9]">
                                    {alt.hs_code}
                                </p>
                                <Badge variant="secondary" className="text-xs">{alt.confidence_score}%</Badge>
                              </div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                {alt.reasoning || alt.rejection_reason}
                              </p>
                            </div>
                          ))}
                        </div>
                    </ReportContentWrapper>
                  </CardContent>
              </Card>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="text-center py-6 border-t border-slate-200 dark:border-slate-700 print:mt-8">
          <p className="text-sm text-slate-400 max-w-2xl mx-auto">
            {t('disclaimer')}
          </p>
          <p className="text-xs text-slate-300 mt-2">
            Generated by Tariff AI • {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
