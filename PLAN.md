# Porchlight — Master Implementation Plan

This plan was produced after reading the entire codebase. It is ordered for execution: **migrations → shared UI foundations → multi-report data layer → everything else**. Follow phases in order; items within a phase are independent unless noted.

---

## 0. Ground rules (read first)

**Corrections to the feature spec — the spec's file map is stale. Trust this list:**

| Spec says | Reality |
|---|---|
| `app/calendar/page.tsx` | Calendar lives at `app/maintenance/page.tsx` + `app/maintenance/components/{MonthGrid,DayDetailSheet,SuggestionPicker,TaskManageList}.tsx` |
| Migrations 001–013 exist | **Migrations 001–014 exist.** New migrations start at **015** |
| `issue_details.photo_urls` | Column is `photo_paths` (jsonb array of Supabase Storage paths, signed on read via `lib/storage.ts signPaths`) |
| — | There is also `app/api/refine-observation/route.ts` (used by C4) and `app/report/page.tsx` (the upload/replace page, reworked by B1) |
| `user_maintenance_tasks.last_completed/next_due` | Actual schema: `recurrence_months`, `anchor_date`, `active`, `notify`; completions live in `maintenance_logs`. Due dates are computed in `lib/maintenance.ts` (`nextDueDate`, `computeMarkers`) |

**Next.js 16 conventions (verified against `node_modules/next/dist/docs`):**
- `params` and `searchParams` are **Promises**. All pages are client components; unwrap with `use()` exactly as `app/add-issue/page.tsx` does today (`const { section } = use(searchParams)`). Do not use `useSearchParams()` in new code — pass searchParams as a page prop.
- Route handlers (`app/api/*/route.ts`) are unchanged from what's in the repo. Streaming responses use standard `new Response(readableStream)`.
- Do not introduce server components, `use cache`, or `unstable_instant` — this app is fully client-rendered behind `AuthGuard`, and that stays.

**Patterns to preserve:**
- All AI calls use model **`claude-sonnet-4-6`** via `@anthropic-ai/sdk` (project standard — do not change the model).
- Dual-write: every user-data write goes to localStorage first, then Supabase, with Supabase failures logged via `console.warn` and swallowed (see every function in `lib/data.ts`). Every new data function must follow this.
- `normalize()` in `lib/sections.ts` for all section name↔slug matching.
- AI JSON responses are extracted with `text.match(/\{[\s\S]*\}/)` then `JSON.parse` — keep this in modified routes.
- Touch handling uses refs, not state (`BottomSheet.tsx`, `diy/page.tsx`) — do not refactor.
- Styling: Tailwind with `porch-*` tokens from `app/globals.css`; cards are `rounded-2xl border border-porch-border bg-porch-surface`; primary buttons `bg-porch-accent text-white rounded-[10px] btn-press`.

**Accessibility rules applied to every file you touch (GROUP N — woven in, not a separate pass):**
1. Never write `focus:outline-none` without a visible replacement. Use `focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-2` (and remove existing `focus:outline-none` in any file you edit, replacing with `focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1`).
2. Any new interactive text element gets `min-height 44px` effective tap target (padding counts) — see M3.
3. New modals go through the shared `Modal` component (upgraded in Phase 1 with dialog semantics).
4. Color is never the only signal — pair dots/badges with text or shape.

---

## Phase 0 — All SQL migrations (run before any code ships)

Create these five files in `supabase/migrations/`. They are additive and safe to run against production before the UI changes deploy.

### `015_multi_report.sql`
```sql
-- B1/B2: multi-report support. reports already allows multiple rows per user;
-- these columns let the UI label each report's issues and surface parser notes.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS document_type text;  -- e.g. 'Home Inspection', 'Contractor Assessment'
ALTER TABLE reports ADD COLUMN IF NOT EXISTS parser_note text;    -- best-effort-parse note shown to the user
```

### `016_completed_fixes_extras.sql`
```sql
-- H1: actual amount paid; D4: contractor the user recorded hiring
ALTER TABLE completed_fixes ADD COLUMN IF NOT EXISTS actual_cost numeric(10,2);
ALTER TABLE completed_fixes ADD COLUMN IF NOT EXISTS hired_contractor jsonb;  -- { "name": text, "phone"?: text, "website"?: text, "mapsUrl"?: text }
```

### `017_issue_details_extras.sql`
```sql
-- E7: persist elaborated step detail, keyed by 0-based step index as a string
ALTER TABLE issue_details ADD COLUMN IF NOT EXISTS step_elaborations jsonb;  -- { "0": "…", "3": "…" }
-- C6: safety framing returned by generate-diy for electrical/gas/structural repairs
ALTER TABLE issue_details ADD COLUMN IF NOT EXISTS safety_warning text;
```

### `018_documents_vault.sql`
```sql
-- K1: document & warranty vault
CREATE TABLE IF NOT EXISTS documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('manual','warranty','invoice','permit','paint','other')),
  section_slug text,                                   -- optional link to a home section
  report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
  issue_key text,                                      -- optional "reportId:slug:index"
  storage_path text NOT NULL,
  file_name text,
  mime_type text
);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_documents" ON documents
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage: allow the new 'documents/' prefix. Recreates the insert policy from 011.
-- NOTE: if this fails with "must be owner of table objects", recreate the policy via
-- Dashboard > Storage > Policies with the same expression (same caveat as migration 011).
DROP POLICY IF EXISTS "homesteward_owner_insert" ON storage.objects;
CREATE POLICY "homesteward_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'homesteward'
    AND (storage.foldername(name))[1] = ANY (ARRAY['reports','photos','avatars','documents'])
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
```

### `019_account_type.sql`
```sql
-- L1: owner / renter / pre-purchase account types
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'owner'
  CHECK (account_type IN ('owner','renter','prebuy'));
```

**Deploy/config callouts (do these alongside Phase 0):**
- No new Vercel environment variables. Existing: `ANTHROPIC_API_KEY`, `GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Add `export const maxDuration = 120;` to `app/api/parse-report/route.ts` (parsing can exceed 60s on large PDFs) and `export const maxDuration = 60;` to `generate-diy`, `generate-expert`, and `generate-credit-request` (new). If the Vercel plan caps lower, use the plan max.
- Google Places (D1) needs one field-mask addition (`places.websiteUri`) — code change only, no console change.

---

## Phase 1 — Shared UI foundations

Everything later builds on these; do them first so new UI is born compliant.

### 1.1 `app/components/Modal.tsx` — dialog semantics + M2 (modify)
Replace the component body:
- Root overlay keeps `onClick={onClose}` (tap-outside dismiss already works **when onClose is passed** — M2's real fix is passing `onClose` to the two regen modals, see Phase 4).
- Inner div: add `role="dialog"`, `aria-modal="true"`.
- Add `useEffect` that (a) listens for `Escape` → `onClose?.()`, (b) on mount focuses the dialog container (`tabIndex={-1}` + `ref.focus()`), (c) traps focus: on `keydown` Tab, if focus would leave the dialog, wrap to first/last focusable element (query `'a[href], button:not([disabled]), textarea, input, select'` inside the ref). Component becomes `"use client"` (it currently has no directive; every consumer is already a client component, so this is safe).
- Respect existing props (`maxWidth`, `maxHeight`) unchanged.

### 1.2 `app/globals.css` — focus ring, reduced motion, contrast tokens (modify)
- Add under `@layer base`:
  ```css
  :focus-visible { outline: 2px solid #7D234A; outline-offset: 2px; border-radius: 4px; }
  ```
  (This makes keyboard focus visible app-wide even where `focus:outline-none` was used for mouse; keep per-element Tailwind rings for elements that set `outline: none` explicitly — as you touch files, apply rule 1 from §0.)
- Add reduced-motion handling:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .comet-ring { animation: none; opacity: 0; }
    .btn-press, .btn-press:active { transition: none; transform: none; }
    * { scroll-behavior: auto !important; }
  }
  ```
  Also in `diy/page.tsx` Work Mode: when `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, set the card `transition` to `"none"` instead of the cubic-bezier (small conditional where `liveTranslate` transition is set), and skip the `animate-spin` spinner in favor of static "…" text in `AuthGuard`/skeletons is NOT required — spinners are allowed but must not be the only loading indicator; leave them.
- Contrast (N): darken the two failing tokens so small text passes WCAG AA (≥4.5:1 on both `#FFFFFF` and `#FAF7F2`):
  ```css
  --color-porch-text-tertiary: #7E7365;  /* was #A99C8B (~2.6:1) */
  --color-porch-text-faint: #8A7E70;     /* was #B8AC9D (~2.2:1) */
  ```
  After changing, sanity-check with a one-off contrast computation (relative-luminance formula) that both are ≥4.5:1 against `#FFFFFF`; adjust darker if not. `porch-text-secondary` (#857A6D, ~4.6:1) stays.

### 1.3 `app/components/Skeleton.tsx` — M4 (new)
```tsx
// Props: className?: string. Renders <div className={`animate-pulse rounded-xl bg-[#EFE9E0] ${className}`} />
```
Plus a `PageSkeleton` export: header bar strip + 4 card-shaped skeleton rows inside the standard `max-w-[430px]` shell. Used by: dashboard, section page, issue page, completed page, maintenance page — replace every `if (!loaded) return null` / `{!loaded ? null : …}` with the skeleton (dashboard: replace `if (!profileChecked) return null`). `add-issue`'s `if (!loaded) return null` too.

### 1.4 `app/components/useProgressiveStatus.ts` — M5 (new hook)
```ts
// useProgressiveStatus(active: boolean, stages: Array<[label: string, atMs: number]>): string | null
// While active, returns the label whose atMs threshold has passed (client-side timer, 500ms tick).
// Returns null when !active. Resets on active-flip.
```
Consumers and stage lists:
- `app/report/page.tsx` upload button: `[["Uploading your report…",0],["Reading your report…",4000],["Organizing your issues…",15000],["Almost done…",30000]]`
- Issue page `Generate DIY Plan` button: `[["Generating…",0],["Sizing steps to your skill level…",4000],["Pricing materials…",9000]]`
- Issue page `Get Expert Guide` button: `[["Generating…",0],["Writing your contractor briefing…",4000],["Finding local pros…",9000]]`
The button label renders the hook output instead of the static "Uploading…"/"Generating…".

### 1.5 `app/components/EstimateDisclaimer.tsx` — M1 (new)
```tsx
// <p className="mt-1 text-[11px] leading-snug text-porch-text-tertiary">
//   Estimate — actual costs vary by location, contractor, and conditions.</p>
```
Render it: under the DIY and Pro price headings on the issue page (once, below the two cards or inside each), in the dashboard summary modal next to the new cost totals (A2), on the completed-fix rows' cost line (once per page header area is fine — place under the "Est. Savings" tile), and in the savings modal.

### 1.6 M6 — snappy comet + shorter delay (modify)
- `app/page.tsx` `navigateToSection`: `setTimeout(...,600)` → `150`.
- `app/section/[slug]/page.tsx` `navigateToIssue`: `300` → `150`.
- The comet already renders synchronously on tap (state set before timeout) — no other change. With reduced motion (1.2) the ring is hidden and navigation still fires at 150ms.

### 1.7 M3 — tap targets (modify as you touch, plus these specific fixes now)
Convert these text links to padded buttons (`className="btn-press rounded-[8px] px-3 py-2.5 text-[12.5px] font-semibold …"`, min 44px tall including padding):
- `app/section/[slug]/page.tsx`: "Not now" / "Restore", "Delete" / "Cancel" confirm pair, header pencil/trash icon buttons get `p-2.5` instead of `p-0.5`.
- `app/section/[slug]/issue/[issueIndex]/page.tsx`: observation "Edit", "I understand, show me anyway", "Cancel" in observation editor.
- `app/section/[slug]/issue/[issueIndex]/diy/page.tsx`: "Refine This Plan", "Give me more detail", pending-image "Remove".
- `app/page.tsx`: "Clear report" link in summary modal (will be reworked in Phase 2 anyway), "Completed Fixes" header link gets `py-2.5 px-2`.

### 1.8 `app/components/MicButton.tsx` — N (modify)
Replace `if (!supported) return null` with: render the same button visually muted (`opacity-60`), `aria-disabled`, and on click toggle a small absolute-positioned tooltip bubble (state-driven, auto-hides after 3s): *"Voice input isn't available in this browser. Try Chrome, or just type."* Keep `title` attr for desktop hover. Do not call SpeechRecognition when unsupported.

---

## Phase 2 — Multi-report foundation (B1, B2)

**This is the highest-risk change. Land it as one PR, test thoroughly before building A/C/E on top.** Everything downstream keys off `(reportId, slug, issueIndex)`.

### 2.1 Types — `lib/sections.ts` (modify)
Add:
```ts
export interface StoredReport {
  id: string;
  sections: ReportSection[];
  pdfFilename?: string | null;
  pdfStoragePath?: string | null;
  locationUsed?: string | null;
  propertyAddress?: string | null;
  documentType?: string | null;
  parserNote?: string | null;
  createdAt: string;
}
export interface MergedIssueRef { issue: Issue; reportId: string; issueIndex: number; }
export interface MergedSection {
  slug: string; name: string; description?: string; issues: MergedIssueRef[];
}
export function issueKey(reportId: string, slug: string, index: number): string {
  return `${reportId}:${slug}:${index}`;
}
```
Change `CompletionRecord` to include `reportId: string`, plus (for later phases) `actualCost?: number` and `hiredContractor?: { name: string; phone?: string; website?: string; mapsUrl?: string }`.

Change key helpers to take a reportId:
```ts
export function diyKey(reportId: string, slug: string, index: number, type: "materials"|"steps"|"chat")
export function contractorsKey(reportId: string, slug: string, index: number)
```
Add `mergeReports(reports: StoredReport[]): MergedSection[]`:
- Iterate reports oldest→newest. For each section, resolve its slug: explicit `section.slug`, else the standard `sections` config whose `normalize(label) === normalize(section.name)`, else slugify the name (same slugify as `handleAddSection` in `app/page.tsx`).
- Group by slug. First report to contribute a slug sets `name`/`description` (standard-config label/description win for standard slugs). Push `{ issue, reportId, issueIndex }` for every non-deleted **and deleted** issue? No — include all issues with their original indexes; consumers filter `issue.deleted` exactly as today. **Indexes must be the index within that report's section array**, never the merged position.

Add `IssueDetails` fields: `stepElaborations?: Record<string, string>; safetyWarning?: string | null;`

### 2.2 Data layer — `lib/data.ts` (major rework)
Replace the single-report model:

- **`loadReports(): Promise<StoredReport[]>`** — `select id, raw_sections, pdf_storage_path, pdf_filename, location_used, document_type, parser_note, created_at from reports order by created_at asc` (RLS scopes to user). Cache the whole array in localStorage under `homesteward_reports_v2`; on Supabase failure fall back to that cache. The **base report is `reports[0]`** (oldest).
- **`getBaseReportId(): string | null`** — from the v2 cache.
- **One-time legacy cleanup** inside `loadReports()`: if `homesteward_report` or `homesteward_report_id` keys exist, delete them and run the existing `purgeStaleIssueCaches()` (old cache keys lack reportId and would be misread). Keep `purgeStaleIssueCaches` but extend its prefixes to also match the new keys when a report is deleted (filter by `_${reportId}_` substring).
- **`saveReport(report, filename, pdfFile, extras?: { documentType?: string; parserNote?: string })`** — same insert flow as today plus the two new columns; after insert, append to the v2 cache. **Never deletes other reports.** Remove the unconditional `purgeStaleIssueCaches()` call (caches are now report-scoped).
- **`updateReportSections(reportId, sections)`** — replaces `updateReport`; updates `raw_sections` for that row and the v2 cache entry.
- **`deleteReport(reportId)`** — replaces `clearLocalReport`. Deletes only that report's `completed_fixes`, `ignored_issues`, `issue_details` rows, the report row, its PDF + issue photos in storage (same path-collection logic as today, scoped to reportId), and localStorage caches whose key contains that reportId. Also remove it from the v2 cache. **The old `clearLocalReport()` signature is gone — update all callers.**
- **Issue details:** `loadIssueDetails(reportId, slug, index)` / `saveIssueDetails(reportId, slug, index, details)` — same Supabase queries but `eq("report_id", reportId)` uses the parameter, not localStorage. localStorage key: `homesteward_issue_details_${reportId}_${slug}_${index}`. Map new columns `step_elaborations` ↔ `stepElaborations`, `safety_warning` ↔ `safetyWarning`.
- **`moveIssueDetails(reportId, fromSlug, fromIndex, toSlug, toIndex)`** (for C5): one function that updates the keys on `issue_details`, `completed_fixes`, `ignored_issues` rows (`update … set section_slug = toSlug, issue_index = toIndex where report_id = reportId and section_slug = fromSlug and issue_index = fromIndex`) and renames the corresponding localStorage cache keys (issue details, diy steps/chat, contractors). Photo storage paths embed the old slug/index in the path string — that's fine, they're opaque; do **not** move storage objects.
- **Completions:** `loadCompletions()` drops the report filter (`select … from completed_fixes` — RLS scopes to user), returns `Record<issueKey, CompletionRecord>` keyed `${report_id}:${slug}:${index}`, each record carrying `reportId`, `actualCost` (`actual_cost`), `hiredContractor` (`hired_contractor`). `saveCompletion(record)` upserts with `report_id: record.reportId` and the two new columns. Add **`removeCompletion(reportId, slug, index)`** (C1): delete row + remove from localStorage map. `loadAllMyCompletions()` gains `reportId` (add `report_id` to the select) so skill lookups resolve against the right report.
- **Ignored:** same treatment — keys become `issueKey(...)`, functions take `reportId`.
- `markReportLocationUsed(reportId, location)` takes the id explicitly.

### 2.3 URL scheme + page plumbing
Issue identity in URLs: keep `/section/[slug]/issue/[issueIndex]` and add query param **`r=<reportId>`**. When `r` is absent, fall back to the base report (backward compat with old links). Pages affected:
- `app/section/[slug]/page.tsx` — loads `loadReports()`, computes the merged section for `slug` via `mergeReports`, renders each `MergedIssueRef` and links to `/section/${slug}/issue/${ref.issueIndex}?r=${ref.reportId}`. Completion/ignore lookups use `issueKey(ref.reportId, slug, ref.issueIndex)`. Edits/renames/deletes write back via `updateReportSections(ref.reportId | targetReportId, …)` — rename applies to the report section that owns the slug in each report containing it (loop all reports that have the slug; simplest correct behavior). **Source badge:** when the user has >1 report, show a small chip on each issue row: `documentType ?? pdfFilename ?? "Report"`, truncated, `rounded-full bg-porch-bg border border-porch-border px-2 py-[3px] text-[11px] text-porch-text-tertiary`.
- `app/section/[slug]/issue/[issueIndex]/page.tsx` and `.../diy/page.tsx` — read `r` from `use(searchParams)`; resolve the issue from that report's section; pass `reportId` into every data call (`loadIssueDetails(reportId, slug, index)`, `saveCompletion({reportId,…})`, `contractorsKey(reportId,…)`, `diyKey(reportId,…)`, photo upload `uploadIssuePhoto(userId, reportId, …)` — already takes reportId, now pass the resolved one instead of `getCurrentReportId()`). Internal links between issue page ↔ diy page carry `?r=` through.
- `app/completed/page.tsx` — iterate completions (which carry reportId), resolve each against `loadReports()`, link with `?r=`.
- `app/add-issue/page.tsx` — user-added issues/sections always attach to the **base report**. If the user has zero reports, create one first: insert a report row with `raw_sections: []`, `pdf_filename: null`, `document_type: 'Manual entries'` (add a small `ensureBaseReport()` helper in `lib/data.ts` that returns the base report, creating the empty one if needed). Then push the issue and `updateReportSections(baseId, …)`.
- `app/page.tsx` (dashboard) — loads `loadReports()` + merged sections; `activeIssuesFor` counts across the merge using `issueKey`. Custom-section rows: list every merged slug that isn't one of the 10 standard slugs (this also surfaces parser-created custom sections from B2 — replaces the current `userAdded && slug` filter).
- `lib/skill.ts` — no change to the algorithm, but the `lookupIssue` callbacks in section/issue/profile pages change signature to `(reportId, slug, index)` resolving against the loaded reports array.

### 2.4 `app/report/page.tsx` — reports manager (rewrite)
Rename the page concept from "Inspection Report" to **"Home Reports"** (Settings tile: label "Home Reports", desc "Inspection reports and other assessments").
- List all reports (from `loadReports()`), newest last, each card showing: `documentType ?? "Report"`, `pdfFilename`, upload date, issue count, `parserNote` if present (in a soft amber note box), a "Base report" chip on `reports[0]`, Download PDF button (existing `getSignedUrl` flow), and a Delete button.
- Delete flows through a confirm `Modal`: *"Delete this report? Issues, fixes, and notes that came from it will be removed. Your other reports are untouched."* → `deleteReport(id)`. **The two-step "replace report" flow (confirmStep 1/2 modals) is deleted entirely.**
- One primary button: **"Add another report"** (or "Upload a report" when none) → same `performUpload` minus the `clearLocalReport()` call; pass parse response `documentType`/`parserNote` into `saveReport`. Keep `updateProfileAddress` + `mergeParsedPropertyDetails` post-parse hooks (property merge already never clobbers manual edits).
- Uses `useProgressiveStatus` (Phase 1.4) for the upload button.
- Dashboard "Clear report" link in the summary modal: remove it (report management now lives here). The `showClearConfirm` modal in `app/page.tsx` goes away.

### 2.5 `app/api/parse-report/route.ts` — B2 broadened parser (modify)
Keep the request/response plumbing, `maxDuration`, streaming `.finalMessage()`, and JSON extraction. Replace the **system prompt** with:

> You are an expert home-assessment document analyzer. You read any document about the condition of a home — inspection reports, contractor punch lists or estimates, improvement assessments, municipal or insurance inspection reports, appraisal condition notes, handwritten walk-through lists — and extract every issue, deficiency, recommended action, or planned improvement into structured data. Return only valid JSON with no surrounding text or markdown.

Replace the **user prompt text** (the long template literal) with:

```
Read this home assessment document and extract every issue, deficiency, repair item, safety concern, maintenance note, and recommended improvement you can find.

First, identify what kind of document this is (e.g. "Home Inspection Report", "Contractor Punch List", "Improvement Assessment", "Municipal Inspection", "Insurance Inspection", or your best short label).

Categorize each issue into one of these home sections when it fits (use these exact names):
- Exterior
- Roofing
- Structure
- Attic and Insulation
- Interior
- Heating and Air Conditioning
- Electrical
- Plumbing
- Bathrooms
- Appliances

If an issue doesn't fit any of those, create a custom section with a short descriptive name (e.g. "Pool & Spa", "Detached Garage", "Landscaping"). Prefer the standard sections; only create a custom section when nothing fits.

For each issue, assign a severity:
- "safety": Safety hazards requiring immediate attention
- "repair": Items needing repair or replacement
- "maintenance": Routine maintenance items
- "improvement": Recommended improvements or upgrades
- "fyi": Informational notes, no action required

Return a JSON object in this exact structure, with no other text:
{
  "documentType": "Home Inspection Report",
  "parserNote": null,
  "propertyAddress": "123 Main St, Anytown, CA 90210",
  "propertyDetails": { … same object as before, all fields nullable … },
  "sections": [
    {
      "name": "Section Name",
      "issues": [
        {
          "title": "Brief issue title",
          "description": "Original description from the document",
          "severity": "safety|repair|maintenance|improvement|fyi",
          "recommendedAction": "What should be done",
          "costEstimateDIY": "$50–$150",
          "costEstimatePro": "$200–$500",
          "minimumSkillLevel": "beginner|some_experience|experienced|expert",
          "equipmentSpecs": ["Tool or equipment name"]
        }
      ]
    }
  ]
}

For documentType: your short label for what this document is.

For parserNote: null when the document parsed cleanly. When the document is unusual, ambiguous, or doesn't map neatly to home sections, do a best-effort extraction anyway and set parserNote to one friendly sentence for the homeowner, e.g. "This looks like a contractor estimate — we've done our best to organize it. You can edit any section or issue that doesn't look right."

[keep the existing propertyAddress, propertyDetails, cost-estimate (with location interpolation), minimumSkillLevel, and equipmentSpecs instruction paragraphs verbatim from the current prompt]

Never return an empty result silently. If you can find even one actionable item, return it. Only if the document contains no home-condition information at all, return {"documentType": "<your label>", "parserNote": "We couldn't find home issues in this document — it looks like a <label>. Try uploading an inspection report or contractor assessment.", "sections": []}.
```

Client (`app/report/page.tsx`): if `sections` is empty, show `parserNote` as the error message instead of saving; otherwise save with extras. Sections whose name isn't a standard label get a slug assigned client-side before `saveReport` (slugify, dedupe against standard slugs + existing merged slugs).

**Verify Phase 2 end-to-end before continuing:** existing single-report account still renders identically; second report merges; deleting the second report leaves the first intact; old bookmarked issue URL (no `?r=`) opens the base report's issue.

---

## Phase 3 — Dashboard & navigation (GROUP A)

All in `app/page.tsx` unless noted. Depends on Phase 2's merged model.

**A1 + A7 — counts and All clear.** In each section row, under the name (replacing nothing — add a right-aligned element before the chevron): if `activeIssues.length > 0` show `<span className="text-[12.5px] font-semibold text-porch-text-secondary">{n} open</span>`; else `<span className="text-[12.5px] font-semibold text-porch-success">All clear ✓</span>`. Section page (`app/section/[slug]/page.tsx`): the counts line becomes "All clear ✓ — nothing to look at here" (in `text-porch-success`) when activeCount is 0, and the empty-state card text changes from "No issues found for this section." to a positive block: big ✓ in a `bg-porch-success-bg` circle + "All clear" + "Nothing needs your attention in this section right now." The dashboard urgent dot also gains `<span className="sr-only">has a safety issue</span>` (N).

**A2 — cost exposure totals.** Move `parseMidpoint` from `app/completed/page.tsx` into `lib/sections.ts` (export it; update the completed page import). In the summary modal, over all open issues (merged, not deleted/completed/ignored — compute from the same data the rows use, not `report.sections` raw), sum DIY and Pro midpoints separately, skipping nulls. Render a two-column stat row like the existing grid: "DIY total ~$X" / "Pro total ~$Y", with `EstimateDisclaimer` beneath.

**A3 — tappable top-3.** The summary modal's top-3 items become `<Link href={`/section/${slug}/issue/${index}?r=${reportId}`} onClick={() => setShowSummaryModal(false)}>` wrapping the existing row content (needs the top-3 computation to run over merged refs so slug/index/reportId are known — reuse the A2 open-issues list, sorted by `SEVERITY_ORDER`).

**A4 — progress indicator.** In the greeting card under the address: `X of Y issues handled` where Y = all non-deleted merged issues and X = completed + ignored, with a thin progress bar (`h-1.5 rounded-full bg-porch-border` track, `bg-porch-accent` fill). Hide when Y is 0.

**A5 — search carries into section.** Dashboard: section-row links become `/section/${slug}${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""}` (both the `href` and the `router.push` in `navigateToSection`). Section page: accept `searchParams: Promise<{ q?: string }>`, `use()` it, initialize a new `filter` state to `q ?? ""`, render the same search input UI as the dashboard above the issue list (with clear button), and filter `sortedIssues` by title/description includes (case-insensitive). Keep it a controlled input so the user can clear/refine.

**A6 — Action plan view.** New file `app/plan/page.tsx` ("Action Plan"). Header via `AppHeader backHref="/" backLabel="Dashboard"`. Loads reports + completions + ignored; flattens all open merged issues; sorts by `SEVERITY_ORDER` then (within severity) Pro-estimate midpoint descending. Renders numbered cards (severity badge chip using the dashboard's `SEVERITY_STYLE`, title, section name, DIY/Pro estimates) each linking to the issue detail (`?r=`). Entry point: a text button "View action plan →" in the dashboard section-list header row (next to "Add Section"), plus a full-width button at the bottom of the summary modal above "View My Home". Add the `q`-less comet/nav treatment (plain Links are fine here).

---

## Phase 4 — Issue & fix improvements (C group, H1, D group)

### C1 — Un-complete
- Issue page: in the `saved` block, add a second line: button "Mark as open" (M3-sized) → `removeCompletion(reportId, slug, index)`, `setSaved(false)`, reset form state.
- Completed page: each item card gets an "Undo — mark as open" button (bottom-right of card, stopPropagation from the Link — restructure the card so the Link wraps only the text block, with the button as a sibling). On click: `removeCompletion`, refilter local state.

### C2 — Work Mode difficulty (+ H1 cost capture)
`app/section/[slug]/issue/[issueIndex]/diy/page.tsx`: `handleFinishRepair` no longer saves immediately. New flow: finish button → set `showFinishForm` state → render a full-screen overlay (same styling family as the congrats screen) asking:
1. "How difficult was it?" — the same 1–5 button row as the issue page (required).
2. "What did you actually pay? (optional)" — `<input inputMode="decimal">` with a `$` prefix, helper text "Materials, parts — whatever it cost you." (H1).
Then a "Save & finish" button → `saveCompletion({ reportId, slug, issueIndex, completedBy: "me", difficulty, actualCost, completedAt })` → existing tool-suggestion sheet → congrats. Remove the comment block explaining the missing difficulty.
Issue page completion form (H1): add the same optional actual-cost input below the difficulty row (and for `professional` completions too — show it whenever `completedBy` is set). Save into the record.
Completed page (H1 display): on each card's cost line, when `record.actualCost` exists add `Paid <strong>${actualCost}</strong>`; savings for "me" fixes use `actualCost` instead of the DIY midpoint when present (`pro midpoint − actualCost`).

### C3 — Level-up celebration
New `app/components/LevelUpModal.tsx`: Modal with a badge icon, "You've leveled up!", body *"You're now {label}. More DIY fixes will be recommended for you."*, single "Keep it going" button. Detection: in both completion paths (issue page `handleSave`, diy page finish flow), before saving compute `before = computeEffectiveSkill(base, myCompletions, lookup)`; after saving, recompute with the new record appended; if `SKILL_RANK[after.effective] > SKILL_RANK[before.effective]`, set `showLevelUp(after.effective)`. On the diy page show it after the congrats screen's buttons area (stack above congrats content) or immediately before congrats; simplest: render the modal on top of congrats.

### C4 — Save as-is observation
Issue page observation editor: next to the existing Save (which polishes via `refine-observation`), add a secondary button "Save as-is" (`border-porch-border-input` style) that writes `observationDraft.trim()` directly to `issueDetails.userObservation` + `saveIssueDetails`, then runs the same regen-prompt chain (`handlePolishObservation`'s post-save logic — extract that tail into a shared `afterObservationSaved()`). Rename the primary button to "Polish & save" so the distinction is clear.

### C5 — Move preserves enrichment
Issue page `handleMoveIssue`: after computing `newIssueIndex` and before `router.push`, call `moveIssueDetails(reportId, slug, index, moveTarget, newIssueIndex)` (Phase 2.2). Note the move stays within the same report (`updateReportSections(reportId, …)`). Push to `/section/${moveTarget}/issue/${newIssueIndex}?r=${reportId}`.

### C6 — Safety framing (works with Phase 5's generate-diy changes)
- `generate-diy` response gains `"safetyWarning": string | null` (prompt in Phase 5). Persist into `issueDetails.safetyWarning`.
- DIY page: when `issueDetails.safetyWarning` is set, render a prominent warning card **above the materials card and as the first thing in Work Mode step 1's card**: red-tinted (`border-red-200 bg-red-50 text-red-800`), ⚠ icon, the warning text, and the fixed line *"Stop and call a pro if anything looks different from these instructions."*
- Issue page: when `showDiyWarning` is bypassed (`diyUnlocked`), keep a persistent slim amber banner above the Generate button/plan summary: *"You've chosen to proceed on a repair we'd normally route to a pro."*

### D1 + D2 + D3 + D4 — Contractor finder
`app/api/find-contractors/route.ts`:
- Add `"places.websiteUri"` to the field mask; add `websiteUri?: string` to `PlacesPlace`; map `website: p.websiteUri` into results. Add `website?: string` to `ContractorResult` in `lib/sections.ts`.

Issue page contractor list rework:
- Row shows **both** rating and address (D2): line 1 name; line 2 `★ 4.8 (123)` when rating exists; line 3 address (truncate); keep the Maps link.
- Phone renders as `<a href={`tel:${c.phone}`}>` styled as a link (D1).
- "Contact" button opens a new `ContractorContactModal` (new component `app/components/ContractorContactModal.tsx`, props `{ contractor, onClose, onRecordHire }`): shows name, tappable `tel:` phone row, tappable website row (`target="_blank" rel="noopener noreferrer"`), Maps link, and a "Record that you hired this pro" button (D4). If neither phone nor website, Contact still opens the modal with just Maps. Remove the fake `contacted` state entirely.
- **Record hire (D4):** stores `{ name, phone, website, mapsUrl }`. If the issue is already completed → update the `completed_fixes` row (`supabase.update({ hired_contractor }) … eq(report_id, slug, index)` — add `updateCompletionContractor(reportId, slug, index, contractor)` to `lib/data.ts`). If not completed → stash in localStorage `homesteward_hired_${issueKey}` and, in `saveCompletion`, read/attach/clear that stash when present. After recording, the modal confirms: "Saved — we'll remember who did this work."
- Below the results list add (D3): `<p className="mt-2.5 text-[11px] text-porch-text-tertiary">Results sourced from Google Maps. Not vetted by Porchlight.</p>`

---

## Phase 5 — AI quality & context (GROUP E)

### Shared context plumbing
New helper in `lib/ai-context.ts` (new file):
```ts
export function propertyContextLines(p: PropertyDetails | null): string
// Renders only non-null fields, one per line, e.g.:
// "Year built: 1998", "Roof: Asphalt shingle, ~12 years old", "HVAC: Forced air gas furnace / central AC, ~8 years old",
// "Foundation: Poured concrete basement", "Water heater: 50 gal gas, installed 2019" (from otherSpecs)
// Returns "" when nothing is known.
```
Client pages load `loadPropertyDetails()` (already cached per-page loads are fine) and pass a `propertyContext` string to the routes below. Keep routes stateless (no server-side Supabase reads except where auth already exists) — context always comes from the client, matching the current architecture.

### E1 + E5 — generate-diy (route + callers)
Request body gains: `location?: string`, `propertyContext?: string`, `sectionSlug?: string`.
- User content additions (non-refinement branch, after the skill/tools lines):
  - `location` → `\nThe home is located near: ${location}. Use local big-box retail prices for the materials list.`
  - `propertyContext` → `\nWhat we know about this home:\n${propertyContext}\nAccount for the home's age and systems where relevant.`
- **Full replacement system prompt (C6):**

> You are an expert home repair advisor. Generate detailed, accurate DIY repair plans for homeowners. Return only valid JSON with no surrounding text or markdown.
>
> When a repair involves electrical, gas, or structural work, treat safety as the first concern. Set "safetyWarning" to one or two plain sentences that name the specific hazard (shock, gas leak, structural collapse) and tell the homeowner to stop and call a professional if anything looks different from the instructions. Build concrete safety checks into the steps themselves: verify power is off at the breaker and confirm dead with a non-contact voltage tester before touching wiring; shut the gas supply and test for leaks with soapy water; never remove load-bearing material without temporary support. Write those steps in a direct, factual tone. For repairs without these risks, set "safetyWarning" to null.

- Response JSON shape (update the trailing instruction block):
```json
{ "safetyWarning": null, "materialsList": [ { "item": "...", "estimatedCost": "$10–$30", "isTool": false } ], "stepByStepPlan": ["Step 1: ..."] }
```
- Callers (issue page `handleGenerateDiy`/`handleRegenDiy`, diy page `handleRefine`) pass `location: userLocation`, `propertyContext`, and persist `safetyWarning` into issue details.

### E6 + E1 — generate-expert
Request body gains `photoUrls?: string[]`, `location?: string`, `propertyContext?: string`. Build `imageBlocks` exactly like generate-diy does (`{type:"image", source:{type:"url", url}}`) and switch `messages[0].content` from a bare string to `[...imageBlocks, {type:"text", text: userContent + (imageBlocks.length ? "\n\nPhotos of the issue are attached — reference what's visible where it changes what the contractor should assess." : "")}]`. Add to userContent (both branches): property context block and `location` line ("The home is near: X — mention local permit norms only if clearly relevant."). Callers (issue page `handleGenerateExpert`, `handleRefineBriefing`, `handleRegenExpert`) pass `photoUrls` via the existing `signPaths` pattern, plus location/propertyContext. System prompt unchanged.

### E3 + E1 — assistant-chat (global context)
Extend `AssistantChatContext`:
```ts
propertyContext?: string;
toolbox?: string[];
openIssues?: { section: string; title: string; severity: string }[];
completedSummary?: { total: number; byMe: number; recent: string[] };  // recent = last 3 titles
equipmentSpecs?: string[];  // dedup'd from all issues
```
In `buildSystemPrompt`, after `profileLine`, insert a home-profile block used by **all three scopes**:
```
Here's what you know about their home and history:
${propertyContext || "(no property details on file)"}
Tools they own: ${toolbox?.join(", ") || "(none recorded)"}
Fixes completed: ${completedSummary ? `${completedSummary.total} total, ${completedSummary.byMe} DIY — most recent: ${completedSummary.recent.join("; ")}` : "none yet"}
```
and for the global scope replace the bare section list with the `openIssues` list grouped by section (title + severity per line, cap 60 issues, note "…and N more" beyond). Keep the entire existing voice/off-topic rules verbatim.
`ChatFAB` callers: dashboard passes the new fields (it already loads reports/completions; add `loadPropertyDetails()` + `loadToolbox()` to its initial `Promise.all`). Section/issue scopes pass `propertyContext` + `toolbox` too (cheap, useful).

### E1 — diy-chat
Body gains `location?`, `skillLevel?`, `propertyContext?`. System prompt: after the Title/Description/Severity block insert:
```
${propertyContext ? `About this home:\n${propertyContext}\n` : ""}${skillLevel ? `The homeowner's skill level: ${skillLevel}.` : ""}${location ? ` They're near ${location}.` : ""}
```
Caller: diy page `sendMessage` (it must load profile + property — add to its initial effect).

### E4 — Suggested prompts
`ChatFAB` gains prop `suggestedPrompts?: string[]`. In the empty state (below `emptyStateText`), render up to 4 chips (`rounded-full border border-porch-accent/40 bg-porch-accent-tint px-3.5 py-2.5 text-[13px] text-porch-accent btn-press`, wrap in a flex-wrap column-gap container). Tapping a chip calls `sendMessage` with that text (refactor `sendMessage(textOverride?: string)`).
- Dashboard: `["What should I tackle first?", "What's my biggest safety risk?", "What can I DIY with my skill level?", "How's my home doing overall?"]`
- Section: `[`What should I fix first in ${displayName.toLowerCase()}?`, "Which of these can I do myself?", "What happens if I wait on these?"]`
- Issue: `["Can I do this myself?", "What will this cost me?", "What happens if I ignore it?", "How long will this take?"]`
- DIY page chat (not ChatFAB — it's inline): mirror the same chip UI in `chatBody`'s empty state with steps-focused prompts: `["What tools do I actually need?", "How do I know when it's done right?", "What's the most common mistake here?"]`.

### E7 — Persist step elaborations
- Migration 017 already adds `step_elaborations`. `IssueDetails.stepElaborations` mapped in Phase 2.2.
- DIY page: initialize `stepDetail`/`stepExpanded` from `issueDetails.stepElaborations` when details load. In `requestStepDetail`, after a successful fetch, `saveIssueDetails(reportId, slug, index, { ...issueDetails, stepElaborations: { ...issueDetails?.stepElaborations, [String(i)]: data.detail } })` (don't persist the error placeholder). `handleRefine` clears `stepElaborations` in the saved details along with local state.

### E8 — Streaming chat
Convert `diy-chat` and `assistant-chat` to stream plain text:
```ts
// route: replace client.messages.create(...) with
const stream = client.messages.stream({ /* same params */ });
const encoder = new TextEncoder();
const readable = new ReadableStream({
  async start(controller) {
    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(event.delta.text));
        }
      }
      controller.close();
    } catch (err) { controller.error(err); }
  },
});
return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
```
Errors before streaming still return JSON with a non-200 status.
New client helper `lib/chat-stream.ts`:
```ts
export async function streamChat(url: string, body: unknown, onDelta: (fullTextSoFar: string) => void): Promise<string>
// fetch(url, POST json). If !res.ok → parse JSON error, throw. Else read res.body via getReader(),
// TextDecoder(stream:true), accumulate, call onDelta(accumulated) per chunk, return final text.
```
`ChatFAB.sendMessage` and diy page `sendMessage`: append an empty assistant message immediately, update its `text` via `onDelta` (functional setState replacing the last message), persist to localStorage only once on completion. Replace the "Thinking…" bubble condition with `loading && lastAssistantText === ""` so the bubble shows until the first token. Auto-scroll effect already keys on messages — it will follow the growing text.

### E2 — Equipment age insights
New `lib/insights.ts`:
```ts
export interface AgingInsight { label: string; ageYears: number; lifespan: [number, number]; message: string; }
export function computeAgingInsights(property: PropertyDetails | null, allIssues: Issue[]): AgingInsight[]
```
Lifespan table (approaching = age ≥ low − 2): roof asphalt 18–25 (`roofAgeYears`, only when roofType matches /asphalt|shingle/i, else generic 20–30), HVAC furnace/AC 12–18 (`hvacAgeYears`), water heater 8–12 (parse `otherSpecs` + issue `equipmentSpecs` for `/water heater/i` with a 4-digit install year or "X years"). Message format: *"Your {label} is ~{age} years old — typical lifespan {lo}–{hi} years. Worth budgeting for replacement."*
UI: `app/components/AgingCallout.tsx` — amber-tinted card listing insights (icon 📅 or CalendarIcon). Rendered on the dashboard between the maintenance card and section list (only when insights exist), and at the top of `app/property/page.tsx`.

---

## Phase 6 — Toolbox & Maintenance (F, G)

### F1 — Toolbox cross-reference
New function in `lib/data.ts`: `loadAllIssueDetailsForUser(): Promise<Array<{ reportId: string; slug: string; issueIndex: number; materialsList: IssueDetails["materialsList"] }>>` — one query, `select report_id, section_slug, issue_index, materials_list from issue_details` where `materials_list is not null` (RLS scopes).
New `lib/toolbox-match.ts`: `findReadyFixes(toolbox: string[], detailsRows, openIssueRefs): Array<{ ref, missingCount: 0 }>` — an issue is "ready" when every `isTool ?? isToolHeuristic` item in its materials list is owned (case-insensitive name match; substring match both directions to catch "Cordless drill" vs "drill").
- Toolbox page: below the tool list, when matches exist: card *"You already own everything needed for these N fixes"* listing issue titles as links (`?r=`).
- Dashboard: small callout under the progress indicator when N > 0: *"🧰 You own the tools for N open fixes — view them"* linking to `/toolbox`.

### F2 — Owned-vs-needed on the DIY plan (client-side, no prompt change)
DIY page materials card: for each material, if owned (same matcher), render a small `✓ owned` chip after the name (`text-porch-success bg-porch-success-bg rounded-full px-2 text-[11px]`). Above the list, when any owned: *"You already own {list} — you'll need to pick up the rest."* (The route already excludes owned tools from *new* plans; this covers plans generated before the toolbox existed and consumables.)

### G1 — Property-aware task suggestions
`lib/maintenance.ts` add:
```ts
export function suggestedTaskNames(property: PropertyDetails | null, mergedIssues: Issue[]): Set<string>
```
Mapping against the master-task `name` strings seeded in migration 013: forced-air/furnace hvacType → "Replace HVAC filter", "Service HVAC system"; any hvacType → "Service HVAC system"; roofType present → "Inspect roof from ground", "Clean gutters & downspouts"; foundationType matches /basement|crawl/i → "Check sump pump", "Inspect foundation & grading"; otherSpecs/equipmentSpecs match /water softener/i → "Check water softener salt", /water heater/i → "Flush water heater"; always → "Test smoke & CO detectors", "Test GFCI outlets".
- `app/maintenance/page.tsx` first-run setup: after `loadMasterTasks`, pre-populate `selections` for master tasks whose name is in the suggestion set (default recurrence, blank lastDone, notify false), and render a `Suggested for your home` chip (`bg-porch-accent-tint text-porch-accent text-[10.5px] rounded-full px-2`) next to those task names. Same treatment in `SuggestionPicker` (pass the set as a prop; pre-check non-existing suggested tasks).
- The maintenance page needs `loadPropertyDetails()` + merged issues (light: reuse `loadReports`) in its initial load.

### G2 — Agenda view
`lib/maintenance.ts` add:
```ts
export function upcomingEntries(tasks: UserTask[], logs: MaintenanceLog[], days = 90): Array<{ date: string; task: UserTask; overdue: boolean }>
// active tasks; nextDueDate per task; include if due < today (overdue, listed first under "Overdue")
// or today ≤ due ≤ today+days; sorted ascending. Use addMonthsLocal/todayLocal — never Date/toISOString.
```
(For the +90d bound, add a `addDaysLocal(dateStr, n)` helper using the same local-date math style.)
New `app/maintenance/components/AgendaList.tsx`: grouped list — "Overdue" section (urgent styling), then chronological rows: weekday+date, task name, "Mark done" button reusing `handleLogComplete(task.id)` (log to `todayLocal()`).
`app/maintenance/page.tsx`: segmented toggle above the grid — two buttons "Calendar" / "Next 90 days" (chip style like completed-page filters); state `view: "month" | "agenda"`.

### G3 — Completion notes
`DayDetailSheet.tsx`: "Mark done" no longer logs immediately. Clicking it expands an inline area under that task row: `<textarea rows={2} placeholder="Any notes? What you did, what to watch for… (optional)">` + "Save" / "Skip notes" buttons; both call `onLogComplete(task.id, notes || undefined)` (the plumbing through `handleLogComplete` → `logCompletion` already accepts notes). Also show `lastLog.notes` (when present) as small italic text under the task name. Give AgendaList's Mark done the same inline-notes treatment (share a tiny `CompleteWithNotes` inline component inside `DayDetailSheet.tsx` or duplicate — duplication is acceptable at this size).

---

## Phase 7 — Sharing, affiliate structure, documents (I, J, K)

### Shared share helper — `lib/share.ts` (new)
```ts
export async function shareText(title: string, text: string): Promise<"shared"|"copied"> {
  // navigator.share({title, text}) when available (mobile); else navigator.clipboard.writeText(text)
}
```

### I1 — Export contractor briefing
Issue page, in the expert card when `hasExpertGuide`, next to "Contractor Briefing" header: a "Share" button → builds plain text: issue title, section, the briefing markdown stripped of `###` (replace with UPPERCASE line), footer `— Prepared with Porchlight (homesteward-tau.vercel.app)`; call `shareText`. Show a transient "Copied ✓" state when result is "copied".

### I2 — Share-a-fix card
New `app/components/ShareFixCard.tsx` — Modal-based, props `{ issueTitle, savings: number | null, onClose }`. Renders a styled card preview (accent gradient bg like the diy page's assistant card, big "I fixed {title} 🛠", "…and saved ~$X doing it myself" when savings, "with Porchlight" wordmark) and a "Share" button → `shareText("I fixed it myself", "I fixed \"{title}\"{savings} with Porchlight — homesteward-tau.vercel.app?ref=share")`. Entry points: (a) diy page congrats screen — third button "Share this win"; (b) issue page after `handleSave` for `completedBy:"me"` — small "Share this fix" button in the saved banner; (c) completed page — "Share" text button on each fixed-by-me card. Savings computed with the existing `savingsFor` logic (respect `actualCost` from H1).

### I3 — Shareable inspection summary
In the dashboard summary modal, a "Share summary" button: builds text —
```
{street address} — Home report summary (Porchlight)
{Y} issues across {N} sections: {a} safety, {b} repair, {c} maintenance, {d} improvement, {e} FYI
Top priorities:
1. {title} ({severity})
…
Estimated open repair costs: DIY ~${X} / Professional ~${Y} (estimates vary)
```
→ `shareText`.

### J1 — purchaseUrl scaffolding
- `lib/sections.ts`: materials item type gains `purchaseUrl?: string` (both in `Issue.materialsList` and `IssueDetails.materialsList` — they share the shape; define a named `export interface MaterialItem` and reuse).
- DIY page materials row: if `m.purchaseUrl`, render the name as `<a href target="_blank" rel="noopener noreferrer sponsored" className="underline text-porch-accent">`; else plain span (current behavior).
- "Buy what you're missing" summary: at the top of the materials card (below the header, above rows) render a muted row: cart icon + *"Buy what you're missing"* + missing-item count (items not owned per F2 matcher) — a `<button disabled>`-styled placeholder with `title="Shopping links coming soon"`; when ≥1 item has `purchaseUrl` in the future it becomes a link list (leave a `TODO(affiliate)` comment). No prompt changes — `purchaseUrl` stays unpopulated.

### K1 — Document vault
- `lib/documents.ts` (new): `DocumentItem` type; `loadDocuments()`, `uploadDocument(file, { title, category, sectionSlug? })` (path `documents/${userId}/${crypto.randomUUID()}-${file.name}` via a new `uploadUserDocument` in `lib/storage.ts` with `contentType: file.type`), `deleteDocument(id, storagePath)` (row + `removePaths`). Accept `application/pdf` and `image/*` (input `accept="application/pdf,image/*"`), 20MB client-side cap.
- `app/documents/page.tsx` (new): AppHeader back to Settings; category filter chips (All/Manuals/Warranties/Invoices/Permits/Paint/Other); list rows (title, category chip, date, file name) → tap opens signed URL in new tab (`getSignedUrl`); trash button with confirm Modal. "Add document" flow: file picker → Modal asking title (default: file name), category select, optional section select (standard sections list). Skeleton while loading; N rules apply.
- `app/settings/page.tsx`: add tile `{ href: "/documents", label: "Document Vault", desc: "Manuals, warranties, invoices, and permits" }`.

---

## Phase 8 — Onboarding & account types (L)

### L1 — Account type
- `lib/sections.ts` `UserProfile` gains `accountType?: "owner" | "renter" | "prebuy"`. `lib/data.ts` save/load map `account_type` (include in `saveUserProfile` payload and `loadUserProfile` select; default `"owner"` when null).
- `app/onboarding/page.tsx`: becomes 3 steps. New step 1 — "What brings you to Porchlight?" with three selectable cards (same pattern as add-issue's type cards): 🏠 "I own this home" / 🔑 "I'm renting" / 🔍 "I'm evaluating a home to buy". Steps 2–3 are the existing skill + location. Progress dots go to 3. Save `accountType` in `handleFinish`.
- Renter framing (`accountType === "renter"`):
  - Issue page: "Mark as complete" label becomes "Mark as handled"; the who-fixed-it options become "I fixed it" / "Landlord handled it" — map "Landlord handled it" to `completedBy: "professional"` (no schema change) and render "Handled by landlord" on completed cards when profile is renter.
  - Issue page DIY card: subtitle line *"Check your lease before modifying anything permanent — cosmetic and maintenance fixes are usually fine."* (renders only for renter).
  - Cost estimate labels unchanged (data is the same).
- Pre-purchase framing (`accountType === "prebuy"`):
  - Dashboard greeting card subtitle: "Evaluating this home" instead of greeting; the A4 progress line reads "X of Y issues reviewed".
  - Dashboard shows a prominent card under the greeting: "Generate Seller Credit Request →" linking to `/credit-request` (L2). (Owners get the same entry point inside the summary modal as a text link — "Preparing a repair addendum? Generate a seller credit request".)
- Profile page: show account type as a read-only line with an "Change" link → small Modal re-using the three cards, saved via `updateProfileFields` (extend it with `accountType`).

### L2 — Seller credit request generator
- **New route `app/api/generate-credit-request/route.ts`.** Input JSON: `{ propertyAddress?: string, buyerName?: string, requestedTotal: string, issues: Array<{ title, description, severity, costEstimatePro }> }`. Validates `issues.length > 0`. Model `claude-sonnet-4-6`, `max_tokens 3000`.
  System prompt:

  > You draft seller credit request documents for homebuyers based on home assessment findings. Write in clear, professional, neutral language suitable for a buyer's agent to forward to a listing agent. Use only the findings and figures provided — never invent issues, prices, or legal terms. This is a negotiation aid, not a legal document. Return only the document text in markdown: a brief opening paragraph, an itemized list (each item: issue, one-line description, estimated professional repair cost), a stated total requested credit, and a short closing paragraph noting estimates are based on typical professional repair costs and the buyer remains open to discussion.

  User content: the property address / buyer name lines when present, the issues serialized one per line, and `Requested credit: ${requestedTotal}`. Return `{ document: text }` (no JSON extraction needed — take the text block, trimmed).
- **New page `app/credit-request/page.tsx`:** loads merged open issues; checkbox list (checked by default for severity safety/repair; unchecked otherwise) each showing title + Pro estimate; live footer: "Total of selected estimates: ~$X" (midpoint sum) and an editable "Requested credit" input pre-filled with that sum rounded to the nearest $100; "Generate document" button → route → render the markdown via `MarkdownProse` in a result card with "Copy / Share" (`shareText`) and "Start over". Skeleton + progressive status ("Drafting your request…"). Accessible from the dashboard entries in L1.

---

## Phase 9 — Final sweep

1. **M4 audit:** confirm every page renders `PageSkeleton` (or contextual skeleton) instead of `null` while loading: `/`, `/section/[slug]`, issue page, diy page (already renders shell — fine), `/completed`, `/maintenance`, `/plan`, `/documents`, `/credit-request`, `/report`, `/profile`, `/property`, `/toolbox`.
2. **M2 verification:** the two regen modals in the issue page (`showRegenDiyModal`, `showRegenExpertModal`) currently render `<Modal maxWidth={420}>` **without `onClose`** — pass `onClose={advanceToExpertModal}` (DIY one) and `onClose={() => setShowRegenExpertModal(false)}` (expert one) so tap-outside and Escape work; disable dismissal while `regenDiyLoading`/`regenExpertLoading` by passing `onClose={loading ? undefined : …}`.
3. **N modal audit:** all Modal consumers get Escape/tap-outside via the shared component (Phase 1.1); check none re-implement overlays outside `Modal`/`BottomSheet` (the Work Mode overlay and congrats screen are full-screen states, not dialogs — leave them, but give the finish-form overlay from C2 `role="dialog" aria-modal`).
4. **N calendar signals:** `MonthGrid.tsx` — replace same-size dots with distinct shapes: due = hollow ring (`border-[2px]` w/ due color, transparent fill), overdue = filled square rotated 45° (`rotate-45 rounded-[1px]`), completed = filled circle; update legend to match; each day button gets `aria-label={`${date}${status ? `, ${status}` : ""}`}`.
5. **Severity chips:** already text-labeled everywhere (`TYPE_LABEL`) — just confirm the A1 urgent dot has its sr-only text.
6. Run `npm run lint` and `npm run build` (Turbopack). Fix all errors; treat new `no-img-element` warnings with the existing eslint-disable comment pattern.
7. Smoke-test the full flows listed in "Verification checklist" below.

---

## Dependency order (hard constraints)

| Before | Must precede | Why |
|---|---|---|
| Migrations 015–019 | everything | columns/tables/policies must exist in prod first |
| Phase 1.1 Modal upgrade | all new modals | dialog semantics inherited |
| Phase 2 (B1 data layer + URL scheme) | A, C1, C2, C5, D4, E7, F1, H1, I2, L2 | all key off `(reportId, slug, index)` and merged sections |
| B2 parser (2.5) | nothing else | independent of B1 UI but ship together |
| 017 (`step_elaborations`, `safety_warning`) | E7, C6 UI | column read/write |
| 016 (`actual_cost`, `hired_contractor`) | C2/H1/D4 UI | column read/write |
| 018 storage policy | K1 upload | inserts to `documents/` prefix rejected otherwise |
| 019 (`account_type`) | L1/L2 | profile save fails otherwise (unknown column is actually ignored by upsert? No — Postgres rejects; must precede) |
| E8 streaming (ChatFAB/diy chat internals) | E4 chips | both touch `sendMessage`; do E8 first, then E4 adds `textOverride` |
| D1 field-mask (`websiteUri`) | D4 contact modal | modal shows the website |

**Biggest regression risks:** (1) Phase 2 key-format change — any missed caller still using `getCurrentReportId()`/old `diyKey` signature will read empty caches; grep for `getCurrentReportId`, `clearLocalReport`, `REPORT_ID_KEY`, `diyKey(`, `contractorsKey(`, `loadLatestReport` after the rework — **`loadLatestReport` must have zero remaining references**. (2) `saveUserProfile` upsert with `account_type` before migration 019 runs → Postgres error → profile saves silently fall back to localStorage-only; hence migrations first. (3) E8: a route deploy without the client change (or vice versa) breaks chat — ship route+client in one deploy.

---

## Verification checklist (run after Phases 2, 5, and 9)

- Fresh account: onboarding (3 steps) → upload inspection PDF → dashboard populated, property details merged, address set.
- Second upload (a contractor punch list or any non-inspection PDF): merges with badges; parser note shown; deleting it removes only its issues.
- Old-format URL `/section/plumbing/issue/0` (no `?r=`) resolves to base report.
- Generate DIY (check safetyWarning renders on an electrical issue), elaborate a step, reload → elaboration persists; refine plan → elaborations cleared.
- Work Mode finish → difficulty + actual cost captured → tool sheet → congrats → share card; completion visible with "Paid $X"; undo from completed page reopens it.
- Contractor flow: tel: link dials (check href), website opens, "record hire" persists to the completion row.
- Chat streams token-by-token in both FAB and Work Mode; suggested prompts fire.
- Calendar: property-aware pre-checks on first run; agenda toggle; completion notes saved and displayed.
- Credit request generates and copies.
- Keyboard-only pass: tab through dashboard → section → issue; visible focus everywhere; Escape closes every modal; VoiceOver reads severity/day statuses.
