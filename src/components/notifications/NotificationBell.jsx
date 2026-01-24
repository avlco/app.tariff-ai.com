import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '../providers/LanguageContext';
import { Bell, Check, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export default function NotificationBell() {
  const { language, isRTL } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  const loadNotifications = async () => {
    try {
      const data = await base44.entities.Notification.list('-created_date', 20);
      setNotifications(data || []);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    }
  };

  useEffect(() => {
    loadNotifications();
    
    // Subscribe to real-time updates
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (event.type === 'create') {
        setNotifications(prev => [event.data, ...prev]);
      } else if (event.type === 'update') {
        setNotifications(prev => prev.map(n => n.id === event.id ? event.data : n));
      } else if (event.type === 'delete') {
        setNotifications(prev => prev.filter(n => n.id !== event.id));
      }
    });

    return () => unsubscribe();
  }, []);

  const markAsRead = async (notificationId) => {
    try {
      await base44.entities.Notification.update(notificationId, { status: 'read' });
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, status: 'read' } : n
      ));
    } catch (e) {
      console.error('Failed to mark as read:', e);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => n.status === 'unread');
      await Promise.all(unread.map(n => 
        base44.entities.Notification.update(n.id, { status: 'read' })
      ));
      setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  };

  const dismissNotification = async (notificationId) => {
    try {
      await base44.entities.Notification.update(notificationId, { status: 'dismissed' });
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (e) {
      console.error('Failed to dismiss notification:', e);
    }
  };

  const getTitle = (notification) => language === 'he' ? notification.title_he : notification.title_en;
  const getMessage = (notification) => language === 'he' ? notification.message_he : notification.message_en;
  const getActionLabel = (notification) => language === 'he' ? notification.action_label_he : notification.action_label_en;

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-blue-500';
      default: return 'bg-slate-400';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'report_completed': return '✅';
      case 'report_failed': return '❌';
      case 'clarification_needed': return '❓';
      case 'report_processing': return '⏳';
      default: return '🔔';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        align={isRTL ? "start" : "end"} 
        className="w-80 p-0"
        sideOffset={8}
      >
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-sm">
            {language === 'he' ? 'התראות' : 'Notifications'}
          </h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-7">
              <Check className="w-3 h-3 me-1" />
              {language === 'he' ? 'סמן הכל כנקרא' : 'Mark all read'}
            </Button>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">
                {language === 'he' ? 'אין התראות חדשות' : 'No notifications'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors relative ${
                    notification.status === 'unread' ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                  }`}
                >
                  <div className={`absolute ${isRTL ? 'right-0' : 'left-0'} top-0 bottom-0 w-1 ${getPriorityColor(notification.priority)}`} />
                  
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{getTypeIcon(notification.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium text-sm truncate">
                          {getTitle(notification)}
                        </h4>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0 opacity-50 hover:opacity-100"
                          onClick={() => dismissNotification(notification.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {getMessage(notification)}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-slate-400">
                          {format(new Date(notification.created_date), 'dd/MM HH:mm')}
                        </span>
                        {notification.action_url && (
                          <Link
                            to={notification.action_url}
                            onClick={() => {
                              markAsRead(notification.id);
                              setOpen(false);
                            }}
                            className="text-xs text-[#114B5F] dark:text-[#42C0B9] hover:underline flex items-center gap-1"
                          >
                            {getActionLabel(notification) || (language === 'he' ? 'צפה' : 'View')}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}