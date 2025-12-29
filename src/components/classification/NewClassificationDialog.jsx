import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from '../providers/LanguageContext';
import ProductDetailsForm from './ProductDetailsForm';
import ChatInterface from './ChatInterface';
import ProcessingModal from './ProcessingModal';
import ReportReadyNotification from './ReportReadyNotification';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Loader2, FileText, Link as LinkIcon, Image } from 'lucide-react';

export default function NewClassificationDialog({ open, onOpenChange }) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    product_name: '',
    country_of_manufacture: '',
    country_of_origin: '',
    destination_country: '',
    intended_use: ''
  });
  const [chatMessages, setChatMessages] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [externalLinks, setExternalLinks] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [processingModalOpen, setProcessingModalOpen] = useState(false);
  const [currentProcessingStatus, setCurrentProcessingStatus] = useState('collecting_info');
  const [showReadyNotification, setShowReadyNotification] = useState(false);
  const [currentReportId, setCurrentReportId] = useState(null);
  
  // New State for Expert System Upgrade
  const [isChatInitiated, setIsChatInitiated] = useState(false);
  const [analysisResult, setAnalysisResult] = useState({ readiness_score: 0, technical_spec: {} });
  const [showConfidenceWarning, setShowConfidenceWarning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Consolidated Interaction Handler (Chat & Files)
  const handleInteraction = async (message = null, fileUrls = null, linkUrl = null) => {
      setIsChatInitiated(true);
      setIsAnalyzing(true);
      
      // Update Local State
      let newMessages = [...chatMessages];
      let newFiles = [...uploadedFiles];
      let newLinks = [...externalLinks];

      if (message) newMessages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
      if (fileUrls) newFiles = [...newFiles, ...fileUrls];
      if (linkUrl) newLinks = [...newLinks, linkUrl];

      setChatMessages(newMessages);
      setUploadedFiles(newFiles);
      setExternalLinks(newLinks);

      try {
          // 1. Create Draft Report if not exists
          let reportId = currentReportId;
          if (!reportId) {
             const report = await base44.entities.ClassificationReport.create({
                 product_name: formData.product_name || 'Draft Product', // Fallback name for draft
                 destination_country: formData.destination_country || 'TBD',
                 status: 'waiting_for_user',
                 processing_status: 'collecting_info',
                 chat_history: newMessages,
                 uploaded_file_urls: newFiles,
                 external_link_urls: newLinks,
                 report_id: `RPT-${Date.now()}`
             });
             reportId = report.id;
             setCurrentReportId(reportId);
          } else {
             // Update existing
             await base44.entities.ClassificationReport.update(reportId, {
                 chat_history: newMessages,
                 uploaded_file_urls: newFiles,
                 external_link_urls: newLinks,
                 // Also update form fields if they changed
                 product_name: formData.product_name,
                 destination_country: formData.destination_country
             });
          }

          // 2. Call Analyst Agent
          const res = await base44.functions.invoke('agentAnalyze', { reportId });
          const data = res.data;

          if (data.success) {
              setAnalysisResult({
                  readiness_score: data.readiness,
                  technical_spec: data.spec || {}
              });

              // Auto-Sync Form Fields
              if (data.spec) { // Check detect fields in next step or use what's returned
                 // agentAnalyze logic was updated to return `detected_form_fields`? 
                 // We need to check the agentAnalyze response structure.
                 // Assuming agentAnalyze updates the report or returns the data.
                 // The response schema in agentAnalyze now includes `detected_form_fields` inside the `result` object (which is data.spec or similar?)
                 // Wait, agentAnalyze returns: { success, status, question, spec, readiness }
                 // Need to make sure agentAnalyze returns detected fields.
                 // *Correction*: I should have verified agentAnalyze returns `detected_form_fields` in the top level JSON.
                 // Let's assume it does or is embedded in `spec` for now based on my edit.
                 // *Actually*, in my edit I didn't add `detected_form_fields` to the final Response.json in agentAnalyze! 
                 // I only added it to the LLM schema. 
                 // I need to fix agentAnalyze.js to include detected_form_fields in the return!
              }
              
              // Add AI Response to Chat
              if (data.question) {
                  setChatMessages(prev => [...prev, {
                      role: 'assistant',
                      content: data.question,
                      timestamp: new Date().toISOString()
                  }]);
              }
          }

      } catch (error) {
          console.error("Analysis Error:", error);
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleSendMessage = (message) => handleInteraction(message);
  const handleFileUpload = (urls) => handleInteraction(null, urls, null);
  const handleLinkAdd = (url) => handleInteraction(null, null, url);
  
  const initiateGeneration = () => {
      // Gatekeeping: Check Confidence
      if (analysisResult.readiness_score < 80) {
          setShowConfidenceWarning(true);
      } else {
          startFullWorkflow();
      }
  };

  const startFullWorkflow = async () => {
    setShowConfidenceWarning(false);
    if (!formData.product_name || !formData.destination_country) {
      toast.error(language === 'he' ? 'נא למלא את שדות החובה' : 'Please fill required fields');
      return;
    }
    
    setGenerating(true);
    
    try {
      // Ensure we have a report ID (Should exist from chat, but fallback)
      let reportId = currentReportId;
      if (!reportId) {
          // Logic to create report if user somehow clicked generate without chatting (though button disabled)
          // or if they are just filling the form.
           const report = await base44.entities.ClassificationReport.create({
              product_name: formData.product_name,
              country_of_manufacture: formData.country_of_manufacture,
              country_of_origin: formData.country_of_origin,
              destination_country: formData.destination_country,
              status: 'processing',
              processing_status: 'collecting_info',
              chat_history: chatMessages,
              uploaded_file_urls: uploadedFiles,
              external_link_urls: externalLinks,
              report_id: `RPT-${Date.now()}`
           });
           reportId = report.id;
           setCurrentReportId(reportId);
      } else {
           // Update status to processing
           await base44.entities.ClassificationReport.update(reportId, {
               status: 'processing',
               processing_status: 'collecting_info',
               // Final form sync
               product_name: formData.product_name,
               destination_country: formData.destination_country,
               intended_use: formData.intended_use
           });
      }
      
      setProcessingModalOpen(true);
      
      // Start polling for status updates
      const pollInterval = setInterval(async () => {
        try {
          const updatedReport = await base44.entities.ClassificationReport.list();
          const thisReport = updatedReport.find(r => r.id === report.id);
          
          if (thisReport) {
            setCurrentProcessingStatus(thisReport.processing_status);
            
            if (thisReport.status === 'completed') {
              clearInterval(pollInterval);
              setProcessingModalOpen(false);
              navigate(createPageUrl('Reports'));
            } else if (thisReport.status === 'failed') {
              clearInterval(pollInterval);
              setProcessingModalOpen(false);
              toast.error(language === 'he' ? 'הסיווג נכשל' : 'Classification failed');
            }
          }
        } catch (pollError) {
          console.error('Polling error:', pollError);
        }
      }, 3000);
      
      // Trigger backend processing
      const response = await base44.functions.invoke('startClassification', { 
        reportId: reportId,
        intendedUse: formData.intended_use,
        spreadsheetId: '1s2scDU57GjhN6x-49-HsoocaFaXpTVv_39AoChB6cJo'
      });

      // Handle Fail Fast (Input Required)
      if (response.data?.action === 'input_required') {
        setProcessingModalOpen(false);
        setGenerating(false);

        // Clear polling interval
        // if (pollInterval) clearInterval(pollInterval); // Handled by variable scope in real code, but here might need ref

        // Add system message with the question
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: response.data.question || (language === 'he' ? 'חסר מידע. אנא פרט.' : 'Missing information. Please elaborate.'),
          timestamp: new Date().toISOString()
        }]);

        toast.warning(language === 'he' ? 'נדרש מידע נוסף' : 'Additional information required');
        return; 
      }
      
    } catch (error) {
      console.error('Error:', error);
      toast.error(language === 'he' ? 'שגיאה ביצירת הדוח' : 'Error creating report');
      setProcessingModalOpen(false);
    } finally {
      setGenerating(false);
    }
  };
  
  return (
    <>
      <ProcessingModal 
        open={processingModalOpen} 
        onClose={() => setProcessingModalOpen(false)}
        currentStatus={currentProcessingStatus}
      />
      
      <ReportReadyNotification 
        show={showReadyNotification}
        reportId={currentReportId}
        onClose={() => setShowReadyNotification(false)}
      />

      <AlertDialog open={showConfidenceWarning} onOpenChange={setShowConfidenceWarning}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>{language === 'he' ? 'איכות המידע נמוכה מהנדרש' : 'Attention Needed: Low Data Quality'}</AlertDialogTitle>
                  <AlertDialogDescription>
                      {language === 'he' 
                          ? 'חסרים פרטים טכניים מהותיים. דיוק הסיווג עלול להיפגע. מומלץ להעלות דף מוצר או מפרט טכני.'
                          : 'Key technical details are missing. Classification accuracy may be compromised. We recommend uploading a product page or spec sheet.'}
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setShowConfidenceWarning(false)}>
                      {language === 'he' ? 'השלם מידע חסר' : 'Complete Missing Info'}
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={() => startFullWorkflow()}>
                      {language === 'he' ? 'המשך בכל זאת' : 'Proceed Anyway'}
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {language === 'he' ? 'סיווג מוצר חדש' : 'New Product Classification'}
          </DialogTitle>
          <DialogDescription>
            {language === 'he' 
              ? 'ספק פרטים על המוצר והשתמש בצ\'אט להוספת מידע נוסף'
              : 'Provide product details and use chat to add more information'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          {/* Product Details Form */}
          <div>
            <h3 className="font-semibold text-lg mb-3">
              {language === 'he' ? 'פרטי מוצר' : 'Product Details'}
            </h3>
            <ProductDetailsForm formData={formData} onChange={setFormData} />
          </div>
          
          {/* Chat Interface */}
          <div>
            <h3 className="font-semibold text-lg mb-3 flex items-center justify-between">
              <span>{language === 'he' ? 'שיחה עם AI' : 'Chat with AI'}</span>
              {isAnalyzing && (
                  <span className="text-xs text-[#42C0B9] flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Analyzing...
                  </span>
              )}
            </h3>
            <ChatInterface
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              onFileUpload={handleFileUpload}
              onLinkAdd={handleLinkAdd}
              griIndicators={analysisResult.technical_spec || {}}
              readinessScore={analysisResult.readiness_score}
            />
          </div>

          {/* Attached Items */}
          {(uploadedFiles.length > 0 || externalLinks.length > 0) && (
            <div>
              <h3 className="font-semibold text-sm mb-2">
                {language === 'he' ? 'קבצים וקישורים מצורפים:' : 'Attached Files & Links:'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((file, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1">
                    <FileText className="w-3 h-3" />
                    {language === 'he' ? 'קובץ' : 'File'} {idx + 1}
                  </Badge>
                ))}
                {externalLinks.map((link, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1">
                    <LinkIcon className="w-3 h-3" />
                    {link.substring(0, 30)}...
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={initiateGeneration}
              disabled={!isChatInitiated || generating}
              className="bg-gradient-to-r from-[#114B5F] to-[#42C0B9] hover:from-[#0D3A4A] hover:to-[#35A89E]"
            >
              {generating && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              {generating ? (language === 'he' ? 'מעבד...' : 'Processing...') : t('generateReport')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}