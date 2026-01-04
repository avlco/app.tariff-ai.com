import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications } from '../providers/NotificationContext';
import { useLanguage } from '../providers/LanguageContext';
import NotificationPanel from './NotificationPanel';

export default function NotificationBell() {
    const { unreadCount } = useNotifications();
    const { isRTL } = useLanguage();
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="relative h-9 w-9 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent 
                className="w-96 p-0" 
                align={isRTL ? "start" : "end"}
                sideOffset={8}
            >
                <NotificationPanel onClose={() => setOpen(false)} />
            </PopoverContent>
        </Popover>
    );
}