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
      
      const shipmentData = {
        ...formData,
        shipment_id: shipmentId,
        status: 'draft'
      };

      const newShipment = await base44.entities.Shipment.create(shipmentData);
      
      toast.success(isRTL ? 'משלוח נוצר בהצלחה' : 'Shipment created successfully');
      navigate(createPageUrl(`ShipmentView?id=${newShipment.id}`));
    } catch (error) {
      toast.error(isRTL ? 'שגיאה ביצירת משלוח' : 'Error creating shipment');
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