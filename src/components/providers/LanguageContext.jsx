import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const translations = {
  he: {
    // Navigation
    dashboard: 'דשבורד',
    newReport: 'דוח חדש',
    reports: 'דוחות',
    support: 'תמיכה',
    profile: 'פרופיל',
    logout: 'התנתק',
    
    // Dashboard
    welcomeBack: 'שלום',
    reportsThisMonth: 'דוחות החודש',
    reportsUsed: 'דוחות בשימוש',
    reportsRemaining: 'דוחות נותרו',
    recentReports: 'דוחות אחרונים',
    viewAll: 'הצג הכל',
    createNewReport: 'צור דוח חדש',
    upgradeNow: 'שדרג עכשיו',
    
    // Report Creation
    describeProduct: 'תאר את המוצר שלך',
    uploadFiles: 'העלה קבצים',
    productName: 'שם המוצר',
    countryOfManufacture: 'מדינת ייצור',
    countryOfOrigin: 'מדינת מוצא',
    destinationCountry: 'מדינת יעד',
    generateReport: 'צור דוח',
    generating: 'מייצר דוח...',
    
    // Report Details
    reportDetails: 'פרטי הדוח',
    hsCode: 'קוד HS',
    confidenceScore: 'ציון ביטחון',
    classificationReasoning: 'נימוק הסיווג',
    productCharacteristics: 'מאפייני המוצר',
    tariffRate: 'מידע על מכסים',
    importRequirements: 'דרישות יבוא',
    officialSources: 'מקורות רשמיים',
    alternativeClassifications: 'סיווגים חלופיים',
    tradeDetails: 'פרטי סחר',
    
    // Support
    contactSupport: 'צור קשר',
    subject: 'נושא',
    category: 'קטגוריה',
    message: 'הודעה',
    submit: 'שלח',
    billing: 'חיוב',
    technical: 'טכני',
    classification: 'סיווג',
    account: 'חשבון',
    other: 'אחר',
    
    // Profile
    personalInfo: 'מידע אישי',
    companyName: 'שם החברה',
    email: 'אימייל',
    phone: 'טלפון',
    subscription: 'מנוי',
    currentPlan: 'תוכנית נוכחית',
    preferences: 'העדפות',
    language: 'שפה',
    theme: 'ערכת נושא',
    light: 'בהיר',
    dark: 'כהה',
    save: 'שמור',
    
    // Plans
    free: 'חינם',
    payPerUse: 'לפי שימוש',
    basic: 'בסיסי',
    pro: 'מקצועי',
    agency: 'סוכנות',
    enterprise: 'ארגוני',
    reportsPerMonth: 'דוחות בחודש',
    perReport: 'לדוח',
    perMonth: 'לחודש',
    contactUs: 'צור קשר',
    
    // Status
    pending: 'ממתין',
    completed: 'הושלם',
    failed: 'נכשל',
    open: 'פתוח',
    inProgress: 'בטיפול',
    resolved: 'נפתר',
    closed: 'סגור',
    
    // Common
    loading: 'טוען...',
    error: 'שגיאה',
    success: 'הצלחה',
    cancel: 'ביטול',
    delete: 'מחק',
    edit: 'ערוך',
    view: 'צפה',
    download: 'הורד',
    search: 'חיפוש',
    noResults: 'אין תוצאות',
    
    // Disclaimer
    disclaimer: 'דוח זה נוצר באמצעות AI ואינו מהווה ייעוץ משפטי או מכסי רשמי. יש לאמת את המידע מול רשויות המכס הרשמיות.'
  },
  en: {
    // Navigation
    dashboard: 'Dashboard',
    newReport: 'New Report',
    reports: 'Reports',
    support: 'Support',
    profile: 'Profile',
    logout: 'Logout',
    
    // Dashboard
    welcomeBack: 'Welcome back',
    reportsThisMonth: 'Reports This Month',
    reportsUsed: 'Reports Used',
    reportsRemaining: 'Reports Remaining',
    recentReports: 'Recent Reports',
    viewAll: 'View All',
    createNewReport: 'Create New Report',
    upgradeNow: 'Upgrade Now',
    
    // Report Creation
    describeProduct: 'Describe your product',
    uploadFiles: 'Upload Files',
    productName: 'Product Name',
    countryOfManufacture: 'Country of Manufacture',
    countryOfOrigin: 'Country of Origin',
    destinationCountry: 'Destination Country',
    generateReport: 'Generate Report',
    generating: 'Generating report...',
    
    // Report Details
    reportDetails: 'Report Details',
    hsCode: 'HS Code',
    confidenceScore: 'Confidence Score',
    classificationReasoning: 'Classification Reasoning',
    productCharacteristics: 'Product Characteristics',
    tariffRate: 'Tariff Rate',
    importRequirements: 'Import Requirements',
    officialSources: 'Official Sources',
    alternativeClassifications: 'Alternative Classifications',
    tradeDetails: 'Trade Details',
    
    // Support
    contactSupport: 'Contact Support',
    subject: 'Subject',
    category: 'Category',
    message: 'Message',
    submit: 'Submit',
    billing: 'Billing',
    technical: 'Technical',
    classification: 'Classification',
    account: 'Account',
    other: 'Other',
    
    // Profile
    personalInfo: 'Personal Information',
    companyName: 'Company Name',
    email: 'Email',
    phone: 'Phone',
    subscription: 'Subscription',
    currentPlan: 'Current Plan',
    preferences: 'Preferences',
    language: 'Language',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    save: 'Save',
    
    // Plans
    free: 'Free',
    payPerUse: 'Pay Per Use',
    basic: 'Basic',
    pro: 'Pro',
    agency: 'Agency',
    enterprise: 'Enterprise',
    reportsPerMonth: 'reports/month',
    perReport: '/report',
    perMonth: '/month',
    contactUs: 'Contact Us',
    
    // Status
    pending: 'Pending',
    completed: 'Completed',
    failed: 'Failed',
    open: 'Open',
    inProgress: 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
    
    // Common
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    view: 'View',
    download: 'Download',
    search: 'Search',
    noResults: 'No results',
    
    // Disclaimer
    disclaimer: 'This report was generated by AI and does not constitute official legal or customs advice. Please verify the information with official customs authorities.'
  }
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('he');
  const [theme, setTheme] = useState('light');
  
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const user = await base44.auth.me();
        if (user?.preferred_language) setLanguage(user.preferred_language);
        if (user?.theme) setTheme(user.theme);
      } catch (e) {}
    };
    loadPreferences();
  }, []);
  
  useEffect(() => {
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);
  
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  
  const t = (key) => translations[language][key] || key;
  const isRTL = language === 'he';
  
  return (
    <LanguageContext.Provider value={{ language, setLanguage, theme, setTheme, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);