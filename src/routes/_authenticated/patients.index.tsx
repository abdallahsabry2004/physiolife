import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logActivityAsync } from "@/lib/logger"; // استدعاء دالة التوثيق
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/patients/")({
  head: () => ({
    meta: [
      { title: "Patients — Physio Life EMR" },
      {
        name: "description",
        content:
          "Search, filter and register physical therapy patients with permanent medical records at Physio Life.",
      },
      { property: "og:title", content: "Patients — Physio Life EMR" },
      { property: "og:description", content: "Patient register and instant clinical search." },
    ],
  }),
  component: PatientsPage,
});

const emptyForm = {
  full_name: "",
  gender: "",
  age: "",
  phone: "",
  diagnosis: "",
  referral_source: "",
  occupation: "",
  address: "",
};

function PatientsPage() {
  const { user, fullName } = useAuth(); // استدعاء اسم الطبيب
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("all");
  const [gender, setGender] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, code, full_name, gender, age, phone, status, diagnosis, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    return patients.filter((p) => {
      const matches =
        !t ||
        p.full_name.toLowerCase().includes(t) ||
        (p.phone ?? "").includes(t) ||
        p.code.toLowerCase().includes(t) ||
        (p.diagnosis ?? "").toLowerCase().includes(t);
      const statusOk = status === "all" || p.status === status;
      const genderOk = gender === "all" || p.gender === gender;
      return matches && statusOk && genderOk;
    });
  }, [patients, term, status, gender]);

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .insert({
          full_name: form.full_name,
          gender: form.gender || null,
          age: form.age ? Number(form.age) : null,
          phone: form.phone || null,
          diagnosis: form.diagnosis || null,
          referral_source: form.referral_source || null,
          occupation: form.occupation || null,
          address: form.address || null,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      // توثيق تسجيل المريض الجديد في السجلات
      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "ADD_NEW_PATIENT",
        entity: `Patient: ${form.full_name}`,
        details: { ...form }
      });

      return data;
    },
    onSuccess: () => {
      toast.success("Patient registered");
      setForm(emptyForm);
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patients</h1>
          <p className="text-sm text-muted-foreground">
            {patients.length} permanent records · instant search by name, phone, ID or diagnosis
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" /> Register patient
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Register a new patient</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select
                    value={form.gender}
                    onValueChange={(v) => setForm({ ...form, gender: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input
                    id="occupation"
                    value={form.occupation}
                    onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="diagnosis">Working diagnosis</Label>
                <Input
                  id="diagnosis"
                  value={form.diagnosis}
                  onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="referral">Referral source</Label>
                  <Input
                    id="referral"
                    value={form.referral_source}
                    onChange={(e) => setForm({ ...form, referral_source: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                Save patient
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <div className="relative min-w-60 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search name, phone, patient ID or diagnosis…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="discharged">Discharged</SelectItem>
              <SelectItem value="on_hold">On hold</SelectItem>
            </SelectContent>
          </Select>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All genders</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading patients…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No patients match your search.</p>
        )}
        {filtered.map((p) => (
          <Link
            key={p.id}
            to="/patients/$id"
            params={{ id: p.id }}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 transition hover:border-primary"
          >
            <div>
              <p className="font-semibold">{p.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {p.code} · {p.gender ?? "—"} · {p.age ?? "—"} yrs · {p.phone ?? "no phone"}
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="max-w-60 truncate">{p.diagnosis ?? "No diagnosis yet"}</span>
              <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
