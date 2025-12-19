import React from 'react';
import { useLanguage } from '../providers/LanguageContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const countries = [
  { code: 'IL', name: { he: 'ישראל', en: 'Israel' } },
  { code: 'US', name: { he: 'ארצות הברית', en: 'United States' } },
  { code: 'CN', name: { he: 'סין', en: 'China' } },
  { code: 'DE', name: { he: 'גרמניה', en: 'Germany' } },
  { code: 'GB', name: { he: 'בריטניה', en: 'United Kingdom' } },
  { code: 'FR', name: { he: 'צרפת', en: 'France' } },
  { code: 'JP', name: { he: 'יפן', en: 'Japan' } },
  { code: 'KR', name: { he: 'דרום קוריאה', en: 'South Korea' } },
  { code: 'IN', name: { he: 'הודו', en: 'India' } },
  { code: 'IT', name: { he: 'איטליה', en: 'Italy' } },
  { code: 'NL', name: { he: 'הולנד', en: 'Netherlands' } },
  { code: 'ES', name: { he: 'ספרד', en: 'Spain' } },
  { code: 'CA', name: { he: 'קנדה', en: 'Canada' } },
  { code: 'AU', name: { he: 'אוסטרליה', en: 'Australia' } },
  { code: 'TR', name: { he: 'טורקיה', en: 'Turkey' } },
];

export default function ProductDetailsForm({ details, onChange }) {
  const { t, language, isRTL } = useLanguage();
  
  const handleChange = (field, value) => {
    onChange({ ...details, [field]: value });
  };
  
  return (
    <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm p-6 space-y-4">
      <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
        {t('tradeDetails')}
      </h3>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="product_name" className="text-slate-600 dark:text-slate-400">
            {t('productName')}
          </Label>
          <Input
            id="product_name"
            value={details.product_name || ''}
            onChange={(e) => handleChange('product_name', e.target.value)}
            placeholder={language === 'he' ? 'לדוגמה: שעון חכם' : 'e.g., Smartwatch'}
            className="mt-1.5 border-slate-200 dark:border-slate-700 focus:border-[#42C0B9] focus:ring-[#42C0B9]/20"
            dir={isRTL ? 'rtl' : 'ltr'}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-slate-600 dark:text-slate-400">
              {t('countryOfManufacture')}
            </Label>
            <Select
              value={details.country_of_manufacture || ''}
              onValueChange={(value) => handleChange('country_of_manufacture', value)}
            >
              <SelectTrigger className="mt-1.5 border-slate-200 dark:border-slate-700">
                <SelectValue placeholder={language === 'he' ? 'בחר מדינה' : 'Select country'} />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.code} value={country.name.en}>
                    {country.name[language]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-slate-600 dark:text-slate-400">
              {t('countryOfOrigin')}
            </Label>
            <Select
              value={details.country_of_origin || ''}
              onValueChange={(value) => handleChange('country_of_origin', value)}
            >
              <SelectTrigger className="mt-1.5 border-slate-200 dark:border-slate-700">
                <SelectValue placeholder={language === 'he' ? 'בחר מדינה' : 'Select country'} />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.code} value={country.name.en}>
                    {country.name[language]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-slate-600 dark:text-slate-400">
              {t('destinationCountry')}
            </Label>
            <Select
              value={details.destination_country || ''}
              onValueChange={(value) => handleChange('destination_country', value)}
            >
              <SelectTrigger className="mt-1.5 border-slate-200 dark:border-slate-700">
                <SelectValue placeholder={language === 'he' ? 'בחר מדינה' : 'Select country'} />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.code} value={country.name.en}>
                    {country.name[language]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </Card>
  );
}