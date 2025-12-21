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
    { name: 'NewReport', icon: FilePlus, label: t('newReport') },
    { name: 'Reports', icon: FileText, label: t('reports') },
    { name: 'Customers', icon: User, label: isRTL ? 'לקוחות' : 'Customers' },
    { name: 'Shipments', icon: Package, label: isRTL ? 'משלוחים' : 'Shipments' },
    { name: 'NewShipmentAI', icon: Package, label: isRTL ? '✨ משלוח AI' : '✨ AI Shipment', highlight: true },
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
        bg-white dark:bg-[#1A1F2E] border-e border-slate-200 dark:border-slate-800/50 z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'}
        lg:translate-x-0 shadow-xl lg:shadow-none
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6944f7300c31b18399592a2a/5dcc21307_tariffailogo.png"
                  alt="TariffAI"
                  className="h-9 w-auto object-contain"
                />
              </div>
              <button onClick={onClose} className="lg:hidden p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-[#475569] dark:text-[#94A3B8]" />
              </button>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.name;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.name)}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm
                    ${isActive 
                      ? 'bg-gradient-to-r from-[#114B5F]/10 to-[#42C0B9]/10 text-[#114B5F] dark:text-[#42C0B9] font-semibold border border-[#42C0B9]/20' 
                      : item.highlight
                      ? 'text-[#42C0B9] dark:text-[#42C0B9] hover:bg-gradient-to-r hover:from-[#114B5F]/5 hover:to-[#42C0B9]/5 font-semibold'
                      : 'text-[#475569] dark:text-[#CBD5E1] hover:bg-slate-50 dark:hover:bg-slate-800/50 font-medium'
                    }
                  `}
                >
                  <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          
          {/* Bottom controls */}
          <div className="px-3 py-4 border-t border-slate-200 dark:border-slate-800/50 space-y-2">
            {/* Language & Theme */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLanguage(language === 'he' ? 'en' : 'he')}
                className="flex-1 h-9 text-xs font-semibold"
              >
                <Globe className="w-3.5 h-3.5 me-1.5" />
                {language === 'he' ? 'EN' : 'עב'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="flex-1 h-9"
              >
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </Button>
            </div>
            
            {/* Logout */}
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 h-9"
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