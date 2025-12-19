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
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bermuda',
  'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei Darussalam', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia',
  'Cameroon', 'Canada', 'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo (Republic of the)',
  'Cook Islands', 'Costa Rica', 'Côte d\'Ivoire', 'Croatia', 'Cuba', 'Curaçao', 'Cyprus', 'Czech Republic', 'Democratic Republic of the Congo', 'Denmark',
  'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini',
  'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece',
  'Grenada', 'Guatemala', 'Guinea', 'Guinea‑Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hong Kong, China', 'Hungary', 'Iceland',
  'India', 'Indonesia', 'Iran (Islamic Republic of)', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan',
  'Kazakhstan', 'Kenya', 'Kiribati', 'Korea (Republic of)', 'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Lao PDR', 'Latvia', 'Lebanon',
  'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Macau, China', 'Madagascar', 'Malawi', 'Malaysia',
  'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritius', 'Mauritania', 'Mexico', 'Micronesia', 'Moldova', 'Mongolia',
  'Montenegro', 'Morocco', 'Mozambique', 'Namibia', 'Nepal', 'Netherlands', 'New Caledonia (French Terr.)', 'New Zealand', 'Nicaragua', 'Niger',
  'Nigeria', 'Niue', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea',
  'Paraguay', 'Peru', 'Philippines', 'Poland', 'Polynesia (French Terr.)', 'Portugal', 'Qatar', 'Romania', 'Russian Federation', 'Rwanda',
  'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Pierre and Miquelon', 'Saint Vincent and the Grenadines', 'Samoa', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles',
  'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Sudan', 'Spain', 'Sri Lanka',
  'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syrian Arab Republic', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor‑Leste', 'Togo',
  'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Türkiye', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'Union of Myanmar', 'United Arab Emirates',
  'United Kingdom', 'USA', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Venezuela', 'Viet Nam', 'Wallis and Futuna', 'Yemen', 'Zambia', 'Zimbabwe'
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
                  <SelectItem key={country} value={country}>
                    {country}
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
                  <SelectItem key={country} value={country}>
                    {country}
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
                  <SelectItem key={country} value={country}>
                    {country}
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