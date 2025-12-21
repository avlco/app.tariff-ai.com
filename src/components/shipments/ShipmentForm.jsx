import React, { useState } from 'react';
import { useLanguage } from '../providers/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from 'lucide-react';

const countries = [
  'United States', 'China', 'Israel', 'Germany', 'United Kingdom', 'France', 
  'Japan', 'India', 'Canada', 'Australia', 'Brazil', 'Mexico', 'South Korea',
  'Italy', 'Spain', 'Netherlands', 'Switzerland', 'Sweden', 'Poland', 'Belgium'
];

export default function ShipmentForm({ customers, onSubmit, isLoading }) {
  const { isRTL } = useLanguage();
  const [formData, setFormData] = useState({
    customer_id: '',
    description: '',
    incoterms: '',
    origin: {
      country: '',
      city: '',
      port_airport_name: ''
    },
    destination: {
      country: '',
      city: '',
      port_airport_name: ''
    },
    manufacture_country: '',
    total_product_value: '',
    currency: 'USD',
    total_weight: {
      value: '',
      unit: 'kg'
    },
    total_volume: {
      value: '',
      unit: 'cbm'
    },
    hs_code: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNestedChange = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
          {isRTL ? 'מידע בסיסי' : 'Basic Information'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>{isRTL ? 'לקוח' : 'Customer'}</Label>
            <Select
              value={formData.customer_id}
              onValueChange={(value) => handleChange('customer_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={isRTL ? 'בחר לקוח' : 'Select customer'} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.customer_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="incoterms">{isRTL ? 'Incoterms' : 'Incoterms'} *</Label>
            <Select
              value={formData.incoterms}
              onValueChange={(value) => handleChange('incoterms', value)}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder={isRTL ? 'בחר' : 'Select'} />
              </SelectTrigger>
              <SelectContent>
                {['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'].map((term) => (
                  <SelectItem key={term} value={term}>{term}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="description">{isRTL ? 'תיאור' : 'Description'} *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              required
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Origin & Destination */}
      <div className="space-y-4">
        <h3 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
          {isRTL ? 'מקור ויעד' : 'Origin & Destination'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Origin */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-[#475569] dark:text-[#CBD5E1]">
              {isRTL ? 'מקור' : 'Origin'}
            </h4>
            <div>
              <Label>{isRTL ? 'מדינה' : 'Country'} *</Label>
              <Select
                value={formData.origin.country}
                onValueChange={(value) => handleNestedChange('origin', 'country', value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder={isRTL ? 'בחר מדינה' : 'Select country'} />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isRTL ? 'עיר' : 'City'} *</Label>
              <Input
                value={formData.origin.city}
                onChange={(e) => handleNestedChange('origin', 'city', e.target.value)}
                required
              />
            </div>
            <div>
              <Label>{isRTL ? 'נמל/שדה תעופה' : 'Port/Airport'}</Label>
              <Input
                value={formData.origin.port_airport_name}
                onChange={(e) => handleNestedChange('origin', 'port_airport_name', e.target.value)}
              />
            </div>
          </div>

          {/* Destination */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-[#475569] dark:text-[#CBD5E1]">
              {isRTL ? 'יעד' : 'Destination'}
            </h4>
            <div>
              <Label>{isRTL ? 'מדינה' : 'Country'} *</Label>
              <Select
                value={formData.destination.country}
                onValueChange={(value) => handleNestedChange('destination', 'country', value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder={isRTL ? 'בחר מדינה' : 'Select country'} />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isRTL ? 'עיר' : 'City'} *</Label>
              <Input
                value={formData.destination.city}
                onChange={(e) => handleNestedChange('destination', 'city', e.target.value)}
                required
              />
            </div>
            <div>
              <Label>{isRTL ? 'נמל/שדה תעופה' : 'Port/Airport'}</Label>
              <Input
                value={formData.destination.port_airport_name}
                onChange={(e) => handleNestedChange('destination', 'port_airport_name', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Product Details */}
      <div className="space-y-4">
        <h3 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
          {isRTL ? 'פרטי המוצר' : 'Product Details'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="hs_code">{isRTL ? 'קוד HS' : 'HS Code'} *</Label>
            <Input
              id="hs_code"
              value={formData.hs_code}
              onChange={(e) => handleChange('hs_code', e.target.value)}
              placeholder="0000.00.00"
              required
            />
          </div>

          <div>
            <Label htmlFor="manufacture_country">{isRTL ? 'מדינת ייצור' : 'Country of Manufacture'}</Label>
            <Select
              value={formData.manufacture_country}
              onValueChange={(value) => handleChange('manufacture_country', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={isRTL ? 'בחר מדינה' : 'Select country'} />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country} value={country}>{country}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="currency">{isRTL ? 'מטבע' : 'Currency'} *</Label>
            <Select
              value={formData.currency}
              onValueChange={(value) => handleChange('currency', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['USD', 'EUR', 'GBP', 'ILS', 'CNY', 'JPY'].map((curr) => (
                  <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="total_product_value">{isRTL ? 'שווי מוצר' : 'Product Value'} *</Label>
            <Input
              id="total_product_value"
              type="number"
              step="0.01"
              value={formData.total_product_value}
              onChange={(e) => handleChange('total_product_value', parseFloat(e.target.value))}
              required
            />
          </div>

          <div>
            <Label htmlFor="weight">{isRTL ? 'משקל' : 'Weight'}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                value={formData.total_weight.value}
                onChange={(e) => handleNestedChange('total_weight', 'value', parseFloat(e.target.value))}
                className="flex-1"
              />
              <Select
                value={formData.total_weight.unit}
                onValueChange={(value) => handleNestedChange('total_weight', 'unit', value)}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="lb">lb</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="volume">{isRTL ? 'נפח' : 'Volume'}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                value={formData.total_volume.value}
                onChange={(e) => handleNestedChange('total_volume', 'value', parseFloat(e.target.value))}
                className="flex-1"
              />
              <Select
                value={formData.total_volume.unit}
                onValueChange={(value) => handleNestedChange('total_volume', 'unit', value)}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cbm">cbm</SelectItem>
                  <SelectItem value="cuft">cuft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" disabled={isLoading} className="bg-[#42C0B9] hover:bg-[#3AB0A8]">
          {isLoading && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
          {isLoading 
            ? (isRTL ? 'יוצר משלוח...' : 'Creating shipment...') 
            : (isRTL ? 'צור משלוח' : 'Create Shipment')
          }
        </Button>
      </div>
    </form>
  );
}