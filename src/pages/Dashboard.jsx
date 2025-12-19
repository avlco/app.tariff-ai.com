import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../components/providers/LanguageContext';
import StatsCard from '../components/dashboard/StatsCard';
import RecentReportsTable from '../components/dashboard/RecentReportsTable';
import UsageChart from '../components/dashboard/UsageChart';
import PlanCard from '../components/dashboard/PlanCard';
import { Button } from '@/components/ui/button';
import { FileText, TrendingUp, Clock, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { t, language } = useLanguage();
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {}
    };
    loadUser();
  }, []);
  
  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => base44.entities.ClassificationReport.list('-created_date', 10),
    initialData: [],
  });
  
  const completedReports = reports.filter(r => r.status === 'completed').length;
  const pendingReports = reports.filter(r => r.status === 'pending').length;
  const thisMonthReports = reports.filter(r => {
    const created = new Date(r.created_date);
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;
  
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
            {t('dashboard')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {language === 'he' ? 'סקירה כללית של הפעילות שלך' : 'Overview of your activity'}
          </p>
        </div>
        <Link to={createPageUrl('NewReport')}>
          <Button className="bg-gradient-to-r from-[#114B5F] to-[#42C0B9] hover:opacity-90 text-white shadow-lg">
            <Plus className="w-4 h-4 me-2" />
            {t('createNewReport')}
          </Button>
        </Link>
      </motion.div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title={t('reportsThisMonth')}
          value={thisMonthReports}
          icon={FileText}
          color="teal"
        />
        <StatsCard
          title={t('completed')}
          value={completedReports}
          icon={TrendingUp}
          color="navy"
        />
        <StatsCard
          title={t('pending')}
          value={pendingReports}
          icon={Clock}
          color="gold"
        />
        <div className="md:col-span-2 lg:col-span-1">
          <PlanCard user={user} />
        </div>
      </div>
      
      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UsageChart />
        <RecentReportsTable reports={reports} loading={isLoading} />
      </div>
    </div>
  );
}