import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { X, Eye, AlertTriangle, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AnimatePresence, motion } from 'framer-motion';

export default function ReportReadyNotification() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const checkReports = async () => {
      try {
        // Poll for relevant reports
        const reports = await base44.entities.ClassificationReport.list({
            sort: { field: 'updated_date', order: 'desc' }, // Check recently updated
            limit: 10
        });

        const activeNotifications = [];

        reports.forEach(report => {
            const uniqueEventKey = `${report.id}_${report.status}`;
            const isRead = localStorage.getItem(`read_${uniqueEventKey}`);

            if (isRead) return;

            if (report.status === 'waiting_for_user') {
                activeNotifications.push({
                    id: report.id,
                    type: 'waiting',
                    title: 'Action Required',
                    message: report.product_name,
                    eventKey: uniqueEventKey,
                    isPersistent: true
                });
            } else if (report.status === 'completed') {
                activeNotifications.push({
                    id: report.id,
                    type: 'completed',
                    title: 'Report Ready',
                    message: report.product_name,
                    eventKey: uniqueEventKey,
                    isPersistent: false
                });
            } else if (report.status === 'failed') {
                 activeNotifications.push({
                    id: report.id,
                    type: 'failed',
                    title: 'Classification Failed',
                    message: report.product_name,
                    eventKey: uniqueEventKey,
                    isPersistent: false
                });
            }
        });

        setNotifications(activeNotifications);
      } catch (error) {
        console.error("Notification polling error:", error);
      }
    };

    const interval = setInterval(checkReports, 5000);
    checkReports();

    return () => clearInterval(interval);
  }, []);

  const handleClose = (eventKey) => {
      localStorage.setItem(`read_${eventKey}`, 'true');
      setNotifications(prev => prev.filter(n => n.eventKey !== eventKey));
  };

  const handleAction = (n) => {
      // Mark as read immediately on interaction
      localStorage.setItem(`read_${n.eventKey}`, 'true');
      if (n.type === 'waiting') {
          navigate(createPageUrl('ClarifyReport', { id: n.id }));
      } else {
          navigate(createPageUrl('ReportView', { id: n.id }));
      }
      setNotifications(prev => prev.filter(item => item.eventKey !== n.eventKey));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-3 w-80 pointer-events-none">
      <AnimatePresence>
        {notifications.map(n => (
          <motion.div
            key={n.eventKey}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="pointer-events-auto"
          >
            <Card className={`
                border-l-4 shadow-lg p-4 relative
                ${n.type === 'waiting' ? 'border-l-orange-500 bg-white' : ''}
                ${n.type === 'completed' ? 'border-l-green-500 bg-white' : ''}
                ${n.type === 'failed' ? 'border-l-red-500 bg-white' : ''}
            `}>
                {/* Header */}
                <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                        {n.type === 'waiting' && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                        {n.type === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {n.type === 'failed' && <AlertCircle className="w-4 h-4 text-red-500" />}
                        <span className={`font-semibold text-sm
                            ${n.type === 'waiting' ? 'text-orange-700' : ''}
                            ${n.type === 'completed' ? 'text-green-700' : ''}
                            ${n.type === 'failed' ? 'text-red-700' : ''}
                        `}>{n.title}</span>
                    </div>
                    {!n.isPersistent && (
                        <button onClick={() => handleClose(n.eventKey)} className="text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Body */}
                <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                    {n.message}
                </p>

                {/* Action */}
                <Button 
                    size="sm" 
                    onClick={() => handleAction(n)}
                    className={`w-full justify-between
                        ${n.type === 'waiting' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : ''}
                        ${n.type === 'completed' ? 'bg-green-100 text-green-700 hover:bg-green-200' : ''}
                        ${n.type === 'failed' ? 'bg-red-100 text-red-700 hover:bg-red-200' : ''}
                    `}
                    variant="ghost"
                >
                    {n.type === 'waiting' ? 'Resolve Issue' : 'View Details'}
                    <ArrowRight className="w-4 h-4" />
                </Button>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}