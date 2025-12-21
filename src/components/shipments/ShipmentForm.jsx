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

export default function ShipmentForm({ customers, onSubmit, isLoading, initialData = {}, isAiGenerated = false }) {
  const { isRTL } = useLanguage();
  const [formData, setFormData] = useState({
    customer_id: initialData.customer_id || '',
    description: initialData.description || '',
    incoterms: initialData.incoterms || '',
    origin: {
      country: initialData.origin?.country || '',
      city: initialData.origin?.city || '',
      port_airport_name: initialData.origin?.port_airport_name || ''
    },
    destination: {
      country: initialData.destination?.country || '',
      city: initialData.destination?.city || '',
      port_airport_name: initialData.destination?.port_airport_name || ''
    },
    manufacture_country: initialData.manufacture_country || '',
    total_product_value: initialData.total_product_value || '',
    currency: initialData.currency || 'USD',
    total_weight: {
      value: initialData.total_weight?.value || '',
      unit: initialData.total_weight?.unit || 'kg'
    },
    total_volume: {
      value: initialData.total_volume?.value || '',
      unit: initialData.total_volume?.unit || 'cbm'
    },
    hs_code: initialData.hs_code || '',
    classification_reasoning: initialData.classification_reasoning || '',
    product_characteristics: initialData.product_characteristics || [],
    tariff_description: initialData.tariff_description || '',
    import_requirements: initialData.import_requirements || [],
    ai_analysis_summary: initialData.ai_analysis_summary || '',
    estimated_duties_and_taxes: initialData.estimated_duties_and_taxes || null,
    estimated_shipping_costs: initialData.estimated_shipping_costs || [],
    uploaded_documents: initialData.uploaded_documents || []
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

      {/* AI Analysis Summary */}
      {formData.ai_analysis_summary && (
        <div className="space-y-4">
          <h3 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            {isRTL ? 'סיכום ניתוח AI' : 'AI Analysis Summary'}
          </h3>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-[#475569] dark:text-[#CBD5E1] whitespace-pre-wrap">
              {formData.ai_analysis_summary}
            </p>
          </div>
        </div>
      )}

      {/* Estimated Duties & Taxes */}
      {formData.estimated_duties_and_taxes?.total_amount && (
        <div className="space-y-4">
          <h3 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            {isRTL ? 'הערכת מכסים ומיסים' : 'Estimated Duties & Taxes'}
          </h3>
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-[#475569] dark:text-[#CBD5E1]">
                {isRTL ? 'סכום משוער כולל:' : 'Estimated Total:'}
              </span>
              <span className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {formData.estimated_duties_and_taxes.total_amount.toLocaleString()} {formData.estimated_duties_and_taxes.currency}
              </span>
            </div>
            {formData.estimated_duties_and_taxes.breakdown?.length > 0 && (
              <div className="mt-3 space-y-1">
                {formData.estimated_duties_and_taxes.breakdown.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm text-[#64748B] dark:text-[#94A3B8]">
                    <span>{item.type} ({item.rate})</span>
                    <span>{item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Estimated Shipping Costs */}
      {formData.estimated_shipping_costs?.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            {isRTL ? 'הערכת עלויות שילוח' : 'Estimated Shipping Costs'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formData.estimated_shipping_costs.map((cost, idx) => (
              <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{cost.carrier}</h4>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">{cost.service} - {cost.mode}</p>
                  </div>
                  <span className="font-bold text-[#42C0B9]">
                    {cost.estimated_cost.toLocaleString()} {cost.currency}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  {isRTL ? 'זמן משוער: ' : 'Est. Transit: '}{cost.estimated_transit_time}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import Requirements */}
      {formData.import_requirements?.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            {isRTL ? 'דרישות יבוא' : 'Import Requirements'}
          </h3>
          <div className="space-y-3">
            {formData.import_requirements.map((req, idx) => (
              <div key={idx} className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h4 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">{req.title}</h4>
                <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">{req.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

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