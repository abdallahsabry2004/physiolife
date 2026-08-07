import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const FOLDER_MIME = "application/vnd.google-apps.folder";

type DriveFile = { id: string; name?: string; webViewLink?: string };

function driveHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("Google Drive is not connected yet for this project.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
  };
}

async function driveFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...driveHeaders(), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[Drive] ${path} failed [${res.status}]: ${body}`);
    throw new Error(`Google Drive request failed [${res.status}]: ${body}`);
  }
  return res;
}

/** Find (or create) a folder by name, optionally inside a parent folder. */
async function ensureFolder(name: string, parentId?: string | null): Promise<string> {
  const clauses = [
    `mimeType='${FOLDER_MIME}'`,
    `name='${name.replace(/'/g, "\\'")}'`,
    "trashed=false",
    parentId ? `'${parentId}' in parents` : null,
  ].filter(Boolean) as string[];

  const search = await driveFetch(
    `/drive/v3/files?q=${encodeURIComponent(clauses.join(" and "))}&fields=files(id,name)&pageSize=1`,
  );
  const found = (await search.json()) as { files?: DriveFile[] };
  const existing = found.files?.[0]?.id;
  if (existing) return existing;

  const created = await driveFetch(`/drive/v3/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  const folder = (await created.json()) as DriveFile;
  return folder.id;
}

type UploadInput = {
  patientId: string;
  category: string;
  fileName: string;
  mimeType: string;
  /** base64 (no data-url prefix) */
  content: string;
};

export const uploadPatientFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: UploadInput) => {
    if (!data?.patientId || !data.fileName || !data.content) {
      throw new Error("Missing file data");
    }
    if (data.content.length > 30_000_000) {
      throw new Error("File is too large — please keep uploads under 20 MB.");
    }
    return {
      patientId: data.patientId,
      category: data.category || "Other",
      fileName: data.fileName.slice(0, 200),
      mimeType: data.mimeType || "application/octet-stream",
      content: data.content,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, code, full_name")
      .eq("id", data.patientId)
      .single();
    if (patientError || !patient) throw new Error("Patient not found or not accessible.");

    // Pick the active storage account (primary first) for multi-Drive support.
    const { data: account } = await supabase
      .from("storage_accounts")
      .select("id, email, root_folder_id, is_primary")
      .eq("is_active", true)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();

    const rootId = account?.root_folder_id ?? (await ensureFolder("Physio Life Patients", null));
    const patientFolderId = await ensureFolder(
      `${patient.code} - ${patient.full_name}`.slice(0, 120),
      rootId,
    );
    const categoryFolderId = await ensureFolder(data.category, patientFolderId);

    const boundary = `physiolife-${crypto.randomUUID()}`;
    const metadata = JSON.stringify({
      name: data.fileName,
      parents: [categoryFolderId],
    });
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${data.mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`,
      ),
      Buffer.from(data.content),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploaded = await driveFetch(
      `/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size,mimeType`,
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    const file = (await uploaded.json()) as DriveFile & { size?: string };

    const { error: insertError } = await supabase.from("patient_files").insert({
      patient_id: data.patientId,
      category: data.category,
      file_name: data.fileName,
      mime_type: data.mimeType,
      size_bytes: file.size ? Number(file.size) : null,
      drive_file_id: file.id,
      drive_web_view_link: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
      storage_account_id: account?.id ?? null,
      uploaded_by: userId,
    });
    if (insertError) throw new Error(insertError.message);

    return { ok: true, driveFileId: file.id };
  });

export const deletePatientFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fileId: string }) => {
    if (!data?.fileId) throw new Error("Missing file id");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("patient_files")
      .select("id, drive_file_id")
      .eq("id", data.fileId)
      .single();
    if (error || !row) throw new Error("File not found or not accessible.");

    if (row.drive_file_id) {
      try {
        await driveFetch(`/drive/v3/files/${row.drive_file_id}`, { method: "DELETE" });
      } catch (e) {
        console.error("[Drive] delete failed, removing metadata anyway", e);
      }
    }

    const { error: delError } = await supabase.from("patient_files").delete().eq("id", data.fileId);
    if (delError) throw new Error(delError.message);
    return { ok: true };
  });
