import { supabase } from "./supabase-client";

export interface ToolboxItem {
  id: string;
  toolName: string;
  source: "manual" | "suggested";
}

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

export async function loadToolbox(): Promise<ToolboxItem[]> {
  try {
    const { data, error } = await supabase
      .from("user_toolbox")
      .select("id, tool_name, source")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      toolName: row.tool_name,
      source: row.source as "manual" | "suggested",
    }));
  } catch (err) {
    console.warn("[toolbox] loadToolbox failed", err);
    return [];
  }
}

export async function addTools(
  names: string[],
  source: "manual" | "suggested",
  fromIssue?: string
): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId || !names.length) return;

  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  if (!cleaned.length) return;

  // The uniqueness index is on lower(tool_name), which upsert's onConflict
  // (plain column list) can't target — dedupe client-side and plain-insert.
  const existing = await loadToolbox();
  const existingLower = new Set(existing.map((t) => t.toolName.toLowerCase()));
  const seen = new Set<string>();
  const rows = cleaned
    .filter((name) => {
      const key = name.toLowerCase();
      if (existingLower.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((tool_name) => ({ user_id: userId, tool_name, source, from_issue: fromIssue ?? null }));
  if (!rows.length) return;

  try {
    const { error } = await supabase.from("user_toolbox").insert(rows);
    if (error) throw error;
  } catch (err) {
    console.warn("[toolbox] addTools failed", err);
  }
}

export async function removeTool(id: string): Promise<void> {
  try {
    const { error } = await supabase.from("user_toolbox").delete().eq("id", id);
    if (error) throw error;
  } catch (err) {
    console.warn("[toolbox] removeTool failed", err);
  }
}

const TOOL_KEYWORDS =
  /\b(drill|saw|wrench|screwdriver|hammer|ladder|level|pliers|caulk gun|multimeter|snake|tape measure|stud finder|shop vac|utility knife|trowel|clamp|sander|pry ?bar|crowbar)\b/i;

export function isToolHeuristic(item: string): boolean {
  return TOOL_KEYWORDS.test(item);
}
