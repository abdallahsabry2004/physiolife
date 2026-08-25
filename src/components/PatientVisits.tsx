import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, CalendarPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logActivityAsync } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { format } from "date-fns";
import { generatePDF } from "@/lib/pdf";
import { toast } from "sonner";
import logo from "@/assets/physio-life-logo.png";

export function PatientVisits({
  patientId,
  patientName,
}: {
  patientId: string;
  patientName: string;
}) {
  const { user, fullName } = useAuth();
  const qc = useQueryClient();
  const { lang } = useI18n();

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["patient_visits", patientId],
    queryFn: async () => {
      // We store visits in patient_records with module="visit"
      const { data, error } = await supabase
        .from("patient_records")
        .select("*")
        .eq("patient_id", patientId)
        .eq("module", "visit")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) return [];

      // Fetch names of users who recorded them
      const userIds = [...new Set(data.map((d) => d.recorded_by).filter(Boolean))];

      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds as string[]);

        if (profiles) {
          profiles.forEach((p) => {
            profilesMap[p.id] = p.full_name || "Unknown";
          });
        }
      }

      return data.map((d) => ({
        ...d,
        recorderName: d.recorded_by ? profilesMap[d.recorded_by] || "Unknown" : "Unknown",
      }));
    },
  });

  const handlePrintVisits = async () => {
    try {
      toast.info(
        lang === "ar" ? "جاري تجهيز التقرير للطباعة..." : "Preparing document for print...",
      );
      await generatePDF(
        "patient-visits-pdf-container",
        `Visits_Report_${patientName.replace(/\s+/g, "_")}.pdf`,
      );
    } catch (error) {
      console.error("PDF Generation Error:", error);
      toast.error(
        lang === "ar"
          ? "حدث خطأ أثناء إعداد التقرير للطباعة."
          : "An error occurred while generating the PDF.",
      );
    }
  };

  return (
    <>
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>{lang === "ar" ? "سجل الزيارات" : "Visits Log"}</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintVisits}
            disabled={visits.length === 0}
          >
            <Printer className="mr-2 h-4 w-4" />
            {lang === "ar" ? "طباعة تقرير الزيارات" : "Print Visits Report"}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              {lang === "ar" ? "جاري التحميل..." : "Loading..."}
            </p>
          ) : visits.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {lang === "ar" ? "لا توجد زيارات مسجلة." : "No logged visits."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm text-left rtl:text-right">
                <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">{lang === "ar" ? "التاريخ" : "Date"}</th>
                    <th className="px-4 py-3 font-medium">{lang === "ar" ? "الوقت" : "Time"}</th>
                    <th className="px-4 py-3 font-medium">
                      {lang === "ar" ? "تسجيل بواسطة" : "Recorded By"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visits.map((visit) => (
                    <tr key={visit.id} className="bg-card hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        {format(new Date(visit.created_at), "yyyy-MM-dd")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(visit.created_at), "hh:mm a")}
                      </td>
                      <td className="px-4 py-3 font-medium">{visit.recorderName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hidden container for printing */}
      <div className="hidden">
        <div
          id="patient-visits-pdf-container"
          className="w-[800px] min-w-[800px] bg-white p-8 text-black shadow-md rounded-sm"
          dir="ltr"
        >
          {/* Header */}
          <div className="border-b-2 border-[#0f766e] pb-6 mb-8 flex justify-between items-start">
            <div className="flex items-center gap-4">
              <img src={logo} alt="Physio Life" className="h-[90px] w-[90px] object-contain" />
              <div>
                <h2 className="text-3xl font-bold text-[#0f766e]">Physio Life PT Center</h2>
                <p className="text-sm font-medium text-gray-600 mb-2">
                  Physical Therapy & Rehabilitation
                </p>
                <div className="text-xs text-gray-600 leading-relaxed font-semibold">
                  <p dir="rtl">
                    📍 قنا - أمام المستشفى العام - بجوار حلواني شوكلتير - أعلى بنك دبي الوطني
                  </p>
                  <p dir="ltr" className="mt-1">
                    📞 للتواصل والحجز: 01050359331
                  </p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <h3 className="text-2xl font-bold text-gray-800 tracking-wider">VISITS REPORT</h3>
              <p className="text-gray-500 mt-2 font-medium">
                Date: {format(new Date(), "dd/MM/yyyy hh:mm a")}
              </p>
              <p className="text-gray-500 font-medium">Exported by: {fullName}</p>
            </div>
          </div>

          {/* Patient Info */}
          <div className="mb-8 rounded-xl border-2 border-gray-200 p-5 bg-gray-50">
            <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
              <p>
                <span className="font-bold text-gray-500 uppercase mr-2 block text-xs mb-1">
                  Patient Name
                </span>
                <span className="font-semibold text-lg">{patientName}</span>
              </p>
              <p>
                <span className="font-bold text-gray-500 uppercase mr-2 block text-xs mb-1">
                  Total Visits
                </span>
                <span className="font-semibold text-lg">{visits.length}</span>
              </p>
            </div>
          </div>

          {/* Visits List */}
          <div className="mb-8">
            <h4 className="text-lg font-bold text-[#0f766e] border-b border-gray-200 pb-2 mb-4">
              Visits History
            </h4>
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="p-3 border border-gray-200 font-bold">Date</th>
                  <th className="p-3 border border-gray-200 font-bold">Time</th>
                  <th className="p-3 border border-gray-200 font-bold">Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit) => (
                  <tr key={visit.id} className="border-b border-gray-200">
                    <td className="p-3 border-x border-gray-200">
                      {format(new Date(visit.created_at), "yyyy-MM-dd")}
                    </td>
                    <td className="p-3 border-x border-gray-200">
                      {format(new Date(visit.created_at), "hh:mm a")}
                    </td>
                    <td className="p-3 border-x border-gray-200">{visit.recorderName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
