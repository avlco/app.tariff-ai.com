import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from "@/api/base44Client";
import SmartClassificationChat from "@/components/SmartClassificationChat";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function NewClassificationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [reportId, setReportId] = useState(searchParams.get('id'));

  useEffect(() => {
    const initReport = async () => {
      const id = searchParams.get('id');
      if (id) {
        setReportId(id);
        setLoading(false);
        return;
      }

      try {
        // FIXED: Initialize with null so the Extractor detects missing info
        const newReport = await base44.entities.ClassificationReport.create({
          product_name: null, 
          origin_country: null,
          destination_country: null,
          manufacture_country: null,
          status: 'processing',
          processing_status: 'collecting_info',
          chat_history: []
        });

        setSearchParams({ id: newReport.id });
        setReportId(newReport.id);
      } catch (error) {
        console.error("Failed to create draft", error);
        toast.error("Failed to initialize session");
      } finally {
        setLoading(false);
      }
    };

    initReport();
  }, [searchParams, setSearchParams]);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 flex flex-col">
       <SmartClassificationChat reportId={reportId} />
    </div>
  );
}