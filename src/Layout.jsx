import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './components/providers/LanguageContext';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import PolicyConsentModal from './components/auth/PolicyConsentModal';
import ReportReadyNotification from './components/classification/ReportReadyNotification';
import { Toaster } from "@/components/ui/sonner";
import { base44 } from '@/api/base44Client';
import { AnimatePresence } from 'framer-motion';

function LayoutContent({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const { isRTL } = useLanguage();

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      if (userData) {
        const masterData = await base44.entities.UserMasterData.filter({ user_email: userData.email });
        if (masterData.length === 0 || !masterData[0].policy_accepted) {
            setShowConsentModal(true);
        }
      }
    } catch (e) {
      setShowConsentModal(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);
  
  return (
    <div className={`min-h-screen bg-[#FAFBFC] dark:bg-[#0B1120] ${isRTL ? 'font-heebo' : 'font-sans'}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700;800&display=swap');
        :root { --primary-navy: #114B5F; --primary-teal: #42C0B9; --primary-gold: #D89C42; }
        .font-heebo { font-family: 'Heebo', sans-serif; }
        .font-sans { font-family: 'Inter', sans-serif; }
      `}</style>
      
      {/* Centralized Notification Hub */}
      <ReportReadyNotification /> 
      <Toaster position="top-center" />

      <Sidebar currentPage={currentPageName} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className={`${isRTL ? 'lg:mr-64' : 'lg:ml-64'} min-h-screen flex flex-col`}>
        <Header user={user} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>

      <AnimatePresence>
        {showConsentModal && user && (
            <PolicyConsentModal user={user} onAccept={() => setShowConsentModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <LanguageProvider>
      <LayoutContent currentPageName={currentPageName}>{children}</LayoutContent>
    </LanguageProvider>
  );
}