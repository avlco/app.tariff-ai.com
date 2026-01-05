import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import he from '@/components/locales/he';
import en from '@/components/locales/en';
import { LANGUAGES, DEFAULT_SYSTEM_LANGUAGE, DEFAULT_REPORT_LANGUAGE } from '@/components/constants/languages';

const translations = { he, en };

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(DEFAULT_SYSTEM_LANGUAGE); // System Language
  const [reportLanguage, setReportLanguage] = useState(DEFAULT_REPORT_LANGUAGE); // Default Report Language
  const [theme, setTheme] = useState('light');
  
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const user = await base44.auth.me();
        if (user) {
          const userData = await base44.entities.UserMasterData.filter({ user_email: user.email });
          if (userData && userData[0]) {
             if (userData[0].preferred_language) setLanguage(userData[0].preferred_language);
             if (userData[0].default_report_language) setReportLanguage(userData[0].default_report_language);
             if (userData[0].theme) setTheme(userData[0].theme);
          }
        }
      } catch (e) {
        console.error("Failed to load language preferences", e);
      }
    };
    loadPreferences();
  }, []);
  
  // Handle System Language & Direction
  useEffect(() => {
    const langConfig = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];
    document.documentElement.dir = langConfig.dir;
    document.documentElement.lang = language;
  }, [language]);
  
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  
  const t = (key) => {
    const dict = translations[language] || translations[DEFAULT_SYSTEM_LANGUAGE];
    return dict[key] || key;
  };

  // Helper to get direction for specific language code (useful for reports)
  const getDirForLang = (langCode) => {
      const langConfig = LANGUAGES.find(l => l.code === langCode);
      return langConfig ? langConfig.dir : 'ltr';
  };
  
  const isRTL = language === 'he';
  
  return (
    <LanguageContext.Provider value={{ 
        language, 
        setLanguage, 
        reportLanguage, 
        setReportLanguage, 
        theme, 
        setTheme, 
        t, 
        isRTL,
        getDirForLang
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);