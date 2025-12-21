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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const countries = [
  'United States', 'China', 'Israel', 'Germany', 'United Kingdom', 'France', 
  'Japan', 'India', 'Canada', 'Australia', 'Brazil', 'Mexico', 'South Korea',
  'Italy', 'Spain', 'Netherlands', 'Switzerland', 'Sweden', 'Poland', 'Belgium'
];

export default function CustomerForm({ customer, onSubmit, isLoading }) {
  const { isRTL } = useLanguage();
  const [formData, setFormData] = useState({
    customer_name: customer?.customer_name || '',
    contact_person: customer?.contact_person || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    billing_address: customer?.billing_address || {
      street: '',
      city: '',
      state_province: '',
      zip_code: '',
      country: ''
    },
    shipping_address: customer?.shipping_address || {
      street: '',
      city: '',
      state_province: '',
      zip_code: '',
      country: ''
    },
    tax_id: customer?.tax_id || '',
    customs_broker_id: customer?.customs_broker_id || '',
    preferred_incoterms: customer?.preferred_incoterms || '',
    default_shipping_method: customer?.default_shipping_method || '',
    notes: customer?.notes || ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddressChange = (type, field, value) => {
    setFormData(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value }
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
            <Label htmlFor="customer_name">{isRTL ? 'שם לקוח' : 'Customer Name'} *</Label>
            <Input
              id="customer_name"
              value={formData.customer_name}
              onChange={(e) => handleChange('customer_name', e.target.value)}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="contact_person">{isRTL ? 'איש קשר' : 'Contact Person'}</Label>
            <Input
              id="contact_person"
              value={formData.contact_person}
              onChange={(e) => handleChange('contact_person', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="email">{isRTL ? 'אימייל' : 'Email'} *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="phone">{isRTL ? 'טלפון' : 'Phone'}</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Addresses */}
      <div>
        <h3 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-4">
          {isRTL ? 'כתובות' : 'Addresses'}
        </h3>
        <Tabs defaultValue="shipping" dir={isRTL ? 'rtl' : 'ltr'}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="shipping">{isRTL ? 'כתובת משלוח' : 'Shipping Address'}</TabsTrigger>
            <TabsTrigger value="billing">{isRTL ? 'כתובת חיוב' : 'Billing Address'}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="shipping" className="space-y-4 mt-4">
            <div>
              <Label>{isRTL ? 'רחוב' : 'Street'} *</Label>
              <Input
                value={formData.shipping_address.street}
                onChange={(e) => handleAddressChange('shipping_address', 'street', e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{isRTL ? 'עיר' : 'City'} *</Label>
                <Input
                  value={formData.shipping_address.city}
                  onChange={(e) => handleAddressChange('shipping_address', 'city', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>{isRTL ? 'מיקוד' : 'Zip Code'} *</Label>
                <Input
                  value={formData.shipping_address.zip_code}
                  onChange={(e) => handleAddressChange('shipping_address', 'zip_code', e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{isRTL ? 'מדינה/אזור' : 'State/Province'}</Label>
                <Input
                  value={formData.shipping_address.state_province}
                  onChange={(e) => handleAddressChange('shipping_address', 'state_province', e.target.value)}
                />
              </div>
              <div>
                <Label>{isRTL ? 'מדינה' : 'Country'} *</Label>
                <Select
                  value={formData.shipping_address.country}
                  onValueChange={(value) => handleAddressChange('shipping_address', 'country', value)}
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
            </div>
          </TabsContent>

          <TabsContent value="billing" className="space-y-4 mt-4">
            <div>
              <Label>{isRTL ? 'רחוב' : 'Street'}</Label>
              <Input
                value={formData.billing_address.street}
                onChange={(e) => handleAddressChange('billing_address', 'street', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{isRTL ? 'עיר' : 'City'}</Label>
                <Input
                  value={formData.billing_address.city}
                  onChange={(e) => handleAddressChange('billing_address', 'city', e.target.value)}
                />
              </div>
              <div>
                <Label>{isRTL ? 'מיקוד' : 'Zip Code'}</Label>
                <Input
                  value={formData.billing_address.zip_code}
                  onChange={(e) => handleAddressChange('billing_address', 'zip_code', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{isRTL ? 'מדינה/אזור' : 'State/Province'}</Label>
                <Input
                  value={formData.billing_address.state_province}
                  onChange={(e) => handleAddressChange('billing_address', 'state_province', e.target.value)}
                />
              </div>
              <div>
                <Label>{isRTL ? 'מדינה' : 'Country'}</Label>
                <Select
                  value={formData.billing_address.country}
                  onValueChange={(value) => handleAddressChange('billing_address', 'country', value)}
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
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Additional Info */}
      <div className="space-y-4">
        <h3 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
          {isRTL ? 'מידע נוסף' : 'Additional Information'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="tax_id">{isRTL ? 'מספר זיהוי מס' : 'Tax ID'}</Label>
            <Input
              id="tax_id"
              value={formData.tax_id}
              onChange={(e) => handleChange('tax_id', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="customs_broker_id">{isRTL ? 'מספר עמיל מכס' : 'Customs Broker ID'}</Label>
            <Input
              id="customs_broker_id"
              value={formData.customs_broker_id}
              onChange={(e) => handleChange('customs_broker_id', e.target.value)}
            />
          </div>

          <div>
            <Label>{isRTL ? 'Incoterms מועדף' : 'Preferred Incoterms'}</Label>
            <Select
              value={formData.preferred_incoterms}
              onValueChange={(value) => handleChange('preferred_incoterms', value)}
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

          <div>
            <Label>{isRTL ? 'שיטת משלוח מועדפת' : 'Default Shipping Method'}</Label>
            <Select
              value={formData.default_shipping_method}
              onValueChange={(value) => handleChange('default_shipping_method', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={isRTL ? 'בחר' : 'Select'} />
              </SelectTrigger>
              <SelectContent>
                {['Air', 'Sea', 'Courier', 'Land'].map((method) => (
                  <SelectItem key={method} value={method}>{method}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="notes">{isRTL ? 'הערות' : 'Notes'}</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" disabled={isLoading} className="bg-[#42C0B9] hover:bg-[#3AB0A8]">
          {isLoading ? (isRTL ? 'שומר...' : 'Saving...') : (isRTL ? 'שמור' : 'Save')}
        </Button>
      </div>
    </form>
  );
}