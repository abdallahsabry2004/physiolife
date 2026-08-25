import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Printer, Trash2, Edit } from "lucide-react";
import logo from "@/assets/physio-life-logo.png";

interface TodayTransactionsTabProps {
  onPay?: (invoice: any, remaining: number) => void;
  onDelete?: (invoice: any) => void;
  staffList?: { id: string; full_name: string }[];
}

export function TodayTransactionsTab({
  onPay,
  onDelete,
  staffList = [],
}: TodayTransactionsTabProps) {
  const { lang } = useI18n();
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [endDate, setEndDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [filterPatient, setFilterPatient] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTherapist, setFilterTherapist] = useState("all");

  const qc = useQueryClient();
  const [editInvoice, setEditInvoice] = useState<any>(null);
  const [editForm, setEditForm] = useState({ description: "", department_id: "none", therapist_id: "none" });

  const { data: departments } = useQuery({
    queryKey: ["clinic_departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clinic_departments").select("*").order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!editInvoice) return;
      const { error } = await supabase.from("invoices").update({
        description: editForm.description,
        department_id: editForm.department_id === "none" ? null : editForm.department_id,
        therapist_id: editForm.therapist_id === "none" ? null : editForm.therapist_id,
      }).eq("id", editInvoice.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم تعديل المعاملة بنجاح" : "Transaction updated successfully");
      setEditInvoice(null);
      qc.invalidateQueries({ queryKey: ["today_invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (invoice: any) => {
    setEditInvoice(invoice);
    setEditForm({
      description: invoice.description || "",
      department_id: invoice.department_id || "none",
      therapist_id: invoice.therapist_id || "none",
    });
  };


  const { data: invoices, isLoading } = useQuery({
    queryKey: ["today_invoices", startDate, endDate],
    queryFn: async () => {
      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T23:59:59.999`);

      const { data, error } = await supabase
        .from("invoices")
        .select(
          `
          *,
          patients ( full_name ),
          clinic_departments ( name ),
          payments ( amount )
        `,
        )
        .gte("issue_date", start.toISOString())
        .lte("issue_date", end.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["clinic_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clinic_settings").select("*");
      if (error) throw error;
      const parsed: Record<string, any> = {};
      data.forEach((d) => {
        parsed[d.key] = d.value;
      });
      return parsed;
    },
  });

  const { data: partnerships } = useQuery({
    queryKey: ["clinic_partnerships"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clinic_partnerships").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  function getInvoiceStats(invoice: any) {
    const total = Number(invoice.total || 0);
    const paidAmount = (invoice.payments || []).reduce(
      (sum: number, p: any) => sum + Number(p.amount || 0),
      0,
    );
    const remaining = total - paidAmount;
    return { total, paidAmount, remaining };
  }

  let totalInvoiced = 0;
  let totalPaid = 0;
  let totalRemaining = 0;

  const filteredInvoices = invoices?.filter((inv: any) => {
    if (
      filterPatient &&
      !inv.patients?.full_name?.toLowerCase().includes(filterPatient.toLowerCase())
    )
      return false;

    const stats = getInvoiceStats(inv);
    let dynamicStatus = "unpaid";
    if (stats.remaining <= 0) dynamicStatus = "paid";
    else if (stats.paidAmount > 0) dynamicStatus = "partial";

    if (filterStatus !== "all" && dynamicStatus !== filterStatus) return false;
    if (filterTherapist !== "all" && inv.therapist_id !== filterTherapist) return false;
    return true;
  });

  filteredInvoices?.forEach((inv: any) => {
    const stats = getInvoiceStats(inv);
    totalInvoiced += stats.total;
    totalPaid += stats.paidAmount;
    totalRemaining += stats.remaining;
  });

  const partsEnabled =
    settings?.partnerships_enabled === true || settings?.partnerships_enabled === "true";
  const partnerShares: Record<string, number> = {};

  if (partsEnabled && partnerships && totalPaid > 0) {
    let remainingToDivide = totalPaid;
    partnerships
      .filter((p) => p.type === "fixed")
      .forEach((p) => {
        const val = p.value || 0;
        partnerShares[p.name] = val;
        remainingToDivide -= val;
      });
    partnerships
      .filter((p) => p.type === "percentage")
      .forEach((p) => {
        partnerShares[p.name] = (totalPaid * (p.value || 0)) / 100;
      });
    partnerships
      .filter((p) => p.type === "fraction")
      .forEach((p) => {
        const num = p.fraction_numerator || 0;
        const den = p.fraction_denominator || 1;
        partnerShares[p.name] = totalPaid * (num / den);
      });
  }

  const startDayName = new Date(startDate).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
    weekday: "long",
  });
  const endDayName = new Date(endDate).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
    weekday: "long",
  });
  const isSameDay = startDate === endDate;
  const displayTitle = isSameDay
    ? `${startDayName}`
    : lang === "ar"
      ? "فترة محددة"
      : "Selected Period";

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div className="space-y-6 print:hidden">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 no-print">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold min-w-[120px]">{displayTitle}</h2>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 bg-muted/30 p-2 rounded-lg border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {lang === "ar" ? "من:" : "From:"}
              </span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-auto h-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {lang === "ar" ? "إلى:" : "To:"}
              </span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-auto h-9"
              />
            </div>
          </div>
        </div>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="me-2 h-4 w-4" />
          {lang === "ar" ? "طباعة" : "Print"}
        </Button>
      </div>

      

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {lang === "ar" ? "عدد الفواتير" : "Total Receipts"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredInvoices?.length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {lang === "ar" ? "إجمالي الفواتير" : "Total Invoiced"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {totalInvoiced.toLocaleString()} {lang === "ar" ? "ج.م" : "EGP"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {lang === "ar" ? "إجمالي المدفوع" : "Total Paid"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalPaid.toLocaleString()} {lang === "ar" ? "ج.م" : "EGP"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {lang === "ar" ? "إجمالي المتبقي" : "Total Remaining"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {totalRemaining.toLocaleString()} {lang === "ar" ? "ج.م" : "EGP"}
            </div>
          </CardContent>
        </Card>

        {partsEnabled &&
          Object.entries(partnerShares).map(([name, val]) => (
            <Card key={name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {name} {lang === "ar" ? "(من المدفوع)" : "(from paid)"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {val.toLocaleString()} {lang === "ar" ? "ج.م" : "EGP"}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{lang === "ar" ? "الفواتير" : "Invoices"}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              {lang === "ar" ? "جاري التحميل..." : "Loading..."}
            </p>
          ) : invoices?.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {lang === "ar" ? "لا توجد معاملات لهذه الفترة" : "No transactions for this period"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <Input
                  placeholder={lang === "ar" ? "بحث باسم المريض..." : "Search patient..."}
                  value={filterPatient}
                  onChange={(e) => setFilterPatient(e.target.value)}
                  className="max-w-xs"
                />
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{lang === "ar" ? "الكل" : "All Status"}</SelectItem>
                    <SelectItem value="paid">{lang === "ar" ? "مدفوع" : "Paid"}</SelectItem>
                    <SelectItem value="partial">{lang === "ar" ? "جزئي" : "Partial"}</SelectItem>
                    <SelectItem value="unpaid">{lang === "ar" ? "غير مدفوع" : "Unpaid"}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterTherapist} onValueChange={setFilterTherapist}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Therapist" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {lang === "ar" ? "كل الأطباء" : "All Therapists"}
                    </SelectItem>
                    {staffList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        Dr. {s.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{lang === "ar" ? "التاريخ والوقت" : "Date & Time"}</TableHead>
                    <TableHead>{lang === "ar" ? "المريض" : "Patient"}</TableHead>
                    <TableHead>{lang === "ar" ? "الوصف / القسم / المعالج" : "Description / Dept / Therapist"}</TableHead>
                    <TableHead>{lang === "ar" ? "الحالة" : "Status"}</TableHead>
                    <TableHead className="text-end">{lang === "ar" ? "الإجمالي" : "Total"}</TableHead>
                    <TableHead className="text-end">{lang === "ar" ? "المدفوع" : "Paid"}</TableHead>
                    <TableHead className="text-end">{lang === "ar" ? "المتبقي" : "Remaining"}</TableHead>
                    <TableHead className="text-end">{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices?.map((i: any) => {
                    const { paidAmount, remaining } = getInvoiceStats(i);
                    const therapistName =
                      staffList.find((s) => s.id === i.therapist_id)?.full_name || "-";
                    return (
                      <TableRow key={i.id}>
                                                <TableCell className="whitespace-nowrap">
                          {new Date(i.issue_date).toLocaleDateString("en-GB")}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {new Date(i.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </TableCell>
                        <TableCell>{i.patients?.full_name}</TableCell>
                        <TableCell>
                          <span className="block">{i.description || "-"}</span>
                          {i.clinic_departments?.name && (
                            <Badge variant="outline" className="me-1 mt-1 text-xs font-normal">
                              {i.clinic_departments.name}
                            </Badge>
                          )}
                          {i.therapist_id && (
                            <Badge variant="outline" className="mt-1 text-xs font-normal">
                              Dr. {therapistName}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {remaining <= 0 ? (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">{lang === "ar" ? "مدفوعة" : "Paid"}
                            </Badge>
                          ) : paidAmount > 0 ? (
                            <Badge
                              variant="secondary"
                              className="bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30 border-yellow-500/20"
                            >{lang === "ar" ? "جزئية" : "Partial"}
                            </Badge>
                          ) : (
                            <Badge variant="destructive">{lang === "ar" ? "غير مدفوع" : "Unpaid"}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-end font-medium">
                          EGP {i.total.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-end text-green-600">
                          EGP {paidAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-end text-destructive font-semibold">
                          EGP {remaining.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-end whitespace-nowrap">
                          <Button
    variant="ghost"
    size="icon"
    onClick={() => openEdit(i)}
    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
    title={lang === "ar" ? "تعديل البيانات" : "Edit details"}
  >
    <Edit className="h-4 w-4" />
  </Button>
  <Button
    variant="ghost"
    size="icon"
    onClick={() => onPay && onPay(i, remaining)}
                            disabled={remaining <= 0}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Receive Payment"
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete && onDelete(i)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            title={lang === "ar" ? "حذف الفاتورة" : "Delete Invoice"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Print Only Layout */}
      <div className="hidden print:block w-full bg-white text-black" dir="ltr">
        <div className="border-b-2 border-[#0f766e] pb-6 mb-6 flex justify-between items-start">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Physio Life" className="h-[90px] w-[90px] object-contain" />
            <div>
              <h2 className="text-3xl font-bold text-[#0f766e]">Physio Life PT Center</h2>
              <p className="text-sm font-medium text-gray-600 mb-2">Physical Therapy & Rehabilitation</p>
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
            <h3 className="text-2xl font-bold text-gray-800 tracking-wider">FINANCIAL TRANSACTIONS</h3>
            <p className="text-gray-500 font-medium mt-2">
              Printed By: {user?.user_metadata?.full_name || "Staff"}<br/>
              Period: {isSameDay ? startDate : `${startDate} to ${endDate}`}
            </p>
            <p className="text-gray-500 font-medium">
              Printed: {new Date().toLocaleDateString("en-GB")} {new Date().toLocaleTimeString("en-US")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="border border-gray-200 p-4 rounded-lg bg-gray-50">
            <p className="text-sm text-gray-500 font-semibold mb-1">Total Receipts</p>
            <p className="text-2xl font-bold text-gray-800">{filteredInvoices?.length || 0}</p>
          </div>
          <div className="border border-gray-200 p-4 rounded-lg bg-gray-50">
            <p className="text-sm text-gray-500 font-semibold mb-1">Total Invoiced</p>
            <p className="text-2xl font-bold text-blue-600">EGP {totalInvoiced.toLocaleString()}</p>
          </div>
          <div className="border border-gray-200 p-4 rounded-lg bg-gray-50">
            <p className="text-sm text-gray-500 font-semibold mb-1">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">EGP {totalPaid.toLocaleString()}</p>
          </div>
          <div className="border border-gray-200 p-4 rounded-lg bg-gray-50">
            <p className="text-sm text-gray-500 font-semibold mb-1">Total Remaining</p>
            <p className="text-2xl font-bold text-red-600">EGP {totalRemaining.toLocaleString()}</p>
          </div>
        </div>

        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-[#0f766e]">
              <th className="py-3 px-2 text-gray-700 font-bold">Time</th>
                            <th className="py-3 px-2 text-gray-700 font-bold">Patient</th>
              <th className="py-3 px-2 text-gray-700 font-bold">Therapist</th>
              <th className="py-3 px-2 text-gray-700 font-bold">Status</th>
              <th className="py-3 px-2 text-right text-gray-700 font-bold">Total</th>
              <th className="py-3 px-2 text-right text-gray-700 font-bold">Paid</th>
              <th className="py-3 px-2 text-right text-gray-700 font-bold">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices?.map((i) => {
              const { paidAmount, remaining } = getInvoiceStats(i);
              const therapistName = staffList.find((s) => s.id === i.therapist_id)?.full_name || "-";
              return (
                <tr key={i.id} className="border-b border-gray-100">
                  <td className="py-3 px-2 text-gray-600 font-medium whitespace-nowrap">
                    {new Date(i.created_at).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}
                  </td>
                                    <td className="py-3 px-2 font-bold text-gray-800">{i.patients?.full_name}</td>
                  <td className="py-3 px-2 text-gray-700">{therapistName}</td>
                  <td className="py-3 px-2">
                    {remaining <= 0 ? (
                      <span className="text-green-600 font-bold">Paid</span>
                    ) : paidAmount > 0 ? (
                      <span className="text-yellow-600 font-bold">Partial</span>
                    ) : (
                      <span className="text-red-600 font-bold">Unpaid</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right text-gray-700 font-semibold">EGP {Number(i.total).toLocaleString()}</td>
                  <td className="py-3 px-2 text-right text-green-600 font-bold">EGP {paidAmount.toLocaleString()}</td>
                  <td className="py-3 px-2 text-right text-red-600 font-bold">EGP {remaining.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {partsEnabled && partnerships && totalPaid > 0 && (
          <div className="mt-8 border-t-2 border-gray-200 pt-6">
            <h4 className="font-bold text-lg mb-4 text-[#0f766e]">Partnership Shares</h4>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 max-w-2xl">
              {Object.entries(partnerShares).map(([pName, pVal]) => (
                <div key={pName} className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="text-gray-700 font-medium">{pName}</span>
                  <span className="font-bold text-gray-900">EGP {pVal.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    
      <Dialog open={!!editInvoice} onOpenChange={(open) => !open && setEditInvoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "تعديل بيانات المعاملة" : "Edit Transaction Details"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{lang === "ar" ? "الوصف" : "Description"}</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{lang === "ar" ? "القسم" : "Department"}</Label>
              <Select
                value={editForm.department_id}
                onValueChange={(val) => setEditForm({ ...editForm, department_id: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{lang === "ar" ? "بدون قسم" : "No Department"}</SelectItem>
                  {departments?.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{lang === "ar" ? "المعالج" : "Therapist"}</Label>
              <Select
                value={editForm.therapist_id}
                onValueChange={(val) => setEditForm({ ...editForm, therapist_id: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{lang === "ar" ? "بدون معالج" : "No Therapist"}</SelectItem>
                  {staffList?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditInvoice(null)}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={() => updateInvoiceMutation.mutate()} disabled={updateInvoiceMutation.isPending}>
              {lang === "ar" ? "حفظ التعديلات" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
