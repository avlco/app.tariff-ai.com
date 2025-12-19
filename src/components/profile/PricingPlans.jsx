import React, { useState } from 'react';
import { useLanguage } from '../providers/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Check, Crown, Zap, Building2, Send, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const plans = [
  {
    id: 'free',
    name: { he: 'חינם', en: 'Free' },
    price: 0,
    reports: 3,
    features: {
      he: ['עד 3 דוחות בחודש', 'תצוגה מוגבלת של הדוח', 'קוד HS בלבד'],
      en: ['Up to 3 reports/month', 'Limited report view', 'HS Code only'],
    },
    icon: Zap,
    color: 'slate',
  },
  {
    id: 'pay_per_use',
    name: { he: 'לפי שימוש', en: 'Pay Per Use' },
    price: 1.99,
    priceType: 'per_report',
    reports: 999,
    features: {
      he: ['$1.99 לדוח', 'תצוגה מלאה של הדוח', 'ללא הגבלה'],
      en: ['$1.99 per report', 'Full report view', 'Unlimited'],
    },
    icon: Zap,
    color: 'teal',
  },
  {
    id: 'basic',
    name: { he: 'בסיסי', en: 'Basic' },
    price: 9.99,
    priceType: 'monthly',
    reports: 15,
    features: {
      he: ['עד 15 דוחות בחודש', 'תצוגה מלאה של הדוח', 'תמיכה באימייל'],
      en: ['Up to 15 reports/month', 'Full report view', 'Email support'],
    },
    icon: Zap,
    color: 'teal',
  },
  {
    id: 'pro',
    name: { he: 'מקצועי', en: 'Pro' },
    price: 19.99,
    priceType: 'monthly',
    reports: 50,
    popular: true,
    features: {
      he: ['עד 50 דוחות בחודש', 'תצוגה מלאה של הדוח', 'תמיכה בעדיפות', 'ייצוא PDF'],
      en: ['Up to 50 reports/month', 'Full report view', 'Priority support', 'PDF export'],
    },
    icon: Crown,
    color: 'gold',
  },
  {
    id: 'agency',
    name: { he: 'סוכנות', en: 'Agency' },
    price: 49.99,
    priceType: 'monthly',
    reports: 200,
    features: {
      he: ['עד 200 דוחות בחודש', 'תצוגה מלאה של הדוח', 'תמיכה בעדיפות גבוהה', 'API גישה'],
      en: ['Up to 200 reports/month', 'Full report view', 'Premium support', 'API access'],
    },
    icon: Building2,
    color: 'navy',
  },
  {
    id: 'enterprise',
    name: { he: 'ארגוני', en: 'Enterprise' },
    price: null,
    reports: 999,
    features: {
      he: ['ללא הגבלת דוחות', 'התאמה אישית', 'מנהל חשבון ייעודי', 'SLA מותאם'],
      en: ['Unlimited reports', 'Custom solutions', 'Dedicated account manager', 'Custom SLA'],
    },
    icon: Building2,
    color: 'navy',
    enterprise: true,
  },
];

export default function PricingPlans({ currentPlan, onSelect }) {
  const { t, language } = useLanguage();
  const [enterpriseDialogOpen, setEnterpriseDialogOpen] = useState(false);
  const [enterpriseForm, setEnterpriseForm] = useState({
    company: '',
    email: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  
  const handleEnterpriseSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await base44.entities.SupportTicket.create({
        ticket_id: Math.random().toString(36).substring(2, 10),
        subject: `Enterprise inquiry from ${enterpriseForm.company}`,
        category: 'billing',
        message: `Company: ${enterpriseForm.company}\nEmail: ${enterpriseForm.email}\n\n${enterpriseForm.message}`,
        status: 'open',
        priority: 'high',
      });
      toast.success(language === 'he' ? 'הפנייה נשלחה בהצלחה' : 'Request submitted successfully');
      setEnterpriseDialogOpen(false);
      setEnterpriseForm({ company: '', email: '', message: '' });
    } catch (error) {
      toast.error(language === 'he' ? 'שגיאה בשליחה' : 'Error submitting request');
    } finally {
      setSubmitting(false);
    }
  };
  
  const colorClasses = {
    slate: 'border-slate-200 dark:border-slate-700',
    teal: 'border-[#42C0B9]/30 bg-[#42C0B9]/5',
    gold: 'border-[#D89C42] bg-gradient-to-br from-[#D89C42]/5 to-transparent',
    navy: 'border-[#114B5F]/30 bg-[#114B5F]/5',
  };
  
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan, index) => {
          const Icon = plan.icon;
          const isCurrentPlan = currentPlan === plan.id;
          
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`relative h-full ${colorClasses[plan.color]} ${plan.popular ? 'ring-2 ring-[#D89C42]' : ''}`}>
                {plan.popular && (
                  <Badge className="absolute -top-3 start-1/2 -translate-x-1/2 bg-[#D89C42] text-white border-0">
                    {language === 'he' ? 'הכי פופולרי' : 'Most Popular'}
                  </Badge>
                )}
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-2 rounded-lg ${plan.color === 'gold' ? 'bg-[#D89C42]/10' : plan.color === 'teal' ? 'bg-[#42C0B9]/10' : 'bg-[#114B5F]/10'}`}>
                      <Icon className={`w-5 h-5 ${plan.color === 'gold' ? 'text-[#D89C42]' : plan.color === 'teal' ? 'text-[#42C0B9]' : 'text-[#114B5F]'}`} />
                    </div>
                    <CardTitle className="text-lg">{plan.name[language]}</CardTitle>
                  </div>
                  <div className="mt-2">
                    {plan.price === null ? (
                      <span className="text-2xl font-bold text-slate-900 dark:text-white">
                        {language === 'he' ? 'צור קשר' : 'Contact Us'}
                      </span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-slate-900 dark:text-white">
                          ${plan.price}
                        </span>
                        {plan.priceType === 'monthly' && (
                          <span className="text-slate-500 text-sm">/{language === 'he' ? 'חודש' : 'month'}</span>
                        )}
                        {plan.priceType === 'per_report' && (
                          <span className="text-slate-500 text-sm">/{language === 'he' ? 'דוח' : 'report'}</span>
                        )}
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features[language].map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-[#42C0B9] mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-600 dark:text-slate-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {plan.enterprise ? (
                    <Button
                      variant="outline"
                      className="w-full border-[#114B5F] text-[#114B5F] hover:bg-[#114B5F] hover:text-white"
                      onClick={() => setEnterpriseDialogOpen(true)}
                    >
                      {language === 'he' ? 'צור קשר' : 'Contact Us'}
                    </Button>
                  ) : isCurrentPlan ? (
                    <Button disabled className="w-full">
                      {language === 'he' ? 'התוכנית הנוכחית' : 'Current Plan'}
                    </Button>
                  ) : (
                    <Button
                      className={`w-full ${plan.popular ? 'bg-[#D89C42] hover:bg-[#D89C42]/90' : 'bg-[#42C0B9] hover:bg-[#42C0B9]/90'}`}
                      onClick={() => onSelect(plan.id)}
                    >
                      {language === 'he' ? 'בחר תוכנית' : 'Select Plan'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
      
      {/* Enterprise Dialog */}
      <Dialog open={enterpriseDialogOpen} onOpenChange={setEnterpriseDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {language === 'he' ? 'פנייה לתוכנית ארגונית' : 'Enterprise Inquiry'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEnterpriseSubmit} className="space-y-4 mt-4">
            <div>
              <Label>{language === 'he' ? 'שם החברה' : 'Company Name'}</Label>
              <Input
                value={enterpriseForm.company}
                onChange={(e) => setEnterpriseForm({ ...enterpriseForm, company: e.target.value })}
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label>{t('email')}</Label>
              <Input
                type="email"
                value={enterpriseForm.email}
                onChange={(e) => setEnterpriseForm({ ...enterpriseForm, email: e.target.value })}
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label>{t('message')}</Label>
              <Textarea
                value={enterpriseForm.message}
                onChange={(e) => setEnterpriseForm({ ...enterpriseForm, message: e.target.value })}
                className="mt-1.5 min-h-24"
                placeholder={language === 'he' ? 'ספר לנו על הצרכים שלך...' : 'Tell us about your needs...'}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setEnterpriseDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" className="bg-[#114B5F] hover:bg-[#114B5F]/90" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Send className="w-4 h-4 me-2" />}
                {t('submit')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}