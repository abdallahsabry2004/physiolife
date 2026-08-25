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

export function PatientVisits({ patientId, patientName }: { patientId: string; patientName: string }) {
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
      const userIds = [...new Set(data.map(d => d.recorded_by).filter(Boolean))];
      
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds as string[]);
        
        if (profiles) {
          profiles.forEach(p => {
            profilesMap[p.id] = p.full_name || "Unknown";
          });
        }
      }

      return data.map(d => ({
        ...d,
        recorderName: d.recorded_by ? profilesMap[d.recorded_by] || "Unknown" : "Unknown"
      }));
    },
  });

  const printVisits = () => {
    const printContent = document.getElementById("visits-print-area");
    if (!printContent) return;

    const originalContents = document.body.innerHTML;
    const printWindow = document.createElement("div");
    printWindow.innerHTML = `
      <div style="padding: 40px; font-family: sans-serif; direction: ${lang === "ar" ? "rtl" : "ltr"}">
        <h2 style="text-align: center; margin-bottom: 5px;">${lang === "ar" ? "تقرير زيارات المريض" : "Patient Visits Report"}</h2>
        <h3 style="text-align: center; margin-bottom: 30px; color: #555;">${lang === "ar" ? "اسم المريض:" : "Patient Name:"} ${patientName}</h3>
        <table style="width: 100%; border-collapse: collapse; text-align: ${lang === "ar" ? "right" : "left"};">
          <thead>
            <tr style="background: #f4f4f4;">
              <th style="padding: 12px; border: 1px solid #ddd;">${lang === "ar" ? "التاريخ" : "Date"}</th>
              <th style="padding: 12px; border: 1px solid #ddd;">${lang === "ar" ? "الوقت" : "Time"}</th>
              <th style="padding: 12px; border: 1px solid #ddd;">${lang === "ar" ? "تسجيل بواسطة" : "Recorded By"}</th>
            </tr>
          </thead>
          <tbody>
            ${visits.map(v => `
              <tr>
                <td style="padding: 12px; border: 1px solid #ddd;">${format(new Date(v.created_at), "yyyy-MM-dd")}</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${format(new Date(v.created_at), "hh:mm a")}</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${v.recorderName}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div style="margin-top: 40px; text-align: ${lang === "ar" ? "left" : "right"}; color: #666; font-size: 12px;">
          ${lang === "ar" ? "تمت الطباعة بواسطة:" : "Printed by:"} ${fullName} <br/>
          ${lang === "ar" ? "تاريخ الطباعة:" : "Print Date:"} ${format(new Date(), "yyyy-MM-dd hh:mm a")}
        </div>
      </div>
    `;

    document.body.innerHTML = "";
    document.body.appendChild(printWindow);
    window.print();
    window.location.reload(); // Quick restore
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>{lang === "ar" ? "سجل الزيارات" : "Visits Log"}</CardTitle>
        <Button variant="outline" size="sm" onClick={printVisits} disabled={visits.length === 0}>
          <Printer className="mr-2 h-4 w-4" />
          {lang === "ar" ? "طباعة تقرير الزيارات" : "Print Visits Report"}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</p>
        ) : visits.length === 0 ? (
          <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا توجد زيارات مسجلة." : "No logged visits."}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border" id="visits-print-area">
            <table className="w-full text-sm text-left rtl:text-right">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                <tr>
                  <th className="px-4 py-3 font-medium">{lang === "ar" ? "التاريخ" : "Date"}</th>
                  <th className="px-4 py-3 font-medium">{lang === "ar" ? "الوقت" : "Time"}</th>
                  <th className="px-4 py-3 font-medium">{lang === "ar" ? "تسجيل بواسطة" : "Recorded By"}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visits.map((visit) => (
                  <tr key={visit.id} className="bg-card hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">{format(new Date(visit.created_at), "yyyy-MM-dd")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{format(new Date(visit.created_at), "hh:mm a")}</td>
                    <td className="px-4 py-3 font-medium">{visit.recorderName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
