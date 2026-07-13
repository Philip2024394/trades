// Universal Composer — post-type registry.
//
// Facebook-style dropdown drives the composer body. Each post type
// declares its shape + which area it publishes to + its destination
// route (so on submit we hand off to the area's own page with the
// composed content as query params).
//
// Areas own their own data models. The composer is the ONE entry point.

import type { LucideIcon } from "lucide-react";
import {
  Package,
  MessageCircle,
  Notebook as NotebookIcon,
  Megaphone,
  PoundSterling,
  Briefcase,
  Radio,
  Building2,
  ImageIcon
} from "lucide-react";

export type ComposerTypeKey =
  | "tc-product"
  | "canteen-post"
  | "notebook-item"
  | "yard-announcement"
  | "rate-update"
  | "job-diary"
  | "counter-crosspost";

export type ComposerField =
  | { kind: "text"; key: string; label: string; placeholder?: string; required?: boolean; multiline?: boolean }
  | { kind: "number"; key: string; label: string; min?: number; max?: number; step?: number; prefix?: string }
  | { kind: "select"; key: string; label: string; options: { value: string; label: string }[] }
  | { kind: "toggle"; key: string; label: string; hint?: string }
  | { kind: "image"; key: string; label: string; hint?: string };

export type ComposerType = {
  key: ComposerTypeKey;
  label: string;              // "Trade Center · Post product"
  areaLabel: string;          // "Trade Center" · shown as small chip
  Icon: LucideIcon;
  areaColour: string;
  description: string;        // one-line hint below the dropdown
  destinationRoute: string;   // where the user lands on Post
  fields: ComposerField[];
  cta: string;                // "Continue to Trade Center"
};

export const COMPOSER_TYPES: ComposerType[] = [
  {
    key: "tc-product",
    label: "Trade Counter · Post an item",
    areaLabel: "Trade Counter",
    Icon: Package,
    areaColour: "#0A0A0A",
    description: "Post ONE item — surplus material, used tool, swap or free. Trades only. Not the merchant catalogue.",
    destinationRoute: "/tc/trade-counter/new",
    cta: "Continue to Trade Counter",
    fields: [
      { kind: "text",   key: "title", label: "Title", placeholder: "18 sheets plasterboard 12.5mm surplus", required: true },
      { kind: "select", key: "kind",  label: "Listing type", options: [
        { value: "for-sale", label: "For Sale" },
        { value: "offer",    label: "Swap / Offer" },
        { value: "free",     label: "Free" }
      ] },
      { kind: "number", key: "askingGbp", label: "Asking price (£)", prefix: "£", min: 0, step: 1 },
      { kind: "image",  key: "image", label: "Photo (optional)", hint: "Recommended for faster sale." }
    ]
  },
  {
    key: "canteen-post",
    label: "Canteen · Share with your canteen",
    areaLabel: "Canteen",
    Icon: MessageCircle,
    areaColour: "#F59E0B",
    description: "Posts stay in the canteen — only elevate to Yard if you tap Promote.",
    destinationRoute: "/trade-off/yard/canteens",
    cta: "Post to canteen",
    fields: [
      { kind: "text",   key: "body",     label: "What's going on", placeholder: "Just finished a re-skim in Withington…", multiline: true, required: true },
      { kind: "image",  key: "image",    label: "Add a photo", hint: "Optional — recent-work shots do best." },
      { kind: "select", key: "canteen",  label: "Which canteen", options: [
        { value: "plasterers-uk",  label: "UK Plasterers" },
        { value: "manchester-trades", label: "Manchester Trades" },
        { value: "site-managers",  label: "Site Managers" }
      ] },
      { kind: "toggle", key: "promote",  label: "Also promote to the Yard feed", hint: "One-way — cannot un-promote later." }
    ]
  },
  {
    key: "notebook-item",
    label: "Notebook · Add supply item",
    areaLabel: "Notebook",
    Icon: NotebookIcon,
    areaColour: "#B45309",
    description: "The stuff you buy every job. Auto-matches to the nearest verified merchant.",
    destinationRoute: "/tc/notebook",
    cta: "Add to Notebook",
    fields: [
      { kind: "text",   key: "productName", label: "Product",   placeholder: "British Gypsum Multi-Finish", required: true },
      { kind: "number", key: "usualQty",    label: "Usual quantity", min: 1, step: 1 },
      { kind: "select", key: "unit",        label: "Unit", options: [
        { value: "bags",   label: "bags" },
        { value: "sheets", label: "sheets" },
        { value: "each",   label: "each" },
        { value: "rolls",  label: "rolls" },
        { value: "tubes",  label: "tubes" }
      ] }
    ]
  },
  {
    key: "yard-announcement",
    label: "Yard · Public announcement",
    areaLabel: "Yard",
    Icon: Megaphone,
    areaColour: "#DC2626",
    description: "Trade-wide feed. Reaches everyone in your local trade network.",
    destinationRoute: "/trade-off/yard",
    cta: "Post to the Yard",
    fields: [
      { kind: "text",  key: "body",   label: "Announcement", placeholder: "Anyone with a spare pallet of PVA?", multiline: true, required: true },
      { kind: "image", key: "image",  label: "Photo", hint: "Optional — recent-work shots convert best." },
      { kind: "toggle", key: "moodCharacter", label: "Add the construction-worker illustration", hint: "Optional mascot per Yard style." }
    ]
  },
  {
    key: "rate-update",
    label: "Rate card · Update a rate",
    areaLabel: "Rates",
    Icon: PoundSterling,
    areaColour: "#B45309",
    description: "Adjust a published labour rate. Customers see the change immediately.",
    destinationRoute: "/tc/rates",
    cta: "Continue to Rates",
    fields: [
      { kind: "select", key: "rateItem", label: "Which rate", options: [
        { value: "skim-per-m2",       label: "Skim per m²" },
        { value: "multi-finish-per-m2", label: "Multi-finish per m²" },
        { value: "ceiling-per-job",   label: "Ceiling per job" },
        { value: "day-rate",          label: "Day rate" }
      ] },
      { kind: "number", key: "newRate",  label: "New rate", prefix: "£", min: 0, step: 0.5, required: true },
      { kind: "toggle", key: "public",   label: "Publish publicly", hint: "Off = save as draft only." }
    ]
  },
  {
    key: "job-diary",
    label: "Job · Add a diary entry",
    areaLabel: "Jobs",
    Icon: Briefcase,
    areaColour: "#1E40AF",
    description: "Log what happened on site today. Attaches to your Job Cost record.",
    destinationRoute: "/tc/jobs",
    cta: "Save to job diary",
    fields: [
      { kind: "select", key: "jobSlug", label: "Which job", options: [
        { value: "watson-full-reskim", label: "Watson full re-skim" },
        { value: "parkside-shop-fit",  label: "Parkside cafe shop-fit" },
        { value: "birchfield-ceiling", label: "Birchfield ceiling" }
      ] },
      { kind: "text",   key: "body",   label: "What happened", placeholder: "First fix completed on ground floor…", multiline: true, required: true },
      { kind: "image",  key: "photo",  label: "Site photo", hint: "Optional but recommended for progress evidence." }
    ]
  },
  {
    key: "counter-crosspost",
    label: "The Counter · Cross-post a product",
    areaLabel: "Counter",
    Icon: Radio,
    areaColour: "#0A0A0A",
    description: "Promote a TC product to the Counter feed on The Network side.",
    destinationRoute: "/trade-off/counter",
    cta: "Cross-post to Counter",
    fields: [
      { kind: "select", key: "productSlug", label: "Which product", options: [
        { value: "marshalltown-finishing-trowel-14", label: "Marshalltown 14\" trowel" },
        { value: "ox-plastering-hawk-13",            label: "OX Plastering Hawk 13\"" },
        { value: "refina-skimming-blade-24",         label: "Refina Skimming Blade" }
      ] },
      { kind: "select", key: "audience", label: "Audience", options: [
        { value: "everyone", label: "Everyone" },
        { value: "trades",   label: "Verified Trades only" },
        { value: "local",    label: "Local traders" }
      ] }
    ]
  }
];

export function findComposerType(key: ComposerTypeKey): ComposerType | undefined {
  return COMPOSER_TYPES.find((t) => t.key === key);
}

// Icon module import that TypeScript can see
export { Building2, ImageIcon };
