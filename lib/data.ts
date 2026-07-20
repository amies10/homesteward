import { supabase } from "./supabase-client";
import { uploadReportPdf, removePaths } from "./storage";
import {
  COMPLETIONS_KEY,
  IGNORED_KEY,
  USER_PROFILE_KEY,
  issueKey,
  diyKey,
  contractorsKey,
  type ParsedReport,
  type ReportSection,
  type StoredReport,
  type CompletionRecord,
  type UserProfile,
  type IssueDetails,
} from "./sections";

const REPORTS_CACHE_KEY = "homesteward_reports_v2";

// Legacy single-report keys, pre-Phase-2. Only read once, to detect and clean
// up stale state left behind by the old single-report model.
const LEGACY_REPORT_KEY = "homesteward_report";
const LEGACY_REPORT_ID_KEY = "homesteward_report_id";

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

// Stale per-issue caches are keyed by report_id (embedded in the key), slug,
// and index. When reportId is omitted, every issue/diy/contractor cache is
// purged (used for the legacy single-report cleanup). When reportId is given,
// only that report's entries are purged (used by deleteReport).
function purgeStaleIssueCaches(reportId?: string): void {
  const prefixes = ["homesteward_issue_details_", "homesteward_diy_", "homesteward_contractors_"];
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !prefixes.some((p) => key.startsWith(p))) continue;
    if (!reportId) {
      keysToRemove.push(key);
    } else if (key.includes(`_${reportId}_`) || key.endsWith(`_${reportId}`)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

function readReportsCache(): StoredReport[] {
  try {
    const stored = localStorage.getItem(REPORTS_CACHE_KEY);
    return stored ? (JSON.parse(stored) as StoredReport[]) : [];
  } catch {
    return [];
  }
}

function writeReportsCache(reports: StoredReport[]): void {
  localStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify(reports));
}

function cleanupLegacyKeysIfNeeded(): void {
  const hadLegacy =
    localStorage.getItem(LEGACY_REPORT_KEY) !== null || localStorage.getItem(LEGACY_REPORT_ID_KEY) !== null;
  if (!hadLegacy) return;
  localStorage.removeItem(LEGACY_REPORT_KEY);
  localStorage.removeItem(LEGACY_REPORT_ID_KEY);
  purgeStaleIssueCaches();
}

// ── Reports ────────────────────────────────────────────────────────────────

export async function loadReports(): Promise<StoredReport[]> {
  cleanupLegacyKeysIfNeeded();

  try {
    const { data, error } = await supabase
      .from("reports")
      .select("id, raw_sections, pdf_storage_path, pdf_filename, location_used, document_type, parser_note, created_at")
      .order("created_at", { ascending: true });

    if (error) throw error;

    const reports: StoredReport[] = (data ?? []).map((row) => ({
      id: row.id,
      sections: row.raw_sections ?? [],
      pdfStoragePath: row.pdf_storage_path ?? undefined,
      pdfFilename: row.pdf_filename ?? undefined,
      locationUsed: row.location_used ?? undefined,
      documentType: row.document_type ?? undefined,
      parserNote: row.parser_note ?? undefined,
      createdAt: row.created_at,
    }));

    writeReportsCache(reports);
    return reports;
  } catch (err) {
    console.warn("[data] loadReports: Supabase unavailable, falling back to cache.", err);
    return readReportsCache();
  }
}

export function getBaseReportId(): string | null {
  const reports = readReportsCache();
  return reports[0]?.id ?? null;
}

export async function saveReport(
  report: ParsedReport,
  filename: string,
  pdfFile?: File,
  extras?: { documentType?: string; parserNote?: string }
): Promise<StoredReport> {
  const userId = await getCurrentUserId();
  console.log("[data] saveReport: attempting Supabase insert", { filename, sectionCount: report.sections.length });

  const { data, error } = await supabase
    .from("reports")
    .insert({
      raw_sections: report.sections,
      pdf_filename: filename,
      user_id: userId,
      document_type: extras?.documentType ?? null,
      parser_note: extras?.parserNote ?? null,
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error("[data] saveReport: Supabase error", error);
    throw error;
  }
  console.log("[data] saveReport: success", data);

  let pdfStoragePath: string | null = null;
  let locationUsed: string | null = null;
  if (userId) {
    const updates: Record<string, unknown> = {};
    if (pdfFile) {
      const path = await uploadReportPdf(userId, data.id, pdfFile);
      if (path) {
        updates.pdf_storage_path = path;
        pdfStoragePath = path;
      }
    }
    const profile = await loadUserProfile();
    locationUsed = profile?.location ?? null;
    updates.location_used = locationUsed;
    if (Object.keys(updates).length) {
      const { error: updateError } = await supabase.from("reports").update(updates).eq("id", data.id);
      if (updateError) console.warn("[data] saveReport: post-insert update failed", updateError);
    }
  }

  const stored: StoredReport = {
    id: data.id,
    sections: report.sections,
    pdfFilename: filename,
    pdfStoragePath,
    locationUsed,
    documentType: extras?.documentType ?? null,
    parserNote: extras?.parserNote ?? null,
    createdAt: data.created_at,
  };

  const cache = readReportsCache();
  cache.push(stored);
  writeReportsCache(cache);

  return stored;
}

export async function updateReportSections(reportId: string, sections: ReportSection[]): Promise<void> {
  const cache = readReportsCache();
  const idx = cache.findIndex((r) => r.id === reportId);
  if (idx !== -1) {
    cache[idx] = { ...cache[idx], sections };
    writeReportsCache(cache);
  }

  try {
    const { error } = await supabase.from("reports").update({ raw_sections: sections }).eq("id", reportId);
    if (error) throw error;
  } catch (err) {
    console.warn("[data] updateReportSections: Supabase unavailable, localStorage only.", err);
  }
}

export async function deleteReport(reportId: string): Promise<void> {
  const pathsToRemove: string[] = [];
  try {
    const { data: reportRow } = await supabase
      .from("reports")
      .select("pdf_storage_path")
      .eq("id", reportId)
      .maybeSingle();
    if (reportRow?.pdf_storage_path) pathsToRemove.push(reportRow.pdf_storage_path);

    const { data: issueRows } = await supabase
      .from("issue_details")
      .select("photo_paths")
      .eq("report_id", reportId);
    for (const row of issueRows ?? []) {
      const paths = (row.photo_paths as string[] | null) ?? [];
      pathsToRemove.push(...paths);
    }
  } catch (err) {
    console.warn("[data] deleteReport: failed to collect storage paths.", err);
  }

  try {
    // Delete child rows first (FK constraint), then the report row
    await supabase.from("completed_fixes").delete().eq("report_id", reportId);
    await supabase.from("ignored_issues").delete().eq("report_id", reportId);
    await supabase.from("issue_details").delete().eq("report_id", reportId);
    await supabase.from("reports").delete().eq("id", reportId);
  } catch (err) {
    console.warn("[data] deleteReport: Supabase delete failed.", err);
  }

  try {
    await removePaths(pathsToRemove);
  } catch (err) {
    console.warn("[data] deleteReport: storage cleanup failed.", err);
  }

  purgeStaleIssueCaches(reportId);

  const cache = readReportsCache().filter((r) => r.id !== reportId);
  writeReportsCache(cache);
}

export async function ensureBaseReport(): Promise<StoredReport> {
  const reports = await loadReports();
  if (reports.length > 0) return reports[0];

  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("reports")
    .insert({ raw_sections: [], pdf_filename: null, user_id: userId, document_type: "Manual entries" })
    .select("id, created_at")
    .single();

  if (error) {
    console.error("[data] ensureBaseReport: Supabase insert failed", error);
    throw error;
  }

  const stored: StoredReport = {
    id: data.id,
    sections: [],
    pdfFilename: null,
    pdfStoragePath: null,
    locationUsed: null,
    documentType: "Manual entries",
    parserNote: null,
    createdAt: data.created_at,
  };

  const cache = readReportsCache();
  cache.push(stored);
  writeReportsCache(cache);
  return stored;
}

export async function markReportLocationUsed(reportId: string, location: string): Promise<void> {
  const cache = readReportsCache();
  const idx = cache.findIndex((r) => r.id === reportId);
  if (idx !== -1) {
    cache[idx] = { ...cache[idx], locationUsed: location };
    writeReportsCache(cache);
  }

  try {
    const { error } = await supabase.from("reports").update({ location_used: location }).eq("id", reportId);
    if (error) throw error;
  } catch (err) {
    console.warn("[data] markReportLocationUsed: Supabase unavailable.", err);
  }
}

// ── Issue details (lazy-loaded DIY plan + expert guide) ────────────────────

function issueDetailsKey(reportId: string, slug: string, index: number) {
  return `homesteward_issue_details_${reportId}_${slug}_${index}`;
}

export async function loadIssueDetails(
  reportId: string,
  slug: string,
  issueIndex: number
): Promise<IssueDetails | null> {
  try {
    const { data, error } = await supabase
      .from("issue_details")
      .select(
        "materials_list, step_by_step_plan, contractor_briefing, user_observation, photo_paths, step_elaborations, safety_warning"
      )
      .eq("report_id", reportId)
      .eq("section_slug", slug)
      .eq("issue_index", issueIndex)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      const details: IssueDetails = {
        materialsList: data.materials_list ?? undefined,
        stepByStepPlan: data.step_by_step_plan ?? undefined,
        contractorBriefing: data.contractor_briefing ?? undefined,
        userObservation: data.user_observation ?? undefined,
        photoPaths: data.photo_paths ?? undefined,
        stepElaborations: data.step_elaborations ?? undefined,
        safetyWarning: data.safety_warning ?? undefined,
      };
      localStorage.setItem(issueDetailsKey(reportId, slug, issueIndex), JSON.stringify(details));
      return details;
    }
  } catch (err) {
    const pgError = err as { code?: string; message?: string; details?: string; hint?: string };
    console.error("[data] loadIssueDetails: Supabase query FAILED — falling back to localStorage.", {
      code: pgError?.code,
      message: pgError?.message,
      details: pgError?.details,
      hint: pgError?.hint,
      raw: err,
    });
  }

  try {
    const stored = localStorage.getItem(issueDetailsKey(reportId, slug, issueIndex));
    return stored ? (JSON.parse(stored) as IssueDetails) : null;
  } catch {
    return null;
  }
}

export async function saveIssueDetails(
  reportId: string,
  slug: string,
  issueIndex: number,
  details: IssueDetails
): Promise<void> {
  localStorage.setItem(issueDetailsKey(reportId, slug, issueIndex), JSON.stringify(details));

  const userId = await getCurrentUserId();
  if (!userId) {
    console.warn(
      "[data] saveIssueDetails: no authenticated user_id — RLS will reject this write, saving locally only.",
      { reportId, slug, issueIndex }
    );
    return;
  }

  const payload = {
    report_id: reportId,
    section_slug: slug,
    issue_index: issueIndex,
    materials_list: details.materialsList ?? null,
    step_by_step_plan: details.stepByStepPlan ?? null,
    contractor_briefing: details.contractorBriefing ?? null,
    user_observation: details.userObservation ?? null,
    photo_paths: details.photoPaths ?? null,
    step_elaborations: details.stepElaborations ?? null,
    safety_warning: details.safetyWarning ?? null,
    updated_at: new Date().toISOString(),
    user_id: userId,
  };

  try {
    const { error } = await supabase
      .from("issue_details")
      .upsert(payload, { onConflict: "report_id,section_slug,issue_index" });
    if (error) throw error;
  } catch (err) {
    const pgError = err as { code?: string; message?: string; details?: string; hint?: string };
    console.error("[data] saveIssueDetails: Supabase upsert FAILED — falling back to localStorage only.", {
      code: pgError?.code,
      message: pgError?.message,
      details: pgError?.details,
      hint: pgError?.hint,
      raw: err,
    });
  }
}

// Moves an issue's stored details/completion/ignore rows to a new
// (slug, index) within the same report — used when an issue is moved between
// sections. Storage/photo paths are opaque strings and are left untouched.
export async function moveIssueDetails(
  reportId: string,
  fromSlug: string,
  fromIndex: number,
  toSlug: string,
  toIndex: number
): Promise<void> {
  try {
    await supabase
      .from("issue_details")
      .update({ section_slug: toSlug, issue_index: toIndex })
      .eq("report_id", reportId)
      .eq("section_slug", fromSlug)
      .eq("issue_index", fromIndex);
    await supabase
      .from("completed_fixes")
      .update({ section_slug: toSlug, issue_index: toIndex })
      .eq("report_id", reportId)
      .eq("section_slug", fromSlug)
      .eq("issue_index", fromIndex);
    await supabase
      .from("ignored_issues")
      .update({ section_slug: toSlug, issue_index: toIndex })
      .eq("report_id", reportId)
      .eq("section_slug", fromSlug)
      .eq("issue_index", fromIndex);
  } catch (err) {
    console.warn("[data] moveIssueDetails: Supabase update failed.", err);
  }

  function rename(oldKey: string, newKey: string) {
    const val = localStorage.getItem(oldKey);
    if (val !== null) {
      localStorage.setItem(newKey, val);
      localStorage.removeItem(oldKey);
    }
  }

  rename(issueDetailsKey(reportId, fromSlug, fromIndex), issueDetailsKey(reportId, toSlug, toIndex));
  (["materials", "steps", "chat"] as const).forEach((type) => {
    rename(diyKey(reportId, fromSlug, fromIndex, type), diyKey(reportId, toSlug, toIndex, type));
  });
  rename(contractorsKey(reportId, fromSlug, fromIndex), contractorsKey(reportId, toSlug, toIndex));
}

// F1: every issue_details row with a non-null materials list, across every
// report the user has ever uploaded — used to cross-reference the toolbox
// against open issues (see lib/toolbox-match.ts). Read-only, best-effort like
// the rest of this file's Supabase reads.
export async function loadAllIssueDetailsForUser(): Promise<
  Array<{ reportId: string; slug: string; issueIndex: number; materialsList: IssueDetails["materialsList"] }>
> {
  try {
    const { data, error } = await supabase
      .from("issue_details")
      .select("report_id, section_slug, issue_index, materials_list")
      .not("materials_list", "is", null);
    if (error) throw error;

    return (data ?? []).map((row) => ({
      reportId: row.report_id,
      slug: row.section_slug,
      issueIndex: row.issue_index,
      materialsList: row.materials_list ?? undefined,
    }));
  } catch (err) {
    console.warn("[data] loadAllIssueDetailsForUser failed", err);
    return [];
  }
}

// ── User profile ───────────────────────────────────────────────────────────

// Address is populated separately from inspection-report parsing (see
// updateProfileAddress), never from this call — preserve whatever's already
// cached/stored rather than letting an address-less save wipe it out.
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  let address = profile.address;
  if (address === undefined) {
    try {
      const stored = localStorage.getItem(USER_PROFILE_KEY);
      if (stored) address = (JSON.parse(stored) as UserProfile).address;
    } catch {}
  }
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify({ ...profile, address }));

  const userId = await getCurrentUserId();
  if (!userId) return;

  try {
    const payload: Record<string, unknown> = {
      user_id: userId,
      skill_level: profile.skillLevel,
      location: profile.location,
      onboarding_completed: profile.onboardingCompleted,
      account_type: profile.accountType ?? "owner",
    };
    if (address !== undefined) payload.address = address;
    const { error } = await supabase.from("user_profile").upsert(payload, { onConflict: "user_id" });
    if (error) throw error;
  } catch (err) {
    console.warn("[data] saveUserProfile: Supabase unavailable, localStorage only.", err);
  }
}

export async function updateProfileAddress(address: string): Promise<void> {
  try {
    const stored = localStorage.getItem(USER_PROFILE_KEY);
    if (stored) {
      const profile = JSON.parse(stored) as UserProfile;
      profile.address = address;
      localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
    }
  } catch {}

  const userId = await getCurrentUserId();
  if (!userId) return;

  try {
    const { error } = await supabase.from("user_profile").update({ address }).eq("user_id", userId);
    if (error) throw error;
  } catch (err) {
    console.warn("[data] updateProfileAddress: Supabase unavailable, localStorage only.", err);
  }
}

export async function loadUserProfile(): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from("user_profile")
      .select("skill_level, location, address, onboarding_completed, display_name, avatar_path, account_type")
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const profile: UserProfile = {
      skillLevel: data.skill_level,
      location: data.location,
      address: data.address ?? undefined,
      onboardingCompleted: data.onboarding_completed,
      displayName: data.display_name ?? undefined,
      avatarPath: data.avatar_path ?? undefined,
      accountType: data.account_type ?? "owner",
    };
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
    return profile;
  } catch {
    const stored = localStorage.getItem(USER_PROFILE_KEY);
    return stored ? (JSON.parse(stored) as UserProfile) : null;
  }
}

// Narrow update for fields outside the onboarding/settings upsert flow — avoids
// the whole-row upsert's clobber risk (see saveUserProfile's address handling).
export async function updateProfileFields(partial: {
  displayName?: string;
  avatarPath?: string;
  skillLevel?: UserProfile["skillLevel"];
  location?: string;
  accountType?: UserProfile["accountType"];
}): Promise<void> {
  try {
    const stored = localStorage.getItem(USER_PROFILE_KEY);
    if (stored) {
      const profile = JSON.parse(stored) as UserProfile;
      if (partial.displayName !== undefined) profile.displayName = partial.displayName;
      if (partial.avatarPath !== undefined) profile.avatarPath = partial.avatarPath;
      if (partial.skillLevel !== undefined) profile.skillLevel = partial.skillLevel;
      if (partial.location !== undefined) profile.location = partial.location;
      if (partial.accountType !== undefined) profile.accountType = partial.accountType;
      localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
    }
  } catch {}

  const userId = await getCurrentUserId();
  if (!userId) return;

  const payload: Record<string, unknown> = {};
  if (partial.displayName !== undefined) payload.display_name = partial.displayName;
  if (partial.avatarPath !== undefined) payload.avatar_path = partial.avatarPath;
  if (partial.skillLevel !== undefined) payload.skill_level = partial.skillLevel;
  if (partial.location !== undefined) payload.location = partial.location;
  if (partial.accountType !== undefined) payload.account_type = partial.accountType;
  if (Object.keys(payload).length === 0) return;

  try {
    const { error } = await supabase.from("user_profile").update(payload).eq("user_id", userId);
    if (error) throw error;
  } catch (err) {
    console.warn("[data] updateProfileFields: Supabase unavailable, localStorage only.", err);
  }
}

// ── Completions ────────────────────────────────────────────────────────────

// D4: if the user recorded a hired contractor before this issue was marked
// complete, ContractorContactModal stashes it under this key (see
// issue/[issueIndex]/page.tsx's handleRecordHire) so it can be attached once
// the completion record actually exists.
function hiredStashKey(reportId: string, slug: string, issueIndex: number): string {
  return `homesteward_hired_${issueKey(reportId, slug, issueIndex)}`;
}

export async function saveCompletion(record: CompletionRecord): Promise<void> {
  let hiredContractor = record.hiredContractor;
  const stashKey = hiredStashKey(record.reportId, record.slug, record.issueIndex);
  if (!hiredContractor) {
    try {
      const stashed = localStorage.getItem(stashKey);
      if (stashed) hiredContractor = JSON.parse(stashed) as CompletionRecord["hiredContractor"];
    } catch {}
  }
  const finalRecord: CompletionRecord = hiredContractor ? { ...record, hiredContractor } : record;

  const existing: Record<string, CompletionRecord> = JSON.parse(
    localStorage.getItem(COMPLETIONS_KEY) ?? "{}"
  );
  existing[issueKey(finalRecord.reportId, finalRecord.slug, finalRecord.issueIndex)] = finalRecord;
  localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(existing));
  localStorage.removeItem(stashKey);

  const userId = await getCurrentUserId();
  try {
    const { error } = await supabase.from("completed_fixes").upsert(
      {
        report_id: finalRecord.reportId,
        section_slug: finalRecord.slug,
        issue_index: finalRecord.issueIndex,
        fixed_by: finalRecord.completedBy,
        difficulty_rating: finalRecord.difficulty ?? null,
        completed_at: finalRecord.completedAt,
        actual_cost: finalRecord.actualCost ?? null,
        hired_contractor: finalRecord.hiredContractor ?? null,
        user_id: userId,
      },
      { onConflict: "report_id,section_slug,issue_index" }
    );

    if (error) throw error;
  } catch (err) {
    console.warn("[data] saveCompletion: Supabase unavailable, localStorage only.", err);
  }
}

// D4: updates just the hired-contractor field on an already-completed fix
// (used when the user records a hire after marking the issue done).
export async function updateCompletionContractor(
  reportId: string,
  slug: string,
  issueIndex: number,
  contractor: CompletionRecord["hiredContractor"]
): Promise<void> {
  try {
    const existing: Record<string, CompletionRecord> = JSON.parse(
      localStorage.getItem(COMPLETIONS_KEY) ?? "{}"
    );
    const key = issueKey(reportId, slug, issueIndex);
    if (existing[key]) {
      existing[key] = { ...existing[key], hiredContractor: contractor };
      localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(existing));
    }
  } catch {}

  try {
    const { error } = await supabase
      .from("completed_fixes")
      .update({ hired_contractor: contractor ?? null })
      .eq("report_id", reportId)
      .eq("section_slug", slug)
      .eq("issue_index", issueIndex);
    if (error) throw error;
  } catch (err) {
    console.warn("[data] updateCompletionContractor: Supabase unavailable, localStorage only.", err);
  }
}

export async function removeCompletion(reportId: string, slug: string, issueIndex: number): Promise<void> {
  const existing: Record<string, CompletionRecord> = JSON.parse(
    localStorage.getItem(COMPLETIONS_KEY) ?? "{}"
  );
  delete existing[issueKey(reportId, slug, issueIndex)];
  localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(existing));

  try {
    const { error } = await supabase
      .from("completed_fixes")
      .delete()
      .eq("report_id", reportId)
      .eq("section_slug", slug)
      .eq("issue_index", issueIndex);
    if (error) throw error;
  } catch (err) {
    console.warn("[data] removeCompletion: Supabase unavailable, localStorage only.", err);
  }
}

// All-time "fixed by me" completions across every report the user has ever
// uploaded (no report_id filter — RLS already scopes to the user), so earned
// skill survives re-uploads and report deletions.
export async function loadAllMyCompletions(): Promise<CompletionRecord[]> {
  try {
    const { data, error } = await supabase
      .from("completed_fixes")
      .select("report_id, section_slug, issue_index, fixed_by, difficulty_rating, completed_at")
      .eq("fixed_by", "me");
    if (error) throw error;

    return (data ?? []).map((row) => ({
      slug: row.section_slug,
      issueIndex: row.issue_index,
      reportId: row.report_id,
      completedBy: "me" as const,
      difficulty: row.difficulty_rating ?? undefined,
      completedAt: row.completed_at,
    }));
  } catch (err) {
    console.warn("[data] loadAllMyCompletions: Supabase unavailable.", err);
    return [];
  }
}

// ── Ignored issues ─────────────────────────────────────────────────────────

export async function saveIgnore(reportId: string, slug: string, issueIndex: number): Promise<void> {
  const existing: Record<string, true> = JSON.parse(localStorage.getItem(IGNORED_KEY) ?? "{}");
  existing[issueKey(reportId, slug, issueIndex)] = true;
  localStorage.setItem(IGNORED_KEY, JSON.stringify(existing));

  const userId = await getCurrentUserId();
  try {
    const { error } = await supabase.from("ignored_issues").upsert(
      { report_id: reportId, section_slug: slug, issue_index: issueIndex, user_id: userId },
      { onConflict: "report_id,section_slug,issue_index" }
    );
    if (error) throw error;
  } catch (err) {
    console.warn("[data] saveIgnore: Supabase unavailable, localStorage only.", err);
  }
}

export async function removeIgnore(reportId: string, slug: string, issueIndex: number): Promise<void> {
  const existing: Record<string, true> = JSON.parse(localStorage.getItem(IGNORED_KEY) ?? "{}");
  delete existing[issueKey(reportId, slug, issueIndex)];
  localStorage.setItem(IGNORED_KEY, JSON.stringify(existing));

  try {
    const { error } = await supabase
      .from("ignored_issues")
      .delete()
      .eq("report_id", reportId)
      .eq("section_slug", slug)
      .eq("issue_index", issueIndex);
    if (error) throw error;
  } catch (err) {
    console.warn("[data] removeIgnore: Supabase unavailable, localStorage only.", err);
  }
}

export async function loadIgnored(): Promise<Record<string, true>> {
  try {
    const { data, error } = await supabase
      .from("ignored_issues")
      .select("report_id, section_slug, issue_index");
    if (error) throw error;

    const result: Record<string, true> = {};
    for (const row of data ?? []) {
      result[issueKey(row.report_id, row.section_slug, row.issue_index)] = true;
    }
    localStorage.setItem(IGNORED_KEY, JSON.stringify(result));
    return result;
  } catch (err) {
    console.warn("[data] loadIgnored: Supabase unavailable, falling back.", err);
  }

  try {
    const stored = localStorage.getItem(IGNORED_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export async function loadCompletions(): Promise<Record<string, CompletionRecord>> {
  try {
    const { data, error } = await supabase.from("completed_fixes").select("*");
    if (error) throw error;

    const result: Record<string, CompletionRecord> = {};
    for (const row of data ?? []) {
      const record: CompletionRecord = {
        slug: row.section_slug,
        issueIndex: row.issue_index,
        reportId: row.report_id,
        completedBy: row.fixed_by as "me" | "professional",
        difficulty: row.difficulty_rating ?? undefined,
        completedAt: row.completed_at,
        actualCost: row.actual_cost ?? undefined,
        hiredContractor: row.hired_contractor ?? undefined,
      };
      result[issueKey(record.reportId, record.slug, record.issueIndex)] = record;
    }

    localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(result));
    return result;
  } catch (err) {
    console.warn("[data] loadCompletions: Supabase unavailable, falling back.", err);
  }

  try {
    const stored = localStorage.getItem(COMPLETIONS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}
