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
      <Card className="bg-white dark:bg-[#1E293B]/50 border border-slate-200/80 dark:border-white/[0.08] rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold font-heading text-slate-900 dark:text-white">
            {t('recentReports')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-100 dark:bg-white/[0.04] rounded-xl animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-white dark:bg-[#1E293B]/50 border border-slate-200/80 dark:border-white/[0.08] rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg font-semibold font-heading text-slate-900 dark:text-white">
          {t('recentReports')}
        </CardTitle>
        <Link to={createPageUrl('Reports')}>
          <Button variant="ghost" size="sm" className="text-[#42C0B9] hover:text-[#42C0B9]/80 hover:bg-[#42C0B9]/10 rounded-full px-4">
            {t('viewAll')}
            {isRTL ? <ArrowLeft className="w-4 h-4 ms-1" /> : <ArrowRight className="w-4 h-4 ms-1" />}
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {!reports || reports.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-500 dark:text-slate-400">{t('noResults')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports
               .slice(0, 5)
               .filter(r => r)
               .sort((a, b) => {
                  // Put 'waiting_for_user' first
                  if (a.status === 'waiting_for_user' && b.status !== 'waiting_for_user') return -1;
                  if (b.status === 'waiting_for_user' && a.status !== 'waiting_for_user') return 1;
                  // Then sort by date desc
                  return new Date(b.created_date) - new Date(a.created_date);
               })
               .map((report) => (
              <div
                key={report?.id}
                className="flex items-center justify-between p-4 rounded-xl bg-slate-50/80 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] border border-transparent hover:border-[#42C0B9]/20 transition-all duration-200"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-slate-900 dark:text-white truncate">
                    {report?.product_name || 'N/A'}
                  </h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {report?.hs_code || '---'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {report?.created_date ? format(new Date(report.created_date), 'dd/MM/yyyy') : '---'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {report?.status === 'waiting_for_user' ? (
                      <div className="flex items-center gap-2">
                          <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                              {t('waiting_for_user') || 'Action Required'}
                          </Badge>
                          <Link to={createPageUrl(`ClarifyReport?id=${report?.id}`)}>
                              <Button size="sm" className="h-8 bg-orange-600 hover:bg-orange-700 text-white text-xs">
                                  Resolve
                              </Button>
                          </Link>
                      </div>
                  ) : (
                      <>
                          <Badge className={`${statusColors[report?.status] || statusColors.pending} border`}>
                              {t(report?.status || 'pending')}
                          </Badge>
                          <Link to={createPageUrl(`ReportView?id=${report?.id}`)}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Eye className="w-4 h-4 text-slate-500" />
                              </Button>
                          </Link>
                      </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}