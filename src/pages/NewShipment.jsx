import React, { useState } from 'react';
import { useLanguage } from '../components/providers/LanguageContext';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { Package, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ShipmentForm from '../components/shipments/ShipmentForm';
import { toast } from 'sonner';

export default function NewShipment() {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const createShipment = async (formData) => {
    setIsCreating(true);
    try {
      // Generate unique shipment ID
      const shipmentId = `SHP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // Ensure all required fields are properly set
      const shipmentData = {
        shipment_id: shipmentId,
        description: formData.description || '',
        incoterms: formData.incoterms || 'EXW',
        origin: {
          country: formData.origin?.country || '',
          city: formData.origin?.city || '',
          port_airport_name: formData.origin?.port_airport_name || ''
        },
        destination: {
          country: formData.destination?.country || '',
          city: formData.destination?.city || '',
          port_airport_name: formData.destination?.port_airport_name || ''
        },
        total_product_value: parseFloat(formData.total_product_value) || 0,
        currency: formData.currency || 'USD',
        hs_code: formData.hs_code || '',
        status: 'draft',
        // Optional fields
        customer_id: formData.customer_id || null,
        manufacture_country: formData.manufacture_country || null,
        total_weight: formData.total_weight || null,
        total_volume: formData.total_volume || null,
        classification_reasoning: formData.classification_reasoning || null,
        product_characteristics: formData.product_characteristics || null,
        tariff_description: formData.tariff_description || null,
        import_requirements: formData.import_requirements || null,
        ai_analysis_summary: formData.ai_analysis_summary || null,
        estimated_duties_and_taxes: formData.estimated_duties_and_taxes || null,
        estimated_shipping_costs: formData.estimated_shipping_costs || null,
        uploaded_documents: formData.uploaded_documents || null,
        tracking_number: formData.tracking_number || null,
        carrier_name: formData.carrier_name || null
      };

      console.log('Creating shipment with data:', shipmentData);
      const newShipment = await base44.entities.Shipment.create(shipmentData);
      console.log('Shipment created successfully:', newShipment);
      
      toast.success(isRTL ? 'משלוח נוצר בהצלחה' : 'Shipment created successfully');
      
      // Navigate after a short delay to show the success message
      setTimeout(() => {
        navigate(createPageUrl('Shipments'));
      }, 500);
    } catch (error) {
      console.error('Error creating shipment:', error);
      toast.error(isRTL ? `שגיאה ביצירת משלוח: ${error.message}` : `Error creating shipment: ${error.message}`);
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#114B5F] to-[#42C0B9] flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            {isRTL ? 'משלוח חדש' : 'New Shipment'}
          </h1>
        </div>
        <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
          {isRTL 
            ? 'הזן את פרטי המשלוח הבינלאומי' 
            : 'Enter international shipment details'
          }
        </p>
      </motion.div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6">
          <ShipmentForm
            customers={customers}
            onSubmit={createShipment}
            isLoading={isCreating}
          />
        </Card>
      </motion.div>
    </div>
  );
}