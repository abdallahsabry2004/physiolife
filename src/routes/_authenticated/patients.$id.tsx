import { format } from "date-fns";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Plus, Trash2, Edit, AlertTriangle, Download, Loader2, Printer, CalendarPlus, CalendarMinus } from "lucide-react";
import { toast } from "sonner";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { logActivityAsync } from "@/lib/logger";
import { deleteAllPatientDriveFiles } from "@/lib/drive.functions";
import { ClinicalModule } from "@/components/ClinicalModule";
import { PatientFiles } from "@/components/PatientFiles";
import { PatientExercises } from "@/components/PatientExercises";
import { PatientMeasurements } from "@/components/PatientMeasurements";
import { PatientAssessments } from "@/components/PatientAssessments";
import { PatientVisits } from "@/components/PatientVisits";
import { ProfessionalBodyChart } from "@/components/ProfessionalBodyChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import logo from "@/assets/physio-life-logo.png";
import { MedicalAutocomplete } from "@/components/ui/MedicalAutocomplete";

export const Route = createFileRoute("/_authenticated/patients/$id")({
  head: () => ({
    meta: [
      { title: "Patient record — Physio Life EMR" },
      {
        name: "description",
        content:
          "Complete physiotherapy record: history, examination, diagnosis, treatment sessions, files and progress graphs.",
      },
    ],
  }),
  component: PatientDetail,
});

function PatientDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, fullName, canEditClinical, canEditRegistration } = useAuth();
  const { lang, t } = useI18n();
  const qc = useQueryClient();
  const deleteDriveFiles = useServerFn(deleteAllPatientDriveFiles);

  const [editOpen, setEditOpen] = useState(false);
  
  const { data: categories = [] } = useQuery({
    queryKey: ["patient_categories"],
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("category").not("category", "is", null);
      const unique = Array.from(new Set(data?.map(d => d.category?.trim()).filter(Boolean) || []));
      return unique;
    }
  });

  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  const [showReportPreview, setShowReportPreview] = useState(false);

  const { data: todayVisit } = useQuery({
    queryKey: ["today_visit", id],
    queryFn: async () => {
      const today = new Date();
      const start = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const end = new Date(today.setHours(23, 59, 59, 999)).toISOString();
      const { data, error } = await supabase
        .from("patient_records")
        .select("id")
        .eq("patient_id", id)
        .eq("module", "visit")
        .gte("created_at", start)
        .lte("created_at", end)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  
  const cancelVisit = useMutation({
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["today_visit", id] });
      const previousVisit = qc.getQueryData(["today_visit", id]);
      qc.setQueryData(["today_visit", id], null);
      return { previousVisit };
    },
    mutationFn: async () => {
      if (!todayVisit?.id) return;
      const { error } = await supabase.from("patient_records").delete().eq("id", todayVisit.id);
      if (error) throw error;
      await logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "CANCEL_VISIT",
        entity: `Patient ID: ${id}`,
      });
    },
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم إلغاء الزيارة بنجاح" : "Visit cancelled successfully");
    },
    onError: (err, variables, context) => {
      if (context?.previousVisit) qc.setQueryData(["today_visit", id], context.previousVisit);
      toast.error(err.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["today_visit", id] });
      qc.invalidateQueries({ queryKey: ["patient_visits", id] });
    },
  });


  const { data: patient } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treatment_sessions")
        .select("*")
        .eq("patient_id", id)
        .order("session_number", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // استعلام إضافي لجلب البيانات الطبية لتكوين تقرير الـ PDF الشامل
  const { data: reportRecords = [] } = useQuery({
    queryKey: ["report-records", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_records")
        .select("*")
        .eq("patient_id", id)
        .is("session_id", null)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  // تقسيم البيانات للأقسام في الـ PDF
  const historyRecs = reportRecords.filter((r) => r.module === "history");
  const examRecs = reportRecords.filter((r) => r.module === "exam");
  const diagRecs = reportRecords.filter((r) => r.module === "diagnosis");
  const treatmentRecs = reportRecords.filter((r) => r.module === "treatment");

  const [sessionDrafts, setSessionDrafts] = useState<Record<string, string>>({});

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase.from("patients").update({ status: newStatus } as any).eq("id", id);
      if (error) throw error;

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "UPDATE_PATIENT_STATUS",
        entity: `Patient: ${patient?.full_name}`,
        details: { old_status: patient?.status, new_status: newStatus },
      });
    },
    onSuccess: () => {
      toast.success("Patient status updated");
      void qc.invalidateQueries({ queryKey: ["patient", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePatientInfo = useMutation({
    mutationFn: async () => {
      const payload = {
        full_name: editForm['full_name'],
        gender: editForm['gender'] || null,
        age: editForm['age'] ? Number(editForm['age']) : null,
        phone: editForm['phone'] || null,
        diagnosis: editForm['diagnosis'] || null,
        referral_source: editForm['referral_source'] || null,
        referral_phone: editForm['referral_phone'] || null,
        occupation: editForm['occupation'] || null,
        patient_address: editForm['patient_address'] || null,
        referral_address: editForm['referral_address'] || null,
        category: editForm["category"] || null,
      };

      
      
      const { error } = await supabase.from("patients").update(payload as any).eq("id", id);
      if (error) throw error;

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "UPDATE_PATIENT_PROFILE",
        entity: `Patient: ${payload.full_name}`,
        details: { old_data: patient, new_data: payload },
      });
    },
    onSuccess: () => {
      toast.success("Patient details updated");
      setEditOpen(false);
      void qc.invalidateQueries({ queryKey: ["patient", id] });
      void qc.invalidateQueries({ queryKey: ["patients"] });
      void qc.invalidateQueries({ queryKey: ["patients-min"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const logVisit = useMutation({
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["today_visit", id] });
      const previousVisit = qc.getQueryData(["today_visit", id]);
      // Optimistically set a fake visit ID so the button immediately toggles
      qc.setQueryData(["today_visit", id], { id: "temp-optimistic-id" });
      return { previousVisit };
    },
    mutationFn: async () => {
      const { error } = await supabase.from("patient_records").insert({
        patient_id: id,
        module: "visit",
        label: "Patient Visit",
        recorded_by: user?.id ?? null,
      });
      if (error) throw error;
      
      await logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "LOG_VISIT",
        entity: `Patient ID: ${id}`,
      });
    },
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم تسجيل الزيارة بنجاح" : "Visit logged successfully");
    },
    onError: (err, variables, context) => {
      qc.setQueryData(["today_visit", id], context?.previousVisit);
      toast.error(err.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["today_visit", id] });
      qc.invalidateQueries({ queryKey: ["patient_visits", id] });
    },
  });

  const deletePatient = useMutation({
    mutationFn: async () => {
      if (!user?.email) throw new Error("Email not found");

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword,
      });
      if (authError) throw new Error("Invalid password");

      try {
        await deleteDriveFiles({ data: { patientId: id } });
      } catch (err) {
        console.error("Failed to delete drive files before deleting patient", err);
      }

      const { error: deleteError } = await supabase.rpc("delete_patient_completely", { p_id: id });
      if (deleteError) throw deleteError;

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "HARD_DELETE_PATIENT",
        entity: `Patient: ${patient?.full_name}`,
        details: { patient_code: patient?.code, deleted_data: patient },
      });
    },
    onSuccess: () => {
      toast.success("Patient permanently deleted");
      setDeleteOpen(false);
      void qc.invalidateQueries({ queryKey: ["patients"] });
      void navigate({ to: "/patients" });
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const newSession = useMutation({
    mutationFn: async () => {
      const sessionNum = (sessions[0]?.session_number ?? 0) + 1;
      const { error } = await supabase.from("treatment_sessions").insert({
        patient_id: id,
        session_number: sessionNum,
        therapist_id: user?.id ?? null,
      });
      if (error) throw error;

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "CREATE_SESSION",
        entity: "Treatment Session",
        details: { patient_id: id, session_number: sessionNum },
      });
    },
    onSuccess: () => {
      toast.success("New visit opened");
      void qc.invalidateQueries({ queryKey: ["sessions", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSession = useMutation({
    mutationFn: async ({ sid, patch }: { sid: string; patch: Record<string, unknown> }) => {
      const oldSession = sessions.find((s) => s.id === sid);
      const { error } = await supabase
        .from("treatment_sessions")
        .update(patch as never)
        .eq("id", sid);
      if (error) throw error;

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "UPDATE_SESSION_DETAILS",
        entity: `Treatment Session #${oldSession?.session_number}`,
        details: { patient_id: id, session_id: sid, updates_applied: patch },
      });
    },
    onSuccess: () => {
      toast.success("Session saved");
      void qc.invalidateQueries({ queryKey: ["sessions", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const oldSession = sessions.find((s) => s.id === sessionId);
      const { error } = await supabase.from("treatment_sessions").delete().eq("id", sessionId);
      if (error) throw error;

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "DELETE_SESSION",
        entity: `Treatment Session #${oldSession?.session_number}`,
        details: { patient_id: id, session_id: sessionId, deleted_data: oldSession },
      });
    },
    onSuccess: () => {
      toast.success("Session deleted successfully");
      void qc.invalidateQueries({ queryKey: ["sessions", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  
  const handlePrintEditedReport = async () => {
    try {
      const { generatePDF } = await import("@/lib/pdf");
      toast.info("Preparing document for print...");
      await generatePDF(
        "patient-report-pdf-container",
        `Patient_Report_${patient?.full_name?.replace(/\s+/g, "_") || "Report"}.pdf`
      );
    } catch (error) {
      console.error("PDF Generation Error:", error);
      toast.error("An error occurred while generating the PDF.");
    }
  };
const painSeries = [...sessions]
    .reverse()
    .filter((s) => s.pain_before !== null || s.pain_after !== null)
    .map((s) => ({
      name: `#${s.session_number}`,
      before: s.pain_before,
      after: s.pain_after,
    }));

  const openEditModal = () => {
    if (patient) {
      setEditForm({
        full_name: patient.full_name || "",
        gender: patient.gender || "",
        age: patient.age || "",
        phone: patient.phone || "",
        diagnosis: patient.diagnosis || "",
        referral_source: patient.referral_source || "",
        referral_phone: patient.referral_phone || "",
        occupation: patient.occupation || "",
        patient_address: patient.patient_address || "",
        referral_address: patient.referral_address || "",
        category: patient.category || "",
      });
      setEditOpen(true);
    }
  };

  if (!patient) return <p className="text-sm text-muted-foreground">{t("pt.loadingRecord")}</p>;

  return (
    <div className="space-y-6">
      {/* ----------------- قالب تصدير التقرير الطبي الشامل (PDF Export Container) ----------------- */}
      
      <Dialog open={showReportPreview} onOpenChange={setShowReportPreview}>
        <DialogContent className="max-w-[850px] max-h-[90vh] overflow-y-auto bg-gray-100">
          <DialogHeader className="mb-2">
            <DialogTitle>Preview & Edit Report</DialogTitle>
            <p className="text-sm text-muted-foreground">
              You can click anywhere on the text below to edit it before printing. When ready, click Print.
            </p>
          </DialogHeader>
          <div className="flex justify-end mb-2">
            <Button onClick={handlePrintEditedReport}>
              <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
            </Button>
          </div>
          <div className="flex justify-center overflow-x-auto pb-4">
            <div 
              id="patient-report-pdf-container" 
              className="w-[800px] min-w-[800px] bg-white p-8 text-black shadow-md rounded-sm outline-none"
              contentEditable={true}
              suppressContentEditableWarning={true}
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
                <h3 className="text-2xl font-bold text-gray-800 tracking-wider">MEDICAL REPORT</h3>
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
                  </span>{" "}
                  <span className="font-bold text-xl text-black">{patient.full_name}</span>
                </p>
                <p>
                  <span className="font-bold text-gray-500 uppercase mr-2 block text-xs mb-1">
                    Patient ID
                  </span>{" "}
                  <span className="font-bold text-lg text-black">{patient.code}</span>
                </p>
                
                <p>
                  <span className="font-bold text-gray-500 uppercase mr-2 block text-xs mb-1">
                    Category
                  </span>{" "}
                  <span className="font-semibold text-gray-900 text-base">
                    {patient.category || "-"}
                  </span>
                </p>

                <p>
                  <span className="font-bold text-gray-500 uppercase mr-2 block text-xs mb-1">
                    Age / Gender
                  </span>{" "}
                  <span className="font-semibold text-gray-900 text-base">
                    {patient.age || "-"} yrs / {patient.gender || "-"}
                  </span>
                </p>
                <p>
                  <span className="font-bold text-gray-500 uppercase mr-2 block text-xs mb-1">
                    Diagnosis
                  </span>{" "}
                  <span className="font-semibold text-gray-900 text-base">
                    {patient.diagnosis || "Not specified"}
                  </span>
                </p>
              </div>
            </div>

            {/* History Section */}
            {historyRecs.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xl font-bold text-[#0f766e] border-b-2 border-gray-100 pb-2 mb-4">
                  1. Medical History
                </h4>
                <div className="space-y-4">
                  {historyRecs.map((r) => (
                    <div key={r.id}>
                      <p className="text-sm font-bold text-gray-800">{r.label}:</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-1">
                        {r.value || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Examination Section */}
            {examRecs.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xl font-bold text-[#0f766e] border-b-2 border-gray-100 pb-2 mb-4">
                  2. Physical Examination
                </h4>
                <div className="space-y-4">
                  {examRecs.map((r) => (
                    <div key={r.id}>
                      <p className="text-sm font-bold text-gray-800">{r.label}:</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-1">
                        {r.value || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Diagnosis Section */}
            {diagRecs.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xl font-bold text-[#0f766e] border-b-2 border-gray-100 pb-2 mb-4">
                  3. Diagnosis
                </h4>
                <div className="space-y-4">
                  {diagRecs.map((r) => (
                    <div key={r.id}>
                      <p className="text-sm font-bold text-gray-800">{r.label}:</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-1">
                        {r.value || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Treatment Plan Section */}
            {treatmentRecs.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xl font-bold text-[#0f766e] border-b-2 border-gray-100 pb-2 mb-4">
                  4. Treatment Plan
                </h4>
                <div className="space-y-4">
                  {treatmentRecs.map((r) => (
                    <div key={r.id}>
                      <p className="text-sm font-bold text-gray-800">{r.label}:</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-1">
                        {r.value || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sessions Overview (Latest 3) */}
            {sessions.length > 0 && (
              <div className="mb-6" style={{ pageBreakInside: "avoid" }}>
                <h4 className="text-xl font-bold text-[#0f766e] border-b-2 border-gray-100 pb-2 mb-4">
                  5. Recent Treatment Sessions
                </h4>
                <div className="space-y-4">
                  {sessions.slice(0, 3).map((s) => (
                    <div key={s.id} className="border border-gray-300 rounded-lg p-4 bg-white">
                      <h5 className="font-bold text-md text-gray-900 mb-3 border-b border-gray-100 pb-2">
                        Session #{s.session_number} — {s.session_date}
                      </h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="font-bold text-xs text-gray-500 uppercase">
                            Subjective
                          </span>{" "}
                          <p className="text-sm text-gray-800 mt-1">{s.subjective || "—"}</p>
                        </div>
                        <div>
                          <span className="font-bold text-xs text-gray-500 uppercase">
                            Objective
                          </span>{" "}
                          <p className="text-sm text-gray-800 mt-1">{s.objective || "—"}</p>
                        </div>
                        <div>
                          <span className="font-bold text-xs text-gray-500 uppercase">
                            Assessment
                          </span>{" "}
                          <p className="text-sm text-gray-800 mt-1">{s.assessment || "—"}</p>
                        </div>
                        <div>
                          <span className="font-bold text-xs text-gray-500 uppercase">Plan</span>{" "}
                          <p className="text-sm text-gray-800 mt-1">{s.plan || "—"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Text */}
            <div className="mt-12 pt-6 border-t border-gray-200 text-center">
              <p className="font-bold text-lg text-[#0f766e] mb-2">Physio Life PT Center</p>
              <p className="text-sm text-gray-600 font-medium">
                Your health and progress are our top priority.
              </p>
              <p className="text-sm text-gray-400 mt-1">
                This is an officially generated electronic medical report.
              </p>
            </div>
          </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* --------------------------------------------------------------------------------------- */}

      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <Link
            to="/patients"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mx-1 h-4 w-4" /> {t("pt.allPatients")}
          </Link>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{patient.full_name}</h1>
            {canEditRegistration && (
              <Button
                variant="ghost"
                size="icon"
                onClick={openEditModal}
                className="text-muted-foreground hover:text-primary"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {patient.code} · {patient.gender === "male" ? t("pt.male") : patient.gender === "female" ? t("pt.female") : "—"} · {patient.age ?? "—"} {t("pt.yrs")} ·{" "}
            {patient.phone ?? t("pt.noPhone")}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {canEditClinical ? (
            <Select value={patient.status} onValueChange={(val) => updateStatus.mutate(val)}>
              <SelectTrigger className="w-32 h-9 capitalize font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("pt.active")}</SelectItem>
                <SelectItem value="on_hold">{t("pt.onHold")}</SelectItem>
                <SelectItem value="discharged">{t("pt.discharged")}</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="secondary" className="self-center capitalize">
              {patient.status === "active" ? t("pt.active") : patient.status === "on_hold" ? t("pt.onHold") : patient.status === "discharged" ? t("pt.discharged") : patient.status}
            </Badge>
          )}

                    
                    {todayVisit ? (
            <Button variant="destructive" onClick={() => cancelVisit.mutate()} disabled={cancelVisit.isPending}>
              {cancelVisit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarMinus className="mr-2 h-4 w-4" />}
              {t("pt.cancelVisitLog")}
            </Button>
          ) : (
            <Button variant="default" onClick={() => logVisit.mutate()} disabled={logVisit.isPending}>
              {logVisit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarPlus className="mr-2 h-4 w-4" />}
              {t("pt.logVisit")}
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowReportPreview(true)}>
            <Printer className="mx-2 h-4 w-4" /> {t("pt.previewPrintReport")}
          </Button>

          {canEditClinical && (
            <Button
              variant="destructive"
              onClick={() => {
                setDeletePassword("");
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="mx-2 h-4 w-4" /> {t("pt.delete")}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("pt.editPatientDetails")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4 mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              updatePatientInfo.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>{t("pt.fullName")}</Label>
              <Input
                value={editForm['full_name']}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("pt.gender")}</Label>
                <Select
                  value={editForm['gender']}
                  onValueChange={(v) => setEditForm({ ...editForm, gender: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("pt.select")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>{t("pt.category")}</Label>
                <Input
                  list="patient_categories_list_edit"
                  value={editForm['category']}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                />
                <datalist id="patient_categories_list_edit">
                  {categories.map((c: string) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <Label>{t("pt.age")}</Label>
                <Input
                  type="number"
                  value={editForm['age']}
                  onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("pt.phone")}</Label>
                <Input
                  value={editForm['phone']}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("pt.occupation")}</Label>
                <Input
                  value={editForm['occupation']}
                  onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("pt.patientAddress")}</Label>
              <Input
                value={editForm['patient_address']}
                onChange={(e) => setEditForm({ ...editForm, patient_address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("pt.diagnosis")}</Label>
              <MedicalAutocomplete
                value={editForm['diagnosis']}
                onChange={(val) => setEditForm({ ...editForm, diagnosis: val })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("pt.referralSource")}</Label>
                <Input
                  value={editForm['referral_source']}
                  onChange={(e) => setEditForm({ ...editForm, referral_source: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("pt.referralPhone")}</Label>
                <Input
                  value={editForm['referral_phone']}
                  onChange={(e) => setEditForm({ ...editForm, referral_phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("pt.referralAddress")}</Label>
              <Input
                value={editForm['referral_address']}
                onChange={(e) => setEditForm({ ...editForm, referral_address: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={updatePatientInfo.isPending}>
              {updatePatientInfo.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="mx-2 h-5 w-5" /> {t("pt.permanentDelete")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              {t("pt.deleteWarning").split("{name}")[0]}<strong>{patient.full_name}</strong>{t("pt.deleteWarning").split("{name}")[1]}
            </p>
            <div className="space-y-2">
              <Label htmlFor="auth-password">{t("pt.enterPassword")}</Label>
              <Input
                id="auth-password"
                type="password"
                placeholder="********"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeletePassword("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deletePatient.isPending || !deletePassword}
                onClick={() => deletePatient.mutate()}
              >
                {deletePatient.isPending ? "Deleting..." : "Confirm Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="history">
        <TabsList className="flex h-auto flex-wrap justify-start print:hidden">
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="exam">Examination</TabsTrigger>
          <TabsTrigger value="diagnosis">Diagnosis</TabsTrigger>
          <TabsTrigger value="treatment">Treatment</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="body">Body chart</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="measures">Measurements</TabsTrigger>
          <TabsTrigger value="questionnaires">Questionnaires</TabsTrigger>
          <TabsTrigger value="program">Home program</TabsTrigger>
                    <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="visits">Visits</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-6">
          <ClinicalModule
            patientId={id}
            module="history"
            title="Complete medical history"
            description="Add only the items relevant to this patient — suggestions below, or type your own."
          />
        </TabsContent>
        <TabsContent value="exam" className="mt-6">
          <ClinicalModule
            patientId={id}
            module="exam"
            title="Physical examination"
            description="Vital signs, observation, ROM, strength, neurological and special tests."
          />
        </TabsContent>
        <TabsContent value="diagnosis" className="mt-6">
          <ClinicalModule
            patientId={id}
            module="diagnosis"
            title="Diagnosis"
          />
        </TabsContent>
        <TabsContent value="treatment" className="mt-6">
          <ClinicalModule
            patientId={id}
            module="treatment"
            title="Treatment Plan"
          />
        </TabsContent>

        <TabsContent value="sessions" className="mt-6 space-y-4">
          {canEditClinical && (
            <Button onClick={() => newSession.mutate()} className="print:hidden">
              <Plus className="mr-2 h-4 w-4" /> Open a new visit
            </Button>
          )}
          {sessions.length === 0 && (
            <p className="text-sm text-muted-foreground">No visits recorded yet.</p>
          )}
          {sessions.map((s) => (
            <Card key={s.id} className="overflow-visible">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-bold text-primary">
                  Session #{s.session_number} · {s.session_date}
                </CardTitle>
                {canEditClinical && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive print:hidden"
                    onClick={() => {
                      if (
                        confirm(
                          "Are you sure you want to delete this session? This action cannot be undone.",
                        )
                      ) {
                        deleteSession.mutate(s.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4 overflow-visible">
                <div className="grid gap-4 md:grid-cols-2">
                  {(["subjective", "objective", "assessment", "plan"] as const).map((k) => (
                    <div key={k} className="space-y-2 relative">
                      <Label className="capitalize font-bold text-gray-700">{k}</Label>
                      {!canEditClinical ? (
                        <div className="text-sm p-3 border rounded-md min-h-[60px] bg-transparent">
                          {s[k] || "—"}
                        </div>
                      ) : (
                        <div
                          onBlur={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                              const draftValue = sessionDrafts[`${s.id}-${k}`] ?? s[k] ?? "";
                              if ((s[k] ?? "") !== draftValue) {
                                updateSession.mutate({ sid: s.id, patch: { [k]: draftValue } });
                              }
                            }
                          }}
                        >
                          <MedicalAutocomplete
                            value={sessionDrafts[`${s.id}-${k}`] ?? s[k] ?? ""}
                            onChange={(val) =>
                              setSessionDrafts((prev) => ({ ...prev, [`${s.id}-${k}`]: val }))
                            }
                            placeholder={`Enter ${k} notes...`}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-3 pt-2">
                  <div className="space-y-2">
                    <Label className="font-bold text-gray-700">Pain before (0-10)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      disabled={!canEditClinical}
                      defaultValue={s.pain_before ?? ""}
                      onBlur={(e) =>
                        updateSession.mutate({
                          sid: s.id,
                          patch: { pain_before: e.target.value ? Number(e.target.value) : null },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-gray-700">Pain after (0-10)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      disabled={!canEditClinical}
                      defaultValue={s.pain_after ?? ""}
                      onBlur={(e) =>
                        updateSession.mutate({
                          sid: s.id,
                          patch: { pain_after: e.target.value ? Number(e.target.value) : null },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-gray-700">Duration (min)</Label>
                    <Input
                      type="number"
                      disabled={!canEditClinical}
                      defaultValue={s.duration_minutes ?? ""}
                      onBlur={(e) =>
                        updateSession.mutate({
                          sid: s.id,
                          patch: {
                            duration_minutes: e.target.value ? Number(e.target.value) : null,
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <ClinicalModule
                    patientId={id}
                    module="session"
                    sessionId={s.id}
                    title="Interventions performed"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="body" className="mt-6 space-y-4">
          <ProfessionalBodyChart patientId={id} sessionId={undefined} />
        </TabsContent>

        <TabsContent value="progress" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pain across sessions</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {painSeries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Record pain before/after in sessions to build the graph.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={painSeries}>
                    <XAxis dataKey="name" stroke="currentColor" fontSize={12} />
                    <YAxis domain={[0, 10]} stroke="currentColor" fontSize={12} />
                    <ChartTooltip />
                    <Line
                      type="monotone"
                      dataKey="before"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                    />
                    <Line type="monotone" dataKey="after" stroke="var(--chart-2)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="measures" className="mt-6">
          <PatientMeasurements patientId={id} />
        </TabsContent>

        <TabsContent value="questionnaires" className="mt-6">
          <PatientAssessments patientId={id} />
        </TabsContent>

        <TabsContent value="program" className="mt-6">
          <PatientExercises patientId={id} />
        </TabsContent>

                <TabsContent value="files" className="mt-6">
          <PatientFiles patientId={id} />
        </TabsContent>
        <TabsContent value="visits" className="mt-6">
          <PatientVisits patientId={id} patientName={patient.full_name} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
