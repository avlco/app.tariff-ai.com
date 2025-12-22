import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    destination_country: ''
  });
  const [chatMessages, setChatMessages] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [externalLinks, setExternalLinks] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [processingModalOpen, setProcessingModalOpen] = useState(false);
  const [currentProcessingStatus, setCurrentProcessingStatus] = useState('collecting_info');
  const [showReadyNotification, setShowReadyNotification] = useState(false);
  const [currentReportId, setCurrentReportId] = useState(null);
  
  const handleSendMessage = (message) => {
    setChatMessages([...chatMessages, { role: 'user', content: message, timestamp: new Date().toISOString() }]);
    
    // Simple AI response simulation
    setTimeout(() => {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: language === 'he' 
          ? 'תודה על המידע. האם יש פרטים נוספים על המוצר?'
          : 'Thank you for the information. Are there any additional details about the product?',
        timestamp: new Date().toISOString()
      }]);
    }, 500);
  };
  
  const handleFileUpload = (urls) => {
    setUploadedFiles([...uploadedFiles, ...urls]);
  };
  
  const handleLinkAdd = (url) => {
    setExternalLinks([...externalLinks, url]);
  };
  
  const handleGenerate = async () => {
    if (!formData.product_name || !formData.destination_country) {
      toast.error(language === 'he' ? 'נא למלא את שדות החובה' : 'Please fill required fields');
      return;
    }
    
    setGenerating(true);
    
    try {
      // Create initial report
      const report = await base44.entities.ClassificationReport.create({
        product_name: formData.product_name,
        country_of_manufacture: formData.country_of_manufacture,
        country_of_origin: formData.country_of_origin,
        destination_country: formData.destination_country,
        status: 'pending',
        processing_status: 'collecting_info',
        chat_history: chatMessages,
        uploaded_file_urls: uploadedFiles,
        external_link_urls: externalLinks,
        report_id: `RPT-${Date.now()}`
      });
      
      setCurrentReportId(report.id);
      onOpenChange(false);
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
              setShowReadyNotification(true);
              
              // Auto-hide notification after 10 seconds
              setTimeout(() => setShowReadyNotification(false), 10000);
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
      
      // Trigger backend processing with spreadsheetId
      await base44.functions.invoke('startClassification', { 
        reportId: report.id,
        spreadsheetId: '1s2scDU57GjhN6x-49-HsoocaFaXpTVv_39AoChB6cJo'
      });
      
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
            <h3 className="font-semibold text-lg mb-3">
              {language === 'he' ? 'שיחה עם AI' : 'Chat with AI'}
            </h3>
            <ChatInterface
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              onFileUpload={handleFileUpload}
              onLinkAdd={handleLinkAdd}
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
              onClick={handleGenerate}
              disabled={generating || !formData.product_name || !formData.destination_country}
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