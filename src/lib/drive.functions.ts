import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
// استيراد النوع (Type) فقط عشان الـ Build ما يضربش في المتصفح
import type { JWT } from "google-auth-library";

// 1. إعداد مصادقة جوجل باستخدام الـ Service Account (بقت Async عشان نحمل المكتبة وقت اللزوم فقط)
async function getGoogleAuth() {
  // تحميل المكتبة في السيرفر فقط (Dynamic Import) لتفادي أخطاء البناء في واجهة المستخدم
  const { JWT: GoogleJWT } = await import("google-auth-library");

  const email = process.env.GOOGLE_CLIENT_EMAIL;
  let rawKey = process.env.GOOGLE_PRIVATE_KEY || "";

  if (!email || !rawKey) {
    throw new Error("Google Cloud credentials are missing.");
  }

  // تنظيف المفتاح من أي علامات تنصيص إضافية بتضيفها منصات الاستضافة
  if (rawKey.startsWith('"') && rawKey.endsWith('"')) {
    rawKey = rawKey.slice(1, -1);
  }
  if (rawKey.startsWith("'") && rawKey.endsWith("'")) {
    rawKey = rawKey.slice(1, -1);
  }

  // تحويل الـ \n النصية إلى سطور فعلية عشان التشفير يشتغل
  const privateKey = rawKey.replace(/\\n/g, '\n');

  return new GoogleJWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
}

// دالة مساعدة لإنشاء فولدر جوة جوجل درايف
async function ensureFolder(auth: JWT, name: string, parentId?: string) {
  const driveApiUrl = "https://www.googleapis.com/drive/v3/files";
  const token = await auth.getAccessToken();

  // البحث عن الفولدر
  const q = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false ${parentId ? `and '${parentId}' in parents` : ""}`;
  const searchRes = await fetch(`${driveApiUrl}?q=${encodeURIComponent(q)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token.token}` },
  });
  
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // إنشاء الفولدر لو مش موجود
  const createRes = await fetch(driveApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    }),
  });
  
  const createData = await createRes.json();
  return createData.id;
}

// 2. الدالة الأساسية: إعطاء تصريح الرفع المباشر للمتصفح
export const getDriveUploadToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { patientId: string; category: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // جلب بيانات المريض
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, code, full_name")
      .eq("id", data.patientId)
      .single();
      
    if (patientError || !patient) throw new Error("Patient not found.");

    // جلب الحساب الأساسي 
    const { data: account } = await supabase
      .from("storage_accounts")
      .select("id, root_folder_id")
      .eq("is_active", true)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();

    const auth = await getGoogleAuth();
    const token = await auth.getAccessToken();

    const rootId = account?.root_folder_id; 
    const patientFolderId = await ensureFolder(auth, `${patient.code} - ${patient.full_name}`, rootId);
    const categoryFolderId = await ensureFolder(auth, data.category, patientFolderId);

    return {
      accessToken: token.token,
      folderId: categoryFolderId,
      storageAccountId: account?.id,
    };
  });

// 3. دالة لحفظ بيانات الملف في قاعدة بيانات Supabase بعد ما الرفع المباشر ينجح
export const saveFileRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { patientId: string; category: string; fileName: string; mimeType: string; size: number; driveFileId: string; webViewLink: string; storageAccountId?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("patient_files").insert({
      patient_id: data.patientId,
      category: data.category,
      file_name: data.fileName,
      mime_type: data.mimeType,
      size_bytes: data.size,
      drive_file_id: data.driveFileId,
      drive_web_view_link: data.webViewLink,
      storage_account_id: data.storageAccountId || null,
      uploaded_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// 4. دالة حذف الملفات
export const deletePatientFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { fileId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("patient_files")
      .select("id, drive_file_id")
      .eq("id", data.fileId)
      .single();
      
    if (error || !row) throw new Error("File not found.");

    if (row.drive_file_id) {
      try {
        const auth = await getGoogleAuth();
        const token = await auth.getAccessToken();
        await fetch(`https://www.googleapis.com/drive/v3/files/${row.drive_file_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token.token}` },
        });
      } catch (e) {
        console.error("Drive delete failed", e);
      }
    }

    await supabase.from("patient_files").delete().eq("id", data.fileId);
    return { ok: true };
  });

// 5. دالة جلب مساحة التخزين (Storage Quota)
export const getDriveQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const auth = await getGoogleAuth();
      const token = await auth.getAccessToken();

      const res = await fetch("https://www.googleapis.com/drive/v3/about?fields=storageQuota", {
        headers: {
          Authorization: `Bearer ${token.token}`,
        },
      });

      if (!res.ok) {
        console.error("Failed to fetch drive quota");
        return { limit: 0, usage: 0 };
      }

      const data = await res.json();
      return {
        limit: Number(data.storageQuota?.limit || 0),
        usage: Number(data.storageQuota?.usage || 0),
      };
    } catch (error) {
      console.error("Error fetching drive quota:", error);
      return { limit: 0, usage: 0 };
    }
  });
