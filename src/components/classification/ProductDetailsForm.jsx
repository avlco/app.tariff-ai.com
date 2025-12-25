import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '../providers/LanguageContext';

const countries = [
  'United States', 'China', 'Germany', 'Japan', 'United Kingdom', 'France', 
  'Israel', 'Italy', 'Canada', 'South Korea', 'India', 'Brazil', 'Australia',
  'Spain', 'Mexico', 'Netherlands', 'Turkey', 'Saudi Arabia', 'Switzerland',
  'Poland', 'Belgium', 'Sweden', 'Austria', 'Norway', 'United Arab Emirates'
].sort();

export default function ProductDetailsForm({ formData, onChange }) {
  const { t, language, isRTL } = useLanguage();
  
  const handleChange = (field, value) => {
    onChange({ ...formData, [field]: value });
  };
  
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="product_name">{t('productName')}</Label>
        <Input
          id="product_name"
          value={formData.product_name || ''}
          onChange={(e) => handleChange('product_name', e.target.value)}
          placeholder={language === 'he' ? 'לדוגמה: מחשב נייד' : 'e.g., Laptop Computer'}
          dir={isRTL ? 'rtl' : 'ltr'}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="intended_use">{language === 'he' ? 'שימוש מיועד' : 'Intended Use'}</Label>
        <Select
          value={formData.intended_use || ''}
          onValueChange={(value) => handleChange('intended_use', value)}
        >
          <SelectTrigger id="intended_use" className="mt-1">
            <SelectValue placeholder={language === 'he' ? 'בחר שימוש' : 'Select intended use'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="commercial_sale">{language === 'he' ? 'מכירה מסחרית / הפצה' : 'Commercial Sale / Resale'}</SelectItem>
            <SelectItem value="sample">{language === 'he' ? 'דוגמה מסחרית' : 'Commercial Sample'}</SelectItem>
            <SelectItem value="manufacturing_part">{language === 'he' ? 'רכיב לייצור' : 'Manufacturing Component'}</SelectItem>
            <SelectItem value="repair_return">{language === 'he' ? 'תיקון והחזרה' : 'Repair & Return'}</SelectItem>
            <SelectItem value="personal_use">{language === 'he' ? 'שימוש אישי' : 'Personal Use'}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="country_of_manufacture">{t('countryOfManufacture')}</Label>
        <Select
          value={formData.country_of_manufacture || ''}
          onValueChange={(value) => handleChange('country_of_manufacture', value)}
        >
          <SelectTrigger id="country_of_manufacture" className="mt-1">
            <SelectValue placeholder={language === 'he' ? 'בחר מדינה' : 'Select country'} />
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country} value={country}>{country}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="country_of_origin">{t('countryOfOrigin')}</Label>
        <Select
          value={formData.country_of_origin || ''}
          onValueChange={(value) => handleChange('country_of_origin', value)}
        >
          <SelectTrigger id="country_of_origin" className="mt-1">
            <SelectValue placeholder={language === 'he' ? 'בחר מדינה' : 'Select country'} />
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country} value={country}>{country}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="destination_country">{t('destinationCountry')}</Label>
        <Select
          value={formData.destination_country || ''}
          onValueChange={(value) => handleChange('destination_country', value)}
        >
          <SelectTrigger id="destination_country" className="mt-1">
            <SelectValue placeholder={language === 'he' ? 'בחר מדינה' : 'Select country'} />
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country} value={country}>{country}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}