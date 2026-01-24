import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '../components/providers/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  Lock,
  Crown,
  Share2,
  ChevronLeft,
  AlertTriangle,
  Scale
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function ReportView() {
  const { t, language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const urlParams = new URLSearchParams(window.location.search);
  const reportId = urlParams.get('id');
  
  useEffect(() => {
    const loadData = async () => {
      try {
        const [reportData, userData] = await Promise.all([
          base44.entities.ClassificationReport.filter({ id: reportId }),
          base44.auth.me()
        ]);
        setReport(reportData[0]);
        setUser(userData);
      } catch (error) {
        console.error('Error loading report:', error);
      } finally {
        setLoading(false);
      }
    };
    if (reportId) loadData();
  }, [reportId]);
  
  const isPremium = user?.subscription_plan && ['pay_per_use', 'basic', 'pro', 'agency', 'enterprise'].includes(user.subscription_plan);
  
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }
  
  if (!report) {
    return (
      <div className="max-w-5xl mx-auto text-center py-12">
        <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {language === 'he' ? 'הדוח לא נמצא' : 'Report not found'}
        </h2>
      </div>
    );
  }

  // Safe accessors
  const primaryResult = report.classification_results?.primary || {};
  const alternatives = report.classification_results?.alternatives || [];
  const regulatoryPrimary = report.regulatory_data?.primary || {};
  const regulatoryAlts = report.regulatory_data?.alternatives || [];
  const qa = report.qa_audit || {};
  const spec = report.structural_analysis || {};
  const research = report.research_findings || {};

  const getRegulatoryForCode = (code) => {
    // Check primary
    if (primaryResult.hs_code === code) return regulatoryPrimary;
    // Check alts
    const altReg = regulatoryAlts.find(r => r.hs_code === code);
    return altReg || {};
  };

  const statusConfig = {
    pending: { icon: Clock, color: 'bg-[#D89C42]/10 text-[#D89C42]', label: t('pending') },
    processing: { icon: Clock, color: 'bg-[#D89C42]/10 text-[#D89C42]', label: t('processing') },
    completed: { icon: CheckCircle2, color: 'bg-[#42C0B9]/10 text-[#42C0B9]', label: t('completed') },
    failed: { icon: AlertCircle, color: 'bg-red-100 text-red-600', label: t('failed') },
    waiting_for_user: { icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-600', label: language === 'he' ? 'ממתין למשתמש' : 'Waiting for User' }
  };
  
  const StatusIcon = statusConfig[report.status]?.icon || Clock;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-4 h-4 me-2" />
          {language === 'he' ? 'חזור לדוחות' : 'Back to Reports'}
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge className={`${statusConfig[report.status]?.color} border-0`}>
                <StatusIcon className="w-3 h-3 me-1" />
                {statusConfig[report.status]?.label}
              </Badge>
              <span className="text-sm text-slate-500">
                ID: {report.report_id}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              {report.product_name}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {format(new Date(report.created_date), 'dd/MM/yyyy HH:mm')}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
             <Button variant="outline" onClick={() => window.print()}>
               <FileText className="w-4 h-4 me-2"/>
               {language === 'he' ? 'הדפס' : 'Print'}
             </Button>
          </div>
        </div>
      </motion.div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* QA Score & Warnings */}
            {qa.score !== undefined && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="border-0 shadow-sm overflow-hidden">
                        <div className={`h-2 ${qa.score >= 80 ? 'bg-[#42C0B9]' : qa.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">{language === 'he' ? 'ציון איכות (QA)' : 'Holistic Quality Score'}</h3>
                                <Badge variant="outline" className="text-lg px-3 py-1">
                                    {qa.score}/100
                                </Badge>
                            </div>
                            
                            {qa.score < 80 && qa.user_explanation && (
                                <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>{language === 'he' ? 'שים לב' : 'Attention Needed'}</AlertTitle>
                                    <AlertDescription>
                                        {qa.user_explanation}
                                    </AlertDescription>
                                </Alert>
                            )}
                            
                            {qa.score >= 80 && (
                                <p className="text-slate-600 dark:text-slate-300">
                                    {language === 'he' 
                                        ? 'הדוח עבר את בדיקות האיכות בהצלחה. סיווג זה נחשב אמין.' 
                                        : 'This report has passed quality assurance checks. This classification is considered reliable.'}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Primary Classification */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="bg-gradient-to-br from-[#114B5F] to-[#0D3A4A] text-white border-0">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Scale className="w-5 h-5 text-[#42C0B9]" />
                            {language === 'he' ? 'סיווג ראשי' : 'Primary Classification'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                            <div>
                                <p className="text-white/70 text-sm uppercase tracking-wider mb-1">HS Code</p>
                                <p className="text-5xl font-mono font-bold tracking-tight">{primaryResult.hs_code || '---'}</p>
                            </div>
                            <div className="flex gap-8">
                                <div>
                                    <p className="text-white/70 text-sm uppercase tracking-wider mb-1">Duty Rate</p>
                                    <p className="text-2xl font-semibold text-[#42C0B9]">{regulatoryPrimary.duty_rate || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-white/70 text-sm uppercase tracking-wider mb-1">VAT</p>
                                    <p className="text-2xl font-semibold text-[#42C0B9]">{regulatoryPrimary.vat_rate || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                            <p className="text-white/90 leading-relaxed italic">
                                "{primaryResult.reasoning}"
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Comparison Table */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="border-0 shadow-sm">
                    <CardHeader>
                        <CardTitle>{language === 'he' ? 'השוואת חלופות' : 'Alternatives Comparison'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>HS Code</TableHead>
                                    <TableHead>Confidence</TableHead>
                                    <TableHead>Duty</TableHead>
                                    <TableHead>Reasoning / Rejection</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Primary Row */}
                                <TableRow className="bg-slate-50/50">
                                    <TableCell className="font-mono font-medium text-[#114B5F]">{primaryResult.hs_code}</TableCell>
                                    <TableCell>
                                        <Badge className="bg-[#114B5F] hover:bg-[#114B5F]">{primaryResult.confidence_score}%</Badge>
                                    </TableCell>
                                    <TableCell>{regulatoryPrimary.duty_rate}</TableCell>
                                    <TableCell className="text-sm text-slate-600 max-w-md truncate" title={primaryResult.reasoning}>
                                        <Badge variant="outline" className="text-[#114B5F] border-[#114B5F] mb-1">Primary</Badge>
                                        <br/>
                                        {primaryResult.reasoning}
                                    </TableCell>
                                </TableRow>

                                {/* Alternatives */}
                                {alternatives.map((alt, idx) => {
                                    const reg = getRegulatoryForCode(alt.hs_code);
                                    return (
                                        <TableRow key={idx}>
                                            <TableCell className="font-mono text-slate-600">{alt.hs_code}</TableCell>
                                            <TableCell>{alt.confidence_score}%</TableCell>
                                            <TableCell>{reg.duty_rate || '---'}</TableCell>
                                            <TableCell className="text-sm text-slate-600 max-w-md">
                                                 <span className="font-semibold text-slate-900 block mb-1">Why rejected:</span>
                                                 {alt.rejection_reason || alt.reasoning}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Audit Trail / Details */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="border-0 shadow-sm">
                    <CardHeader>
                        <CardTitle>{language === 'he' ? 'פרטים טכניים ומשפטיים' : 'Technical & Legal Details'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="technical">
                            <TabsList className="w-full justify-start mb-4">
                                <TabsTrigger value="technical">{language === 'he' ? 'מפרט טכני' : 'Technical Spec'}</TabsTrigger>
                                <TabsTrigger value="legal">{language === 'he' ? 'נימוק משפטי מלא' : 'Full Legal Reasoning'}</TabsTrigger>
                                <TabsTrigger value="sources">{language === 'he' ? 'מקורות' : 'Verified Sources'}</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="technical" className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <h4 className="font-semibold text-sm text-slate-500 mb-1">Standardized Name</h4>
                                        <p className="text-slate-900">{spec.standardized_name || '---'}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <h4 className="font-semibold text-sm text-slate-500 mb-1">Material Composition</h4>
                                        <p className="text-slate-900">{spec.material_composition || '---'}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <h4 className="font-semibold text-sm text-slate-500 mb-1">Function</h4>
                                        <p className="text-slate-900">{spec.function || '---'}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <h4 className="font-semibold text-sm text-slate-500 mb-1">Essential Character</h4>
                                        <p className="text-slate-900">{spec.essential_character || '---'}</p>
                                    </div>
                                </div>
                            </TabsContent>
                            
                            <TabsContent value="legal">
                                <div className="prose prose-sm max-w-none p-4 bg-slate-50 rounded-lg">
                                    <p className="whitespace-pre-wrap">{primaryResult.reasoning}</p>
                                </div>
                            </TabsContent>
                            
                            <TabsContent value="sources">
                                <div className="space-y-2">
                                    {(research.verified_sources || []).map((source, idx) => (
                                        <a 
                                            key={idx} 
                                            href={source.url} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="block p-3 bg-white border hover:bg-slate-50 rounded-lg transition-colors group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-medium text-[#114B5F] group-hover:underline">{source.title}</h4>
                                                <ExternalLink className="w-4 h-4 text-slate-400" />
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{source.snippet}</p>
                                            <div className="flex gap-2 mt-2">
                                                <Badge variant="secondary" className="text-[10px] h-5">{new Date(source.date).toLocaleDateString()}</Badge>
                                            </div>
                                        </a>
                                    ))}
                                    {(!research.verified_sources || research.verified_sources.length === 0) && (
                                        <p className="text-slate-500 italic">No public sources linked.</p>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </motion.div>
        </div>

        {/* Right Column (1/3) - Sidebar Info */}
        <div className="space-y-6">
            <Card className="border-0 shadow-sm">
                <CardHeader>
                    <CardTitle>{language === 'he' ? 'פרטי סחר' : 'Trade Details'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div>
                        <h4 className="text-sm font-medium text-slate-500">Destination</h4>
                        <p className="text-lg font-medium">{report.destination_country}</p>
                     </div>
                     <div>
                        <h4 className="text-sm font-medium text-slate-500">Origin</h4>
                        <p className="text-lg font-medium">{report.country_of_origin}</p>
                     </div>
                     <div>
                        <h4 className="text-sm font-medium text-slate-500">Manufacture</h4>
                        <p className="text-lg font-medium">{report.country_of_manufacture}</p>
                     </div>
                     <div className="pt-4 border-t">
                        <h4 className="text-sm font-medium text-slate-500">Import Requirements</h4>
                        <ul className="mt-2 space-y-2">
                            {(regulatoryPrimary.import_requirements || []).map((req, idx) => (
                                <li key={idx} className="text-sm flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-[#42C0B9] mt-0.5 shrink-0" />
                                    <span>{typeof req === 'object' ? req.requirement : req}</span>
                                </li>
                            ))}
                            {(!regulatoryPrimary.import_requirements || regulatoryPrimary.import_requirements.length === 0) && (
                                <li className="text-sm text-slate-500 italic">None specified</li>
                            )}
                        </ul>
                     </div>
                </CardContent>
            </Card>

            <Card className="bg-[#FAFBFC] border-dashed">
                <CardContent className="p-6 text-center">
                    <p className="text-xs text-slate-400 mb-2">
                        {language === 'he' ? 'מזהה דוח' : 'Report ID'}
                    </p>
                    <code className="bg-slate-200 px-2 py-1 rounded text-xs block mb-4">{report.report_id}</code>
                    <p className="text-xs text-slate-500">
                        {language === 'he' 
                            ? 'נוצר ע"י מערכת ACE' 
                            : 'Generated by ACE System'}
                    </p>
                </CardContent>
            </Card>
        </div>

      </div>
    </div>
  );
}