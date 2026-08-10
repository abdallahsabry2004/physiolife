import { PageGuard } from "@/components/PageGuard";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Printer, Trash2, AlertTriangle, DollarSign, History, Search, ChevronLeft, ChevronRight } from "lucide-react";
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
  component: () => (
    <PageGuard page="billing">
      <BillingPage />
    </PageGuard>
  ),
});

function BillingPage() {
  const { user, canBill, fullName } = useAuth();
  const qc = useQueryClient();
  
  const [openInvoiceModal, setOpenInvoiceModal] = useState(false);
  const [payModal, setPayModal] = useState({ open: false, invoice: null as any, amountToPay: "", remaining: 0, type: "full" as "full" | "partial" });
  const [deleteInvoiceModal, setDeleteInvoiceModal] = useState({ open: false, invoice: null as any, password: "" });
  
  // حالات بيانات الطباعة وسجل المريض
  const [printData, setPrintData] = useState<{ type: 'invoice' | 'payment' | 'history', data: any } | null>(null);
  const [selectedHistoryPatient, setSelectedHistoryPatient] = useState<string>("all");

  const [form, setForm] = useState({
    patient_id: "",
    description: "",
    sessions_count: "",
    subtotal: "",
    discount: "",
  });

  // -------------------------------------------------------------
  // إعدادات الـ Pagination والبحث (Server-Side)
  // -------------------------------------------------------------
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  const [invPage, setInvPage] = useState(1);
  const [invPageSize, setInvPageSize] = useState(10);
  
  const [payPage, setPayPage] = useState(1);
  const [payPageSize, setPayPageSize] = useState(10);

  // نظام الـ Debounce للبحث التلقائي
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setInvPage(1);
      setPayPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // جلب قائمة المرضى لاستخدامها في القوائم المنسدلة (Dropdowns)
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

  // 1. الاستعلام المخصص للفواتير مع التقسيم والبحث
  const { data: invoicesData, isLoading: invLoading } = useQuery({
    queryKey: ["invoices_paginated", invPage, invPageSize, searchTerm],
    queryFn: async () => {
      const from = (invPage - 1) * invPageSize;
      const to = from + invPageSize - 1;

      // نجلب الدفعات المرتبطة بكل فاتورة لحساب الرصيد المتبقي مباشرة
      let query = supabase
        .from("invoices")
        .select("*, patients!inner(full_name, code), payments(amount)", { count: "exact" });

      if (searchTerm) {
        query = query.ilike("patients.full_name", `%${searchTerm}%`);
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { items: data || [], total: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });

  // 2. الاستعلام المخصص للمدفوعات مع التقسيم والبحث
  const { data: paymentsData, isLoading: payLoading } = useQuery({
    queryKey: ["payments_paginated", payPage, payPageSize, searchTerm],
    queryFn: async () => {
      const from = (payPage - 1) * payPageSize;
      const to = from + payPageSize - 1;

      let query = supabase
        .from("payments")
        .select("id, patient_id, amount, method, paid_on, invoice_id, patients!inner(full_name, code), invoices(*)", { count: "exact" });

      if (searchTerm) {
        query = query.ilike("patients.full_name", `%${searchTerm}%`);
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { items: data || [], total: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });

  // 3. الاستعلام المخصص لحساب الإجمالي المتبقي (Total Outstanding) للعيادة كلها
  const { data: totalOutstanding = 0 } = useQuery({
    queryKey: ["total_outstanding"],
    queryFn: async () => {
      const { data: unpaidInvoices } = await supabase.from("invoices").select("id, total").neq("status", "paid");
      if (!unpaidInvoices?.length) return 0;
      
      const invoiceIds = unpaidInvoices.map((i) => i.id);
      const { data: relatedPayments } = await supabase.from("payments").select("amount, invoice_id").in("invoice_id", invoiceIds);
      
      let total = 0;
      unpaidInvoices.forEach(inv => {
         const paid = relatedPayments?.filter(p => p.invoice_id === inv.id).reduce((sum, p) => sum + Number(p.amount), 0) || 0;
         total += (Number(inv.total) - paid);
      });
      return total;
    }
  });

  // 4. الاستعلام المخصص لسجل المريض المالي (يعمل فقط عند اختيار مريض)
  const { data: patientHistory } = useQuery({
    queryKey: ["patient_billing_history", selectedHistoryPatient],
    enabled: selectedHistoryPatient !== "all",
    queryFn: async () => {
      const [invRes, payRes] = await Promise.all([
        supabase.from("invoices").select("*, payments(amount)").eq("patient_id", selectedHistoryPatient).order("created_at", { ascending: false }),
        supabase.from("payments").select("*").eq("patient_id", selectedHistoryPatient).order("created_at", { ascending: false })
      ]);
      return { invoices: invRes.data || [], payments: payRes.data || [] };
    }
  });

  const totalInvPages = Math.ceil((invoicesData?.total ?? 0) / invPageSize) || 1;
  const totalPayPages = Math.ceil((paymentsData?.total ?? 0) / payPageSize) || 1;

  // Real-time Sync عبر قنوات Supabase
  useEffect(() => {
    const channel = supabase
      .channel("realtime-billing")
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => {
        void qc.invalidateQueries({ queryKey: ["invoices_paginated"] });
        void qc.invalidateQueries({ queryKey: ["patient_billing_history"] });
        void qc.invalidateQueries({ queryKey: ["total_outstanding"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => {
        void qc.invalidateQueries({ queryKey: ["payments_paginated"] });
        void qc.invalidateQueries({ queryKey: ["invoices_paginated"] });
        void qc.invalidateQueries({ queryKey: ["patient_billing_history"] });
        void qc.invalidateQueries({ queryKey: ["total_outstanding"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  // إنشاء فاتورة جديدة (مع تحديث الشاشة لحظياً)
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
      
      // البحث عن اسم المريض باستخدام الـ ID
      const selectedPatient = patients.find(p => p.id === form.patient_id);
      const patientName = selectedPatient ? selectedPatient.full_name : form.patient_id;

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "CREATE_INVOICE",
        entity: `Invoice for Patient: ${patientName}`,
        details: { subtotal, discount, total }
      });
    },
    onSuccess: () => {
      toast.success("Invoice created successfully");
      setOpenInvoiceModal(false);
      setForm({ patient_id: "", description: "", sessions_count: "", subtotal: "", discount: "" });
      
      void qc.invalidateQueries({ queryKey: ["invoices_paginated"] });
      void qc.invalidateQueries({ queryKey: ["total_outstanding"] });
      void qc.invalidateQueries({ queryKey: ["patient_billing_history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // استلام دفعة جديدة (مع تحديث الشاشة لحظياً)
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

      // استخراج اسم المريض من الفاتورة
      const patientName = (invoice.patients as any)?.full_name || invoice.patient_id;

      logActivityAsync({
        user_id: user?.id,
        user_name: fullName,
        action: "RECEIVE_PAYMENT",
        entity: `Payment EGP ${amountPaid} for Patient: ${patientName}`,
        details: { invoice_id: invoice.id, partial: amountPaid < payModal.remaining }
      });
    },
    onSuccess: () => {
      toast.success("Payment recorded successfully");
      setPayModal({ open: false, invoice: null, amountToPay: "", remaining: 0, type: "full" });
      
      void qc.invalidateQueries({ queryKey: ["invoices_paginated"] });
      void qc.invalidateQueries({ queryKey: ["payments_paginated"] });
      void qc.invalidateQueries({ queryKey: ["total_outstanding"] });
      void qc.invalidateQueries({ queryKey: ["patient_billing_history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // الحذف الآمن للفاتورة (مع تحديث الشاشة لحظياً)
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
      
      // أمر تحديث الشاشة الفوري (المزامنة)
      void qc.invalidateQueries({ queryKey: ["invoices_paginated"] });
      void qc.invalidateQueries({ queryKey: ["payments_paginated"] });
      void qc.invalidateQueries({ queryKey: ["total_outstanding"] });
      void qc.invalidateQueries({ queryKey: ["patient_billing_history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // حذف دفعة (مع تحديث الشاشة لحظياً)
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
      
      // أمر تحديث الشاشة الفوري (المزامنة)
      void qc.invalidateQueries({ queryKey: ["invoices_paginated"] });
      void qc.invalidateQueries({ queryKey: ["payments_paginated"] });
      void qc.invalidateQueries({ queryKey: ["total_outstanding"] });
      void qc.invalidateQueries({ queryKey: ["patient_billing_history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getInvoiceStats = (invoice: any) => {
    const paidAmount = (invoice.payments || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const remaining = Number(invoice.total) - paidAmount;
    return { paidAmount, remaining };
  };

  const handlePrint = (type: 'invoice' | 'payment', data: any) => {
    setPrintData({ type, data });
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handlePrintHistory = () => {
    const patient = patients.find(p => p.id === selectedHistoryPatient);
    if (!patient || !patientHistory) return;

    const historyInvoicesList = patientHistory.invoices;
    const historyPaymentsList = patientHistory.payments;

    const totalBilled = historyInvoicesList.reduce((sum, inv) => sum + Number(inv.total), 0);
    const totalPaid = historyPaymentsList.reduce((sum, pay) => sum + Number(pay.amount), 0);
    const totalRemaining = totalBilled - totalPaid;

    setPrintData({
      type: 'history',
      data: {
        patient,
        invoices: historyInvoicesList,
        payments: historyPaymentsList,
        totalBilled,
        totalPaid,
        totalRemaining
      }
    });

    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="space-y-6">
      {/* ----------------- قوالب الطباعة ----------------- */}
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
                  {printData.type === 'invoice' && 'INVOICE STATEMENT'}
                  {printData.type === 'payment' && 'PAYMENT RECEIPT'}
                  {printData.type === 'history' && 'STATEMENT OF ACCOUNT'}
                </h3>
                {printData.type !== 'history' && (
                  <p className="text-gray-500 mt-1">No: #{printData.data.id.split('-')[0]}</p>
                )}
                <p className="text-gray-500">Date: {new Date().toLocaleDateString('en-GB')}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div className="flex justify-between border-b pb-4">
              <div>
                <p className="text-sm text-gray-500 uppercase font-semibold">Patient Details</p>
                <p className="text-xl font-bold mt-1">
                  {printData.type === 'history' 
                    ? printData.data.patient.full_name 
                    : (printData.data.patients as any)?.full_name}
                </p>
                <p className="text-sm text-gray-600">
                  ID: {printData.type === 'history' 
                        ? printData.data.patient.code 
                        : (printData.data.patients as any)?.code}
                </p>
              </div>
            </div>

            {/* قالب طباعة الفاتورة الواحدة */}
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

            {/* قالب طباعة الدفعة الواحدة */}
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

            {/* قالب طباعة السجل المالي الكامل للمريض */}
            {printData.type === 'history' && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg text-center bg-gray-50">
                    <p className="text-sm text-gray-500">Total Billed</p>
                    <p className="text-xl font-bold text-primary">EGP {printData.data.totalBilled.toLocaleString()}</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center bg-green-50">
                    <p className="text-sm text-green-600">Total Paid</p>
                    <p className="text-xl font-bold text-green-700">EGP {printData.data.totalPaid.toLocaleString()}</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center bg-red-50">
                    <p className="text-sm text-red-600">Outstanding Balance</p>
                    <p className="text-xl font-bold text-red-700">EGP {printData.data.totalRemaining.toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-lg border-b pb-2 mb-4">Invoices Summary</h4>
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b bg-gray-100">
                        <th className="p-2">Date</th>
                        <th className="p-2">Description</th>
                        <th className="p-2">Total</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printData.data.invoices.map((i: any) => (
                        <tr key={i.id} className="border-b">
                          <td className="p-2">{i.issue_date}</td>
                          <td className="p-2">{i.description || "General"}</td>
                          <td className="p-2">EGP {i.total}</td>
                          <td className="p-2 capitalize">{i.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h4 className="font-bold text-lg border-b pb-2 mb-4">Payments Summary</h4>
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b bg-gray-100">
                        <th className="p-2">Date</th>
                        <th className="p-2">Method</th>
                        <th className="p-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printData.data.payments.map((p: any) => (
                        <tr key={p.id} className="border-b">
                          <td className="p-2">{p.paid_on}</td>
                          <td className="p-2 uppercase">{p.method}</td>
                          <td className="p-2 font-bold">EGP {p.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
            
            {/* شريط البحث الموحد لتبويب Overview */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 bg-card"
                placeholder="Search invoices & payments by patient name..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invoices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {invLoading && <p className="text-sm text-muted-foreground">Loading invoices...</p>}
                {!invLoading && invoicesData?.items?.length === 0 && <p className="text-sm text-muted-foreground">No invoices found.</p>}
                
                {invoicesData?.items?.map((i: any) => {
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

                {/* أزرار التنقل للفواتير */}
                {invoicesData && invoicesData.total > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-3 mt-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Rows per page:</span>
                      <Select value={String(invPageSize)} onValueChange={(v) => { setInvPageSize(Number(v)); setInvPage(1); }}>
                        <SelectTrigger className="w-[70px] h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">Page {invPage} of {totalInvPages}</span>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setInvPage(p => Math.max(1, p - 1))} disabled={invPage === 1}>
                          <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setInvPage(p => p + 1)} disabled={invPage >= totalInvPages}>
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Payments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {payLoading && <p className="text-sm text-muted-foreground">Loading payments...</p>}
                {!payLoading && paymentsData?.items?.length === 0 && <p className="text-sm text-muted-foreground">No payments found.</p>}
                
                {paymentsData?.items?.map((p: any) => (
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

                {/* أزرار التنقل للمدفوعات */}
                {paymentsData && paymentsData.total > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-3 mt-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Rows per page:</span>
                      <Select value={String(payPageSize)} onValueChange={(v) => { setPayPageSize(Number(v)); setPayPage(1); }}>
                        <SelectTrigger className="w-[70px] h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">Page {payPage} of {totalPayPages}</span>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPayPage(p => Math.max(1, p - 1))} disabled={payPage === 1}>
                          <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPayPage(p => p + 1)} disabled={payPage >= totalPayPages}>
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
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
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <div className="max-w-md w-full">
                    <Select value={selectedHistoryPatient} onValueChange={setSelectedHistoryPatient}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select patient" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">-- Select a Patient --</SelectItem>
                        {patients.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedHistoryPatient !== "all" && (
                    <Button onClick={handlePrintHistory} variant="outline" className="shrink-0">
                      <Printer className="mr-2 h-4 w-4" /> Print Full History
                    </Button>
                  )}
                </div>

                {selectedHistoryPatient !== "all" ? (
                  <div className="space-y-6 border-t pt-6">
                    <div>
                      <h4 className="font-bold mb-3">Invoices History</h4>
                      {!patientHistory?.invoices || patientHistory.invoices.length === 0 ? <p className="text-sm text-muted-foreground">No invoices.</p> : (
                        <div className="space-y-2">
                          {patientHistory.invoices.map((i: any) => {
                            const { paidAmount, remaining } = getInvoiceStats(i);
                            const isPaid = i.status === "paid" || remaining <= 0;
                            return (
                              <div key={i.id} className="flex justify-between items-center border p-3 rounded text-sm bg-card">
                                <div>
                                  <p className="font-medium">{i.description || "General"} · {i.issue_date}</p>
                                  <p className="text-xs text-muted-foreground mt-1">Total: EGP {i.total} | Remaining: EGP {remaining}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge variant={isPaid ? "default" : "secondary"}>{isPaid ? "Paid" : "Unpaid"}</Badge>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold mb-3">Payments History</h4>
                      {!patientHistory?.payments || patientHistory.payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments.</p> : (
                        <div className="space-y-2">
                          {patientHistory.payments.map((p: any) => (
                            <div key={p.id} className="flex justify-between items-center border p-3 rounded text-sm bg-secondary/10">
                              <div>
                                <p className="font-medium">Paid on {p.paid_on}</p>
                                <p className="text-xs text-muted-foreground mt-1">Method: {p.method}</p>
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
