import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../components/providers/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Headphones, 
  Plus, 
  MessageSquare,
  Clock,
  CheckCircle2,
  Send,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function Support() {
  const { t, language, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    category: 'technical',
    message: '',
  });
  
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => base44.entities.SupportTicket.list('-created_date'),
    initialData: [],
  });
  
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const ticketId = Math.random().toString(36).substring(2, 10);
      return base44.entities.SupportTicket.create({
        ...data,
        ticket_id: ticketId,
        status: 'open',
      });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      
      // Update UserMasterData
      const user = await base44.auth.me();
      const existingUserData = await base44.entities.UserMasterData.filter({ user_email: user.email });
      const allTickets = await base44.entities.SupportTicket.filter({ created_by: user.email });
      const openTickets = allTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
      const resolvedTickets = allTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
      const lastTicketDate = allTickets.length > 0 ? allTickets.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0].created_date : null;
      
      if (existingUserData.length > 0) {
        await base44.entities.UserMasterData.update(existingUserData[0].id, {
          support_tickets_summary: {
            total_tickets: allTickets.length,
            open_tickets: openTickets,
            resolved_tickets: resolvedTickets,
            last_ticket_date: lastTicketDate
          }
        });
      } else {
        await base44.entities.UserMasterData.create({
          user_email: user.email,
          full_name: user.full_name,
          role: user.role,
          subscription_plan: user.subscription_plan || 'free',
          preferred_language: user.preferred_language || 'he',
          theme: user.theme || 'light',
          support_tickets_summary: {
            total_tickets: allTickets.length,
            open_tickets: openTickets,
            resolved_tickets: resolvedTickets,
            last_ticket_date: lastTicketDate
          }
        });
      }
      
      setDialogOpen(false);
      setNewTicket({ subject: '', category: 'technical', message: '' });
      toast.success(language === 'he' ? 'הפנייה נשלחה בהצלחה' : 'Ticket submitted successfully');
    },
  });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newTicket.subject || !newTicket.message) {
      toast.error(language === 'he' ? 'נא למלא את כל השדות' : 'Please fill all fields');
      return;
    }
    createMutation.mutate(newTicket);
  };
  
  const statusConfig = {
    open: { color: 'bg-[#D89C42]/10 text-[#D89C42] border-[#D89C42]/20', icon: Clock },
    in_progress: { color: 'bg-blue-100 text-blue-600 border-blue-200', icon: MessageSquare },
    resolved: { color: 'bg-[#42C0B9]/10 text-[#42C0B9] border-[#42C0B9]/20', icon: CheckCircle2 },
    closed: { color: 'bg-slate-100 text-slate-600 border-slate-200', icon: CheckCircle2 },
  };
  
  const categoryLabels = {
    he: {
      billing: 'חיוב',
      technical: 'טכני',
      classification: 'סיווג',
      account: 'חשבון',
      other: 'אחר',
    },
    en: {
      billing: 'Billing',
      technical: 'Technical',
      classification: 'Classification',
      account: 'Account',
      other: 'Other',
    }
  };
  
  const statusLabels = {
    he: { open: 'פתוח', in_progress: 'בטיפול', resolved: 'נפתר', closed: 'סגור' },
    en: { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' },
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('contactSupport')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {language === 'he' ? 'יש לך שאלה? אנחנו כאן לעזור' : 'Have a question? We\'re here to help'}
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#42C0B9] hover:bg-[#42C0B9]/90 shadow-lg shadow-[#42C0B9]/25">
              <Plus className="w-4 h-4 me-2" />
              {language === 'he' ? 'פנייה חדשה' : 'New Ticket'}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {language === 'he' ? 'פתיחת פנייה חדשה' : 'Open New Ticket'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="subject">{t('subject')}</Label>
                <Input
                  id="subject"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  className="mt-1.5"
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
              </div>
              
              <div>
                <Label htmlFor="category">{t('category')}</Label>
                <Select
                  value={newTicket.category}
                  onValueChange={(value) => setNewTicket({ ...newTicket, category: value })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="billing">{categoryLabels[language].billing}</SelectItem>
                    <SelectItem value="technical">{categoryLabels[language].technical}</SelectItem>
                    <SelectItem value="classification">{categoryLabels[language].classification}</SelectItem>
                    <SelectItem value="account">{categoryLabels[language].account}</SelectItem>
                    <SelectItem value="other">{categoryLabels[language].other}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="message">{t('message')}</Label>
                <Textarea
                  id="message"
                  value={newTicket.message}
                  onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
                  className="mt-1.5 min-h-32"
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button 
                  type="submit" 
                  className="bg-[#42C0B9] hover:bg-[#42C0B9]/90"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 me-2" />
                  )}
                  {t('submit')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Tickets List */}
      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-white dark:bg-slate-900 border-0 shadow-sm animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-3" />
                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Headphones className="w-16 h-16 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              {language === 'he' ? 'אין פניות' : 'No tickets'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              {language === 'he' ? 'יש לך שאלה? פתח פנייה חדשה' : 'Have a question? Open a new ticket'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {tickets.map((ticket, index) => {
              const StatusIcon = statusConfig[ticket.status]?.icon || Clock;
              return (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="bg-white dark:bg-slate-900 border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge className={`${statusConfig[ticket.status]?.color} border`}>
                              <StatusIcon className="w-3 h-3 me-1" />
                              {statusLabels[language][ticket.status]}
                            </Badge>
                            <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800">
                              {categoryLabels[language][ticket.category]}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                            {ticket.subject}
                          </h3>
                          <p className="text-slate-600 dark:text-slate-300 text-sm line-clamp-2">
                            {ticket.message}
                          </p>
                          {ticket.response && (
                            <div className="mt-4 p-3 bg-[#42C0B9]/5 border border-[#42C0B9]/20 rounded-lg">
                              <p className="text-sm font-medium text-[#42C0B9] mb-1">
                                {language === 'he' ? 'תשובה:' : 'Response:'}
                              </p>
                              <p className="text-sm text-slate-600 dark:text-slate-300">
                                {ticket.response}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-slate-400 text-end whitespace-nowrap">
                          <p>{format(new Date(ticket.created_date), 'dd/MM/yyyy')}</p>
                          <p className="text-xs">#{ticket.ticket_id}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}