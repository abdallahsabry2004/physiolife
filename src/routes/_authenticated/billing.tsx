import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Printer, Trash2, AlertTriangle, DollarSign, History } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logActivityAsync } from "@/lib/logger"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import logo from "@/assets/physio-life-logo.png";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing & Payments — Physio Life EMR" },
      {
        name: "description",
        content:
          "Create invoices, receive payments, apply discounts and track outstanding balances for physiotherapy patients.",
      },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const { user, canBill, fullName } = useAuth();
  const qc = useQueryClient();
  
  const [openInvoiceModal, setOpenInvoiceModal] = useState(false);
  const [payModal, setPayModal] = useState({ open: false, invoice: null as any, amountToPay: "", remaining: 0, type: "full" as "full" | "partial" });
  const [deleteInvoiceModal, setDeleteInvoiceModal] = useState({ open: false, invoice: null as any, password: "" });
  
  // حالة بيانات الطباعة
  const [printData, setPrintData] = useState<{ type: 'invoice' | 'payment', data: any } | null>(null);
  const [selectedHistoryPatient, setSelectedHistoryPatient] = useState<string>("all");

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
        .select("*, patients(full_name, code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      // جلب المدفوعات مع تفاصيل الفاتورة المرتبطة بها للطباعة
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, method, paid_on, invoice_id, patients(full_name, code), invoices(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("realtime-billing")
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => {
        void qc.invalidateQueries({ queryKey: ["invoices"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => {
        void qc.invalidateQueries({ queryKey: ["payments"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

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
      
      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "CREATE_INVOICE",
        entity: `Invoice for Patient ID: ${form.patient_id}`,
        details: { subtotal, discount, total }
      });
    },
    onSuccess: () => {
      toast.success("Invoice created successfully");
      setOpenInvoiceModal(false);
      setForm({ patient_id: "", description: "", sessions_count: "", subtotal: "", discount: "" });
      void qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const receivePayment = useMutation({
    mutationFn: async () => {
      const amountPaid = payModal.type === "full" ? payModal.remaining : Number(payModal.amountToPay);
      const invoice = payModal.invoice;
      
      if (amountPaid <= 0) throw new Error("Please enter a valid amount.");
      if (amountPaid > payModal.remaining) throw new Error("Amount exceeds the remaining balance.");

      const { error: paymentError } = await supabase.from("payments").insert({
        invoice_id: invoice.id,
        patient_id: invoice.patient_id,
        amount: amountPaid,
        received_by: user?.id ?? null,
      });
      if (paymentError) throw paymentError;

      if (amountPaid === payModal.remaining) {
        const { error: upErr } = await supabase
          .from("invoices")
          .update({ status: "paid" })
          .eq("id", invoice.id);
        if (upErr) throw upErr;
      }

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "RECEIVE_PAYMENT",
        entity: `Payment EGP ${amountPaid}`,
        details: { invoice_id: invoice.id, partial: amountPaid < payModal.remaining }
      });
    },
    onSuccess: () => {
      toast.success("Payment recorded successfully");
      setPayModal({ open: false, invoice: null, amountToPay: "", remaining: 0, type: "full" });
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const secureDeleteInvoice = useMutation({
    mutationFn: async () => {
      if (!user?.email) throw new Error("Email not found");
      const invoice = deleteInvoiceModal.invoice;

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deleteInvoiceModal.password,
      });
      if (authError) throw new Error("Invalid password");

      await supabase.from("payments").delete().eq("invoice_id", invoice.id);
      
      const { error: delError } = await supabase.from("invoices").delete().eq("id", invoice.id);
      if (delError) throw delError;

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "HARD_DELETE_INVOICE",
        entity: `Invoice ID: ${invoice.id}`,
        details: { deleted_data: invoice }
      });
    },
    onSuccess: () => {
      toast.success("Invoice and associated payments permanently deleted.");
      setDeleteInvoiceModal({ open: false, invoice: null, password: "" });
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePayment = useMutation({
    mutationFn: async ({ paymentId, invoiceId }: { paymentId: string, invoiceId: string | null }) => {
      const { error } = await supabase.from("payments").delete().eq("id", paymentId);
      if (error) throw error;

      if (invoiceId) {
        await supabase.from("invoices").update({ status: "unpaid" }).eq("id", invoiceId);
      }

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "DELETE_PAYMENT",
        entity: `Payment ID: ${paymentId}`,
      });
    },
    onSuccess: () => {
      toast.success("Payment deleted. Invoice status reverted to unpaid.");
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getInvoiceStats = (invoice: any) => {
    const paidAmount = payments
      .filter((p) => p.invoice_id === invoice.id)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = Number(invoice.total) - paidAmount;
    return { paidAmount, remaining };
  };

  const handlePrint = (type: 'invoice' | 'payment', data: any) => {
    setPrintData({ type, data });
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // إعداد بيانات أرشيف المرضى
  const patientsWithBilling = useMemo(() => {
    const uniqueIds = Array.from(new Set([...invoices.map(i => i.patient_id), ...payments.map(p => p.patient_id)]));
    return patients.filter(p => uniqueIds.includes(p.id));
  }, [invoices, payments, patients]);

  const historyInvoices = selectedHistoryPatient === "all" ? invoices : invoices.filter(i => i.patient_id === selectedHistoryPatient);
  const historyPayments = selectedHistoryPatient === "all" ? payments : payments.filter(p => p.patient_id === selectedHistoryPatient);

  const totalOutstanding = invoices
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + getInvoiceStats(i).remaining, 0);

  return (
    <div className="space-y-6">
      {/* ----------------- قالب الطباعة ----------------- */}
      {printData && (
        <div className="hidden print:block absolute inset-0 bg-white p-8 z-50 min-h-screen">
          <div className="border-b-2 border-primary pb-6 mb-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <img src={logo} alt="Physio Life" className="h-20 w-20" />
                <div>
                  <h2 className="text-3xl font-bold text-primary">Physio Life PT Center</h2>
                  <p className="text-sm font-medium text-gray-600">Physical Therapy & Rehabilitation</p>
                </div>
              </div>
              <div className="text-right">
                <h3 className="text-2xl font-bold text-gray-800 tracking-wider">
                  {printData.type === 'invoice' ? 'INVOICE STATEMENT' : 'PAYMENT RECEIPT'}
                </h3>
                <p className="text-gray-500 mt-1">No: #{printData.data.id.split('-')[0]}</p>
                <p className="text-gray-500">Date: {new Date(printData.data.created_at).toLocaleDateString('en-GB')}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div className="flex justify-between border-b pb-4">
              <div>
                <p className="text-sm text-gray-500 uppercase font-semibold">Patient Details</p>
                <p className="text-xl font-bold mt-1">{(printData.data.patients as any)?.full_name}</p>
                <p className="text-sm text-gray-600">ID: {(printData.data.patients as any)?.code}</p>
              </div>
            </div>

            {printData.type === 'invoice' && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-6 rounded-lg border">
                  <h4 className="font-bold text-lg mb-4 border-b pb-2">Invoice Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <p><span className="text-gray-500">Description:</span> {printData.data.description || "General Physical Therapy"}</p>
                    <p><span className="text-gray-500">Sessions Count:</span> {printData.data.sessions_count || "N/A"}</p>
                    <p><span className="text-gray-500">Subtotal:</span> EGP {Number(printData.data.subtotal).toLocaleString()}</p>
                    <p><span className="text-gray-500">Discount:</span> EGP {Number(printData.data.discount).toLocaleString()}</p>
                  </div>
                  <div className="mt-4 pt-4 border-t flex justify-between items-center">
                    <span className="text-gray-600 font-semibold text-lg">Total Amount:</span>
                    <span className="text-2xl font-bold text-primary">EGP {Number(printData.data.total).toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500">Paid Amount</p>
                    <p className="font-bold text-lg text-green-600">EGP {getInvoiceStats(printData.data).paidAmount.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Remaining Balance</p>
                    <p className="font-bold text-lg text-destructive">EGP {getInvoiceStats(printData.data).remaining.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {printData.type === 'payment' && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-6 rounded-lg border mb-4">
                  <h4 className="font-bold text-lg mb-4 border-b pb-2">Payment Details</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-semibold text-lg">Amount Received:</span>
                    <span className="text-3xl font-bold text-primary">EGP {Number(printData.data.amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center mt-4 text-sm">
                    <span className="text-gray-600 font-medium">Payment Method:</span>
                    <span className="font-bold uppercase">{printData.data.method}</span>
                  </div>
                </div>

                {printData.data.invoices && (
                  <div className="p-4 border rounded-lg text-sm">
                    <h5 className="font-bold mb-2">Applied To Invoice:</h5>
                    <p><span className="text-gray-500">Description:</span> {printData.data.invoices.description || "General"}</p>
                    <p><span className="text-gray-500">Invoice Total:</span> EGP {Number(printData.data.invoices.total).toLocaleString()}</p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-16 pt-8 border-t border-dashed flex justify-between items-end">
              <div>
                <p className="text-sm text-gray-500 mb-2">Issued By (Staff)</p>
                <p className="font-bold text-lg">{fullName}</p>
              </div>
              <div className="text-center">
                <div className="w-48 border-b-2 border-gray-800 mb-2"></div>
                <p className="text-sm text-gray-500">Authorized Signature</p>
              </div>
            </div>
            
            <div className="mt-12 text-center text-xs text-gray-400">
              <p>Thank you for choosing Physio Life PT Center.</p>
              <p>This is a computer-generated document and does not require a physical stamp.</p>
            </div>
          </div>
        </div>
      )}
      {/* ---------------------------------------------------------------------------------------- */}

      <div className="print:hidden space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Billing & Payments</h1>
            <p className="text-sm text-muted-foreground">
              Outstanding total balance: <span className="font-bold text-foreground">EGP {totalOutstanding.toLocaleString()}</span>
            </p>
          </div>
          
          {canBill && (
            <Dialog open={openInvoiceModal} onOpenChange={setOpenInvoiceModal}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> New Invoice
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Invoice</DialogTitle>
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
                    <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
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
                    <Label>Description / Package</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="e.g. 6 Sessions Package"
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
                  <Button type="submit" className="w-full" disabled={!form.patient_id || createInvoice.isPending}>
                    {createInvoice.isPending ? "Creating..." : "Create Invoice"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </header>

        {/* نافذة استلام الدفع (الدفع الجزئي أو الكلي) */}
        <Dialog open={payModal.open} onOpenChange={(open) => !open && setPayModal({ open: false, invoice: null, amountToPay: "", remaining: 0, type: "full" })}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" /> Receive Payment
              </DialogTitle>
            </DialogHeader>
            {payModal.invoice && (
              <div className="space-y-4 mt-2">
                <div className="bg-secondary/30 p-3 rounded-lg text-sm space-y-1">
                  <p><span className="text-muted-foreground">Patient:</span> {(payModal.invoice.patients as any)?.full_name}</p>
                  <p><span className="text-muted-foreground">Invoice Total:</span> EGP {Number(payModal.invoice.total).toLocaleString()}</p>
                  <p><span className="text-muted-foreground">Remaining Balance:</span> <span className="font-bold text-destructive">EGP {payModal.remaining.toLocaleString()}</span></p>
                </div>
                
                <div className="space-y-3">
                  <Label>Payment Type</Label>
                  <div className="flex gap-2">
                    <Button 
                      type="button"
                      variant={payModal.type === "full" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setPayModal({ ...payModal, type: "full", amountToPay: payModal.remaining.toString() })}
                    >
                      Full Amount
                    </Button>
                    <Button 
                      type="button"
                      variant={payModal.type === "partial" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setPayModal({ ...payModal, type: "partial", amountToPay: "" })}
                    >
                      Partial Amount
                    </Button>
                  </div>
                </div>

                {payModal.type === "partial" && (
                  <div className="space-y-2">
                    <Label htmlFor="pay-amount">Amount to Pay (EGP)</Label>
                    <Input
                      id="pay-amount"
                      type="number"
                      max={payModal.remaining}
                      value={payModal.amountToPay}
                      onChange={(e) => setPayModal({ ...payModal, amountToPay: e.target.value })}
                      placeholder={`Max: ${payModal.remaining}`}
                    />
                  </div>
                )}

                <Button 
                  className="w-full" 
                  onClick={() => receivePayment.mutate()}
                  disabled={receivePayment.isPending || (payModal.type === "partial" && !payModal.amountToPay)}
                >
                  {receivePayment.isPending ? "Processing..." : `Confirm EGP ${payModal.type === "full" ? payModal.remaining : payModal.amountToPay || "0"}`}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* نافذة الحذف الآمن للفواتير بالكامل */}
        <Dialog open={deleteInvoiceModal.open} onOpenChange={(open) => !open && setDeleteInvoiceModal({ open: false, invoice: null, password: "" })}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Permanent Delete Invoice
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to completely delete this invoice and <strong>all its associated payments</strong>? 
                This action is irreversible.
              </p>
              <div className="space-y-2">
                <Label htmlFor="del-inv-password">Enter your password to confirm</Label>
                <Input
                  id="del-inv-password"
                  type="password"
                  value={deleteInvoiceModal.password}
                  onChange={(e) => setDeleteInvoiceModal({ ...deleteInvoiceModal, password: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button variant="outline" onClick={() => setDeleteInvoiceModal({ open: false, invoice: null, password: "" })}>Cancel</Button>
                <Button 
                  variant="destructive" 
                  disabled={secureDeleteInvoice.isPending || !deleteInvoiceModal.password} 
                  onClick={() => secureDeleteInvoice.mutate()}
                >
                  {secureDeleteInvoice.isPending ? "Deleting..." : "Confirm Delete"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Tabs defaultValue="overview">
          <TabsList className="grid w-full sm:w-[400px] grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="patient-history">Patient History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invoices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
                {invoices.map((i) => {
                  const { paidAmount, remaining } = getInvoiceStats(i);
                  const isPaid = i.status === "paid" || remaining <= 0;
                  
                  return (
                    <div key={i.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                      <div className="flex-1">
                        <p className="font-medium text-base">{(i.patients as any)?.full_name ?? "Patient"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {i.invoice_number} · {i.issue_date} · {i.description ?? "General"}
                        </p>
                      </div>
                      
                      <div className="flex flex-col sm:items-end gap-1 px-4 sm:border-r sm:rtl:border-l sm:rtl:border-r-0">
                        <span className="font-bold text-base">EGP {Number(i.total).toLocaleString()}</span>
                        {paidAmount > 0 && !isPaid && (
                          <span className="text-xs text-primary font-medium">Paid: {paidAmount} | Rem: {remaining}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-2 sm:mt-0">
                        <Badge variant={isPaid ? "default" : "secondary"}>
                          {isPaid ? "Paid" : paidAmount > 0 ? "Partial" : "Unpaid"}
                        </Badge>
                        
                        {canBill && !isPaid && (
                          <Button
                            size="sm"
                            onClick={() => setPayModal({ open: true, invoice: i, amountToPay: remaining.toString(), remaining, type: "full" })}
                          >
                            Pay
                          </Button>
                        )}
                        
                        <Button size="icon" variant="outline" className="h-8 w-8 ml-2" onClick={() => handlePrint('invoice', i)}>
                          <Printer className="h-4 w-4" />
                        </Button>

                        {canBill && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="text-destructive hover:bg-destructive/10 h-8 w-8"
                            onClick={() => setDeleteInvoiceModal({ open: true, invoice: i, password: "" })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Payments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {payments.length === 0 && <p className="text-sm text-muted-foreground">No payments received yet.</p>}
                {payments.map((p) => (
                  <div key={p.id} className="flex justify-between items-center rounded-lg border p-3 text-sm bg-secondary/10">
                    <div className="flex flex-col">
                      <span className="font-semibold">{(p.patients as any)?.full_name ?? "Patient"}</span>
                      <span className="text-muted-foreground text-xs mt-1">
                        {p.paid_on} · {p.method.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-primary">EGP {Number(p.amount).toLocaleString()}</span>
                      
                      <Button size="sm" variant="outline" className="h-8" onClick={() => handlePrint('payment', p)}>
                        <Printer className="h-4 w-4 mr-2" /> Receipt
                      </Button>

                      {canBill && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm("Delete this payment? The invoice balance will be adjusted.")) {
                              deletePayment.mutate({ paymentId: p.id, invoiceId: p.invoice_id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patient-history" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-5 w-5" /> Patient Financial History
                </CardTitle>
                <p className="text-sm text-muted-foreground">Select a patient to view their complete billing history.</p>
              </CardHeader>
              <CardContent>
                <div className="max-w-md mb-6">
                  <Select value={selectedHistoryPatient} onValueChange={setSelectedHistoryPatient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select patient" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">-- Select a Patient --</SelectItem>
                      {patientsWithBilling.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedHistoryPatient !== "all" ? (
                  <div className="space-y-6 border-t pt-6">
                    <div>
                      <h4 className="font-bold mb-3">Invoices History</h4>
                      {historyInvoices.length === 0 ? <p className="text-sm text-muted-foreground">No invoices.</p> : (
                        <div className="space-y-2">
                          {historyInvoices.map((i) => {
                            const { paidAmount, remaining } = getInvoiceStats(i);
                            const isPaid = i.status === "paid" || remaining <= 0;
                            return (
                              <div key={i.id} className="flex justify-between items-center border p-2 rounded text-sm">
                                <div>
                                  <p className="font-medium">{i.description || "General"} · {i.issue_date}</p>
                                  <p className="text-xs text-muted-foreground">Total: EGP {i.total} | Remaining: EGP {remaining}</p>
                                </div>
                                <Badge variant={isPaid ? "default" : "secondary"}>{isPaid ? "Paid" : "Unpaid"}</Badge>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold mb-3">Payments History</h4>
                      {historyPayments.length === 0 ? <p className="text-sm text-muted-foreground">No payments.</p> : (
                        <div className="space-y-2">
                          {historyPayments.map((p) => (
                            <div key={p.id} className="flex justify-between items-center border p-2 rounded text-sm bg-secondary/10">
                              <div>
                                <p className="font-medium">Paid on {p.paid_on}</p>
                                <p className="text-xs text-muted-foreground">Method: {p.method}</p>
                              </div>
                              <span className="font-bold text-primary">EGP {p.amount}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground text-sm border rounded-lg bg-secondary/10">
                    Please select a patient from the dropdown above to load their history.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
