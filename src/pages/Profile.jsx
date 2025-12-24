import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '../components/providers/LanguageContext';
import PricingPlans from '../components/profile/PricingPlans';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { User, CreditCard, Settings, Save, Loader2, Shield, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import PolicyViewerModal from '../components/legal/PolicyViewerModal';

export default function Profile() {
  const { t, language, setLanguage, theme, setTheme, isRTL } = useLanguage();
  const [user, setUser] = useState(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [activePolicyTab, setActivePolicyTab] = useState('terms');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    company_name: '',
    phone: '',
  });
  
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
        setFormData({
          full_name: userData.full_name || '',
          company_name: userData.company_name || '',
          phone: userData.phone || '',
        });
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);
  
  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe(formData);

      // Update UserMasterData
      const updatedUser = await base44.auth.me();
      const existingUserData = await base44.entities.UserMasterData.filter({ user_email: updatedUser.email });

      if (existingUserData.length > 0) {
        await base44.entities.UserMasterData.update(existingUserData[0].id, {
          full_name: formData.full_name,
          company_name: formData.company_name,
          phone: formData.phone
        });
      } else {
        await base44.entities.UserMasterData.create({
          user_email: updatedUser.email,
          full_name: formData.full_name,
          company_name: formData.company_name,
          phone: formData.phone,
          role: updatedUser.role,
          subscription_plan: updatedUser.subscription_plan || 'free',
          preferred_language: updatedUser.preferred_language || 'he',
          theme: updatedUser.theme || 'light'
        });
      }

      toast.success(language === 'he' ? 'הפרטים נשמרו בהצלחה' : 'Profile saved successfully');
    } catch (error) {
      toast.error(language === 'he' ? 'שגיאה בשמירה' : 'Error saving profile');
    } finally {
      setSaving(false);
    }
  };
  
  const handlePreferenceSave = async (key, value) => {
    try {
      await base44.auth.updateMe({ [key]: value });
      if (key === 'preferred_language') setLanguage(value);
      if (key === 'theme') setTheme(value);

      // Update UserMasterData
      const updatedUser = await base44.auth.me();
      const existingUserData = await base44.entities.UserMasterData.filter({ user_email: updatedUser.email });

      if (existingUserData.length > 0) {
        await base44.entities.UserMasterData.update(existingUserData[0].id, {
          [key]: value
        });
      }

      toast.success(language === 'he' ? 'ההעדפה נשמרה' : 'Preference saved');
    } catch (error) {
      toast.error(language === 'he' ? 'שגיאה בשמירה' : 'Error saving');
    }
  };
  
  const handlePlanSelect = async (planId) => {
    try {
      await base44.auth.updateMe({ subscription_plan: planId });
      setUser(prev => ({ ...prev, subscription_plan: planId }));

      // Update UserMasterData
      const updatedUser = await base44.auth.me();
      const existingUserData = await base44.entities.UserMasterData.filter({ user_email: updatedUser.email });

      if (existingUserData.length > 0) {
        await base44.entities.UserMasterData.update(existingUserData[0].id, {
          subscription_plan: planId
        });
      }

      toast.success(language === 'he' ? 'התוכנית עודכנה בהצלחה' : 'Plan updated successfully');
    } catch (error) {
      toast.error(language === 'he' ? 'שגיאה בעדכון התוכנית' : 'Error updating plan');
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#42C0B9]" />
      </div>
    );
  }
  
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
          {t('profile')}
        </h1>
      </motion.div>
      
      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="bg-white dark:bg-slate-900 shadow-sm p-1 rounded-xl">
          <TabsTrigger 
            value="personal" 
            className="data-[state=active]:bg-[#42C0B9] data-[state=active]:text-white rounded-lg"
          >
            <User className="w-4 h-4 me-2" />
            {t('personalInfo')}
          </TabsTrigger>
          <TabsTrigger 
            value="subscription"
            className="data-[state=active]:bg-[#42C0B9] data-[state=active]:text-white rounded-lg"
          >
            <CreditCard className="w-4 h-4 me-2" />
            {t('subscription')}
          </TabsTrigger>
          <TabsTrigger 
            value="preferences"
            className="data-[state=active]:bg-[#42C0B9] data-[state=active]:text-white rounded-lg"
          >
            <Settings className="w-4 h-4 me-2" />
            {t('preferences')}
          </TabsTrigger>
        </TabsList>
        
        {/* Personal Info */}
        <TabsContent value="personal">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
              <CardHeader>
                <CardTitle>{t('personalInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>{language === 'he' ? 'שם מלא' : 'Full Name'}</Label>
                    <Input
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="mt-1.5"
                      dir={isRTL ? 'rtl' : 'ltr'}
                    />
                  </div>
                  <div>
                    <Label>{t('companyName')}</Label>
                    <Input
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      className="mt-1.5"
                      dir={isRTL ? 'rtl' : 'ltr'}
                    />
                  </div>
                  <div>
                    <Label>{t('email')}</Label>
                    <Input
                      value={user?.email || ''}
                      disabled
                      className="mt-1.5 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <Label>{t('phone')}</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="mt-1.5"
                      dir="ltr"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleSave} 
                    className="bg-[#42C0B9] hover:bg-[#42C0B9]/90"
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 me-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 me-2" />
                    )}
                    {t('save')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
        
        {/* Subscription */}
        <TabsContent value="subscription">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                {t('subscription')}
              </h2>
              <p className="text-slate-500 dark:text-slate-400">
                {language === 'he' ? 'בחר את התוכנית המתאימה לך' : 'Choose the plan that fits your needs'}
              </p>
            </div>
            <PricingPlans 
              currentPlan={user?.subscription_plan || 'free'} 
              onSelect={handlePlanSelect} 
            />
          </motion.div>
        </TabsContent>
        
        {/* Preferences */}
        <TabsContent value="preferences">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
              <CardHeader>
                <CardTitle>{t('preferences')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>{t('language')}</Label>
                    <Select
                      value={language}
                      onValueChange={(value) => handlePreferenceSave('preferred_language', value)}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="he">עברית</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>{t('theme')}</Label>
                    <Select
                      value={theme}
                      onValueChange={(value) => handlePreferenceSave('theme', value)}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">{t('light')}</SelectItem>
                        <SelectItem value="dark">{t('dark')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-4">
                        {language === 'he' ? 'משפטי ופרטיות' : 'Legal & Privacy'}
                    </h3>
                    <div className="flex gap-4">
                        <Button 
                            variant="outline" 
                            onClick={() => { setActivePolicyTab('terms'); setShowPolicyModal(true); }}
                            className="flex items-center gap-2"
                        >
                            <FileText className="w-4 h-4" />
                            {language === 'he' ? 'תנאי שימוש' : 'Terms of Service'}
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => { setActivePolicyTab('privacy'); setShowPolicyModal(true); }}
                            className="flex items-center gap-2"
                        >
                            <Shield className="w-4 h-4" />
                            {language === 'he' ? 'מדיניות פרטיות' : 'Privacy Policy'}
                        </Button>
                    </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      <AnimatePresence>
        {showPolicyModal && (
            <PolicyViewerModal 
                initialTab={activePolicyTab} 
                onClose={() => setShowPolicyModal(false)} 
            />
        )}
      </AnimatePresence>
    </div>
  );
}