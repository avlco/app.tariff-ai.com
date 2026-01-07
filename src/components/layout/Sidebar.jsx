import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLanguage } from '../providers/LanguageContext';
import { useSidebar } from '../providers/SidebarContext';
import { 
  LayoutDashboard, 
  FileText, 
  Headphones, 
  User,
  LogOut,
  Sun,
  Moon,
  X,
  Package,
  ChevronLeft,
  ChevronRight,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { base44 } from '@/api/base44Client';

export default function Sidebar({ currentPage, isOpen, onClose }) {
  const { t, language, theme, setTheme, isRTL } = useLanguage();
  const { isCollapsed, toggleCollapse } = useSidebar();
  
  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { name: 'Shipments', icon: Package, label: t('shipments') },
    { name: 'Reports', icon: FileText, label: t('reports') },
    { name: 'Customers', icon: User, label: t('customers') },
    { name: 'Support', icon: Headphones, label: t('support') },
  ];

  const bottomItems = [
    { name: 'Profile', icon: Settings, label: t('profile') },
  ];
  
  const handleLogout = () => {
    base44.auth.logout();
  };
  
  const NavItem = ({ item, isActive }) => {
    const Icon = item.icon;
    const content = (
      <Link
        to={createPageUrl(item.name)}
        onClick={onClose}
        className={`
          relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm
          ${isActive 
            ? 'bg-gradient-to-r from-[#42C0B9]/15 to-[#42C0B9]/5 text-[#42C0B9] font-semibold' 
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] font-medium'
          }
          ${isCollapsed && !isOpen ? 'justify-center px-2' : ''}
        `}
      >
        {isActive && !isCollapsed && (
          <span className={`absolute ${isRTL ? 'right-0' : 'left-0'} top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-[#42C0B9] to-[#E5A840] rounded-full`} />
        )}
        <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-[#42C0B9]' : ''}`} />
        {(!isCollapsed || isOpen) && <span>{item.label}</span>}
      </Link>
    );

    if (isCollapsed && !isOpen) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side={isRTL ? 'left' : 'right'} className="bg-[#0F172A] text-white border-white/10">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }
    return content;
  };

  return (
    <TooltipProvider>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`
        fixed top-0 ${isRTL ? 'right-0' : 'left-0'} h-full
        ${isCollapsed && !isOpen ? 'w-[72px]' : 'w-64'}
        bg-[#0F172A] border-e border-[#1E293B]/50 z-50
        transform transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'}
        lg:translate-x-0 shadow-2xl lg:shadow-none
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={`px-4 py-5 border-b border-[#1E293B]/50 ${isCollapsed && !isOpen ? 'px-3' : ''}`}>
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-3 ${isCollapsed && !isOpen ? 'justify-center w-full' : ''}`}>
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6944f7300c31b18399592a2a/5dcc21307_tariffailogo.png"
                  alt="TariffAI"
                  className="h-8 w-8 object-contain"
                />
                {(!isCollapsed || isOpen) && (
                  <span className="font-heading font-semibold text-lg text-white tracking-tight">
                    TariffAI
                  </span>
                )}
              </div>
              <button onClick={onClose} className="lg:hidden p-1.5 hover:bg-white/[0.06] rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className={`flex-1 px-3 py-4 space-y-1 overflow-y-auto ${isCollapsed && !isOpen ? 'px-2' : ''}`}>
            {menuItems.map((item) => (
              <NavItem key={item.name} item={item} isActive={currentPage === item.name} />
            ))}
          </nav>
          
          {/* Bottom controls */}
          <div className={`px-3 py-4 border-t border-[#1E293B]/50 space-y-2 ${isCollapsed && !isOpen ? 'px-2' : ''}`}>
            {/* Settings/Profile Link */}
            {bottomItems.map((item) => (
              <NavItem key={item.name} item={item} isActive={currentPage === item.name} />
            ))}

            {/* Theme Toggle */}
            {isCollapsed && !isOpen ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                    className="w-full h-10 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    {theme === 'light' ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={isRTL ? 'left' : 'right'} className="bg-[#0F172A] text-white border-white/10">
                  {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="w-full justify-start h-10 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                {theme === 'light' ? <Moon className="w-[18px] h-[18px] me-3" /> : <Sun className="w-[18px] h-[18px] me-3" />}
                {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
              </Button>
            )}
            
            {/* Logout */}
            {isCollapsed && !isOpen ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="w-full h-10 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-[18px] h-[18px]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={isRTL ? 'left' : 'right'} className="bg-[#0F172A] text-white border-white/10">
                  {t('logout')}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full justify-start text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 h-10 rounded-xl transition-colors"
              >
                <LogOut className="w-[18px] h-[18px] me-3" />
                {t('logout')}
              </Button>
            )}
          </div>

          {/* Collapse Toggle - Desktop Only */}
          <div className="hidden lg:block px-3 py-3 border-t border-[#1E293B]/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapse}
              className={`w-full h-9 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors ${isCollapsed ? 'justify-center' : 'justify-between'}`}
            >
              {!isCollapsed && <span className="text-xs">Collapse</span>}
              {isRTL ? (
                isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
              ) : (
                isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}