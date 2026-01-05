import React, { useState } from 'react';
import { useLanguage } from '../providers/LanguageContext';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import ProductDetailsForm from './ProductDetailsForm';
import ChatInterface from './ChatInterface';

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function NewReportDialog({ onReportCreated, onCancel }) {
  const { t, isRTL, reportLanguage } = useLanguage();
  const [targetLanguage, setTargetLanguage] = useState(reportLanguage || 'en');
  const [productDetails, setProductDetails] = useState({
    product_name: '',
    country_of_manufacture: '',
    country_of_origin: '',
    destination_country: ''
  });

  const handleSubmit = async (userMessage) => {
    const reportId = `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    const reportData = {
      report_id: reportId,
      product_name: productDetails.product_name,
      country_of_manufacture: productDetails.country_of_manufacture,
      country_of_origin: productDetails.country_of_origin,
      destination_country: productDetails.destination_country,
      status: 'pending',
      target_language: targetLanguage,
      user_input_text: userMessage
    };

    const newReport = await base44.entities.ClassificationReport.create(reportData);

    const classificationPrompt = `You are an expert in HS (Harmonized System) classification for international trade. 
    
Product Details:
- Name: ${productDetails.product_name}
- Country of Manufacture: ${productDetails.country_of_manufacture}
- Country of Origin: ${productDetails.country_of_origin}
- Destination: ${productDetails.destination_country}

User Input: ${userMessage}

Task: Provide a comprehensive customs classification analysis including:
1. The most appropriate HS code (6-10 digits)
2. Detailed reasoning for this classification
3. Key product characteristics that influenced the decision
4. Tariff rate information for the destination country
5. Import requirements and regulations
6. Official sources for verification
7. Alternative classification options if applicable

Format your response as a JSON object with the following structure:
{
  "hs_code": "string",
  "confidence_score": number (0-100),
  "classification_reasoning": "detailed explanation",
  "product_characteristics": ["characteristic1", "characteristic2", ...],
  "tariff_description": "tariff information",
  "import_requirements": [{"title": "requirement name", "description": "details"}, ...],
  "official_sources": [{"label": "source name", "url": "https://..."}, ...],
  "alternative_classifications": [{"hs_code": "alternative code", "explanation": "why this could apply"}, ...]
}`;

    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt: classificationPrompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          hs_code: { type: "string" },
          confidence_score: { type: "number" },
          classification_reasoning: { type: "string" },
          product_characteristics: { type: "array", items: { type: "string" } },
          tariff_description: { type: "string" },
          import_requirements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" }
              }
            }
          },
          official_sources: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                url: { type: "string" }
              }
            }
          },
          alternative_classifications: {
            type: "array",
            items: {
              type: "object",
              properties: {
                hs_code: { type: "string" },
                explanation: { type: "string" }
              }
            }
          }
        },
        required: ["hs_code", "classification_reasoning"]
      }
    });

    const updatedReport = await base44.entities.ClassificationReport.update(newReport.id, {
      status: 'completed',
      hs_code: llmResponse.hs_code,
      confidence_score: llmResponse.confidence_score,
      classification_reasoning: llmResponse.classification_reasoning,
      product_characteristics: llmResponse.product_characteristics || [],
      tariff_description: llmResponse.tariff_description,
      import_requirements: llmResponse.import_requirements || [],
      official_sources: llmResponse.official_sources || [],
      alternative_classifications: llmResponse.alternative_classifications || []
    });

    const user = await base44.auth.me();
    if (user) {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const reportsUsedThisMonth = (user.reports_used_this_month || 0);
      const lastUpdate = user.updated_date ? new Date(user.updated_date) : null;
      const shouldReset = !lastUpdate || 
        lastUpdate.getMonth() !== currentMonth || 
        lastUpdate.getFullYear() !== currentYear;

      await base44.auth.updateMe({
        reports_used_this_month: shouldReset ? 1 : reportsUsedThisMonth + 1,
        total_reports_created: (user.total_reports_created || 0) + 1
      });
    }

    onReportCreated(updatedReport.id);
  };

  return (
    <div className="space-y-6 p-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-2">
          {t('newReport')}
        </h2>
        <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
          {isRTL 
            ? 'הזן את פרטי המוצר ותאר אותו למערכת AI לצורך סיווג מכס'
            : 'Enter product details and describe it to the AI system for customs classification'
          }
        </p>
      </motion.div>

      <ProductDetailsForm 
        productDetails={productDetails}
        onChange={setProductDetails}
      />
      
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <Label className="mb-2 block text-sm font-medium">{t('language')}</Label>
        <Select value={targetLanguage} onValueChange={setTargetLanguage}>
          <SelectTrigger className="w-full bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="he">עברית (Hebrew)</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ChatInterface onSubmit={handleSubmit} />
    </div>
  );
}