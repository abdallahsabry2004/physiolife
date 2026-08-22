import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
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
import { CreditCard, Printer, Trash2 } from "lucide-react";

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
  const [startDate, setStartDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [endDate, setEndDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [filterPatient, setFilterPatient] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTherapist, setFilterTherapist] = useState("all");

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
    <div className="space-y-6">
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

      <div className="print-header hidden print:block text-center mb-8">
        <h1 className="text-2xl font-bold">
          {lang === "ar" ? "المعاملات المالية" : "Financial Transactions"}
        </h1>
        <p className="text-xl mt-2">
          {isSameDay ? `${startDate} - ${startDayName}` : `${startDate} ➝ ${endDate}`}
        </p>
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
                    <TableHead>{lang === "ar" ? "رقم الفاتورة" : "Invoice #"}</TableHead>
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
                        <TableCell className="font-medium whitespace-nowrap">
                          {i.invoice_number}
                        </TableCell>
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
  );
}
