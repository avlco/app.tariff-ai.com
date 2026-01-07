import React from 'react';
import { useLanguage } from '../providers/LanguageContext';
import { useSidebar } from '../providers/SidebarContext';
import { Menu, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Header({ user, onMenuClick, notificationBell }) {
  const { t, isRTL } = useLanguage();
  const { isCollapsed, toggleCollapse } = useSidebar();
  
  return (
    <header className="sticky top-0 z-40 h-14 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-[#1E293B]/50 px-4 lg:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06]"
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* Desktop Sidebar Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapse}
          className="hidden lg:flex h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-slate-400"
        >
          {isCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </Button>
        
        <div className="hidden sm:block">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('welcomeBack')}, <span className="font-semibold text-slate-900 dark:text-white">{user?.full_name?.split(' ')[0] || 'User'}</span>
          </h2>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {notificationBell}
      </div>
    </header>
  );
}