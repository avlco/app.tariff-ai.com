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
  ChevronLeft,
  AlertTriangle,
  Scale
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function ReportView() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const urlParams = new URLSearchParams(window.location.search);
  const reportId = urlParams.get('id');
  
  useEffect(() => {
    const loadData = async () => {
      try {
        const reportData = await base44.entities.ClassificationReport.filter({ id: reportId });
        setReport(reportData[0]);
      } catch (error) {
        console.error('Error loading report:', error);
      } finally {
        setLoading(false);
      }
    };
    if (reportId) loadData();
  }, [reportId]);
  
  if (loading) return <div className="p-6"><Skeleton className="h-8 w-64" /></div>;
  if (!report) return <div className="p-12 text-center">Report not found</div>;

  const primaryResult = report.classification_results?.primary || {};
  const alternatives = report.classification_results?.alternatives || [];
  const regulatoryPrimary = report.regulatory_data?.primary || {};
  const regulatoryAlts = report.regulatory_data?.alternatives || [];
  const qa = report.qa_audit || {};
  const spec = report.structural_analysis || {};
  const research = report.research_findings || {};

  const getRegulatoryForCode = (code) => {
    if (primaryResult.hs_code === code) return regulatoryPrimary;
    const altReg = regulatoryAlts.find(r => r.hs_code === code);
    return altReg || {};
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-4 h-4 me-2" /> {language === 'he' ? 'חזור' : 'Back'}
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{report.product_name}</h1>
            <p className="text-sm text-slate-500 mt-1">{format(new Date(report.created_date), 'dd/MM/yyyy HH:mm')}</p>
          </div>
          <Button variant="outline" onClick={() => window.print()}><FileText className="w-4 h-4 me-2"/> Print</Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            
            {qa.score !== undefined && (
                <Card className="border-0 shadow-sm overflow-hidden">
                    <div className={`h-2 ${qa.score >= 80 ? 'bg-[#42C0B9]' : qa.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">QA Score</h3>
                            <Badge variant="outline" className="text-lg px-3 py-1">{qa.score}/100</Badge>
                        </div>
                        {qa.score < 80 && qa.user_explanation && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Attention</AlertTitle>
                                <AlertDescription>{qa.user_explanation}</AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            )}

            <Card className="bg-gradient-to-br from-[#114B5F] to-[#0D3A4A] text-white border-0">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Scale className="w-5 h-5 text-[#42C0B9]" /> Primary Classification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
                        <div>
                            <p className="text-white/70 text-sm uppercase tracking-wider mb-1">HS Code</p>
                            <p className="text-5xl font-mono font-bold tracking-tight">{primaryResult.hs_code || '---'}</p>
                        </div>
                        <div className="flex gap-8">
                            <div>
                                <p className="text-white/70 text-sm uppercase tracking-wider mb-1">Duty</p>
                                <p className="text-2xl font-semibold text-[#42C0B9]">{regulatoryPrimary.duty_rate || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-white/70 text-sm uppercase tracking-wider mb-1">VAT</p>
                                <p className="text-2xl font-semibold text-[#42C0B9]">{regulatoryPrimary.vat_rate || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                        <p className="text-white/90 leading-relaxed italic">"{primaryResult.reasoning}"</p>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
                <CardHeader><CardTitle>Alternatives</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>HS Code</TableHead>
                                <TableHead>Conf.</TableHead>
                                <TableHead>Duty</TableHead>
                                <TableHead>Reasoning</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow className="bg-slate-50/50">
                                <TableCell className="font-mono font-medium text-[#114B5F]">{primaryResult.hs_code}</TableCell>
                                <TableCell>{primaryResult.confidence_score}%</TableCell>
                                <TableCell>{regulatoryPrimary.duty_rate}</TableCell>
                                <TableCell className="text-sm text-slate-600 whitespace-pre-wrap">{primaryResult.reasoning}</TableCell>
                            </TableRow>
                            {alternatives.map((alt, idx) => {
                                const reg = getRegulatoryForCode(alt.hs_code);
                                return (
                                    <TableRow key={idx}>
                                        <TableCell className="font-mono text-slate-600">{alt.hs_code}</TableCell>
                                        <TableCell>{alt.confidence_score}%</TableCell>
                                        <TableCell>{reg.duty_rate || '---'}</TableCell>
                                        <TableCell className="text-sm text-slate-600 whitespace-pre-wrap">
                                             <span className="font-semibold text-slate-900 block mb-1">Rejection:</span>
                                             {alt.rejection_reason || alt.reasoning}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>

        <div className="space-y-6">
            <Card className="border-0 shadow-sm">
                <CardHeader><CardTitle>Trade Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                     <div><h4 className="text-sm font-medium text-slate-500">Destination</h4><p className="text-lg font-medium">{report.destination_country}</p></div>
                     <div><h4 className="text-sm font-medium text-slate-500">Origin</h4><p className="text-lg font-medium">{report.country_of_origin}</p></div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}