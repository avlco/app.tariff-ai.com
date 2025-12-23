import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { jsPDF } from 'npm:jspdf@2.5.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user has premium subscription
    const isPremium = ['pay_per_use', 'basic', 'pro', 'agency', 'enterprise'].includes(user.subscription_plan);
    if (!isPremium) {
      return Response.json({ error: 'Premium subscription required' }, { status: 403 });
    }
    
    const { reportId } = await req.json();
    
    if (!reportId) {
      return Response.json({ error: 'Report ID is required' }, { status: 400 });
    }
    
    // Get the report
    const reports = await base44.entities.ClassificationReport.filter({ id: reportId });
    const report = reports[0];
    
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }
    
    // Check ownership
    if (report.created_by !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Create PDF using jsPDF
    const doc = new jsPDF();
    let y = 20;
    
    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(report.product_name || 'דוח סיווג', 105, y, { align: 'center' });
    y += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`ID: ${report.report_id}`, 105, y, { align: 'center' });
    y += 6;
    doc.text(`תאריך: ${new Date(report.created_date).toLocaleDateString('he-IL')}`, 105, y, { align: 'center' });
    y += 15;
    
    // HS Code Box
    doc.setFillColor(17, 75, 95);
    doc.rect(20, y, 170, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text('קוד HS', 105, y + 8, { align: 'center' });
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(report.hs_code || '---', 105, y + 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`רמת ביטחון: ${report.confidence_score || 0}%`, 105, y + 28, { align: 'center' });
    y += 45;
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    // Trade Details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('פרטי סחר', 20, y);
    y += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`מדינת ייצור: ${report.country_of_manufacture || '---'}`, 20, y);
    y += 6;
    doc.text(`מדינת מוצא: ${report.country_of_origin || '---'}`, 20, y);
    y += 6;
    doc.text(`מדינת יעד: ${report.destination_country || '---'}`, 20, y);
    y += 12;
    
    // Classification Reasoning
    if (report.classification_reasoning) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('נימוק הסיווג', 20, y);
      y += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const reasoningLines = doc.splitTextToSize(report.classification_reasoning, 170);
      doc.text(reasoningLines, 20, y);
      y += (reasoningLines.length * 6) + 8;
    }
    
    // Product Characteristics
    if (report.product_characteristics && report.product_characteristics.length > 0) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('מאפייני המוצר', 20, y);
      y += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      report.product_characteristics.forEach(char => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const charLines = doc.splitTextToSize(`• ${char}`, 165);
        doc.text(charLines, 25, y);
        y += (charLines.length * 6) + 2;
      });
      y += 6;
    }
    
    // Tariff Description
    if (report.tariff_description) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('מידע על מכסים', 20, y);
      y += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const tariffLines = doc.splitTextToSize(report.tariff_description, 170);
      doc.text(tariffLines, 20, y);
      y += (tariffLines.length * 6) + 8;
    }
    
    // Import Requirements
    if (report.import_requirements && report.import_requirements.length > 0) {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('דרישות יבוא', 20, y);
      y += 8;
      
      doc.setFontSize(10);
      report.import_requirements.forEach(req => {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        
        doc.setFont('helvetica', 'bold');
        const titleLines = doc.splitTextToSize(req.title, 170);
        doc.text(titleLines, 20, y);
        y += (titleLines.length * 6) + 2;
        
        doc.setFont('helvetica', 'normal');
        const descLines = doc.splitTextToSize(req.description, 170);
        doc.text(descLines, 20, y);
        y += (descLines.length * 6) + 6;
      });
    }
    
    // Footer disclaimer
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('דוח זה נוצר באמצעות AI ואינו מהווה ייעוץ משפטי או מכסי רשמי.', 105, 285, { align: 'center' });
      doc.text('יש לאמת את המידע מול רשויות המכס הרשמיות.', 105, 290, { align: 'center' });
    }
    
    const pdfBytes = doc.output('arraybuffer');
    
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${report.report_id}.pdf"`
      }
    });
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});