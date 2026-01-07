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
      icon: 'bg-[#114B5F]/10 dark:bg-[hsl(222,40%,20%)] text-[#114B5F] dark:text-white',
      glow: 'hover:shadow-[0_0_20px_rgba(17,75,95,0.15)]'
    },
    gold: {
      icon: 'bg-[#D89C42]/15 text-[#D89C42]',
      glow: 'hover:shadow-[0_0_20px_rgba(216,156,66,0.15)]'
    },
  };
  
  const colorConfig = colors[color] || colors.teal;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`glass-card p-5 rounded-2xl transition-all duration-300 ${colorConfig.glow}`}>
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl ${colorConfig.icon}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-[#5A8A99] dark:text-[hsl(200,15%,60%)] mb-1.5 uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-bold font-heading text-[#114B5F] dark:text-[hsl(0,0%,98%)] mb-1 font-mono">{value}</p>
          {subtitle && (
            <p className="text-xs text-[#5A8A99] dark:text-[hsl(200,15%,60%)]">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1.5 text-xs mt-2">
              <span className={`font-semibold ${trend > 0 ? 'text-[#42C0B9]' : 'text-red-500'}`}>
                {trend > 0 ? '+' : ''}{trend}%
              </span>
              <span className="text-[hsl(200,15%,60%)]">vs last month</span>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}