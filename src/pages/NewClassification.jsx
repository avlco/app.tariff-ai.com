import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from "@/api/base44Client";
import SmartClassificationChat from "@/components/SmartClassificationChat";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function NewClassificationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
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
        // Create a new draft report
        const newReport = await base44.entities.ClassificationReport.create({
          product_name: null, // Allow extractor to fill this
          country_of_origin: null,
          destination_country: null,
          status: 'processing',
          processing_status: 'collecting_info',
          chat_history: []
        });

        // Redirect to same page with ID
        setSearchParams({ id: newReport.id });
        setReportId(newReport.id);
      } catch (error) {
        console.error("Failed to create draft report", error);
        toast.error("Failed to initialize session");
      } finally {
        setLoading(false);
      }
    };

    initReport();
  }, [searchParams, setSearchParams]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 flex flex-col">
       <SmartClassificationChat reportId={reportId} />
    </div>
  );
}