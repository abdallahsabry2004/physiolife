import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "ar";

const dict = {
  // shell / nav
  "app.name": { en: "Physio Life", ar: "فيزيو لايف" },
  "app.tagline": { en: "PT Center EMR", ar: "سجلات مركز العلاج الطبيعي" },
  "nav.dashboard": { en: "Dashboard", ar: "الرئيسية" },
  "nav.patients": { en: "Patients", ar: "المرضى" },
  "nav.exercises": { en: "Exercise Library", ar: "مكتبة التمارين" },
  "nav.questionnaires": { en: "Questionnaires", ar: "الاستبيانات" },
  "nav.billing": { en: "Billing", ar: "الفواتير" },
  "nav.notifications": { en: "Notifications", ar: "التنبيهات" },
  "nav.analytics": { en: "Analytics", ar: "التحليلات" },
  "nav.financialReports": { en: "Financial Reports", ar: "التقارير المالية" },
  "nav.admin": { en: "Administration", ar: "الإدارة" },
  "shell.signOut": { en: "Sign out", ar: "تسجيل الخروج" },
  "shell.staff": { en: "Staff member", ar: "عضو فريق" },
  "shell.noRole": { en: "no role assigned", ar: "بدون صلاحية" },
  "shell.language": { en: "العربية", ar: "English" },

  // notifications
  "notif.title": { en: "Notifications", ar: "التنبيهات" },
  "notif.subtitle": {
    en: "Follow-ups, due payments and clinic reminders.",
    ar: "المتابعات والمدفوعات المستحقة وتنبيهات العيادة.",
  },
  "notif.empty": { en: "Nothing to review right now.", ar: "لا يوجد ما يحتاج مراجعة حاليًا." },
  "notif.markAll": { en: "Mark all as read", ar: "تحديد الكل كمقروء" },
  "notif.markRead": { en: "Mark read", ar: "تم" },
  "notif.unread": { en: "Unread", ar: "غير مقروء" },
  "notif.new": { en: "New reminder", ar: "تنبيه جديد" },
  "notif.create": { en: "Add reminder", ar: "إضافة تنبيه" },
  "notif.titleField": { en: "Title", ar: "العنوان" },
  "notif.bodyField": { en: "Details", ar: "التفاصيل" },
  "notif.dueField": { en: "Due date", ar: "تاريخ الاستحقاق" },
  "notif.auto": { en: "Auto-generated alerts", ar: "تنبيهات تلقائية" },
  "notif.unpaid": { en: "unpaid invoice", ar: "فاتورة غير مدفوعة" },
  "notif.inactive": {
    en: "no session in the last 21 days",
    ar: "لا توجد جلسة خلال ٢١ يومًا",
  },

  // analytics
  "an.title": { en: "Analytics", ar: "التحليلات" },
  "an.subtitle": {
    en: "Caseload, attendance, revenue and outcome trends.",
    ar: "حجم الحالات والحضور والإيرادات ومؤشرات التحسن.",
  },
  "an.sessionsMonth": { en: "Sessions per month", ar: "الجلسات شهريًا" },
  "an.revenueMonth": { en: "Revenue per month", ar: "الإيرادات شهريًا" },
  "an.newPatients": { en: "New patients per month", ar: "مرضى جدد شهريًا" },
  "an.attendance": { en: "Attendance breakdown", ar: "توزيع الحضور" },
  "an.painDrop": { en: "Average pain reduction", ar: "متوسط انخفاض الألم" },
  "an.perTherapist": { en: "Sessions per therapist", ar: "الجلسات لكل معالج" },
  "an.points": { en: "points", ar: "نقاط" },
  "an.noData": { en: "Not enough data yet.", ar: "لا توجد بيانات كافية بعد." },

  // admin clinical fields
  "cf.title": { en: "Clinical field catalog", ar: "قائمة العناصر الإكلينيكية" },
  "cf.subtitle": {
    en: "Suggestions therapists can pick from. Nothing here is mandatory in a patient record.",
    ar: "اقتراحات يختار منها المعالج، ولا شيء منها إلزامي في ملف المريض.",
  },
  "cf.module": { en: "Module", ar: "القسم" },
  "cf.label": { en: "English label", ar: "الاسم بالإنجليزية" },
  "cf.labelAr": { en: "Arabic label", ar: "الاسم بالعربية" },
  "cf.add": { en: "Add suggestion", ar: "إضافة اقتراح" },
  "cf.delete": { en: "Remove", ar: "حذف" },
  "common.save": { en: "Save", ar: "حفظ" },

  // per-user page permissions
  "perm.denied": {
    en: "You don't have access to this page.",
    ar: "لا تملك صلاحية الوصول لهذه الصفحة.",
  },
  "perm.deniedHint": {
    en: "Ask a super admin to grant you access from Administration.",
    ar: "اطلب من المسؤول الأعلى منحك الصلاحية من صفحة الإدارة.",
  },
  "perm.button": { en: "Permissions", ar: "الصلاحيات" },
  "perm.dialogTitle": { en: "Page access permissions", ar: "صلاحيات الوصول للصفحات" },
  // Patients Page
  "pt.title": { en: "Patients", ar: "المرضى" },
  "pt.subtitle": { 
    en: "permanent records · instant search by name, phone or ID", 
    ar: "سجلات دائمة · بحث فوري بالاسم، الهاتف أو المعرف" 
  },
  "pt.register": { en: "Register patient", ar: "تسجيل مريض" },
  "pt.registerTitle": { en: "Register a new patient", ar: "تسجيل مريض جديد" },
  "pt.fullName": { en: "Full name", ar: "الاسم الكامل" },
  "pt.gender": { en: "Gender", ar: "الجنس" },
  "pt.male": { en: "Male", ar: "ذكر" },
  "pt.female": { en: "Female", ar: "أنثى" },
  "pt.select": { en: "Select", ar: "اختر" },
  "pt.category": { en: "Category", ar: "التصنيف" },
  "pt.age": { en: "Age", ar: "العمر" },
  "pt.phone": { en: "Phone", ar: "رقم الهاتف" },
  "pt.occupation": { en: "Occupation", ar: "المهنة" },
  "pt.patientAddress": { en: "Patient Address", ar: "عنوان المريض" },
  "pt.diagnosis": { en: "Working diagnosis", ar: "التشخيص المبدئي" },
  "pt.diagnosisPlaceholder": { en: "e.g. Low back pain", ar: "مثال: آلام أسفل الظهر" },
  "pt.referralSource": { en: "Referral source", ar: "مصدر التحويل" },
  "pt.referralPhone": { en: "Referral phone number", ar: "رقم هاتف المحوّل" },
  "pt.referralAddress": { en: "Referral Address", ar: "عنوان المحوّل" },
  "pt.savePatient": { en: "Save patient", ar: "حفظ المريض" },
  "pt.searchPlaceholder": { en: "Search name, phone or patient ID…", ar: "ابحث بالاسم، الهاتف أو المعرف..." },
  "pt.allStatuses": { en: "All statuses", ar: "جميع الحالات" },
  "pt.active": { en: "Active", ar: "نشط" },
  "pt.discharged": { en: "Discharged", ar: "تم الخروج" },
  "pt.onHold": { en: "On hold", ar: "قيد الانتظار" },
  "pt.activeOnly": { en: "Active only", ar: "النشطين فقط" },
  "pt.allGenders": { en: "All genders", ar: "الجميع" },
  "pt.loading": { en: "Loading patients…", ar: "جاري تحميل المرضى..." },
  "pt.noPatients": { en: "No patients match your search.", ar: "لا يوجد مرضى يطابقون بحثك." },
  "pt.noPhone": { en: "no phone", ar: "لا يوجد هاتف" },
  "pt.noDiagnosis": { en: "No diagnosis yet", ar: "لا يوجد تشخيص بعد" },
  "pt.rowsPerPage": { en: "Rows per page:", ar: "الصفوف في الصفحة:" },
  "pt.pageOf": { en: "Page {page} of {totalPages}", ar: "صفحة {page} من {totalPages}" },
  "pt.prev": { en: "Prev", ar: "السابق" },
  "pt.next": { en: "Next", ar: "التالي" },
  "pt.registeredSuccess": { en: "Patient registered", ar: "تم تسجيل المريض بنجاح" },
  "pt.yrs": { en: "yrs", ar: "سنة" },

} as const;

export type TKey = keyof typeof dict;

type Ctx = { lang: Lang; dir: "ltr" | "rtl"; setLang: (l: Lang) => void; t: (k: TKey) => string };

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("pl-lang");
    if (stored === "ar" || stored === "en") setLangState(stored);
  }, []);

  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("pl-lang", l);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      setLang,
      t: (k: TKey) => dict[k][lang] ?? dict[k].en,
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
