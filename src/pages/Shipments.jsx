import React, { useState } from 'react';
import { useLanguage } from '../components/providers/LanguageContext';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Plus, 
  Search, 
  Package, 
  Eye,
  Calendar,
  MapPin,
  DollarSign,
  Filter,
  Download,
  Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from 'date-fns';

const statusConfig = {
  draft: { 
    label: { he: 'טיוטה', en: 'Draft' }, 
    color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' 
  },
  pending_review: { 
    label: { he: 'ממתין לביקורת', en: 'Pending Review' }, 
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' 
  },
  approved: { 
    label: { he: 'מאושר', en: 'Approved' }, 
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' 
  },
  in_transit: { 
    label: { he: 'בדרך', en: 'In Transit' }, 
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' 
  },
  delivered: { 
    label: { he: 'נמסר', en: 'Delivered' }, 
    color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200' 
  },
  canceled: { 
    label: { he: 'בוטל', en: 'Canceled' }, 
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' 
  },
  failed: { 
    label: { he: 'נכשל', en: 'Failed' }, 
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' 
  }
};

export default function Shipments() {
  const { t, language, isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['shipments'],
    queryFn: () => base44.entities.Shipment.list('-created_date'),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.customer_name || (isRTL ? 'לא צוין' : 'Not specified');
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(shipments, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shipments-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(isRTL ? 'הנתונים יוצאו בהצלחה' : 'Data exported successfully');
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target?.result);
        if (!Array.isArray(importedData)) {
          toast.error(isRTL ? 'פורמט קובץ לא תקין' : 'Invalid file format');
          return;
        }

        for (const shipment of importedData) {
          const { id, created_date, updated_date, created_by, ...shipmentData } = shipment;
          await base44.entities.Shipment.create(shipmentData);
        }

        queryClient.invalidateQueries({ queryKey: ['shipments'] });
        toast.success(isRTL ? `${importedData.length} משלוחים יובאו בהצלחה` : `${importedData.length} shipments imported successfully`);
      } catch (error) {
        toast.error(isRTL ? 'שגיאה בייבוא נתונים' : 'Error importing data');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filteredShipments = shipments.filter(shipment => {
    const matchesSearch = 
      shipment.shipment_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.destination?.country?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || shipment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
            <Package className="w-7 h-7 text-[#42C0B9]" />
            {isRTL ? 'משלוחים' : 'Shipments'}
          </h1>
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">
            {isRTL ? 'ניהול ומעקב אחר משלוחים בינלאומיים' : 'Manage and track international shipments'}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={shipments.length === 0}>
            <Download className="w-4 h-4 me-2" />
            {isRTL ? 'יצא' : 'Export'}
          </Button>
          <Button variant="outline" onClick={() => document.getElementById('import-shipments')?.click()}>
            <Upload className="w-4 h-4 me-2" />
            {isRTL ? 'יבא' : 'Import'}
          </Button>
          <input
            id="import-shipments"
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <Link to={createPageUrl('NewShipment')}>
            <Button className="bg-[#42C0B9] hover:bg-[#3AB0A8] text-white">
              <Plus className="w-4 h-4 me-2" />
              {isRTL ? 'משלוח חדש' : 'New Shipment'}
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] ${isRTL ? 'right-3' : 'left-3'}`} />
            <Input
              placeholder={isRTL ? 'חיפוש משלוחים...' : 'Search shipments...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={isRTL ? 'pr-10' : 'pl-10'}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 me-2" />
              <SelectValue placeholder={isRTL ? 'סטטוס' : 'Status'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'כל הסטטוסים' : 'All Statuses'}</SelectItem>
              {Object.entries(statusConfig).map(([value, config]) => (
                <SelectItem key={value} value={value}>
                  {config.label[language]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Shipments List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
            </Card>
          ))}
        </div>
      ) : filteredShipments.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 text-[#CBD5E1] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#475569] dark:text-[#CBD5E1] mb-2">
            {isRTL ? 'אין משלוחים' : 'No shipments yet'}
          </h3>
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mb-4">
            {isRTL ? 'התחל בהוספת משלוח ראשון' : 'Start by creating your first shipment'}
          </p>
          <Link to={createPageUrl('NewShipment')}>
            <Button className="bg-[#42C0B9] hover:bg-[#3AB0A8] text-white">
              <Plus className="w-4 h-4 me-2" />
              {isRTL ? 'משלוח חדש' : 'New Shipment'}
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredShipments.map((shipment) => (
            <motion.div
              key={shipment.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                          {shipment.description || (isRTL ? 'משלוח ללא תיאור' : 'Untitled Shipment')}
                        </h3>
                        <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
                          {isRTL ? 'מזהה: ' : 'ID: '}{shipment.shipment_id}
                        </p>
                      </div>
                      <Badge className={statusConfig[shipment.status]?.color || statusConfig.draft.color}>
                        {statusConfig[shipment.status]?.label[language] || shipment.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-[#475569] dark:text-[#CBD5E1]">
                        <MapPin className="w-4 h-4 text-[#42C0B9]" />
                        <span>
                          {shipment.origin?.country} → {shipment.destination?.country}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[#475569] dark:text-[#CBD5E1]">
                        <DollarSign className="w-4 h-4 text-[#42C0B9]" />
                        <span>
                          {shipment.total_product_value?.toLocaleString()} {shipment.currency}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[#475569] dark:text-[#CBD5E1]">
                        <Package className="w-4 h-4 text-[#42C0B9]" />
                        <span>{shipment.hs_code || (isRTL ? 'אין קוד HS' : 'No HS Code')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[#475569] dark:text-[#CBD5E1]">
                        <Calendar className="w-4 h-4 text-[#42C0B9]" />
                        <span>
                          {shipment.created_date 
                            ? format(new Date(shipment.created_date), 'dd/MM/yyyy')
                            : (isRTL ? 'לא ידוע' : 'Unknown')
                          }
                        </span>
                      </div>
                    </div>

                    {shipment.customer_id && (
                      <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
                        {isRTL ? 'לקוח: ' : 'Customer: '}
                        <span className="font-medium text-[#475569] dark:text-[#CBD5E1]">
                          {getCustomerName(shipment.customer_id)}
                        </span>
                      </p>
                    )}
                  </div>

                  <div>
                    <Link to={createPageUrl(`ShipmentView?id=${shipment.id}`)}>
                      <Button variant="outline" className="w-full lg:w-auto">
                        <Eye className="w-4 h-4 me-2" />
                        {isRTL ? 'צפה' : 'View'}
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}