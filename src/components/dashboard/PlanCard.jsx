import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLanguage } from '../providers/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Crown, Zap } from 'lucide-react';

const planLimits = {
  free: 3,
  pay_per_use: 999,
  basic: 15,
  pro: 50,
  agency: 200,
  enterprise: 999,
};

const planNames = {
  he: {
    free: 'חינם',
    pay_per_use: 'לפי שימוש',
    basic: 'בסיסי',
    pro: 'מקצועי',
    agency: 'סוכנות',
    enterprise: 'ארגוני',
  },
  en: {
    free: 'Free',
    pay_per_use: 'Pay Per Use',
    basic: 'Basic',
    pro: 'Pro',
    agency: 'Agency',
    enterprise: 'Enterprise',
  }
};

export default function PlanCard({ user }) {
  const { t, language } = useLanguage();
  
  const plan = user?.subscription_plan || 'free';
  const used = user?.reports_used_this_month || 0;
  const limit = planLimits[plan];
  const percentage = Math.min((used / limit) * 100, 100);
  const isPremium = plan !== 'free';
  
  return (
    <Card className="bg-gradient-to-br from-[#114B5F] to-[#0D3A4A] text-white border-0 shadow-lg overflow-hidden">
      <CardContent className="p-6 relative">
        <div className="absolute top-0 end-0 w-32 h-32 bg-[#42C0B9]/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 start-0 w-24 h-24 bg-[#D89C42]/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            {isPremium ? (
              <Crown className="w-5 h-5 text-[#D89C42]" />
            ) : (
              <Zap className="w-5 h-5 text-[#42C0B9]" />
            )}
            <span className="text-sm font-medium text-white/80">{t('currentPlan')}</span>
          </div>
          
          <h3 className="text-2xl font-bold mb-4">
            {planNames[language][plan]}
          </h3>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-white/70">{t('reportsUsed')}</span>
              <span className="font-semibold">{used} / {limit === 999 ? '∞' : limit}</span>
            </div>
            
            <Progress 
              value={percentage} 
              className="h-2 bg-white/20"
            />
            
            <div className="flex justify-between text-sm">
              <span className="text-white/70">{t('reportsRemaining')}</span>
              <span className="font-semibold text-[#42C0B9]">
                {limit === 999 ? '∞' : Math.max(0, limit - used)}
              </span>
            </div>
          </div>
          
          {plan === 'free' && (
            <Link to={createPageUrl('Profile')}>
              <Button className="w-full mt-6 bg-[#D89C42] hover:bg-[#D89C42]/90 text-white">
                {t('upgradeNow')}
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}