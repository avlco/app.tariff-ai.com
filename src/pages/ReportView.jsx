import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '../components/providers/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ExternalLink,
  Lock,
  Crown,
  Share2
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Copy, ChevronLeft } from 'lucide-react';

const planLimits = {
  free: 3,
  pay_per_use: 999,
  basic: 15,
  pro: 50,
  agency: 200,
  enterprise: 999,
};

export default function ReportView() {
  const { t, language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [sharingLoading, setSharingLoading] = useState(false);
  
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
  
  const handleShareReport = async () => {
    if (!reportId || sharingLoading) return;
    setSharingLoading(true);
    try {
      const response = await base44.functions.invoke('generateShareableReportLink', { reportId });
      setShareLink(response.data.shareUrl);
      setShowShareDialog(true);
    } catch (error) {
      console.error('Error generating shareable link:', error);
      toast.error(language === 'he' ? 'שגיאה ביצירת קישור שיתוף' : 'Error generating shareable link');
    } finally {
      setSharingLoading(false);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success(language === 'he' ? 'הקישור הועתק' : 'Link copied to clipboard');
  };
  
  const statusConfig = {
    pending: { icon: Clock, color: 'bg-[#D89C42]/10 text-[#D89C42]', label: t('pending') },
    completed: { icon: CheckCircle2, color: 'bg-[#42C0B9]/10 text-[#42C0B9]', label: t('completed') },
    failed: { icon: AlertCircle, color: 'bg-red-100 text-red-600', label: t('failed') },
  };
  
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
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
  
  const StatusIcon = statusConfig[report.status]?.icon || Clock;
  
  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {report.product_name}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {format(new Date(report.created_date), 'dd/MM/yyyy HH:mm')}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleShareReport}
              disabled={!isPremium || sharingLoading}
            >
              {sharingLoading ? (
                <div className="w-4 h-4 me-2 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              ) : (
                <Share2 className="w-4 h-4 me-2" />
              )}
              {language === 'he' ? 'שתף' : 'Share'}
              {!isPremium && <Lock className="w-3 h-3 ms-1" />}
            </Button>
          </div>
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
          
          {/* Classification Reasoning */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">{t('classificationReasoning')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {report.classification_reasoning || '---'}
                </p>
              </CardContent>
            </Card>
          </motion.div>
          
          {/* Product Characteristics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">{t('productCharacteristics')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(report.product_characteristics || []).map((char, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#42C0B9] mt-2 flex-shrink-0" />
                      <span className="text-slate-600 dark:text-slate-300">{char}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
          
          {/* Premium Content */}
          {!isPremium ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#D89C42]/10 flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-[#D89C42]" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    {language === 'he' ? 'תוכן פרימיום' : 'Premium Content'}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-4">
                    {language === 'he' 
                      ? 'שדרג לתוכנית בתשלום כדי לצפות במכסים, דרישות יבוא ומקורות רשמיים'
                      : 'Upgrade to a paid plan to view tariff rates, import requirements, and official sources'}
                  </p>
                  <Link to={createPageUrl('Profile')}>
                    <Button className="bg-[#D89C42] hover:bg-[#D89C42]/90">
                      <Crown className="w-4 h-4 me-2" />
                      {t('upgradeNow')}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <>
              {/* Tariff Information */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('tariffRate')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      {report.tariff_description || '---'}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
              
              {/* Import Requirements */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('importRequirements')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(report.import_requirements || []).map((req, index) => (
                        <div key={index} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                          <h4 className="font-medium text-slate-900 dark:text-white mb-1">
                            {req.title}
                          </h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {req.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
              
              {/* Official Sources */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('officialSources')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(report.official_sources || []).map((source, index) => (
                        <a
                          key={index}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 text-[#42C0B9]" />
                          <span className="text-slate-700 dark:text-slate-300">{source.label}</span>
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </>
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
                {isPremium ? (
                  <div className="space-y-3">
                    {(report.alternative_classifications || []).map((alt, index) => (
                      <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <p className="font-mono font-medium text-[#114B5F] dark:text-[#42C0B9]">
                          {alt.hs_code}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          {alt.explanation}
                        </p>
                      </div>
                    ))}
                    {(!report.alternative_classifications || report.alternative_classifications.length === 0) && (
                      <p className="text-slate-500 text-sm">{t('noResults')}</p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Lock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">{t('upgradeNow')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
      
      {/* Disclaimer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-center py-6 border-t border-slate-200 dark:border-slate-700"
      >
        <p className="text-sm text-slate-400 max-w-2xl mx-auto">
          {t('disclaimer')}
        </p>
      </motion.div>
      
      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'he' ? 'שיתוף דוח' : 'Share Report'}</DialogTitle>
            <DialogDescription>
              {language === 'he' 
                ? 'העתק את הקישור הבא כדי לשתף את הדוח. הקישור יהיה פעיל למשך 7 ימים.' 
                : 'Copy the link below to share the report. The link will be active for 7 days.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input value={shareLink} readOnly className="flex-1" dir="ltr" />
            <Button onClick={copyShareLink} size="icon">
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>
              {language === 'he' ? 'סגור' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}