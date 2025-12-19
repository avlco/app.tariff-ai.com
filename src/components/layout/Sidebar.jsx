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
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function Sidebar({ currentPage, isOpen, onClose }) {
  const { t, language, setLanguage, theme, setTheme, isRTL } = useLanguage();
  
  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { name: 'NewReport', icon: FilePlus, label: t('newReport') },
    { name: 'Reports', icon: FileText, label: t('reports') },
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
        bg-[#114B5F] text-white z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/user_680e05f48b22dd123802c416/0096d91fe_tarifficon.png"
                  alt="Logo"
                  className="w-10 h-10 object-contain"
                />
                <span className="text-xl font-bold">TariffAI</span>
              </div>
              <button onClick={onClose} className="lg:hidden p-1 hover:bg-white/10 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.name;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.name)}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                    ${isActive 
                      ? 'bg-[#42C0B9] text-white shadow-lg shadow-[#42C0B9]/30' 
                      : 'hover:bg-white/10 text-white/80 hover:text-white'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          
          {/* Bottom controls */}
          <div className="p-4 border-t border-white/10 space-y-3">
            {/* Language & Theme */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLanguage(language === 'he' ? 'en' : 'he')}
                className="flex-1 text-white/80 hover:text-white hover:bg-white/10"
              >
                <Globe className="w-4 h-4 me-2" />
                {language === 'he' ? 'EN' : 'עב'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="flex-1 text-white/80 hover:text-white hover:bg-white/10"
              >
                {theme === 'light' ? <Moon className="w-4 h-4 me-2" /> : <Sun className="w-4 h-4 me-2" />}
                {theme === 'light' ? t('dark') : t('light')}
              </Button>
            </div>
            
            {/* Logout */}
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10"
            >
              <LogOut className="w-5 h-5 me-3" />
              {t('logout')}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}