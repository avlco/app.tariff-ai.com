import React, { useState, useEffect } from 'react';
import { useLanguage } from '../components/providers/LanguageContext';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { 
  Package, 
  MapPin, 
  DollarSign, 
  Calendar,
  ArrowLeft,
  Edit,
  Trash2,
  FileText,
  Truck,
  Building2,
  Globe,
  Weight,
  Box,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { toast } from 'sonner';

const statusConfig = {
  draft: { 
    label: { he: 'טיוטה', en: 'Draft' }, 
    color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    icon: FileText
  },
  pending_review: { 
    label: { he: 'ממתין לביקורת', en: 'Pending Review' }, 
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
    icon: AlertCircle
  },
  approved: { 
    label: { he: 'מאושר', en: 'Approved' }, 
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
    icon: Package
  },
  in_transit: { 
    label: { he: 'בדרך', en: 'In Transit' }, 
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
    icon: Truck
  },
  delivered: { 
    label: { he: 'נמסר', en: 'Delivered' }, 
    color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200',
    icon: Package
  },
  canceled: { 
    label: { he: 'בוטל', en: 'Canceled' }, 
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    icon: AlertCircle
  },
  failed: { 
    label: { he: 'נכשל', en: 'Failed' }, 
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    icon: AlertCircle
  }
};

export default function ShipmentView() {
  const { t, language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadShipment = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const shipmentId = urlParams.get('id');
        
        if (!shipmentId) {
          toast.error(isRTL ? 'מזהה משלוח חסר' : 'Shipment ID missing');
          navigate(createPageUrl('Shipments'));
          return;
        }

        const shipments = await base44.entities.Shipment.list();
        const foundShipment = shipments.find(s => s.id === shipmentId);
        
        if (!foundShipment) {
          toast.error(isRTL ? 'משלוח לא נמצא' : 'Shipment not found');
          navigate(createPageUrl('Shipments'));
          return;
        }

        setShipment(foundShipment);

        if (foundShipment.customer_id) {
          const customers = await base44.entities.Customer.list();
          const foundCustomer = customers.find(c => c.id === foundShipment.customer_id);
          setCustomer(foundCustomer);
        }
      } catch (error) {
        toast.error(isRTL ? 'שגיאה בטעינת משלוח' : 'Error loading shipment');
        navigate(createPageUrl('Shipments'));
      } finally {
        setIsLoading(false);
      }
    };

    loadShipment();
  }, [navigate, isRTL]);

  const handleDelete = async () => {
    if (!confirm(isRTL ? 'האם למחוק את המשלוח?' : 'Delete this shipment?')) return;
    
    try {
      await base44.entities.Shipment.delete(shipment.id);
      toast.success(isRTL ? 'המשלוח נמחק' : 'Shipment deleted');
      navigate(createPageUrl('Shipments'));
    } catch (error) {
      toast.error(isRTL ? 'שגיאה במחיקה' : 'Error deleting shipment');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Card className="p-6 animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
        </Card>
      </div>
    );
  }

  if (!shipment) return null;

  const StatusIcon = statusConfig[shipment.status]?.icon || FileText;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl('Shipments'))}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {isRTL ? 'חזרה למשלוחים' : 'Back to Shipments'}
        </Button>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDelete} className="text-red-600">
            <Trash2 className="w-4 h-4 me-2" />
            {isRTL ? 'מחק' : 'Delete'}
          </Button>
        </div>
      </div>

      {/* Main Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#114B5F] to-[#42C0B9] flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                  {shipment.description || (isRTL ? 'משלוח ללא תיאור' : 'Untitled Shipment')}
                </h1>
                <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
                  {isRTL ? 'מזהה: ' : 'ID: '}{shipment.shipment_id}
                </p>
              </div>
            </div>
            
            <Badge className={`${statusConfig[shipment.status]?.color} flex items-center gap-1`}>
              <StatusIcon className="w-3 h-3" />
              {statusConfig[shipment.status]?.label[language]}
            </Badge>
          </div>

          <Separator className="my-6" />

          {/* Route */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#42C0B9]" />
                {isRTL ? 'מוצא' : 'Origin'}
              </h3>
              <div className="text-sm text-[#475569] dark:text-[#CBD5E1] space-y-1">
                <p className="font-medium">{shipment.origin?.country || '---'}</p>
                <p>{shipment.origin?.city || '---'}</p>
                {shipment.origin?.port_airport_name && (
                  <p className="text-[#64748B] dark:text-[#94A3B8]">{shipment.origin.port_airport_name}</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#D89C42]" />
                {isRTL ? 'יעד' : 'Destination'}
              </h3>
              <div className="text-sm text-[#475569] dark:text-[#CBD5E1] space-y-1">
                <p className="font-medium">{shipment.destination?.country || '---'}</p>
                <p>{shipment.destination?.city || '---'}</p>
                {shipment.destination?.port_airport_name && (
                  <p className="text-[#64748B] dark:text-[#94A3B8]">{shipment.destination.port_airport_name}</p>
                )}
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-[#42C0B9] mt-0.5" />
              <div>
                <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
                  {isRTL ? 'שווי מוצר' : 'Product Value'}
                </p>
                <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  {shipment.total_product_value?.toLocaleString()} {shipment.currency}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-[#42C0B9] mt-0.5" />
              <div>
                <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
                  {isRTL ? 'קוד HS' : 'HS Code'}
                </p>
                <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] font-mono">
                  {shipment.hs_code || '---'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-[#42C0B9] mt-0.5" />
              <div>
                <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">Incoterms</p>
                <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  {shipment.incoterms}
                </p>
              </div>
            </div>

            {shipment.manufacture_country && (
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-[#42C0B9] mt-0.5" />
                <div>
                  <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
                    {isRTL ? 'מדינת ייצור' : 'Country of Manufacture'}
                  </p>
                  <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {shipment.manufacture_country}
                  </p>
                </div>
              </div>
            )}

            {shipment.total_weight?.value && (
              <div className="flex items-start gap-3">
                <Weight className="w-5 h-5 text-[#42C0B9] mt-0.5" />
                <div>
                  <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
                    {isRTL ? 'משקל' : 'Weight'}
                  </p>
                  <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {shipment.total_weight.value} {shipment.total_weight.unit}
                  </p>
                </div>
              </div>
            )}

            {shipment.total_volume?.value && (
              <div className="flex items-start gap-3">
                <Box className="w-5 h-5 text-[#42C0B9] mt-0.5" />
                <div>
                  <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
                    {isRTL ? 'נפח' : 'Volume'}
                  </p>
                  <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {shipment.total_volume.value} {shipment.total_volume.unit}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-[#42C0B9] mt-0.5" />
              <div>
                <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
                  {isRTL ? 'תאריך יצירה' : 'Created Date'}
                </p>
                <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  {shipment.created_date 
                    ? format(new Date(shipment.created_date), 'dd/MM/yyyy HH:mm')
                    : '---'
                  }
                </p>
              </div>
            </div>

            {customer && (
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-[#42C0B9] mt-0.5" />
                <div>
                  <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
                    {isRTL ? 'לקוח' : 'Customer'}
                  </p>
                  <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {customer.customer_name}
                  </p>
                </div>
              </div>
            )}

            {shipment.tracking_number && (
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-[#42C0B9] mt-0.5" />
                <div>
                  <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
                    {isRTL ? 'מספר מעקב' : 'Tracking Number'}
                  </p>
                  <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {shipment.tracking_number}
                  </p>
                </div>
              </div>
            )}

            {shipment.carrier_name && (
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-[#42C0B9] mt-0.5" />
                <div>
                  <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
                    {isRTL ? 'חברת שילוח' : 'Carrier'}
                  </p>
                  <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {shipment.carrier_name}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* AI Analysis */}
      {shipment.ai_analysis_summary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6">
            <h2 className="font-semibold text-lg text-[#0F172A] dark:text-[#F8FAFC] mb-4">
              {isRTL ? 'סיכום ניתוח AI' : 'AI Analysis Summary'}
            </h2>
            <p className="text-sm text-[#475569] dark:text-[#CBD5E1] whitespace-pre-wrap">
              {shipment.ai_analysis_summary}
            </p>
          </Card>
        </motion.div>
      )}

      {/* Estimated Duties & Taxes */}
      {shipment.estimated_duties_and_taxes?.total_amount && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-6">
            <h2 className="font-semibold text-lg text-[#0F172A] dark:text-[#F8FAFC] mb-4">
              {isRTL ? 'הערכת מכסים ומיסים' : 'Estimated Duties & Taxes'}
            </h2>
            <div className="flex justify-between items-center mb-4">
              <span className="text-[#64748B] dark:text-[#94A3B8]">
                {isRTL ? 'סכום כולל:' : 'Total Amount:'}
              </span>
              <span className="text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {shipment.estimated_duties_and_taxes.total_amount.toLocaleString()} {shipment.estimated_duties_and_taxes.currency}
              </span>
            </div>
            {shipment.estimated_duties_and_taxes.breakdown?.length > 0 && (
              <div className="space-y-2">
                {shipment.estimated_duties_and_taxes.breakdown.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-[#475569] dark:text-[#CBD5E1]">
                      {item.type} ({item.rate})
                    </span>
                    <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                      {item.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* Import Requirements */}
      {shipment.import_requirements?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6">
            <h2 className="font-semibold text-lg text-[#0F172A] dark:text-[#F8FAFC] mb-4">
              {isRTL ? 'דרישות יבוא' : 'Import Requirements'}
            </h2>
            <div className="space-y-3">
              {shipment.import_requirements.map((req, idx) => (
                <div key={idx} className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <h4 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">{req.title}</h4>
                  <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">{req.description}</p>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}