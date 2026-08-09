import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logActivityAsync } from "@/lib/logger"; // إضافة دالة المراقبة
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing & Payments — Physio Life EMR" },
      {
        name: "description",
        content:
          "Create invoices, receive payments, apply discounts and track outstanding balances for physiotherapy patients.",
      },
      { property: "og:title", content: "Billing & Payments — Physio Life EMR" },
      { property: "og:description", content: "Invoices, receipts and outstanding balances." },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const { user, canBill, fullName } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    patient_id: "",
    description: "",
    sessions_count: "",
    subtotal: "",
    discount: "",
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, full_name, code")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, patients(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, method, paid_on, patients(full_name)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const createInvoice = useMutation({
    mutationFn: async () => {
      const subtotal = Number(form.subtotal || 0);
      const discount = Number(form.discount || 0);
      const total = subtotal - discount;

      const { error } = await supabase.from("invoices").insert({
        patient_id: form.patient_id,
        description: form.description || null,
        sessions_count: form.sessions_count ? Number(form.sessions_count) : null,
        subtotal,
        discount,
        total: total,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      
      // توثيق إنشاء الفاتورة
      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "CREATE_INVOICE",
        entity: `Invoice for Patient ID: ${form.patient_id}`,
        details: { subtotal, discount, total }
      });
    },
    onSuccess: () => {
      toast.success("Invoice created");
      setOpen(false);
      setForm({ patient_id: "", description: "", sessions_count: "", subtotal: "", discount: "" });
      void qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pay = useMutation({
    mutationFn: async (invoice: { id: string; patient_id: string; total: number }) => {
      const { error } = await supabase.from("payments").insert({
        invoice_id: invoice.id,
        patient_id: invoice.patient_id,
        amount: invoice.total,
        received_by: user?.id ?? null,
      });
      if (error) throw error;
      const { error: upErr } = await supabase
        .from("invoices")
        .update({ status: "paid" })
        .eq("id", invoice.id);
      if (upErr) throw upErr;
      
      // توثيق استلام الدفعة
      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "RECEIVE_PAYMENT",
        entity: `Payment EGP ${invoice.total}`,
        details: { invoice_id: invoice.id }
      });
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const outstanding = invoices
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + Number(i.total), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Outstanding balance: EGP {outstanding.toLocaleString()}
          </p>
        </div>
        {canBill && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New invoice
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create invoice</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  createInvoice.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label>Patient</Label>
                  <Select
                    value={form.patient_id}
                    onValueChange={(v) => setForm({ ...form, patient_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name} ({p.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description / package</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Sessions</Label>
                    <Input
                      type="number"
                      value={form.sessions_count}
                      onChange={(e) => setForm({ ...form, sessions_count: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subtotal</Label>
                    <Input
                      type="number"
                      value={form.subtotal}
                      onChange={(e) => setForm({ ...form, subtotal: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Discount</Label>
                    <Input
                      type="number"
                      value={form.discount}
                      onChange={(e) => setForm({ ...form, discount: e.target.value })}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={!form.patient_id}>
                  Create invoice
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {invoices.length === 0 && (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          )}
          {invoices.map((i) => (
            <div
              key={i.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {(i.patients as { full_name: string } | null)?.full_name ?? "Patient"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {i.invoice_number} · {i.issue_date} · {i.description ?? "—"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">EGP {Number(i.total).toLocaleString()}</span>
                <Badge variant={i.status === "paid" ? "default" : "secondary"}>{i.status}</Badge>
                {canBill && i.status !== "paid" && (
                  <Button
                    size="sm"
                    onClick={() =>
                      pay.mutate({
                        id: i.id,
                        patient_id: i.patient_id,
                        total: Number(i.total),
                      })
                    }
                  >
                    Receive payment
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {payments.length === 0 && (
            <p className="text-sm text-muted-foreground">No payments received yet.</p>
          )}
          {payments.map((p) => (
            <div key={p.id} className="flex justify-between rounded-lg border p-3 text-sm">
              <span>{(p.patients as { full_name: string } | null)?.full_name ?? "Patient"}</span>
              <span className="text-muted-foreground">
                EGP {Number(p.amount).toLocaleString()} · {p.method} · {p.paid_on}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
