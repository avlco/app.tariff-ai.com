import React, { createContext, useContext, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
    const queryClient = useQueryClient();

    // Fetch notifications with React Query - every 30 seconds
    const { data: notifications = [], isLoading, refetch } = useQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
            try {
                const user = await base44.auth.me();
                if (!user) return [];
                
                // Fetch notifications that are not dismissed
                // Note: Filtering expired/dismissed here, but ideally API should filter.
                // Since we can't easily do complex date filtering in list() sometimes, we filter in client.
                const allNotifications = await base44.entities.Notification.list('-created_date');
                
                const now = new Date();
                return allNotifications.filter(n => {
                    // Filter dismissed
                    if (n.status === 'dismissed') return false;
                    // Filter expired
                    if (n.expires_at && new Date(n.expires_at) < now) return false;
                    return true;
                });
            } catch (error) {
                console.error('Error fetching notifications:', error);
                return [];
            }
        },
        refetchInterval: 30000, // Every 30 seconds
        staleTime: 10000, // 10 seconds cache
        retry: 1
    });

    // Count unread
    const unreadCount = notifications.filter(n => n.status === 'unread').length;

    // Mark as read
    const markAsRead = useCallback(async (notificationId) => {
        try {
            // Optimistic update could be done here, but invalidating is safer
            await base44.entities.Notification.update(notificationId, { status: 'read' });
            queryClient.invalidateQueries(['notifications']);
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }, [queryClient]);

    // Mark all as read
    const markAllAsRead = useCallback(async () => {
        try {
            const unreadNotifications = notifications.filter(n => n.status === 'unread');
            if (unreadNotifications.length === 0) return;
            
            await Promise.all(
                unreadNotifications.map(n => 
                    base44.entities.Notification.update(n.id, { status: 'read' })
                )
            );
            queryClient.invalidateQueries(['notifications']);
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    }, [notifications, queryClient]);

    // Dismiss notification
    const dismissNotification = useCallback(async (notificationId) => {
        try {
            await base44.entities.Notification.update(notificationId, { status: 'dismissed' });
            queryClient.invalidateQueries(['notifications']);
        } catch (error) {
            console.error('Error dismissing notification:', error);
        }
    }, [queryClient]);

    const value = {
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        dismissNotification,
        refetch
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within NotificationProvider');
    }
    return context;
}