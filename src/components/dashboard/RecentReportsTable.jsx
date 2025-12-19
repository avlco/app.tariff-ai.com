import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLanguage } from '../providers/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, ArrowLeft, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

export default function RecentReportsTable({ reports, loading }) {
  const { t, isRTL, language } = useLanguage();
  
  const statusColors = {
    pending: 'bg-[#D89C42]/10 text-[#D89C42] border-[#D89C42]/20',
    completed: 'bg-[#42C0B9]/10 text-[#42C0B9] border-[#42C0B9]/20',
    failed: 'bg-red-100 text-red-600 border-red-200',
  };
  
  if (loading) {
    return (
      <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('recentReports')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
          {t('recentReports')}
        </CardTitle>
        <Link to={createPageUrl('Reports')}>
          <Button variant="ghost" size="sm" className="text-[#42C0B9] hover:text-[#42C0B9]/80">
            {t('viewAll')}
            {isRTL ? <ArrowLeft className="w-4 h-4 ms-1" /> : <ArrowRight className="w-4 h-4 ms-1" />}
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-500 dark:text-slate-400">{t('noResults')}</p>
            <Link to={createPageUrl('NewReport')}>
              <Button className="mt-4 bg-[#42C0B9] hover:bg-[#42C0B9]/90">
                {t('createNewReport')}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.slice(0, 5).map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-slate-900 dark:text-white truncate">
                    {report.product_name}
                  </h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {report.hs_code || '---'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {format(new Date(report.created_date), 'dd/MM/yyyy')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={`${statusColors[report.status]} border`}>
                    {t(report.status)}
                  </Badge>
                  <Link to={createPageUrl(`ReportView?id=${report.id}`)}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Eye className="w-4 h-4 text-slate-500" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}