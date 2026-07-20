export type SkillLevel = "beginner" | "some_experience" | "experienced" | "expert";

export const SKILL_RANK: Record<SkillLevel, number> = {
  beginner: 0,
  some_experience: 1,
  experienced: 2,
  expert: 3,
};

// J1: shared shape for materials-list entries — used by both Issue and
// IssueDetails (they carry the same list at different points in the
// lifecycle). purchaseUrl is scaffolding only: never populated by any AI
// call today, see the diy page's "Buy what you're missing" row.
export interface MaterialItem {
  item: string;
  estimatedCost: string;
  isTool?: boolean;
  purchaseUrl?: string;
}

export interface Issue {
  title: string;
  description: string;
  severity: "safety" | "repair" | "maintenance" | "improvement" | "fyi";
  recommendedAction: string;
  costEstimateDIY?: string | null;
  costEstimatePro?: string | null;
  minimumSkillLevel?: SkillLevel | null;
  equipmentSpecs?: string[];
  // Populated on demand (not present in parse response):
  materialsList?: Array<MaterialItem>;
  stepByStepPlan?: string[];
  // User-managed fields:
  userAdded?: boolean;
  notes?: string;
  deleted?: boolean;
  photoBase64?: string;
}

export interface ReportSection {
  name: string;
  description?: string;
  slug?: string;       // explicit routing key; set on custom sections and after rename
  userAdded?: boolean; // true for sections added by the user (not from the parsed report)
  issues: Issue[];
}

export interface PropertyDetails {
  yearBuilt?: number | null;
  squareFeet?: number | null;
  homeStyle?: string | null;
  roofType?: string | null;
  roofAgeYears?: number | null;
  hvacType?: string | null;
  hvacAgeYears?: number | null;
  foundationType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  otherSpecs?: Array<{ label: string; value: string }>;
}

export interface ParsedReport {
  sections: ReportSection[];
  propertyAddress?: string | null;
  pdfStoragePath?: string | null;
  pdfFilename?: string | null;
  locationUsed?: string | null;
  propertyDetails?: PropertyDetails | null;
}

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

export interface MergedIssueRef {
  issue: Issue;
  reportId: string;
  issueIndex: number;
}

export interface MergedSection {
  slug: string;
  name: string;
  description?: string;
  issues: MergedIssueRef[];
}

export function issueKey(reportId: string, slug: string, index: number): string {
  return `${reportId}:${slug}:${index}`;
}

// Parses cost-estimate strings like "$200–$500" into a numeric midpoint.
// Returns null when the string doesn't contain a low/high pair (e.g. "N/A").
export function parseMidpoint(cost?: string | null): number | null {
  if (!cost) return null;
  const nums = [...cost.matchAll(/[\d,]+/g)].map((m) => parseInt(m[0].replace(/,/g, ""), 10));
  if (nums.length < 2 || nums.some(isNaN)) return null;
  return Math.round((nums[0] + nums[1]) / 2);
}

export interface CompletionRecord {
  slug: string;
  issueIndex: number;
  reportId: string;
  completedBy: "me" | "professional";
  difficulty?: number;
  completedAt: string;
  actualCost?: number;
  hiredContractor?: { name: string; phone?: string; website?: string; mapsUrl?: string };
}

// I2/H1: estimated dollars saved by doing a fix yourself instead of hiring a
// pro. Prefers actualCost (what the user really paid) over the DIY estimate
// midpoint when both are available. Only "me" completions can have savings —
// a professional completion has no DIY-vs-pro delta to speak of. Shared by
// app/completed/page.tsx, the diy page's congrats "Share this win" flow, and
// the issue page's post-save "Share this fix" banner.
export function savingsFor(issue: Issue, record: CompletionRecord): number | null {
  if (record.completedBy !== "me") return null;
  const pro = parseMidpoint(issue.costEstimatePro);
  if (pro === null) return null;
  if (record.actualCost !== undefined) return pro - record.actualCost;
  const diy = parseMidpoint(issue.costEstimateDIY);
  return diy !== null ? pro - diy : null;
}

export interface IssueDetails {
  materialsList?: Array<MaterialItem>;
  stepByStepPlan?: string[];
  contractorBriefing?: string;
  userObservation?: string;
  photoPaths?: string[];
  stepElaborations?: Record<string, string>;
  safetyWarning?: string | null;
}

export interface ContractorResult {
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  mapsUrl: string;
}

export interface StoredChatMessage {
  role: "user" | "assistant";
  text: string;
  imageBase64?: string;
  imageMimeType?: string;
  timestamp: string;
}

export const REPORT_KEY = "homesteward_report";
export const COMPLETIONS_KEY = "homesteward_completions";
export const IGNORED_KEY = "homesteward_ignored";
export const USER_PROFILE_KEY = "homesteward_user_profile";

export interface UserProfile {
  skillLevel: "beginner" | "some_experience" | "experienced" | "expert";
  location: string;
  address?: string;
  onboardingCompleted: boolean;
  displayName?: string;
  avatarPath?: string;
  accountType?: "owner" | "renter" | "prebuy";
}

export function diyKey(
  reportId: string,
  slug: string,
  index: number,
  type: "materials" | "steps" | "chat"
): string {
  return `homesteward_diy_${type}_${reportId}_${slug}_${index}`;
}

export function contractorsKey(reportId: string, slug: string, index: number): string {
  return `homesteward_contractors_${reportId}_${slug}_${index}`;
}

export interface SectionConfig {
  slug: string;
  label: string;
  description: string;
}

export const sections: SectionConfig[] = [
  {
    slug: "exterior",
    label: "Exterior",
    description: "Siding, paint, windows, doors, gutters, and drainage",
  },
  {
    slug: "roofing",
    label: "Roofing",
    description: "Shingles, flashing, skylights, and roof structure",
  },
  {
    slug: "structure",
    label: "Structure",
    description: "Foundation, framing, load-bearing walls, and crawl space",
  },
  {
    slug: "attic-insulation",
    label: "Attic & Insulation",
    description: "Attic ventilation, insulation levels, and air sealing",
  },
  {
    slug: "interior",
    label: "Interior",
    description: "Walls, ceilings, flooring, stairs, and interior doors",
  },
  {
    slug: "hvac",
    label: "Heating & Air Conditioning",
    description: "Furnace, AC, ductwork, filters, and thermostats",
  },
  {
    slug: "electrical",
    label: "Electrical",
    description: "Panel, wiring, outlets, fixtures, and smoke detectors",
  },
  {
    slug: "plumbing",
    label: "Plumbing",
    description: "Supply lines, drains, water heater, and shutoff valves",
  },
  {
    slug: "bathrooms",
    label: "Bathrooms",
    description: "Fixtures, tile, caulking, ventilation, and water pressure",
  },
  {
    slug: "appliances",
    label: "Appliances",
    description: "Kitchen and laundry appliances, filters, and service dates",
  },
];

export function normalize(s: string) {
  return s.toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ").trim();
}

// Same slugification used by handleAddSection across the app — kept here so
// mergeReports and every "add a custom section" call site produce identical slugs.
export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-");
}

// Merges every report's sections into one view, oldest report first. Slugs are
// resolved in priority order: explicit section.slug, then a standard-config
// match by normalized name, then a slugified name (deduped against everything
// already claimed). issueIndex on each MergedIssueRef is always the index
// within that *report's own* section.issues array — never a merged/global
// position — so callers can round-trip back to (reportId, slug, issueIndex).
export function mergeReports(reports: StoredReport[]): MergedSection[] {
  const bySlug = new Map<string, MergedSection>();
  const claimedSlugs = new Set<string>(sections.map((s) => s.slug));

  for (const report of reports) {
    for (const section of report.sections) {
      let slug = section.slug;
      if (!slug) {
        const std = sections.find((sc) => normalize(sc.label) === normalize(section.name));
        if (std) {
          slug = std.slug;
        } else {
          const base = slugify(section.name);
          const existing = bySlug.get(base);
          if (existing && normalize(existing.name) === normalize(section.name)) {
            // Same unslugged custom section name seen in an earlier report — merge into it.
            slug = base;
          } else if (!claimedSlugs.has(base)) {
            slug = base;
          } else {
            let n = 2;
            let candidate = `${base}-${n}`;
            while (claimedSlugs.has(candidate)) {
              n++;
              candidate = `${base}-${n}`;
            }
            slug = candidate;
          }
        }
      }
      claimedSlugs.add(slug);

      let merged = bySlug.get(slug);
      if (!merged) {
        const std = sections.find((sc) => sc.slug === slug);
        merged = {
          slug,
          name: std?.label ?? section.name,
          description: std?.description ?? section.description,
          issues: [],
        };
        bySlug.set(slug, merged);
      }

      section.issues.forEach((issue, issueIndex) => {
        merged!.issues.push({ issue, reportId: report.id, issueIndex });
      });
    }
  }

  return Array.from(bySlug.values());
}
