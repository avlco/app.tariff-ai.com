import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ReportReadyNotification() {
  const navigate = useNavigate();
  // Store processed IDs in state to avoid re-toasting in same session
  const [processedIds, setProcessedIds] = useState(new Set());

  useEffect(() => {
    const checkReports = async () => {
      try {
        const reports = await base44.entities.ClassificationReport.list({
            sort: { field: 'created_date', order: 'desc' },
            limit: 10
        });

        reports.forEach(report => {
            // Check if we already processed this specific status event for this report
            const uniqueEventKey = `${report.id}_${report.status}`;
            
            // Check LocalStorage for permanent persistence across refreshes
            const isRead = localStorage.getItem(`read_${uniqueEventKey}`);

            if (!processedIds.has(uniqueEventKey) && !isRead) {
                
                if (report.status === 'completed') {
                    toast.success(`Report Ready: ${report.product_name}`, {
                        action: {
                            label: 'View',
                            onClick: () => {
                                localStorage.setItem(`read_${uniqueEventKey}`, 'true');
                                navigate(createPageUrl('ReportView', { id: report.id }));
                            }
                        },
                        duration: 8000,
                    });
                    setProcessedIds(prev => new Set(prev).add(uniqueEventKey));
                }
                
                if (report.status === 'waiting_for_user') {
                    toast.warning(`Action Required: ${report.product_name}`, {
                        description: 'Expert needs clarification.',
                        action: {
                            label: 'Resolve',
                            onClick: () => {
                                localStorage.setItem(`read_${uniqueEventKey}`, 'true');
                                navigate(createPageUrl('ClarifyReport', { id: report.id })); // Ensure this page maps correctly in router
                            }
                        },
                        duration: Infinity, // Stay until clicked
                    });
                    setProcessedIds(prev => new Set(prev).add(uniqueEventKey));
                }
            }
        });
      } catch (error) {
        console.error("Notification polling error:", error);
      }
    };

    // Poll every 5 seconds
    const interval = setInterval(checkReports, 5000);
    checkReports(); // Initial check

    return () => clearInterval(interval);
  }, [navigate, processedIds]);

  return null; // Headless component
}