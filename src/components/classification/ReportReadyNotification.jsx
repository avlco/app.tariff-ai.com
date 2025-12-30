import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { X, CheckCircle, AlertCircle, ArrowRight, Loader2 } from 'lucide-react'; // Icons
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AnimatePresence, motion } from 'framer-motion';

export default function ReportReadyNotification() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const checkReports = async () => {
      try {
        // FIX: Use simple string syntax for sorting
        const reports = await base44.entities.ClassificationReport.list('-updated_date', 10);
        
        const activeNotifications = [];
        reports.forEach(report => {
            const uniqueKey = `${report.id}_${report.status}`;
            const isRead = localStorage.getItem(`read_${uniqueKey}`);
            
            if (isRead === 'true') return;

            if (report.status === 'waiting_for_user') {
                activeNotifications.push({
                    id: report.id,
                    type: 'waiting',
                    title: 'Action Required',
                    message: `${report.product_name} needs clarification.`,
                    key: uniqueKey,
                    persistent: true
                });
            } else if (report.status === 'completed') {
                activeNotifications.push({
                    id: report.id,
                    type: 'completed',
                    title: 'Classification Ready',
                    message: `${report.product_name} is done.`,
                    key: uniqueKey,
                    persistent: false
                });
            } else if (report.status === 'failed') {
                 activeNotifications.push({
                    id: report.id,
                    type: 'failed',
                    title: 'Process Failed',
                    message: `Could not classify ${report.product_name}.`,
                    key: uniqueKey,
                    persistent: false
                });
            }
        });
        setNotifications(activeNotifications);
      } catch (error) {
        console.error("Notification polling error:", error);
      }
    };

    const interval = setInterval(checkReports, 4000); // Check every 4s
    checkReports();
    return () => clearInterval(interval);
  }, []);

  const dismiss = (key) => {
      localStorage.setItem(`read_${key}`, 'true');
      setNotifications(prev => prev.filter(n => n.key !== key));
  };

  const handleAction = (n) => {
      dismiss(n.key);
      if (n.type === 'waiting') navigate(createPageUrl('ClarifyReport', { id: n.id }));
      else navigate(createPageUrl('ReportView', { id: n.id }));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-6 z-50 flex flex-col gap-3 w-80 pointer-events-none">
      <AnimatePresence>
        {notifications.map(n => (
          <motion.div
            key={n.key}
            initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}
            className="pointer-events-auto"
          >
            <Card className={`border-l-4 shadow-xl p-4 bg-white/95 backdrop-blur 
                ${n.type === 'waiting' ? 'border-orange-500' : n.type === 'completed' ? 'border-green-500' : 'border-red-500'}`}>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        {n.type === 'waiting' && <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />}
                        {n.type === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {n.type === 'failed' && <AlertCircle className="w-4 h-4 text-red-500" />}
                        <span className="font-bold text-sm text-slate-800">{n.title}</span>
                    </div>
                    {!n.persistent && <button onClick={() => dismiss(n.key)}><X className="w-4 h-4 text-slate-400 hover:text-slate-600"/></button>}
                </div>
                <p className="text-xs text-slate-600 mt-1 mb-3">{n.message}</p>
                <Button size="sm" onClick={() => handleAction(n)} className="w-full h-8 text-xs bg-slate-900 text-white hover:bg-slate-800">
                    {n.type === 'waiting' ? 'Resolve Now' : 'View Report'} <ArrowRight className="w-3 h-3 ml-2"/>
                </Button>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}