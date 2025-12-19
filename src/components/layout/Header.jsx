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
      </div>
    </header>
  );
}