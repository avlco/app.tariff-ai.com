import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '../components/providers/LanguageContext';
import ChatInterface from '../components/report/ChatInterface';
import ProductDetailsForm from '../components/report/ProductDetailsForm';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function NewReport() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [details, setDetails] = useState({
    product_name: '',
    country_of_manufacture: '',
    country_of_origin: '',
    destination_country: 'Israel',
  });
  
  const handleSubmit = async (input) => {
    if (!details.product_name) {
      toast.error(language === 'he' ? 'נא להזין שם מוצר' : 'Please enter a product name');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Generate unique report ID
      const reportId = Math.random().toString(36).substring(2, 10);
      
      // Create initial report
      const report = await base44.entities.ClassificationReport.create({
        report_id: reportId,
        product_name: details.product_name,
        status: 'pending',
        country_of_manufacture: details.country_of_manufacture,
        country_of_origin: details.country_of_origin,
        destination_country: details.destination_country,
        user_input_text: input.text,
        user_input_files: input.files,
      });
      
      // Call LLM for classification
      const prompt = `You are an expert customs classification specialist. Classify the following product for HS Code.

Product Name: ${details.product_name}
Description: ${input.text}
Country of Manufacture: ${details.country_of_manufacture}
Country of Origin: ${details.country_of_origin}
Destination Country: ${details.destination_country}

Provide a comprehensive HS classification report in ${language === 'he' ? 'Hebrew' : 'English'}.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: input.files,
        response_json_schema: {
          type: 'object',
          properties: {
            hs_code: { type: 'string', description: 'The primary HS classification code' },
            confidence_score: { type: 'number', description: 'Confidence percentage 0-100' },
            classification_reasoning: { type: 'string', description: 'Detailed explanation for the classification' },
            product_characteristics: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Key characteristics of the product'
            },
            tariff_description: { type: 'string', description: 'Information about tariff rates and trade agreements' },
            import_requirements: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' }
                }
              }
            },
            official_sources: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  url: { type: 'string' }
                }
              }
            },
            alternative_classifications: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  hs_code: { type: 'string' },
                  explanation: { type: 'string' }
                }
              }
            }
          },
          required: ['hs_code', 'confidence_score', 'classification_reasoning']
        }
      });
      
      // Update report with classification results
      await base44.entities.ClassificationReport.update(report.id, {
        status: 'completed',
        hs_code: result.hs_code,
        confidence_score: result.confidence_score,
        classification_reasoning: result.classification_reasoning,
        product_characteristics: result.product_characteristics || [],
        tariff_description: result.tariff_description || '',
        import_requirements: result.import_requirements || [],
        official_sources: result.official_sources || [],
        alternative_classifications: result.alternative_classifications || [],
      });
      
      // Update user's report count
      const user = await base44.auth.me();
      await base44.auth.updateMe({
        reports_used_this_month: (user.reports_used_this_month || 0) + 1
      });
      
      toast.success(language === 'he' ? 'הדוח נוצר בהצלחה!' : 'Report created successfully!');
      navigate(createPageUrl(`ReportView?id=${report.id}`));
      
    } catch (error) {
      console.error('Error creating report:', error);
      toast.error(language === 'he' ? 'שגיאה ביצירת הדוח' : 'Error creating report');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
          {t('newReport')}
        </h1>
        
        <div className="space-y-6">
          <ProductDetailsForm details={details} onChange={setDetails} />
          <ChatInterface onSubmit={handleSubmit} isLoading={isLoading} />
        </div>
      </motion.div>
    </div>
  );
}