import React from 'react';
import { useLanguage } from '../providers/LanguageContext';
import { Menu, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Header({ user, onMenuClick, notificationBell }) {
  const { t, isRTL, language } = useLanguage();
  
  return (
    <header className="sticky top-0 z-40 h-14 bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.08] px-4 lg:px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06]"
        >
          <Menu className="w-5 h-5" />
        </Button>
        
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t('welcomeBack')}, <span className="text-[#42C0B9]">{user?.full_name?.split(' ')[0] || 'User'}</span>
          </h2>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {notificationBell}
      </div>
    </header>
  );
}