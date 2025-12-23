import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

export default function PublicReportView() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  
  useEffect(() => {
    const loadReport = async () => {
      if (!token) {
        setError('קישור לא חוקי');
        setLoading(false);
        return;
      }
      
      try {
        const response = await base44.functions.invoke('getSharedReportData', { token });
        setReport(response.data.report);
      } catch (err) {
        console.error('Error loading shared report:', err);
        setError('הקישור פג תוקף או לא תקין');
      } finally {
        setLoading(false);
      }
    };
    
    loadReport();
  }, [token]);
  
  const statusConfig = {
    pending: { icon: Clock, color: 'bg-[#D89C42]/10 text-[#D89C42]', label: 'בתהליך' },
    completed: { icon: CheckCircle2, color: 'bg-[#42C0B9]/10 text-[#42C0B9]', label: 'הושלם' },
    failed: { icon: AlertCircle, color: 'bg-red-100 text-red-600', label: 'נכשל' },
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFBFC] dark:bg-[#0B1120] p-6">
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
      </div>
    );
  }
  
  if (error || !report) {
    return (
      <div className="min-h-screen bg-[#FAFBFC] dark:bg-[#0B1120] flex items-center justify-center p-6">
        <div className="text-center">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            {error || 'הדוח לא נמצא'}
          </h2>
          <p className="text-slate-500">
            ייתכן שהקישור פג תוקף או שאינו תקין
          </p>
        </div>
      </div>
    );
  }
  
  const StatusIcon = statusConfig[report.status]?.icon || Clock;
  
  return (
    <div className="min-h-screen bg-[#FAFBFC] dark:bg-[#0B1120] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <div className="bg-[#114B5F] text-white p-4 rounded-lg">
            <p className="text-sm opacity-90 mb-1">דוח משותף</p>
            <p className="text-xs opacity-70">דוח זה שותף באמצעות Tariff AI</p>
          </div>
          
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
                    <p className="text-sm text-white/70 mb-2">קוד HS</p>
                    <p className="text-4xl font-bold mb-4">{report.hs_code || '---'}</p>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm text-white/70">רמת ביטחון</p>
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
                  <CardTitle className="text-lg">נימוק הסיווג</CardTitle>
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
                  <CardTitle className="text-lg">מאפייני המוצר</CardTitle>
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
            
            {/* Tariff Information */}
            {report.tariff_description && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">מידע על מכסים</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      {report.tariff_description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            
            {/* Import Requirements */}
            {report.import_requirements && report.import_requirements.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">דרישות יבוא</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {report.import_requirements.map((req, index) => (
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
            )}
            
            {/* Official Sources */}
            {report.official_sources && report.official_sources.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">מקורות רשמיים</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {report.official_sources.map((source, index) => (
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
                  <CardTitle className="text-lg">פרטי סחר</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      מדינת ייצור
                    </p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {report.country_of_manufacture || '---'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      מדינת מוצא
                    </p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {report.country_of_origin || '---'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      מדינת יעד
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
                    <CardTitle className="text-lg">סיווגים חלופיים</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {report.alternative_classifications.map((alt, index) => (
                        <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                          <p className="font-mono font-medium text-[#114B5F] dark:text-[#42C0B9]">
                            {alt.hs_code}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {alt.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
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
          transition={{ delay: 0.7 }}
          className="text-center py-6 border-t border-slate-200 dark:border-slate-700"
        >
          <p className="text-sm text-slate-400 max-w-2xl mx-auto">
            דוח זה נוצר באמצעות AI ואינו מהווה ייעוץ משפטי או מכסי רשמי. יש לאמת את המידע מול רשויות המכס הרשמיות.
          </p>
        </motion.div>
      </div>
    </div>
  );
}