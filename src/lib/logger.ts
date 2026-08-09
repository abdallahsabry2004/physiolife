// src/lib/logger.ts

// قم بلصق الرابط الجديد الذي نسخته من جوجل هنا
export const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyxxUpADjcTvmW0h6Zc-YrqBFAn9_K9ZMJGMJCSxcCu6iDFet-lwdN3ggCZ8zZOZp9p/exec";

export function logActivityAsync(logData: {
  user_id?: string;
  user_name?: string;
  action: string;
  entity: string;
  details?: Record<string, unknown>;
}) {
  // التأكد من أن الرابط تم وضعه بشكل صحيح
  if (!GOOGLE_SHEETS_WEBHOOK_URL || GOOGLE_SHEETS_WEBHOOK_URL.includes("https://script.google.com/macros/s/AKfycbyxxUpADjcTvmW0h6Zc-YrqBFAn9_K9ZMJGMJCSxcCu6iDFet-lwdN3ggCZ8zZOZp9p/exec")) {
    console.warn("Audit Log Skipped: Webhook URL is not set.");
    return;
  }

  // إرسال البيانات لجوجل في الخلفية
  fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
    method: "POST",
    body: JSON.stringify(logData),
    headers: { "Content-Type": "text/plain;charset=utf-8" },
  })
    .then((res) => {
      if (!res.ok) console.error("Audit Log Error: Google script returned status", res.status);
    })
    .catch((err) => {
      console.error("Audit Log Network Error:", err);
    });
}
