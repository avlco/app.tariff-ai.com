import React from 'react';
import { useLanguage } from '../providers/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function UsageChart({ data }) {
  const { t, language } = useLanguage();
  
  const months = language === 'he' 
    ? ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const chartData = data || months.slice(0, 6).map((month, i) => ({
    name: month,
    reports: Math.floor(Math.random() * 20) + 5,
  }));
  
  return (
    <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
          {t('reportsThisMonth')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#42C0B9" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#42C0B9" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis 
                dataKey="name" 
                stroke="#94A3B8"
                tick={{ fill: '#94A3B8', fontSize: 12 }}
              />
              <YAxis 
                stroke="#94A3B8"
                tick={{ fill: '#94A3B8', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              />
              <Area
                type="monotone"
                dataKey="reports"
                stroke="#42C0B9"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorReports)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}