import React, { useState } from 'react';
import { useLanguage } from '../components/providers/LanguageContext';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Users, 
  Mail, 
  Phone, 
  MapPin,
  Edit,
  Trash2,
  Building2,
  Download,
  Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CustomerForm from '../components/customers/CustomerForm';
import { toast } from 'sonner';

export default function Customers() {
  const { t, isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsDialogOpen(false);
      setEditingCustomer(null);
      toast.success(isRTL ? 'לקוח נוצר בהצלחה' : 'Customer created successfully');
    },
    onError: () => {
      toast.error(isRTL ? 'שגיאה ביצירת לקוח' : 'Error creating customer');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsDialogOpen(false);
      setEditingCustomer(null);
      toast.success(isRTL ? 'לקוח עודכן בהצלחה' : 'Customer updated successfully');
    },
    onError: () => {
      toast.error(isRTL ? 'שגיאה בעדכון לקוח' : 'Error updating customer');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Customer.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setDeletingCustomer(null);
      toast.success(isRTL ? 'לקוח נמחק בהצלחה' : 'Customer deleted successfully');
    },
    onError: () => {
      toast.error(isRTL ? 'שגיאה במחיקת לקוח' : 'Error deleting customer');
    }
  });

  const filteredCustomers = customers.filter(customer =>
    customer.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = (data) => {
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleDelete = (customer) => {
    setDeletingCustomer(customer);
  };

  const confirmDelete = () => {
    if (deletingCustomer) {
      deleteMutation.mutate(deletingCustomer.id);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(customers, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customers-${new Date().toISOString().split('T')[0]}.json`;
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

        for (const customer of importedData) {
          const { id, created_date, updated_date, created_by, ...customerData } = customer;
          await base44.entities.Customer.create(customerData);
        }

        queryClient.invalidateQueries({ queryKey: ['customers'] });
        toast.success(isRTL ? `${importedData.length} לקוחות יובאו בהצלחה` : `${importedData.length} customers imported successfully`);
      } catch (error) {
        toast.error(isRTL ? 'שגיאה בייבוא נתונים' : 'Error importing data');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
            <Users className="w-7 h-7 text-[#42C0B9]" />
            {isRTL ? 'לקוחות' : 'Customers'}
          </h1>
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">
            {isRTL ? 'ניהול רשימת לקוחות ונמענים' : 'Manage your customer and recipient list'}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={customers.length === 0}>
            <Download className="w-4 h-4 me-2" />
            {isRTL ? 'יצא' : 'Export'}
          </Button>
          <Button variant="outline" onClick={() => document.getElementById('import-customers')?.click()}>
            <Upload className="w-4 h-4 me-2" />
            {isRTL ? 'יבא' : 'Import'}
          </Button>
          <input
            id="import-customers"
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingCustomer(null);
          }}>
            <DialogTrigger asChild>
              <Button className="bg-[#42C0B9] hover:bg-[#3AB0A8] text-white">
                <Plus className="w-4 h-4 me-2" />
                {isRTL ? 'לקוח חדש' : 'New Customer'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer 
                    ? (isRTL ? 'עריכת לקוח' : 'Edit Customer')
                    : (isRTL ? 'לקוח חדש' : 'New Customer')
                  }
                </DialogTitle>
              </DialogHeader>
              <CustomerForm
                customer={editingCustomer}
                onSubmit={handleSubmit}
                isLoading={createMutation.isPending || updateMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] ${isRTL ? 'right-3' : 'left-3'}`} />
          <Input
            placeholder={isRTL ? 'חיפוש לקוחות...' : 'Search customers...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={isRTL ? 'pr-10' : 'pl-10'}
          />
        </div>
      </Card>

      {/* Customers List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
            </Card>
          ))}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 text-[#CBD5E1] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#475569] dark:text-[#CBD5E1] mb-2">
            {isRTL ? 'אין לקוחות' : 'No customers yet'}
          </h3>
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
            {isRTL ? 'התחל בהוספת לקוח ראשון' : 'Start by adding your first customer'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <motion.div
              key={customer.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#114B5F] to-[#42C0B9] flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                        {customer.customer_name}
                      </h3>
                      {customer.contact_person && (
                        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                          {customer.contact_person}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(customer)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      onClick={() => handleDelete(customer)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-[#475569] dark:text-[#CBD5E1]">
                    <Mail className="w-4 h-4 text-[#42C0B9]" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-[#475569] dark:text-[#CBD5E1]">
                      <Phone className="w-4 h-4 text-[#42C0B9]" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer.shipping_address?.country && (
                    <div className="flex items-center gap-2 text-[#475569] dark:text-[#CBD5E1]">
                      <MapPin className="w-4 h-4 text-[#42C0B9]" />
                      <span>{customer.shipping_address.country}</span>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingCustomer} onOpenChange={() => setDeletingCustomer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRTL ? 'האם אתה בטוח?' : 'Are you sure?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL 
                ? 'פעולה זו תמחק את הלקוח לצמיתות. לא ניתן לבטל פעולה זו.'
                : 'This action will permanently delete this customer. This cannot be undone.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {isRTL ? 'ביטול' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRTL ? 'מחק' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}