export default {
  // Navigation
  dashboard: 'דשבורד',
  newReport: 'דוח חדש',
  reports: 'דוחות',
  support: 'תמיכה',
  profile: 'פרופיל',
  logout: 'התנתק',
  shipments: 'משלוחים',
  customers: 'לקוחות',
  
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

  // New Report Details Keys
  primaryClassification: 'סיווג ראשי',
  legalBasis: 'בסיס חוקי (GRI)',
  alternativesComparison: 'השוואת חלופות',
  technicalLegalDetails: 'פרטים טכניים ומשפטיים',
  technicalSpec: 'מפרט טכני',
  fullLegalReasoning: 'נימוק משפטי מלא',
  complianceRegulation: 'תאימות ורגולציה',
  verifiedSources: 'מקורות מאומתים',
  taxesDuties: 'מיסים ועלויות',
  standardsCertification: 'תקינה ואישורים',
  importLegality: 'חוקיות יבוא',
  standardizedName: 'שם תקני',
  materialComposition: 'הרכב חומרים',
  function: 'פונקציה',
  essentialCharacter: 'מאפיין מהותי',
  regulatoryContext: 'הקשר רגולטורי',
  regionalAgreements: 'הסכמים אזוריים',
  hsStructure: 'מבנה HS',
  taxMethod: 'שיטת מס',
  generatedBy: 'נוצר ע"י מערכת ACE',
  shareReport: 'שתף דוח',
  shareReportDesc: 'העתק את הקישור הציבורי לדוח זה.',
  linkValidUntil: 'תוקף קישור: ',
  days: 'ימים',
  print: 'הדפס',
  share: 'שתף',
  backToReports: 'חזור לדוחות',
  qaScore: 'ציון איכות (QA)',
  attentionNeeded: 'שים לב',
  qaPassed: 'הדוח עבר את בדיקות האיכות בהצלחה. סיווג זה נחשב אמין.',
  whyRejected: 'סיבת דחייה',
  officialResourceLinks: 'קישורי מקור רשמיים',
  noSpecificStandards: 'לא נמצאו תקנים ספציפיים.',
  noneSpecified: 'לא צוין',
  verifySource: 'אמת מקור',
  origin: 'מוצא',
  destination: 'יעד',

  // Public Report
  publicReport: 'דוח משותף',
  sharedVia: 'דוח זה שותף באמצעות Tariff AI',
  securityLevel: 'רמת ביטחון',
  invalidLink: 'קישור לא חוקי',
  linkExpired: 'הקישור פג תוקף או לא תקין',
  tariffInformation: 'מידע תעריפי',
  
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
  systemLanguage: 'שפת מערכת',
  defaultReportLanguage: 'שפת דוחות ברירת מחדל',
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

  // Pricing Object
  pricing: {
    free: {
      title: 'חינם',
      features: ['עד 3 דוחות בחודש', 'תצוגה מוגבלת של הדוח', 'קוד HS בלבד']
    },
    payPerUse: {
      title: 'לפי שימוש',
      features: ['$1.99 לדוח', 'תצוגה מלאה של הדוח', 'ללא הגבלה']
    },
    basic: {
      title: 'בסיסי',
      features: ['עד 15 דוחות בחודש', 'תצוגה מלאה של הדוח', 'תמיכה באימייל']
    },
    pro: {
      title: 'מקצועי',
      features: ['עד 50 דוחות בחודש', 'תצוגה מלאה של הדוח', 'תמיכה בעדיפות', 'ייצוא PDF']
    },
    agency: {
      title: 'סוכנות',
      features: ['עד 200 דוחות בחודש', 'תצוגה מלאה של הדוח', 'תמיכה בעדיפות גבוהה', 'API גישה']
    },
    enterprise: {
      title: 'ארגוני',
      features: ['ללא הגבלת דוחות', 'התאמה אישית', 'מנהל חשבון ייעודי', 'SLA מותאם']
    }
  },
  
  // Status
  processing: 'בתהליך',
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
  close: 'סגור',
  copy: 'העתק',
  
  // Disclaimer
  disclaimer: 'דוח זה נוצר באמצעות AI ואינו מהווה ייעוץ משפטי או מכסי רשמי. יש לאמת את המידע מול רשויות המכס הרשמיות.',
  
  // Clarify Page & Notifications
  waiting_for_user: 'ממתין למשתמש',
  action_required: 'נדרשת פעולה',
  missingInformation: 'חסר מידע',
  caseContext: 'הקשר המקרה',
  expertRequest: 'בקשת מומחה',
  provideInfo: 'ספק מידע',
  originalInput: 'קלט מקורי',
  forceProceed: 'המשך בכוח (עלול לפגוע בדיוק)',
  submitUpdate: 'שלח עדכון',
  back: 'חזרה',
  classificationReady: 'סיווג מוכן',
  processFailed: 'תהליך נכשל',
  resolveNow: 'פתור כעת',
  viewReport: 'צפה בדוח',
  product: 'מוצר',
  reportId: 'מזהה דוח',
  file: 'קובץ',
  link: 'קישור',
  notifications: 'הודעות',
  markAllAsRead: 'סמן הכל כנקרא',
  noNotifications: 'אין הודעות חדשות',
  viewNotification: 'צפה',
  notificationDismissed: 'ההודעה נדחתה'
};