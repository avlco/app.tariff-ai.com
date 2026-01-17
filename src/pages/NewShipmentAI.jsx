import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/providers/LanguageContext';
import NewShipmentAIDialog from '../components/shipments/NewShipmentAIDialog';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Sparkles, ArrowRight, FileText, Zap, Shield, Clock } from 'lucide-react';
import { createPageUrl } from '../utils';

export default function NewShipmentAI() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);

  const features = [
    {
      icon: Zap,
      title: language === 'he' ? 'עיבוד מהיר' : 'Fast Processing',
      description: language === 'he' 
        ? 'ניתוח אוטומטי של מסמכים בשניות ספורות'
        : 'Automatic document analysis in seconds',
    },
    {
      icon: Shield,
      title: language === 'he' ? 'דיוק גבוה' : 'High Accuracy',
      description: language === 'he'
        ? 'בינה מלאכותית מתקדמת לחילוץ מידע מדויק'
        : 'Advanced AI for precise data extraction',
    },
    {
      icon: Clock,
      title: language === 'he' ? 'חיסכון בזמן' : 'Time Saving',
      description: language === 'he'
        ? 'הפחיתו זמן הזנת נתונים ב-90%'
        : 'Reduce data entry time by 90%',
    },
  ];

  const handleGetStarted = () => {
    setShowDialog(true);
  };

  const handleSuccess = (shipmentId) => {
    setShowDialog(false);
    navigate(createPageUrl('ShipmentView') + `?id=${shipmentId}`);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-full mb-4">
          <Sparkles className="w-10 h-10 text-purple-600 dark:text-purple-400" />
        </div>
        
        <h1 className="text-4xl md:text-5xl font-bold font-heading bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
          {language === 'he' ? 'משלוח חכם עם AI' : 'Smart Shipment with AI'}
        </h1>
        
        <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
          {language === 'he'
            ? 'העלה מסמכי משלוח והבינה המלאכותית שלנו תמלא אוטומטית את כל הפרטים הנדרשים'
            : 'Upload shipment documents and our AI will automatically fill all required details'}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Button
            size="lg"
            onClick={handleGetStarted}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full px-8 shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Sparkles className="w-5 h-5 me-2" />
            {language === 'he' ? 'התחל עכשיו' : 'Get Started'}
            <ArrowRight className="w-5 h-5 ms-2" />
          </Button>
          
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate(createPageUrl('NewShipment'))}
            className="rounded-full px-8"
          >
            <FileText className="w-5 h-5 me-2" />
            {language === 'he' ? 'הזנה ידנית' : 'Manual Entry'}
          </Button>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
        {features.map((feature, index) => (
          <Card key={index} className="h-full border-slate-200 dark:border-slate-800 hover:shadow-lg transition-shadow duration-300">
            <CardContent className="pt-6 text-center space-y-3">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-500/10 to-blue-500/10 mb-2">
                <feature.icon className="w-7 h-7 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {feature.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {feature.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* How It Works Section */}
      <div className="pt-8">
        <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
          <CardHeader>
            <CardTitle className="text-2xl font-heading text-center">
              {language === 'he' ? 'איך זה עובד?' : 'How It Works?'}
            </CardTitle>
            <CardDescription className="text-center">
              {language === 'he' 
                ? 'תהליך פשוט בשלושה שלבים'
                : 'Simple three-step process'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="relative text-center space-y-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-600 text-white text-xl font-bold">
                  1
                </div>
                <div className="hidden md:block absolute top-6 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-purple-600 to-blue-600"></div>
                
                <h4 className="font-semibold text-slate-900 dark:text-white">
                  {language === 'he' ? 'העלה מסמכים' : 'Upload Documents'}
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {language === 'he'
                    ? 'העלה חשבוניות, תעודות משלוח או כל מסמך רלוונטי'
                    : 'Upload invoices, packing lists, or any relevant documents'}
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative text-center space-y-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 text-white text-xl font-bold">
                  2
                </div>
                <div className="hidden md:block absolute top-6 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-blue-600 to-cyan-600"></div>
                
                <h4 className="font-semibold text-slate-900 dark:text-white">
                  {language === 'he' ? 'AI מנתח' : 'AI Analyzes'}
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {language === 'he'
                    ? 'הבינה המלאכותית מזהה ומחלצת את כל המידע הדרוש'
                    : 'AI identifies and extracts all necessary information'}
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan-600 text-white text-xl font-bold">
                  3
                </div>
                <h4 className="font-semibold text-slate-900 dark:text-white">
                  {language === 'he' ? 'סקור ושלח' : 'Review & Submit'}
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {language === 'he'
                    ? 'בדוק את הנתונים, ערוך במידת הצורך ושלח'
                    : 'Review data, edit if needed, and submit'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CTA Section */}
      <div className="text-center pt-8 pb-4">
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
          {language === 'he'
            ? 'מוכנים לחסוך זמן? התחילו עכשיו!'
            : 'Ready to save time? Get started now!'}
        </p>
        <Button
          size="lg"
          onClick={handleGetStarted}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full px-12 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <Sparkles className="w-5 h-5 me-2" />
          {language === 'he' ? 'צור משלוח חכם' : 'Create Smart Shipment'}
          <ArrowRight className="w-5 h-5 ms-2" />
        </Button>
      </div>

      {/* AI Dialog */}
      {showDialog && (
        <NewShipmentAIDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
