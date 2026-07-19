import { supabase } from "./supabase-client";
import { uploadReportPdf, removePaths } from "./storage";
import {
  REPORT_KEY,
  COMPLETIONS_KEY,
  IGNORED_KEY,
  USER_PROFILE_KEY,
  type ParsedReport,
  type CompletionRecord,
  type UserProfile,
  type IssueDetails,
} from "./sections";

const REPORT_ID_KEY = "homesteward_report_id";

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

export function getCurrentReportId(): string | null {
  return localStorage.getItem(REPORT_ID_KEY);
}

// Stale per-issue caches are keyed only by slug/index, not report_id, so after
// a re-upload they'd otherwise silently surface the previous report's DIY
// plans, chat history, or contractor results for the same slug/index pair.
function purgeStaleIssueCaches(): void {
  const prefixes = ["homesteward_issue_details_", "homesteward_diy_", "homesteward_contractors_"];
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && prefixes.some((p) => key.startsWith(p))) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

// ── Reports ────────────────────────────────────────────────────────────────

export async function saveReport(
  report: ParsedReport,
  filename: string,
  pdfFile?: File
): Promise<void> {
  localStorage.setItem(REPORT_KEY, JSON.stringify(report));
  purgeStaleIssueCaches();

  const userId = await getCurrentUserId();
  console.log("[data] saveReport: attempting Supabase insert", { filename, sectionCount: report.sections.length });
  try {
    const { data, error } = await supabase
      .from("reports")
      .insert({ raw_sections: report.sections, pdf_filename: filename, user_id: userId })
      .select("id")
      .single();

    if (error) {
      console.error("[data] saveReport: Supabase error", error);
      throw error;
    }
    console.log("[data] saveReport: success", data);
    localStorage.setItem(REPORT_ID_KEY, data.id);

    if (userId) {
      const updates: Record<string, unknown> = {};
      if (pdfFile) {
        const path = await uploadReportPdf(userId, data.id, pdfFile);
        if (path) updates.pdf_storage_path = path;
      }
      const profile = await loadUserProfile();
      updates.location_used = profile?.location ?? null;
      if (Object.keys(updates).length) {
        const { error: updateError } = await supabase.from("reports").update(updates).eq("id", data.id);
        if (updateError) console.warn("[data] saveReport: post-insert update failed", updateError);
      }
    }
  } catch (err) {
    console.warn("[data] saveReport: Supabase unavailable, localStorage only.", err);
  }
}

export async function loadLatestReport(): Promise<ParsedReport | null> {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("id, raw_sections, pdf_storage_path, pdf_filename, location_used")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const report: ParsedReport = {
      sections: data.raw_sections,
      pdfStoragePath: data.pdf_storage_path ?? undefined,
      pdfFilename: data.pdf_filename ?? undefined,
      locationUsed: data.location_used ?? undefined,
    };
    localStorage.setItem(REPORT_KEY, JSON.stringify(report));
    localStorage.setItem(REPORT_ID_KEY, data.id);
    return report;
  } catch {
    const stored = localStorage.getItem(REPORT_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as ParsedReport;
    } catch {
      return null;
    }
  }
}

// ── Issue details (lazy-loaded DIY plan + expert guide) ────────────────────

function issueDetailsKey(slug: string, index: number) {
  return `homesteward_issue_details_${slug}_${index}`;
}

export async function loadIssueDetails(
  slug: string,
  issueIndex: number
): Promise<IssueDetails | null> {
  const reportId = localStorage.getItem(REPORT_ID_KEY);

  if (reportId) {
    try {
      const { data, error } = await supabase
        .from("issue_details")
        .select("materials_list, step_by_step_plan, contractor_briefing, user_observation, photo_paths")
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
        };
        console.log("[data] loadIssueDetails: loaded from Supabase", { slug, issueIndex, hasDiyPlan: !!details.stepByStepPlan?.length });
        localStorage.setItem(issueDetailsKey(slug, issueIndex), JSON.stringify(details));
        return details;
      }
      console.log("[data] loadIssueDetails: no Supabase row for this issue yet", { slug, issueIndex, reportId });
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
  }

  try {
    const stored = localStorage.getItem(issueDetailsKey(slug, issueIndex));
    return stored ? (JSON.parse(stored) as IssueDetails) : null;
  } catch {
    return null;
  }
}

export async function saveIssueDetails(
  slug: string,
  issueIndex: number,
  details: IssueDetails
): Promise<void> {
  localStorage.setItem(issueDetailsKey(slug, issueIndex), JSON.stringify(details));

  const reportId = localStorage.getItem(REPORT_ID_KEY);
  if (!reportId) {
    console.warn(
      "[data] saveIssueDetails: no report_id in localStorage — the original report insert likely never reached Supabase, so this DIY plan will only be saved locally.",
      { slug, issueIndex }
    );
    return;
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    console.warn(
      "[data] saveIssueDetails: no authenticated user_id — RLS will reject this write, saving locally only.",
      { slug, issueIndex, reportId }
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
    updated_at: new Date().toISOString(),
    user_id: userId,
  };
  console.log("[data] saveIssueDetails: upserting to Supabase", payload);

  try {
    const { data, error } = await supabase
      .from("issue_details")
      .upsert(payload, { onConflict: "report_id,section_slug,issue_index" })
      .select("id, updated_at");

    if (error) throw error;
    console.log("[data] saveIssueDetails: Supabase upsert succeeded", data);
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
      .select("skill_level, location, address, onboarding_completed, display_name, avatar_path")
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
}): Promise<void> {
  try {
    const stored = localStorage.getItem(USER_PROFILE_KEY);
    if (stored) {
      const profile = JSON.parse(stored) as UserProfile;
      if (partial.displayName !== undefined) profile.displayName = partial.displayName;
      if (partial.avatarPath !== undefined) profile.avatarPath = partial.avatarPath;
      if (partial.skillLevel !== undefined) profile.skillLevel = partial.skillLevel;
      if (partial.location !== undefined) profile.location = partial.location;
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
  if (Object.keys(payload).length === 0) return;

  try {
    const { error } = await supabase.from("user_profile").update(payload).eq("user_id", userId);
    if (error) throw error;
  } catch (err) {
    console.warn("[data] updateProfileFields: Supabase unavailable, localStorage only.", err);
  }
}

export async function updateReport(report: ParsedReport): Promise<void> {
  localStorage.setItem(REPORT_KEY, JSON.stringify(report));
  const reportId = localStorage.getItem(REPORT_ID_KEY);
  if (!reportId) return;
  try {
    const { error } = await supabase
      .from("reports")
      .update({ raw_sections: report.sections })
      .eq("id", reportId);
    if (error) throw error;
  } catch (err) {
    console.warn("[data] updateReport: Supabase unavailable, localStorage only.", err);
  }
}

export async function markReportLocationUsed(location: string): Promise<void> {
  const reportId = localStorage.getItem(REPORT_ID_KEY);
  if (!reportId) return;
  try {
    const { error } = await supabase.from("reports").update({ location_used: location }).eq("id", reportId);
    if (error) throw error;
  } catch (err) {
    console.warn("[data] markReportLocationUsed: Supabase unavailable.", err);
  }
}

export async function clearLocalReport(): Promise<void> {
  const reportId = localStorage.getItem(REPORT_ID_KEY);

  localStorage.removeItem(REPORT_KEY);
  localStorage.removeItem(REPORT_ID_KEY);
  localStorage.removeItem(COMPLETIONS_KEY);
  localStorage.removeItem(IGNORED_KEY);
  purgeStaleIssueCaches();

  if (!reportId) return;

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
    console.warn("[data] clearLocalReport: failed to collect storage paths.", err);
  }

  try {
    // Delete child rows first (FK constraint), then the report row
    await supabase.from("completed_fixes").delete().eq("report_id", reportId);
    await supabase.from("ignored_issues").delete().eq("report_id", reportId);
    await supabase.from("issue_details").delete().eq("report_id", reportId);
    await supabase.from("reports").delete().eq("id", reportId);
  } catch (err) {
    console.warn("[data] clearLocalReport: Supabase delete failed.", err);
  }

  try {
    await removePaths(pathsToRemove);
  } catch (err) {
    console.warn("[data] clearLocalReport: storage cleanup failed.", err);
  }
}

// ── Completions ────────────────────────────────────────────────────────────

export async function saveCompletion(record: CompletionRecord): Promise<void> {
  const existing: Record<string, CompletionRecord> = JSON.parse(
    localStorage.getItem(COMPLETIONS_KEY) ?? "{}"
  );
  existing[`${record.slug}-${record.issueIndex}`] = record;
  localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(existing));

  const reportId = localStorage.getItem(REPORT_ID_KEY);
  if (!reportId) return;

  const userId = await getCurrentUserId();
  try {
    const { error } = await supabase.from("completed_fixes").upsert(
      {
        report_id: reportId,
        section_slug: record.slug,
        issue_index: record.issueIndex,
        fixed_by: record.completedBy,
        difficulty_rating: record.difficulty ?? null,
        completed_at: record.completedAt,
        user_id: userId,
      },
      { onConflict: "report_id,section_slug,issue_index" }
    );

    if (error) throw error;
  } catch (err) {
    console.warn("[data] saveCompletion: Supabase unavailable, localStorage only.", err);
  }
}

// All-time "fixed by me" completions across every report the user has ever
// uploaded (no report_id filter — RLS already scopes to the user), so earned
// skill survives re-uploads and clearLocalReport.
export async function loadAllMyCompletions(): Promise<CompletionRecord[]> {
  try {
    const { data, error } = await supabase
      .from("completed_fixes")
      .select("section_slug, issue_index, fixed_by, difficulty_rating, completed_at")
      .eq("fixed_by", "me");
    if (error) throw error;

    return (data ?? []).map((row) => ({
      slug: row.section_slug,
      issueIndex: row.issue_index,
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

export async function saveIgnore(slug: string, issueIndex: number): Promise<void> {
  const existing: Record<string, true> = JSON.parse(localStorage.getItem(IGNORED_KEY) ?? "{}");
  existing[`${slug}-${issueIndex}`] = true;
  localStorage.setItem(IGNORED_KEY, JSON.stringify(existing));

  const reportId = localStorage.getItem(REPORT_ID_KEY);
  if (!reportId) return;

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

export async function removeIgnore(slug: string, issueIndex: number): Promise<void> {
  const existing: Record<string, true> = JSON.parse(localStorage.getItem(IGNORED_KEY) ?? "{}");
  delete existing[`${slug}-${issueIndex}`];
  localStorage.setItem(IGNORED_KEY, JSON.stringify(existing));

  const reportId = localStorage.getItem(REPORT_ID_KEY);
  if (!reportId) return;

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
  const reportId = localStorage.getItem(REPORT_ID_KEY);

  if (reportId) {
    try {
      const { data, error } = await supabase
        .from("ignored_issues")
        .select("section_slug, issue_index")
        .eq("report_id", reportId);
      if (error) throw error;

      const result: Record<string, true> = {};
      for (const row of data) {
        result[`${row.section_slug}-${row.issue_index}`] = true;
      }
      localStorage.setItem(IGNORED_KEY, JSON.stringify(result));
      return result;
    } catch (err) {
      console.warn("[data] loadIgnored: Supabase unavailable, falling back.", err);
    }
  }

  try {
    const stored = localStorage.getItem(IGNORED_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export async function loadCompletions(): Promise<
  Record<string, CompletionRecord>
> {
  const reportId = localStorage.getItem(REPORT_ID_KEY);

  if (reportId) {
    try {
      const { data, error } = await supabase
        .from("completed_fixes")
        .select("*")
        .eq("report_id", reportId);

      if (error) throw error;

      const result: Record<string, CompletionRecord> = {};
      for (const row of data) {
        result[`${row.section_slug}-${row.issue_index}`] = {
          slug: row.section_slug,
          issueIndex: row.issue_index,
          completedBy: row.fixed_by as "me" | "professional",
          difficulty: row.difficulty_rating ?? undefined,
          completedAt: row.completed_at,
        };
      }

      localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(result));
      return result;
    } catch (err) {
      console.warn("[data] loadCompletions: Supabase unavailable, falling back.", err);
    }
  }

  try {
    const stored = localStorage.getItem(COMPLETIONS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}
