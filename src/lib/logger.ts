// src/lib/logger.ts

// ضع الرابط الذي نسخته من الخطوة السابقة هنا
const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyxxUpADjcTvmW0h6Zc-YrqBFAn9_K9ZMJGMJCSxcCu6iDFet-lwdN3ggCZ8zZOZp9p/exec";

export function logActivityAsync(logData: {
  user_id?: string;
  user_name?: string;
  action: string;
  entity: string;
  details?: Record<string, unknown>;
}) {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return;

  // إرسال البيانات في الخلفية (Fire and Forget) بدون await 
  // المتصفح لن ينتظر الرد، ولن يشعر المستخدم بأي تأخير
  fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
    method: "POST",
    body: JSON.stringify(logData),
    // نستخدم text/plain لتفادي فحوصات الأمان (CORS Preflight) المعقدة للمتصفح
    headers: { "Content-Type": "text/plain;charset=utf-8" },
  }).catch((err) => {
    console.error("Failed to log activity to Google Sheets", err);
  });
}
