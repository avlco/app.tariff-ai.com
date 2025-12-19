import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './components/providers/LanguageContext';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import { base44 } from '@/api/base44Client';

function LayoutContent({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const { isRTL } = useLanguage();
  
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {}
    };
    loadUser();
  }, []);
  
  return (
    <div className={`min-h-screen bg-[#FAFBFC] dark:bg-[#0B1120] ${isRTL ? 'font-heebo' : 'font-sans'}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700;800&display=swap');

        :root {
          --primary-navy: #114B5F;
          --primary-teal: #42C0B9;
          --primary-gold: #D89C42;
        }

        .font-heebo {
          font-family: 'Heebo', sans-serif;
        }

        .font-sans {
          font-family: 'Inter', sans-serif;
        }

        .dark {
          color-scheme: dark;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: #D1D5DB;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #9CA3AF;
        }

        .dark ::-webkit-scrollbar-thumb {
          background: #374151;
        }

        .dark ::-webkit-scrollbar-thumb:hover {
          background: #4B5563;
        }
      `}</style>
      
      <Sidebar 
        currentPage={currentPageName} 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <div className={`${isRTL ? 'lg:mr-64' : 'lg:ml-64'} min-h-screen flex flex-col`}>
        <Header user={user} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <LanguageProvider>
      <LayoutContent currentPageName={currentPageName}>
        {children}
      </LayoutContent>
    </LanguageProvider>
  );
}