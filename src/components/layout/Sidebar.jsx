import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLanguage } from '../providers/LanguageContext';
import { 
  LayoutDashboard, 
  FilePlus, 
  FileText, 
  Headphones, 
  User,
  LogOut,
  Sun,
  Moon,
  Globe,
  X,
  Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function Sidebar({ currentPage, isOpen, onClose }) {
  const { t, language, setLanguage, theme, setTheme, isRTL } = useLanguage();
  
  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { name: 'Shipments', icon: Package, label: t('shipments') },
    { name: 'Reports', icon: FileText, label: t('reports') },
    { name: 'Customers', icon: User, label: t('customers') },
    { name: 'Support', icon: Headphones, label: t('support') },
    { name: 'Profile', icon: User, label: t('profile') },
  ];
  
  const handleLogout = () => {
    base44.auth.logout();
  };
  
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`
        fixed top-0 ${isRTL ? 'right-0' : 'left-0'} h-full w-64 
        bg-white dark:bg-[#0F172A] border-e border-slate-200/80 dark:border-white/[0.08] z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'}
        lg:translate-x-0 shadow-xl lg:shadow-none
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="px-5 py-5 border-b border-slate-200/80 dark:border-white/[0.08]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6944f7300c31b18399592a2a/5dcc21307_tariffailogo.png"
                  alt="TariffAI"
                  className="h-8 w-auto object-contain"
                />
                <span className="font-heading font-semibold text-lg text-slate-900 dark:text-white tracking-tight">
                  TariffAI
                </span>
              </div>
              <button onClick={onClose} className="lg:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.name;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.name)}
                  onClick={onClose}
                  className={`
                    relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm
                    ${isActive 
                      ? 'bg-gradient-to-r from-[#42C0B9]/15 to-[#42C0B9]/5 text-[#42C0B9] font-semibold' 
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] font-medium'
                    }
                  `}
                >
                  {isActive && (
                    <span className={`absolute ${isRTL ? 'right-0' : 'left-0'} top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-[#42C0B9] to-[#E5A840] rounded-full`} />
                  )}
                  <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-[#42C0B9]' : ''}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          
          {/* Bottom controls */}
          <div className="px-3 py-4 border-t border-slate-200/80 dark:border-white/[0.08] space-y-2">
            {/* Language & Theme */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLanguage(language === 'he' ? 'en' : 'he')}
                className="flex-1 h-9 text-xs font-semibold rounded-xl border-slate-200 dark:border-white/[0.1] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
              >
                <Globe className="w-3.5 h-3.5 me-1.5" />
                {language === 'he' ? 'EN' : 'עב'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="flex-1 h-9 rounded-xl border-slate-200 dark:border-white/[0.1] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
              >
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </Button>
            </div>
            
            {/* Logout */}
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-500/10 dark:hover:bg-red-500/10 h-9 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4 me-2" />
              {t('logout')}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}