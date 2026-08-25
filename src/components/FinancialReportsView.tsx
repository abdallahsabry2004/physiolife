import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Printer, Calendar as CalendarIcon, ArrowRight, ArrowLeft } from "lucide-react";
import logo from "@/assets/physio-life-logo.png";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FinancialReportsView() {
  const { lang } = useI18n();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Fetch staff (Therapist, Super Admin, Assistant)
  const { data: staffList, isLoading: isStaffLoading } = useQuery({
    queryKey: ["financial_staff_list"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["super_admin", "therapist", "assistant"]);
      if (rolesError) throw rolesError;

      if (!roles || roles.length === 0) return [];

      const userIds = roles.map((r) => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      return profiles || [];
    },
  });

  const filteredStaff = staffList?.filter((s) =>
    s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (selectedUserId) {
    const selectedUser = staffList?.find((s) => s.id === selectedUserId);
    return (
      <StaffReport
        userId={selectedUserId}
        userName={selectedUser?.full_name || ""}
        onBack={() => setSelectedUserId(null)}
        staffList={staffList}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {lang === "ar" ? "التقارير المالية للفريق" : "Staff Financial Reports"}
        </h2>
        <p className="text-muted-foreground">
          {lang === "ar"
            ? "عرض فواتير ومعاملات الأطباء والمساعدين"
            : "View invoices and transactions for doctors and assistants"}
        </p>
      </div>

      <div className="flex items-center space-x-2 space-x-reverse relative">
        <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          className={`pl-3 ${lang === "ar" ? "pr-9" : ""}`}
          placeholder={lang === "ar" ? "بحث بالاسم..." : "Search by name..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isStaffLoading ? (
        <p>{lang === "ar" ? "جاري التحميل..." : "Loading..."}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {filteredStaff?.map((staff) => (
            <Card
              key={staff.id}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => setSelectedUserId(staff.id)}
            >
              <CardContent className="p-6">
                <p className="font-semibold text-lg">{staff.full_name}</p>
              </CardContent>
            </Card>
          ))}
          {filteredStaff?.length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-8">
              {lang === "ar" ? "لم يتم العثور على نتائج" : "No results found"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StaffReport({
  userId,
  userName,
  onBack,
  staffList,
}: {
  userId: string;
  userName: string;
  onBack: () => void;
  staffList?: any[];
}) {
  const { lang } = useI18n();
  const { user, fullName } = useAuth();
  const [period, setPeriod] = useState("month"); // today, month, custom
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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
      const { data, error } = await supabase
        .from("clinic_partnerships")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["staff_invoices", userId, period, fromDate, toDate],
    queryFn: async () => {
      // @ts-ignore
      let query = supabase
        .from("invoices")
        .select(
          `
          *,
          patients ( full_name ),
          clinic_departments ( name ),
          payments ( amount )
        `,
        )
        // @ts-ignore
        .eq("therapist_id", userId)
        .order("issue_date", { ascending: false });

      const today = new Date();
      
      // Helper to format Date to local YYYY-MM-DD string
      const toLocalISOString = (date: Date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };

      if (period === "today") {
        const dateStr = toLocalISOString(today);
        query = query.gte("issue_date", dateStr).lte("issue_date", dateStr);
      } else if (period === "month") {
        const start = toLocalISOString(new Date(today.getFullYear(), today.getMonth(), 1));
        const end = toLocalISOString(new Date(today.getFullYear(), today.getMonth() + 1, 0));
        query = query.gte("issue_date", start).lte("issue_date", end);
      } else if (period === "custom") {
        if (fromDate) query = query.gte("issue_date", fromDate);
        if (toDate) query = query.lte("issue_date", toDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const handlePrint = () => {
    window.print();
  };

  const totalCases = invoices?.length || 0;

  function getInvoiceStats(invoice: any) {
    const total = Number(invoice.total || 0);
    const paidAmount = (invoice.payments || []).reduce(
      (sum: number, p: any) => sum + Number(p.amount || 0),
      0,
    );
    const remaining = total - paidAmount;
    return { total, paidAmount, remaining };
  }

  let totalRevenue = 0;
  let totalPaid = 0;
  let totalRemaining = 0;
  let totalStaffShare = 0;

  const partsEnabled =
    settings?.partnerships_enabled === true || settings?.partnerships_enabled === "true";
  const staffSources: string[] = settings?.staff_financial_sources || [];

  invoices?.forEach((inv) => {
    const stats = getInvoiceStats(inv);
    totalRevenue += stats.total;
    totalPaid += stats.paidAmount;
    totalRemaining += stats.remaining;
  });

  if (partsEnabled && staffSources.length > 0 && partnerships) {
    partnerships.forEach((p) => {
      if (staffSources.includes(p.id)) {
        if (p.type === "percentage") {
          totalStaffShare += (totalPaid * (p.value || 0)) / 100;
        } else if (p.type === "fixed") {
          totalStaffShare += p.value || 0;
        } else if (p.type === "fraction") {
          const num = p.fraction_numerator || 0;
          const den = p.fraction_denominator || 1;
          totalStaffShare += totalPaid * (num / den);
        }
      }
    });
  }

  const showStaffShare = partsEnabled && staffSources.length > 0;

  const deptStats = invoices?.reduce(
    (acc, inv) => {
      // @ts-ignore
      const deptName = inv.clinic_departments?.name || (lang === "ar" ? "غير محدد" : "Unspecified");
      if (!acc[deptName]) acc[deptName] = { cases: 0, revenue: 0, paid: 0, remaining: 0 };
      acc[deptName].cases += 1;
      const total = inv.total || 0;
      const paid = (inv.payments || []).reduce(
        (sum: number, p: any) => sum + Number(p.amount || 0),
        0,
      );
      acc[deptName].revenue += total;
      acc[deptName].paid += paid;
      acc[deptName].remaining += total - paid;
      return acc;
    },
    {} as Record<string, { cases: number; revenue: number; paid: number; remaining: number }>,
  );

  return (
    <>
      <div className="space-y-6 print:hidden">
      <div className="flex items-center justify-between no-print">
        <Button variant="ghost" onClick={onBack}>
          {lang === "ar" ? (
            <ArrowRight className="ml-2 h-4 w-4" />
          ) : (
            <ArrowLeft className="mr-2 h-4 w-4" />
          )}
          {lang === "ar" ? "رجوع" : "Back"}
        </Button>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="mr-2 h-4 w-4" />
          {lang === "ar" ? "طباعة السجل" : "Print Record"}
        </Button>
      </div>

      

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 no-print">
        <div>
          <h2 className="text-2xl font-bold">{userName}</h2>
          <p className="text-muted-foreground">
            {lang === "ar" ? "تقرير المعاملات والفواتير" : "Transactions and invoices report"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">
                {lang === "ar" ? "معاملات اليوم" : "Today's Transactions"}
              </SelectItem>
              <SelectItem value="month">{lang === "ar" ? "هذا الشهر" : "This Month"}</SelectItem>
              <SelectItem value="custom">
                {lang === "ar" ? "فترة مخصصة" : "Custom Period"}
              </SelectItem>
            </SelectContent>
          </Select>

          {period === "custom" && (
            <>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-auto"
              />
              <span>-</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-auto"
              />
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {lang === "ar" ? "إجمالي الحالات" : "Total Cases"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCases}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {lang === "ar" ? "إجمالي الفواتير" : "Total Invoiced"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {totalRevenue.toLocaleString()} {lang === "ar" ? "ج.م" : "EGP"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {showStaffShare ? (lang === "ar" ? "نصيب الطبيب" : "Doctor Share") : (lang === "ar" ? "المدفوع" : "Total Paid")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {showStaffShare ? totalStaffShare.toLocaleString() : totalPaid.toLocaleString()} {lang === "ar" ? "ج.م" : "EGP"}
            </div>
            {showStaffShare && (
              <p className="text-xs text-muted-foreground mt-1">
                {lang === "ar" ? "المدفوع الكلي:" : "Total Paid:"} {totalPaid.toLocaleString()} {lang === "ar" ? "ج.م" : "EGP"}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {lang === "ar" ? "المتبقي" : "Total Remaining"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {totalRemaining.toLocaleString()} {lang === "ar" ? "ج.م" : "EGP"}
            </div>
          </CardContent>
        </Card>
      </div>

      {(deptStats && Object.keys(deptStats || {}).length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>{lang === "ar" ? "تفاصيل الأقسام" : "Department Details"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(deptStats || {}).map(([dept, stats]) => (
                <div
                  key={dept}
                  className="flex justify-between items-center border-b pb-2 last:border-0"
                >
                  <span className="font-medium">{dept}</span>
                  <div className="text-right">
                    <div>
                      {stats.cases} {lang === "ar" ? "حالة" : "cases"}
                    </div>
                    <div className="text-blue-600 font-bold">
                      {lang === "ar" ? "الفواتير:" : "Billed:"} {stats.revenue.toLocaleString()}{" "}
                      {lang === "ar" ? "ج.م" : "EGP"}
                    </div>
                    <div className="text-green-600 text-sm">
                      {lang === "ar" ? "المدفوع:" : "Paid:"} {stats.paid.toLocaleString()}
                    </div>
                    <div className="text-destructive text-sm">
                      {lang === "ar" ? "المتبقي:" : "Remaining:"} {stats.remaining.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{lang === "ar" ? "سجل المعاملات" : "Transactions Log"}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>{lang === "ar" ? "جاري التحميل..." : "Loading..."}</p>
          ) : (
            <div className="space-y-4">
              {invoices?.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  {lang === "ar"
                    ? "لا توجد معاملات في هذه الفترة"
                    : "No transactions in this period"}
                </p>
              ) : (
                invoices?.map((inv) => {
                  const stats = getInvoiceStats(inv);
                  return (
                    <div
                      key={inv.id}
                      className="flex justify-between p-4 border rounded-lg bg-card"
                    >
                      <div>
                        {/* @ts-ignore */}
                        <p className="font-bold">{inv.patients?.full_name}</p>
                        <div className="text-sm text-muted-foreground space-y-1 mt-1">
                          {/* @ts-ignore */}
                          {inv.clinic_departments?.name && (
                            <p>
                              {lang === "ar" ? "القسم:" : "Dept:"} {inv.clinic_departments.name}
                            </p>
                          )}
                          <p>
                            {new Date(inv.issue_date).toLocaleDateString("en-GB")}{" "}
                            {new Date(inv.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          {inv.description && <p>{inv.description}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <p className="font-bold text-lg">
                            {stats.total.toLocaleString()} {lang === "ar" ? "ج.م" : "EGP"}
                          </p>
                          <div className="flex gap-4 text-sm mt-1">
                            <span className="text-green-600 font-semibold">
                              {lang === "ar" ? "المدفوع:" : "Paid:"}{" "}
                              {stats.paidAmount.toLocaleString()}
                            </span>
                            <span className="text-destructive font-semibold">
                              {lang === "ar" ? "المتبقي:" : "Remaining:"}{" "}
                              {stats.remaining.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {lang === "ar" ? "رقم:" : "No:"} {inv.invoice_number}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
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
            <h3 className="text-2xl font-bold text-gray-800 tracking-wider uppercase">{userName}</h3>
            <p className="text-gray-500 font-medium mt-1">Financial Report</p>
            <p className="text-gray-500 font-medium mt-2">
              Printed By: {fullName || user?.user_metadata?.full_name || user?.email || "Staff"}<br/>
              Printed: {new Date().toLocaleDateString("en-GB")} {new Date().toLocaleTimeString("en-US")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="border border-gray-200 p-4 rounded-lg bg-gray-50">
            <p className="text-sm text-gray-500 font-semibold mb-1">Total Cases</p>
            <p className="text-2xl font-bold text-gray-800">{totalCases}</p>
          </div>
          <div className="border border-gray-200 p-4 rounded-lg bg-gray-50">
            <p className="text-sm text-gray-500 font-semibold mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-blue-600">EGP {totalRevenue.toLocaleString()}</p>
          </div>
          <div className="border border-gray-200 p-4 rounded-lg bg-gray-50">
            <p className="text-sm text-gray-500 font-semibold mb-1">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">EGP {totalPaid.toLocaleString()}</p>
          </div>
          {showStaffShare && (
            <div className="border border-gray-200 p-4 rounded-lg bg-gray-50">
              <p className="text-sm text-gray-500 font-semibold mb-1">Estimated Share</p>
              <p className="text-2xl font-bold text-[#0f766e]">EGP {totalStaffShare.toLocaleString()}</p>
            </div>
          )}
        </div>

        {Object.keys(deptStats || {}).length > 0 && (
          <div className="mb-8">
            <h4 className="font-bold text-lg mb-4 text-[#0f766e]">Department Breakdown</h4>
            <table className="w-full text-left text-sm border-collapse mb-4">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="py-2 px-2">Department</th>
                  <th className="py-2 px-2 text-right">Cases</th>
                  <th className="py-2 px-2 text-right">Revenue</th>
                  <th className="py-2 px-2 text-right">Paid</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(deptStats || {}).map(([dept, data]) => (
                  <tr key={dept} className="border-b border-gray-100">
                    <td className="py-2 px-2 font-medium">{dept}</td>
                    <td className="py-2 px-2 text-right">{data.cases}</td>
                    <td className="py-2 px-2 text-right text-blue-600">EGP {data.revenue.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right text-green-600">EGP {data.paid.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <h4 className="font-bold text-lg mb-4 text-[#0f766e]">Transactions Details</h4>
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-[#0f766e]">
                <th className="py-3 px-2 text-gray-700 font-bold">Date & Time</th>
                <th className="py-3 px-2 text-gray-700 font-bold">Patient</th>
                <th className="py-3 px-2 text-gray-700 font-bold">Description / Dept / Therapist</th>
                <th className="py-3 px-2 text-right text-gray-700 font-bold">Total</th>
                <th className="py-3 px-2 text-right text-gray-700 font-bold">Paid</th>
                {showStaffShare && <th className="py-3 px-2 text-right text-[#0f766e] font-bold">Share</th>}
                <th className="py-3 px-2 text-right text-gray-700 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices?.map((inv) => {
                const { paidAmount, remaining } = getInvoiceStats(inv);
                return (
                  <tr key={inv.id} className="border-b border-gray-100">
                    <td className="py-3 px-2 text-gray-600 font-medium whitespace-nowrap">
                      {new Date(inv.issue_date).toLocaleDateString("en-GB")}<br/>
                      <span className="text-xs text-gray-500">{new Date(inv.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                    </td>
                    <td className="py-3 px-2 font-bold text-gray-800">
                      {/* @ts-ignore */}
                      {inv.patients?.full_name}
                    </td>
                    <td className="py-3 px-2 text-gray-700">
                      <span className="block font-medium">{inv.description || "-"}</span>
                      <span className="text-xs text-gray-500">
                        {/* @ts-ignore */}
                        {inv.clinic_departments?.name ? `${inv.clinic_departments.name} • ` : ""}
                        {(() => {
                           const therapistName = staffList?.find((s) => s.id === inv.therapist_id)?.full_name;
                           return therapistName ? `Dr. ${therapistName}` : "";
                        })()}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right text-gray-700 font-semibold">EGP {Number(inv.total || 0).toLocaleString()}</td>
                    <td className="py-3 px-2 text-right text-green-600 font-bold">EGP {paidAmount.toLocaleString()}</td>
                    {showStaffShare && <td className="py-3 px-2 text-right text-[#0f766e] font-bold">EGP {(() => {
                      let share = 0;
                      if (partsEnabled && staffSources.length > 0 && partnerships) {
                        partnerships.forEach((p) => {
                          if (staffSources.includes(p.id)) {
                            if (p.type === "percentage") {
                              share += (paidAmount * (p.value || 0)) / 100;
                            } else if (p.type === "fixed") {
                              if (totalPaid > 0) {
                                share += (p.value || 0) * (paidAmount / totalPaid);
                              }
                            } else if (p.type === "fraction") {
                              const num = p.fraction_numerator || 0;
                              const den = p.fraction_denominator || 1;
                              share += paidAmount * (num / den);
                            }
                          }
                        });
                      }
                      return share.toLocaleString();
                    })()}</td>}
                    <td className="py-3 px-2 text-right">
                      {remaining <= 0 ? (
                        <span className="text-green-600 font-bold">Paid</span>
                      ) : paidAmount > 0 ? (
                        <span className="text-yellow-600 font-bold">Partial</span>
                      ) : (
                        <span className="text-red-600 font-bold">Unpaid</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>

  );
}
