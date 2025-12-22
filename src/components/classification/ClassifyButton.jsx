import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { useLanguage } from '../providers/LanguageContext';

export default function ClassifyButton({ onClick, variant = "default", size = "default" }) {
  const { language } = useLanguage();
  
  return (
    <Button 
      onClick={onClick}
      variant={variant}
      size={size}
      className="bg-gradient-to-r from-[#114B5F] to-[#42C0B9] hover:from-[#0D3A4A] hover:to-[#35A89E] text-white"
    >
      <Sparkles className="w-4 h-4 me-2" />
      {language === 'he' ? 'סווג מוצר באמצעות AI' : 'Classify Product with AI'}
    </Button>
  );
}