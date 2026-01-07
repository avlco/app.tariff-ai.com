import React from 'react';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';

export default function StatsCard({ title, value, subtitle, icon: Icon, color = 'teal', trend }) {
  const colors = {
    teal: {
      icon: 'bg-[#42C0B9]/15 text-[#42C0B9]',
      glow: 'hover:shadow-[0_0_20px_rgba(66,192,185,0.15)]'
    },
    navy: {
      icon: 'bg-[#0F172A]/10 dark:bg-white/10 text-[#0F172A] dark:text-white',
      glow: 'hover:shadow-[0_0_20px_rgba(15,23,42,0.15)]'
    },
    gold: {
      icon: 'bg-[#E5A840]/15 text-[#E5A840]',
      glow: 'hover:shadow-[0_0_20px_rgba(229,168,64,0.15)]'
    },
  };
  
  const colorConfig = colors[color] || colors.teal;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`p-5 bg-white dark:bg-[#1E293B]/50 border border-slate-200/80 dark:border-white/[0.08] rounded-2xl transition-all duration-300 ${colorConfig.glow} hover:border-[#42C0B9]/30`}>
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl ${colorConfig.icon}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-bold font-heading text-slate-900 dark:text-white mb-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1.5 text-xs mt-2">
              <span className={`font-semibold ${trend > 0 ? 'text-[#42C0B9]' : 'text-red-500'}`}>
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