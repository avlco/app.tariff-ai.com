import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../providers/NotificationContext';
import { useLanguage } from '../providers/LanguageContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    CheckCircle, 
    AlertCircle, 
    AlertTriangle, 
    Info,
    Check,
    X,
    Bell
} from 'lucide-react';
import { format } from 'date-fns';

const typeIcons = {
    report_completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
    report_failed: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
    clarification_needed: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    report_processing: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    system: { icon: Bell, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800' }
};

export default function NotificationPanel({ onClose }) {
    const navigate = useNavigate();
    const { notifications, unreadCount, markAsRead, markAllAsRead, dismissNotification, isLoading } = useNotifications();
    const { t, language, isRTL } = useLanguage();

    const handleNotificationClick = async (notification) => {
        // Mark as read
        if (notification.status === 'unread') {
            await markAsRead(notification.id);
        }
        
        // Navigate
        if (notification.action_url) {
            navigate(notification.action_url);
            onClose?.();
        }
    };

    const handleDismiss = async (e, notificationId) => {
        e.stopPropagation();
        await dismissNotification(notificationId);
    };

    if (isLoading) {
        return (
            <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin mx-auto" />
            </div>
        );
    }

    return (
        <div className={`flex flex-col max-h-[480px] ${isRTL ? 'rtl' : 'ltr'}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                    {t('notifications')}
                </h3>
                {unreadCount > 0 && (
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={markAllAsRead}
                        className="text-xs text-[#42C0B9] hover:text-[#42C0B9]/80"
                    >
                        <Check className="w-3 h-3 me-1" />
                        {t('markAllAsRead')}
                    </Button>
                )}
            </div>

            {/* Notifications List */}
            <ScrollArea className="flex-1">
                {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                        <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t('noNotifications')}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {notifications.map((notification) => {
                            const typeConfig = typeIcons[notification.type] || typeIcons.system;
                            const Icon = typeConfig.icon;
                            const isUnread = notification.status === 'unread';
                            
                            return (
                                <div
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className={`p-4 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isUnread ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                >
                                    <div className="flex gap-3">
                                        <div className={`flex-shrink-0 w-10 h-10 rounded-full ${typeConfig.bg} flex items-center justify-center`}>
                                            <Icon className={`w-5 h-5 ${typeConfig.color}`} />
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={`text-sm ${isUnread ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                                                    {language === 'he' ? notification.title_he : notification.title_en}
                                                </p>
                                                <button
                                                    onClick={(e) => handleDismiss(e, notification.id)}
                                                    className="flex-shrink-0 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                                                >
                                                    <X className="w-3 h-3 text-slate-400" />
                                                </button>
                                            </div>
                                            
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                                                {language === 'he' ? notification.message_he : notification.message_en}
                                            </p>
                                            
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-xs text-slate-400">
                                                    {format(new Date(notification.created_date), 'dd/MM HH:mm')}
                                                </span>
                                                
                                                {notification.action_url && (
                                                    <span className="text-xs font-medium text-[#42C0B9]">
                                                        {language === 'he' ? (notification.action_label_he || t('viewNotification')) : (notification.action_label_en || t('viewNotification'))}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}