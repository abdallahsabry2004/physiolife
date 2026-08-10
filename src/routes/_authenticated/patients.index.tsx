import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logActivityAsync } from "@/lib/logger"; 
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
  const { user, fullName } = useAuth(); 
  const qc = useQueryClient();
  
  // حالات التحكم في البحث والفلترة وتقسيم الصفحات (Pagination States)
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("all");
  const [gender, setGender] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // استعلام ذكي يجلب البيانات على أجزاء من الخادم مباشرة (Server-Side Pagination)
  const { data, isLoading } = useQuery({
    queryKey: ["patients", page, pageSize, searchTerm, status, gender],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // نطلب البيانات مع العدد الإجمالي للمرضى
      let query = supabase
        .from("patients")
        .select("id, code, full_name, gender, age, phone, status, diagnosis, created_at", { count: "exact" })
        .is("deleted_at", null);

      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }
      if (status !== "all") {
        query = query.eq("status", status);
      }
      if (gender !== "all") {
        query = query.eq("gender", gender);
      }

      const { data: rows, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { items: rows, total: count ?? 0 };
    },
    placeholderData: (prev) => prev, // لمنع وميض الشاشة أثناء التنقل بين الصفحات
  });

  const totalPages = Math.ceil((data?.total ?? 0) / pageSize) || 1;

  // تنفيذ البحث عند الضغط على Enter أو زر البحث
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(searchInput);
    setPage(1); // العودة للصفحة الأولى عند كل عملية بحث جديدة
  };

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
            {data?.total ?? 0} permanent records · instant search by name, phone or ID
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
          <form onSubmit={handleSearch} className="relative min-w-60 flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name, phone or patient ID…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">Search</Button>
          </form>
          <Select 
            value={status} 
            onValueChange={(val) => { setStatus(val); setPage(1); }}
          >
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
          <Select 
            value={gender} 
            onValueChange={(val) => { setGender(val); setPage(1); }}
          >
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
        {isLoading && !data && <p className="text-sm text-muted-foreground">Loading patients…</p>}
        {!isLoading && data?.items?.length === 0 && (
          <p className="text-sm text-muted-foreground">No patients match your search.</p>
        )}
        {data?.items?.map((p) => (
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

      {/* عناصر التحكم في الصفحات (Pagination Controls) */}
      {data && data.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <Select 
              value={String(pageSize)} 
              onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
            >
              <SelectTrigger className="w-[80px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button 
                variant="outline" size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))} 
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <Button 
                variant="outline" size="sm" 
                onClick={() => setPage(p => p + 1)} 
                disabled={page >= totalPages}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
