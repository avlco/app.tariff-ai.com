import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './components/providers/LanguageContext';
import { NotificationProvider } from './components/providers/NotificationContext';
import { SidebarProvider, useSidebar } from './components/providers/SidebarContext';
import NotificationBell from './components/layout/NotificationBell';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import PolicyConsentModal from './components/auth/PolicyConsentModal';
import { Toaster } from "@/components/ui/sonner";
import { base44 } from '@/api/base44Client';
import { AnimatePresence } from 'framer-motion';
import { LEGAL_VERSION } from '@/components/legalConfig';

function LayoutContent({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const { isRTL, language } = useLanguage();
  const { isCollapsed } = useSidebar();

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      if (userData && userData.email) {
        const normalizedEmail = userData.email.toLowerCase();
        const records = await base44.entities.UserMasterData.filter({ user_email: normalizedEmail });
        const userRecord = records[0];

        // Consent Check Logic:
        // 1. No record exists (New User)
        // 2. Policy flag is false
        // 3. Versions do not match
        const needsConsent = 
            !userRecord || 
            !userRecord.policy_accepted || 
            String(userRecord.policy_version_accepted || userRecord.policy_version || '') !== String(LEGAL_VERSION);

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
    <div className={`min-h-screen bg-slate-50 dark:bg-[#0B1120] ${language === 'ja' ? 'font-japanese' : language === 'zh' ? 'font-chinese' : isRTL ? 'font-heebo' : 'font-sans'}`}>
      <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Heebo:wght@300;400;500;600;700&display=swap');
                    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+SC:wght@400;700&display=swap');

                    :root {
                      /* Brand Colors */
                      --brand-navy: #0F172A;
                      --brand-navy-light: #1E293B;
                      --brand-teal: #42C0B9;
                      --brand-teal-dark: #2DA39D;
                      --brand-gold: #E5A840;
                      --brand-gold-light: #F5C463;
                      
                      /* Surfaces */
                      --brand-surface: #1E293B;
                      --brand-surface-glass: rgba(30, 41, 59, 0.7);
                      --card-bg: rgba(30, 41, 59, 0.5);
                      
                      /* Borders */
                      --border-subtle: rgba(255, 255, 255, 0.08);
                      --border-navy: rgba(30, 41, 59, 0.3);
                      
                      /* Effects */
                      --glow-teal: 0 0 20px rgba(66, 192, 185, 0.25);
                      --glow-gold: 0 0 20px rgba(229, 168, 64, 0.25);
                      
                      /* Light Mode Foregrounds */
                      --foreground-primary: #0F172A;
                      --foreground-secondary: #334155;
                      --foreground-muted: #64748B;
                    }

                    .dark {
                      --background: 11 17 32;
                      --card: 30 41 59;
                      --card-foreground: 248 250 252;
                      --border: 30 41 59;
                      
                      /* Dark Mode Foregrounds */
                      --foreground-primary: #F8FAFC;
                      --foreground-secondary: #CBD5E1;
                      --foreground-muted: #94A3B8;
                    }

                    /* Global Typography */
                    h1, h2, h3, h4, h5, h6 {
                      font-family: 'Space Grotesk', system-ui, sans-serif;
                    }

                    .font-heading { font-family: 'Space Grotesk', system-ui, sans-serif; }
                    .font-heebo { font-family: 'Heebo', sans-serif; }
                    .font-sans { font-family: 'Inter', system-ui, sans-serif; }
                    .font-mono { font-family: 'IBM Plex Mono', monospace; }
                    .font-japanese { font-family: 'Noto Sans JP', sans-serif; }
                    .font-chinese { font-family: 'Noto Sans SC', sans-serif; }

                    .glass-panel {
                      background: var(--brand-surface-glass);
                      backdrop-filter: blur(20px);
                      -webkit-backdrop-filter: blur(20px);
                      border: 1px solid var(--border-subtle);
                    }

                    .glass-card {
                      background: rgba(30, 41, 59, 0.5);
                      backdrop-filter: blur(12px);
                      -webkit-backdrop-filter: blur(12px);
                      border: 1px solid var(--border-subtle);
                      transition: all 0.3s ease;
                    }

                    .glass-card:hover {
                      border-color: rgba(66, 192, 185, 0.3);
                    }

                    .btn-glow:hover {
                      box-shadow: var(--glow-teal);
                      transform: translateY(-1px);
                    }

                    /* Gold Button Variant */
                    .btn-gold {
                      background: linear-gradient(135deg, #E5A840 0%, #F5C463 100%);
                      color: #0F172A;
                      font-weight: 600;
                      border-radius: 9999px;
                      transition: all 0.3s ease;
                    }

                    .btn-gold:hover {
                      box-shadow: 0 0 25px rgba(229, 168, 64, 0.4);
                      transform: translateY(-1px);
                    }

                    /* Fintech Table Styles */
                    .fintech-table {
                      background: transparent;
                    }

                    .fintech-table th {
                      font-family: 'Inter', system-ui, sans-serif;
                      font-weight: 500;
                      font-size: 0.75rem;
                      text-transform: uppercase;
                      letter-spacing: 0.05em;
                      color: #64748b;
                    }

                    .fintech-table td {
                      border-bottom: 1px solid var(--border-navy);
                    }

                    .fintech-table .mono-value {
                      font-family: 'IBM Plex Mono', monospace;
                      color: var(--brand-teal);
                    }

                    /* Force rounded-full on primary buttons */
                    .btn-primary {
                      border-radius: 9999px !important;
                    }
                  `}</style>
      
      {/* key={language} מכריח יצירה מחדש של הרכיב בשינוי שפה - קריטי למיקום */}
      <Toaster 
        key={language}
        position={isRTL ? 'top-left' : 'top-right'} 
        dir={isRTL ? 'rtl' : 'ltr'} 
        richColors 
        closeButton
      /> 

      <Sidebar currentPage={currentPageName} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className={`${isRTL ? (isCollapsed ? 'lg:mr-[72px]' : 'lg:mr-64') : (isCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64')} min-h-screen flex flex-col transition-all duration-300`}>
        <Header user={user} onMenuClick={() => setSidebarOpen(true)} notificationBell={<NotificationBell />} />
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
      <NotificationProvider>
        <SidebarProvider>
          <LayoutContent currentPageName={currentPageName}>
            {children}
          </LayoutContent>
        </SidebarProvider>
      </NotificationProvider>
    </LanguageProvider>
  );
}