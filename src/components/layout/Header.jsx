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
  const { t, isRTL } = useLanguage();
  
  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 lg:px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </Button>
        
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('welcomeBack')}, {user?.full_name?.split(' ')[0] || 'User'}
          </h2>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              <span className="absolute top-1 end-1 w-2 h-2 bg-[#D89C42] rounded-full" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-72">
            <DropdownMenuItem className="py-3">
              <div className="flex flex-col gap-1">
                <span className="font-medium">{language === 'he' ? 'דוח הושלם' : 'Report Completed'}</span>
                <span className="text-sm text-slate-500">Standard Smartwatch - HS: 9102.19.20</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#42C0B9] to-[#114B5F] flex items-center justify-center text-white font-semibold">
          {user?.full_name?.charAt(0) || 'U'}
        </div>
      </div>
    </header>
  );
}