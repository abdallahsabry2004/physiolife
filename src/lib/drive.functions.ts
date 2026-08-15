import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { OAuth2Client } from "google-auth-library";

// 1. إعداد مصادقة جوجل باستخدام Refresh Token
async function getGoogleAuth() {
  const { OAuth2Client } = await import("google-auth-library");
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
  const refreshToken = process.env["GOOGLE_REFRESH_TOKEN"];

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google OAuth credentials are missing.");
  }

  // استخدام الايميل المباشر كصاحب الملفات
  const auth = new OAuth2Client(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  return auth;
}

// دالة مساعدة لإنشاء فولدر
async function ensureFolder(auth: OAuth2Client, name: string, parentId?: string) {
  const driveApiUrl = "https://www.googleapis.com/drive/v3/files";
  const { token } = await auth.getAccessToken();

  const q = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false ${parentId ? `and '${parentId}' in parents` : ""}`;
  const searchRes = await fetch(`${driveApiUrl}?q=${encodeURIComponent(q)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch(driveApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
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

// 2. طلب رابط الرفع من جوجل
export const initiateDriveUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: { patientId: string; category: string; fileName: string; mimeType: string }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, code, full_name")
      .eq("id", data.patientId)
      .single();

    if (patientError || !patient) throw new Error("Patient not found.");

    const { data: account } = await supabase
      .from("storage_accounts")
      .select("id, root_folder_id")
      .eq("is_active", true)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();

    const auth = await getGoogleAuth();
    const { token } = await auth.getAccessToken();

    const rootId = account?.root_folder_id;
    const patientFolderId = await ensureFolder(
      auth,
      `${patient.code} - ${patient.full_name}`,
      rootId ?? undefined,
    );
    const categoryFolderId = await ensureFolder(auth, data.category, patientFolderId);

    const initRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink,size",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": data.mimeType,
        },
        body: JSON.stringify({
          name: data.fileName,
          parents: [categoryFolderId],
        }),
      },
    );

    if (!initRes.ok) {
      throw new Error("Failed to initialize Google Drive upload on server.");
    }

    const uploadUrl = initRes.headers.get("Location");
    if (!uploadUrl) {
      throw new Error("Google didn't return an upload URL.");
    }

    return {
      uploadUrl,
      storageAccountId: account?.id,
    };
  });

export const initiateGenericDriveUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { folderName: string; fileName: string; mimeType: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: account } = await supabase
      .from("storage_accounts")
      .select("id, root_folder_id")
      .eq("is_active", true)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();

    const auth = await getGoogleAuth();
    const { token } = await auth.getAccessToken();

    const rootId = account?.root_folder_id;
    const targetFolderId = await ensureFolder(auth, data.folderName, rootId ?? undefined);

    const initRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink,size",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": data.mimeType,
        },
        body: JSON.stringify({
          name: data.fileName,
          parents: [targetFolderId],
        }),
      },
    );

    if (!initRes.ok) {
      throw new Error("Failed to initialize generic Google Drive upload.");
    }

    const uploadUrl = initRes.headers.get("Location");
    if (!uploadUrl) {
      throw new Error("Google didn't return an upload URL.");
    }

    return { uploadUrl };
  });

// 3. رفع الأجزاء (Chunks) للسيرفر
export const uploadDriveChunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      uploadUrl: string;
      chunkBase64: string;
      start: number;
      end: number;
      totalSize: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const buffer = Buffer.from(data.chunkBase64, "base64");

    const res = await fetch(data.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Range": `bytes ${data.start}-${data.end}/${data.totalSize}`,
      },
      body: buffer,
    });

    if (res.status === 308) {
      return { status: 308, data: null }; // الاستمرار في الرفع
    }

    if (res.status === 200 || res.status === 201) {
      const driveData = await res.json();
      return { status: res.status, data: driveData }; // اكتمال الرفع
    }

    const errText = await res.text();
    throw new Error(`Upload failed at Google: ${res.status} ${errText}`);
  });

export const makeDriveFilePublic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { driveFileId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const auth = await getGoogleAuth();
      const { token } = await auth.getAccessToken();
      await fetch(`https://www.googleapis.com/drive/v3/files/${data.driveFileId}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "reader",
          type: "anyone",
        }),
      });
      // also fetch webViewLink
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${data.driveFileId}?fields=webViewLink,id`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const fileData = await res.json();
      return { ok: true, webViewLink: fileData.webViewLink };
    } catch (e) {
      console.error("Failed to make file public", e);
      throw e;
    }
  });

// 4. حفظ بيانات الملف في قاعدة بيانات Supabase
export const saveFileRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      patientId: string;
      category: string;
      fileName: string;
      mimeType: string;
      size: number;
      driveFileId: string;
      webViewLink: string;
      storageAccountId?: string | undefined;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Make the file publicly readable (anyone with the link)
    if (data.driveFileId) {
      try {
        const auth = await getGoogleAuth();
        const { token } = await auth.getAccessToken();
        await fetch(`https://www.googleapis.com/drive/v3/files/${data.driveFileId}/permissions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: "reader",
            type: "anyone",
          }),
        });
      } catch (e) {
        console.error("Failed to set public permissions on drive file:", e);
      }
    }

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

// 5. حذف الملفات
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
        const { token } = await auth.getAccessToken();
        await fetch(`https://www.googleapis.com/drive/v3/files/${row.drive_file_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        console.error("Drive delete failed", e);
      }
    }

    await supabase.from("patient_files").delete().eq("id", data.fileId);
    return { ok: true };
  });

// 6. مساحة التخزين
export const getDriveQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const auth = await getGoogleAuth();
      const { token } = await auth.getAccessToken();

      const res = await fetch("https://www.googleapis.com/drive/v3/about?fields=storageQuota", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return { limit: 0, usage: 0 };

      const data = await res.json();
      return {
        limit: Number(data.storageQuota?.limit || 0),
        usage: Number(data.storageQuota?.usage || 0),
      };
    } catch (error) {
      return { limit: 0, usage: 0 };
    }
  });
