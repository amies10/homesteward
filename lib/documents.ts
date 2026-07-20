// K1: document & warranty vault. Read-fresh, not localStorage-cached — unlike
// reports/completions elsewhere in the app, this is explicitly not an
// offline-first feature per the plan.
import { supabase } from "./supabase-client";
import { uploadUserDocument, removePaths } from "./storage";

export interface DocumentItem {
  id: string;
  title: string;
  category: "manual" | "warranty" | "invoice" | "permit" | "paint" | "other";
  sectionSlug?: string | null;
  reportId?: string | null;
  storagePath: string;
  fileName?: string | null;
  mimeType?: string | null;
  createdAt: string;
}

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

export async function loadDocuments(): Promise<DocumentItem[]> {
  try {
    const { data, error } = await supabase
      .from("documents")
      .select("id, title, category, section_slug, report_id, storage_path, file_name, mime_type, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      sectionSlug: row.section_slug ?? undefined,
      reportId: row.report_id ?? undefined,
      storagePath: row.storage_path,
      fileName: row.file_name ?? undefined,
      mimeType: row.mime_type ?? undefined,
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.warn("[documents] loadDocuments failed", err);
    return [];
  }
}

export async function uploadDocument(
  file: File,
  opts: { title: string; category: DocumentItem["category"]; sectionSlug?: string }
): Promise<DocumentItem | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.warn("[documents] uploadDocument: no authenticated user_id.");
    return null;
  }

  const storagePath = await uploadUserDocument(userId, file);
  if (!storagePath) return null;

  try {
    const { data, error } = await supabase
      .from("documents")
      .insert({
        user_id: userId,
        title: opts.title,
        category: opts.category,
        section_slug: opts.sectionSlug ?? null,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type,
      })
      .select("id, created_at")
      .single();
    if (error) throw error;

    return {
      id: data.id,
      title: opts.title,
      category: opts.category,
      sectionSlug: opts.sectionSlug ?? null,
      storagePath,
      fileName: file.name,
      mimeType: file.type,
      createdAt: data.created_at,
    };
  } catch (err) {
    console.warn("[documents] uploadDocument: insert failed", err);
    return null;
  }
}

export async function deleteDocument(id: string, storagePath: string): Promise<void> {
  try {
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) throw error;
  } catch (err) {
    console.warn("[documents] deleteDocument: row delete failed", err);
  }
  await removePaths([storagePath]);
}
