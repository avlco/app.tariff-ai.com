import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../components/providers/LanguageContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Search, 
  Plus, 
  Eye, 
  Trash2, 
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import ClassifyButton from '../components/classification/ClassifyButton';
import NewClassificationDialog from '../components/classification/NewClassificationDialog';


export default function Reports() {
  const { t, language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [classifyDialogOpen, setClassifyDialogOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);
  
  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn: () => base44.entities.ClassificationReport.list('-created_date'),
  });

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (e) {}
    };
    loadUser();
  }, []);
  


  const filteredReports = (reports || []).filter(report => {
    if (!report) return false;
    const matchesSearch = (report.product_name?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
                         (report.hs_code?.toLowerCase() ?? '').includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  
  const handleDelete = async (id) => {
    if (!confirm(language === 'he' ? 'האם למחוק את הדוח?' : 'Delete this report?')) return;
    try {
      await base44.entities.ClassificationReport.delete(id);
      toast.success(language === 'he' ? 'הדוח נמחק' : 'Report deleted');
      refetch();
    } catch (error) {
      toast.error(language === 'he' ? 'שגיאה במחיקה' : 'Error deleting report');
    }
  };
  
  const statusConfig = {
    pending: { icon: Clock, color: 'bg-[#D89C42]/10 text-[#D89C42] border-[#D89C42]/20' },
    completed: { icon: CheckCircle2, color: 'bg-[#42C0B9]/10 text-[#42C0B9] border-[#42C0B9]/20' },
    failed: { icon: AlertCircle, color: 'bg-red-100 text-red-600 border-red-200' },
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('reports')}
        </h1>
        <ClassifyButton onClick={() => setClassifyDialogOpen(true)} />
      </div>
      
      <NewClassificationDialog 
        open={classifyDialogOpen} 
        onOpenChange={setClassifyDialogOpen} 
      />
      
      {/* Filters */}
      <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search')}
              className={`${isRTL ? 'pr-10' : 'pl-10'} border-slate-200 dark:border-slate-700`}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48 border-slate-200 dark:border-slate-700">
              <Filter className="w-4 h-4 me-2 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'he' ? 'כל הסטטוסים' : 'All Status'}</SelectItem>
              <SelectItem value="completed">{t('completed')}</SelectItem>
              <SelectItem value="pending">{t('pending')}</SelectItem>
              <SelectItem value="failed">{t('failed')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>
      
      {/* Table */}
      <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-[#42C0B9] border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-16 h-16 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              {t('noResults')}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              {language === 'he' ? 'אין דוחות זמינים' : 'No reports available'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead>{t('productName')}</TableHead>
                  <TableHead>{t('hsCode')}</TableHead>
                  <TableHead>{t('destinationCountry')}</TableHead>
                  <TableHead>{language === 'he' ? 'סטטוס' : 'Status'}</TableHead>
                  <TableHead>{language === 'he' ? 'תאריך' : 'Date'}</TableHead>
                  {currentUser?.role === 'admin' && (
                    <TableHead>{language === 'he' ? 'נוצר על ידי' : 'Created By'}</TableHead>
                  )}
                  <TableHead className="text-end">{language === 'he' ? 'פעולות' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {filteredReports.map((report, index) => {
                    if (!report) return null;
                    const StatusIcon = statusConfig[report.status]?.icon || Clock;
                    return (
                      <motion.tr
                        key={report.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.05 }}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <TableCell>
                          <div className="font-medium text-slate-900 dark:text-white">
                            {report?.product_name || 'N/A'}
                          </div>
                          <div className="text-sm text-slate-500">
                            ID: {report?.report_id || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono font-medium text-[#114B5F] dark:text-[#42C0B9]">
                            {report?.hs_code || '---'}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-300">
                          {report?.destination_country || '---'}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusConfig[report?.status]?.color} border`}>
                            <StatusIcon className="w-3 h-3 me-1" />
                            {t(report?.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {report?.created_date ? format(new Date(report.created_date), 'dd/MM/yyyy') : '---'}
                        </TableCell>
                        {currentUser?.role === 'admin' && (
                          <TableCell className="text-slate-600 dark:text-slate-400">
                            {report?.created_by || '---'}
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Link to={createPageUrl(`ReportView?id=${report?.id}`)}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="w-4 h-4 text-slate-500" />
                              </Button>
                            </Link>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleDelete(report?.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
      </div>
  );
}