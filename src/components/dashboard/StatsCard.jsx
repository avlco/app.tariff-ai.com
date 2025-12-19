import React from 'react';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';

export default function StatsCard({ title, value, subtitle, icon: Icon, color = 'teal', trend }) {
  const colors = {
    teal: 'bg-[#42C0B9]/10 text-[#42C0B9]',
    navy: 'bg-[#114B5F]/10 text-[#114B5F]',
    gold: 'bg-[#D89C42]/10 text-[#D89C42]',
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-6 bg-white dark:bg-slate-900 border-0 shadow-sm hover:shadow-md transition-shadow duration-300">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
            {subtitle && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 text-sm">
                <span className={trend > 0 ? 'text-green-500' : 'text-red-500'}>
                  {trend > 0 ? '+' : ''}{trend}%
                </span>
                <span className="text-slate-400">vs last month</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl ${colors[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}