export type SkillLevel = "beginner" | "some_experience" | "experienced" | "expert";

export const SKILL_RANK: Record<SkillLevel, number> = {
  beginner: 0,
  some_experience: 1,
  experienced: 2,
  expert: 3,
};

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
  materialsList?: Array<{ item: string; estimatedCost: string; isTool?: boolean }>;
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

export interface CompletionRecord {
  slug: string;
  issueIndex: number;
  completedBy: "me" | "professional";
  difficulty?: number;
  completedAt: string;
}

export interface IssueDetails {
  materialsList?: Array<{ item: string; estimatedCost: string; isTool?: boolean }>;
  stepByStepPlan?: string[];
  contractorBriefing?: string;
  userObservation?: string;
  photoPaths?: string[];
}

export interface ContractorResult {
  name: string;
  address: string;
  phone?: string;
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
}

export function diyKey(
  slug: string,
  index: number,
  type: "materials" | "steps" | "chat"
): string {
  return `homesteward_diy_${type}_${slug}_${index}`;
}

export function contractorsKey(slug: string, index: number): string {
  return `homesteward_contractors_${slug}_${index}`;
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
