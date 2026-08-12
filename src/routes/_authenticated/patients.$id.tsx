import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Printer, Trash2, Edit, AlertTriangle, Eye } from "lucide-react";
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
import { logActivityAsync } from "@/lib/logger";
import { ClinicalModule } from "@/components/ClinicalModule";
import { PatientFiles } from "@/components/PatientFiles";
import { PatientExercises } from "@/components/PatientExercises";
import { PatientMeasurements } from "@/components/PatientMeasurements";
import { PatientAssessments } from "@/components/PatientAssessments";
import { ProfessionalBodyChart } from "@/components/ProfessionalBodyChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import logo from "@/assets/physio-life-logo.png";
import { MedicalAutocomplete } from "@/components/ui/MedicalAutocomplete"; //[cite: 1] استيراد المكون

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
  const { user, fullName, canEditClinical } = useAuth();
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

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

  // حالة لتخزين التعديلات المؤقتة لملاحظات الجلسة قبل حفظها
  const [sessionDrafts, setSessionDrafts] = useState<Record<string, string>>({});

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase.from("patients").update({ status: newStatus }).eq("id", id);
      if (error) throw error;

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "UPDATE_PATIENT_STATUS",
        entity: `Patient: ${patient?.full_name}`,
        details: { old_status: patient?.status, new_status: newStatus }
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
        full_name: editForm.full_name,
        gender: editForm.gender || null,
        age: editForm.age ? Number(editForm.age) : null,
        phone: editForm.phone || null,
        diagnosis: editForm.diagnosis || null,
        referral_source: editForm.referral_source || null,
        occupation: editForm.occupation || null,
        address: editForm.address || null,
      };

      const { error } = await supabase.from("patients").update(payload).eq("id", id);
      if (error) throw error;

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "UPDATE_PATIENT_PROFILE",
        entity: `Patient: ${payload.full_name}`,
        details: { old_data: patient, new_data: payload }
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

  const deletePatient = useMutation({
    mutationFn: async () => {
      if (!user?.email) throw new Error("Email not found");
      
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword,
      });
      if (authError) throw new Error("Invalid password");

      const { error: deleteError } = await supabase.rpc('delete_patient_completely', { p_id: id });
      if (deleteError) throw deleteError;

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "HARD_DELETE_PATIENT",
        entity: `Patient: ${patient?.full_name}`,
        details: { patient_code: patient?.code, deleted_data: patient }
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
        details: { patient_id: id, session_number: sessionNum }
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
      const oldSession = sessions.find(s => s.id === sid);
      const { error } = await supabase.from("treatment_sessions").update(patch as never).eq("id", sid);
      if (error) throw error;

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "UPDATE_SESSION_DETAILS",
        entity: `Treatment Session #${oldSession?.session_number}`,
        details: { patient_id: id, session_id: sid, updates_applied: patch }
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
      const oldSession = sessions.find(s => s.id === sessionId);
      const { error } = await supabase.from("treatment_sessions").delete().eq("id", sessionId);
      if (error) throw error;

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "DELETE_SESSION",
        entity: `Treatment Session #${oldSession?.session_number}`,
        details: { patient_id: id, session_id: sessionId, deleted_data: oldSession }
      });
    },
    onSuccess: () => {
      toast.success("Session deleted successfully");
      void qc.invalidateQueries({ queryKey: ["sessions", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
        occupation: patient.occupation || "",
        address: patient.address || "",
      });
      setEditOpen(true);
    }
  };

  if (!patient) return <p className="text-sm text-muted-foreground">Loading record…</p>;

  return (
    <div className="space-y-6">
      
      {/* ترويسة الطباعة الأصلية كما طلبت */}
      <div className="hidden print:block border-b-2 border-primary pb-6 mb-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Physio Life" className="h-16 w-16" />
            <div>
              <h2 className="text-2xl font-bold text-primary">Physio Life PT Center</h2>
              <p className="text-sm font-medium text-gray-600">Physical Therapy & Rehabilitation</p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-500 space-y-1">
            <p><span className="font-semibold text-gray-700">Print Date:</span> {new Date().toLocaleString('en-GB')}</p>
            <p><span className="font-semibold text-gray-700">Printed by:</span> {fullName}</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border-2 border-gray-200 p-4">
          <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm">
            <p><span className="font-semibold text-gray-500 mr-2">Patient Name:</span> <span className="font-bold text-lg">{patient.full_name}</span></p>
            <p><span className="font-semibold text-gray-500 mr-2">Patient ID:</span> <span className="font-medium">{patient.code}</span></p>
            <p><span className="font-semibold text-gray-500 mr-2">Age / Gender:</span> <span className="font-medium">{patient.age || "-"} yrs / {patient.gender || "-"}</span></p>
            <p><span className="font-semibold text-gray-500 mr-2">Diagnosis:</span> <span className="font-medium">{patient.diagnosis || "Not specified"}</span></p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <Link to="/patients" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All patients
          </Link>
          
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{patient.full_name}</h1>
            {canEditClinical && (
              <Button variant="ghost" size="icon" onClick={openEditModal} className="text-muted-foreground hover:text-primary">
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {patient.code} · {patient.gender ?? "—"} · {patient.age ?? "—"} yrs ·{" "}
            {patient.phone ?? "no phone"}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          
          {canEditClinical ? (
            <Select value={patient.status} onValueChange={(val) => updateStatus.mutate(val)}>
              <SelectTrigger className="w-32 h-9 capitalize font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_hold">On hold</SelectItem>
                <SelectItem value="discharged">Discharged</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="secondary" className="self-center capitalize">
              {patient.status}
            </Badge>
          )}

          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>

          {canEditClinical && (
            <Button variant="destructive" onClick={() => { setDeletePassword(""); setDeleteOpen(true); }}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Patient Details</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4 mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              updatePatientInfo.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={editForm.gender} onValueChange={(v) => setEditForm({ ...editForm, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Age</Label>
                <Input
                  type="number"
                  value={editForm.age}
                  onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Occupation</Label>
                <Input
                  value={editForm.occupation}
                  onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Working diagnosis</Label>
              {/*[cite: 1] استخدام المكون الذكي هنا لتسهيل إدخال التشخيص */}
              <MedicalAutocomplete
                value={editForm.diagnosis}
                onChange={(val) => setEditForm({ ...editForm, diagnosis: val })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Referral source</Label>
                <Input
                  value={editForm.referral_source}
                  onChange={(e) => setEditForm({ ...editForm, referral_source: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>
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
              <AlertTriangle className="h-5 w-5" /> Permanent Delete Patient
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Are you absolutely sure you want to delete <strong>{patient.full_name}</strong>? 
              This action cannot be undone. All clinical records, sessions, and files associated with this patient will be permanently removed.
            </p>
            <div className="space-y-2">
              <Label htmlFor="auth-password">Enter your password to confirm</Label>
              <Input
                id="auth-password"
                type="password"
                placeholder="********"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeletePassword(""); }}>
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
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="exam">Examination</TabsTrigger>
          <TabsTrigger value="diagnosis">Diagnosis & Plan</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="body">Body chart</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="measures">Measurements</TabsTrigger>
          <TabsTrigger value="questionnaires">Questionnaires</TabsTrigger>
          <TabsTrigger value="program">Home program</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-6">
          <ClinicalModule patientId={id} module="history" title="Complete medical history" description="Add only the items relevant to this patient — suggestions below, or type your own." />
        </TabsContent>
        <TabsContent value="exam" className="mt-6">
          <ClinicalModule patientId={id} module="exam" title="Physical examination" description="Vital signs, observation, ROM, strength, neurological and special tests." />
        </TabsContent>
        <TabsContent value="diagnosis" className="mt-6">
          <ClinicalModule patientId={id} module="diagnosis" title="Diagnosis, goals and treatment plan" />
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
            <Card key={s.id} className="print:mb-4 overflow-visible">
              <CardHeader className="flex flex-row items-center justify-between pb-2 print:pb-1">
                <CardTitle className="text-base font-bold text-primary print:text-black">
                  Session #{s.session_number} · {s.session_date}
                </CardTitle>
                {canEditClinical && (
                  <Button
                    variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive print:hidden"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this session? This action cannot be undone.")) {
                        deleteSession.mutate(s.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4 print:space-y-2 overflow-visible">
                <div className="grid gap-4 md:grid-cols-2">
                  {(["subjective", "objective", "assessment", "plan"] as const).map((k) => (
                    <div key={k} className="space-y-2 print:space-y-0 relative">
                      <Label className="capitalize font-bold text-gray-700">{k}</Label>
                      {/*[cite: 1] استبدال Textarea بمكون الاقتراحات مع توفير مساحة عرض مناسبة */}
                      {!canEditClinical ? (
                        <div className="text-sm p-3 border rounded-md min-h-[60px] bg-transparent print:border-none print:p-0">
                          {s[k] || "—"}
                        </div>
                      ) : (
                        <div 
                          onBlur={(e) => {
                            // نمنع تحديث القيمة إذا كان التركيز لا يزال داخل القائمة المنسدلة
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
                            onChange={(val) => setSessionDrafts(prev => ({ ...prev, [`${s.id}-${k}`]: val }))}
                            placeholder={`Enter ${k} notes...`}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-3 print:grid-cols-3 pt-2">
                  <div className="space-y-2 print:space-y-0">
                    <Label className="font-bold text-gray-700">Pain before (0-10)</Label>
                    <Input type="number" min={0} max={10} disabled={!canEditClinical} defaultValue={s.pain_before ?? ""} onBlur={(e) => updateSession.mutate({ sid: s.id, patch: { pain_before: e.target.value ? Number(e.target.value) : null } })} />
                  </div>
                  <div className="space-y-2 print:space-y-0">
                    <Label className="font-bold text-gray-700">Pain after (0-10)</Label>
                    <Input type="number" min={0} max={10} disabled={!canEditClinical} defaultValue={s.pain_after ?? ""} onBlur={(e) => updateSession.mutate({ sid: s.id, patch: { pain_after: e.target.value ? Number(e.target.value) : null } })} />
                  </div>
                  <div className="space-y-2 print:space-y-0">
                    <Label className="font-bold text-gray-700">Duration (min)</Label>
                    <Input type="number" disabled={!canEditClinical} defaultValue={s.duration_minutes ?? ""} onBlur={(e) => updateSession.mutate({ sid: s.id, patch: { duration_minutes: e.target.value ? Number(e.target.value) : null } })} />
                  </div>
                </div>
                <div className="pt-2">
                  <ClinicalModule patientId={id} module="session" sessionId={s.id} title="Interventions performed" />
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
            <CardHeader><CardTitle className="text-base">Pain across sessions</CardTitle></CardHeader>
            <CardContent className="h-72">
              {painSeries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Record pain before/after in sessions to build the graph.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={painSeries}>
                    <XAxis dataKey="name" stroke="currentColor" fontSize={12} />
                    <YAxis domain={[0, 10]} stroke="currentColor" fontSize={12} />
                    <ChartTooltip />
                    <Line type="monotone" dataKey="before" stroke="var(--chart-1)" strokeWidth={2} />
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

      </Tabs>
    </div>
  );
}


