import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './components/providers/LanguageContext';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import PolicyConsentModal from './components/auth/PolicyConsentModal';
import ReportReadyNotification from './components/classification/ReportReadyNotification';
import { Toaster } from "@/components/ui/sonner";
import { base44 } from '@/api/base44Client';
import { AnimatePresence } from 'framer-motion';
// import { LEGAL_VERSION } from '@/components/legalConfig'; // Deprecated

function LayoutContent({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [policyContent, setPolicyContent] = useState(null);
  const [isReacceptance, setIsReacceptance] = useState(false);
  const { isRTL, language } = useLanguage();

  const loadUser = async () => {
    try {
      // 1. Fetch User
      const userData = await base44.auth.me();
      setUser(userData);

      if (userData && userData.email) {
        const normalizedEmail = userData.email.toLowerCase();
        
        // 2. Parallel Fetch: User Record & Latest Policy
        const [userRecords, policyResponse] = await Promise.all([
            base44.entities.UserMasterData.filter({ user_email: normalizedEmail }),
            base44.functions.invoke('getLatestLegalDocument')
        ]);
        
        const userRecord = userRecords[0];
        const activePolicy = policyResponse?.data;

        if (!activePolicy) return; // No policy active? Skip consent logic (or handle error)

        // 3. Compare Versions
        const userAcceptedVersion = userRecord?.policy_version;
        const currentVersion = activePolicy.version_number;

        const needsConsent = 
            !userRecord || 
            !userRecord.policy_accepted || 
            userAcceptedVersion !== currentVersion;

        if (needsConsent) {
            // Check if content exists before showing modal to avoid empty modal
            const hasContent = activePolicy.terms_content && activePolicy.privacy_content;
            
            if (hasContent) {
                setPolicyContent(activePolicy);
                // If they accepted SOME version before, but it's different now -> Reacceptance
                setIsReacceptance(!!(userRecord?.policy_accepted && userAcceptedVersion && userAcceptedVersion !== currentVersion));
                setShowConsentModal(true);
            }
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
      
      {/* key={language} מכריח יצירה מחדש של הרכיב בשינוי שפה - קריטי למיקום */}
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
        {showConsentModal && user && policyContent && (
            <PolicyConsentModal 
                user={user} 
                onAccept={handlePolicyAccepted} 
                policyContent={policyContent}
                isReacceptance={isReacceptance}
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