// Client-only draft store for the Project wizard.
//
// Wizard state persists in sessionStorage. Each page reads on mount,
// writes on continue. On final submit we ship the whole thing to
// /api/project/submit. No account required — Sarah gives contact
// details in step 3, we create a lightweight party row for her at
// submit time.

"use client";

import { useEffect, useState } from "react";

const KEY = "xratedtrade:project-draft:v1";

export type ProjectDraft = {
  // Step 1 — property + type
  postcode: string;
  propertyType: string;
  projectType: string;
  // Step 2 — details
  scope: string;
  timeframe: string;
  budget: string;
  // Step 3 — contact
  name: string;
  email: string;
  whatsapp: string;
  contactPref: "any" | "email" | "phone" | "whatsapp";
  // Step 4 — matches selected
  selectedTradeIds: string[];
};

export const EMPTY_DRAFT: ProjectDraft = {
  postcode: "",
  propertyType: "",
  projectType: "",
  scope: "",
  timeframe: "",
  budget: "",
  name: "",
  email: "",
  whatsapp: "",
  contactPref: "any",
  selectedTradeIds: []
};

export function readDraft(): ProjectDraft {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed = JSON.parse(raw) as Partial<ProjectDraft>;
    return { ...EMPTY_DRAFT, ...parsed };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function writeDraft(patch: Partial<ProjectDraft>): ProjectDraft {
  const current = readDraft();
  const next = { ...current, ...patch };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — ignore */
  }
  return next;
}

export function clearDraft() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// React hook — subscribes to draft state, exposes patch helper.
export function useDraft() {
  const [draft, setDraft] = useState<ProjectDraft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDraft(readDraft());
    setHydrated(true);
  }, []);

  function patch(p: Partial<ProjectDraft>) {
    const next = writeDraft(p);
    setDraft(next);
    return next;
  }

  return { draft, patch, hydrated };
}

// Trade + project type option lists — shared across steps.
export const PROJECT_TYPES = [
  { value: "kitchen", label: "Kitchen renovation" },
  { value: "bathroom", label: "Bathroom renovation" },
  { value: "extension", label: "Extension" },
  { value: "loft-conversion", label: "Loft conversion" },
  { value: "roofing", label: "Roofing" },
  { value: "boiler", label: "Boiler / heating" },
  { value: "electrics", label: "Electrical work" },
  { value: "plumbing", label: "Plumbing" },
  { value: "flooring", label: "Flooring" },
  { value: "decorating", label: "Painting / decorating" },
  { value: "windows-doors", label: "Windows or doors" },
  { value: "damp-repair", label: "Damp or structural repair" },
  { value: "landscaping", label: "Landscaping / garden" },
  { value: "driveway", label: "Driveway / paving" },
  { value: "other", label: "Something else" }
];

export const PROPERTY_TYPES = [
  { value: "terraced", label: "Terraced house" },
  { value: "semi-detached", label: "Semi-detached" },
  { value: "detached", label: "Detached" },
  { value: "flat", label: "Flat / apartment" },
  { value: "new-build", label: "New build" },
  { value: "bungalow", label: "Bungalow" },
  { value: "listed", label: "Listed / period" },
  { value: "commercial", label: "Commercial" }
];

export const TIMEFRAMES = [
  { value: "asap", label: "As soon as possible" },
  { value: "1-month", label: "Within 1 month" },
  { value: "3-month", label: "Within 3 months" },
  { value: "6-month", label: "Within 6 months" },
  { value: "no-rush", label: "No rush — planning ahead" }
];

export const BUDGETS = [
  { value: "under-2k", label: "Under £2,000" },
  { value: "2k-10k", label: "£2,000 – £10,000" },
  { value: "10k-30k", label: "£10,000 – £30,000" },
  { value: "30k-100k", label: "£30,000 – £100,000" },
  { value: "over-100k", label: "£100,000+" },
  { value: "not-sure", label: "Not sure yet" }
];

// Map wizard project type → primary_trade in os_business_listings
// so the matches query filters cleanly.
export const PROJECT_TO_TRADE: Record<string, string[]> = {
  kitchen: ["kitchen-fitter", "carpenter", "builder"],
  bathroom: ["bathroom-fitter", "plumber", "tiler"],
  extension: ["builder", "carpenter"],
  "loft-conversion": ["builder", "carpenter", "roofer"],
  roofing: ["roofer"],
  boiler: ["heating-engineer", "plumber"],
  electrics: ["electrician"],
  plumbing: ["plumber"],
  flooring: ["flooring-installer", "carpenter"],
  decorating: ["painter", "decorator"],
  "windows-doors": ["window-installer", "carpenter"],
  "damp-repair": ["builder", "damp-specialist"],
  landscaping: ["landscaper", "gardener"],
  driveway: ["landscaper", "groundworker"],
  other: []
};
