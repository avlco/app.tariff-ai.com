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

// Map plan IDs to pricing keys
const planKeys = {
  free: 'pricing.free.title',
  pay_per_use: 'pricing.payPerUse.title',
  basic: 'pricing.basic.title',
  pro: 'pricing.pro.title',
  agency: 'pricing.agency.title',
  enterprise: 'pricing.enterprise.title',
};

export default function PlanCard({ user }) {
  const { t } = useLanguage();
  
  const plan = user?.subscription_plan || 'free';
  const used = user?.reports_used_this_month || 0;
  const limit = planLimits[plan];
  const percentage = Math.min((used / limit) * 100, 100);
  const isPremium = plan !== 'free';
  
  return (
    <Card className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white border border-white/[0.08] shadow-xl overflow-hidden rounded-2xl">
      <CardContent className="p-5 relative">
        <div className="absolute top-0 end-0 w-32 h-32 bg-[#42C0B9]/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
        <div className="absolute bottom-0 start-0 w-24 h-24 bg-[#E5A840]/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
        
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            {isPremium ? (
              <Crown className="w-5 h-5 text-[#E5A840]" />
            ) : (
              <Zap className="w-5 h-5 text-[#42C0B9]" />
            )}
            <span className="text-xs font-medium text-white/60 uppercase tracking-wide">{t('currentPlan')}</span>
          </div>
          
          <h3 className="text-2xl font-bold font-heading mb-4">
            {t(planKeys[plan] || planKeys.free)}
          </h3>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">{t('reportsUsed')}</span>
              <span className="font-semibold font-mono">{used} / {limit === 999 ? '∞' : limit}</span>
            </div>
            
            <Progress 
              value={percentage} 
              className="h-1.5 bg-white/10"
            />
            
            <div className="flex justify-between text-sm">
              <span className="text-white/60">{t('reportsRemaining')}</span>
              <span className="font-semibold text-[#42C0B9] font-mono">
                {limit === 999 ? '∞' : Math.max(0, limit - used)}
              </span>
            </div>
          </div>
          
          {plan === 'free' && (
            <Link to={createPageUrl('Profile')}>
              <Button className="w-full mt-5 bg-gradient-to-r from-[#E5A840] to-[#F5C463] hover:from-[#F5C463] hover:to-[#E5A840] text-[#0F172A] font-semibold rounded-full shadow-lg hover:shadow-[0_0_25px_rgba(229,168,64,0.4)] transition-all duration-300">
                {t('upgradeNow')}
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}