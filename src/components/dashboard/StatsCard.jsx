import React from 'react';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';

export default function StatsCard({ title, value, subtitle, icon: Icon, color = 'teal', trend }) {
  const colors = {
    teal: 'bg-[#42C0B9]/10 text-[#42C0B9] border-[#42C0B9]/20',
    navy: 'bg-[#114B5F]/10 text-[#114B5F] border-[#114B5F]/20',
    gold: 'bg-[#D89C42]/10 text-[#D89C42] border-[#D89C42]/20',
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-5 bg-white dark:bg-[#1A1F2E] border border-slate-200 dark:border-slate-800/50 hover:border-[#42C0B9]/30 transition-all hover:shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-lg border ${colors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 text-xs mt-2">
              <span className={trend > 0 ? 'text-green-500 font-semibold' : 'text-red-500 font-semibold'}>
                {trend > 0 ? '+' : ''}{trend}%
              </span>
              <span className="text-slate-400">vs last month</span>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}