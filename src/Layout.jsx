import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './components/providers/LanguageContext';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import PolicyConsentModal from './components/auth/PolicyConsentModal';
import ReportReadyNotification from './components/classification/ReportReadyNotification';
import { Toaster } from "@/components/ui/sonner";
import { base44 } from '@/api/base44Client';
import { AnimatePresence } from 'framer-motion';
import { LEGAL_VERSION } from '@/components/legalConfig';

function LayoutContent({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const { isRTL, language } = useLanguage();

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      if (userData && userData.email) {
        const normalizedEmail = userData.email.toLowerCase();
        const records = await base44.entities.UserMasterData.filter({ user_email: normalizedEmail });
        const userRecord = records[0];

        const needsConsent = 
            !userRecord || 
            !userRecord.policy_accepted || 
            userRecord.policy_version !== LEGAL_VERSION;

        if (needsConsent) {
            setShowConsentModal(true);
        }
      }
    } catch (e) {
      console.error("Auth check failed", e);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);
  
  const handlePolicyAccepted = () => {
      setShowConsentModal(false);
  };
  
  return (
    <div className={`min-h-screen bg-[#FAFBFC] dark:bg-[#0B1120] ${isRTL ? 'font-heebo' : 'font-sans'}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700;800&display=swap');
        :root { --primary-navy: #114B5F; --primary-teal: #42C0B9; --primary-gold: #D89C42; }
        .font-heebo { font-family: 'Heebo', sans-serif; }
        .font-sans { font-family: 'Inter', sans-serif; }
      `}</style>
      
      {/* הוספת key={language} מכריחה את הרכיב להתמקם מחדש בעת החלפת שפה */}
      <Toaster 
        key={language}
        position={isRTL ? 'bottom-left' : 'bottom-right'} 
        dir={isRTL ? 'rtl' : 'ltr'} 
        richColors 
        closeButton
      />

      <ReportReadyNotification /> 

      <Sidebar currentPage={currentPageName} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className={`${isRTL ? 'lg:mr-64' : 'lg:ml-64'} min-h-screen flex flex-col transition-all duration-300`}>
        <Header user={user} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>

      <AnimatePresence>
        {showConsentModal && user && (
            <PolicyConsentModal 
                user={user} 
                onAccept={handlePolicyAccepted} 
                requiredVersion={LEGAL_VERSION} 
            />
        )}
      </AnimatePresence>
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
