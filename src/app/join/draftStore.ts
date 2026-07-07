// Trade join wizard draft store — sessionStorage-persisted state
// across the 3 join steps.
"use client";

import { useEffect, useState } from "react";

const KEY = "xratedtrade:join-draft:v1";

export type JoinDraft = {
  // Step 1
  displayName: string;
  primaryTrade: string;
  city: string;
  postcode: string;
  // Step 2
  email: string;
  whatsapp: string;
  businessType: "sole-trader" | "limited" | "partnership" | "";
  companiesHouseNumber: string;
};

export const EMPTY_DRAFT: JoinDraft = {
  displayName: "",
  primaryTrade: "",
  city: "",
  postcode: "",
  email: "",
  whatsapp: "",
  businessType: "",
  companiesHouseNumber: ""
};

export function readDraft(): JoinDraft {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return EMPTY_DRAFT;
    return { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<JoinDraft>) };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function writeDraft(patch: Partial<JoinDraft>): JoinDraft {
  const next = { ...readDraft(), ...patch };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
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

export function useDraft() {
  const [draft, setDraft] = useState<JoinDraft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDraft(readDraft());
    setHydrated(true);
  }, []);

  function patch(p: Partial<JoinDraft>) {
    const next = writeDraft(p);
    setDraft(next);
    return next;
  }

  return { draft, patch, hydrated };
}

// Trade options aligned with the app's existing trade taxonomy.
export const TRADE_OPTIONS = [
  { value: "builder", label: "Builder" },
  { value: "carpenter", label: "Carpenter" },
  { value: "electrician", label: "Electrician" },
  { value: "plumber", label: "Plumber" },
  { value: "roofer", label: "Roofer" },
  { value: "kitchen-fitter", label: "Kitchen fitter" },
  { value: "bathroom-fitter", label: "Bathroom fitter" },
  { value: "tiler", label: "Tiler" },
  { value: "plasterer", label: "Plasterer" },
  { value: "painter", label: "Painter" },
  { value: "decorator", label: "Decorator" },
  { value: "flooring-installer", label: "Flooring installer" },
  { value: "heating-engineer", label: "Heating engineer" },
  { value: "gas-safe", label: "Gas Safe engineer" },
  { value: "landscaper", label: "Landscaper" },
  { value: "gardener", label: "Gardener" },
  { value: "groundworker", label: "Groundworker" },
  { value: "scaffolder", label: "Scaffolder" },
  { value: "window-installer", label: "Window installer" },
  { value: "damp-specialist", label: "Damp specialist" },
  { value: "drywaller", label: "Drywaller" },
  { value: "handyman", label: "Handyman" },
  { value: "builders-merchant", label: "Builders merchant" },
  { value: "electrical-supplier", label: "Electrical supplier" },
  { value: "plumbing-supplier", label: "Plumbing supplier" },
  { value: "manufacturer", label: "Manufacturer" },
  { value: "other", label: "Something else" }
];

export const BUSINESS_TYPES: Array<{
  value: JoinDraft["businessType"];
  label: string;
}> = [
  { value: "sole-trader", label: "Sole trader" },
  { value: "limited", label: "Limited company" },
  { value: "partnership", label: "Partnership" }
];
