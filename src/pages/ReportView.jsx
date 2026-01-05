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
  Share2, Copy, Loader2,
  ChevronLeft,
  AlertTriangle,
  Scale
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import ReportContentWrapper from '@/components/report/ReportContentWrapper';

export default function ReportView() {
  const { t, language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [tradeResource, setTradeResource] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isSharing, setIsSharing] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareExpiry, setShareExpiry] = useState('');
  
  const urlParams = new URLSearchParams(window.location.search);
  const reportId = urlParams.get('id');
  
  useEffect(() => {
    const loadData = async () => {
      try {
        const reportRes = await base44.entities.ClassificationReport.filter({ id: reportId });
        const reportData = reportRes[0];
        setReport(reportData);
        
        let resourceData = null;
        if (reportData?.destination_country) {
             const resources = await base44.entities.CountryTradeResource.filter({ country_name: reportData.destination_country });
             resourceData = resources[0];
             setTradeResource(resourceData);
        }

        const userData = await base44.auth.me();
        setUser(userData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    if (reportId) loadData();
  }, [reportId]);
  
  const isPremium = user?.subscription_plan && ['pay_per_use', 'basic', 'pro', 'agency', 'enterprise'].includes(user.subscription_plan);

  const handleShareReport = async () => {
    if (!reportId) return;
    setIsSharing(true);
    try {
      const { data } = await base44.functions.invoke('generateShareableReportLink', { reportId });
      if (data.success) {
        setShareLink(data.shareUrl);
        setShareExpiry(data.expiryDate);
        setShowShareDialog(true);
        toast.success(language === 'he' ? 'קישור שיתוף נוצר בהצלחה!' : 'Share link generated successfully!');
      } else {
        throw new Error(data.error || 'Failed to generate share link');
      }
    } catch (error) {
      console.error('Error generating share link:', error);
      toast.error(language === 'he' ? 'שגיאה ביצירת קישור שיתוף: ' + error.message : 'Error generating share link: ' + error.message);
    } finally {
      setIsSharing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success(language === 'he' ? 'הקישור הועתק!' : 'Link copied to clipboard!');
  };
  
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
             {report.status === 'completed' && (
                <Button variant="outline" onClick={handleShareReport} disabled={isSharing}>
                  {isSharing ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Share2 className="w-4 h-4 me-2" />}
                  {language === 'he' ? 'שתף' : 'Share'}
                </Button>
             )}
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
                            <ReportContentWrapper languageCode={report.target_language}>
                                <p className="text-white/90 leading-relaxed italic">
                                    "{primaryResult.reasoning}"
                                </p>
                            </ReportContentWrapper>
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
                                        <ReportContentWrapper languageCode={report.target_language}>
                                            {primaryResult.reasoning}
                                        </ReportContentWrapper>
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
                                                 <ReportContentWrapper languageCode={report.target_language}>
                                                    {alt.rejection_reason || alt.reasoning}
                                                 </ReportContentWrapper>
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
                                <TabsTrigger value="compliance">{language === 'he' ? 'תאימות ורגולציה' : 'Compliance & Regulation'}</TabsTrigger>
                                <TabsTrigger value="sources">{language === 'he' ? 'מקורות' : 'Verified Sources'}</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="compliance" className="space-y-6">
                                {/* Taxes & Duties Section */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                        <Scale className="w-4 h-4 text-[#42C0B9]" />
                                        {language === 'he' ? 'מיסים ועלויות' : 'Taxes & Duties'}
                                        <Badge variant="outline" className="text-xs font-normal ms-auto">
                                            Method: {tradeResource?.tax_method || 'CIF'}
                                        </Badge>
                                    </h3>
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50">
                                                    <TableHead>Type</TableHead>
                                                    <TableHead>Rate/Amount</TableHead>
                                                    <TableHead>Source</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                <TableRow>
                                                    <TableCell>Duty Rate</TableCell>
                                                    <TableCell className="font-medium">{regulatoryPrimary.duty_rate || '0%'}</TableCell>
                                                    <TableCell><Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">Official Source</Badge></TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell>VAT</TableCell>
                                                    <TableCell>{regulatoryPrimary.vat_rate || '---'}</TableCell>
                                                    <TableCell><Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">Official Source</Badge></TableCell>
                                                </TableRow>
                                                {regulatoryPrimary.excise_tax && (
                                                    <TableRow>
                                                        <TableCell>Excise Tax</TableCell>
                                                        <TableCell>{regulatoryPrimary.excise_tax}</TableCell>
                                                        <TableCell><Badge variant="secondary" className="text-[10px] bg-purple-50 text-purple-700">Regulation</Badge></TableCell>
                                                    </TableRow>
                                                )}
                                                {regulatoryPrimary.anti_dumping_duty && (
                                                    <TableRow>
                                                        <TableCell className="text-red-600">Anti-Dumping</TableCell>
                                                        <TableCell className="text-red-600 font-medium">{regulatoryPrimary.anti_dumping_duty}</TableCell>
                                                        <TableCell><Badge variant="secondary" className="text-[10px] bg-red-50 text-red-700">Trade Defense</Badge></TableCell>
                                                    </TableRow>
                                                )}
                                                {regulatoryPrimary.other_fees && (
                                                    <TableRow>
                                                        <TableCell>Other Fees</TableCell>
                                                        <TableCell>{regulatoryPrimary.other_fees}</TableCell>
                                                        <TableCell><Badge variant="secondary" className="text-[10px]">Port/Levy</Badge></TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                {/* Standards & Certification */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-[#42C0B9]" />
                                        {language === 'he' ? 'תקינה ואישורים' : 'Standards & Certification'}
                                    </h3>
                                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                        {Array.isArray(regulatoryPrimary.standards_requirements) && regulatoryPrimary.standards_requirements.length > 0 ? (
                                            <ul className="space-y-3">
                                                {regulatoryPrimary.standards_requirements.map((item, idx) => (
                                                    <li key={idx} className="flex flex-col gap-1">
                                                        <span className="text-slate-900 font-medium">• {item.requirement || item}</span>
                                                        {item.verification_url && (
                                                            <a href={item.verification_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline w-fit">
                                                                <ExternalLink className="w-3 h-3" />
                                                                Verify Source
                                                            </a>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-slate-900 whitespace-pre-wrap mb-4">
                                                {typeof regulatoryPrimary.standards_requirements === 'string' 
                                                    ? regulatoryPrimary.standards_requirements 
                                                    : 'No specific standards found.'}
                                            </p>
                                        )}
                                        
                                        {tradeResource?.regulation_links?.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-200/60">
                                                <span className="text-xs text-slate-400 w-full mb-1">Official Resource Links:</span>
                                                {tradeResource.regulation_links.map((link, idx) => (
                                                    <a key={idx} href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-white border rounded-md text-xs text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-colors">
                                                        <ExternalLink className="w-3 h-3" />
                                                        Source {idx + 1}
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <h4 className="font-semibold text-sm text-slate-500 mb-1 flex items-center gap-2">
                                        <Lock className="w-4 h-4" />
                                        {language === 'he' ? 'חוקיות יבוא' : 'Import Legality'}
                                    </h4>
                                    <p className="text-slate-900 whitespace-pre-wrap">{regulatoryPrimary.import_legality || '---'}</p>
                                </div>
                            </TabsContent>

                            <TabsContent value="technical" className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <h4 className="font-semibold text-sm text-slate-500 mb-1">Standardized Name</h4>
                                        <ReportContentWrapper languageCode={report.target_language}>
                                            <p className="text-slate-900">{spec.standardized_name || '---'}</p>
                                        </ReportContentWrapper>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <h4 className="font-semibold text-sm text-slate-500 mb-1">Material Composition</h4>
                                        <ReportContentWrapper languageCode={report.target_language}>
                                            <p className="text-slate-900">{spec.material_composition || '---'}</p>
                                        </ReportContentWrapper>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <h4 className="font-semibold text-sm text-slate-500 mb-1">Function</h4>
                                        <ReportContentWrapper languageCode={report.target_language}>
                                            <p className="text-slate-900">{spec.function || '---'}</p>
                                        </ReportContentWrapper>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <h4 className="font-semibold text-sm text-slate-500 mb-1">Essential Character</h4>
                                        <ReportContentWrapper languageCode={report.target_language}>
                                            <p className="text-slate-900">{spec.essential_character || '---'}</p>
                                        </ReportContentWrapper>
                                    </div>
                                </div>
                            </TabsContent>
                            
                            <TabsContent value="legal">
                                <div className="prose prose-sm max-w-none p-4 bg-slate-50 rounded-lg">
                                    <ReportContentWrapper languageCode={report.target_language}>
                                        <p className="whitespace-pre-wrap">{primaryResult.reasoning}</p>
                                    </ReportContentWrapper>
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
                     
                     {/* Regulatory Context Panel */}
                     {tradeResource && (
                        <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100">
                            <h4 className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-2">Regulatory Context</h4>
                            
                            <div className="mb-2">
                                <span className="text-xs text-slate-500 block">Regional Agreements:</span>
                                <span className="text-sm font-medium text-slate-700">{tradeResource.regional_agreements || 'None'}</span>
                            </div>
                            
                            <div className="mb-2">
                                <span className="text-xs text-slate-500 block">HS Structure:</span>
                                <span className="text-sm font-mono text-slate-700">{tradeResource.hs_structure || 'Standard'}</span>
                            </div>

                            <div>
                                <span className="text-xs text-slate-500 block">Tax Method:</span>
                                <Badge variant="outline" className="bg-white text-xs font-normal mt-1">
                                    {tradeResource.tax_method || 'CIF'}
                                </Badge>
                            </div>
                        </div>
                     )}

                     <div className="pt-4 border-t">
                        <h4 className="text-sm font-medium text-slate-500">Import Requirements</h4>
                        <ul className="mt-2 space-y-3">
                            {(regulatoryPrimary.import_requirements || []).map((req, idx) => {
                                const text = typeof req === 'object' ? req.requirement : req;
                                const url = typeof req === 'object' ? req.verification_url : null;
                                return (
                                    <li key={idx} className="text-sm flex flex-col gap-1">
                                        <div className="flex items-start gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-[#42C0B9] mt-0.5 shrink-0" />
                                            <span>{text}</span>
                                        </div>
                                        {url && (
                                            <a href={url} target="_blank" rel="noreferrer" className="ml-6 text-xs text-blue-500 hover:underline flex items-center gap-1">
                                                <ExternalLink className="w-3 h-3" /> Verify
                                            </a>
                                        )}
                                    </li>
                                );
                            })}
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

    <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{language === 'he' ? 'שתף דוח' : 'Share Report'}</DialogTitle>
          <DialogDescription>
            {language === 'he' ? 'העתק את הקישור הציבורי לדוח זה.' : 'Copy the public link to this report.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <Input readOnly value={shareLink} className="flex-grow" />
          <Button onClick={copyToClipboard} variant="outline" size="icon">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        {shareExpiry && (
          <p className="text-xs text-slate-500 mt-2">
            {language === 'he' ? 'תוקף קישור: ' : 'Link valid until: '}
            {format(new Date(shareExpiry), 'dd/MM/yyyy HH:mm')}
            {language === 'he' ? ' (7 ימים)' : ' (7 days)'}
          </p>
        )}
        <DialogFooter>
          <Button onClick={() => setShowShareDialog(false)}>{language === 'he' ? 'סגור' : 'Close'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  );
}