import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle, Scale, BookOpen, Globe, FileText, Box } from 'lucide-react';

// Global function for PDFShift wait_for - returns true when report is loaded
if (typeof window !== 'undefined') {
    window.checkReportReady = () => {
        return window._reportDataLoaded === true;
    };
    window._reportDataLoaded = false;
}

export default function PdfReport() {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const token = new URLSearchParams(window.location.search).get('token');
            if (token) {
                try {
                    const res = await base44.functions.invoke('getPublicSharedReportData', { token });
                    if (res.data && res.data.data) {
                        setReport(res.data.data);
                        // Signal PDFShift that content is ready
                        if (typeof window !== 'undefined') {
                            window._reportDataLoaded = true;
                        }
                    }
                } catch (e) {
                    console.error("Failed to load PDF data", e);
                }
            }
            setLoading(false);
        };
        load();
    }, []);

    // במצב טעינה או שגיאה - אין ID, ולכן הבוט ימתין
    if (loading || !report) {
        return <div className="p-10 text-center text-slate-500">Preparing Document...</div>;
    }

    const primary = report.classification_results?.primary || {};
    const regulatory = report.regulatory_data?.primary || {};
    const spec = report.structural_analysis || {};
    
    return (
        <div className="max-w-[210mm] mx-auto p-8 bg-white text-slate-900 font-sans">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-200 pb-6 mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#114B5F] rounded flex items-center justify-center text-white font-bold text-xl">T</div>
                    <div>
                        <h1 className="text-xl font-bold text-[#114B5F]">Tariff AI</h1>
                        <p className="text-xs text-slate-500">Official Classification Report</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm font-medium text-slate-900">Report #{report.report_id || report.id}</p>
                    <p className="text-xs text-slate-500">{new Date(report.created_date).toLocaleDateString()}</p>
                </div>
            </div>

            {/* Product Info */}
            <div className="bg-slate-50 rounded-xl p-6 mb-8 border border-slate-100">
                <div className="flex justify-between items-start">
                    <div className="max-w-[65%]">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">{report.product_name}</h2>
                        <div className="flex flex-wrap gap-4 text-sm text-slate-600 mt-2">
                            <span className="flex items-center gap-1"><Globe className="w-3 h-3"/> Origin: {report.country_of_origin}</span>
                            <span className="flex items-center gap-1"><Box className="w-3 h-3"/> Dest: {report.destination_country}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-slate-500 uppercase tracking-wide mb-1">HS Classification</p>
                        <div className="text-4xl font-mono font-bold text-[#114B5F]">{primary.hs_code || '---'}</div>
                        <div className="inline-block bg-white px-2 py-1 rounded text-xs font-bold text-[#42C0B9] mt-2 border border-slate-100">
                            Confidence: {primary.confidence_score}%
                        </div>
                    </div>
                </div>
            </div>

            {/* Technical */}
            <section className="mb-8">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4"/> Technical Specification
                </h3>
                <div className="bg-white border border-slate-200 rounded-lg p-5">
                    <div className="grid grid-cols-1 gap-4 text-sm">
                        <div className="grid grid-cols-[120px_1fr] gap-4 pb-3 border-b border-slate-50">
                            <span className="font-semibold text-slate-700">Function:</span> 
                            <span className="text-slate-600">{spec.function || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-[120px_1fr] gap-4 pb-3 border-b border-slate-50">
                            <span className="font-semibold text-slate-700">Materials:</span> 
                            <span className="text-slate-600">{spec.material_composition || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-[120px_1fr] gap-4">
                            <span className="font-semibold text-slate-700">Description:</span> 
                            <span className="text-slate-600">{spec.essential_character || report.user_input_text || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Reasoning */}
            <section className="mb-8 break-inside-avoid">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Scale className="w-4 h-4"/> Legal Reasoning
                </h3>
                <div className="bg-slate-50 border-l-4 border-[#114B5F] p-5 rounded-r-lg">
                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {primary.reasoning || report.classification_reasoning}
                    </p>
                    {primary.legal_basis && (
                        <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500">
                            <strong>Legal Basis:</strong> {primary.legal_basis}
                        </div>
                    )}
                </div>
            </section>

            {/* Duties */}
            <section className="mb-8 break-inside-avoid">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4"/> Duties & Import Data
                </h3>
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-4 border border-slate-200 rounded-lg text-center">
                        <div className="text-xs text-slate-500 mb-1">Duty Rate</div>
                        <div className="text-xl font-bold text-[#114B5F]">{regulatory.duty_rate || '0%'}</div>
                    </div>
                    <div className="p-4 border border-slate-200 rounded-lg text-center">
                        <div className="text-xs text-slate-500 mb-1">VAT</div>
                        <div className="text-xl font-bold text-[#114B5F]">{regulatory.vat_rate || 'N/A'}</div>
                    </div>
                    <div className="p-4 border border-slate-200 rounded-lg text-center">
                        <div className="text-xs text-slate-500 mb-1">Method</div>
                        <div className="text-xl font-bold text-slate-700">CIF</div>
                    </div>
                </div>

                {regulatory.import_requirements && regulatory.import_requirements.length > 0 && (
                    <div className="border border-slate-200 rounded-lg p-5">
                        <h4 className="text-xs font-bold text-slate-700 uppercase mb-3">Import Requirements</h4>
                        <ul className="space-y-2">
                            {regulatory.import_requirements.map((req, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                    <span>{typeof req === 'string' ? req : req.requirement}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>

            {/* Footer */}
            <div className="mt-12 pt-6 border-t border-slate-200 text-center">
                <p className="text-xs text-slate-400">
                    Generated automatically by Tariff AI. This document is for informational purposes only.
                </p>
                <p className="text-xs text-slate-300 mt-1">
                    Doc ID: {report.token} | Validated at: {new Date().toISOString()}
                </p>
            </div>
        </div>
    );
}