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
      className="bg-gradient-to-r from-[#42C0B9] to-[#2DA39D] hover:from-[#4DD4CC] hover:to-[#42C0B9] text-white rounded-full px-6 shadow-lg hover:shadow-[0_0_25px_rgba(66,192,185,0.4)] transition-all duration-300 font-semibold"
    >
      <Sparkles className="w-4 h-4 me-2" />
      {language === 'he' ? 'סווג מוצר באמצעות AI' : 'Classify Product with AI'}
    </Button>
  );
}