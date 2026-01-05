import React from 'react';
import { useLanguage } from '../providers/LanguageContext';

export default function ReportContentWrapper({ languageCode, children, className = '' }) {
    const { getDirForLang } = useLanguage();
    // Default to 'en' if no language code provided
    const targetLang = languageCode || 'en';
    const dir = getDirForLang(targetLang);
    
    return (
        <div 
            dir={dir}
            className={`report-content-wrapper ${className} ${dir === 'rtl' ? 'font-heebo text-right' : 'font-sans text-left'}`}
            style={{ unicodeBidi: 'isolate' }}
        >
            {children}
        </div>
    );
}