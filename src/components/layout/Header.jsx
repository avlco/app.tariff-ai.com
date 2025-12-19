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

export default function Header({ user, onMenuClick }) {
  const { t, isRTL, language } = useLanguage();
  
  return (
    <header className="sticky top-0 z-40 h-14 bg-white dark:bg-[#1A1F2E] border-b border-slate-200 dark:border-slate-800/50 px-4 lg:px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden h-9 w-9"
        >
          <Menu className="w-5 h-5" />
        </Button>
        
        <div>
          <h2 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            {t('welcomeBack')}, {user?.full_name?.split(' ')[0] || 'User'}
          </h2>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute top-1.5 end-1.5 w-1.5 h-1.5 bg-[#D89C42] rounded-full ring-2 ring-white dark:ring-[#1A1F2E]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-80">
            <div className="p-4">
              <h3 className="font-semibold text-sm text-[#0F172A] dark:text-[#F8FAFC] mb-3">
                {language === 'he' ? 'התראות' : 'Notifications'}
              </h3>
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {language === 'he' ? 'אין התראות חדשות' : 'No new notifications'}
                  </p>
                </div>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#114B5F] to-[#42C0B9] flex items-center justify-center text-white text-xs font-bold shadow-sm">
          {user?.full_name?.charAt(0) || 'U'}
        </div>
      </div>
    </header>
  );
}