import { supabase } from "./supabase-client";

const BUCKET = "homesteward";

export async function uploadReportPdf(
  userId: string,
  reportId: string,
  file: File
): Promise<string | null> {
  const path = `reports/${userId}/${reportId}.pdf`;
  try {
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) throw error;
    return path;
  } catch (err) {
    console.warn("[storage] uploadReportPdf failed", err);
    return null;
  }
}

export async function uploadIssuePhoto(
  userId: string,
  reportId: string,
  slug: string,
  index: number,
  file: File | Blob
): Promise<string | null> {
  const path = `photos/${userId}/${reportId}/${slug}/${index}/${Date.now()}.jpg`;
  try {
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: "image/jpeg",
    });
    if (error) throw error;
    return path;
  } catch (err) {
    console.warn("[storage] uploadIssuePhoto failed", err);
    return null;
  }
}

export async function uploadAvatar(userId: string, file: File | Blob): Promise<string | null> {
  const path = `avatars/${userId}/avatar.jpg`;
  try {
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) throw error;
    return path;
  } catch (err) {
    console.warn("[storage] uploadAvatar failed", err);
    return null;
  }
}

export async function getSignedUrl(
  path: string,
  expiresIn = 3600,
  downloadName?: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresIn, downloadName ? { download: downloadName } : undefined);
    if (error) throw error;
    return data?.signedUrl ?? null;
  } catch (err) {
    console.warn("[storage] getSignedUrl failed", err);
    return null;
  }
}

export async function signPaths(paths: string[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    paths.map(async (path) => [path, await getSignedUrl(path)] as const)
  );
  const result: Record<string, string> = {};
  for (const [path, url] of entries) {
    if (url) result[path] = url;
  }
  return result;
}

export async function removePaths(paths: string[]): Promise<void> {
  if (!paths.length) return;
  try {
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) throw error;
  } catch (err) {
    console.warn("[storage] removePaths failed", err);
  }
}

export async function downscaleImage(file: File | Blob, maxEdge = 1568): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file instanceof Blob ? file : new Blob([file]);
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ?? (file instanceof Blob ? file : new Blob([file]))),
      "image/jpeg",
      0.85
    );
  });
}
