"use client";

// General Nex Chat page · Philip 2026-08-03.
//
// The clean assistant surface. NOT trade-branded · NOT merchant-scoped.
// Called from:
//   · Landing page "Nex Chat" tile (href → this route)
//   · BottomNav center FAB (+) (router.push → this route)
//
// Deliberately kept separate from ChatSurface (which stays as the trade-
// brain surface inside brain pages) and MerchantProfileSheet's modal chat
// (which stays as the merchant-context intake).
//
// Design constraints (Philip verbatim):
//   · No permanent trade tools (no Gallery / Calculator / Materials /
//     Regulations / Contact footer buttons)
//   · Feels like a premium AI assistant, not a trade enquiry window
//   · Dynamic buttons pattern · specialist actions appear in-context
//   · Third Law honest · v1 replies are deterministic + suggestion chips
//     that route to real surfaces · never fabricated merchants or claims
//
// Theme · BLOSSOM applied 2026-08-03 (Philip's Theme Engine test).
// Proof of the Theme Engine Contract: interaction stays constant, visual
// identity adapts. NAVIGATION · FOUR SURFACES · CARDS · FOOTER LAYOUT ·
// COMPOSER POSITION · APIs · BUSINESS LOGIC · STATE MACHINES · CARD
// LIFECYCLE · MOTION MEANING · HONEST-STATE COPY all unchanged. Only
// visual tokens (colours · radii · fonts · shadows · loading visual ·
// wallpaper) swap. The theme block below is entirely additive and does
// not touch any JSX beyond adding the `nex-theme-blossom` class + a
// data-loading attribute + font variables.

import { Fraunces, Fredoka, Manrope, Nunito } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  Camera,
  ChevronRight,
  Clock,
  FolderOpen,
  Home as HomeIcon,
  Image as ImageIcon,
  Layers,
  MessageCircle,
  Mic,
  MicOff,
  Paperclip,
  Pause,
  Phone,
  PhoneOff,
  Play,
  Search as SearchIcon,
  Send,
  Sparkles,
  Type,
  Users,
  X as XIcon,
} from "lucide-react";
import {
  getSessionId,
  listOpenProjects,
  PROJECTS_UPDATED_EVENT,
} from "@/lib/nex/projects/customer-store";
import type { Project } from "@/lib/nex/projects/types";
import {
  cancelTaskPush,
  canEnableNexPush,
  disableNexPush,
  enableNexPush,
  scheduleTaskPush,
  sendTestNexPush,
} from "@/lib/nex/push/client";
import {
  acceptIncomingCall,
  declineIncomingCall,
  startCallSignalPolling,
  startOutgoingCall,
  stopCallSignalPolling,
  subscribeToCallSignals,
  type CallState,
  type NexCallHandle,
} from "@/lib/nex/calls/client";
import type { CallSignal } from "@/lib/nex/calls/server";
import { brandTerm, brandTermPlain } from "@/lib/nex/branding/terminology";

type Suggestion = { label: string; href: string };

// Card payloads · Philip 2026-08-03 · Chat-First OS. Mirrors the shape
// returned from /api/nex/general-chat. Kept minimal for v1 — Meeting +
// ImageCreation only.
type CardAction =
  | { kind: "link"; label: string; href: string }
  | { kind: "coming_soon"; label: string; toast: string }
  | { kind: "dismiss"; label: string }
  // Philip 2026-08-03 · save-for-later replaces the "coming_soon toast"
  // pattern for meeting-shaped intents. The user's work is preserved
  // in-place — the card enters a "prepared · waiting" state rather than
  // showing a rejection toast.
  | { kind: "save_for_later"; label: string; state: "prepared_waiting" };

type MeetingCardData = {
  type: "meeting";
  fields: { title: string; date: string; time: string; reminder: string };
  status: "requires_connection" | "coming_soon";
  status_label: string;
  actions: CardAction[];
};

type ImageCreationCardData = {
  type: "image_creation";
  fields: { subject: string; overlay: string; format: string };
  status: "coming_soon";
  status_label: string;
  actions: CardAction[];
};

// Footer cards · Philip 2026-08-03 · Continue is the only footer button
// that injects a chat card. Contacts opens a right-side drawer · Play
// opens a bottom sheet · both live outside the message stream.
//
// Continue merges Workspace + Projects into ONE hub (Now/Ongoing lanes).
// Snapshotted at tap time. Answers the North Star:
// "Every conversation moves you forward."
type ContinueCardData = {
  type: "continue";
  items: Array<{
    kind: "meeting" | "image_creation";
    title: string;
    detail: string;
    status?: string;
  }>;
};

// Stairs product card · Philip 2026-08-03. Inserted when the owner
// selects a product from the Play → Stairs drawer. Renders as a rich
// media card in the chat stream. Snapshot at insertion time · edits
// to the source product don't retro-update inserted cards (message
// immutability).
type StairsProductCardData = {
  type: "stairs_product";
  product: StairsProduct;
};

// Connect-invite card · injected in the chat when someone (real or
// demo) wants to connect via Nex ID. Accept adds them to Contacts.
// Decline dismisses. Snapshotted state so the card can be re-rendered
// with the outcome ("Connected" · "Declined") after user action.
type ConnectInviteCardData = {
  type: "connect_invite";
  fromName: string;
  fromNexId: string;
  fromInitials: string;
  fromAvatarColor: string;
  fromRole?: string;
  isDemo?: boolean;
  outcome?: "pending" | "connected" | "declined";
};

// Staircase plan card · Philip 2026-08-03. Owner picks a plan from the
// Play → Staircase Plans drawer, it lands in the chat as a small rich
// card so the recipient (customer) sees the exact layout being proposed.
type StaircasePlanCardData = {
  type: "staircase_plan";
  plan: StaircasePlan;
};

// Daily briefing cards · Philip 2026-08-03. Morning and evening cards
// are VIEWS of the NexTask system — no separate storage, no duplication.
// The card holds only the date it covers; the renderer reads the live
// task list at render time so mid-day edits stay reflected.
type BriefingKind = "morning" | "evening";
type DailyBriefingCardData = {
  type: "daily_briefing";
  kind: BriefingKind;
  dateIso: string;   // YYYY-MM-DD
};

// Commitment suggestion card · Philip 2026-08-03. The Commitment Engine
// posts one of these into the chat when it detects one OR MORE promises
// in the user's message. Confirmation-first UX — Create / Edit / Dismiss
// so the user always chooses. Original text + message id preserved for
// transparency ("why did Nex create this task?" → show the source line).
type SuggestionItem = {
  id: string;                    // local id · used as key + outcome map key
  title: string;
  dueAt: string;                 // ISO local · YYYY-MM-DDTHH:MM
  reminder: NexTaskReminder;
  confidence: number;            // 0..1 · internal only · never rendered
};
type CommitmentSuggestionCardData = {
  type: "commitment_suggestion";
  suggestions: SuggestionItem[];       // 1..N · one message may hold several
  originalMessageId: string;
  originalText: string;
  // Per-item outcome map · absent = pending. Once every suggestion has
  // an outcome, the card renders a resolved state.
  outcomes?: Record<string, "created" | "dismissed">;
  // Links back for potential audit view later.
  createdTaskIds?: Record<string, string>;
};

// Call summary card · Philip 2026-08-03. Posted into the chat after a
// 1-to-1 call ends. In v1 the call itself is a single-device UI preview
// (no peer connection · no transcription pipeline), so this card is
// clearly labeled as a preview and its action-items are illustrative.
// When the backend + transcription land, the same card shape carries
// real extracted commitments — Nex captures the call.
type CallSummaryCardData = {
  type: "call_summary";
  contactId: string;
  contactName: string;
  durationMs: number;
  actionItems: string[]; // illustrative in v1
  preview: true;         // must be true in v1 — never present as real
};

type CardData =
  | MeetingCardData
  | ImageCreationCardData
  | ContinueCardData
  | StairsProductCardData
  | ConnectInviteCardData
  | StaircasePlanCardData
  | CallSummaryCardData
  | CommitmentSuggestionCardData
  | DailyBriefingCardData;

// Play sheet toggles · Philip 2026-08-03. Three independent feature
// flags surfaced through the Play bottom sheet + per-feature drawers.
// Persist to localStorage under `nex.play.toggles`.
type PlayToggles = {
  stickers: boolean;    // action-verb stickers on chat messages
  animation: boolean;   // theme-signature ambient particles
  stairs: boolean;      // swipeable staircase design deck
};

type PlayFeature = "stickers" | "plans" | "stairs";

// ─── <model-viewer> custom element type declaration ────────────────
// Google's @google/model-viewer web component (loaded via next/script
// CDN below). TypeScript needs this so JSX doesn't complain about the
// unknown element + attributes.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          poster?: string;
          "camera-controls"?: boolean | "";
          "auto-rotate"?: boolean | "";
          "auto-rotate-delay"?: string | number;
          "rotation-per-second"?: string;
          exposure?: string | number;
          "shadow-intensity"?: string | number;
          "environment-image"?: string;
          "camera-orbit"?: string;
          "interaction-prompt"?: "auto" | "when-focused" | "none";
        },
        HTMLElement
      >;
    }
  }
}

// ─── Staircase Plans · Philip 2026-08-03 ────────────────────────────
//
// Curated library of staircase LAYOUT types (plan shapes). Owner picks
// a category from a dropdown, taps a plan card, plan lands in the chat
// as a rich card showing the layout at a glance. Not user-uploaded —
// plans are the industry-standard shapes staircase makers reference.

type PlanCategory =
  | "straight_flight"
  | "dog_leg"
  | "winder"
  | "half_landing"
  | "quarter_landing"
  | "spiral"
  | "l_shape";

type StaircasePlan = {
  id: string;
  name: string;
  category: PlanCategory;
  description: string;
  icon: string;              // unicode glyph representing the plan shape
  modelUrl?: string;         // optional 3D model asset (.glb / Supabase URL)
  handrailSide?: "none" | "left" | "right" | "both";
  stringType?: "closed" | "cut";
};

const PLAN_CATEGORIES: { id: PlanCategory; label: string }[] = [
  { id: "straight_flight",  label: "Straight flight" },
  { id: "dog_leg",          label: "Dog leg" },
  { id: "winder",           label: "Winder" },
  { id: "half_landing",     label: "Half landing" },
  { id: "quarter_landing",  label: "Quarter landing" },
  { id: "spiral",           label: "Spiral" },
  { id: "l_shape",          label: "L-shape" },
];

const STAIRCASE_PLANS: StaircasePlan[] = [
  // Straight flight · closed string variants (Philip 2026-08-03).
  //
  // ⚠ TEMPORARY DEMO MODELS: modelUrl values below point at Google's
  // public model-viewer sample GLBs so the inline 3D viewer is VISIBLY
  // WORKING in dev. Replace each modelUrl with the real Supabase URL
  // for the corresponding staircase model — same field, no other code
  // changes required.
  {
    id: "pl-sfcs",
    name: `Straight flight · ${brandTerm("closed-string")}`,
    category: "straight_flight",
    description: `Classic linear staircase with ${brandTermPlain("closed-string")} (traditionally called closed strings) on both sides. No handrail — bare architectural form.`,
    icon: "↑",
    stringType: "closed",
    handrailSide: "none",
    modelUrl:
      "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
  },
  {
    id: "pl-sfcs-lh",
    name: `Straight flight · ${brandTermPlain("closed-string")} · left handrail`,
    category: "straight_flight",
    description: `Linear ${brandTermPlain("closed-string")} flight with handrail on the LEFT side (facing up). Standard domestic layout.`,
    icon: "↑",
    stringType: "closed",
    handrailSide: "left",
    modelUrl:
      "https://modelviewer.dev/shared-assets/models/RobotExpressive.glb",
  },
  {
    id: "pl-sfcs-rh",
    name: `Straight flight · ${brandTermPlain("closed-string")} · right handrail`,
    category: "straight_flight",
    description: `Linear ${brandTermPlain("closed-string")} flight with handrail on the RIGHT side (facing up). Standard domestic layout.`,
    icon: "↑",
    stringType: "closed",
    handrailSide: "right",
    modelUrl:
      "https://modelviewer.dev/shared-assets/models/reflective-sphere.glb",
  },
  // Dog leg
  { id: "pl-4", name: "Dog leg · half turn",        category: "dog_leg", description: "180° turn at a landing between two flights. Fits into a square stairwell.", icon: "↗" },
  { id: "pl-5", name: "Dog leg · quarter turn",     category: "dog_leg", description: "90° turn at a landing. Popular in modern semi-detached layouts.", icon: "⌐" },
  // Winder
  { id: "pl-6", name: "3-tread winder",             category: "winder", description: "Three tapered treads at the turn. Space-saving, popular in cottage conversions.", icon: "↺" },
  { id: "pl-7", name: "5-tread winder",             category: "winder", description: "Five tapered treads for a gentler pitch. More comfortable underfoot than 3-tread.", icon: "↺" },
  // Half landing
  { id: "pl-8", name: "Half landing · 180°",        category: "half_landing", description: "Full 180° turn at a broad landing. Traditional Georgian, generous well opening.", icon: "⟲" },
  // Quarter landing
  { id: "pl-9", name: "Quarter landing · 90°",      category: "quarter_landing", description: "90° turn at a small landing. Modern minimal footprint. Popular in loft extensions.", icon: "⌐" },
  // Spiral
  { id: "pl-10", name: "Spiral · 1400mm well",      category: "spiral", description: "Circular spiral, 1400mm diameter well. Compact space-saver for secondary access.", icon: "⟳" },
  // L-shape
  { id: "pl-11", name: "L-shape",                   category: "l_shape", description: "Two flights meeting at a landing to form an L. Cleanest cornered layout.", icon: "⌐" },
];

// ─── Stairs product catalog · Philip 2026-08-03 (v1 · localStorage) ─
//
// Trade owner's staircase products · uploaded via Play → Stairs drawer,
// inserted into chat conversations to share with customers. v1 uses
// localStorage under `nex.stairs.products` and `nex.stairs.categories`
// (custom categories added via the dropdown).
//
// Deferred:
//   · Real Supabase persistence · nex_stairs_products table
//   · File upload · Supabase storage / ImageKit
//   · Edit / delete · currently add-only
// Uploader identity attached to every product. v1: mocks carry real
// business names, user uploads default to a "You" identity until real
// auth ships (then this is replaced with the current user's profile).
type ProductUploader = {
  name: string;
  initials: string;
  avatarColor: string;        // hex for the initial disc
  role?: string;              // e.g. "Staircase Maker · Manchester"
};

type StairsProduct = {
  id: string;                 // "sp-" + random
  category: string;           // category id · one of built-in or custom
  name: string;
  description: string;
  imageUrl: string;           // http(s) URL for seeds · data:image/... for uploads
  price: number | null;       // GBP · null if not set
  deliveryIncluded: boolean;
  vatIncluded: boolean;
  installationIncluded: boolean;
  uploadedBy: ProductUploader;
  createdAt: string;          // ISO timestamp
};

// Fallback identity for products written by earlier v1 (pre-uploader
// migration) so they render sensibly without a crash. Also used as the
// default identity for uploads from the form until real auth lands.
const DEFAULT_UPLOADER: ProductUploader = {
  name: "You",
  initials: "You",
  avatarColor: "#B78352",     // warm bronze — neutral tradesperson tone
};

const BUILT_IN_STAIRS_CATEGORIES: { id: string; label: string }[] = [
  { id: "staircase",       label: "Staircase" },
  { id: "staircase_parts", label: "Staircase parts" },
  { id: "stairs_refacing", label: "Stairs refacing" },
];

const STAIRS_STORAGE_PRODUCTS = "nex.stairs.products";
const STAIRS_STORAGE_CATEGORIES = "nex.stairs.categories";
const STAIRS_STORAGE_SEEDED = "nex.stairs.seeded.v1";
const STAIRS_UPDATED_EVENT = "nex-stairs-updated";

// Mock product catalog · Philip 2026-08-03. Seeded on FIRST load so the
// drawer isn't empty for demo/preview. User's own uploads land alongside
// these · edit/delete lands in a later slice. All image URLs point at
// real staircase imagery already in the trades repo's ImageKit account.
// Named merchant identities · gives the seed catalog a real marketplace
// feel and shows off sender attribution on cards. Every mock references
// one of these so the same maker's products carry consistent branding.
const MOCK_UPLOADERS = {
  riverside: { name: "Riverside Staircases", initials: "RS", avatarColor: "#B78352", role: "Staircase Maker · Manchester" },
  chapel:    { name: "Chapel Timber Works",  initials: "CT", avatarColor: "#6B4423", role: "Joiner · Bristol" },
  ashworth:  { name: "Ashworth Bespoke",     initials: "AB", avatarColor: "#7A4E2C", role: "Bespoke Staircases · Cheshire" },
  coppergate:{ name: "Coppergate Balusters", initials: "CB", avatarColor: "#B8863E", role: "Parts Specialist · York" },
  stepchange:{ name: "StepChange Refacing",  initials: "SC", avatarColor: "#059669", role: "Refacing Service · Leeds" },
} as const;

const MOCK_STAIRS_PRODUCTS: StairsProduct[] = [
  // ─── Staircase ─────────────────────────────────────────────────────
  {
    id: "seed-1",
    category: "staircase",
    name: "Oak Floating Staircase",
    description: "Bespoke floating American oak treads on a hidden steel stringer. 14 rise · 900mm going · brushed steel handrail. Made to survey.",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2004_45_12%20PM.png",
    price: 8950,
    deliveryIncluded: true,
    vatIncluded: true,
    installationIncluded: true,
    uploadedBy: MOCK_UPLOADERS.riverside,
    createdAt: "2026-07-28T10:00:00Z",
  },
  {
    id: "seed-2",
    category: "staircase",
    name: "Walnut Feature Staircase",
    description: "Solid American walnut treads with matching newel + spindles. Deep chocolate-brown finish, hand-sanded to 240 grit, oiled twice.",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2004_53_57%20PM.png",
    price: 12400,
    deliveryIncluded: true,
    vatIncluded: true,
    installationIncluded: true,
    uploadedBy: MOCK_UPLOADERS.riverside,
    createdAt: "2026-07-29T09:00:00Z",
  },
  {
    id: "seed-3",
    category: "staircase",
    name: "Cherry Wood Traditional",
    description: "Federal-period traditional. Solid cherry rises and treads that deepen colour under UV over 12 months — no stain, time does the work.",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2004_55_42%20PM.png",
    price: 9800,
    deliveryIncluded: false,
    vatIncluded: true,
    installationIncluded: false,
    uploadedBy: MOCK_UPLOADERS.chapel,
    createdAt: "2026-07-30T14:00:00Z",
  },
  {
    id: "seed-4",
    category: "staircase",
    name: "Red Deal Pine · Cottage",
    description: "Warm honey-orange knotty pine. Slow-grown Nordic timber, clear-finished. Ideal for cottage extensions and loft conversions.",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2023,%202026,%2004_51_16%20PM.png",
    price: 4650,
    deliveryIncluded: true,
    vatIncluded: true,
    installationIncluded: false,
    uploadedBy: MOCK_UPLOADERS.chapel,
    createdAt: "2026-07-31T11:00:00Z",
  },
  {
    id: "seed-5",
    category: "staircase",
    name: "Grand Entrance Staircase",
    description: "Statement piece. Curved painted stringer, cream carpeted treads, brass-tipped iron balusters. Site survey + measured install included.",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%203,%202026,%2002_59_01%20AM.png",
    price: 18500,
    deliveryIncluded: true,
    vatIncluded: true,
    installationIncluded: true,
    uploadedBy: MOCK_UPLOADERS.ashworth,
    createdAt: "2026-08-01T08:00:00Z",
  },

  // ─── Staircase parts ───────────────────────────────────────────────
  {
    id: "seed-6",
    category: "staircase_parts",
    name: "Turned Oak Newel Post",
    description: "Solid oak, 91mm × 91mm × 1200mm. Classical turned profile. Sanded 240 grit, ready to finish. Sold per newel.",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_09_34%20PM.png",
    price: 145,
    deliveryIncluded: false,
    vatIncluded: true,
    installationIncluded: false,
    uploadedBy: MOCK_UPLOADERS.coppergate,
    createdAt: "2026-07-25T12:00:00Z",
  },
  {
    id: "seed-7",
    category: "staircase_parts",
    name: "Wrought Iron Baluster Set",
    description: "Set of 20 · black powder-coated wrought iron · classical scroll pattern. Fits standard 88mm centres. Brass-tip finials sold separately.",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_19_20%20PM.png",
    price: 380,
    deliveryIncluded: true,
    vatIncluded: true,
    installationIncluded: false,
    uploadedBy: MOCK_UPLOADERS.coppergate,
    createdAt: "2026-07-26T10:00:00Z",
  },
  {
    id: "seed-8",
    category: "staircase_parts",
    name: "Continuous Handrail · Oak",
    description: "3600mm continuous oak handrail, planed all round, ready to bend into curved sections on-site. Matching wall bracket set included.",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_28_10%20PM.png",
    price: 265,
    deliveryIncluded: false,
    vatIncluded: true,
    installationIncluded: false,
    uploadedBy: MOCK_UPLOADERS.coppergate,
    createdAt: "2026-07-27T09:00:00Z",
  },
  {
    id: "seed-9",
    category: "staircase_parts",
    name: "Solid Oak Tread · 40mm",
    description: "1000mm × 300mm × 40mm solid American oak tread. Bullnose profile, sanded, ready for finish. Sold per tread — order to match your rise count.",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_35_02%20PM.png",
    price: 95,
    deliveryIncluded: false,
    vatIncluded: true,
    installationIncluded: false,
    uploadedBy: MOCK_UPLOADERS.coppergate,
    createdAt: "2026-07-28T15:00:00Z",
  },

  // ─── Stairs refacing ───────────────────────────────────────────────
  {
    id: "seed-10",
    category: "stairs_refacing",
    name: "Oak Cladding Refacing Kit",
    description: "Complete kit to reface an existing 14-rise staircase in solid oak — treads, risers, adhesive, jig. Transforms carpeted stairs in a weekend.",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_45_54%20PM.png",
    price: 1850,
    deliveryIncluded: true,
    vatIncluded: true,
    installationIncluded: false,
    uploadedBy: MOCK_UPLOADERS.stepchange,
    createdAt: "2026-07-29T11:00:00Z",
  },
  {
    id: "seed-11",
    category: "stairs_refacing",
    name: "Painted Stringer Refacing",
    description: "In-situ refacing service for painted staircases — sand back, prep, two coats of Farrow & Ball. Two-day job for standard 14-rise flight.",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2003_47_46%20PM.png",
    price: 850,
    deliveryIncluded: true,
    vatIncluded: true,
    installationIncluded: true,
    uploadedBy: MOCK_UPLOADERS.stepchange,
    createdAt: "2026-07-30T13:00:00Z",
  },
];

function loadStairsProducts(): StairsProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STAIRS_STORAGE_PRODUCTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Migrate · fill missing fields on rows written by earlier v1 (Philip 2026-08-03)
    return (parsed as Partial<StairsProduct>[]).map((p) => ({
      id: p.id ?? makeStairsId(),
      category: p.category ?? "staircase",
      name: p.name ?? "",
      description: p.description ?? "",
      imageUrl: p.imageUrl ?? "",
      price: typeof p.price === "number" ? p.price : null,
      deliveryIncluded: Boolean(p.deliveryIncluded),
      vatIncluded: Boolean(p.vatIncluded),
      installationIncluded: Boolean(p.installationIncluded),
      uploadedBy: p.uploadedBy ?? DEFAULT_UPLOADER,
      createdAt: p.createdAt ?? new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

// Compress a picked image to a data URL suitable for localStorage.
// Downscales longest edge to `maxDim` px, encodes JPEG at `quality`.
// Typical output: 150-400KB per photo (vs 3-5MB source). Rejects on
// canvas / decode failure so caller can surface a friendly error.
async function compressImageFile(
  file: File,
  maxDim = 1200,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas 2d unsupported"));
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (e) {
          reject(e instanceof Error ? e : new Error("encode failed"));
        }
      };
      img.onerror = () => reject(new Error("image decode failed"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function saveStairsProducts(products: StairsProduct[]): void {
  try {
    window.localStorage.setItem(STAIRS_STORAGE_PRODUCTS, JSON.stringify(products));
    window.dispatchEvent(new CustomEvent(STAIRS_UPDATED_EVENT));
  } catch {
    /* silent · localStorage blocked */
  }
}

function loadCustomCategories(): { id: string; label: string }[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STAIRS_STORAGE_CATEGORIES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomCategories(cats: { id: string; label: string }[]): void {
  try {
    window.localStorage.setItem(STAIRS_STORAGE_CATEGORIES, JSON.stringify(cats));
  } catch {}
}

function makeStairsId(): string {
  return "sp-" + Math.random().toString(36).slice(2, 10);
}

function slugifyCategory(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// ─── Contacts drawer · mock data (Philip 2026-08-03 v1) ─────────────
//
// Nine clearly-labelled "Preview" contacts so the drawer has real shape
// before the live contact source is wired. Three sections: Active (live
// threads sorted by recency), People (non-professional contacts), Trades
// (professional contacts sourced from the Trade Centre).
//
// Every contact carries `isPreview: true` so the UI can tag them with a
// visible "Preview" chip — no user will mistake these for real merchants
// they can contact (Third Law · Evidence-or-Silence).
type ContactRelationship = "trade" | "person";
type ContactPresence = "online" | "recent" | "away" | "offline";

type MockContact = {
  id: string;
  name: string;             // person name OR company name
  initials: string;
  avatarColor: string;      // solid hex for the initial disc
  avatarUrl?: string;       // optional profile image (falls back to initials disc)
  // Philip 2026-08-03 · card shows three distinct lines instead of one
  // combined `role` string: name → trade-or-subtitle → city.
  trade?: string;           // "Staircase Maker" · only for trade contacts
  subtitle?: string;        // "Friend" · "Family" · "Colleague" · non-trade contacts
  city?: string;            // "Manchester" · "Leeds" · always shown when present
  // Nex Calls · Philip 2026-08-03 · target sessionId used to route the
  // signaling POST. Open a second browser tab at
  //   /nex-app/chat?session=<demoSessionId>
  // and calling this contact from the first tab connects the two.
  demoSessionId?: string;
  // Philip 2026-08-03 · Living Profile fields · surfaced by the 2-second
  // avatar long-press. Every field is optional — the sheet renders only
  // rows that carry real data (Third Law · no fake data).
  country?: string;         // "United Kingdom" · "Ireland"
  joinedAt?: string;        // ISO date — "2024-11-04"
  nexVerified?: boolean;    // certified Nex member badge
  websiteUrl?: string;      // "https://riversidestaircases.co.uk"
  socials?: {
    instagram?: string;     // username without @ or full URL
    facebook?: string;
    tiktok?: string;
    linkedin?: string;
    x?: string;             // twitter/x handle
  };
  lastMessage?: string;     // only present when there's an active thread
  timeAgo?: string;         // "2m" · "1h" · "Yesterday" · time since last message
  relationship: ContactRelationship;
  active: boolean;          // has recent activity (surfaces in Active section)
  unread?: number;          // optional unread count
  presence: ContactPresence; // presence dot on avatar
  lastSeen: string;         // human-readable "Online now" · "Last seen 3h ago"
};

// ─── Nex ID + Invites · Philip 2026-08-03 ──────────────────────────
//
// Every Nex user has a `@handle` id. Users add contacts by entering
// another user's id + tapping Connect. That creates a SentInvite that
// lives for 5 working days · shown in the Contacts drawer with an
// amber "Waiting" chip · auto-expires when the drawer opens.
//
// v1 is localStorage-single-device. Real cross-user delivery lands
// with a backend. To show the receiving-side flow, sending an invite
// injects a demo InvitationCard from a mock sender into the chat so
// Philip can test Accept/Decline without a partner device.
type SentInvite = {
  id: string;               // "inv-" + random
  targetNexId: string;      // "@sarah.chen"
  sentAt: string;           // ISO timestamp
  status: "pending" | "accepted" | "declined" | "expired";
};

const NEX_ID_STORAGE_MINE = "nex.id.mine";
const NEX_ID_STORAGE_INVITES = "nex.contacts.invites.sent";
const NEX_ID_MAX_WORKING_DAYS = 5;

// Generate/load the user's own Nex handle. Format: @nex_XXXXXX (6 chars).
// Real auth replaces this with the user's chosen handle later.
function loadOrCreateMyNexId(): string {
  if (typeof window === "undefined") return "@nex_pending";
  try {
    const stored = window.localStorage.getItem(NEX_ID_STORAGE_MINE);
    if (stored && /^@[a-z0-9_.]+$/i.test(stored)) return stored;
    const rand = Math.random().toString(36).slice(2, 8);
    const handle = `@nex_${rand}`;
    window.localStorage.setItem(NEX_ID_STORAGE_MINE, handle);
    return handle;
  } catch {
    return "@nex_pending";
  }
}

function loadSentInvites(): SentInvite[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NEX_ID_STORAGE_INVITES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SentInvite[]) : [];
  } catch {
    return [];
  }
}

function saveSentInvites(invites: SentInvite[]): void {
  try {
    window.localStorage.setItem(NEX_ID_STORAGE_INVITES, JSON.stringify(invites));
    window.dispatchEvent(new CustomEvent("nex-invites-updated"));
  } catch {}
}

// Count working days (Mon-Fri) elapsed since `iso`. Weekends skipped.
function workingDaysSince(iso: string): number {
  const start = new Date(iso);
  const now = new Date();
  if (Number.isNaN(start.getTime())) return 0;
  let count = 0;
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + 1);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function normalizeNexId(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  const withAt = trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
  return /^@[a-z0-9_.]{2,32}$/.test(withAt) ? withAt : null;
}

// Pravatar helper · Philip 2026-08-03 · deterministic-by-seed REAL face
// photos (free CC0 headshots). Used for both people AND trades (trade
// avatar = owner's face). Replaced by user-uploaded avatars once auth
// ships. Same URL for the same seed = same face every render.
const face = (seed: string) =>
  `https://i.pravatar.cc/200?u=${encodeURIComponent(seed)}`;

const MOCK_CONTACTS: MockContact[] = [
  // Active · mixed types, sorted by recency
  {
    id: "c1",
    name: "Riverside Staircases",
    initials: "RS",
    avatarColor: "#B78352",
    avatarUrl: face("Riverside Staircases"),
    trade: "Staircase Maker",
    city: "Manchester",
    country: "United Kingdom",
    joinedAt: "2024-11-04",
    nexVerified: true,
    websiteUrl: "https://riversidestaircases.co.uk",
    demoSessionId: "riverside-demo",
    socials: {
      instagram: "riversidestaircases",
      facebook: "riversidestaircases",
      tiktok: "riversidestaircases",
    },
    lastMessage: "The oak sample arrived this morning — should I bring it Friday?",
    timeAgo: "2m",
    relationship: "trade",
    active: true,
    unread: 1,
    presence: "online",
    lastSeen: "Online now",
  },
  {
    id: "c2",
    name: "Sarah Chen",
    initials: "SC",
    avatarColor: "#EC4899",
    avatarUrl: face("Sarah Chen"),
    subtitle: "Friend",
    city: "London",
    country: "United Kingdom",
    joinedAt: "2025-03-18",
    socials: {
      instagram: "sarahchen",
      linkedin: "sarah-chen-design",
    },
    lastMessage: "Sending you the fabric swatches now",
    timeAgo: "18m",
    relationship: "person",
    active: true,
    presence: "online",
    lastSeen: "Online now",
  },
  {
    id: "c3",
    name: "Ashworth Kitchens",
    initials: "AK",
    avatarColor: "#7A4E2C",
    avatarUrl: face("Ashworth Kitchens"),
    trade: "Kitchen Fitter",
    city: "Cheshire",
    country: "United Kingdom",
    joinedAt: "2025-01-22",
    nexVerified: true,
    websiteUrl: "https://ashworthkitchens.co.uk",
    lastMessage: "Quote attached — let me know what you think",
    timeAgo: "1h",
    relationship: "trade",
    active: true,
    unread: 2,
    presence: "offline",
    lastSeen: "Last seen 1h ago",
  },
  // People · non-professional
  {
    id: "c4",
    name: "Emma Whitmore",
    initials: "EW",
    avatarColor: "#7C3AED",
    avatarUrl: face("Emma Whitmore"),
    subtitle: "Family",
    city: "Bristol",
    relationship: "person",
    active: false,
    presence: "offline",
    lastSeen: "Last seen 4h ago",
  },
  {
    id: "c5",
    name: "James Okafor",
    initials: "JO",
    avatarColor: "#059669",
    avatarUrl: face("James Okafor"),
    subtitle: "Colleague",
    city: "London",
    relationship: "person",
    active: false,
    presence: "offline",
    lastSeen: "Last seen yesterday",
  },
  {
    id: "c6",
    name: "Alex Byrne",
    initials: "AB",
    avatarColor: "#0891B2",
    avatarUrl: face("Alex Byrne"),
    subtitle: "Friend",
    city: "Edinburgh",
    relationship: "person",
    active: false,
    presence: "offline",
    lastSeen: "Last seen 2 days ago",
  },
  // Trades · professional
  {
    id: "c7",
    name: "North Timber & Oak",
    initials: "NT",
    avatarColor: "#78350F",
    avatarUrl: face("North Timber"),
    trade: "Timber Merchant",
    city: "Leeds",
    relationship: "trade",
    active: false,
    presence: "offline",
    lastSeen: "Last seen 5 days ago",
  },
  {
    id: "c8",
    name: "MacDonald Plumbing",
    initials: "MP",
    avatarColor: "#1E40AF",
    avatarUrl: face("MacDonald Plumbing"),
    trade: "Plumber",
    city: "Glasgow",
    relationship: "trade",
    active: false,
    presence: "offline",
    lastSeen: "Last seen 2 weeks ago",
  },
  {
    id: "c9",
    name: "Redfern Electrics",
    initials: "RE",
    avatarColor: "#B91C1C",
    avatarUrl: face("Redfern Electrics"),
    trade: "Electrician",
    city: "Birmingham",
    relationship: "trade",
    active: false,
    presence: "offline",
    lastSeen: "Last seen 3 weeks ago",
  },
];

// Sender identity attached to a message · Philip 2026-08-03.
// Group-ready: adding a new participant in a chat needs no code changes,
// only a new MessageSender instance passed on the message.
type MessageSender = {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  role?: string;
};

// Default senders for 1:1 chat with Nex. `role` (user/nex) still drives
// left/right positioning · sender drives the header content.
const NEX_SENDER: MessageSender = {
  id: "nex",
  name: "Nex",
  initials: "N",
  avatarColor: "#F97316", // Nex orange · re-tinted per theme via override
};
const YOU_SENDER: MessageSender = {
  id: "you",
  name: "You",
  initials: "You",
  avatarColor: "#7A4E2C",
};

type Message = {
  id: string;
  role: "user" | "nex";
  text: string;
  sender?: MessageSender; // if missing, derived from role
  suggestions?: Suggestion[];
  card?: CardData;
  cardDismissed?: boolean;
  // Philip 2026-08-03 · card state overlay. When set, the client renders
  // the card in an evolved state (e.g. Meeting card "saved · waiting for
  // calendar") instead of the default one. This is the first step toward
  // living cards.
  cardState?: "prepared_waiting";
  // Pin/save state · rim-highlights the bubble in the theme accent.
  // Session-only for v1; persistent saved-messages view lands later.
  pinned?: boolean;
  // Reactions · Philip 2026-08-03. Emojis you've reacted with (one-per-
  // emoji, toggle on/off). Session-only for v1. Long-press the bubble
  // to open the picker; tap a chip to remove that reaction.
  reactions?: string[];
  // Voice message · Philip 2026-08-03. Object-URL blob captured via
  // MediaRecorder in the composer. Session-only (blob URLs die on page
  // reload); real upload lands with the backend.
  audio?: {
    url: string;
    durationMs: number;
  };
  // Quote-reply · Philip 2026-08-03. When set, this message is a reply
  // to the referenced one. Rendered as a small quoted preview at the
  // top of the bubble so the recipient sees what's being replied to.
  replyTo?: {
    messageId: string;
    snippet: string;     // truncated preview of the original text
    senderName: string;
  };
  // Attachment · Philip 2026-08-03. Camera photo or arbitrary file
  // dropped in from the composer. Session-only object-URL (dies on
  // reload); real upload lands with the backend.
  attachment?: {
    kind: "image" | "file";
    url: string;
    name: string;
    sizeBytes: number;
    mimeType: string;
  };
};

// ─── Tasks · Philip 2026-08-03 · First Law commitment objects ─────────
//
// Rename of the old "Continue" footer button. Every task is a first-
// class commitment — visible, editable, persistent, remindable. Backed
// by localStorage so tasks survive a page reload (First Law: commitments
// never disappear silently). Reminder firing scans every 30s and pops
// (1) a browser notification (with permission) and (2) a Nex chat
// message so the reminder is captured wherever the user is looking.

type NexTaskReminder = "off" | "day_before" | "same_day";

// Philip 2026-08-03 · unified NexTask · every commitment in Nex — however
// it was created — is one of these. The `source` field records where it
// came from so surfaces can badge it appropriately + a future analytics
// view can slice by origin. `metadata` is an opaque per-source bag so
// new sources don't require type-level changes.
type NexTaskSource =
  | "manual"    // user typed it in the Tasks sheet
  | "chat"      // Nex extracted from a chat message (regex/AI)
  | "call"      // extracted from a call summary
  | "meeting"   // scheduled via a Meeting card
  | "project"   // project stage progress
  | "quote"     // quote follow-up
  | "nex";      // Nex-authored (e.g. onboarding suggestion)

const TASK_SOURCE_BADGE: Record<NexTaskSource, { emoji: string; label: string }> = {
  manual:  { emoji: "✍️", label: "Manual" },
  chat:    { emoji: "💬", label: "From chat" },
  call:    { emoji: "📞", label: "From call" },
  meeting: { emoji: "📅", label: "From meeting" },
  project: { emoji: "📂", label: "From project" },
  quote:   { emoji: "📄", label: "From quote" },
  nex:     { emoji: "🤖", label: "Created by Nex" },
};

// Task history · Philip 2026-08-03. Every commitment gets a running
// audit log — created, edited, reminders fired, completed, referenced
// by other Nex objects (later). Answers the "you never said you would"
// argument with a real timeline. Append-only.
type TaskEventKind =
  | "created"
  | "edited"
  | "due_changed"
  | "reminder_changed"
  | "title_changed"
  | "description_changed"
  | "notified"
  | "completed"
  | "reopened"
  | "referenced";

type TaskEventActor = "user" | "nex" | "system";

type TaskEvent = {
  at: string;                   // ISO
  kind: TaskEventKind;
  by?: TaskEventActor;
  detail?: string;              // human-readable · e.g. "Due changed to Fri 10:00"
};

type NexTask = {
  id: string;
  title: string;
  description?: string;
  dueAt: string;                // ISO date+time · "2026-08-04T14:30"
  reminder: NexTaskReminder;
  source: NexTaskSource;        // Philip 2026-08-03 · required on every task
  createdAt: string;            // ISO
  notifiedAt?: string;          // ISO · set when the reminder has fired · never double-fire
  doneAt?: string;              // ISO · marked complete
  // Internal only — used by the auto-extract engine to filter out
  // low-confidence guesses before proposing them. Not rendered in UI yet.
  confidenceScore?: number;     // 0..1
  // Opaque per-source bag · e.g. { callId, contactId } for source:"call".
  // Kept loose so evolving a source doesn't force a type migration.
  metadata?: Record<string, unknown>;
  // Append-only audit log · every mutation writes an event so the task
  // carries its own history everywhere it goes.
  history?: TaskEvent[];
};

// Helper · creates a TaskEvent with the current timestamp.
function taskEvent(
  kind: TaskEventKind,
  opts: { by?: TaskEventActor; detail?: string } = {},
): TaskEvent {
  return {
    at: new Date().toISOString(),
    kind,
    ...(opts.by ? { by: opts.by } : {}),
    ...(opts.detail ? { detail: opts.detail } : {}),
  };
}

// Actor label for the source · used when logging the initial "created"
// event so the history reads correctly per origin.
function actorForSource(source: NexTaskSource): TaskEventActor {
  return source === "manual" ? "user" : source === "nex" ? "nex" : "system";
}

// Human labels + emoji for timeline rendering.
const TASK_EVENT_LABEL: Record<TaskEventKind, { emoji: string; label: string }> = {
  created:              { emoji: "✨", label: "Created" },
  edited:               { emoji: "✏️", label: "Edited" },
  due_changed:          { emoji: "📅", label: "Due date changed" },
  reminder_changed:     { emoji: "🔔", label: "Reminder changed" },
  title_changed:        { emoji: "📝", label: "Title changed" },
  description_changed:  { emoji: "📝", label: "Description changed" },
  notified:             { emoji: "⏰", label: "Reminder fired" },
  completed:            { emoji: "✅", label: "Completed" },
  reopened:             { emoji: "↩️", label: "Reopened" },
  referenced:           { emoji: "🔗", label: "Referenced" },
};

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const NEX_TASKS_STORAGE = "nex.tasks.v1";

function loadTasks(): NexTask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NEX_TASKS_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Backfill · older tasks (pre-source field) default to "manual", and
    // pre-history tasks get a single synthesized "created" event using
    // their createdAt so every task carries at least one timeline row.
    return (parsed as NexTask[]).map((t) => {
      const source: NexTaskSource = (t.source as NexTaskSource) ?? "manual";
      const history: TaskEvent[] =
        Array.isArray(t.history) && t.history.length > 0
          ? t.history
          : [
              {
                at: t.createdAt ?? new Date().toISOString(),
                kind: "created",
                by: actorForSource(source),
                detail: `Created (${source})`,
              },
            ];
      return { ...t, source, history };
    });
  } catch {
    return [];
  }
}

function saveTasks(tasks: NexTask[]): void {
  try {
    window.localStorage.setItem(NEX_TASKS_STORAGE, JSON.stringify(tasks));
  } catch {}
}

// When should the reminder for this task fire?
//   same_day  → 5 minutes before due · lets the user actually see the demo
//   day_before → 24 hours before due
//   off       → never
function reminderFireTime(task: NexTask): number | null {
  if (task.reminder === "off") return null;
  const due = new Date(task.dueAt).getTime();
  if (isNaN(due)) return null;
  if (task.reminder === "same_day") return due - 5 * 60 * 1000;
  return due - 24 * 60 * 60 * 1000;
}

// Briefing view helpers · Philip 2026-08-03. Pure functions that filter
// the live task list into the three briefing lanes. The card is a VIEW
// of NexTask — never a separate persisted object — so these helpers run
// at render time and always reflect the latest edits.
function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function taskDueDate(t: NexTask): Date | null {
  const d = new Date(t.dueAt);
  return isNaN(d.getTime()) ? null : d;
}
function tasksDueToday(tasks: NexTask[]): NexTask[] {
  const now = new Date();
  return tasks.filter((t) => {
    if (t.doneAt) return false;
    const d = taskDueDate(t);
    return d ? isSameLocalDay(d, now) && d.getTime() >= now.getTime() - 60_000 : false;
  });
}
function tasksOverdue(tasks: NexTask[]): NexTask[] {
  const now = Date.now();
  return tasks.filter((t) => {
    if (t.doneAt) return false;
    const d = taskDueDate(t);
    return d ? d.getTime() < now && !isSameLocalDay(d, new Date()) : false;
  });
}
function tasksDueTomorrow(tasks: NexTask[]): NexTask[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tasks.filter((t) => {
    if (t.doneAt) return false;
    const d = taskDueDate(t);
    return d ? isSameLocalDay(d, tomorrow) : false;
  });
}
function tasksCompletedToday(tasks: NexTask[]): NexTask[] {
  const now = new Date();
  return tasks.filter((t) => {
    if (!t.doneAt) return false;
    const d = new Date(t.doneAt);
    return isSameLocalDay(d, now);
  });
}

function formatDueLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const timeStr = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (sameDay) return `Today · ${timeStr}`;
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  ) {
    return `Tomorrow · ${timeStr}`;
  }
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${timeStr}`;
}

// ─── Commitment Engine · Philip 2026-08-03 ────────────────────────────
//
// Detects promises in outgoing user messages and proposes a NexTask via
// a confirmation card (never silent create). Regex-first (fast, offline,
// free); the same detector interface will be swapped for an LLM later
// without touching any UI code.
//
// Threshold rule (per Philip):
//   ≥ 0.70 → propose (confirmation UI)
//   < 0.70 → silent · don't interrupt

type CommitmentSuggestion = {
  title: string;
  dueAt: string;                 // ISO — best-guess default when no time expression is found
  reminder: NexTaskReminder;
  confidence: number;
  originalText: string;
};

const DOW_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

// Return the next date at 09:00 for a given weekday name (case-insensitive).
// If `strictNext` is true and today matches the weekday, we push to next week.
function nextWeekdayAt9(name: string, strictNext = false): Date | null {
  const idx = DOW_INDEX[name.toLowerCase()];
  if (idx === undefined) return null;
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  const delta = (idx - d.getDay() + 7) % 7;
  const bump = delta === 0 && strictNext ? 7 : delta;
  d.setDate(d.getDate() + bump);
  return d;
}

// Parse a small vocabulary of time expressions. Returns null when
// nothing matches. Kept tight — real datetime NLP is the LLM's job.
function parseCommitmentTime(text: string): Date | null {
  const t = text.toLowerCase();
  const now = new Date();

  // "in N minutes/hours/days/weeks"
  const rel = t.match(/\bin\s+(\d+)\s+(minute|hour|day|week)s?\b/);
  if (rel) {
    const n = parseInt(rel[1], 10);
    const unit = rel[2];
    const d = new Date(now);
    if (unit === "minute") d.setMinutes(d.getMinutes() + n);
    else if (unit === "hour") d.setHours(d.getHours() + n);
    else if (unit === "day") d.setDate(d.getDate() + n);
    else if (unit === "week") d.setDate(d.getDate() + n * 7);
    return d;
  }

  // "tonight" → today 18:00
  if (/\btonight\b/.test(t)) {
    const d = new Date(now); d.setHours(18, 0, 0, 0); return d;
  }
  // "tomorrow" → tomorrow 09:00
  if (/\btomorrow\b/.test(t)) {
    const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d;
  }
  // "today" → today +2h (or 09:00 if that's already past 9)
  if (/\btoday\b/.test(t)) {
    const d = new Date(now); d.setHours(d.getHours() + 2, 0, 0, 0); return d;
  }
  // "next week" → next monday 09:00
  if (/\bnext\s+week\b/.test(t)) return nextWeekdayAt9("monday", true);

  // "next monday", "on friday", "by wednesday", "friday", "by end of the week"
  const weekdayMatch = t.match(
    /\b(?:next\s+|on\s+|by\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  );
  if (weekdayMatch) return nextWeekdayAt9(weekdayMatch[1], /\bnext\s+/.test(t));

  if (/\bby\s+end\s+of\s+(the\s+)?week\b/.test(t)) return nextWeekdayAt9("friday");
  if (/\bby\s+end\s+of\s+(the\s+)?month\b/.test(t)) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0, 17, 0, 0, 0);
    return d;
  }

  // "at 3pm" / "at 15:00"
  const timeMatch = t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const suffix = timeMatch[3];
    if (suffix === "pm" && hour < 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;
    const d = new Date(now); d.setHours(hour, minute, 0, 0);
    if (d.getTime() < now.getTime()) d.setDate(d.getDate() + 1);
    return d;
  }
  return null;
}

// Format a Date into the ISO local shape our task form uses (YYYY-MM-DDTHH:MM).
function toLocalIsoMinute(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Strip trigger + tail time phrase from the sentence to leave a clean
// task title. Rough but works for common shapes.
function cleanCommitmentTitle(raw: string): string {
  let s = raw.trim();
  // Drop leading triggers.
  s = s.replace(
    /^(remind me to |remind me about |remind me |don'?t forget to |don'?t forget |i'?ll |i will |i'?m going to |i'?m gonna |we'?ll |we will |we'?re going to |let'?s |let me )/i,
    "",
  );
  // Drop trailing time phrases so "send quote friday at 3pm" → "send quote".
  s = s.replace(
    /\s+(?:by\s+end\s+of\s+(?:the\s+)?(?:week|month)|in\s+\d+\s+(?:minute|hour|day|week)s?|(?:next\s+|on\s+|by\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|tomorrow|tonight|today|next\s+week|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b.*$/i,
    "",
  );
  s = s.replace(/[.,!?]+$/, "").trim();
  // Sentence-case the first letter for a task-list feel.
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

function detectCommitment(text: string): CommitmentSuggestion | null {
  const raw = text.trim();
  if (raw.length < 4) return null;
  const lower = raw.toLowerCase();

  // Hard veto · questions and hedged phrasing don't create commitments.
  if (raw.endsWith("?")) return null;
  if (/\b(maybe|might|possibly|probably|not sure|perhaps|could|thinking about)\b/.test(lower)) return null;

  // Trigger patterns · order matters (most specific first).
  const patterns: Array<{ re: RegExp; base: number }> = [
    { re: /^remind me (?:to |about )?/i,              base: 0.95 },
    { re: /^don'?t forget (?:to )?/i,                 base: 0.92 },
    { re: /^(?:i'?ll|i will|i'?m going to|i'?m gonna)\s+/i, base: 0.88 },
    { re: /^(?:we'?ll|we will|we'?re going to)\s+/i,  base: 0.85 },
    { re: /^(?:let'?s|let me)\s+/i,                   base: 0.78 },
    // Imperative openers common in trade chat.
    { re: /^(?:call|send|order|email|book|confirm|pick up|drop off|visit|meet|quote|follow up|chase|review|check)\b/i, base: 0.75 },
  ];

  const matched = patterns.find((p) => p.re.test(raw));
  if (!matched) return null;

  // Time signal boosts confidence slightly.
  const when = parseCommitmentTime(lower);
  const confidence = Math.min(0.99, matched.base + (when ? 0.05 : 0));
  if (confidence < 0.70) return null;

  const title = cleanCommitmentTitle(raw) || "Follow up";
  // Default: tomorrow 09:00 when no time is present.
  const due = when ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  })();

  // Reminder pick · "by X" phrasing suggests a deadline → day_before feels right.
  const byDeadline = /\bby\s+/i.test(raw);
  const reminder: NexTaskReminder = byDeadline ? "day_before" : "same_day";

  return {
    title,
    dueAt: toLocalIsoMinute(due),
    reminder,
    confidence,
    originalText: raw,
  };
}

// Promise-accepted detector · Philip 2026-08-03. Catches the pattern
// where the OTHER party asked for a commitment ("Can you send the quote
// Friday?") and the user agreed with a short reply ("Yes" · "Sure" ·
// "Will do"). Extracts the task from the QUESTION, not the reply.
// This is the case regex-only detection on outgoing text misses, and
// it's a huge share of real trade conversations.
const AFFIRMATIVE_REPLY_REGEX =
  /^(y+e+s+|yeah|yep|yup|sure|ok|okay|will do|no problem|of course|sounds good|sounds great|absolutely|confirmed|deal|done|got it|copy that|yes please|for sure)[.! ]*$/i;

// Request patterns extracted from the prior message.
const REQUEST_LEAD_REGEX = new RegExp(
  "\\b(?:can|could|would|will|are you able to|is (?:it possible|there any chance)|would (?:you|it be possible) to)\\s+(?:you\\s+)?(.+?)\\??$",
  "i",
);

function detectAcceptedCommitment(
  userText: string,
  priorText: string | null,
): CommitmentSuggestion | null {
  if (!priorText) return null;
  const reply = userText.trim();
  // The reply must be a short, unambiguous affirmative. If the user
  // said "yes and also X" we let the outgoing-text detector handle X.
  if (!AFFIRMATIVE_REPLY_REGEX.test(reply)) return null;
  const prior = priorText.trim();
  // Prior must look like a request: pattern match OR ends with "?".
  const match = prior.match(REQUEST_LEAD_REGEX);
  const looksLikeRequest = match || prior.endsWith("?");
  if (!looksLikeRequest) return null;

  // Extract the requested action. Prefer the regex capture; fall back to
  // stripping the leading "Can you..." then the trailing "?".
  let requested = match ? match[1] : prior.replace(/\?+$/, "").trim();
  requested = requested
    .replace(/^(please\s+)/i, "")
    .replace(/[.,!?]+$/, "")
    .trim();
  if (requested.length < 3) return null;

  // Sentence-case + rebuild as a proper commitment.
  const titleRaw = requested[0].toUpperCase() + requested.slice(1);
  const title = cleanCommitmentTitle(titleRaw) || titleRaw;
  const when = parseCommitmentTime(prior.toLowerCase());
  const due = when ?? (() => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d;
  })();
  // Slightly lower base confidence than a first-person "I'll…" because
  // acceptance detection is inherently softer than an outgoing promise.
  const confidence = when ? 0.88 : 0.82;
  return {
    title,
    dueAt: toLocalIsoMinute(due),
    reminder: when ? "day_before" : "same_day",
    confidence,
    originalText: `Q: "${prior}" · You: "${reply}"`,
  };
}

// Multi-commitment detector · handles conversational one-shots like
// "I'll visit Riverside Friday, send the quote Monday and order the oak
// tomorrow" by extracting the leading trigger ("I'll") and applying it
// to each clause. Falls back to single-detect when no leading trigger
// or only one clause is present. LLM upgrade later is a drop-in swap.
const LEADING_TRIGGER_REGEX = new RegExp(
  "^(remind me (?:to |about )?|don'?t forget (?:to )?|i'?ll |i will |i'?m going to |i'?m gonna |we'?ll |we will |we'?re going to |let'?s |let me )(.+)$",
  "i",
);

function detectCommitments(text: string): CommitmentSuggestion[] {
  const raw = text.trim();
  if (raw.length < 4) return [];
  const lead = raw.match(LEADING_TRIGGER_REGEX);
  if (lead) {
    const [, trigger, body] = lead;
    const clauses = body
      .split(/,\s*|\s+and\s+|;\s*/i)
      .map((c) => c.trim())
      .filter(Boolean);
    if (clauses.length > 1) {
      const found: CommitmentSuggestion[] = [];
      for (const c of clauses) {
        const s = detectCommitment(trigger + c);
        if (s) found.push(s);
      }
      if (found.length > 0) return found;
    }
  }
  const single = detectCommitment(raw);
  return single ? [single] : [];
}

// Human-readable file size · used on file-attachment cards.
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// The picker offers a compact, curated set — the six reactions common
// to iMessage/WhatsApp/Discord. Additional emojis land later behind a
// "more" button (deferred until real usage tells us we need more).
const REACTION_EMOJIS: readonly string[] = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

// Quote-reply helper · derives a short, safe preview of the message
// being replied to. Voice messages get a fixed label since there's no
// text to quote. Truncates long text at 90 chars with an ellipsis.
function quoteSnippet(m: Message): string {
  if (m.audio) return "🎤 Voice message";
  const text = (m.text ?? "").trim();
  if (!text) return "…";
  if (text.length <= 90) return text;
  return text.slice(0, 87).trimEnd() + "…";
}

// Voice message helpers · Philip 2026-08-03.
function formatRecordTime(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
// Deterministic per-message waveform · derives 24 bar heights (12-100%)
// from the message id so bars stay visually stable across re-renders.
// Not a real amplitude analysis — that's a future upgrade if wanted.
function waveformBars(seed: string, count = 24): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const norm = (h >>> 8) / 0xffffff;
    bars.push(12 + norm * 88);
  }
  return bars;
}

function resolveSender(m: Message): MessageSender {
  return m.sender ?? (m.role === "user" ? YOU_SENDER : NEX_SENDER);
}

function isSameSender(a: Message | undefined, b: Message | undefined): boolean {
  if (!a || !b) return false;
  return resolveSender(a).id === resolveSender(b).id;
}

function newId(): string {
  return "m-" + Math.random().toString(36).slice(2, 10);
}

// Fonts for the Blossom theme (Philip 2026-08-03 · Theme Engine test).
// Loaded via next/font/google so they're preloaded and CSP-safe. Fredoka
// for headings · Nunito for body. Both are used ONLY when the theme
// class is present · other themes will bring their own font pair.
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--nex-font-heading",
  display: "swap",
});
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--nex-font-body",
  display: "swap",
});
// Grand Entrance typography · Philip 2026-08-03 upgrade. Fraunces =
// display serif with optical-size axis · reads as bespoke jewelry at
// header sizes. Manrope = clean geometric sans for body copy · beautiful
// at chat sizes. Scoped to `.nex-theme-staircase-light-cream` only.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--nex-font-luxury-heading",
  display: "swap",
});
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--nex-font-luxury-body",
  display: "swap",
});

// Invisible scrollbar utility · Philip 2026-08-03. Kills the OS
// scrollbar chrome on every scroll container inside the chat surface
// (main stream, drawers, sheets, upload form). Scroll STILL works —
// only the bar is hidden. Applied via the `nex-hide-scroll` class.
const HIDE_SCROLLBAR_CSS = `
.nex-hide-scroll::-webkit-scrollbar,
.nex-hide-scroll *::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}
.nex-hide-scroll,
.nex-hide-scroll * {
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}
`;

// Contacts drawer DARK theme · Philip 2026-08-03. Overrides every
// theme scope so the Contacts drawer is universally black-glass —
// matches Instagram DM / Discord / Signal contacts aesthetic. Uses
// !important because it INTENTIONALLY beats theme-scope overrides.
// Heartbeat keyframe = green online dot pulse (with halo ring).
const DARK_DRAWER_CSS = `
aside.nex-drawer-dark {
  background: linear-gradient(180deg, #0B0C10 0%, #05060A 100%) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: rgba(255, 255, 255, 0.92) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.10),
    inset 0 -1px 0 rgba(255, 255, 255, 0.03),
    -12px 0 40px rgba(0, 0, 0, 0.65) !important;
}
aside.nex-drawer-dark header {
  background-color: rgba(255, 255, 255, 0.04) !important;
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: rgba(255, 255, 255, 0.95) !important;
}
aside.nex-drawer-dark header .text-black,
aside.nex-drawer-dark header .text-black\\/60,
aside.nex-drawer-dark header .text-black\\/70,
aside.nex-drawer-dark header .text-black\\/80 {
  color: rgba(255, 255, 255, 0.95) !important;
}
aside.nex-drawer-dark header button {
  color: rgba(255, 255, 255, 0.70) !important;
}
aside.nex-drawer-dark header button:hover {
  background-color: rgba(255, 255, 255, 0.08) !important;
  color: white !important;
}
/* Cards · dark glass with subtle white rim */
aside.nex-drawer-dark .rounded-2xl {
  background-color: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.09) !important;
  color: rgba(255, 255, 255, 0.92) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.10),
    inset 0 -1px 0 rgba(255, 255, 255, 0.03),
    0 1px 2px rgba(0, 0, 0, 0.30) !important;
}
aside.nex-drawer-dark .rounded-2xl:hover {
  background-color: rgba(255, 255, 255, 0.07) !important;
  border-color: rgba(255, 255, 255, 0.16) !important;
}
/* Contact cards · BLACK FROSTED GLASS matching the assistant chat
   bubbles (Philip 2026-08-03 · was charcoal gradient). Same design
   language across bubbles + contact cards so the drawer feels like
   an extension of the chat. Brass hairline kept as the walnut edge. */
aside.nex-drawer-dark .nex-contact-card {
  background: rgba(0, 0, 0, 0.55) !important;
  backdrop-filter: blur(24px) saturate(150%);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  border: 1px solid rgba(232, 223, 200, 0.22) !important;
  color: rgba(255, 245, 225, 0.95) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 245, 225, 0.15),
    inset 0 -1px 0 rgba(184, 134, 62, 0.30),
    0 1px 2px rgba(0, 0, 0, 0.40),
    0 8px 24px rgba(0, 0, 0, 0.35) !important;
}
aside.nex-drawer-dark .nex-contact-card:hover {
  background: rgba(0, 0, 0, 0.68) !important;
  border-color: rgba(232, 201, 148, 0.35) !important;
}
/* Sent-invite waiting card · RED FROSTED GLASS (Philip 2026-08-03).
   Same design language as the black-glass contact cards, but tinted
   red so a pending invite reads as "attention needed" at a glance.
   Universal across themes since it lives inside .nex-drawer-dark. */
aside.nex-drawer-dark .nex-invite-waiting {
  background: rgba(220, 38, 38, 0.32) !important;
  backdrop-filter: blur(24px) saturate(150%);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  border: 1px solid rgba(252, 165, 165, 0.35) !important;
  color: rgba(255, 245, 245, 0.95) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.15),
    inset 0 -1px 0 rgba(0, 0, 0, 0.30),
    0 1px 2px rgba(0, 0, 0, 0.40),
    0 8px 24px rgba(0, 0, 0, 0.35) !important;
}
/* Text on brown cards · cream instead of grey */
aside.nex-drawer-dark .nex-contact-card .text-black {
  color: rgba(255, 245, 225, 0.96) !important;
}
aside.nex-drawer-dark .nex-contact-card .text-black\\/55,
aside.nex-drawer-dark .nex-contact-card .text-black\\/50,
aside.nex-drawer-dark .nex-contact-card .text-black\\/25 {
  color: rgba(255, 245, 225, 0.65) !important;
}
/* Cards with input · dashed dark border for the Add contact form + preview footer */
aside.nex-drawer-dark .border-dashed {
  border-color: rgba(255, 255, 255, 0.18) !important;
  background-color: rgba(255, 255, 255, 0.03) !important;
  color: rgba(255, 255, 255, 0.85) !important;
}
/* Text colors inside dark drawer */
aside.nex-drawer-dark .text-black { color: rgba(255, 255, 255, 0.92) !important; }
aside.nex-drawer-dark .text-black\\/85,
aside.nex-drawer-dark .text-black\\/80,
aside.nex-drawer-dark .text-black\\/75,
aside.nex-drawer-dark .text-black\\/70,
aside.nex-drawer-dark .text-black\\/65 { color: rgba(255, 255, 255, 0.88) !important; }
aside.nex-drawer-dark .text-black\\/60,
aside.nex-drawer-dark .text-black\\/55 { color: rgba(255, 255, 255, 0.60) !important; }
aside.nex-drawer-dark .text-black\\/50,
aside.nex-drawer-dark .text-black\\/45,
aside.nex-drawer-dark .text-black\\/40,
aside.nex-drawer-dark .text-black\\/35 { color: rgba(255, 255, 255, 0.45) !important; }
aside.nex-drawer-dark .text-black\\/30,
aside.nex-drawer-dark .text-black\\/25 { color: rgba(255, 255, 255, 0.32) !important; }
/* Preview / neutral chips inside cards */
aside.nex-drawer-dark .bg-neutral-100,
aside.nex-drawer-dark .bg-neutral-50\\/60 {
  background-color: rgba(255, 255, 255, 0.07) !important;
  border-color: rgba(255, 255, 255, 0.14) !important;
  color: rgba(255, 255, 255, 0.75) !important;
}
/* Add-contact expanded state · orange dashed → gold dashed on dark */
aside.nex-drawer-dark .border-orange-300 {
  border-color: rgba(214, 181, 138, 0.55) !important;
}
aside.nex-drawer-dark .bg-orange-50 {
  background-color: rgba(214, 181, 138, 0.10) !important;
}
aside.nex-drawer-dark .bg-orange-50\\/50 {
  background-color: rgba(214, 181, 138, 0.08) !important;
}
aside.nex-drawer-dark .text-orange-800 {
  color: #E8C994 !important;
}
/* Inputs · dark glass */
aside.nex-drawer-dark input {
  background-color: rgba(255, 255, 255, 0.06) !important;
  border-color: rgba(255, 255, 255, 0.14) !important;
  color: rgba(255, 255, 255, 0.95) !important;
}
aside.nex-drawer-dark input::placeholder {
  color: rgba(255, 255, 255, 0.35) !important;
}
aside.nex-drawer-dark input:focus {
  border-color: rgba(232, 201, 148, 0.55) !important;
}
/* Sent-invites amber cards stay amber but adapt for the dark backdrop */
aside.nex-drawer-dark .bg-amber-50 {
  background-color: rgba(251, 191, 36, 0.12) !important;
  border-color: rgba(251, 191, 36, 0.35) !important;
  color: rgba(255, 235, 190, 0.95) !important;
}
aside.nex-drawer-dark .text-amber-900 {
  color: rgba(253, 224, 71, 0.90) !important;
}
aside.nex-drawer-dark .bg-amber-200 {
  background-color: rgba(251, 191, 36, 0.35) !important;
  color: rgba(255, 235, 190, 1) !important;
}
aside.nex-drawer-dark .border-amber-200 {
  border-color: rgba(251, 191, 36, 0.45) !important;
}
/* Section headers */
aside.nex-drawer-dark .text-black\\/50 {
  color: rgba(232, 201, 148, 0.65) !important;
}
/* Online last-seen text stays green on dark */
aside.nex-drawer-dark .text-emerald-700 {
  color: #34D399 !important;
}
/* Unread count badge · dark red (red-700) with white number · matches
   the Cancel-button red so the whole app has one red family (Philip
   2026-08-03). Small drop shadow instead of ring for cleaner pop on
   the brown contact cards. */
aside.nex-drawer-dark .bg-orange-500 {
  background-color: #B91C1C !important;
  color: #ffffff !important;
  box-shadow: 0 2px 6px rgba(185, 28, 28, 0.45);
}

/* Tasks alert · Philip 2026-08-03. Red heartbeat pulse on the footer
   Tasks button when any reminder has fired and hasn't been acknowledged.
   Cleared when the user opens the Tasks sheet. */
@keyframes nex-tasks-alert {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.65); }
  50%      { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);    }
}
.nex-tasks-alert {
  animation: nex-tasks-alert 1400ms cubic-bezier(0.66, 0, 0, 1) infinite;
}

/* Search jump-to-message flash · Philip 2026-08-03. Brief amber ring
   fades in and out around a message the user tapped in Search results.
   Applied via .nex-message-flash class for ~1.8s then removed. */
@keyframes nex-message-flash {
  0%   { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.55); }
  20%  { box-shadow: 0 0 0 8px rgba(249, 115, 22, 0.35); }
  100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0);    }
}
.nex-message-flash {
  animation: nex-message-flash 1600ms ease-out;
}

/* Heartbeat pulse · FRESH green (Philip 2026-08-03 · was deep forest
   emerald). Halo uses green-500 (#22C55E) rgba to match the dot colour
   in the header — reads brighter and more "alive" than the old dark
   emerald. Contact-avatar dots still use bg-emerald-800 as their base
   colour · the fresher halo just makes their pulse more visible. */
@keyframes nex-heartbeat {
  0%, 100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.65); }
  50%      { transform: scale(1.18); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
}
.nex-presence-online {
  animation: nex-heartbeat 1500ms cubic-bezier(0.66, 0, 0, 1) infinite;
}
`;

// Ambient keyframes · injected ONCE at page level so the picker's
// preview tiles work even when the main ambient is disabled (Philip
// 2026-08-03 bug fix). Two families:
//   · Full-viewport (nex-dust-drift, nex-petal-fall, nex-spark-fall) —
//     used by the chat-background AmbientParticles, translates 110vh
//   · Preview (nex-pv-up, nex-pv-down, nex-pv-spark) — used by tile
//     mini-previews, translates only ~72px so particles stay inside
//     the 64px preview card
const AMBIENT_KEYFRAMES_CSS = `
@keyframes nex-dust-drift {
  0%   { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
  10%  { opacity: var(--nex-particle-opacity, 0.7); }
  90%  { opacity: var(--nex-particle-opacity, 0.7); }
  100% { transform: translate3d(var(--nex-sway, 0), -110vh, 0) rotate(360deg); opacity: 0; }
}
@keyframes nex-petal-fall {
  0%   { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
  10%  { opacity: var(--nex-particle-opacity, 0.85); }
  90%  { opacity: var(--nex-particle-opacity, 0.85); }
  100% { transform: translate3d(var(--nex-sway, 0), 110vh, 0) rotate(720deg); opacity: 0; }
}
@keyframes nex-spark-fall {
  0%   { transform: translate3d(0, 0, 0); opacity: 0; filter: brightness(1); }
  8%   { opacity: var(--nex-particle-opacity, 0.90); filter: brightness(1.6); }
  60%  { opacity: var(--nex-particle-opacity, 0.75); filter: brightness(1.3); }
  100% { transform: translate3d(var(--nex-sway, 0), 110vh, 0); opacity: 0; filter: brightness(0.9); }
}
@keyframes nex-pv-up {
  0%   { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
  15%  { opacity: 0.85; }
  85%  { opacity: 0.85; }
  100% { transform: translate3d(var(--nex-sway, 0), -80px, 0) rotate(180deg); opacity: 0; }
}
@keyframes nex-pv-down {
  0%   { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
  15%  { opacity: 0.9; }
  85%  { opacity: 0.9; }
  100% { transform: translate3d(var(--nex-sway, 0), 80px, 0) rotate(360deg); opacity: 0; }
}
@keyframes nex-pv-spark {
  0%   { transform: translate3d(0, 0, 0); opacity: 0; filter: brightness(1); }
  15%  { opacity: 0.95; filter: brightness(1.6); }
  80%  { opacity: 0.7; filter: brightness(1.2); }
  100% { transform: translate3d(var(--nex-sway, 0), 80px, 0); opacity: 0; filter: brightness(0.9); }
}
`;

// Blossom wallpaper (Philip's supplied image · ImageKit-hosted).
const BLOSSOM_WALLPAPER =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%203,%202026,%2002_30_36%20AM.png";

// The Blossom theme CSS. Injected inline so the theme scopes ONLY to
// `.nex-theme-blossom` and cannot leak into any other Nex surface.
// Every rule below skins existing elements — no JSX changes required
// beyond adding the class. This IS the Theme Engine Contract proved
// in code (Philip 2026-08-03).
const BLOSSOM_THEME_CSS = `
/* Live Theme Swap · smooth transition between Original Nex and any
   applied theme so the swap feels intentional, not jarring. Only
   colour + background properties transition — layout and typography
   stay instant so the interface remains stable during the swap. */
.nex-theme-blossom,
.nex-theme-blossom * {
  transition:
    background-color 320ms ease,
    color 260ms ease,
    border-color 260ms ease,
    box-shadow 280ms ease;
}
.nex-theme-blossom {
  --nex-bg: #FFF5F8;
  --nex-surface: #FFFDFE;
  --nex-card: #FFFFFF;
  --nex-primary: #EC4899;
  --nex-primary-hover: #DB2777;
  --nex-secondary: #FCE7F3;
  --nex-border: #F4C8DB;
  --nex-text: #4B3142;
  --nex-muted: #7E5A6F;
  --nex-user-bubble: #F9C5D8;
  --nex-nex-bubble: #FFFFFF;
  --nex-composer: #FFFFFF;
  --nex-footer: #FFF7FA;
  --nex-radius-card: 28px;
  --nex-radius-button: 22px;
  --nex-radius-input: 18px;
  --nex-radius-bubble: 24px;
  --nex-shadow-soft: 0 2px 10px rgba(236, 72, 153, 0.10);
  --nex-shadow-glow: 0 8px 28px rgba(236, 72, 153, 0.16);

  font-family: var(--nex-font-body), "Nunito", system-ui, -apple-system, sans-serif;
  color: var(--nex-text);
  /* Wallpaper fits BOTH height and width (Philip 2026-08-03) — full image
     always visible, corner petals never cropped. Layers: overlay on top,
     wallpaper stretched underneath. */
  background:
    linear-gradient(180deg, rgba(255, 245, 248, 0.82) 0%, rgba(255, 245, 248, 0.94) 100%),
    url('${BLOSSOM_WALLPAPER}') center center / 100% 100% no-repeat fixed;
}
.nex-theme-blossom h1,
.nex-theme-blossom h2,
.nex-theme-blossom h3 {
  font-family: var(--nex-font-heading), "Fredoka", var(--nex-font-body), system-ui, sans-serif;
  color: var(--nex-text);
}

/* Backgrounds · surfaces */
.nex-theme-blossom .bg-white,
.nex-theme-blossom .bg-white\\/95,
.nex-theme-blossom .bg-white\\/90,
.nex-theme-blossom .bg-white\\/80 {
  background-color: rgba(255, 253, 254, 0.92) !important;
}
.nex-theme-blossom .bg-neutral-50\\/60,
.nex-theme-blossom .bg-neutral-50\\/30 {
  background-color: rgba(252, 231, 243, 0.34) !important;
}
.nex-theme-blossom .bg-neutral-100 {
  background-color: var(--nex-secondary) !important;
}
.nex-theme-blossom .bg-neutral-800 {
  background-color: var(--nex-primary) !important;
}

/* Primary orange → Blossom pink */
.nex-theme-blossom .bg-orange-500 {
  background-color: var(--nex-primary) !important;
}
.nex-theme-blossom .hover\\:bg-orange-600:hover {
  background-color: var(--nex-primary-hover) !important;
}
.nex-theme-blossom .bg-orange-100 {
  background-color: var(--nex-secondary) !important;
}
.nex-theme-blossom .bg-orange-50 {
  background-color: rgba(252, 231, 243, 0.5) !important;
}
.nex-theme-blossom .bg-orange-50\\/60,
.nex-theme-blossom .bg-orange-50\\/40 {
  background-color: rgba(252, 231, 243, 0.4) !important;
}
.nex-theme-blossom .border-orange-100,
.nex-theme-blossom .border-orange-200,
.nex-theme-blossom .border-orange-300 {
  border-color: var(--nex-border) !important;
}
.nex-theme-blossom .border-orange-400 {
  border-color: var(--nex-primary) !important;
}
.nex-theme-blossom .focus\\:border-orange-400:focus {
  border-color: var(--nex-primary) !important;
}
.nex-theme-blossom .hover\\:border-orange-200:hover {
  border-color: var(--nex-border) !important;
}
.nex-theme-blossom .text-orange-700,
.nex-theme-blossom .text-orange-800 {
  color: var(--nex-primary-hover) !important;
}
.nex-theme-blossom .text-orange-900,
.nex-theme-blossom .text-orange-950 {
  color: #831843 !important;
}
.nex-theme-blossom .hover\\:bg-orange-50:hover,
.nex-theme-blossom .hover\\:text-orange-800:hover {
  background-color: var(--nex-secondary) !important;
}

/* Neutrals → soft blossom */
.nex-theme-blossom .text-black { color: var(--nex-text) !important; }
.nex-theme-blossom .text-black\\/85,
.nex-theme-blossom .text-black\\/80 { color: var(--nex-text) !important; }
.nex-theme-blossom .text-black\\/70,
.nex-theme-blossom .text-black\\/60 { color: var(--nex-muted) !important; }
.nex-theme-blossom .text-black\\/55,
.nex-theme-blossom .text-black\\/50,
.nex-theme-blossom .text-black\\/45,
.nex-theme-blossom .text-black\\/40 { color: rgba(126, 90, 111, 0.72) !important; }
.nex-theme-blossom .border-black\\/5,
.nex-theme-blossom .border-black\\/10 { border-color: var(--nex-border) !important; }

/* Emerald "saved · waiting" state stays honest — softened to blossom */
.nex-theme-blossom .bg-emerald-50 { background-color: #FFE9F2 !important; }
.nex-theme-blossom .text-emerald-800,
.nex-theme-blossom .text-emerald-700 { color: var(--nex-primary-hover) !important; }
.nex-theme-blossom .border-emerald-200 { border-color: var(--nex-border) !important; }
.nex-theme-blossom .bg-emerald-500 { background-color: var(--nex-primary) !important; }

/* Radii · rounded corners get more blossom */
.nex-theme-blossom .rounded-2xl {
  border-radius: var(--nex-radius-card) !important;
}
.nex-theme-blossom .rounded-xl {
  border-radius: var(--nex-radius-button) !important;
}

/* User bubble · orange-500 + rounded-br-md is unique to user messages */
.nex-theme-blossom .bg-orange-500.rounded-br-md {
  background-color: var(--nex-user-bubble) !important;
  color: var(--nex-text) !important;
  border-radius: var(--nex-radius-bubble) !important;
  border-bottom-right-radius: 12px !important;
  box-shadow: var(--nex-shadow-soft);
}

/* Composer textarea */
.nex-theme-blossom textarea {
  background-color: var(--nex-composer) !important;
  border-radius: var(--nex-radius-input) !important;
  border-color: var(--nex-border) !important;
  color: var(--nex-text) !important;
}
.nex-theme-blossom textarea::placeholder {
  color: rgba(126, 90, 111, 0.55) !important;
}

/* Shadows · soft pink glow */
.nex-theme-blossom .shadow-sm {
  box-shadow: var(--nex-shadow-soft) !important;
}
.nex-theme-blossom .shadow-md {
  box-shadow: var(--nex-shadow-glow) !important;
}

/* ─── Drawers + sheet · Blossom · rose-tinted glass (Philip 2026-08-03) ─
   Three-tier depth: drawer body (soft pink gradient) → drawer header
   (translucent white) → contact/menu cards (bright white with rose
   under-glow). Kills the "flat" look. */
.nex-theme-blossom aside[role="dialog"],
.nex-theme-blossom section[role="dialog"] {
  background: linear-gradient(180deg,
    rgba(255, 245, 248, 0.94) 0%,
    rgba(252, 231, 243, 0.88) 100%) !important;
  border-color: rgba(244, 200, 219, 0.55) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.90),
    inset 0 -1px 0 rgba(236, 72, 153, 0.15),
    -8px 0 32px rgba(236, 72, 153, 0.14) !important;
}
.nex-theme-blossom aside[role="dialog"] header,
.nex-theme-blossom section[role="dialog"] header {
  background-color: rgba(255, 253, 254, 0.55) !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom-color: rgba(244, 200, 219, 0.45) !important;
}
/* Elevated cards inside the drawer/sheet · brighter than the body */
.nex-theme-blossom aside[role="dialog"] .rounded-2xl,
.nex-theme-blossom section[role="dialog"] .rounded-2xl {
  background-color: rgba(255, 255, 255, 0.90) !important;
  border-color: rgba(244, 200, 219, 0.50) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    inset 0 -1px 0 rgba(236, 72, 153, 0.15),
    0 1px 2px rgba(236, 72, 153, 0.08),
    0 4px 12px rgba(236, 72, 153, 0.10) !important;
}
/* Section labels adopt rose primary */
.nex-theme-blossom aside[role="dialog"] .text-black\\/50 {
  color: var(--nex-primary) !important;
}
/* Preview chips tint rose */
.nex-theme-blossom aside[role="dialog"] .bg-neutral-100 {
  background-color: rgba(252, 231, 243, 0.75) !important;
  border-color: rgba(244, 200, 219, 0.55) !important;
  color: var(--nex-primary-hover) !important;
}

/* Loading indicator · soft blossom petals (pseudo-element · adds to
   existing "Nex is thinking…" copy which stays untouched · Honest States
   preserved) */
.nex-theme-blossom [data-loading="blossom-petals"] {
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  padding: 8px 12px !important;
}
.nex-theme-blossom [data-loading="blossom-petals"]::before {
  content: "";
  display: inline-block;
  width: 26px;
  height: 8px;
  background-image:
    radial-gradient(circle at 4px 4px, #F9C5D8 3px, transparent 3.2px),
    radial-gradient(circle at 13px 4px, #EC4899 3px, transparent 3.2px),
    radial-gradient(circle at 22px 4px, #F9C5D8 3px, transparent 3.2px);
  animation: nex-blossom-float 1600ms ease-in-out infinite;
}
@keyframes nex-blossom-float {
  0%, 100% { transform: translateY(0); opacity: 0.7; }
  50%      { transform: translateY(-3px); opacity: 1; }
}
`;

// Staircase Light Cream wallpaper (Philip 2026-08-03 · ImageKit).
const STAIRCASE_LIGHT_CREAM_WALLPAPER =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%203,%202026,%2002_59_01%20AM.png";

// Walnut Sanctum wallpaper · Philip 2026-08-03 · first DARK theme.
// Deep walnut wood panelling, amber sconce, cream carpeted treads,
// brass-tipped iron balusters, herringbone parquet floor.
const STAIRCASE_WALNUT_WALLPAPER =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%203,%202026,%2004_30_26%20AM.png";

// Grand Entrance overlay · Philip 2026-08-03 spec (formerly "Staircase
// Light Cream" · displayName renamed to "Grand Entrance", id preserved
// so persisted rows + localStorage keep working). Premium luxury feel:
// soft glassmorphism, warm neutral palette, floating chrome. Reads like
// a chat interface inside a £5m modern home. Wallpaper remains the star.
//
// Token spec (Philip verbatim):
// - Header: floating rounded rect · 64px · frosted glass 75% white ·
//   strong blur · 1px semi-transparent white border · very soft shadow
// - User bubble: bronze gradient #C99662 → #9A6A42 · white text ·
//   26px radius · slight glow
// - Assistant bubble: frosted white 80% · charcoal #222 · 26px · subtle shadow
// - Composer: floating glass pill · 60px · 32px radius · white glass ·
//   strong blur · placeholder #8E8E8E · no visible outline
// - Send: circular 52px · bronze gradient #C99662 → #9A6A42 · white
//   icon · soft shadow only
// - Bottom nav: floating rounded container · frosted glass · 30px radius ·
//   soft shadow · selected bronze #B78352 · unselected warm grey ·
//   NO solid backgrounds behind icons
// - Accents: Champagne Gold #D6B58A as hairline
// - Text: Charcoal #222 · Secondary Warm Grey #7B7B7B
const STAIRCASE_LIGHT_CREAM_THEME_CSS = `
.nex-theme-staircase-light-cream,
.nex-theme-staircase-light-cream * {
  transition:
    background-color 320ms ease,
    color 260ms ease,
    border-color 260ms ease,
    box-shadow 280ms ease,
    backdrop-filter 320ms ease;
}
.nex-theme-staircase-light-cream {
  --nex-bg: #F5EFE6;
  --nex-surface: rgba(255, 255, 255, 0.80);
  --nex-card: rgba(255, 255, 255, 0.82);
  --nex-primary: #B78352;                     /* Warm Bronze */
  --nex-primary-hover: #9A6A42;               /* Bronze deep · gradient bottom stop */
  --nex-champagne: #D6B58A;                   /* Champagne Gold · hairline accent */
  --nex-champagne-soft: rgba(214, 181, 138, 0.35);
  --nex-secondary: #E8DFD3;                   /* Frosted Ivory · surface tint */
  --nex-border: rgba(255, 255, 255, 0.35);
  --nex-hairline: rgba(214, 181, 138, 0.45);  /* Champagne Gold @ 45% · dividers */
  --nex-text: #222222;                        /* Charcoal */
  --nex-muted: #7B7B7B;                       /* Warm Grey */
  --nex-user-bubble-grad: linear-gradient(180deg, #C99662 0%, #9A6A42 100%);
  --nex-send-grad: linear-gradient(180deg, #C99662 0%, #9A6A42 100%);
  --nex-nex-bubble: rgba(255, 255, 255, 0.80);
  --nex-composer: rgba(255, 255, 255, 0.78);
  --nex-footer: rgba(255, 255, 255, 0.65);
  --nex-radius-card: 28px;
  --nex-radius-input: 32px;
  --nex-radius-bubble: 26px;                  /* Grand Entrance · 26px per spec */
  --nex-radius-header: 24px;
  --nex-radius-nav: 30px;                     /* Bottom nav capsule · 30px */
  /* Physics-correct glass edge · Philip 2026-08-03 upgrade #2. Every
     glass surface gets this shadow bundle: bright specular top edge,
     champagne under-glow (light bending through), contact shadow,
     ambient elevation. Encodes real optical behaviour · not stylistic. */
  --nex-edge-glass:
    inset 0 1px 0 rgba(255, 255, 255, 0.90),
    inset 0 -1px 0 rgba(214, 181, 138, 0.25),
    0 1px 2px rgba(90, 60, 30, 0.06),
    0 8px 24px rgba(90, 60, 30, 0.10);
  --nex-edge-glass-strong:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    inset 0 -1px 0 rgba(214, 181, 138, 0.30),
    0 2px 4px rgba(90, 60, 30, 0.08),
    0 12px 36px rgba(90, 60, 30, 0.14);
  --nex-shadow-soft: 0 2px 10px rgba(90, 60, 30, 0.06);
  --nex-shadow-glass: 0 8px 32px rgba(90, 60, 30, 0.10);
  /* Layered send-button shadow · contact + ambient + elevation + champagne halo */
  --nex-shadow-send:
    0 1px 2px rgba(90, 60, 30, 0.10),
    0 4px 12px rgba(120, 70, 30, 0.16),
    0 12px 32px rgba(154, 106, 66, 0.22),
    0 0 0 1px rgba(214, 181, 138, 0.55) inset;
  --nex-shadow-user-bubble:
    0 1px 2px rgba(90, 60, 30, 0.08),
    0 6px 20px rgba(154, 106, 66, 0.18);

  color: var(--nex-text);
  /* Luxury typography · Fraunces (display serif · optical-size axis) +
     Manrope (geometric sans body). Loaded via next/font/google. */
  font-family: var(--nex-font-luxury-body), "Manrope", system-ui, -apple-system, sans-serif;
  /* Wallpaper fits BOTH height and width (Philip 2026-08-03) — staircase
     stays visible bottom-right, no crop. Layers: soft overlay on top,
     wallpaper stretched underneath. */
  background:
    linear-gradient(180deg,
      rgba(245, 239, 230, 0.35) 0%,
      rgba(245, 239, 230, 0.45) 50%,
      rgba(245, 239, 230, 0.55) 100%),
    url('${STAIRCASE_LIGHT_CREAM_WALLPAPER}') center center / 100% 100% no-repeat fixed;
}
/* Fraunces on headings · italic-off · optical-size handles the display */
.nex-theme-staircase-light-cream h1,
.nex-theme-staircase-light-cream h2,
.nex-theme-staircase-light-cream h3,
.nex-theme-staircase-light-cream header .font-semibold {
  font-family: var(--nex-font-luxury-heading), "Fraunces", Georgia, serif;
  font-weight: 500;
  letter-spacing: -0.005em;
}

/* ─── Header · floating rounded rectangle · 64px · 75% frosted glass ── */
.nex-theme-staircase-light-cream header.sticky {
  background-color: rgba(255, 255, 255, 0.75) !important;
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
  border-bottom-color: rgba(255, 255, 255, 0.55) !important;
  border-radius: var(--nex-radius-header) !important;
  min-height: 64px;
  margin: 10px 12px 0;
  padding-left: 14px !important;
  padding-right: 14px !important;
  box-shadow: var(--nex-edge-glass-strong);
}
/* Avatar disc inside header · bronze gradient with champagne halo ring */
.nex-theme-staircase-light-cream header.sticky .bg-orange-500 {
  background-image: var(--nex-user-bubble-grad) !important;
  background-color: var(--nex-primary) !important;
  box-shadow:
    0 0 0 1.5px rgba(214, 181, 138, 0.65),
    0 4px 12px rgba(154, 106, 66, 0.28);
}
/* Back button inside header · circular glass */
.nex-theme-staircase-light-cream header.sticky button.rounded-full {
  background-color: rgba(255, 255, 255, 0.65) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    0 1px 2px rgba(90, 60, 30, 0.06);
}
.nex-theme-staircase-light-cream header.sticky .text-black\\/60,
.nex-theme-staircase-light-cream header.sticky .text-black {
  color: var(--nex-text) !important;
}
/* Title "Nex" · champagne underline · signature detail (Philip #3) */
.nex-theme-staircase-light-cream header.sticky .font-semibold {
  padding-bottom: 2px;
  background-image: linear-gradient(90deg,
    rgba(214, 181, 138, 0.65) 0%,
    rgba(214, 181, 138, 0.15) 100%);
  background-size: 24px 2px;
  background-repeat: no-repeat;
  background-position: 0 100%;
}
/* Status text · warm grey per spec */
.nex-theme-staircase-light-cream header.sticky .text-emerald-700 {
  color: var(--nex-muted) !important;
}
/* Online dot · champagne (not bronze) · reads as jewelry not utility.
   Leave the presence heartbeat dot alone so it stays GREEN on every
   theme (Philip 2026-08-03). */
.nex-theme-staircase-light-cream header.sticky .bg-emerald-500:not(.nex-presence-online) {
  background-color: var(--nex-champagne) !important;
  box-shadow: 0 0 6px rgba(214, 181, 138, 0.65);
}
/* ─── Drawers + sheet · Grand Entrance · cream + champagne (Philip 2026-08-03) ─
   Three-tier depth: drawer body (warm cream gradient) → drawer header
   (frosted white) → contact/menu cards (bright frosted white with
   champagne under-glow · physics-glass edge). */
.nex-theme-staircase-light-cream aside[role="dialog"],
.nex-theme-staircase-light-cream section[role="dialog"] {
  background: linear-gradient(180deg,
    rgba(245, 239, 230, 0.92) 0%,
    rgba(232, 223, 211, 0.86) 100%) !important;
  border-color: rgba(214, 181, 138, 0.45) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    inset 0 -1px 0 rgba(214, 181, 138, 0.30),
    -8px 0 32px rgba(90, 60, 30, 0.16) !important;
}
.nex-theme-staircase-light-cream aside[role="dialog"] header,
.nex-theme-staircase-light-cream section[role="dialog"] header {
  background-color: rgba(255, 255, 255, 0.55) !important;
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border-bottom-color: rgba(214, 181, 138, 0.35) !important;
}
.nex-theme-staircase-light-cream aside[role="dialog"] .rounded-2xl,
.nex-theme-staircase-light-cream section[role="dialog"] .rounded-2xl {
  background-color: rgba(255, 255, 255, 0.90) !important;
  border-color: rgba(214, 181, 138, 0.40) !important;
  box-shadow: var(--nex-edge-glass) !important;
}
/* Section labels adopt deep brown */
.nex-theme-staircase-light-cream aside[role="dialog"] .text-black\\/50 {
  color: #7A4E2C !important;
}
/* Preview chips tint champagne */
.nex-theme-staircase-light-cream aside[role="dialog"] .bg-neutral-100 {
  background-color: rgba(214, 181, 138, 0.22) !important;
  border-color: rgba(214, 181, 138, 0.50) !important;
  color: #7A4E2C !important;
}

/* Generic hairline borders → champagne where the theme owns the edge */
.nex-theme-staircase-light-cream .border-black\\/5,
.nex-theme-staircase-light-cream .border-black\\/10 {
  border-color: rgba(255, 255, 255, 0.28) !important;
}

/* ─── Surfaces · frosted glass throughout ────────────────────────── */
.nex-theme-staircase-light-cream .bg-white,
.nex-theme-staircase-light-cream .bg-white\\/95,
.nex-theme-staircase-light-cream .bg-white\\/90,
.nex-theme-staircase-light-cream .bg-white\\/80 {
  background-color: var(--nex-nex-bubble) !important;
  backdrop-filter: blur(18px) saturate(130%);
  -webkit-backdrop-filter: blur(18px) saturate(130%);
}
.nex-theme-staircase-light-cream .bg-neutral-50\\/60,
.nex-theme-staircase-light-cream .bg-neutral-50\\/30 {
  background-color: rgba(255, 255, 255, 0.55) !important;
}
.nex-theme-staircase-light-cream .bg-neutral-100 {
  background-color: var(--nex-secondary) !important;
}
.nex-theme-staircase-light-cream .bg-neutral-800 {
  background-color: var(--nex-text) !important;
}

/* ─── Primary · bronze replaces orange · user bubble carries the gradient */
.nex-theme-staircase-light-cream .bg-orange-500 {
  background-image: var(--nex-user-bubble-grad) !important;
  background-color: var(--nex-primary) !important;
}
.nex-theme-staircase-light-cream .hover\\:bg-orange-600:hover {
  background-image: linear-gradient(180deg, #B78352 0%, #7F582F 100%) !important;
  background-color: var(--nex-primary-hover) !important;
}
.nex-theme-staircase-light-cream .bg-orange-100 {
  background-color: var(--nex-secondary) !important;
}
.nex-theme-staircase-light-cream .bg-orange-50 {
  background-color: rgba(255, 255, 255, 0.55) !important;
}
.nex-theme-staircase-light-cream .bg-orange-50\\/60,
.nex-theme-staircase-light-cream .bg-orange-50\\/40 {
  background-color: rgba(255, 255, 255, 0.45) !important;
}
.nex-theme-staircase-light-cream .border-orange-100,
.nex-theme-staircase-light-cream .border-orange-200,
.nex-theme-staircase-light-cream .border-orange-300 {
  border-color: var(--nex-hairline) !important;
}
.nex-theme-staircase-light-cream .border-orange-400 {
  border-color: var(--nex-primary) !important;
}
.nex-theme-staircase-light-cream .focus\\:border-orange-400:focus {
  border-color: var(--nex-primary) !important;
}
.nex-theme-staircase-light-cream .hover\\:border-orange-200:hover {
  border-color: rgba(183, 131, 82, 0.40) !important;
}
.nex-theme-staircase-light-cream .text-orange-700,
.nex-theme-staircase-light-cream .text-orange-800 {
  color: #7A4E2C !important;                /* deep brown · reads unambiguously brown, not orange */
}
.nex-theme-staircase-light-cream .text-orange-900,
.nex-theme-staircase-light-cream .text-orange-950 {
  color: var(--nex-text) !important;
}
.nex-theme-staircase-light-cream .hover\\:bg-orange-50:hover,
.nex-theme-staircase-light-cream .hover\\:text-orange-800:hover {
  background-color: rgba(183, 131, 82, 0.10) !important;
}
.nex-theme-staircase-light-cream .hover\\:text-orange-900:hover {
  color: #5C3A1F !important;                /* even deeper brown on hover */
}

/* ─── Suggestion chips · brown identity (Philip 2026-08-03) ────────────
   Round-full pill links carrying "Trade Centre" · "My Projects" etc. —
   get proper glass treatment + rich brown text so they read as
   jewel-toned action chips, not orange leftovers. */
.nex-theme-staircase-light-cream a.rounded-full.border-orange-200,
.nex-theme-staircase-light-cream a.rounded-full.border-orange-300 {
  background-color: rgba(255, 255, 255, 0.72) !important;
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border-color: rgba(214, 181, 138, 0.55) !important;  /* champagne hairline */
  color: #7A4E2C !important;                            /* deep brown text */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    0 1px 2px rgba(90, 60, 30, 0.06),
    0 4px 12px rgba(90, 60, 30, 0.06);
}
.nex-theme-staircase-light-cream a.rounded-full.border-orange-200:hover,
.nex-theme-staircase-light-cream a.rounded-full.border-orange-300:hover {
  background-color: rgba(255, 255, 255, 0.90) !important;
  border-color: var(--nex-champagne) !important;
  color: #5C3A1F !important;
}

/* ─── Text · charcoal on cream ────────────────────────────────────── */
.nex-theme-staircase-light-cream .text-black { color: var(--nex-text) !important; }
.nex-theme-staircase-light-cream .text-black\\/85,
.nex-theme-staircase-light-cream .text-black\\/80 { color: var(--nex-text) !important; }
.nex-theme-staircase-light-cream .text-black\\/70,
.nex-theme-staircase-light-cream .text-black\\/60 { color: var(--nex-muted) !important; }
.nex-theme-staircase-light-cream .text-black\\/55,
.nex-theme-staircase-light-cream .text-black\\/50,
.nex-theme-staircase-light-cream .text-black\\/45,
.nex-theme-staircase-light-cream .text-black\\/40 { color: #8E8E8E !important; }

/* Emerald semantic states remapped to bronze so meaning survives */
.nex-theme-staircase-light-cream .bg-emerald-50 { background-color: var(--nex-secondary) !important; }
.nex-theme-staircase-light-cream .text-emerald-800,
.nex-theme-staircase-light-cream .text-emerald-700 { color: var(--nex-primary) !important; }
.nex-theme-staircase-light-cream .border-emerald-200 { border-color: var(--nex-hairline) !important; }
.nex-theme-staircase-light-cream .bg-emerald-500 { background-color: var(--nex-primary) !important; }

/* ─── Radii · glass capsule feel ─────────────────────────────────── */
.nex-theme-staircase-light-cream .rounded-2xl {
  border-radius: var(--nex-radius-card) !important;
}
.nex-theme-staircase-light-cream .rounded-xl {
  border-radius: var(--nex-radius-nav) !important;
}
.nex-theme-staircase-light-cream .bg-orange-500.rounded-br-md {
  border-radius: var(--nex-radius-bubble) !important;
  border-bottom-right-radius: 10px !important;
  box-shadow: var(--nex-shadow-user-bubble);
}

/* Assistant bubble tail · 26px + physics-glass edges (Philip #2) */
.nex-theme-staircase-light-cream .bg-white.rounded-bl-md,
.nex-theme-staircase-light-cream .bg-white\\/95.rounded-bl-md,
.nex-theme-staircase-light-cream .bg-white\\/90.rounded-bl-md,
.nex-theme-staircase-light-cream .bg-white\\/80.rounded-bl-md {
  border-radius: var(--nex-radius-bubble) !important;
  border-bottom-left-radius: 10px !important;
  border: 1px solid rgba(255, 255, 255, 0.55);
  box-shadow: var(--nex-edge-glass) !important;
}

/* ─── Composer · floating glass pill · 60px · 32px radius ─────────── */
.nex-theme-staircase-light-cream textarea {
  background-color: var(--nex-composer) !important;
  backdrop-filter: blur(30px) saturate(140%);
  -webkit-backdrop-filter: blur(30px) saturate(140%);
  border-radius: var(--nex-radius-input) !important;
  border-color: rgba(255, 255, 255, 0.55) !important;
  color: var(--nex-text) !important;
  min-height: 60px;
  padding: 18px 20px !important;
  box-shadow: var(--nex-edge-glass-strong) !important;
  font-family: var(--nex-font-luxury-body), "Manrope", system-ui, sans-serif;
}
.nex-theme-staircase-light-cream textarea::placeholder {
  color: #8E8E8E !important;
  font-family: var(--nex-font-luxury-body), "Manrope", system-ui, sans-serif;
}

/* ─── Send button · circular 52px · bronze gradient · layered shadow +
       champagne rim (Philip #3 · jewelry moment) ────────────────── */
.nex-theme-staircase-light-cream button[aria-label="Send"] {
  width: 52px !important;
  height: 52px !important;
  background-image: var(--nex-send-grad) !important;
  background-color: var(--nex-primary) !important;
  box-shadow: var(--nex-shadow-send) !important;
  border: none !important;
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 220ms ease !important;
}
.nex-theme-staircase-light-cream button[aria-label="Send"]:hover:not(:disabled) {
  transform: scale(1.03);
  box-shadow:
    0 1px 2px rgba(90, 60, 30, 0.10),
    0 6px 16px rgba(120, 70, 30, 0.20),
    0 16px 40px rgba(154, 106, 66, 0.28),
    0 0 0 1px rgba(214, 181, 138, 0.70) inset !important;
}
.nex-theme-staircase-light-cream button[aria-label="Send"] svg {
  width: 18px !important;
  height: 18px !important;
}

/* ─── Bottom nav · floating capsule row · frosted glass · 30px ────── */
/* Footer container · fades its own solid background so the row reads
   as three floating pills over the wallpaper */
.nex-theme-staircase-light-cream footer.sticky {
  background-color: transparent !important;
  border-top: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  padding-bottom: 16px !important;
}
/* Each PersistentFooterButton becomes a floating frosted pill with
   physics-glass edges (Philip upgrade #2) */
.nex-theme-staircase-light-cream footer.sticky .rounded-xl {
  background-color: rgba(255, 255, 255, 0.65) !important;
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
  border-radius: var(--nex-radius-nav) !important;
  color: var(--nex-muted) !important;
  box-shadow: var(--nex-edge-glass) !important;
  padding-top: 10px !important;
  padding-bottom: 10px !important;
}
.nex-theme-staircase-light-cream footer.sticky .rounded-xl:hover {
  color: var(--nex-primary) !important;
  background-color: rgba(255, 255, 255, 0.82) !important;
  border-color: var(--nex-hairline) !important;
  box-shadow: var(--nex-edge-glass-strong) !important;
}
/* Bronze badge on the floating pill · replaces orange dot */
.nex-theme-staircase-light-cream footer.sticky .bg-orange-500 {
  background-image: var(--nex-user-bubble-grad) !important;
  background-color: var(--nex-primary) !important;
  box-shadow: 0 2px 8px rgba(154, 106, 66, 0.30);
}

/* ─── Shadows · warm rather than pink ────────────────────────────── */
.nex-theme-staircase-light-cream .shadow-sm {
  box-shadow: var(--nex-shadow-soft) !important;
}
.nex-theme-staircase-light-cream .shadow-md {
  box-shadow: 0 6px 18px rgba(90, 60, 30, 0.10) !important;
}

/* ─── Loading indicator · Workshop Glow · warm bronze pulse ──────── */
.nex-theme-staircase-light-cream [data-loading="blossom-petals"] {
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  padding: 8px 12px !important;
}
.nex-theme-staircase-light-cream [data-loading="blossom-petals"]::before {
  content: "";
  display: inline-block;
  width: 26px;
  height: 8px;
  background-image:
    radial-gradient(circle at 4px 4px, #C99662 3px, transparent 3.2px),
    radial-gradient(circle at 13px 4px, #B78352 3px, transparent 3.2px),
    radial-gradient(circle at 22px 4px, #D6B58A 3px, transparent 3.2px);
  animation: nex-workshop-glow 1600ms ease-in-out infinite;
}
@keyframes nex-workshop-glow {
  0%, 100% { transform: translateY(0); opacity: 0.6; filter: brightness(1); }
  50%      { transform: translateY(-2px); opacity: 1;   filter: brightness(1.15); }
}
`;

// Walnut Sanctum overlay · Philip 2026-08-03 · FIRST DARK THEME.
//
// This CSS INVERTS the light-dark from all previous themes:
//   · text: cream on dark (not charcoal on light)
//   · bubbles: dark walnut glass with cream text (not white glass with charcoal)
//   · surfaces: dark walnut glass (not white glass)
//   · overlay: minimal radial vignette (wallpaper is already dark)
//
// Palette:
//   Primary  · Warm Amber          #C9A05F   (echoing the wall sconce)
//   Hover    · Deep Amber          #A67F45
//   Accent   · Antique Brass       #B8863E   (Victorian metallic · replaces champagne)
//   Text     · Cream Carpet        #F0E4CE   (matches the staircase treads)
//   Muted    · Warm Dusty Stone    #B5A78C
//   Deep     · Walnut Deep         #3D2817
//
// Every glass surface gets a physics-correct dark-glass edge (bright
// specular top + brass under-glow · same pattern as GE but tuned dark).
const STAIRCASE_WALNUT_THEME_CSS = `
.nex-theme-staircase-walnut,
.nex-theme-staircase-walnut * {
  transition:
    background-color 320ms ease,
    color 260ms ease,
    border-color 260ms ease,
    box-shadow 280ms ease,
    backdrop-filter 320ms ease;
}
.nex-theme-staircase-walnut {
  --nex-bg: #2A1810;
  --nex-surface: rgba(64, 43, 26, 0.82);
  --nex-card: rgba(64, 43, 26, 0.82);
  --nex-primary: #C9A05F;                     /* Warm Amber · sconce */
  --nex-primary-hover: #A67F45;
  --nex-brass: #B8863E;                       /* Antique Brass · metallic */
  --nex-brass-soft: rgba(184, 134, 62, 0.35);
  --nex-secondary: #3D2817;                   /* Walnut Deep */
  --nex-border: rgba(232, 223, 200, 0.20);
  --nex-hairline: rgba(184, 134, 62, 0.55);   /* Brass hairline */
  --nex-text: #F0E4CE;                        /* Cream Carpet */
  --nex-muted: #B5A78C;                       /* Warm Dusty Stone */
  --nex-user-bubble-grad: linear-gradient(180deg, #C9A05F 0%, #8B6534 100%);
  --nex-send-grad: linear-gradient(180deg, #C9A05F 0%, #8B6534 100%);
  --nex-nex-bubble: rgba(64, 43, 26, 0.72);   /* Walnut glass · original.
     Broad cascade to .bg-white — do not tune here for bubble aesthetics.
     The .bg-white.rounded-bl-md rule below paints the assistant bubble
     as BLACK FROSTED GLASS (Philip 2026-08-03) while this variable keeps
     other .bg-white elements (textarea, typing indicator) on-theme. */
  --nex-composer: rgba(64, 43, 26, 0.68);
  --nex-footer: rgba(64, 43, 26, 0.55);
  --nex-radius-card: 28px;
  --nex-radius-input: 32px;
  --nex-radius-bubble: 26px;
  --nex-radius-header: 24px;
  --nex-radius-nav: 30px;
  /* Physics-correct dark-glass edge · specular top + brass under-glow */
  --nex-edge-glass:
    inset 0 1px 0 rgba(255, 245, 225, 0.15),
    inset 0 -1px 0 rgba(184, 134, 62, 0.30),
    0 1px 2px rgba(0, 0, 0, 0.40),
    0 8px 24px rgba(0, 0, 0, 0.35);
  --nex-edge-glass-strong:
    inset 0 1px 0 rgba(255, 245, 225, 0.20),
    inset 0 -1px 0 rgba(184, 134, 62, 0.35),
    0 2px 4px rgba(0, 0, 0, 0.45),
    0 12px 36px rgba(0, 0, 0, 0.40);
  --nex-shadow-soft: 0 2px 10px rgba(0, 0, 0, 0.35);
  --nex-shadow-send:
    0 1px 2px rgba(0, 0, 0, 0.35),
    0 4px 12px rgba(184, 134, 62, 0.28),
    0 12px 32px rgba(184, 134, 62, 0.22),
    0 0 0 1px rgba(232, 223, 200, 0.35) inset;
  --nex-shadow-user-bubble:
    0 1px 2px rgba(0, 0, 0, 0.30),
    0 6px 20px rgba(184, 134, 62, 0.22);

  color: var(--nex-text);
  /* Wallpaper fits both dimensions (Philip 2026-08-03). Minimal radial
     vignette · dims corners so eye lands on centre chat, sconce + stairs
     stay visible. */
  background:
    radial-gradient(ellipse at center,
      rgba(20, 10, 5, 0.15) 0%,
      rgba(20, 10, 5, 0.45) 90%),
    url('${STAIRCASE_WALNUT_WALLPAPER}') center center / 100% 100% no-repeat fixed;
}

/* ─── Header · floating rounded rectangle · dark walnut glass ────── */
.nex-theme-staircase-walnut header.sticky {
  background-color: rgba(64, 43, 26, 0.55) !important;
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
  border: 1px solid rgba(232, 223, 200, 0.20) !important;
  border-bottom-color: rgba(232, 223, 200, 0.20) !important;
  border-radius: var(--nex-radius-header) !important;
  min-height: 64px;
  margin: 10px 12px 0;
  padding-left: 14px !important;
  padding-right: 14px !important;
  box-shadow: var(--nex-edge-glass-strong);
}
.nex-theme-staircase-walnut header.sticky .bg-orange-500 {
  background-image: var(--nex-user-bubble-grad) !important;
  background-color: var(--nex-primary) !important;
  box-shadow:
    0 0 0 1.5px rgba(232, 223, 200, 0.40),
    0 4px 12px rgba(184, 134, 62, 0.30);
}
.nex-theme-staircase-walnut header.sticky button.rounded-full:not(.nex-home-btn) {
  background-color: rgba(64, 43, 26, 0.50) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(232, 223, 200, 0.20);
  color: var(--nex-text) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 245, 225, 0.15),
    0 1px 2px rgba(0, 0, 0, 0.30);
}
.nex-theme-staircase-walnut header.sticky .text-black\\/60,
.nex-theme-staircase-walnut header.sticky .text-black {
  color: var(--nex-text) !important;
}
/* Title · brass underline · signature detail */
.nex-theme-staircase-walnut header.sticky .font-semibold {
  padding-bottom: 2px;
  background-image: linear-gradient(90deg,
    rgba(184, 134, 62, 0.75) 0%,
    rgba(184, 134, 62, 0.15) 100%);
  background-size: 24px 2px;
  background-repeat: no-repeat;
  background-position: 0 100%;
}
.nex-theme-staircase-walnut header.sticky .text-emerald-700 {
  color: var(--nex-muted) !important;
}
/* Online dot · brass with warm glow — but leave the presence heartbeat
   dot alone so it stays GREEN on every theme (Philip 2026-08-03). */
.nex-theme-staircase-walnut header.sticky .bg-emerald-500:not(.nex-presence-online) {
  background-color: var(--nex-brass) !important;
  box-shadow: 0 0 6px rgba(184, 134, 62, 0.75);
}
/* ─── Drawers + sheet · Walnut Sanctum · deep walnut + brass (Philip 2026-08-03) ─
   Three-tier depth on DARK: drawer body (deep walnut gradient) → drawer
   header (mid walnut glass) → contact/menu cards (lifted walnut glass
   with brass under-glow · physics edge). This is where the sanctum
   feel earns its money. */
.nex-theme-staircase-walnut aside[role="dialog"],
.nex-theme-staircase-walnut section[role="dialog"] {
  /* Match the text-container tone (walnut glass · same as textarea)
     · Philip 2026-08-03. Was a dark gradient — the drawer now reads
     as an extension of the composer surface so text field + drawer
     feel like one continuous room. */
  background: rgba(64, 43, 26, 0.72) !important;
  backdrop-filter: blur(30px) saturate(140%);
  -webkit-backdrop-filter: blur(30px) saturate(140%);
  border-color: rgba(184, 134, 62, 0.35) !important;
  box-shadow:
    inset 0 1px 0 rgba(232, 223, 200, 0.18),
    inset 0 -1px 0 rgba(184, 134, 62, 0.30),
    -8px 0 32px rgba(0, 0, 0, 0.55) !important;
}
.nex-theme-staircase-walnut aside[role="dialog"] header,
.nex-theme-staircase-walnut section[role="dialog"] header {
  background-color: rgba(64, 43, 26, 0.55) !important;
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border-bottom-color: rgba(184, 134, 62, 0.35) !important;
}
.nex-theme-staircase-walnut aside[role="dialog"] .rounded-2xl:not(.nex-contact-card):not(.nex-play-row),
.nex-theme-staircase-walnut section[role="dialog"] .rounded-2xl:not(.nex-contact-card):not(.nex-play-row) {
  /* Charcoal · Philip 2026-08-03 · was rgba(64,43,26,0.75) walnut glass.
     Applies to shell-type tiles + variant tiles inside StaircaseModelsDrawer.
     :not(.nex-contact-card) + :not(.nex-play-row) leave those two card
     types to their dedicated rules (both are black frosted glass). */
  background-color: rgba(42, 42, 42, 0.75) !important;
  border-color: rgba(184, 134, 62, 0.40) !important;
  color: var(--nex-text) !important;
  box-shadow: var(--nex-edge-glass) !important;
}
/* Play sheet menu rows · BLACK FROSTED GLASS matching chat bubbles +
   contact cards (Philip 2026-08-03). Universal across themes — the Play
   sheet is a modern OS surface, not a room-lit theme surface. */
.nex-play-row {
  background: rgba(0, 0, 0, 0.55) !important;
  backdrop-filter: blur(24px) saturate(150%);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  border: 1px solid rgba(232, 223, 200, 0.22) !important;
  color: rgba(255, 245, 225, 0.95) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 245, 225, 0.15),
    inset 0 -1px 0 rgba(184, 134, 62, 0.25),
    0 1px 2px rgba(0, 0, 0, 0.40),
    0 8px 24px rgba(0, 0, 0, 0.35) !important;
}
.nex-play-row:hover {
  background: rgba(0, 0, 0, 0.72) !important;
  border-color: rgba(232, 201, 148, 0.35) !important;
}
/* Description text inside · lift to a warmer light so it reads on black */
.nex-play-row .text-black\\/60 {
  color: rgba(255, 245, 225, 0.72) !important;
}
/* Section labels adopt brass · caps + tracking already exists */
.nex-theme-staircase-walnut aside[role="dialog"] .text-black\\/50 {
  color: var(--nex-brass) !important;
}
/* Preview chips · dark glass with brass border · warm gold text */
.nex-theme-staircase-walnut aside[role="dialog"] .bg-neutral-100 {
  background-color: rgba(64, 43, 26, 0.65) !important;
  border-color: rgba(184, 134, 62, 0.55) !important;
  color: #E8C994 !important;
}
/* Drag handle · brass tint so it belongs to the room */
.nex-theme-staircase-walnut aside[role="dialog"] .bg-black\\/15 {
  background-color: rgba(184, 134, 62, 0.45) !important;
}
.nex-theme-staircase-walnut section[role="dialog"] .bg-black\\/20 {
  background-color: rgba(184, 134, 62, 0.55) !important;
}
/* Coming Soon / Preview footer dashed box · dark walnut with brass hint */
.nex-theme-staircase-walnut aside[role="dialog"] .border-dashed,
.nex-theme-staircase-walnut section[role="dialog"] .border-dashed {
  border-color: rgba(184, 134, 62, 0.35) !important;
  background-color: rgba(64, 43, 26, 0.55) !important;
  color: var(--nex-text) !important;
}
/* Close X button inside drawer/sheet header · cream tint */
.nex-theme-staircase-walnut aside[role="dialog"] header button,
.nex-theme-staircase-walnut section[role="dialog"] header button {
  color: var(--nex-text) !important;
}
.nex-theme-staircase-walnut aside[role="dialog"] header button:hover,
.nex-theme-staircase-walnut section[role="dialog"] header button:hover {
  background-color: rgba(184, 134, 62, 0.15) !important;
  color: var(--nex-brass) !important;
}


/* Generic hairline borders · translucent cream */
.nex-theme-staircase-walnut .border-black\\/5,
.nex-theme-staircase-walnut .border-black\\/10 {
  border-color: rgba(232, 223, 200, 0.15) !important;
}

/* ─── Surfaces · dark walnut glass everywhere ────────────────────── */
.nex-theme-staircase-walnut .bg-white,
.nex-theme-staircase-walnut .bg-white\\/95,
.nex-theme-staircase-walnut .bg-white\\/90,
.nex-theme-staircase-walnut .bg-white\\/80 {
  background-color: var(--nex-nex-bubble) !important;
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  color: var(--nex-text) !important;
}
.nex-theme-staircase-walnut .bg-white\\/70 {
  background-color: rgba(64, 43, 26, 0.62) !important;
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
}
.nex-theme-staircase-walnut .bg-neutral-50\\/60,
.nex-theme-staircase-walnut .bg-neutral-50\\/30 {
  background-color: rgba(64, 43, 26, 0.45) !important;
}
.nex-theme-staircase-walnut .bg-neutral-100 {
  background-color: var(--nex-secondary) !important;
  color: var(--nex-text) !important;
}
.nex-theme-staircase-walnut .bg-neutral-800 {
  background-color: var(--nex-primary) !important;
}
.nex-theme-staircase-walnut .bg-neutral-200 {
  background-color: rgba(184, 134, 62, 0.25) !important;
  color: var(--nex-text) !important;
}

/* ─── Primary · amber replaces orange ─────────────────────────────── */
.nex-theme-staircase-walnut .bg-orange-500 {
  background-image: var(--nex-user-bubble-grad) !important;
  background-color: var(--nex-primary) !important;
}
.nex-theme-staircase-walnut .hover\\:bg-orange-600:hover {
  background-image: linear-gradient(180deg, #A67F45 0%, #6E4E2A 100%) !important;
  background-color: var(--nex-primary-hover) !important;
}
.nex-theme-staircase-walnut .bg-orange-100 {
  background-color: rgba(201, 160, 95, 0.25) !important;
  color: var(--nex-text) !important;
}
.nex-theme-staircase-walnut .bg-orange-50 {
  background-color: rgba(64, 43, 26, 0.55) !important;
}
.nex-theme-staircase-walnut .bg-orange-50\\/60,
.nex-theme-staircase-walnut .bg-orange-50\\/40 {
  background-color: rgba(64, 43, 26, 0.42) !important;
}
.nex-theme-staircase-walnut .border-orange-100,
.nex-theme-staircase-walnut .border-orange-200,
.nex-theme-staircase-walnut .border-orange-300 {
  border-color: var(--nex-hairline) !important;
}
.nex-theme-staircase-walnut .border-orange-400 {
  border-color: var(--nex-primary) !important;
}
.nex-theme-staircase-walnut .focus\\:border-orange-400:focus {
  border-color: var(--nex-primary) !important;
}
.nex-theme-staircase-walnut .hover\\:border-orange-200:hover {
  border-color: rgba(201, 160, 95, 0.55) !important;
}
.nex-theme-staircase-walnut .text-orange-700,
.nex-theme-staircase-walnut .text-orange-800 {
  color: #E8C994 !important;                  /* warm gold text · pops on dark */
}
.nex-theme-staircase-walnut .text-orange-900,
.nex-theme-staircase-walnut .text-orange-950 {
  color: var(--nex-text) !important;
}
.nex-theme-staircase-walnut .hover\\:bg-orange-50:hover,
.nex-theme-staircase-walnut .hover\\:text-orange-800:hover {
  background-color: rgba(201, 160, 95, 0.15) !important;
}
.nex-theme-staircase-walnut .hover\\:text-orange-900:hover {
  color: #F5E4C4 !important;
}

/* Suggestion chips · ORANGE identity on dark glass (Philip 2026-08-03 ·
   was brass #E8C994). Trade Centre · My Projects · other .rounded-full
   suggestion chips. Icons inherit currentColor so they turn orange too. */
.nex-theme-staircase-walnut a.rounded-full.border-orange-200,
.nex-theme-staircase-walnut a.rounded-full.border-orange-300 {
  background-color: rgba(64, 43, 26, 0.68) !important;
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border-color: rgba(249, 115, 22, 0.55) !important;
  color: #F97316 !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 245, 225, 0.20),
    0 1px 2px rgba(0, 0, 0, 0.35),
    0 4px 12px rgba(0, 0, 0, 0.30);
}
.nex-theme-staircase-walnut a.rounded-full.border-orange-200:hover,
.nex-theme-staircase-walnut a.rounded-full.border-orange-300:hover {
  background-color: rgba(64, 43, 26, 0.82) !important;
  border-color: #FB923C !important;
  color: #FDBA74 !important;
}

/* ─── Text · cream on dark ────────────────────────────────────────── */
.nex-theme-staircase-walnut .text-black { color: var(--nex-text) !important; }
.nex-theme-staircase-walnut .text-black\\/85,
.nex-theme-staircase-walnut .text-black\\/80 { color: var(--nex-text) !important; }
.nex-theme-staircase-walnut .text-black\\/70,
.nex-theme-staircase-walnut .text-black\\/60 { color: var(--nex-muted) !important; }
.nex-theme-staircase-walnut .text-black\\/55,
.nex-theme-staircase-walnut .text-black\\/50,
.nex-theme-staircase-walnut .text-black\\/45,
.nex-theme-staircase-walnut .text-black\\/40 { color: rgba(181, 167, 140, 0.68) !important; }
.nex-theme-staircase-walnut .text-white { color: var(--nex-text) !important; }

/* Emerald semantic states remapped to brass */
.nex-theme-staircase-walnut .bg-emerald-50 {
  background-color: rgba(201, 160, 95, 0.20) !important;
  color: var(--nex-text) !important;
}
.nex-theme-staircase-walnut .text-emerald-800,
.nex-theme-staircase-walnut .text-emerald-700 { color: var(--nex-brass) !important; }
.nex-theme-staircase-walnut .border-emerald-200 { border-color: var(--nex-hairline) !important; }
.nex-theme-staircase-walnut .bg-emerald-500 { background-color: var(--nex-primary) !important; }

/* Neutral text/border remaps */
.nex-theme-staircase-walnut .text-neutral-700 { color: var(--nex-muted) !important; }
.nex-theme-staircase-walnut .border-neutral-200 { border-color: rgba(232, 223, 200, 0.20) !important; }

/* Amber semantic (toast) · softened warm */
.nex-theme-staircase-walnut .bg-amber-50 {
  background-color: rgba(201, 160, 95, 0.22) !important;
}
.nex-theme-staircase-walnut .text-amber-900,
.nex-theme-staircase-walnut .text-amber-800 { color: #E8C994 !important; }

/* ─── Radii · glass capsule feel ─────────────────────────────────── */
.nex-theme-staircase-walnut .rounded-2xl {
  border-radius: var(--nex-radius-card) !important;
}
.nex-theme-staircase-walnut .rounded-xl {
  border-radius: var(--nex-radius-nav) !important;
}
.nex-theme-staircase-walnut .bg-orange-500.rounded-br-md {
  border-radius: var(--nex-radius-bubble) !important;
  border-bottom-right-radius: 10px !important;
  box-shadow: var(--nex-shadow-user-bubble);
}
/* Assistant bubble · BLACK FROSTED GLASS · brass edge · cream text
   (Philip 2026-08-03 · was dark walnut glass). Specific to bubbles —
   .bg-white.rounded-bl-md wins on specificity over the broad .bg-white
   cascade, so the textarea + other .bg-white elements stay walnut. */
.nex-theme-staircase-walnut .bg-white.rounded-bl-md,
.nex-theme-staircase-walnut .bg-white\\/95.rounded-bl-md,
.nex-theme-staircase-walnut .bg-white\\/90.rounded-bl-md,
.nex-theme-staircase-walnut .bg-white\\/80.rounded-bl-md {
  background-color: rgba(0, 0, 0, 0.55) !important;
  backdrop-filter: blur(24px) saturate(150%) !important;
  -webkit-backdrop-filter: blur(24px) saturate(150%) !important;
  /* Border-radius overrides removed 2026-08-03 — a 26px corner on a
     bubble padded px-3.5 pt-2 clipped through the text, so on-screen
     the first characters ran past the black glass. Let the original
     Tailwind classes (rounded-2xl · rounded-bl-md) size the corners. */
  border: 1px solid rgba(232, 223, 200, 0.22);
  color: var(--nex-text) !important;
  box-shadow: var(--nex-edge-glass) !important;
}

/* ─── Composer · dark glass pill · cream text · brass placeholder ── */
.nex-theme-staircase-walnut textarea {
  background-color: var(--nex-composer) !important;
  backdrop-filter: blur(30px) saturate(140%);
  -webkit-backdrop-filter: blur(30px) saturate(140%);
  border-radius: var(--nex-radius-input) !important;
  border-color: rgba(232, 223, 200, 0.25) !important;
  color: var(--nex-text) !important;
  min-height: 60px;
  padding: 18px 20px !important;
  box-shadow: var(--nex-edge-glass-strong) !important;
}
.nex-theme-staircase-walnut textarea::placeholder {
  color: rgba(181, 167, 140, 0.65) !important;
}

/* ─── Send button · circular 52px · amber gradient · brass rim ───── */
.nex-theme-staircase-walnut button[aria-label="Send"] {
  width: 52px !important;
  height: 52px !important;
  background-image: var(--nex-send-grad) !important;
  background-color: var(--nex-primary) !important;
  box-shadow: var(--nex-shadow-send) !important;
  border: none !important;
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 220ms ease !important;
}
.nex-theme-staircase-walnut button[aria-label="Send"]:hover:not(:disabled) {
  transform: scale(1.03);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.40),
    0 6px 16px rgba(184, 134, 62, 0.32),
    0 16px 40px rgba(184, 134, 62, 0.28),
    0 0 0 1px rgba(232, 223, 200, 0.50) inset !important;
}
.nex-theme-staircase-walnut button[aria-label="Send"] svg {
  width: 18px !important;
  height: 18px !important;
}

/* ─── Bottom nav · floating dark-glass capsules · brass on hover ── */
.nex-theme-staircase-walnut footer.sticky {
  background-color: transparent !important;
  border-top: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  padding-bottom: 16px !important;
}
.nex-theme-staircase-walnut footer.sticky .rounded-xl {
  /* Contacts · Continue · Play persistent buttons · BLACK GLASS.
     Label stays cream (walnut sanctum text) · only the ICON is orange
     (Philip 2026-08-03 — svg rule below). Brass hairline restored. */
  background-color: rgba(0, 0, 0, 0.75) !important;
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
  border: 1px solid rgba(232, 223, 200, 0.22) !important;
  border-radius: var(--nex-radius-nav) !important;
  color: var(--nex-muted) !important;
  box-shadow: var(--nex-edge-glass) !important;
  padding-top: 10px !important;
  padding-bottom: 10px !important;
}
.nex-theme-staircase-walnut footer.sticky .rounded-xl svg {
  color: #F97316 !important;
}
.nex-theme-staircase-walnut footer.sticky .rounded-xl:hover svg {
  color: #FDBA74 !important;
}
.nex-theme-staircase-walnut footer.sticky .rounded-xl:hover {
  color: var(--nex-brass) !important;
  background-color: rgba(0, 0, 0, 0.88) !important;
  border-color: var(--nex-hairline) !important;
  box-shadow: var(--nex-edge-glass-strong) !important;
}
.nex-theme-staircase-walnut footer.sticky .bg-orange-500 {
  background-image: var(--nex-user-bubble-grad) !important;
  background-color: var(--nex-primary) !important;
  box-shadow: 0 2px 8px rgba(184, 134, 62, 0.35);
}

/* ─── Shadows · warm dark ────────────────────────────────────────── */
.nex-theme-staircase-walnut .shadow-sm {
  box-shadow: var(--nex-shadow-soft) !important;
}
.nex-theme-staircase-walnut .shadow-md {
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.40) !important;
}

/* ─── Loading indicator · Amber Ember · warm pulse ───────────────── */
.nex-theme-staircase-walnut [data-loading="blossom-petals"] {
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  padding: 8px 12px !important;
}
.nex-theme-staircase-walnut [data-loading="blossom-petals"]::before {
  content: "";
  display: inline-block;
  width: 26px;
  height: 8px;
  background-image:
    radial-gradient(circle at 4px 4px, #C9A05F 3px, transparent 3.2px),
    radial-gradient(circle at 13px 4px, #B8863E 3px, transparent 3.2px),
    radial-gradient(circle at 22px 4px, #E8C994 3px, transparent 3.2px);
  animation: nex-workshop-glow 1600ms ease-in-out infinite;
}
`;

export default function GeneralNexChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: "greeting",
      role: "nex",
      text: "Hi, I'm Nex. Tell me what you're trying to accomplish — find someone, start a project, or just ask me something.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [openProjectCount, setOpenProjectCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  // Theme Engine · runtime state · Philip 2026-08-03.
  //
  // The active theme is one of the built-in themes. Original Nex is
  // the default (no class applied) and is IMMUTABLE — it must always
  // be recoverable. Blossom applies the `.nex-theme-blossom` scope.
  //
  // The value is persisted to localStorage so the swap survives
  // reload. Server responses may include a `theme_command` that flips
  // this state — that's how natural-language "make my workspace feel
  // like cherry blossoms" completes the conversation loop.
  const [themeId, setThemeId] = useState<
    "original_nex" | "blossom" | "staircase_light_cream" | "staircase_walnut"
  >("original_nex");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Overlay UI state · Philip 2026-08-03. Contacts opens a right-side
  // drawer · Play opens a bottom sheet · tapping a Play row opens a
  // per-feature side drawer STACKED on top of the sheet (returns to the
  // sheet on close · nested overlay pattern).
  const [contactsDrawerOpen, setContactsDrawerOpen] = useState(false);
  const [playSheetOpen, setPlaySheetOpen] = useState(false);
  const [openFeature, setOpenFeature] = useState<PlayFeature | null>(null);

  // Quote-reply target · Philip 2026-08-03. When set, the composer
  // shows a "Replying to X" bar above the input and the next outgoing
  // message carries a `replyTo` snippet. Long-press any bubble →
  // picker → Reply to set. Tap the X on the bar to cancel.
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Tasks · Philip 2026-08-03. First-class commitment objects backed by
  // localStorage. The old "Continue" footer button becomes "Tasks" and
  // opens a bottom sheet where the user creates + views them. A 30s
  // interval scans reminders — when one fires we (1) surface a browser
  // notification, (2) push a Nex chat message, and (3) flag the task
  // id so the footer button turns red + heartbeat.
  const [tasks, setTasks] = useState<NexTask[]>([]);
  const [tasksSheetOpen, setTasksSheetOpen] = useState(false);
  const [alertingTaskIds, setAlertingTaskIds] = useState<Set<string>>(new Set());
  const persistTasks = (next: NexTask[]) => {
    setTasks(next);
    saveTasks(next);
  };
  // Load once on mount.
  useEffect(() => {
    setTasks(loadTasks());
  }, []);
  // Reminder ticker · every 30 seconds. Kept lightweight — just iterates
  // the current task list and fires any that have hit their reminder time
  // and haven't already been notified.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tick = () => {
      const now = Date.now();
      let anyFired = false;
      const nextTasks = tasks.map((t) => {
        if (t.notifiedAt || t.doneAt) return t;
        const fireAt = reminderFireTime(t);
        if (fireAt === null || fireAt > now) return t;
        anyFired = true;
        // Notification (best-effort · permission may not be granted)
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification(`Reminder · ${t.title}`, {
              body: `Due ${formatDueLabel(t.dueAt)}`,
              tag: `nex-task-${t.id}`,
            });
          } catch {}
        }
        // Nex chat message · captures the reminder in-conversation too.
        setMessages((m) => [
          ...m,
          {
            id: newId(),
            role: "nex",
            text: `Reminder — ${t.title}. Due ${formatDueLabel(t.dueAt)}.${
              t.description ? `\n\n${t.description}` : ""
            }`,
          },
        ]);
        setAlertingTaskIds((prev) => new Set(prev).add(t.id));
        return {
          ...t,
          notifiedAt: new Date().toISOString(),
          history: [
            ...(t.history ?? []),
            taskEvent("notified", { by: "nex", detail: "Reminder fired" }),
          ],
        };
      });
      if (anyFired) persistTasks(nextTasks);
    };
    // Run immediately on mount so tasks that fired while the tab was
    // closed still surface. Then every 30s.
    tick();
    const iv = setInterval(tick, 30_000);
    return () => clearInterval(iv);
  // Intentionally depend on the tasks array so new tasks are picked up.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.length]);
  // Daily briefings · Philip 2026-08-03. Morning + evening briefing
  // cards are auto-posted into the chat once per day when the chat is
  // opened after the threshold hour. localStorage tracks last-posted
  // date so we never duplicate. The card is a VIEW of NexTask — the
  // rendered content is computed live from the current task list.
  const MORNING_HOUR = 6;    // post after 6am local
  const EVENING_HOUR = 17;   // post after 5pm local
  useEffect(() => {
    const now = new Date();
    const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const kind: BriefingKind | null =
      now.getHours() >= EVENING_HOUR
        ? "evening"
        : now.getHours() >= MORNING_HOUR
          ? "morning"
          : null;
    if (!kind) return;
    const storageKey = `nex.briefing.${kind}.lastDate`;
    let last: string | null = null;
    try { last = window.localStorage.getItem(storageKey); } catch { /* ignore */ }
    if (last === ymd) return;
    // Post the briefing card as a Nex message.
    setMessages((m) => [
      ...m,
      {
        id: newId(),
        role: "nex",
        text: kind === "morning" ? "Good morning." : "End-of-day summary.",
        card: { type: "daily_briefing", kind, dateIso: ymd },
      },
    ]);
    try { window.localStorage.setItem(storageKey, ymd); } catch { /* ignore */ }
  // Run only on mount · daily-once gating handled by localStorage.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Web Push · Philip 2026-08-03 · Nex-scoped. When enabled, reminders
  // fire server-side via setTimeout + web-push, so notifications reach
  // the device even when the browser tab is closed. State persisted so
  // opening a fresh tab remembers whether push was previously enabled.
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushStatus, setPushStatus] = useState<
    "idle" | "enabling" | "denied" | "unsupported" | "needs_ios_install" | "no_vapid" | "error"
  >("idle");
  const [pushError, setPushError] = useState<string | null>(null);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("nex.push.enabled");
      if (stored === "1") setPushEnabled(true);
    } catch { /* ignore */ }
  }, []);
  const handleEnablePush = async () => {
    setPushStatus("enabling");
    setPushError(null);
    const res = await enableNexPush(getSessionId());
    if (res.ok) {
      setPushEnabled(true);
      setPushStatus("idle");
      try { window.localStorage.setItem("nex.push.enabled", "1"); } catch { /* ignore */ }
      // Schedule pushes for every pending task with a live reminder.
      const now = Date.now();
      for (const t of tasks) {
        if (t.doneAt || t.reminder === "off") continue;
        const fire = reminderFireTime(t);
        if (fire === null || fire <= now) continue;
        void scheduleTaskPush({
          sessionId: getSessionId(),
          taskId: t.id,
          fireAt: fire,
          title: `Reminder · ${t.title}`,
          body: `Due ${formatDueLabel(t.dueAt)}`,
        });
      }
    } else {
      setPushStatus(res.reason);
      if ("message" in res && res.message) setPushError(res.message);
    }
  };
  const handleDisablePush = async () => {
    await disableNexPush(getSessionId());
    setPushEnabled(false);
    try { window.localStorage.setItem("nex.push.enabled", "0"); } catch { /* ignore */ }
  };
  const handleTestPush = async () => {
    const res = await sendTestNexPush(getSessionId());
    if (!res.ok) setPushError(res.error ?? "Push test failed");
  };
  // Helper: schedule or cancel a task's server-side push based on state.
  const syncTaskPush = (t: NexTask) => {
    if (!pushEnabled) return;
    if (t.doneAt || t.reminder === "off") {
      void cancelTaskPush(t.id);
      return;
    }
    const fire = reminderFireTime(t);
    if (fire === null || fire <= Date.now()) {
      void cancelTaskPush(t.id);
      return;
    }
    void scheduleTaskPush({
      sessionId: getSessionId(),
      taskId: t.id,
      fireAt: fire,
      title: `Reminder · ${t.title}`,
      body: `Due ${formatDueLabel(t.dueAt)}`,
    });
  };

  // Add / update / mark done / delete helpers. Every mutation appends to
  // the task's history so the timeline stays complete (Philip 2026-08-03).
  const addTask = (partial: Omit<NexTask, "id" | "createdAt">) => {
    const now = new Date().toISOString();
    const t: NexTask = {
      ...partial,
      id: "task-" + Math.random().toString(36).slice(2, 10),
      createdAt: now,
      history:
        partial.history && partial.history.length > 0
          ? partial.history
          : [
              {
                at: now,
                kind: "created",
                by: actorForSource(partial.source),
                detail: `Created (${partial.source})`,
              },
            ],
    };
    persistTasks([t, ...tasks]);
    // Request notification permission on first reminder-enabled task.
    if (
      t.reminder !== "off" &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission().catch(() => {});
    }
    // Schedule the server-side push so the reminder reaches the device
    // even when this tab is closed (no-op if push isn't enabled yet).
    syncTaskPush(t);
  };
  const updateTask = (id: string, patch: Partial<NexTask>) => {
    let updated: NexTask | null = null;
    persistTasks(
      tasks.map((t) => {
        if (t.id !== id) return t;
        // Diff each editable field and log a history event per change so
        // the timeline reads like a git log of the commitment.
        const events: TaskEvent[] = [];
        if (patch.title !== undefined && patch.title !== t.title) {
          events.push(taskEvent("title_changed", { by: "user", detail: `Renamed to "${patch.title}"` }));
        }
        if (patch.description !== undefined && (patch.description ?? "") !== (t.description ?? "")) {
          events.push(taskEvent("description_changed", { by: "user" }));
        }
        const dueChanged = patch.dueAt !== undefined && patch.dueAt !== t.dueAt;
        const reminderChanged = patch.reminder !== undefined && patch.reminder !== t.reminder;
        if (dueChanged) {
          events.push(
            taskEvent("due_changed", {
              by: "user",
              detail: `Due changed to ${formatDueLabel(patch.dueAt as string)}`,
            }),
          );
        }
        if (reminderChanged) {
          events.push(
            taskEvent("reminder_changed", {
              by: "user",
              detail: `Reminder set to "${patch.reminder}"`,
            }),
          );
        }
        const next = {
          ...t,
          ...patch,
          // Rescheduling clears notifiedAt so a moved reminder re-fires.
          notifiedAt: dueChanged || reminderChanged ? undefined : t.notifiedAt,
          history: [...(t.history ?? []), ...events],
        };
        updated = next;
        return next;
      }),
    );
    if (updated) syncTaskPush(updated);
  };
  const markTaskDone = (id: string) => {
    let doneTask: NexTask | null = null;
    persistTasks(
      tasks.map((t) => {
        if (t.id !== id) return t;
        const next = {
          ...t,
          doneAt: new Date().toISOString(),
          history: [...(t.history ?? []), taskEvent("completed", { by: "user" })],
        };
        doneTask = next;
        return next;
      }),
    );
    setAlertingTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    // Completed tasks don't need to fire reminders any more.
    if (doneTask) syncTaskPush(doneTask);
  };
  const deleteTask = (id: string) => {
    persistTasks(tasks.filter((t) => t.id !== id));
    setAlertingTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    // Cancel any pending server-side push for this task.
    if (pushEnabled) void cancelTaskPush(id);
  };
  // Commitment suggestion actions · confirm one/many, dismiss one/many.
  // Every action updates the per-suggestion outcome map on the card so
  // the chat log reflects exactly what happened (First Law · visible +
  // non-repeatable). Notification permission requested on first accepted
  // reminder-enabled suggestion.
  const mutateSuggestionCard = (
    messageId: string,
    fn: (card: CommitmentSuggestionCardData) => CommitmentSuggestionCardData,
  ) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.card || m.card.type !== "commitment_suggestion") return m;
        return { ...m, card: fn(m.card) };
      }),
    );
  };

  const createSuggestions = (
    cardMessageId: string,
    card: CommitmentSuggestionCardData,
    // Item ids to create · when omitted, all pending items are created.
    itemIds?: string[],
    // Optional per-item overrides (for the single-item edit form).
    overrides: Record<string, { title?: string; dueAt?: string; reminder?: NexTaskReminder }> = {},
  ) => {
    const targetIds = itemIds ?? card.suggestions.map((s) => s.id);
    const nowIso = new Date().toISOString();
    let anyReminderEnabled = false;
    const newTasks: NexTask[] = [];
    const createdTaskIds: Record<string, string> = { ...(card.createdTaskIds ?? {}) };
    const newOutcomes: Record<string, "created" | "dismissed"> = { ...(card.outcomes ?? {}) };
    for (const id of targetIds) {
      // Skip items already resolved.
      if (newOutcomes[id]) continue;
      const item = card.suggestions.find((s) => s.id === id);
      if (!item) continue;
      const override = overrides[id] ?? {};
      const taskId = "task-" + Math.random().toString(36).slice(2, 10);
      const dueAt = override.dueAt ?? item.dueAt;
      const reminder = override.reminder ?? item.reminder;
      const title = (override.title ?? item.title).trim();
      if (reminder !== "off") anyReminderEnabled = true;
      newTasks.push({
        id: taskId,
        title,
        dueAt,
        reminder,
        source: "chat",
        createdAt: nowIso,
        confidenceScore: item.confidence,
        metadata: {
          originalMessageId: card.originalMessageId,
          originalText: card.originalText,
          suggestionId: id,
        },
        history: [
          {
            at: nowIso,
            kind: "created",
            by: "nex",
            detail: `Extracted from chat: "${card.originalText.slice(0, 90)}${card.originalText.length > 90 ? "…" : ""}"`,
          },
        ],
      });
      newOutcomes[id] = "created";
      createdTaskIds[id] = taskId;
    }
    if (newTasks.length === 0) return;
    persistTasks([...newTasks, ...tasks]);
    mutateSuggestionCard(cardMessageId, (c) => ({
      ...c,
      outcomes: newOutcomes,
      createdTaskIds,
    }));
    if (
      anyReminderEnabled &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission().catch(() => {});
    }
  };

  const dismissSuggestions = (
    cardMessageId: string,
    itemIds?: string[],
  ) => {
    mutateSuggestionCard(cardMessageId, (c) => {
      const targets = itemIds ?? c.suggestions.map((s) => s.id);
      const nextOutcomes = { ...(c.outcomes ?? {}) };
      for (const id of targets) {
        if (!nextOutcomes[id]) nextOutcomes[id] = "dismissed";
      }
      return { ...c, outcomes: nextOutcomes };
    });
  };

  const openTasksSheet = () => {
    setTasksSheetOpen(true);
    // Opening the sheet is an acknowledgment of any current alerts —
    // clear the red heartbeat once the user has actually seen them.
    setAlertingTaskIds(new Set());
  };
  const pendingTaskCount = tasks.filter((t) => !t.doneAt).length;

  // Attachments · Philip 2026-08-03. Two hidden file inputs in the
  // composer · Camera opens the device camera on mobile (falls back
  // to file picker on desktop) · Paperclip is any file. Selected files
  // post immediately as a message with an `attachment` payload · caption
  // not supported in v1 (send text as a follow-up). Blob-URL storage
  // (session-only) until the backend upload lands.
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleAttachment = (file: File) => {
    const isImage = file.type.startsWith("image/");
    const url = URL.createObjectURL(file);
    setMessages((m) => [
      ...m,
      {
        id: newId(),
        role: "user",
        text: "",
        attachment: {
          kind: isImage ? "image" : "file",
          url,
          name: file.name || (isImage ? "photo.jpg" : "file"),
          sizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
        },
      },
    ]);
  };
  const onCameraChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleAttachment(f);
    // Reset so re-selecting the same file re-fires onChange.
    e.target.value = "";
  };
  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleAttachment(f);
    e.target.value = "";
  };

  // Message search · Philip 2026-08-03. Header search icon → full
  // overlay with live-filtered results · tapping a result closes the
  // overlay, scrolls the chat to that message, and highlights it for
  // ~1.8s so the eye lands cleanly.
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const jumpToMessage = (id: string) => {
    setSearchOpen(false);
    setHighlightedId(id);
    // Give React a tick to unmount the overlay before scrolling.
    setTimeout(() => {
      const el = document.querySelector(`[data-message-id="${id}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    setTimeout(() => setHighlightedId(null), 1800);
  };

  // Voice message recording · Philip 2026-08-03. TAP mic to start ·
  // TAP send to finish · TAP X to cancel. MediaRecorder captures the
  // audio; on stop we build a blob URL and push a Message with an
  // `audio` payload. Session-only (blob URLs don't survive reload) —
  // real upload lands with the backend.
  const [recording, setRecording] = useState(false);
  const [recordElapsedMs, setRecordElapsedMs] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const recordTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordCancelRef = useRef<boolean>(false);

  const stopRecordTick = () => {
    if (recordTickRef.current) {
      clearInterval(recordTickRef.current);
      recordTickRef.current = null;
    }
  };

  const startRecording = async () => {
    if (recording) return;
    setRecordError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recordCancelRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        // Always release the mic track — browsers keep the tab-indicator
        // otherwise, which spooks users.
        stream.getTracks().forEach((t) => t.stop());
        const durationMs = Date.now() - recordStartRef.current;
        stopRecordTick();
        setRecording(false);
        setRecordElapsedMs(0);
        if (recordCancelRef.current) {
          audioChunksRef.current = [];
          return;
        }
        // Skip absurdly short recordings — likely accidental taps.
        if (durationMs < 300 || audioChunksRef.current.length === 0) {
          audioChunksRef.current = [];
          return;
        }
        const blob = new Blob(audioChunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        const url = URL.createObjectURL(blob);
        audioChunksRef.current = [];
        setMessages((m) => [
          ...m,
          {
            id: newId(),
            role: "user",
            text: "",
            audio: { url, durationMs },
          },
        ]);
      };
      mediaRecorderRef.current = rec;
      recordStartRef.current = Date.now();
      setRecording(true);
      rec.start();
      recordTickRef.current = setInterval(() => {
        setRecordElapsedMs(Date.now() - recordStartRef.current);
      }, 100);
    } catch (err) {
      setRecordError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Microphone permission denied. Enable it in your browser settings to record voice messages."
          : "Couldn't start recording. Check your microphone and try again.",
      );
    }
  };

  const finishRecording = () => {
    if (!recording || !mediaRecorderRef.current) return;
    recordCancelRef.current = false;
    mediaRecorderRef.current.stop();
  };

  const cancelRecording = () => {
    if (!recording || !mediaRecorderRef.current) return;
    recordCancelRef.current = true;
    mediaRecorderRef.current.stop();
  };

  // Active call · Philip 2026-08-03 · REAL WebRTC v1. Voice only for
  // now; video is next phase. Uses polling signaling under the hood.
  // Two-tab testing: this tab uses `?session=<X>` (or the default),
  // the other tab uses `?session=riverside-demo` and calls back.
  const [activeCall, setActiveCall] = useState<MockContact | null>(null);
  const [callState, setCallState] = useState<CallState>("idle");
  const [callHandle, setCallHandle] = useState<NexCallHandle | null>(null);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  // Incoming-call state · populated when an offer arrives in the inbox.
  const [incomingOffer, setIncomingOffer] = useState<
    Extract<CallSignal, { kind: "offer" }> | null
  >(null);
  // Buffer ICE candidates that arrive between offer receipt and accept
  // so we can drain them into the peer once it's built.
  const iceBufferRef = useRef<RTCIceCandidateInit[]>([]);

  // Effective session id · URL query param `?session=X` overrides for
  // two-tab demo testing. Real deploys read from auth.
  const effectiveSessionId = useMemo(() => {
    if (typeof window === "undefined") return "unknown-session";
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("session");
      if (q) return q;
    } catch { /* ignore */ }
    return getSessionId();
  }, []);

  // Start polling the inbox on mount so incoming calls can reach this
  // tab. The polling is one-per-tab (module-level singleton).
  useEffect(() => {
    startCallSignalPolling(effectiveSessionId);
    const unsubscribe = subscribeToCallSignals((sig) => {
      if (sig.kind === "offer") {
        // Only ONE incoming call surface at a time — if there's already
        // an active call OR a pending offer, auto-decline the new one.
        if (activeCall || incomingOffer) {
          void declineIncomingCall({ offer: sig, mySessionId: effectiveSessionId });
          return;
        }
        iceBufferRef.current = [];
        setIncomingOffer(sig);
      } else if (sig.kind === "ice" && incomingOffer && sig.callId === incomingOffer.callId) {
        // Buffer candidates that arrive before the user hits Accept.
        iceBufferRef.current.push(sig.candidate);
      } else if (sig.kind === "hangup" && incomingOffer && sig.callId === incomingOffer.callId) {
        // Caller gave up before we picked up.
        setIncomingOffer(null);
        iceBufferRef.current = [];
      }
    });
    return () => {
      unsubscribe();
      stopCallSignalPolling();
    };
  // effectiveSessionId is stable; incoming/active refs read inside are
  // read via closure but we rebind whenever they change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSessionId, activeCall, incomingOffer]);

  const handleStartCall = async (contact: MockContact) => {
    setContactsDrawerOpen(false);
    setCallError(null);
    if (!contact.demoSessionId) {
      setCallError(
        `No demoSessionId on ${contact.name}. Open a second browser tab with ?session=<id> and add that id to the contact for the demo.`,
      );
      return;
    }
    setActiveCall(contact);
    setCallState("connecting");
    setCallStartedAt(null);
    try {
      const handle = await startOutgoingCall({
        fromSessionId: effectiveSessionId,
        toSessionId: contact.demoSessionId,
        contact: {
          id: contact.id,
          name: contact.name,
          initials: contact.initials,
          avatarColor: contact.avatarColor,
          avatarUrl: contact.avatarUrl,
          trade: contact.trade,
          city: contact.city,
        },
        onState: (s) => {
          setCallState(s);
          if (s === "connected" && !callStartedAt) setCallStartedAt(Date.now());
        },
        onRemoteStream: () => { /* audio element attaches via ref */ },
      });
      setCallHandle(handle);
    } catch (err) {
      setCallError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Microphone permission is required to make calls."
          : err instanceof Error ? err.message : "Couldn't start call.",
      );
      setActiveCall(null);
      setCallState("idle");
    }
  };
  const handleAcceptIncoming = async () => {
    if (!incomingOffer) return;
    // Materialize a MockContact-shaped display object from the offer's
    // contact summary so the overlay renders with proper name/avatar.
    const c = incomingOffer.contact;
    const displayContact: MockContact = c
      ? {
          id: c.id,
          name: c.name,
          initials: c.initials,
          avatarColor: c.avatarColor ?? "#666",
          avatarUrl: c.avatarUrl,
          trade: c.trade,
          city: c.city,
          relationship: "trade",
          active: true,
          presence: "online",
          lastSeen: "Online now",
        }
      : {
          id: "unknown",
          name: "Unknown caller",
          initials: "?",
          avatarColor: "#666",
          relationship: "trade",
          active: true,
          presence: "online",
          lastSeen: "Online now",
        };
    const bufferedCandidates = iceBufferRef.current;
    const offer = incomingOffer;
    setIncomingOffer(null);
    setActiveCall(displayContact);
    setCallState("connecting");
    setCallStartedAt(null);
    try {
      const handle = await acceptIncomingCall({
        offer,
        mySessionId: effectiveSessionId,
        bufferedCandidates,
        onState: (s) => {
          setCallState(s);
          if (s === "connected" && !callStartedAt) setCallStartedAt(Date.now());
        },
        onRemoteStream: () => { /* audio element attaches via ref */ },
      });
      iceBufferRef.current = [];
      setCallHandle(handle);
    } catch (err) {
      setCallError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Microphone permission is required to accept calls."
          : err instanceof Error ? err.message : "Couldn't accept call.",
      );
      setActiveCall(null);
      setCallState("idle");
    }
  };
  const handleDeclineIncoming = () => {
    if (!incomingOffer) return;
    void declineIncomingCall({ offer: incomingOffer, mySessionId: effectiveSessionId });
    setIncomingOffer(null);
    iceBufferRef.current = [];
  };
  const handleEndCall = (durationMs: number) => {
    const contact = activeCall;
    if (callHandle) {
      void callHandle.hangUp();
    }
    setCallHandle(null);
    setActiveCall(null);
    setCallState("idle");
    setCallStartedAt(null);
    if (!contact) return;
    // Illustrative action items · chosen per-contact to feel plausible
    // but always preview-labeled inside the card render.
    const actionItems = contact.trade
      ? [
          "Follow up with a written quote by end of week",
          "Share dimensions and site photos before the next call",
          "Confirm site-visit date once diaries align",
        ]
      : [
          "Share the files we discussed",
          "Pick a time to catch up again next week",
        ];
    setMessages((m) => [
      ...m,
      {
        id: newId(),
        role: "nex",
        text: `Your call with ${contact.name} ended. Here's what I'd capture from it — preview only until the call backend goes live.`,
        card: {
          type: "call_summary",
          contactId: contact.id,
          contactName: contact.name,
          durationMs,
          actionItems,
          preview: true,
        },
      },
    ]);
    // Philip 2026-08-03 · unified NexTask model — the call summary card
    // stays as the visual record, but each action item also becomes a
    // first-class NexTask so it lives in the same Commitments surface
    // as everything else. Due date defaults to +3 days for demo timing;
    // real extraction should pick per-item due times from the transcript.
    const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const dueAt = `${inThreeDays.getFullYear()}-${String(inThreeDays.getMonth() + 1).padStart(2, "0")}-${String(inThreeDays.getDate()).padStart(2, "0")}T10:00`;
    const nowIso = new Date().toISOString();
    const newTasks: NexTask[] = actionItems.map((title, i) => ({
      id: `task-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      dueAt,
      reminder: "day_before",
      source: "call",
      createdAt: nowIso,
      // Preview-authored · not extracted from real transcript yet.
      confidenceScore: 0.5,
      metadata: { contactId: contact.id, contactName: contact.name, durationMs },
      history: [
        {
          at: nowIso,
          kind: "created",
          by: "nex",
          detail: `Extracted from call with ${contact.name}`,
        },
      ],
    }));
    persistTasks([...newTasks, ...tasks]);
  };

  // Header presence · Philip 2026-08-03. Reflects the browser's live
  // connection status via the navigator online/offline events. Online =
  // green heartbeat pulse · offline = red static dot. Defaults optimistic
  // so SSR renders online (hydration then corrects if actually offline).
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Nex ID + Sent Invites · Philip 2026-08-03. Load once on mount. My
  // ID is auto-generated on first use. Sent invites persist to
  // localStorage; expiry runs on drawer open (see ContactsDrawer).
  const [myNexId, setMyNexId] = useState<string>("@nex_pending");
  const [sentInvites, setSentInvites] = useState<SentInvite[]>([]);
  useEffect(() => {
    setMyNexId(loadOrCreateMyNexId());
    setSentInvites(loadSentInvites());
    const handler = () => setSentInvites(loadSentInvites());
    window.addEventListener("nex-invites-updated", handler);
    return () => window.removeEventListener("nex-invites-updated", handler);
  }, []);

  // Send an invite to a Nex ID · Philip 2026-08-03 corrected model.
  // Sender does NOT see an invitation card in their own chat — the
  // Sent Invites section in the drawer is the ONLY sender-side artifact
  // (Constitution #2 · every intent creates a visible artifact ✓).
  // Recipient (real backend later) sees the invitation card in their chat.
  const sendInvite = (targetNexId: string) => {
    const invite: SentInvite = {
      id: "inv-" + Math.random().toString(36).slice(2, 10),
      targetNexId,
      sentAt: new Date().toISOString(),
      status: "pending",
    };
    const next = [invite, ...sentInvites];
    setSentInvites(next);
    saveSentInvites(next);
    // Drawer STAYS open so the user immediately sees the new pending
    // invite in the Sent Invites section.
  };

  // DEMO ONLY · lets Philip test the Accept / Decline flow without a
  // partner device. Injects a demo NexInvitationCard as if a mock
  // sender ("Sarah Chen") just invited the current user. Clearly
  // labelled with a "Demo" chip. Real cross-user delivery arrives with
  // the backend and doesn't need this button.
  const simulateIncomingInvite = () => {
    setContactsDrawerOpen(false);
    setMessages((m) => [
      ...m,
      {
        id: newId(),
        role: "nex",
        text: `Someone would like to connect with you on Nex.`,
        card: {
          type: "connect_invite",
          fromName: "Sarah Chen",
          fromNexId: "@sarah.chen",
          fromInitials: "SC",
          fromAvatarColor: "#EC4899",
          fromRole: "Friend · London",
          isDemo: true,
          outcome: "pending",
        },
      },
    ]);
  };

  const respondToInvite = (
    messageId: string,
    outcome: "connected" | "declined",
  ) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.card || m.card.type !== "connect_invite") return m;
        return { ...m, card: { ...m.card, outcome } };
      }),
    );
  };

  // Insert a Stairs product into the chat · Philip 2026-08-03. Closes
  // both the feature drawer and the play sheet so the user lands
  // straight back in the conversation with the product card visible.
  const insertProductIntoChat = (product: StairsProduct) => {
    setMessages((m) => [
      ...m,
      {
        id: newId(),
        role: "nex",
        text: `Here's the one I was mentioning — ${product.name}.`,
        card: { type: "stairs_product", product },
      },
    ]);
    setOpenFeature(null);
    setPlaySheetOpen(false);
  };

  // Insert a Staircase Plan into the chat · same pattern as products.
  const insertPlanIntoChat = (plan: StaircasePlan) => {
    setMessages((m) => [
      ...m,
      {
        id: newId(),
        role: "nex",
        text: `Proposing the ${plan.name.toLowerCase()} layout.`,
        card: { type: "staircase_plan", plan },
      },
    ]);
    setOpenFeature(null);
    setPlaySheetOpen(false);
  };

  // Play toggles · persisted to localStorage so preferences survive
  // reload. Animation defaults ON so a theme's ambient signature (petals
  // for Blossom · dust for Grand Entrance) is part of the theme identity
  // rather than a hidden feature. Stickers + Stairs default OFF · opt-in
  // new interactions.
  const [playToggles, setPlayToggles] = useState<PlayToggles>({
    stickers: false,
    animation: true,
    stairs: false,
  });
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("nex.play.toggles");
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PlayToggles>;
        setPlayToggles((current) => ({
          stickers: typeof parsed.stickers === "boolean" ? parsed.stickers : current.stickers,
          animation: typeof parsed.animation === "boolean" ? parsed.animation : current.animation,
          stairs: typeof parsed.stairs === "boolean" ? parsed.stairs : current.stairs,
        }));
      }
    } catch {
      /* localStorage blocked · silent fallback */
    }
  }, []);
  const updateToggle = (key: keyof PlayToggles, value: boolean) => {
    setPlayToggles((prev) => {
      const next = { ...prev, [key]: value };
      try { window.localStorage.setItem("nex.play.toggles", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // Chosen ambient animation · Philip 2026-08-03. User's pick persists
  // across sessions and OVERRIDES the theme's default. `null` means
  // "use the theme default" (which resolves to null on Original Nex).
  const [chosenAnimationId, setChosenAnimationId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(AMBIENT_STORAGE_KEY);
      if (raw && findAnimation(raw)) setChosenAnimationId(raw);
    } catch {}
  }, []);
  const chooseAnimation = (id: string | null) => {
    setChosenAnimationId(id);
    try {
      if (id) window.localStorage.setItem(AMBIENT_STORAGE_KEY, id);
      else window.localStorage.removeItem(AMBIENT_STORAGE_KEY);
    } catch {}
  };

  // Effective ambient · user's pick > theme default > null. Toggle
  // gates whether it renders at all.
  const effectiveAnimationId = playToggles.animation
    ? (chosenAnimationId ?? defaultAnimationFor(themeId))
    : null;
  const particlesActive = effectiveAnimationId !== null;

  // Watch the customer-side project store so the "Continue" chip surfaces
  // when the user has open projects. Same pattern as the Trade Centre
  // header chip · pure client-side · no server request unless there are
  // projects to fetch.
  useEffect(() => {
    setMounted(true);
    let cancelled = false;
    const refresh = async () => {
      try {
        const open: Project[] = await listOpenProjects();
        if (!cancelled) setOpenProjectCount(open.length);
      } catch {
        // silent · graceful degradation applies at the API layer
      }
    };
    void refresh();
    const handler = () => { void refresh(); };
    window.addEventListener(PROJECTS_UPDATED_EVENT, handler);
    window.addEventListener("focus", handler);
    return () => {
      cancelled = true;
      window.removeEventListener(PROJECTS_UPDATED_EVENT, handler);
      window.removeEventListener("focus", handler);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Theme hydrate · read the persisted theme on mount so the swap
  // survives a page reload. Guard against unknown legacy values by
  // falling back to Original Nex — the immutable home theme.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("nex.theme.current");
      if (
        stored === "blossom" ||
        stored === "original_nex" ||
        stored === "staircase_light_cream" ||
        stored === "staircase_walnut"
      ) {
        setThemeId(stored);
      }
    } catch {
      // localStorage may be blocked (privacy mode) · silent fallback.
    }
  }, []);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || sending) return;
    // Snapshot + clear the reply target so if the request in-flights,
    // the composer bar is already dismissed and the send is coherent.
    const replySnapshot = replyingTo;
    setReplyingTo(null);
    const userMessageId = newId();
    setMessages((m) => [
      ...m,
      {
        id: userMessageId,
        role: "user",
        text: clean,
        ...(replySnapshot
          ? {
              replyTo: {
                messageId: replySnapshot.id,
                snippet: quoteSnippet(replySnapshot),
                senderName: resolveSender(replySnapshot).name,
              },
            }
          : {}),
      },
    ]);
    // Philip 2026-08-03 · Commitment Engine · scan the outgoing message
    // for one or more promises AND check whether the user is accepting
    // a request made in the previous message ("Can you send it Friday?"
    // → "Yes"). Both feed the same suggestion card. Confirmation-first —
    // never silent-create.
    const priorNonUser = [...messages].reverse().find((m) => m.role !== "user");
    const priorText = priorNonUser?.text ?? null;
    const accepted = detectAcceptedCommitment(clean, priorText);
    const declared = detectCommitments(clean);
    const suggestions = accepted ? [accepted, ...declared] : declared;
    if (suggestions.length > 0) {
      const items: SuggestionItem[] = suggestions.map((s, i) => ({
        id: `sug-${Date.now()}-${i}`,
        title: s.title,
        dueAt: s.dueAt,
        reminder: s.reminder,
        confidence: s.confidence,
      }));
      const headerText =
        items.length === 1
          ? "I noticed a commitment."
          : `I noticed ${items.length} commitments.`;
      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: "nex",
          text: headerText,
          card: {
            type: "commitment_suggestion",
            suggestions: items,
            originalMessageId: userMessageId,
            originalText: clean,
          },
        },
      ]);
    }
    setSending(true);
    try {
      // Send the session id so the Theme Engine persists any theme
      // command server-side (Six Sharpening Rules #1 — account-scoped).
      // The route treats the header as OPTIONAL — if missing, replies
      // still work · themes just don't sync across devices.
      const sessionId = getSessionId();
      const res = await fetch("/api/nex/general-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionId ? { "x-nex-session-id": sessionId } : {}),
        },
        body: JSON.stringify({
          message: clean,
          conversation_id: conversationId,
        }),
      });
      const data = await res.json();
      if (typeof data?.conversation_id === "string") {
        setConversationId(data.conversation_id);
      }
      const reply = typeof data?.reply === "string"
        ? data.reply
        : "I'm here — try asking me what you're trying to accomplish.";
      const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : undefined;
      const card = data?.card && typeof data.card === "object" ? (data.card as CardData) : undefined;
      // Theme Engine · consume ThemeCommand from the router. The swap
      // is applied BEFORE the reply lands in the list so the user
      // reads "Done!" against the new palette · no flash of the old
      // theme · Three-Second Rule preserved.
      const themeCommand = data?.theme_command;
      if (themeCommand && typeof themeCommand === "object") {
        if (themeCommand.action === "activate") {
          if (themeCommand.theme_id === "blossom") {
            setThemeId("blossom");
            try { window.localStorage.setItem("nex.theme.current", "blossom"); } catch {}
          } else if (themeCommand.theme_id === "staircase_light_cream") {
            setThemeId("staircase_light_cream");
            try { window.localStorage.setItem("nex.theme.current", "staircase_light_cream"); } catch {}
          } else if (themeCommand.theme_id === "staircase_walnut") {
            setThemeId("staircase_walnut");
            try { window.localStorage.setItem("nex.theme.current", "staircase_walnut"); } catch {}
          }
        } else if (themeCommand.action === "reset") {
          setThemeId("original_nex");
          try { window.localStorage.setItem("nex.theme.current", "original_nex"); } catch {}
        }
      }
      setMessages((m) => [
        ...m,
        { id: newId(), role: "nex", text: reply, suggestions, card },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: "nex",
          text: "I couldn't reach the assistant just now. Try again in a moment.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`${
        themeId === "blossom"
          ? "nex-theme-blossom"
          : themeId === "staircase_light_cream"
          ? "nex-theme-staircase-light-cream"
          : themeId === "staircase_walnut"
          ? "nex-theme-staircase-walnut"
          : ""
      } ${fredoka.variable} ${nunito.variable} ${fraunces.variable} ${manrope.variable} flex min-h-screen flex-col`}
    >
      {/* Invisible scrollbars · applies chat-wide (Philip 2026-08-03). */}
      <style dangerouslySetInnerHTML={{ __html: HIDE_SCROLLBAR_CSS }} />
      {/* @google/model-viewer web component · powers the inline 3D
          preview on StaircasePlanCard (Philip 2026-08-03). Loaded from
          Google's CDN, lazy so it doesn't block first paint. */}
      <Script
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js"
        strategy="lazyOnload"
      />
      {/* Ambient keyframes · always mounted so picker previews work
          even when the main ambient is disabled. */}
      <style dangerouslySetInnerHTML={{ __html: AMBIENT_KEYFRAMES_CSS }} />
      {/* Dark contacts drawer overrides + heartbeat presence pulse. */}
      <style dangerouslySetInnerHTML={{ __html: DARK_DRAWER_CSS }} />
      {/* Theme Engine · Blossom (Philip 2026-08-03). Scoped to this
          surface. Injected via a scoped style tag so no layout, no JSX,
          no state, and no logic changes — only visual tokens. */}
      <style dangerouslySetInnerHTML={{ __html: BLOSSOM_THEME_CSS }} />
      {/* Theme Engine · Staircase Light Cream (Philip 2026-08-03).
          Second built-in · validates that the loop works with more
          than one theme. Also scoped — cream/bronze/glass identity
          cannot leak beyond `.nex-theme-staircase-light-cream`. */}
      <style
        dangerouslySetInnerHTML={{ __html: STAIRCASE_LIGHT_CREAM_THEME_CSS }}
      />
      {/* Walnut Sanctum · first DARK theme (Philip 2026-08-03).
          Same scoping discipline · cream text on dark walnut glass ·
          amber sconce accent · brass hairlines. */}
      <style
        dangerouslySetInnerHTML={{ __html: STAIRCASE_WALNUT_THEME_CSS }}
      />
      {/* Ambient particles · theme-signature animation (Philip 2026-08-03).
          Fires whenever the Animation toggle is on (via Play sheet).
          Sits above wallpaper, below UI (z-5). Respects
          prefers-reduced-motion. Scoped fixed layer. */}
      <AmbientParticles animationId={effectiveAnimationId} active={particlesActive} />

      {/* Contacts drawer (right-side) · slides in from the right edge.
          Opens via footer Contacts button. Dismisses on X · backdrop · ESC. */}
      <ContactsDrawer
        open={contactsDrawerOpen}
        myNexId={myNexId}
        sentInvites={sentInvites}
        onSendInvite={sendInvite}
        onCancelInvite={(id) => {
          const next = sentInvites.filter((x) => x.id !== id);
          setSentInvites(next);
          saveSentInvites(next);
        }}
        onSimulateIncoming={simulateIncomingInvite}
        onStartCall={handleStartCall}
        onClose={() => setContactsDrawerOpen(false)}
      />

      {/* Real WebRTC call overlays · Philip 2026-08-03 */}
      <CallOverlay
        contact={activeCall}
        state={callState}
        startedAt={callStartedAt}
        callHandle={callHandle}
        errorMessage={callError}
        onEnd={handleEndCall}
      />
      <IncomingCallOverlay
        offer={incomingOffer}
        onAccept={handleAcceptIncoming}
        onDecline={handleDeclineIncoming}
      />

      {/* Message search overlay · Philip 2026-08-03 · full-screen with live
          substring match over the current session's messages. */}
      <MessageSearchOverlay
        open={searchOpen}
        messages={messages}
        onClose={() => setSearchOpen(false)}
        onPick={jumpToMessage}
      />

      {/* Tasks bottom sheet · Philip 2026-08-03 · First Law commitments. */}
      <TasksSheet
        open={tasksSheetOpen}
        tasks={tasks}
        onClose={() => setTasksSheetOpen(false)}
        onCreate={addTask}
        onUpdate={updateTask}
        onMarkDone={markTaskDone}
        onDelete={deleteTask}
        onJumpToSource={(messageId) => {
          setTasksSheetOpen(false);
          jumpToMessage(messageId);
        }}
        pushEnabled={pushEnabled}
        pushStatus={pushStatus}
        pushError={pushError}
        onEnablePush={handleEnablePush}
        onDisablePush={handleDisablePush}
        onTestPush={handleTestPush}
      />

      {/* Play sheet (bottom-up) · menu of 3 features. Tapping a row
          opens a per-feature side drawer STACKED on top of the sheet.
          Dismissing the drawer returns to the sheet. Dismissing the
          sheet returns to the chat. */}
      <PlaySheet
        open={playSheetOpen}
        toggles={playToggles}
        onOpenFeature={(f) => setOpenFeature(f)}
        onClose={() => setPlaySheetOpen(false)}
      />

      {/* Feature drawer · slides in from the right on top of the Play
          sheet. Content switches based on which feature was selected. */}
      <FeatureDrawer
        feature={openFeature}
        toggles={playToggles}
        onToggle={updateToggle}
        themeId={themeId}
        onInsertProduct={insertProductIntoChat}
        onInsertPlan={insertPlanIntoChat}
        onClose={() => setOpenFeature(null)}
      />
      {/* Header · calm · not trade-branded */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-black/5 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-orange-500 text-[13px] font-bold text-white">
          N
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-black">Nex</div>
          <div
            className={`flex items-center gap-1 text-[11px] ${
              isOnline ? "text-green-600" : "text-red-600"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isOnline
                  ? "bg-green-500 nex-presence-online"
                  : "bg-red-500"
              }`}
              aria-hidden="true"
            />
            {isOnline ? "Online" : "Offline"}
          </div>
        </div>
        {/* Search · opens the message search overlay. */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/[0.05] text-black/70 transition hover:bg-black/[0.10] hover:text-black"
          aria-label="Search messages"
        >
          <SearchIcon className="h-4 w-4" strokeWidth={2.2} />
        </button>
        {/* Home button · SOLID BLACK on every theme (Philip 2026-08-03).
            Was a burger opening Contacts — Contacts moved to the persistent
            footer, so the header button now goes home to /nex-app. */}
        <button
          type="button"
          onClick={() => router.push("/nex-app")}
          className="nex-home-btn grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black text-white shadow-sm ring-1 ring-black/20 transition hover:bg-black/80"
          aria-label="Home"
        >
          <HomeIcon className="h-4 w-4" strokeWidth={2.4} />
        </button>
      </header>

      {/* Continue chip · surfaces only when the user has open projects.
          This is the "hide the engine room" application — no visible
          project object · just a human invitation to continue what they
          were doing. */}
      {mounted && openProjectCount > 0 && (
        <div className="border-b border-black/5 bg-orange-50/60 px-4 py-2">
          <Link
            href="/nex-app/projects"
            className="inline-flex items-center gap-2 text-[12px] font-semibold text-orange-800 hover:text-orange-900"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Continue where you left off ·{" "}
            {openProjectCount === 1
              ? "1 active project"
              : `${openProjectCount} active projects`}
          </Link>
        </div>
      )}

      {/* Message stream */}
      <main
        ref={scrollRef}
        className="nex-hide-scroll relative z-[8] flex-1 overflow-y-auto overflow-x-hidden px-4 py-4"
      >
        <div className="mx-auto flex max-w-md flex-col gap-3">
          {messages.map((m, i) => (
            <ChatMessage
              key={m.id}
              message={m}
              showHeader={!isSameSender(m, messages[i - 1])}
              highlighted={m.id === highlightedId}
              onTogglePin={() =>
                setMessages((prev) =>
                  prev.map((x) => (x.id === m.id ? { ...x, pinned: !x.pinned } : x)),
                )
              }
              onToggleReaction={(emoji) =>
                setMessages((prev) =>
                  prev.map((x) => {
                    if (x.id !== m.id) return x;
                    const current = x.reactions ?? [];
                    return {
                      ...x,
                      reactions: current.includes(emoji)
                        ? current.filter((e) => e !== emoji)
                        : [...current, emoji],
                    };
                  }),
                )
              }
              onReply={() => setReplyingTo(m)}
              onCreateSuggestions={(itemIds, overrides) => {
                if (m.card?.type !== "commitment_suggestion") return;
                createSuggestions(m.id, m.card, itemIds, overrides);
              }}
              onDismissSuggestions={(itemIds) => dismissSuggestions(m.id, itemIds)}
              liveTasks={tasks}
              onOpenTasks={openTasksSheet}
              onRespondInvite={(outcome) => respondToInvite(m.id, outcome)}
              onDismissCard={() =>
                setMessages((prev) =>
                  prev.map((x) => (x.id === m.id ? { ...x, cardDismissed: true } : x)),
                )
              }
              onSaveCardForLater={(state) => {
                setMessages((prev) => {
                  const withStateUpdated = prev.map((x) =>
                    x.id === m.id ? { ...x, cardState: state } : x,
                  );
                  // Follow-up Nex message so the conversation reflects the
                  // save · no toast, no rejection wall (Philip 2026-08-03).
                  return [
                    ...withStateUpdated,
                    {
                      id: newId(),
                      role: "nex",
                      text:
                        "I've prepared your meeting and kept it here. The moment Calendar becomes available, I'll save it without you needing to re-enter anything.",
                    },
                  ];
                });
              }}
            />
          ))}
          {sending && (
            <div className="flex justify-start pl-1">
              <div
                data-loading="blossom-petals"
                className="rounded-2xl border border-black/5 bg-white px-3 py-2 text-[11px] italic text-black/50"
              >
                Nex is thinking…
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Composer + Persistent Footer · Philip 2026-08-03.
          Three permanent quick-access buttons beneath the message field
          are persistent context anchors — never hidden by conversation
          state · never navigate the user away from the chat · every
          button opens a live inline card. This is what makes Nex feel
          like an operating system, not a chat window. */}
      <footer className="sticky bottom-0 z-[10] border-t border-black/5 bg-white/95 px-4 pt-3 pb-2 backdrop-blur">
        <div className="mx-auto max-w-md">
          {/* Reply preview bar · shown when the user is replying to a
              specific message. X clears the reply target. Kept small so
              it doesn't hide the composer. */}
          {replyingTo && !recording && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50/70 px-3 py-2">
              <span className="mt-0.5 h-full w-[3px] shrink-0 self-stretch rounded-full bg-orange-500" />
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-orange-800">
                  Replying to {resolveSender(replyingTo).name}
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-black/70">
                  {quoteSnippet(replyingTo)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-black/50 hover:bg-black/[0.06] hover:text-black/80"
                aria-label="Cancel reply"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {recording ? (
            /* Recording pill · replaces the composer inputs while a voice
               message is being captured. Red pulsing dot + live timer +
               cancel (X) + finish (Send). */
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
                <span className="font-mono tabular-nums text-red-800">
                  {formatRecordTime(recordElapsedMs)}
                </span>
                <span className="text-[11.5px] text-red-800/70">Recording…</span>
              </div>
              <button
                type="button"
                onClick={cancelRecording}
                className="grid h-10 w-10 place-items-center rounded-full bg-neutral-200 text-black/70 shadow-sm transition hover:bg-neutral-300"
                aria-label="Cancel recording"
              >
                <XIcon className="h-4 w-4" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={finishRecording}
                className="grid h-10 w-10 place-items-center rounded-full bg-orange-500 text-white shadow-sm transition hover:bg-orange-600"
                aria-label="Send recording"
              >
                <Send className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          ) : (
          <div className="flex items-end gap-2">
            {/* Hidden inputs · triggered by the visible camera + paperclip
                icons. `capture` hints mobile to open the camera directly. */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onCameraChosen}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              onChange={onFileChosen}
              className="hidden"
            />
            {/* Camera + paperclip · compact 32px icons so the composer
                stays balanced. Aligned to the bottom of the multiline
                textarea via items-end on the parent. */}
            <div className="mb-1 flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="grid h-8 w-8 place-items-center rounded-full text-black/55 transition hover:bg-black/[0.05] hover:text-black/80"
                aria-label="Attach file"
              >
                <Paperclip className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="grid h-8 w-8 place-items-center rounded-full text-black/55 transition hover:bg-black/[0.05] hover:text-black/80"
                aria-label="Take a photo"
              >
                <Camera className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const t = draft.trim();
                  if (t) {
                    setDraft("");
                    void send(t);
                  }
                }
              }}
              rows={2}
              placeholder="Ask Nex anything…"
              className="flex-1 resize-none rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none placeholder:text-black/40 focus:border-orange-400"
            />
            {/* Mic when the draft is empty · Send when there's text. Same
                40×40 slot so the composer never jumps. */}
            {draft.trim() === "" ? (
              <button
                type="button"
                onClick={startRecording}
                disabled={sending}
                className="grid h-10 w-10 place-items-center rounded-full bg-orange-500 text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50"
                aria-label="Record voice message"
              >
                <Mic className="h-4 w-4" strokeWidth={2.5} />
              </button>
            ) : (
            <button
              type="button"
              onClick={() => {
                const t = draft.trim();
                if (t) {
                  setDraft("");
                  void send(t);
                }
              }}
              disabled={!draft.trim() || sending}
              className="grid h-10 w-10 place-items-center rounded-full bg-orange-500 text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" strokeWidth={2.5} />
            </button>
            )}
          </div>
          )}
          {recordError && !recording && (
            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11.5px] leading-snug text-red-800">
              {recordError}
            </div>
          )}

          {/* Persistent anchors · Contacts · Continue · Play · Philip
              2026-08-03. Continue merges the old Workspace + Projects
              into ONE hub (Now / Ongoing lanes) · Play is the discovery
              front-door. Order picked for thumb-reach: highest-value hub
              in the middle · Play on the right like Instagram Explore. */}
          <div className="mt-2 flex items-stretch gap-1">
            <PersistentFooterButton
              icon={<Users className="h-3.5 w-3.5" />}
              label="Contacts"
              onClick={() => setContactsDrawerOpen(true)}
            />
            <PersistentFooterButton
              icon={<Layers className="h-3.5 w-3.5" />}
              label="Tasks"
              badge={pendingTaskCount || undefined}
              alerting={alertingTaskIds.size > 0}
              onClick={openTasksSheet}
            />
            <PersistentFooterButton
              icon={<Sparkles className="h-3.5 w-3.5" />}
              label="Play"
              onClick={() => setPlaySheetOpen(true)}
            />
          </div>
        </div>
      </footer>
    </div>
  );
}

function ChatMessage({
  message,
  showHeader,
  highlighted,
  onTogglePin,
  onToggleReaction,
  onReply,
  onRespondInvite,
  onDismissCard,
  onSaveCardForLater,
  onCreateSuggestions,
  onDismissSuggestions,
  liveTasks,
  onOpenTasks,
}: {
  message: Message;
  showHeader: boolean;
  highlighted?: boolean;
  onTogglePin: () => void;
  onToggleReaction: (emoji: string) => void;
  onReply: () => void;
  onRespondInvite: (outcome: "connected" | "declined") => void;
  onDismissCard: () => void;
  onSaveCardForLater: (state: "prepared_waiting") => void;
  onCreateSuggestions?: (
    itemIds?: string[],
    overrides?: Record<string, { title?: string; dueAt?: string; reminder?: NexTaskReminder }>,
  ) => void;
  onDismissSuggestions?: (itemIds?: string[]) => void;
  liveTasks?: NexTask[];
  onOpenTasks?: () => void;
}) {
  const isUser = message.role === "user";
  const sender = resolveSender(message);
  const pinned = Boolean(message.pinned);
  const reactions = message.reactions ?? [];

  // Long-press (400ms) opens the emoji picker. Kept short so it feels
  // instant · but long enough to not fire on accidental taps or when
  // the user is starting a text selection. Backdrop tap closes it.
  const [pickerOpen, setPickerOpen] = useState(false);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startHold = () => {
    if (holdRef.current) return;
    holdRef.current = setTimeout(() => {
      setPickerOpen(true);
      holdRef.current = null;
    }, 400);
  };
  const cancelHold = () => {
    if (holdRef.current) {
      clearTimeout(holdRef.current);
      holdRef.current = null;
    }
  };
  // Non-user bubbles show sender header (avatar + name + role) — only on
  // the FIRST message of a run so consecutive replies from the same
  // sender don't stack repeating headers. User bubbles never show header
  // (side = attribution).
  const renderHeader = !isUser && showHeader;
  // Pinned rim · theme-accent inset ring using the CSS variable each
  // theme sets on its scope root · fallback to Nex orange.
  const pinnedRingStyle = pinned
    ? { boxShadow: "inset 0 0 0 2px var(--nex-primary, #F97316)" }
    : undefined;

  return (
    <div
      data-message-id={message.id}
      className={`flex scroll-mt-24 ${isUser ? "justify-end" : "justify-start"} ${
        highlighted ? "nex-message-flash rounded-2xl" : ""
      }`}
    >
      <div className="relative max-w-[85%]">
        {/* Card renders FIRST so the user sees the artifact before reading
            the surrounding text (Philip 2026-08-03 · Chat-First OS). Text
            below becomes the "here's what I understood" narration. */}
        {!isUser && message.card && !message.cardDismissed && (
          <div className="mb-2">
            <NexCard
              card={message.card}
              cardState={message.cardState}
              onDismiss={onDismissCard}
              onSaveForLater={onSaveCardForLater}
              onRespondInvite={onRespondInvite}
              onCreateSuggestions={onCreateSuggestions}
              onDismissSuggestions={onDismissSuggestions}
              liveTasks={liveTasks}
              onOpenTasks={onOpenTasks}
            />
          </div>
        )}
        {/* Reaction picker · absolute above the bubble · shown after
            400ms hold anywhere on the bubble. Closes on backdrop tap or
            after an emoji is picked. */}
        {pickerOpen && (
          <>
            <div
              onClick={() => setPickerOpen(false)}
              className="fixed inset-0 z-40"
              aria-hidden="true"
            />
            <div
              role="menu"
              aria-label="React to message"
              className={`absolute z-50 -top-11 flex gap-0.5 rounded-full border border-black/10 bg-white/95 px-1.5 py-1 shadow-lg backdrop-blur ${
                isUser ? "right-0" : "left-0"
              }`}
            >
              {REACTION_EMOJIS.map((emoji) => {
                const active = reactions.includes(emoji);
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onToggleReaction(emoji);
                      setPickerOpen(false);
                    }}
                    className={`grid h-8 w-8 place-items-center rounded-full text-[17px] leading-none transition ${
                      active ? "scale-110 bg-orange-100" : "hover:bg-black/[0.06]"
                    }`}
                    aria-label={active ? `Remove ${emoji} reaction` : `React with ${emoji}`}
                    aria-pressed={active}
                  >
                    {emoji}
                  </button>
                );
              })}
              {/* Reply · sits at the end of the picker · sets the composer
                  reply target and closes. */}
              <span aria-hidden="true" className="my-1 mx-0.5 w-px bg-black/10" />
              <button
                type="button"
                onClick={() => {
                  onReply();
                  setPickerOpen(false);
                }}
                className="grid h-8 min-w-[36px] place-items-center rounded-full px-2 text-[11px] font-semibold text-black/70 transition hover:bg-black/[0.06]"
                aria-label="Reply to this message"
              >
                Reply
              </button>
            </div>
          </>
        )}
        <div
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          style={pinnedRingStyle}
          className={
            isUser
              ? "rounded-2xl rounded-br-md bg-orange-500 px-3.5 pt-2 pb-1 text-sm text-white select-text"
              : "rounded-2xl rounded-bl-md border border-black/5 bg-white px-3.5 pt-2 pb-1 text-sm text-black shadow-sm select-text"
          }
        >
          {/* Sender header · avatar + name (+ optional role) · only on
              first message of a run and only for non-you bubbles */}
          {renderHeader && (
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9.5px] font-semibold text-white"
                style={{ backgroundColor: sender.avatarColor }}
                aria-hidden="true"
              >
                {sender.initials}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-black">
                {sender.name}
              </span>
              {sender.role && (
                <span className="shrink-0 text-[10.5px] text-black/50">
                  {sender.role}
                </span>
              )}
            </div>
          )}

          {/* Quoted-reply preview · sits at the top of the bubble so the
              recipient sees which message this is replying to (Philip
              2026-08-03). Left rule + sender name + snippet. */}
          {message.replyTo && (
            <div
              className={`mb-1.5 flex gap-2 rounded-lg border-l-2 px-2 py-1.5 text-[11.5px] leading-snug ${
                isUser
                  ? "border-white/60 bg-white/15 text-white/90"
                  : "border-orange-400 bg-orange-50 text-black/75"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className={`text-[10px] font-semibold uppercase tracking-wider ${
                  isUser ? "text-white/70" : "text-orange-800"
                }`}>
                  {message.replyTo.senderName}
                </div>
                <div className="truncate">{message.replyTo.snippet}</div>
              </div>
            </div>
          )}

          {/* Attachment · image renders inline · other files render as a
              filename card. Sits above any text body so the artifact
              lands first (Chat-First OS). */}
          {message.attachment && (
            <div className={message.text ? "mb-1.5" : ""}>
              {message.attachment.kind === "image" ? (
                <a
                  href={message.attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-xl"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={message.attachment.url}
                    alt={message.attachment.name}
                    className="max-h-72 w-full object-cover"
                  />
                </a>
              ) : (
                <a
                  href={message.attachment.url}
                  download={message.attachment.name}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 transition ${
                    isUser
                      ? "border-white/30 bg-white/15 text-white hover:bg-white/25"
                      : "border-black/10 bg-neutral-50 text-black hover:bg-neutral-100"
                  }`}
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                      isUser ? "bg-white/25" : "bg-orange-500 text-white"
                    }`}
                  >
                    <Paperclip className="h-4 w-4" strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold">
                      {message.attachment.name}
                    </div>
                    <div
                      className={`text-[10.5px] ${
                        isUser ? "text-white/70" : "text-black/50"
                      }`}
                    >
                      {formatBytes(message.attachment.sizeBytes)}
                    </div>
                  </div>
                </a>
              )}
            </div>
          )}

          {/* Voice message · shown in place of the text body when this
              message was recorded via the composer mic. Waveform +
              play/pause + duration · session-only object-URL playback. */}
          {message.audio ? (
            <VoiceMessagePlayer
              audio={message.audio}
              seed={message.id}
              isUser={isUser}
            />
          ) : message.text ? (
            /* Message text · break-words wraps long unbroken strings
               (URLs, `aaaaa…` typos) so the bubble stays within max-w
               and the page never gains a horizontal scrollbar. */
            <div className="whitespace-pre-wrap break-words leading-snug">{message.text}</div>
          ) : null}

          {/* Pin button row · bottom-right, subtle when unpinned, filled
              in theme accent when pinned. Sits inside the bubble padding. */}
          <div className="mt-1 flex justify-end">
            <button
              type="button"
              onClick={onTogglePin}
              className={`grid h-6 w-6 place-items-center rounded-full transition ${
                pinned
                  ? "bg-orange-500 text-white shadow-sm"
                  : isUser
                  ? "text-white/50 hover:bg-white/15 hover:text-white/80"
                  : "text-black/30 hover:bg-black/[0.05] hover:text-black/70"
              }`}
              aria-label={pinned ? "Unpin this message" : "Pin this message"}
              aria-pressed={pinned}
              title={pinned ? "Unpin" : "Save · pin this message"}
            >
              {pinned ? (
                <BookmarkCheck className="h-3.5 w-3.5" strokeWidth={2.4} />
              ) : (
                <Bookmark className="h-3.5 w-3.5" strokeWidth={2.2} />
              )}
            </button>
          </div>
        </div>
        {/* Reaction chips · aligned to the bubble side · tap a chip to
            remove that reaction. Session-only for v1 · one emoji per
            chip since there's just one reactor (you). Multi-user counts
            land when the backend ships. */}
        {reactions.length > 0 && (
          <div
            className={`mt-1.5 flex flex-wrap gap-1 ${
              isUser ? "justify-end" : "justify-start"
            }`}
          >
            {reactions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onToggleReaction(emoji)}
                className="inline-flex items-center gap-0.5 rounded-full border border-black/10 bg-white/85 px-2 py-0.5 text-[13px] leading-none shadow-sm transition hover:border-orange-300 hover:bg-white"
                aria-label={`Remove ${emoji} reaction`}
              >
                <span>{emoji}</span>
              </button>
            ))}
          </div>
        )}
        {!isUser && message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.suggestions.map((s) => (
              <Link
                key={s.href + s.label}
                href={s.href}
                className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-orange-800 shadow-sm hover:bg-orange-50"
              >
                {s.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Call summary card · Philip 2026-08-03 ────────────────────────────
//
// Rendered in the chat stream after a 1-to-1 call ends. Preview label
// is mandatory in v1 because the call is a single-device UI simulation
// and the action-items are illustrative (Third Law). Real extraction
// lands with the transcription pipeline.
function CallSummaryCard({
  card,
  onDismiss,
}: {
  card: CallSummaryCardData;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-2xl border border-black/8 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b border-black/5 bg-orange-50 px-3.5 py-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-orange-500 text-white">
          <Phone className="h-3 w-3" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-black">Call with {card.contactName}</div>
          <div className="text-[10.5px] text-black/55">
            {formatRecordTime(card.durationMs)} · ended just now
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-amber-900">
          Preview
        </span>
      </div>
      <div className="px-3.5 py-3">
        <div className="text-[11.5px] font-semibold text-black/70">
          What Nex would extract
        </div>
        <ul className="mt-1.5 space-y-1">
          {card.actionItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] leading-snug text-black/85">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10.5px] italic leading-snug text-black/50">
          Preview · illustrative items. Real transcription + action-item
          extraction lands when the call backend goes live.
        </p>
      </div>
      <div className="flex items-center justify-end border-t border-black/5 bg-neutral-50/60 px-3.5 py-2">
        <button
          type="button"
          onClick={onDismiss}
          className="text-[11px] font-semibold text-black/50 hover:text-black/80"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ─── Commitment suggestion card · Philip 2026-08-03 ───────────────────
//
// Rendered when the Commitment Engine detects a promise in an outgoing
// message. Confirmation-first — Create · Edit · Dismiss. The Edit path
// swaps the chip's body into an inline mini-form so the user can tune
// the fields before confirming. Once resolved, the chip locks into a
// "Task created" or "Dismissed" state so the chat log stays honest.
function CommitmentSuggestionCard({
  card,
  onCreate,
  onDismiss,
}: {
  card: CommitmentSuggestionCardData;
  onCreate: (
    itemIds?: string[],
    overrides?: Record<string, { title?: string; dueAt?: string; reminder?: NexTaskReminder }>,
  ) => void;
  onDismiss: (itemIds?: string[]) => void;
}) {
  const outcomes = card.outcomes ?? {};
  const pending = card.suggestions.filter((s) => !outcomes[s.id]);
  const anyPending = pending.length > 0;
  const isSingle = card.suggestions.length === 1;

  // Batch: which items are checked for "Create N tasks". Defaults to all
  // pending. Recomputed via effect only when the pending set changes.
  const [checked, setChecked] = useState<Set<string>>(() => new Set(pending.map((s) => s.id)));
  useEffect(() => {
    setChecked(new Set(pending.map((s) => s.id)));
  // Only re-derive when the id-set of pending items changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.map((s) => s.id).join(",")]);

  // Single-item inline edit state (kept minimal — only used when isSingle).
  const [editing, setEditing] = useState(false);
  const single = card.suggestions[0];
  const [d, t] = (single?.dueAt ?? "").includes("T")
    ? (single.dueAt as string).split("T")
    : [single?.dueAt ?? "", ""];
  const [editTitle, setEditTitle] = useState(single?.title ?? "");
  const [editDate, setEditDate] = useState(d);
  const [editTime, setEditTime] = useState(t.slice(0, 5));
  const [editReminder, setEditReminder] = useState<NexTaskReminder>(single?.reminder ?? "same_day");
  const canSaveEdit =
    editTitle.trim().length > 0 && editDate.length > 0 && editTime.length > 0;

  const headerLabel = isSingle
    ? "Nex noticed a commitment"
    : `Nex noticed ${card.suggestions.length} commitments`;

  return (
    <div className="rounded-2xl border border-orange-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b border-black/5 bg-orange-50/70 px-3.5 py-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-orange-500 text-[11px] text-white">
          ✨
        </span>
        <div className="min-w-0 flex-1 text-[12.5px] font-semibold text-black">
          {headerLabel}
        </div>
      </div>

      {/* ─── Single-item edit form ────────────────────────────────── */}
      {isSingle && editing && anyPending ? (
        <div className="space-y-2 px-3.5 py-3">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-black outline-none focus:border-orange-400"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[12.5px] text-black outline-none focus:border-orange-400"
            />
            <input
              type="time"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[12.5px] text-black outline-none focus:border-orange-400"
            />
          </div>
          <div className="flex gap-1">
            {(["off", "day_before", "same_day"] as NexTaskReminder[]).map((r) => {
              const label = r === "off" ? "Off" : r === "day_before" ? "Day before" : "Same day";
              const active = editReminder === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setEditReminder(r)}
                  className={`flex-1 rounded-lg border py-1.5 text-[11.5px] font-semibold transition ${
                    active
                      ? "border-orange-500 bg-orange-500 text-white"
                      : "border-black/10 bg-white text-black/70 hover:border-orange-300"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!canSaveEdit) return;
              onCreate([single.id], {
                [single.id]: {
                  title: editTitle.trim(),
                  dueAt: `${editDate}T${editTime}`,
                  reminder: editReminder,
                },
              });
            }}
            disabled={!canSaveEdit}
            className="w-full rounded-lg bg-orange-500 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create task
          </button>
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-[11px] font-semibold text-black/50 hover:text-black/80"
            >
              Back
            </button>
          </div>
          <p className="pt-1 text-[10.5px] italic leading-snug text-black/55">
            From your message: &ldquo;{card.originalText}&rdquo;
          </p>
        </div>
      ) : (
        /* ─── List / single-preview view ─────────────────────────── */
        <div className="px-3.5 py-3">
          <ul className={isSingle ? "" : "space-y-2"}>
            {card.suggestions.map((s) => {
              const status = outcomes[s.id];
              const isChecked = checked.has(s.id);
              return (
                <li key={s.id}>
                  {isSingle ? (
                    <div>
                      <div className="text-[14px] font-semibold text-black">{s.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-800">
                          {formatDueLabel(s.dueAt)}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-semibold text-black/60">
                          {s.reminder === "same_day"
                            ? "Same-day reminder"
                            : s.reminder === "day_before"
                              ? "Day-before reminder"
                              : "No reminder"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <label
                      className={`flex items-start gap-2.5 rounded-lg border px-2.5 py-2 transition ${
                        status
                          ? "border-black/5 bg-neutral-50 opacity-60"
                          : "border-black/10 bg-white hover:border-orange-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!status && isChecked}
                        disabled={Boolean(status)}
                        onChange={(e) => {
                          setChecked((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(s.id);
                            else next.delete(s.id);
                            return next;
                          });
                        }}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-black/20 accent-orange-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-[13px] font-semibold ${
                            status === "created"
                              ? "text-black/55 line-through"
                              : status === "dismissed"
                                ? "text-black/40 line-through"
                                : "text-black"
                          }`}
                        >
                          {s.title}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-orange-800">
                            {formatDueLabel(s.dueAt)}
                          </span>
                          {status && (
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold ${
                              status === "created"
                                ? "bg-green-100 text-green-800"
                                : "bg-black/[0.06] text-black/55"
                            }`}>
                              {status === "created" ? "✓ Created" : "× Dismissed"}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[10.5px] italic leading-snug text-black/55">
            From your message: &ldquo;{card.originalText}&rdquo;
          </p>

          {/* Primary action · Create · when there are still pending items */}
          {anyPending && (
            <>
              <button
                type="button"
                onClick={() => {
                  if (isSingle) {
                    onCreate([single.id]);
                  } else {
                    onCreate(Array.from(checked));
                  }
                }}
                disabled={!isSingle && checked.size === 0}
                className="mt-3 w-full rounded-lg bg-orange-500 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSingle
                  ? "Create task"
                  : `Create ${checked.size || 0} task${checked.size === 1 ? "" : "s"}`}
              </button>
              <div className="mt-2 flex items-center justify-center gap-4 text-[11.5px] font-semibold">
                {isSingle && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="text-orange-700 hover:text-orange-900"
                  >
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDismiss()}
                  className="text-black/50 hover:text-black/75"
                >
                  Dismiss{isSingle || pending.length === card.suggestions.length ? "" : " remaining"}
                </button>
              </div>
            </>
          )}
          {!anyPending && (
            <div className="mt-3 text-center text-[11.5px] font-semibold text-black/55">
              All handled.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Daily briefing card · Philip 2026-08-03 ─────────────────────────
//
// Morning + Evening variants share the same shell. Content is computed
// LIVE from the current task list (never snapshotted) so mid-day edits
// stay reflected. Tapping any lane opens the full Tasks sheet. Cards
// are just views of the NexTask system — no new persistence layer.
function DailyBriefingCard({
  card,
  tasks,
  onOpenTasks,
}: {
  card: DailyBriefingCardData;
  tasks: NexTask[];
  onOpenTasks: () => void;
}) {
  const today = tasksDueToday(tasks);
  const overdue = tasksOverdue(tasks);
  const tomorrow = tasksDueTomorrow(tasks);
  const completedToday = tasksCompletedToday(tasks);
  const isMorning = card.kind === "morning";

  // Evening carried-over guess: any task that was created today but is
  // still open and due tomorrow or later. Approximation — real "moved
  // from today to tomorrow" needs history diffing which lands with the
  // audit-view work later.
  const carried = tasks.filter((t) => {
    if (t.doneAt) return false;
    const created = new Date(t.createdAt);
    return isSameLocalDay(created, new Date());
  });

  return (
    <div className="rounded-2xl border border-orange-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b border-black/5 bg-orange-50/70 px-3.5 py-2">
        <span className="text-[16px]" aria-hidden="true">
          {isMorning ? "☀️" : "🌙"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-black">
            {isMorning ? "Good morning" : "Before you finish"}
          </div>
          <div className="text-[10.5px] text-black/55">
            {new Date(card.dateIso).toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
        </div>
      </div>

      <div className="px-3.5 py-3 space-y-3">
        {isMorning ? (
          <>
            <BriefingLane label="Today" tasks={today} emptyText="Nothing scheduled — a rare quiet one." />
            {overdue.length > 0 && (
              <BriefingLane label="Overdue" tasks={overdue} tone="warn" />
            )}
            {tomorrow.length > 0 && (
              <BriefingLane label="Tomorrow" tasks={tomorrow} tone="muted" />
            )}
          </>
        ) : (
          <>
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
              <div className="flex items-start gap-1.5">
                <span aria-hidden="true">✅</span>
                <div className="text-[12.5px] font-semibold text-green-900">
                  {completedToday.length === 0
                    ? "No completions logged today — tomorrow is a fresh page."
                    : completedToday.length === 1
                      ? "Nicely done — you kept one commitment today."
                      : `Great work — you completed ${completedToday.length} commitments today.`}
                </div>
              </div>
            </div>
            {carried.length > 0 && (
              <BriefingLane
                label="Carried into tomorrow"
                tasks={carried}
                tone="muted"
              />
            )}
            {tomorrow.length > 0 && (
              <BriefingLane label="Tomorrow" tasks={tomorrow} tone="muted" />
            )}
          </>
        )}

        <button
          type="button"
          onClick={onOpenTasks}
          className="w-full rounded-lg border border-orange-300 bg-white py-2 text-[12.5px] font-semibold text-orange-800 shadow-sm transition hover:bg-orange-50"
        >
          Open Tasks
        </button>
      </div>
    </div>
  );
}

function BriefingLane({
  label,
  tasks,
  tone = "neutral",
  emptyText,
}: {
  label: string;
  tasks: NexTask[];
  tone?: "neutral" | "warn" | "muted";
  emptyText?: string;
}) {
  const labelColor =
    tone === "warn" ? "text-red-800" : tone === "muted" ? "text-black/50" : "text-black/70";
  return (
    <div>
      <div className={`text-[10.5px] font-semibold uppercase tracking-wider ${labelColor}`}>
        {label} {tasks.length > 0 && <span className="text-black/40">· {tasks.length}</span>}
      </div>
      {tasks.length === 0 ? (
        emptyText && (
          <div className="mt-1 text-[11.5px] italic text-black/50">{emptyText}</div>
        )
      ) : (
        <ul className="mt-1 space-y-1">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start gap-2 text-[12.5px] leading-snug text-black/85">
              <span
                aria-hidden="true"
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  tone === "warn" ? "bg-red-500" : "bg-orange-500"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate">{t.title}</div>
                <div className="text-[10px] text-black/45">{formatDueLabel(t.dueAt)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Call overlay · Philip 2026-08-03 ─────────────────────────────────
//
// Full-screen 1-to-1 call UI. v2 uses REAL WebRTC — peer connection +
// audio stream — plumbed via the calls signaling backend. Two-tab demo
// works today; push-based wake-up for closed tabs comes next.
function CallOverlay({
  contact,
  state,
  startedAt,
  callHandle,
  errorMessage,
  onEnd,
}: {
  contact: MockContact | null;
  state: CallState;
  startedAt: number | null;
  callHandle: NexCallHandle | null;
  errorMessage: string | null;
  onEnd: (durationMs: number) => void;
}) {
  const [muted, setMuted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Attach the remote audio stream to the hidden <audio> once the peer
  // handle is available. New handle = fresh MediaStream reference.
  useEffect(() => {
    const el = remoteAudioRef.current;
    if (!el || !callHandle) return;
    el.srcObject = callHandle.remoteStream;
    void el.play().catch(() => { /* autoplay blocked — user gesture will unblock */ });
    return () => {
      try { el.srcObject = null; } catch { /* ignore */ }
    };
  }, [callHandle]);

  // Live elapsed timer starts on connected. Restarts if the underlying
  // call restarts (new startedAt).
  useEffect(() => {
    if (state !== "connected" || !startedAt) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      setElapsedMs(0);
      return;
    }
    setElapsedMs(Date.now() - startedAt);
    tickRef.current = setInterval(() => setElapsedMs(Date.now() - startedAt), 500);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [state, startedAt]);

  // Reset local muted state when a new call starts.
  useEffect(() => { if (contact) setMuted(false); }, [contact]);

  if (!contact) return null;

  const handleEnd = () => {
    const finalMs = state === "connected" && startedAt ? Date.now() - startedAt : 0;
    onEnd(finalMs);
  };

  const phase = state === "connected" ? "connected" : "calling";

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-between px-6 py-10"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(30, 20, 15, 0.85) 0%, rgba(0, 0, 0, 0.96) 90%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Call with ${contact.name}`}
    >
      {/* Hidden audio sink for the remote peer's stream. */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Status pill · reflects real WebRTC state honestly. */}
      <div className={`rounded-full border px-3 py-1 text-[10.5px] font-semibold uppercase tracking-wider ${
        errorMessage
          ? "border-red-400/50 bg-red-500/15 text-red-200"
          : state === "connected"
            ? "border-green-400/50 bg-green-500/15 text-green-200"
            : "border-white/25 bg-white/10 text-white/85"
      }`}>
        {errorMessage
          ? "Call failed"
          : state === "connecting"
            ? "Connecting…"
            : state === "ringing"
              ? "Ringing…"
              : state === "connected"
                ? "Connected"
                : "Ended"}
      </div>

      {/* Body · avatar + name + state */}
      <div className="flex flex-col items-center gap-4 text-center">
        {contact.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contact.avatarUrl}
            alt={contact.name}
            className="h-32 w-32 rounded-full object-cover"
            style={{
              backgroundColor: contact.avatarColor,
              boxShadow: `0 0 0 4px ${phase === "connected" ? "#22C55E" : "rgba(255,255,255,0.25)"}`,
            }}
          />
        ) : (
          <span
            className="grid h-32 w-32 place-items-center rounded-full text-[36px] font-semibold text-white"
            style={{
              backgroundColor: contact.avatarColor,
              boxShadow: `0 0 0 4px ${phase === "connected" ? "#22C55E" : "rgba(255,255,255,0.25)"}`,
            }}
          >
            {contact.initials}
          </span>
        )}
        <div>
          <div className="text-[24px] font-semibold text-white">{contact.name}</div>
          {(contact.trade || contact.subtitle) && (
            <div className="mt-0.5 text-[13px] text-white/60">
              {contact.trade || contact.subtitle}
              {contact.city ? ` · ${contact.city}` : ""}
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 text-white/85">
          {phase === "calling" ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              <span className="text-[13px]">Calling…</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="font-mono text-[15px] tabular-nums">{formatRecordTime(elapsedMs)}</span>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={() => {
            if (!callHandle) return;
            setMuted(callHandle.toggleMute());
          }}
          disabled={phase !== "connected" || !callHandle}
          className={`grid h-14 w-14 place-items-center rounded-full transition disabled:opacity-40 ${
            muted ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
          }`}
          aria-label={muted ? "Unmute" : "Mute"}
          aria-pressed={muted}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={handleEnd}
          className="grid h-16 w-16 place-items-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-700"
          aria-label="End call"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>

      {errorMessage && (
        <div className="max-w-md rounded-lg border border-red-400/50 bg-red-950/40 px-3 py-2 text-center text-[11.5px] leading-snug text-red-200">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

// ─── Incoming call overlay · Philip 2026-08-03 ────────────────────────
//
// Appears full-screen when the signaling inbox surfaces an offer for
// this session. Accept → media prompt + peer connection built + audio
// starts. Decline → offer relayed back as `decline` so the caller sees
// the outcome immediately (no ambiguous long silence).
function IncomingCallOverlay({
  offer,
  onAccept,
  onDecline,
}: {
  offer: Extract<CallSignal, { kind: "offer" }> | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  if (!offer) return null;
  const c = offer.contact;
  const name = c?.name ?? "Unknown caller";
  const subtitle = c?.trade ? `${c.trade}${c.city ? " · " + c.city : ""}` : c?.city ?? "";
  const initials = c?.initials ?? "?";
  const avatarColor = c?.avatarColor ?? "#555";

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-between px-6 py-10"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(30, 20, 15, 0.85) 0%, rgba(0, 0, 0, 0.96) 90%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Incoming call from ${name}`}
    >
      <div className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-white/85">
        Incoming call
      </div>

      <div className="flex flex-col items-center gap-4 text-center">
        {c?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.avatarUrl}
            alt={name}
            className="h-32 w-32 animate-pulse rounded-full object-cover"
            style={{ backgroundColor: avatarColor, boxShadow: "0 0 0 4px rgba(34,197,94,0.65)" }}
          />
        ) : (
          <span
            className="grid h-32 w-32 animate-pulse place-items-center rounded-full text-[36px] font-semibold text-white"
            style={{ backgroundColor: avatarColor, boxShadow: "0 0 0 4px rgba(34,197,94,0.65)" }}
          >
            {initials}
          </span>
        )}
        <div>
          <div className="text-[24px] font-semibold text-white">{name}</div>
          {subtitle && <div className="mt-0.5 text-[13px] text-white/60">{subtitle}</div>}
        </div>
      </div>

      <div className="flex items-center gap-10">
        <button
          type="button"
          onClick={onDecline}
          className="grid h-16 w-16 place-items-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-700"
          aria-label="Decline call"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="grid h-16 w-16 place-items-center rounded-full bg-green-500 text-white shadow-lg transition hover:bg-green-600"
          aria-label="Accept call"
        >
          <Phone className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}

// ─── Voice message player · Philip 2026-08-03 ────────────────────────
//
// Custom play/pause + fake waveform (deterministic per message id) +
// live progress + duration. Uses an HTMLAudioElement under the hood.
// Progress fills the bars left-to-right as playback advances so users
// see where they are without a scrubber (kept out of v1 for simplicity).
function VoiceMessagePlayer({
  audio,
  seed,
  isUser,
}: {
  audio: { url: string; durationMs: number };
  seed: string;
  isUser: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const bars = useMemo(() => waveformBars(seed), [seed]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      if (!el.duration || !isFinite(el.duration)) return;
      setProgress(el.currentTime / el.duration);
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
    };
  }, []);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const filledBg = isUser ? "bg-white" : "bg-orange-500";
  const unfilledBg = isUser ? "bg-white/35" : "bg-black/25";

  return (
    <div className="flex items-center gap-2.5">
      <audio ref={audioRef} src={audio.url} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${
          isUser ? "bg-white/25 text-white hover:bg-white/35" : "bg-orange-500 text-white hover:bg-orange-600"
        }`}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5" strokeWidth={2.5} />
        ) : (
          <Play className="h-3.5 w-3.5 translate-x-[1px]" strokeWidth={2.5} fill="currentColor" />
        )}
      </button>
      <div className="flex flex-1 items-center gap-[2px]">
        {bars.map((h, i) => {
          const played = i / bars.length < progress;
          return (
            <span
              key={i}
              className={`w-[3px] rounded-full transition-colors ${played ? filledBg : unfilledBg}`}
              style={{ height: `${h * 0.28 + 4}px` }}
            />
          );
        })}
      </div>
      <span
        className={`shrink-0 font-mono text-[10.5px] tabular-nums ${
          isUser ? "text-white/85" : "text-black/60"
        }`}
      >
        {formatRecordTime(audio.durationMs)}
      </span>
    </div>
  );
}

// ─── Inline cards (Philip 2026-08-03) ────────────────────────────────
//
// v1 supports Meeting + Image Creation. Cards render inside the chat
// stream · above the Nex text bubble. Every card carries an HONEST
// status label and actions. Coming-Soon actions surface a small toast
// instead of pretending to do work · Third Law preserved.

function NexCard({
  card,
  cardState,
  onDismiss,
  onSaveForLater,
  onRespondInvite,
  onCreateSuggestions,
  onDismissSuggestions,
  liveTasks,
  onOpenTasks,
}: {
  card: CardData;
  cardState?: "prepared_waiting";
  onDismiss: () => void;
  onSaveForLater: (state: "prepared_waiting") => void;
  onRespondInvite: (outcome: "connected" | "declined") => void;
  // Commitment-suggestion actions · optional so other card renders don't
  // have to care about them.
  onCreateSuggestions?: (
    itemIds?: string[],
    overrides?: Record<string, { title?: string; dueAt?: string; reminder?: NexTaskReminder }>,
  ) => void;
  onDismissSuggestions?: (itemIds?: string[]) => void;
  // Daily-briefing view · optional. Card is a VIEW of NexTask so the
  // renderer needs the live task list at render time.
  liveTasks?: NexTask[];
  onOpenTasks?: () => void;
}) {
  // Pure dispatch · Continue is the only footer card. Contacts + Play
  // now live as drawer/sheet outside the message stream. Stairs
  // products are inserted from the Play → Stairs drawer. Connect
  // invites arrive as chat cards (real or demo).
  switch (card.type) {
    case "continue":
      return <ContinueCard items={card.items} onDismiss={onDismiss} />;
    case "stairs_product":
      return <StairsProductCard product={card.product} onDismiss={onDismiss} />;
    case "connect_invite":
      return <NexInvitationCard card={card} onRespond={onRespondInvite} onDismiss={onDismiss} />;
    case "staircase_plan":
      return <StaircasePlanCard plan={card.plan} onDismiss={onDismiss} />;
    case "call_summary":
      return <CallSummaryCard card={card} onDismiss={onDismiss} />;
    case "commitment_suggestion":
      return (
        <CommitmentSuggestionCard
          card={card}
          onCreate={(itemIds, overrides) => onCreateSuggestions?.(itemIds, overrides)}
          onDismiss={(itemIds) => onDismissSuggestions?.(itemIds)}
        />
      );
    case "daily_briefing":
      return (
        <DailyBriefingCard
          card={card}
          tasks={liveTasks ?? []}
          onOpenTasks={() => onOpenTasks?.()}
        />
      );
    case "meeting":
    case "image_creation":
      return (
        <NexInfoCard
          card={card}
          cardState={cardState}
          onDismiss={onDismiss}
          onSaveForLater={onSaveForLater}
        />
      );
  }
}

// ─── Stairs product card · rich media insertion in chat ─────────────
//
// Philip 2026-08-03. Renders when an owner selects a product from the
// Stairs drawer. Full-bleed image with name overlay · description +
// price + delivery badge underneath. Themed automatically via existing
// theme scoping (dark walnut bubble on Walnut Sanctum · cream on GE etc.)
function StairsProductCard({
  product,
  onDismiss,
}: {
  product: StairsProduct;
  onDismiss: () => void;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  useOverlayDismiss(lightboxOpen, () => setLightboxOpen(false));

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        {/* Sender attribution · Philip 2026-08-03. Slim row above the
            image · coloured-initial avatar + business name + optional
            role. Shows WHO shared this product (matters in merchant
            threads). Regular text bubbles don't need this because
            left/right already tells you the sender. */}
        <div className="flex items-center gap-2 border-b border-black/5 bg-neutral-50/60 px-3 py-2">
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold text-white"
            style={{ backgroundColor: product.uploadedBy.avatarColor }}
            aria-hidden="true"
          >
            {product.uploadedBy.initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-semibold text-black">
              {product.uploadedBy.name}
            </div>
            {product.uploadedBy.role && (
              <div className="truncate text-[10.5px] text-black/55">
                {product.uploadedBy.role}
              </div>
            )}
          </div>
        </div>

        {/* Full-bleed image with name overlay · click image to enlarge.
            Overlays use pointer-events-none so clicks pass through to the
            image button underneath (except the red X which stays clickable). */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="absolute inset-0 h-full w-full cursor-zoom-in"
            aria-label={`View ${product.name} full size`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </button>
          {/* Gradient veil · pointer-events-none so image button receives clicks */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          {/* Name overlay · pointer-events-none for the same reason */}
          <div className="pointer-events-none absolute inset-x-3 bottom-2.5 text-white">
            <div className="text-[14px] font-semibold leading-tight drop-shadow">
              {product.name}
            </div>
          </div>
          {/* Remove button · DARK RED · sits above the image button so it stays clickable */}
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-red-700 text-white shadow-lg ring-2 ring-white/80 transition hover:scale-105 hover:bg-red-800 active:scale-95"
            aria-label="Remove this product from the chat"
            title="Remove"
          >
            <XIcon className="h-4 w-4" strokeWidth={2.6} />
          </button>
        </div>

        {/* Description + price + delivery */}
        <div className="px-3.5 py-3">
          {product.description && (
            <p className="text-[12.5px] leading-snug text-black/70">
              {product.description}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {product.price !== null && (
              <span className="inline-flex items-center rounded-full bg-orange-500 px-2.5 py-1 text-[12px] font-bold text-white">
                £{product.price.toLocaleString("en-GB")}
              </span>
            )}
            {product.deliveryIncluded && (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800">
                Delivery
              </span>
            )}
            {product.vatIncluded && (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800">
                VAT
              </span>
            )}
            {product.installationIncluded && (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800">
                Installation
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen lightbox · tap backdrop or X to close · ESC dismisses.
          Renders above every other overlay (z-[100]). Product name +
          optional price shown as caption for context. */}
      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name} full size`}
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 p-4 backdrop-blur-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.imageUrl}
            alt={product.name}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/95 text-black shadow-2xl transition hover:bg-white"
            aria-label="Close full-size view"
          >
            <XIcon className="h-5 w-5" strokeWidth={2.4} />
          </button>
          <div className="pointer-events-none absolute inset-x-4 bottom-6 text-center text-white">
            <div className="text-[15px] font-semibold drop-shadow">{product.name}</div>
            {product.price !== null && (
              <div className="mt-1 text-[13px] opacity-90 drop-shadow">
                £{product.price.toLocaleString("en-GB")}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function NexInfoCard({
  card,
  cardState,
  onDismiss,
  onSaveForLater,
}: {
  card: MeetingCardData | ImageCreationCardData;
  cardState?: "prepared_waiting";
  onDismiss: () => void;
  onSaveForLater: (state: "prepared_waiting") => void;
}) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const isMeeting = card.type === "meeting";
  // Prepared · waiting state = user has saved the meeting card for later
  // (Philip 2026-08-03 · replaces the "coming soon" toast rejection).
  const isPreparedWaiting = isMeeting && cardState === "prepared_waiting";
  const iconTone = isMeeting ? "bg-orange-500" : "bg-neutral-800";

  // Distinct visual states · Philip 2026-08-03.
  //   requires_connection → amber (needs user action)
  //   coming_soon         → neutral "In Development" (feature in progress)
  //   prepared_waiting    → emerald "Saved · Waiting" (work preserved)
  const statusTone = isPreparedWaiting
    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : card.status === "coming_soon"
    ? "bg-neutral-100 text-neutral-700 border-neutral-200"
    : "bg-amber-50 text-amber-800 border-amber-200";

  // Philip 2026-08-03 · aligned to the Universal Task Lifecycle. "Saved"
  // is reserved in the lifecycle for the moment the meeting actually
  // lands in the external calendar. Before that, Nex is HOLDING the
  // intent while the card stays in the "Waiting for Calendar" state ·
  // the emerald tone + pulse dot signal user confirmation without
  // claiming a save that hasn't happened. (Third Law.)
  const statusLabel = isPreparedWaiting
    ? "Held · Waiting for Calendar"
    : card.status === "coming_soon" && card.type === "image_creation"
    ? "In Development · Preview"
    : card.status_label;

  // Actions morph when the card has been saved for later. Original
  // "Connect" is replaced with next-step actions on the saved work.
  const displayedActions: CardAction[] = isPreparedWaiting
    ? [
        {
          kind: "coming_soon",
          label: "Edit",
          toast: "Editing lands when the Calendar card becomes live.",
        },
        { kind: "dismiss", label: "Delete" },
        {
          kind: "coming_soon",
          label: "Notify me",
          toast: "I'll surface this the moment Calendar is available.",
        },
      ]
    : card.actions;

  const handleAction = (a: CardAction) => {
    if (a.kind === "dismiss") onDismiss();
    if (a.kind === "coming_soon") setToast(a.toast);
    if (a.kind === "save_for_later") onSaveForLater(a.state);
    // link actions handled by their own <Link>
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-black/5 bg-neutral-50/60 px-3.5 py-2.5">
        <span className={`grid h-7 w-7 place-items-center rounded-full text-white ${iconTone}`}>
          {isMeeting ? (
            <CalendarClock className="h-3.5 w-3.5" strokeWidth={2.2} />
          ) : (
            <ImageIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
          )}
        </span>
        <div className="flex-1 text-[13px] font-semibold text-black">
          {isMeeting ? "Meeting" : "Image"}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="grid h-6 w-6 place-items-center rounded-full text-black/40 hover:bg-black/[0.05] hover:text-black/70"
          aria-label="Dismiss card"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Fields */}
      <div className="space-y-1.5 px-3.5 py-3">
        {isMeeting ? (
          <>
            <CardField label="Title" value={card.fields.title} />
            <CardField label="Date" value={card.fields.date} icon={<CalendarClock className="h-3 w-3" />} />
            <CardField label="Time" value={card.fields.time} icon={<Clock className="h-3 w-3" />} />
            <CardField label="Reminder" value={card.fields.reminder} />
          </>
        ) : (
          <>
            <CardField label="Subject" value={card.fields.subject} />
            <CardField label="Text on it" value={card.fields.overlay} icon={<Type className="h-3 w-3" />} />
            <CardField label="Format" value={card.fields.format} />
          </>
        )}
      </div>

      {/* Status */}
      <div className="px-3.5 pb-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold ${statusTone}`}
        >
          {isPreparedWaiting && (
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"
            />
          )}
          {statusLabel}
        </span>
      </div>

      {/* Actions */}
      {displayedActions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-black/5 bg-neutral-50/30 px-3 py-2.5">
          {displayedActions.map((a, i) => {
            if (a.kind === "link") {
              return (
                <Link
                  key={i}
                  href={a.href}
                  className="inline-flex items-center rounded-full border border-orange-300 bg-white px-3 py-1 text-[11.5px] font-semibold text-orange-800 shadow-sm hover:bg-orange-50"
                >
                  {a.label}
                </Link>
              );
            }
            if (a.kind === "coming_soon") {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAction(a)}
                  className="inline-flex items-center rounded-full border border-black/10 bg-white px-3 py-1 text-[11.5px] font-medium text-black/70 shadow-sm hover:bg-black/[0.03]"
                >
                  {a.label}
                </button>
              );
            }
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleAction(a)}
                className="inline-flex items-center rounded-full px-3 py-1 text-[11.5px] font-medium text-black/50 hover:text-black/80"
              >
                {a.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Toast · honest coming-soon note */}
      {toast && (
        <div className="border-t border-black/5 bg-amber-50 px-3.5 py-2 text-[11.5px] leading-snug text-amber-900">
          {toast}
        </div>
      )}
    </div>
  );
}

function CardField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  const isMissing = value === "Not specified";
  return (
    <div className="flex items-start gap-2 text-[12.5px] leading-snug">
      <span className="w-[68px] shrink-0 text-[10px] font-semibold uppercase tracking-wider text-black/45">
        {label}
      </span>
      <span
        className={`flex flex-1 items-center gap-1.5 ${isMissing ? "italic text-black/40" : "text-black"}`}
      >
        {icon}
        {value}
      </span>
    </div>
  );
}

// ─── Workspace cards (Philip 2026-08-03 · persistent footer targets) ─
//
// Contacts · Tasks · Projects — injected by the persistent footer
// buttons. Never navigate the user away · always render inline. Each
// card carries an HONEST status.

// ─── Continue card · Philip 2026-08-03 · Now + Ongoing lanes ─────────
//
// Unified hub replacing the split Workspace + Projects cards. TWO lanes:
//   · Now      — session card-objects (meetings, image jobs, etc.)
//   · Ongoing  — customer projects (multi-conversation, multi-week)
// Answers the North Star: "Every conversation moves you forward."
function ContinueCard({
  items,
  onDismiss,
}: {
  items: ContinueCardData["items"];
  onDismiss: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let cancelled = false;
    const refresh = async () => {
      try {
        const open = await listOpenProjects();
        if (!cancelled) setProjects(open);
      } catch {
        /* silent · graceful degradation */
      }
    };
    void refresh();
    const handler = () => { void refresh(); };
    window.addEventListener(PROJECTS_UPDATED_EVENT, handler);
    return () => {
      cancelled = true;
      window.removeEventListener(PROJECTS_UPDATED_EVENT, handler);
    };
  }, []);

  const isEmpty = items.length === 0 && mounted && projects.length === 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <WorkspaceCardHeader
        icon={<Layers className="h-3.5 w-3.5" strokeWidth={2.2} />}
        title="Continue"
        onDismiss={onDismiss}
      />

      {isEmpty ? (
        <div className="px-3.5 py-4">
          <p className="text-[12.5px] leading-snug italic text-black/50">
            Nothing active yet. Ask Nex what you want to accomplish — anything you
            start will land here so you can pick up where you left off.
          </p>
        </div>
      ) : (
        <>
          {/* Now · session workspace items */}
          {items.length > 0 && (
            <>
              <div className="border-b border-black/5 bg-orange-50/40 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-orange-800">
                Now
              </div>
              <div className="px-3.5 py-2.5">
                <ul className="space-y-1.5">
                  {items.map((it, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-xl border border-black/5 bg-neutral-50/60 px-2.5 py-2 text-[12.5px]"
                    >
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${
                          it.kind === "meeting"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-neutral-200 text-neutral-700"
                        }`}
                      >
                        {it.kind === "meeting" ? (
                          <CalendarClock className="h-3 w-3" />
                        ) : (
                          <ImageIcon className="h-3 w-3" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-black">
                          {it.title}
                        </span>
                        <span className="text-[10.5px] text-black/55">{it.detail}</span>
                      </span>
                      {it.status && (
                        <span className="shrink-0 rounded-full border border-neutral-200 bg-white px-1.5 py-0.5 text-[9.5px] font-semibold text-neutral-700">
                          {it.status}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Ongoing · customer projects */}
          {projects.length > 0 && (
            <>
              <div className="border-b border-t border-black/5 bg-orange-50/40 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-orange-800">
                Ongoing
              </div>
              <div className="px-3.5 py-2.5">
                <ul className="space-y-1.5">
                  {projects.slice(0, 5).map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/nex-app/projects/${p.id}`}
                        className="flex items-center gap-2 rounded-xl border border-black/5 bg-neutral-50/60 px-2.5 py-2 text-[12.5px] hover:border-orange-200 hover:bg-orange-50/40"
                      >
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-orange-100 text-orange-700">
                          <FolderOpen className="h-3 w-3" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-black">{p.title}</span>
                          <span className="text-[10px] text-black/50">{p.merchant_name}</span>
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-black/30" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              {projects.length > 5 && (
                <div className="border-t border-black/5 bg-neutral-50/30 px-3 py-2">
                  <Link
                    href="/nex-app/projects"
                    className="text-[11.5px] font-semibold text-orange-800 hover:text-orange-900"
                  >
                    See all {projects.length} projects →
                  </Link>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function WorkspaceCardHeader({
  icon,
  title,
  onDismiss,
}: {
  icon: React.ReactNode;
  title: string;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-black/5 bg-neutral-50/60 px-3.5 py-2.5">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-neutral-800 text-white">
        {icon}
      </span>
      <div className="flex-1 text-[13px] font-semibold text-black">{title}</div>
      <button
        type="button"
        onClick={onDismiss}
        className="grid h-6 w-6 place-items-center rounded-full text-black/40 hover:bg-black/[0.05] hover:text-black/70"
        aria-label="Dismiss card"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Ambient Animation Library · Philip 2026-08-03 ─────────────────
//
// A catalog of ambient particle animations the user picks from via the
// Play → Animation drawer. Split into two sets:
//   · "user"  — homeowner-facing (calm, aspirational, nature-inspired)
//   · "trade" — construction/craft-inspired
//
// The library is the single source of truth: adding a new animation is
// a one-entry addition here + a new keyframe in AmbientKeyframesCSS if
// the motion pattern isn't already covered.
//
// User's chosen animation id persists to localStorage `nex.play.animation.id`
// and overrides the theme's default. Toggle in the Play sheet enables/
// disables the currently-selected animation.

type AmbientAnimation = {
  id: string;
  displayName: string;
  description: string;
  set: "user" | "trade";
  particle: {
    color: string;
    glow: string;
    count: number;              // particle density (frame-budget capped)
    minSize: number;            // px
    sizeRange: number;          // px added to min
    minDuration: number;        // seconds
    durationRange: number;      // seconds added to min
    direction: "up" | "down";
    rotate: boolean;            // spin during travel (petals/leaves)
    swayAmount: number;         // px horizontal drift
  };
};

const AMBIENT_LIBRARY: AmbientAnimation[] = [
  // ─── Yours (user set) ─────────────────────────────────────────────
  {
    id: "cherry_petals",
    displayName: "Cherry Petals",
    description: "Soft pink · falling",
    set: "user",
    particle: {
      color: "#F9C5D8",
      glow: "rgba(249, 197, 216, 0.60)",
      count: 25,
      minSize: 2, sizeRange: 4,
      minDuration: 12, durationRange: 10,
      direction: "down",
      rotate: true,
      swayAmount: 60,
    },
  },
  {
    id: "golden_dust",
    displayName: "Golden Dust",
    description: "Champagne motes · rising",
    set: "user",
    particle: {
      color: "#D6B58A",
      glow: "rgba(214, 181, 138, 0.55)",
      count: 20,
      minSize: 2, sizeRange: 4,
      minDuration: 12, durationRange: 10,
      direction: "up",
      rotate: false,
      swayAmount: 60,
    },
  },
  {
    id: "autumn_leaves",
    displayName: "Autumn Leaves",
    description: "Amber · drifting down",
    set: "user",
    particle: {
      color: "#D97706",
      glow: "rgba(217, 119, 6, 0.50)",
      count: 15,
      minSize: 3, sizeRange: 5,
      minDuration: 15, durationRange: 12,
      direction: "down",
      rotate: true,
      swayAmount: 80,
    },
  },
  {
    id: "fireflies",
    displayName: "Fireflies",
    description: "Warm glow · slow drift",
    set: "user",
    particle: {
      color: "#FDE047",
      glow: "rgba(253, 224, 71, 0.85)",
      count: 12,
      minSize: 3, sizeRange: 3,
      minDuration: 20, durationRange: 8,
      direction: "up",
      rotate: false,
      swayAmount: 40,
    },
  },
  {
    id: "snow",
    displayName: "Snow",
    description: "White flakes · falling",
    set: "user",
    particle: {
      color: "#FFFFFF",
      glow: "rgba(255, 255, 255, 0.70)",
      count: 30,
      minSize: 2, sizeRange: 3,
      minDuration: 14, durationRange: 10,
      direction: "down",
      rotate: false,
      swayAmount: 40,
    },
  },
  // ─── Trades (trade set) ───────────────────────────────────────────
  {
    id: "amber_embers",
    displayName: "Amber Embers",
    description: "Warm embers · rising",
    set: "trade",
    particle: {
      color: "#C9A05F",
      glow: "rgba(201, 160, 95, 0.75)",
      count: 15,
      minSize: 2, sizeRange: 3,
      minDuration: 16, durationRange: 8,
      direction: "up",
      rotate: false,
      swayAmount: 60,
    },
  },
  {
    id: "wood_dust",
    displayName: "Wood Dust",
    description: "Sawdust · rising",
    set: "trade",
    particle: {
      color: "#8B6534",
      glow: "rgba(139, 101, 52, 0.50)",
      count: 22,
      minSize: 1, sizeRange: 2,
      minDuration: 14, durationRange: 8,
      direction: "up",
      rotate: false,
      swayAmount: 50,
    },
  },
  {
    id: "welding_sparks",
    displayName: "Welding Sparks",
    description: "Bright arcs · falling",
    set: "trade",
    particle: {
      color: "#FCD34D",
      glow: "rgba(252, 211, 77, 0.90)",
      count: 10,
      minSize: 1, sizeRange: 2,
      minDuration: 3, durationRange: 3,
      direction: "down",
      rotate: false,
      swayAmount: 20,
    },
  },
  {
    id: "sanding_dust",
    displayName: "Sanding Dust",
    description: "Fine powder · slow rise",
    set: "trade",
    particle: {
      color: "#E6D5B8",
      glow: "rgba(230, 213, 184, 0.50)",
      count: 30,
      minSize: 1, sizeRange: 1.5,
      minDuration: 18, durationRange: 10,
      direction: "up",
      rotate: false,
      swayAmount: 40,
    },
  },
  {
    id: "metal_filings",
    displayName: "Metal Filings",
    description: "Silver curls · falling",
    set: "trade",
    particle: {
      color: "#94A3B8",
      glow: "rgba(148, 163, 184, 0.40)",
      count: 12,
      minSize: 2, sizeRange: 2,
      minDuration: 12, durationRange: 6,
      direction: "down",
      rotate: true,
      swayAmount: 30,
    },
  },
];

const AMBIENT_STORAGE_KEY = "nex.play.animation.id";

// Sensible default per theme when the user hasn't picked yet.
function defaultAnimationFor(themeId: string): string | null {
  if (themeId === "blossom") return "cherry_petals";
  if (themeId === "staircase_light_cream") return "golden_dust";
  if (themeId === "staircase_walnut") return "amber_embers";
  return null; // Original Nex stays calm
}

function findAnimation(id: string | null): AmbientAnimation | null {
  if (!id) return null;
  return AMBIENT_LIBRARY.find((a) => a.id === id) ?? null;
}

// ─── Ambient particles · theme-signature animation (Philip 2026-08-03) ─
//
// Runs when the Animation toggle is on (via Play sheet). Each theme owns
// ONE ambient signature that communicates its personality without noise:
//   · Original Nex   → no ambient (immutable home stays calm)
//   · Blossom        → cherry petals falling diagonally (25 particles, warm pink)
//   · Grand Entrance → golden dust motes drifting up (20 particles, champagne)
//   · Walnut Sanctum → warm amber embers drifting up slowly (15 particles, sconce amber)
//
// Compositions:
//   · Respects prefers-reduced-motion (motion-reduce:hidden)
//   · Frame-budget capped by particle count (validator's animation_frame_budget gate)
//   · Scoped fixed-position layer, pointer-events-none, z-5 (above wallpaper, below UI)
//   · Particle positions/timings computed once via useMemo — stable across renders
type ParticleSpec = {
  id: number;
  left: number;      // vw %
  size: number;      // px
  duration: number;  // s
  delay: number;     // s (negative to start mid-animation)
  swayX: number;     // px
  opacity: number;   // 0-1
};

function AmbientParticles({
  animationId,
  active,
}: {
  animationId: string | null;
  active: boolean;
}) {
  const anim = useMemo(() => findAnimation(animationId), [animationId]);
  // Stable random specs · never regenerated across renders. Keyed by
  // animation id so switching animations gives a fresh distribution.
  const specs = useMemo<ParticleSpec[]>(() => {
    if (!anim) return [];
    const p = anim.particle;
    return Array.from({ length: p.count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: p.minSize + Math.random() * p.sizeRange,
      duration: p.minDuration + Math.random() * p.durationRange,
      delay: -Math.random() * (p.minDuration + p.durationRange),
      swayX: (Math.random() - 0.5) * p.swayAmount,
      opacity: 0.5 + Math.random() * 0.4,
    }));
  }, [anim]);

  if (!active || !anim || specs.length === 0) return null;

  const particleCfg = anim.particle;
  const isFalling = particleCfg.direction === "down";
  const animationName = particleCfg.rotate
    ? (isFalling ? "nex-petal-fall" : "nex-dust-drift")
    : (isFalling ? "nex-spark-fall" : "nex-dust-drift");
  const startFrom = isFalling ? "top: -12px" : "bottom: -12px";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[5] overflow-hidden motion-reduce:hidden"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes nex-dust-drift {
  0%   { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
  10%  { opacity: var(--nex-particle-opacity, 0.7); }
  90%  { opacity: var(--nex-particle-opacity, 0.7); }
  100% { transform: translate3d(var(--nex-sway, 0), -110vh, 0) rotate(360deg); opacity: 0; }
}
@keyframes nex-petal-fall {
  0%   { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
  10%  { opacity: var(--nex-particle-opacity, 0.85); }
  90%  { opacity: var(--nex-particle-opacity, 0.85); }
  100% { transform: translate3d(var(--nex-sway, 0), 110vh, 0) rotate(720deg); opacity: 0; }
}
@keyframes nex-spark-fall {
  0%   { transform: translate3d(0, 0, 0); opacity: 0; filter: brightness(1); }
  8%   { opacity: var(--nex-particle-opacity, 0.90); filter: brightness(1.6); }
  60%  { opacity: var(--nex-particle-opacity, 0.75); filter: brightness(1.3); }
  100% { transform: translate3d(var(--nex-sway, 0), 110vh, 0); opacity: 0; filter: brightness(0.9); }
}
`,
        }}
      />
      {specs.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full"
          style={
            {
              left: `${p.left}%`,
              [isFalling ? "top" : "bottom"]: "-12px",
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: particleCfg.color,
              boxShadow: `0 0 ${p.size * 2}px ${particleCfg.glow}`,
              animation: `${animationName} ${p.duration}s linear infinite`,
              animationDelay: `${p.delay}s`,
              willChange: "transform, opacity",
              ["--nex-sway" as string]: `${p.swayX}px`,
              ["--nex-particle-opacity" as string]: String(p.opacity),
            } as React.CSSProperties
          }
        />
      ))}
      {/* startFrom hint (kept as inline comment for future readers) */}
      <span className="hidden">{startFrom}</span>
    </div>
  );
}

// ─── Staircase Plan card · Philip 2026-08-03 ──────────────────────
// Inserted when the owner picks a plan from Play → Staircase Plans.
// Compact rich card showing the shape glyph + name + description.
function StaircasePlanCard({
  plan,
  onDismiss,
}: {
  plan: StaircasePlan;
  onDismiss: () => void;
}) {
  const hasModel = Boolean(plan.modelUrl);
  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      {/* Inline 3D viewer (Philip 2026-08-03) · only when plan.modelUrl
          is set. <model-viewer> is loaded via next/script from Google's
          CDN. Camera controls + auto-rotate for a subtle live tumble.
          Red remove-X overlays top-right so it's always accessible. */}
      {hasModel && (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-50">
          <model-viewer
            src={plan.modelUrl}
            alt={plan.name}
            camera-controls
            auto-rotate
            interaction-prompt="none"
            exposure="1"
            shadow-intensity="0.6"
            style={{ width: "100%", height: "100%", backgroundColor: "#F5F5F0" }}
          />
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-red-700 text-white shadow-lg ring-2 ring-white/80 hover:bg-red-800"
            aria-label="Remove this plan from the chat"
          >
            <XIcon className="h-4 w-4" strokeWidth={2.6} />
          </button>
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-white backdrop-blur">
            3D · drag to rotate
          </span>
        </div>
      )}
      <div className="flex items-start gap-3 px-3.5 py-3">
        <span
          aria-hidden="true"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-orange-100 text-[26px] font-bold text-orange-800"
        >
          {plan.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[9.5px] font-semibold uppercase tracking-wider text-black/45">
            Staircase Plan
          </div>
          <div className="mt-0.5 text-[13.5px] font-semibold text-black">
            {plan.name}
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-black/65">
            {plan.description}
          </p>
        </div>
        {!hasModel && (
          <button
            type="button"
            onClick={onDismiss}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-700 text-white shadow-sm ring-2 ring-white/80 hover:bg-red-800"
            aria-label="Remove this plan from the chat"
          >
            <XIcon className="h-3.5 w-3.5" strokeWidth={2.6} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Nex Invitation card · Accept / Decline · Philip 2026-08-03 ────
//
// Arrives in the chat when someone (real or demo) wants to connect via
// Nex ID. Sender identity + role at top, Accept/Decline actions at
// bottom. After response, the card re-renders in a "Connected" or
// "Declined" state (still visible so history is preserved).
function NexInvitationCard({
  card,
  onRespond,
  onDismiss,
}: {
  card: ConnectInviteCardData;
  onRespond: (outcome: "connected" | "declined") => void;
  onDismiss: () => void;
}) {
  const outcome = card.outcome ?? "pending";
  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      {/* Sender header */}
      <div className="flex items-center gap-2.5 border-b border-black/5 bg-neutral-50/60 px-3.5 py-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12.5px] font-semibold text-white"
          style={{ backgroundColor: card.fromAvatarColor }}
          aria-hidden="true"
        >
          {card.fromInitials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold text-black">
              {card.fromName}
            </span>
            {card.isDemo && (
              <span className="shrink-0 rounded-full border border-black/10 bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-black/50">
                Demo
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-[10.5px] text-black/55">
            Nex ID · {card.fromNexId}
            {card.fromRole && ` · ${card.fromRole}`}
          </div>
        </div>
      </div>

      {/* Body copy */}
      <div className="px-3.5 py-3">
        <p className="text-[12.5px] leading-snug text-black/75">
          <strong className="text-black">{card.fromName}</strong> would like to
          connect with you on Nex.
        </p>
      </div>

      {/* Outcome-aware footer */}
      {outcome === "pending" ? (
        <div className="flex gap-2 border-t border-black/5 bg-neutral-50/30 px-3 py-3">
          <button
            type="button"
            onClick={() => onRespond("declined")}
            className="flex-1 rounded-full border border-black/10 bg-white py-2 text-[12px] font-semibold text-black/70 hover:bg-black/[0.03]"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => onRespond("connected")}
            className="flex-[1.4] rounded-full bg-orange-500 py-2 text-[12.5px] font-semibold text-white shadow-sm hover:bg-orange-600"
          >
            Accept
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between border-t border-black/5 bg-neutral-50/30 px-3.5 py-2.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
              outcome === "connected"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-neutral-200 bg-neutral-100 text-black/60"
            }`}
          >
            {outcome === "connected" ? "Connected" : "Declined"}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            className="text-[11px] font-semibold text-black/40 hover:text-black/70"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Long-press hook · Philip 2026-08-03 ──────────────────────────
//
// Fires `onComplete` after the user holds for `durationMs`. Exposes a
// live-updating `seconds` countdown so the UI can render a 5-4-3-2-1
// visual timer. Handles mouse + touch, and cancels on release, leave,
// or touch-cancel. Cleans up all timers on unmount.
function useLongPress(onComplete: () => void, durationMs = 5000) {
  const [seconds, setSeconds] = useState<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbackRef = useRef(onComplete);
  useEffect(() => {
    callbackRef.current = onComplete;
  }, [onComplete]);

  const cancel = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
    setSeconds(null);
  };

  const start = () => {
    if (timeoutRef.current) return; // already holding
    const totalSecs = Math.max(1, Math.ceil(durationMs / 1000));
    setSeconds(totalSecs);
    intervalRef.current = setInterval(() => {
      setSeconds((s) => (s === null ? null : Math.max(0, s - 1)));
    }, 1000);
    timeoutRef.current = setTimeout(() => {
      callbackRef.current();
      cancel();
    }, durationMs);
  };

  useEffect(() => () => cancel(), []);

  const bind = {
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchCancel: cancel,
  };

  return { bind, seconds, total: Math.max(1, Math.ceil(durationMs / 1000)) };
}

// ─── Overlay chrome · backdrop + ESC-key dismiss (shared) ───────────
//
// The drawer + sheet both dim the page and dismiss on ESC. Body scroll
// is locked via a MODULE-LEVEL REF COUNTER so stacked overlays (Play
// sheet + Feature drawer at once) unlock cleanly when all close —
// avoids the leftover `overflow: hidden` bug that hid the footer +
// broke scroll after inserting a product into chat (Philip 2026-08-03).
let __nexOverlayLockCount = 0;
function useOverlayDismiss(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    __nexOverlayLockCount += 1;
    if (__nexOverlayLockCount === 1) {
      document.documentElement.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      __nexOverlayLockCount = Math.max(0, __nexOverlayLockCount - 1);
      if (__nexOverlayLockCount === 0) {
        document.documentElement.style.overflow = "";
      }
    };
  }, [open, onClose]);
}

// ─── Contacts drawer · right-side · landscape cards ─────────────────
//
// Philip 2026-08-03. Opens when the footer Contacts button is tapped.
// Full-height drawer sliding in from the right edge (85vw mobile, 380px
// desktop). Vertically scrolling body with landscape contact cards
// (avatar left, name/status middle, action right). v1: honest empty
// state · real contact source lands as a later slice.
function ContactsDrawer({
  open,
  myNexId,
  sentInvites,
  onSendInvite,
  onCancelInvite,
  onSimulateIncoming,
  onStartCall,
  onClose,
}: {
  open: boolean;
  myNexId: string;
  sentInvites: SentInvite[];
  onSendInvite: (targetNexId: string) => void;
  onCancelInvite: (id: string) => void;
  onSimulateIncoming: () => void;
  onStartCall: (contact: MockContact) => void;
  onClose: () => void;
}) {
  useOverlayDismiss(open, onClose);
  return (
    <>
      {/* Backdrop · dim + dismiss on tap */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      {/* Drawer · right-anchored · slides in from the right */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Contacts"
        className={`nex-drawer-dark fixed right-0 top-0 bottom-0 z-50 flex w-[85vw] max-w-[380px] flex-col overflow-hidden rounded-l-3xl border border-black/10 bg-white/95 shadow-2xl backdrop-blur transition-transform duration-320 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header ROW · no container/background — just icon + title on
            left, close X on right, floating above the scrollable body
            (Philip 2026-08-03). */}
        <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 text-white">
            <Users className="h-4 w-4" strokeWidth={2.2} />
            <span className="text-[14px] font-semibold">Contacts</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80 backdrop-blur hover:bg-white/20 hover:text-white"
            aria-label="Close contacts"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        {/* Body · scrollable · three-section landscape card list */}
        <ContactsDrawerBody
          myNexId={myNexId}
          sentInvites={sentInvites}
          onSendInvite={onSendInvite}
          onCancelInvite={onCancelInvite}
          onSimulateIncoming={onSimulateIncoming}
          onStartCall={onStartCall}
          onClose={onClose}
        />
      </aside>
    </>
  );
}

// ─── Contacts drawer body · Active / People / Trades ────────────────
//
// Groups MOCK_CONTACTS into three sections in this order:
//   1. Active  — live threads by recency (mix of trades + people)
//   2. People  — non-professional contacts (friends · family · colleagues)
//   3. Trades  — professional contacts (from Trade Centre)
// Every card carries a "Preview" chip so demo contacts are never mistaken
// for real connections (Third Law · Evidence-or-Silence).
function ContactsDrawerBody({
  myNexId,
  sentInvites,
  onSendInvite,
  onCancelInvite,
  onSimulateIncoming,
  onStartCall,
  onClose,
}: {
  myNexId: string;
  sentInvites: SentInvite[];
  onSendInvite: (targetNexId: string) => void;
  onCancelInvite: (id: string) => void;
  onSimulateIncoming: () => void;
  onStartCall: (contact: MockContact) => void;
  onClose: () => void;
}) {
  // Blocked contacts · session-local state (real backend later).
  // Seed: Redfern Electrics starts blocked so the section is visible
  // for design demo. Any card block/unblock toggles this set.
  const [blockedIds, setBlockedIds] = useState<Set<string>>(
    () => new Set(["c9"]),
  );
  const blockContact = (id: string) =>
    setBlockedIds((prev) => new Set([...prev, id]));
  const unblockContact = (id: string) =>
    setBlockedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  // Living Profile sheet · which contact is open · null = closed.
  const [profileContactId, setProfileContactId] = useState<string | null>(null);
  const profileContact = profileContactId
    ? MOCK_CONTACTS.find((c) => c.id === profileContactId) ?? null
    : null;

  const notBlocked = (c: MockContact) => !blockedIds.has(c.id);
  const active = MOCK_CONTACTS.filter((c) => c.active && notBlocked(c));
  const people = MOCK_CONTACTS.filter(
    (c) => !c.active && c.relationship === "person" && notBlocked(c),
  );
  const trades = MOCK_CONTACTS.filter(
    (c) => !c.active && c.relationship === "trade" && notBlocked(c),
  );
  const blockedContacts = MOCK_CONTACTS.filter((c) => blockedIds.has(c.id));

  // Filter out expired invites (>5 working days). Expiry is checked
  // every time the drawer body renders — cheap, always accurate.
  const visibleInvites = sentInvites.filter(
    (i) => i.status === "pending" && workingDaysSince(i.sentAt) < NEX_ID_MAX_WORKING_DAYS,
  );

  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const handleConnect = () => {
    setAddError(null);
    const normalized = normalizeNexId(addInput);
    if (!normalized) {
      setAddError("Enter a Nex ID like @sarah.chen or @nex_a3b7c9");
      return;
    }
    if (normalized === myNexId) {
      setAddError("That's your own Nex ID.");
      return;
    }
    if (visibleInvites.some((i) => i.targetNexId === normalized)) {
      setAddError("You've already invited this Nex ID — check Sent Invites.");
      return;
    }
    onSendInvite(normalized);
    setAddInput("");
  };

  return (
    <>
    <div className="nex-hide-scroll flex-1 overflow-y-auto px-3 pt-2 pb-3">
      {/* Connect form · directly under the header, NO container (Philip
          2026-08-03). Small divider below separates from members. */}
      <div>
        <div className="text-[9.5px] font-semibold uppercase tracking-wider text-white/50">
          Nex ID
        </div>
        <input
          type="text"
          inputMode="text"
          placeholder="@sarah.chen or @nex_a3b7c9"
          value={addInput}
          onChange={(e) => setAddInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConnect();
          }}
          className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[12.5px] text-white outline-none placeholder:text-white/35 focus:border-white/40"
        />
        {addError && (
          <div className="mt-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 px-2.5 py-1.5 text-[11px] leading-snug text-amber-100">
            {addError}
          </div>
        )}
        <button
          type="button"
          onClick={handleConnect}
          disabled={!addInput.trim()}
          className="mt-2 w-full rounded-xl py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: "#065F46" }}
        >
          Connect
        </button>
      </div>
      {/* Small centered divider · separates Connect from members */}
      <div className="my-3 flex items-center justify-center">
        <div className="h-px w-16 bg-white/20" />
      </div>

      {/* Sent Invites · pending, amber tint, working-day countdown */}
      {visibleInvites.length > 0 && (
        <>
          <ContactSectionHeader
            label={`Sent Invites · Waiting`}
            count={visibleInvites.length}
          />
          <ul className="space-y-1.5">
            {visibleInvites.map((inv) => {
              const days = workingDaysSince(inv.sentAt);
              const remaining = Math.max(0, NEX_ID_MAX_WORKING_DAYS - days);
              return (
                <li key={inv.id}>
                  <div className="nex-invite-waiting flex items-center gap-3 rounded-2xl px-3 py-2.5">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-500/25 text-[13px] font-semibold text-red-100"
                      aria-hidden="true"
                    >
                      ⏳
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-black">
                        {inv.targetNexId}
                      </div>
                      <div className="mt-0.5 text-[11px] text-red-100/85">
                        Waiting to accept · {remaining} working day{remaining === 1 ? "" : "s"} left
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onCancelInvite(inv.id)}
                      className="shrink-0 rounded-full bg-red-700 px-2.5 py-1 text-[10.5px] font-semibold text-white shadow-sm hover:bg-red-800"
                      aria-label={`Cancel invite to ${inv.targetNexId}`}
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {active.length > 0 && (
        <>
          <ContactSectionHeader label="Active" count={active.length} />
          <ul className="space-y-1.5">
            {active.map((c) => (
              <ContactCard key={c.id} contact={c} onOpenProfile={setProfileContactId} />
            ))}
          </ul>
        </>
      )}

      {people.length > 0 && (
        <>
          <ContactSectionHeader label="People" count={people.length} />
          <ul className="space-y-1.5">
            {people.map((c) => (
              <ContactCard key={c.id} contact={c} onOpenProfile={setProfileContactId} />
            ))}
          </ul>
        </>
      )}

      {trades.length > 0 && (
        <>
          <ContactSectionHeader label="Trades" count={trades.length} />
          <ul className="space-y-1.5">
            {trades.map((c) => (
              <ContactCard key={c.id} contact={c} onOpenProfile={setProfileContactId} />
            ))}
          </ul>
        </>
      )}

      {/* Blocked section · Philip 2026-08-03. Only shows when at least
          one contact is blocked. Blocked cards have muted styling +
          "Unblock" action. */}
      {blockedContacts.length > 0 && (
        <>
          <ContactSectionHeader label="Blocked" count={blockedContacts.length} />
          <ul className="space-y-1.5">
            {blockedContacts.map((c) => (
              <li key={c.id}>
                <div className="nex-contact-card flex items-center gap-3 rounded-2xl border border-black/8 bg-white/80 px-3 py-2.5 opacity-70">
                  <div className="relative shrink-0">
                    {c.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.avatarUrl}
                        alt={c.name}
                        className="h-11 w-11 rounded-full object-cover grayscale"
                      />
                    ) : (
                      <span
                        className="grid h-11 w-11 place-items-center rounded-full text-[12.5px] font-semibold text-white grayscale"
                        style={{ backgroundColor: c.avatarColor }}
                        aria-hidden="true"
                      >
                        {c.initials}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-black line-through decoration-black/30">
                      {c.name}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-black/50">
                      {[c.trade || c.subtitle, c.city].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => unblockContact(c.id)}
                    className="shrink-0 rounded-full bg-red-700 px-2.5 py-1 text-[10.5px] font-semibold text-white shadow-sm hover:bg-red-800"
                  >
                    Unblock
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
    {/* Living Profile bottom sheet · Philip 2026-08-03. Opens when a
        contact avatar is held for 2s. Renders each field only when
        populated (Third Law). Block moves in here as a red action. */}
    <MemberLivingProfileSheet
      contact={profileContact}
      isBlocked={profileContact ? blockedIds.has(profileContact.id) : false}
      onClose={() => setProfileContactId(null)}
      onCall={(c) => {
        setProfileContactId(null);
        onStartCall(c);
      }}
      onBlock={(id) => {
        blockContact(id);
        setProfileContactId(null);
      }}
      onUnblock={(id) => {
        unblockContact(id);
        setProfileContactId(null);
      }}
    />
    </>
  );
}

function ContactSectionHeader({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <div className="mt-3 mb-1.5 flex items-center justify-between px-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-black/50">
        {label}
      </span>
      <span className="text-[10.5px] font-semibold text-black/35">{count}</span>
    </div>
  );
}

function ContactCard({
  contact,
  onOpenProfile,
}: {
  contact: MockContact;
  onOpenProfile: (id: string) => void;
}) {
  // Long-press the AVATAR for 2 seconds → open Living Profile (Philip
  // 2026-08-03). Block moved into the profile sheet itself as a red
  // action button — no more 5s hold. Countdown ring gives a subtle
  // "hold to open" hint during the 2s.
  const { bind: holdBind, seconds: holdSeconds, total: holdTotal } =
    useLongPress(() => onOpenProfile(contact.id), 2000);

  // SVG progress ring math (r = 18 → circumference = 2π·18 ≈ 113.1)
  const ringCircumference = 113.1;
  const ringOffset =
    holdSeconds === null
      ? 0
      : ringCircumference * ((holdTotal - holdSeconds) / holdTotal);

  return (
    <li className="relative">
      <div
        className="nex-contact-card flex w-full items-start gap-3 rounded-2xl border border-black/8 bg-white/80 px-3 py-2.5 text-left transition-all hover:border-orange-200 hover:bg-white/95"
      >
        {/* Avatar · profile image if provided, coloured-initial disc
            otherwise (Living Profile fallback pattern). Presence rim
            colours the avatar edge — GREEN when online, GOLD/champagne
            when offline (Philip 2026-08-03). Heartbeat dot overlays the
            bottom-right corner only when online.
            LONG-PRESS THE AVATAR for 5s to block the contact — hold
            handlers bound here (Philip 2026-08-03). */}
        <div className="relative shrink-0 cursor-pointer select-none touch-none" {...holdBind}>
          {(() => {
            // Fresh green-500 matches the header online dot + heartbeat
            // (Philip 2026-08-03 · was deep forest emerald-800).
            const rimColor = contact.presence === "online" ? "#22C55E" : "#D6B58A";
            const rimStyle = { boxShadow: `0 0 0 2px ${rimColor}` };
            return contact.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={contact.avatarUrl}
                alt={contact.name}
                className="h-11 w-11 rounded-full object-cover"
                style={{ backgroundColor: contact.avatarColor, ...rimStyle }}
              />
            ) : (
              <span
                className="grid h-11 w-11 place-items-center rounded-full text-[12.5px] font-semibold text-white"
                style={{ backgroundColor: contact.avatarColor, ...rimStyle }}
                aria-hidden="true"
              >
                {contact.initials}
              </span>
            );
          })()}
          {/* Presence dot · Philip 2026-08-03 refined model.
              DEEP FOREST GREEN (emerald-800) + heartbeat pulse when
              online. NO dot when offline (absence of the pulse IS the
              offline signal — cleaner). */}
          {contact.presence === "online" && (
            <span
              aria-hidden="true"
              className="nex-presence-online absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-black/60"
            />
          )}
        </div>
        {/* Middle · name + role · last-seen shown ONLY when offline
            (Philip 2026-08-03: the green heartbeat dot already conveys
            "online now", no need for redundant text). Preview badge
            removed at Philip's request. */}
        <div className="min-w-0 flex-1">
          {/* Line 1 · name (person OR company) */}
          <div className="truncate text-[13px] font-semibold text-black">
            {contact.name}
          </div>
          {/* Line 2 · trade (if trade) OR subtitle (Friend/Family/etc). */}
          {(contact.trade || contact.subtitle) && (
            <div className="mt-0.5 truncate text-[11.5px] font-medium text-black/65">
              {contact.trade || contact.subtitle}
            </div>
          )}
          {/* Line 3 · city + last-seen (only when offline · the green
              heartbeat conveys "online now" so no redundant text). */}
          {(contact.city || contact.presence !== "online") && (
            <div className="mt-0.5 flex items-center gap-1.5 truncate text-[10.5px] text-black/50">
              {contact.city && <span className="truncate">{contact.city}</span>}
              {contact.city && contact.presence !== "online" && (
                <span className="text-black/25">·</span>
              )}
              {contact.presence !== "online" && (
                <span className="shrink-0">{contact.lastSeen}</span>
              )}
            </div>
          )}
          {contact.lastMessage && (
            <div className="mt-1 truncate text-[11.5px] italic text-black/55">
              &ldquo;{contact.lastMessage}&rdquo;
            </div>
          )}
        </div>
        {/* Right · time + unread. Hidden during hold to make room for
            the countdown ring. */}
        {holdSeconds === null && (contact.timeAgo || contact.unread) && (
          <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
            {contact.timeAgo && (
              <span className="text-[10.5px] font-semibold text-black/45">
                {contact.timeAgo}
              </span>
            )}
            {contact.unread && contact.unread > 0 && (
              <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-red-500 px-1 text-[9.5px] font-bold text-white">
                {contact.unread}
              </span>
            )}
          </div>
        )}
      </div>
      {/* Long-press countdown ring · appears on the right side of the
          card while the user holds the avatar. SVG progress ring around
          a big red circle with the remaining seconds. At 0 the block
          fires and the card moves to the Blocked section automatically.
          Philip 2026-08-03. */}
      {holdSeconds !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center"
        >
          <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90 h-11 w-11">
            <circle cx="20" cy="20" r="18" fill="rgba(185, 28, 28, 0.85)" />
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth="3"
            />
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <span className="relative text-[15px] font-bold text-white drop-shadow">
            {holdSeconds}
          </span>
        </div>
      )}
    </li>
  );
}

// ─── Member Living Profile · bottom sheet · Philip 2026-08-03 ───────
//
// Triggered by holding a contact avatar for 2s inside the Contacts
// drawer. Slides up from the bottom · shows only fields that carry
// data (Third Law · no fake profile rows). Block moves in here as a
// red action button so the 5s hold-to-block is retired.
function MemberLivingProfileSheet({
  contact,
  isBlocked,
  onClose,
  onCall,
  onBlock,
  onUnblock,
}: {
  contact: MockContact | null;
  isBlocked: boolean;
  onClose: () => void;
  onCall: (contact: MockContact) => void;
  onBlock: (id: string) => void;
  onUnblock: (id: string) => void;
}) {
  const open = contact !== null;
  useOverlayDismiss(open, onClose);

  const joinedLabel = (() => {
    if (!contact?.joinedAt) return null;
    const d = new Date(contact.joinedAt);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  })();

  const socialEntries: Array<{ key: string; label: string; url: string }> = (() => {
    const s = contact?.socials;
    if (!s) return [];
    const entries: Array<{ key: string; label: string; url: string }> = [];
    if (s.instagram) entries.push({ key: "instagram", label: "Instagram", url: `https://instagram.com/${s.instagram.replace(/^@/, "")}` });
    if (s.facebook)  entries.push({ key: "facebook",  label: "Facebook",  url: `https://facebook.com/${s.facebook}` });
    if (s.tiktok)    entries.push({ key: "tiktok",    label: "TikTok",    url: `https://tiktok.com/@${s.tiktok.replace(/^@/, "")}` });
    if (s.linkedin)  entries.push({ key: "linkedin",  label: "LinkedIn",  url: `https://linkedin.com/in/${s.linkedin}` });
    if (s.x)         entries.push({ key: "x",         label: "X",         url: `https://x.com/${s.x.replace(/^@/, "")}` });
    return entries;
  })();

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={contact ? `${contact.name} · Profile` : "Profile"}
        className={`fixed left-0 right-0 bottom-0 z-[61] mx-auto flex max-h-[85vh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[32px] border border-white/10 shadow-2xl transition-transform duration-320 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{
          background: "rgba(0, 0, 0, 0.72)",
          backdropFilter: "blur(30px) saturate(150%)",
          WebkitBackdropFilter: "blur(30px) saturate(150%)",
        }}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <span aria-hidden="true" className="h-1 w-10 rounded-full bg-white/25" />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
          aria-label="Close profile"
        >
          <XIcon className="h-4 w-4" />
        </button>

        {contact && (
          <div className="nex-hide-scroll flex-1 overflow-y-auto px-5 pb-6 pt-3">
            {/* Header · avatar + name + verified */}
            <div className="flex flex-col items-center pt-2 text-center">
              {contact.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contact.avatarUrl}
                  alt={contact.name}
                  className="h-24 w-24 rounded-full object-cover"
                  style={{ backgroundColor: contact.avatarColor, boxShadow: `0 0 0 3px ${contact.presence === "online" ? "#22C55E" : "#D6B58A"}` }}
                />
              ) : (
                <span
                  className="grid h-24 w-24 place-items-center rounded-full text-[26px] font-semibold text-white"
                  style={{ backgroundColor: contact.avatarColor, boxShadow: `0 0 0 3px ${contact.presence === "online" ? "#22C55E" : "#D6B58A"}` }}
                  aria-hidden="true"
                >
                  {contact.initials}
                </span>
              )}
              <div className="mt-3 flex items-center gap-2">
                <h2 className="text-[18px] font-semibold text-white">{contact.name}</h2>
                {contact.nexVerified && (
                  <span
                    title="Certified Nex member"
                    className="inline-flex items-center gap-1 rounded-full border border-green-400/40 bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-300"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Nex Verified
                  </span>
                )}
              </div>
              {(contact.trade || contact.subtitle) && (
                <div className="mt-1 text-[13px] font-medium text-white/80">
                  {contact.trade || contact.subtitle}
                </div>
              )}
            </div>

            {/* Primary action · Call · v1 opens the preview call overlay. */}
            <button
              type="button"
              onClick={() => onCall(contact)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-orange-600"
            >
              <Phone className="h-4 w-4" strokeWidth={2.5} />
              <span>Call {contact.name.split(" ")[0]}</span>
            </button>

            {/* Rows · only rendered when data present */}
            <dl className="mt-5 space-y-2">
              {(contact.city || contact.country) && (
                <ProfileRow label="Location" value={[contact.city, contact.country].filter(Boolean).join(", ")} />
              )}
              {joinedLabel && (
                <ProfileRow label="Joined Nex" value={joinedLabel} />
              )}
              {contact.websiteUrl && (
                <ProfileRow
                  label="Website"
                  value={
                    <a
                      href={contact.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-300 hover:text-orange-200 underline underline-offset-2"
                    >
                      {contact.websiteUrl.replace(/^https?:\/\//, "")}
                    </a>
                  }
                />
              )}
            </dl>

            {/* Socials · icon row when any populated */}
            {socialEntries.length > 0 && (
              <div className="mt-5">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-white/45">
                  Social
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {socialEntries.map((s) => (
                    <a
                      key={s.key}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11.5px] font-medium text-white/85 hover:border-white/35 hover:bg-white/[0.10]"
                    >
                      {s.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Danger zone · block / unblock */}
            <div className="mt-6 border-t border-white/10 pt-4">
              {isBlocked ? (
                <button
                  type="button"
                  onClick={() => onUnblock(contact.id)}
                  className="w-full rounded-xl bg-white/10 py-2.5 text-[12.5px] font-semibold text-white hover:bg-white/15"
                >
                  Unblock contact
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onBlock(contact.id)}
                  className="w-full rounded-xl bg-red-600 py-2.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-red-700"
                >
                  Block contact
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function ProfileRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-white/45">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-right text-[12.5px] text-white/90">
        {value}
      </dd>
    </div>
  );
}

// ─── Message search overlay · Philip 2026-08-03 ──────────────────────
//
// Full-screen search over the current session's messages. Case-
// insensitive substring match on message.text (audio-only messages are
// rendered as "🎤 Voice message" placeholders and stay searchable via
// the "voice" keyword). Tapping a result closes the overlay + jumps
// the chat to that message with a brief amber flash.
function MessageSearchOverlay({
  open,
  messages,
  onClose,
  onPick,
}: {
  open: boolean;
  messages: Message[];
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  useOverlayDismiss(open, onClose);

  // Reset + autofocus on open.
  useEffect(() => {
    if (open) {
      setQuery("");
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const q = query.trim().toLowerCase();
  const results = q
    ? messages
        .map((m) => {
          const haystack = m.audio
            ? "🎤 voice message"
            : (m.text ?? "").toLowerCase();
          const idx = haystack.indexOf(q);
          if (idx < 0) return null;
          return { m, idx };
        })
        .filter((r): r is { m: Message; idx: number } => r !== null)
        // newest first · reversed from chat order so recent hits sit up top.
        .reverse()
    : [];

  return (
    <div
      className={`fixed inset-0 z-[65] flex flex-col bg-white transition-opacity duration-200 ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Search messages"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-black/5 bg-white px-3 py-2">
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-black/60 hover:bg-black/[0.06] hover:text-black/80"
          aria-label="Close search"
        >
          <XIcon className="h-4 w-4" />
        </button>
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-black/10 bg-neutral-50 px-3 py-1.5">
          <SearchIcon className="h-4 w-4 text-black/40" strokeWidth={2.2} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this conversation"
            className="flex-1 bg-transparent text-[13.5px] text-black outline-none placeholder:text-black/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-[11px] font-semibold text-black/45 hover:text-black/70"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
      </header>
      <div className="nex-hide-scroll flex-1 overflow-y-auto px-3 py-2">
        {!q ? (
          <div className="mt-16 text-center text-[13px] text-black/50">
            Type to search everything you and Nex have said so far.
          </div>
        ) : results.length === 0 ? (
          <div className="mt-16 text-center text-[13px] text-black/50">
            No matches for &ldquo;{query.trim()}&rdquo;.
          </div>
        ) : (
          <ul className="space-y-1">
            {results.map(({ m, idx }) => {
              const sender = resolveSender(m);
              const source = m.audio ? "🎤 Voice message" : (m.text ?? "");
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onPick(m.id)}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-orange-50"
                  >
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white"
                      style={{ backgroundColor: sender.avatarColor }}
                      aria-hidden="true"
                    >
                      {sender.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold text-black">{sender.name}</div>
                      <div className="mt-0.5 truncate text-[12.5px] text-black/70">
                        <SearchSnippet source={source} query={q} matchIdx={idx} />
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// Highlights the matched substring within a small window of surrounding
// context so long messages don't drown the hit.
function SearchSnippet({
  source,
  query,
  matchIdx,
}: {
  source: string;
  query: string;
  matchIdx: number;
}) {
  const window = 40;
  const start = Math.max(0, matchIdx - window);
  const end = Math.min(source.length, matchIdx + query.length + window);
  const before = source.slice(start, matchIdx);
  const hit = source.slice(matchIdx, matchIdx + query.length);
  const after = source.slice(matchIdx + query.length, end);
  return (
    <span>
      {start > 0 && "…"}
      {before}
      <mark className="rounded bg-orange-200 px-0.5 py-0 text-black">{hit}</mark>
      {after}
      {end < source.length && "…"}
    </span>
  );
}

// ─── Tasks sheet · Philip 2026-08-03 · First Law commitments ─────────
//
// Bottom sheet from the footer Tasks button. Lists open + done tasks
// and hosts an inline "Create task" form (title · description · date +
// time · reminder select). Every task is persisted to localStorage so
// commitments never disappear. Reminder-firing happens at page level
// via a 30s interval — the sheet only reads/writes state.
function TasksSheet({
  open,
  tasks,
  onClose,
  onCreate,
  onUpdate,
  onMarkDone,
  onDelete,
  onJumpToSource,
  pushEnabled,
  pushStatus,
  pushError,
  onEnablePush,
  onDisablePush,
  onTestPush,
}: {
  open: boolean;
  tasks: NexTask[];
  onClose: () => void;
  onCreate: (partial: Omit<NexTask, "id" | "createdAt">) => void;
  onUpdate: (id: string, patch: Partial<NexTask>) => void;
  onMarkDone: (id: string) => void;
  onDelete: (id: string) => void;
  onJumpToSource: (messageId: string) => void;
  pushEnabled: boolean;
  pushStatus: "idle" | "enabling" | "denied" | "unsupported" | "needs_ios_install" | "no_vapid" | "error";
  pushError: string | null;
  onEnablePush: () => void;
  onDisablePush: () => void;
  onTestPush: () => void;
}) {
  useOverlayDismiss(open, onClose);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reminder, setReminder] = useState<NexTaskReminder>("same_day");

  // Which task is currently being edited inline (null when none).
  const [editingId, setEditingId] = useState<string | null>(null);

  // Delete-with-undo · we snapshot the deleted task for 5s so the user
  // can restore it. If they close the sheet or the timer fires, the
  // delete is committed. Only one pending undo at a time to keep the UI
  // simple — a second delete just replaces the first.
  const [pendingUndo, setPendingUndo] = useState<NexTask | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearUndo = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setPendingUndo(null);
  };

  // Reset form + close editor on sheet close so re-opening starts clean.
  // Any pending undo commits (the sheet closing = confirmation).
  useEffect(() => {
    if (!open) {
      setCreateOpen(false);
      setEditingId(null);
      setTitle("");
      setDescription("");
      setDate("");
      setTime("");
      setReminder("same_day");
      clearUndo();
    }
  }, [open]);

  const open_tasks = tasks.filter((t) => !t.doneAt);
  const done_tasks = tasks.filter((t) => t.doneAt);

  const canSave = title.trim().length > 0 && date.length > 0 && time.length > 0;
  const handleSave = () => {
    if (!canSave) return;
    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      dueAt: `${date}T${time}`,
      reminder,
      source: "manual",
    });
    setCreateOpen(false);
    setTitle("");
    setDescription("");
    setDate("");
    setTime("");
    setReminder("same_day");
  };

  const handleDelete = (task: NexTask) => {
    // Optimistic delete + snapshot for 5s undo.
    onDelete(task.id);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setPendingUndo(task);
    undoTimerRef.current = setTimeout(() => {
      undoTimerRef.current = null;
      setPendingUndo(null);
    }, 5000);
  };

  const handleUndo = () => {
    if (!pendingUndo) return;
    // Restore by re-creating the task at its original position. We use
    // onCreate which regenerates id + createdAt · the task stays in the
    // Open bucket unless it was Done at delete time.
    onCreate({
      title: pendingUndo.title,
      description: pendingUndo.description,
      dueAt: pendingUndo.dueAt,
      reminder: pendingUndo.reminder,
      source: pendingUndo.source,
      confidenceScore: pendingUndo.confidenceScore,
      metadata: pendingUndo.metadata,
      // Preserve doneAt if it was completed
      ...(pendingUndo.doneAt ? { doneAt: pendingUndo.doneAt } : {}),
    });
    clearUndo();
  };

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Tasks"
        className={`fixed left-0 right-0 bottom-0 z-[61] mx-auto flex max-h-[85vh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[32px] border border-white/10 bg-white shadow-2xl transition-transform duration-320 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <span aria-hidden="true" className="h-1 w-10 rounded-full bg-black/20" />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/[0.06] text-black/60 hover:bg-black/[0.10] hover:text-black/80"
          aria-label="Close tasks"
        >
          <XIcon className="h-4 w-4" />
        </button>

        <div className="nex-hide-scroll flex-1 overflow-y-auto px-4 pb-5 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-black">Tasks</h2>
            <button
              type="button"
              onClick={() => setCreateOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-sm transition hover:bg-orange-600"
              aria-expanded={createOpen}
            >
              {createOpen ? "Cancel" : "+ Create task"}
            </button>
          </div>

          {/* Background notifications banner · Philip 2026-08-03. Web
              Push wakes the device even when Nex isn't open. When
              enabled, task reminders fire server-side. */}
          <PushBanner
            enabled={pushEnabled}
            status={pushStatus}
            error={pushError}
            onEnable={onEnablePush}
            onDisable={onDisablePush}
            onTest={onTestPush}
          />

          {/* Inline create form · toggled by "+ Create task". */}
          {createOpen && (
            <div className="mt-3 space-y-2 rounded-2xl border border-orange-200 bg-orange-50/60 p-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title (e.g. Quote for Riverside)"
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-black outline-none placeholder:text-black/40 focus:border-orange-400"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2 text-[12.5px] text-black outline-none placeholder:text-black/40 focus:border-orange-400"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[12.5px] text-black outline-none focus:border-orange-400"
                />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[12.5px] text-black outline-none focus:border-orange-400"
                />
              </div>
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-black/55">
                  Remind me
                </div>
                <div className="mt-1 flex gap-1">
                  {(["off", "day_before", "same_day"] as NexTaskReminder[]).map((r) => {
                    const label = r === "off" ? "Off" : r === "day_before" ? "Day before" : "Same day";
                    const active = reminder === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setReminder(r)}
                        className={`flex-1 rounded-lg border py-1.5 text-[11.5px] font-semibold transition ${
                          active
                            ? "border-orange-500 bg-orange-500 text-white"
                            : "border-black/10 bg-white text-black/70 hover:border-orange-300"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="mt-1 w-full rounded-lg bg-orange-500 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save task
              </button>
            </div>
          )}

          {/* Open tasks */}
          <div className="mt-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-black/50">
              Open · {open_tasks.length}
            </div>
            {open_tasks.length === 0 ? (
              <div className="mt-2 rounded-xl border border-dashed border-black/15 bg-neutral-50 px-3 py-4 text-center text-[12.5px] text-black/50">
                No open tasks. Create one to keep Nex on track.
              </div>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {open_tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    editing={editingId === t.id}
                    onEdit={() => setEditingId(t.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onSaveEdit={(patch) => {
                      onUpdate(t.id, patch);
                      setEditingId(null);
                    }}
                    onMarkDone={() => onMarkDone(t.id)}
                    onDelete={() => handleDelete(t)}
                    onJumpToSource={onJumpToSource}
                  />
                ))}
              </ul>
            )}
          </div>

          {done_tasks.length > 0 && (
            <div className="mt-4">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-black/50">
                Completed · {done_tasks.length}
              </div>
              <ul className="mt-2 space-y-1.5">
                {done_tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    editing={editingId === t.id}
                    onEdit={() => setEditingId(t.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onSaveEdit={(patch) => {
                      onUpdate(t.id, patch);
                      setEditingId(null);
                    }}
                    onMarkDone={() => onMarkDone(t.id)}
                    onDelete={() => handleDelete(t)}
                    onJumpToSource={onJumpToSource}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
        {/* Undo toast · appears at the bottom of the sheet for 5s after a
            delete. Tap Undo to restore the task. */}
        {pendingUndo && (
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/85 px-4 py-2 text-white shadow-lg backdrop-blur">
            <span className="text-[12px]">Task deleted</span>
            <button
              type="button"
              onClick={handleUndo}
              className="rounded-full bg-white/15 px-3 py-1 text-[11.5px] font-semibold hover:bg-white/25"
            >
              Undo
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function TaskRow({
  task,
  editing,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onMarkDone,
  onDelete,
  onJumpToSource,
}: {
  task: NexTask;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (patch: Partial<NexTask>) => void;
  onMarkDone: () => void;
  onDelete: () => void;
  onJumpToSource: (messageId: string) => void;
}) {
  const isDone = Boolean(task.doneAt);
  const reminderLabel =
    task.reminder === "off"
      ? null
      : task.reminder === "same_day"
        ? "Same-day reminder"
        : "Day-before reminder";
  const badge = TASK_SOURCE_BADGE[task.source];
  // Timeline toggle · collapsed by default so open tasks stay compact.
  const [timelineOpen, setTimelineOpen] = useState(false);
  const history = task.history ?? [];

  // ─── Inline edit form ──────────────────────────────────────────────
  if (editing) {
    return (
      <li>
        <TaskEditForm
          task={task}
          onCancel={onCancelEdit}
          onSave={onSaveEdit}
        />
      </li>
    );
  }

  return (
    <li>
      <div
        className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${
          isDone
            ? "border-black/8 bg-neutral-50 opacity-60"
            : "border-black/10 bg-white"
        }`}
      >
        <button
          type="button"
          onClick={onMarkDone}
          disabled={isDone}
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition ${
            isDone
              ? "border-orange-500 bg-orange-500"
              : "border-black/25 hover:border-orange-400"
          }`}
          aria-label={isDone ? "Task complete" : "Mark task as done"}
        >
          {isDone && (
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className={`text-[13px] font-semibold ${isDone ? "text-black/55 line-through" : "text-black"}`}>
            {task.title}
          </div>
          {task.description && (
            <div className="mt-0.5 text-[11.5px] leading-snug text-black/60">
              {task.description}
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-800">
              {formatDueLabel(task.dueAt)}
            </span>
            {reminderLabel && (
              <span className="inline-flex items-center rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-semibold text-black/60">
                {reminderLabel}
              </span>
            )}
            {/* Source badge · always shown · answers "where did this come from?" */}
            <span
              className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-semibold text-black/60"
              title={badge.label}
            >
              <span aria-hidden="true">{badge.emoji}</span>
              <span>{badge.label}</span>
            </span>
            {task.notifiedAt && !isDone && (
              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                Notified
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            onClick={onEdit}
            disabled={isDone}
            className="rounded-full p-1 text-black/40 transition hover:bg-black/[0.05] hover:text-black/80 disabled:opacity-40"
            aria-label="Edit task"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full p-1 text-black/35 transition hover:bg-red-50 hover:text-red-600"
            aria-label="Delete task"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {/* Source conversation · deep link back to the exact message that
          spawned this task (Philip 2026-08-03). Only rendered for chat-
          source tasks where we preserved the originating text + id. */}
      {(() => {
        const meta = task.metadata as
          | { originalMessageId?: string; originalText?: string }
          | undefined;
        if (!meta?.originalMessageId || !meta.originalText) return null;
        return (
          <div className="mt-1.5 rounded-lg border border-orange-100 bg-orange-50/50 px-3 py-2 pl-8">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-orange-800/80">
                  Source conversation
                </div>
                <div className="mt-0.5 truncate text-[11.5px] italic leading-snug text-black/70">
                  &ldquo;{meta.originalText}&rdquo;
                </div>
              </div>
              <button
                type="button"
                onClick={() => onJumpToSource(meta.originalMessageId as string)}
                className="shrink-0 rounded-full border border-orange-300 bg-white px-2.5 py-1 text-[10.5px] font-semibold text-orange-800 hover:bg-orange-100"
              >
                Open chat
              </button>
            </div>
          </div>
        );
      })()}
      {/* Timeline · collapsed toggle below the row · expands to show the
          full audit log for this task. Only rendered when the task has
          any history (all tasks post-2026-08-03 do). */}
      {history.length > 0 && (
        <div className="mt-1 pl-8">
          <button
            type="button"
            onClick={() => setTimelineOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-black/45 hover:text-black/70"
            aria-expanded={timelineOpen}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-3 w-3 transition-transform ${timelineOpen ? "rotate-90" : ""}`}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span>
              Timeline · {history.length} event{history.length === 1 ? "" : "s"}
            </span>
          </button>
          {timelineOpen && (
            <ol className="mt-1.5 space-y-1 border-l border-black/10 pl-3">
              {history.map((ev, i) => {
                const meta = TASK_EVENT_LABEL[ev.kind];
                return (
                  <li key={i} className="relative text-[11px] leading-snug text-black/75">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[15px] top-1 grid h-2.5 w-2.5 place-items-center rounded-full bg-white ring-2 ring-black/15"
                    />
                    <div className="flex items-baseline gap-1.5">
                      <span aria-hidden="true">{meta.emoji}</span>
                      <span className="font-semibold text-black/80">{meta.label}</span>
                      {ev.by && (
                        <span className="text-[10px] text-black/45">· {ev.by}</span>
                      )}
                    </div>
                    {ev.detail && (
                      <div className="mt-0.5 text-black/60">{ev.detail}</div>
                    )}
                    <div className="mt-0.5 text-[10px] text-black/40">
                      {formatEventTime(ev.at)}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </li>
  );
}

// Inline edit form · reused by TaskRow when a task is being edited.
// Small on purpose · same fields as create (title, description, date,
// time, reminder). Save/Cancel row at the bottom.
function TaskEditForm({
  task,
  onCancel,
  onSave,
}: {
  task: NexTask;
  onCancel: () => void;
  onSave: (patch: Partial<NexTask>) => void;
}) {
  // Split the ISO due into date + time for the two <input> fields.
  const [d, t] = task.dueAt.includes("T") ? task.dueAt.split("T") : [task.dueAt, ""];
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [date, setDate] = useState(d);
  const [time, setTime] = useState(t.slice(0, 5)); // HH:MM
  const [reminder, setReminder] = useState<NexTaskReminder>(task.reminder);
  const canSave = title.trim().length > 0 && date.length > 0 && time.length > 0;

  return (
    <div className="space-y-2 rounded-xl border border-orange-300 bg-orange-50/60 p-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-black outline-none placeholder:text-black/40 focus:border-orange-400"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2 text-[12.5px] text-black outline-none placeholder:text-black/40 focus:border-orange-400"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[12.5px] text-black outline-none focus:border-orange-400"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[12.5px] text-black outline-none focus:border-orange-400"
        />
      </div>
      <div>
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-black/55">
          Remind me
        </div>
        <div className="mt-1 flex gap-1">
          {(["off", "day_before", "same_day"] as NexTaskReminder[]).map((r) => {
            const label = r === "off" ? "Off" : r === "day_before" ? "Day before" : "Same day";
            const active = reminder === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setReminder(r)}
                className={`flex-1 rounded-lg border py-1.5 text-[11.5px] font-semibold transition ${
                  active
                    ? "border-orange-500 bg-orange-500 text-white"
                    : "border-black/10 bg-white text-black/70 hover:border-orange-300"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-black/10 bg-white py-2 text-[12.5px] font-semibold text-black/70 hover:border-black/25"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            if (!canSave) return;
            onSave({
              title: title.trim(),
              description: description.trim() || undefined,
              dueAt: `${date}T${time}`,
              reminder,
            });
          }}
          disabled={!canSave}
          className="flex-1 rounded-lg bg-orange-500 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Push notifications banner · Philip 2026-08-03 ────────────────────
//
// Sits at the top of the Tasks sheet. Enable / Disable / Test — all
// through the Nex push client. When enabled, reminders fire even with
// the tab closed. When permission was denied at the browser level, we
// show a subtle read-only note explaining how to reset it (users must
// enable it via browser site settings — we can't re-prompt).
function PushBanner({
  enabled,
  status,
  error,
  onEnable,
  onDisable,
  onTest,
}: {
  enabled: boolean;
  status: "idle" | "enabling" | "denied" | "unsupported" | "needs_ios_install" | "no_vapid" | "error";
  error: string | null;
  onEnable: () => void;
  onDisable: () => void;
  onTest: () => void;
}) {
  const [gate] = useState(() =>
    typeof window === "undefined" ? { ok: true as const } : canEnableNexPush(),
  );

  if (enabled) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2">
        <div className="mt-0.5 text-green-700">🔔</div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-green-900">
            Background reminders on
          </div>
          <div className="mt-0.5 text-[11px] leading-snug text-green-900/75">
            Nex will wake your device for reminders even when Nex isn't open.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onTest}
              className="rounded-full border border-green-300 bg-white px-2.5 py-1 text-[10.5px] font-semibold text-green-800 hover:bg-green-100"
            >
              Send test push
            </button>
            <button
              type="button"
              onClick={onDisable}
              className="text-[10.5px] font-semibold text-green-900/60 hover:text-green-900"
            >
              Turn off
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not enabled · either offer to enable or explain why we can't.
  const cantEnable = !gate.ok || status === "denied" || status === "unsupported" || status === "needs_ios_install" || status === "no_vapid";
  const explanation = (() => {
    if (status === "denied" || (!gate.ok && gate.reason === "denied")) {
      return "Notifications are blocked in your browser. Enable them in site settings for this page, then try again.";
    }
    if (status === "needs_ios_install" || (!gate.ok && gate.reason === "needs_ios_install")) {
      return "iOS requires Nex to be installed to the home screen before it can send background notifications.";
    }
    if (status === "unsupported" || (!gate.ok && gate.reason === "unsupported")) {
      return "This browser doesn't support Web Push notifications.";
    }
    if (status === "no_vapid") return "Server push keys aren't configured yet.";
    return null;
  })();

  return (
    <div className="mt-3 flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50/60 px-3 py-2">
      <div className="mt-0.5 text-orange-600">🔔</div>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-black">
          Get reminders even when Nex is closed
        </div>
        <div className="mt-0.5 text-[11px] leading-snug text-black/60">
          Turn on background notifications so Nex can wake your device when a reminder is due.
        </div>
        {cantEnable && explanation && (
          <div className="mt-1.5 text-[10.5px] italic leading-snug text-black/55">
            {explanation}
          </div>
        )}
        {error && (
          <div className="mt-1.5 text-[10.5px] italic leading-snug text-red-700">
            {error}
          </div>
        )}
        <div className="mt-2">
          <button
            type="button"
            onClick={onEnable}
            disabled={cantEnable || status === "enabling"}
            className="rounded-full bg-orange-500 px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "enabling" ? "Enabling…" : "Enable notifications"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Small live day/date/time header shown inside the Play sheet. Ticks
// once a minute while the sheet is open so the clock stays accurate
// without wasting a timer when hidden.
function PlaySheetNowHeader({ open }: { open: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!open) return;
    setNow(new Date()); // refresh on open
    const iv = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(iv);
  }, [open]);
  const weekday = now.toLocaleDateString("en-GB", { weekday: "long" });
  const datePart = now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
  });
  const timePart = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="px-4 pb-1 pt-0.5 text-center">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-black/45">
        {weekday}
      </div>
      <div className="mt-0.5 text-[13.5px] font-semibold text-black">
        {datePart} · <span className="font-mono tabular-nums">{timePart}</span>
      </div>
    </div>
  );
}

// ─── Play sheet · bottom-up · menu of 3 features ────────────────────
//
// Philip 2026-08-03. Slide-up bottom sheet from the footer Play button.
// Contains three MENU rows (Stickers · Animation · Stairs) — each row is
// a drill-in that opens a per-feature side drawer where the actual
// selection happens (see FeatureDrawer). No inline switches on the sheet
// itself · the sheet is a launcher, not a control panel.
// Sheet dismisses on X · backdrop · ESC.
function PlaySheet({
  open,
  toggles,
  onOpenFeature,
  onClose,
}: {
  open: boolean;
  toggles: PlayToggles;
  onOpenFeature: (f: PlayFeature) => void;
  onClose: () => void;
}) {
  useOverlayDismiss(open, onClose);
  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      {/* Sheet · bottom-anchored · slides up */}
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Play"
        className={`fixed left-0 right-0 bottom-0 z-50 mx-auto flex max-h-[70vh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[32px] border border-black/10 bg-white/95 shadow-2xl backdrop-blur transition-transform duration-320 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Drag handle · doubles as the grab area. Floating close X sits
            top-right — no title bar (Philip 2026-08-03, Simplicity Rule). */}
        <div className="flex justify-center pt-2.5 pb-1">
          <span
            aria-hidden="true"
            className="h-1 w-10 rounded-full bg-black/20"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/[0.06] text-black/60 hover:bg-black/[0.10] hover:text-black/80"
          aria-label="Close Play"
        >
          <XIcon className="h-4 w-4" />
        </button>
        {/* Day + date + live time · Philip 2026-08-03. Kept subtle · a
            small compass so the user knows when they're planning. */}
        <PlaySheetNowHeader open={open} />
        {/* Menu rows */}
        <div className="nex-hide-scroll flex-1 overflow-y-auto px-3 pb-5 pt-2">
          <ul className="space-y-2">
            <PlayMenuRow
              icon={<Type className="h-4 w-4" />}
              label="Stickers"
              description="Drag action-verb stickers onto chat messages — Save · Budget · Show partner."
              status="coming_soon"
              statusLabel="In Development"
              enabled={toggles.stickers}
              onClick={() => onOpenFeature("stickers")}
            />
            <PlayMenuRow
              icon={<Layers className="h-4 w-4" />}
              label="Staircase Plans"
              description="Send a staircase layout to the chat — straight flight · dog leg · winder · landings · spiral."
              status="live"
              statusLabel="Live"
              enabled={true}
              onClick={() => onOpenFeature("plans")}
            />
            <PlayMenuRow
              icon={<Layers className="h-4 w-4" />}
              label="Stairs"
              description="Upload your staircase designs and share them with customers mid-conversation — image, price, delivery, one tap."
              status="live"
              statusLabel="Live"
              enabled={toggles.stairs}
              onClick={() => onOpenFeature("stairs")}
            />
          </ul>
        </div>
      </section>
    </>
  );
}

function PlayMenuRow({
  icon,
  label,
  description,
  status,
  statusLabel,
  enabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  status: "live" | "coming_soon";
  statusLabel: string;
  enabled: boolean;
  onClick: () => void;
}) {
  const isLive = status === "live";
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="nex-play-row flex w-full items-start gap-3 rounded-2xl border border-black/8 bg-white/70 px-3.5 py-3 text-left transition-all hover:border-orange-200 hover:bg-white/85 active:scale-[0.99]"
      >
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
            enabled && isLive ? "bg-orange-500 text-white" : "bg-neutral-100 text-black/60"
          }`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-semibold text-black">{label}</span>
            <span
              className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider ${
                isLive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-neutral-200 bg-neutral-100 text-neutral-700"
              }`}
            >
              {statusLabel}
            </span>
            {isLive && enabled && (
              <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-orange-800">
                On
              </span>
            )}
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-black/60">{description}</p>
        </div>
        <ChevronRight
          className="mt-2 h-4 w-4 shrink-0 text-black/35"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}

// ─── Feature drawer · right-side · stacked on top of Play sheet ─────
//
// Philip 2026-08-03. Opens when a Play sheet row is tapped. Slides in
// from the right (85vw mobile, 380px desktop). Higher z-index than the
// Play sheet so it stacks on top · dismissing returns to the sheet.
// Content switches based on which feature was selected.
function FeatureDrawer({
  feature,
  toggles,
  themeId: _themeId,
  onInsertProduct,
  onInsertPlan,
  onClose,
}: {
  feature: PlayFeature | null;
  toggles: PlayToggles;
  onToggle: (key: keyof PlayToggles, value: boolean) => void;
  themeId: "original_nex" | "blossom" | "staircase_light_cream" | "staircase_walnut";
  onInsertProduct: (product: StairsProduct) => void;
  onInsertPlan: (plan: StaircasePlan) => void;
  onClose: () => void;
}) {
  const open = feature !== null;
  useOverlayDismiss(open, onClose);

  const title =
    feature === "stickers" ? "Stickers"
    : feature === "plans" ? "Staircase Plans"
    : feature === "stairs" ? "Stairs"
    : "";
  const icon =
    feature === "stickers" ? <Type className="h-4 w-4" strokeWidth={2.2} />
    : feature === "plans" ? <Layers className="h-4 w-4" strokeWidth={2.2} />
    : feature === "stairs" ? <Layers className="h-4 w-4" strokeWidth={2.2} />
    : null;

  return (
    <>
      {/* Backdrop · z-60 sits above Play sheet's z-40 so tapping outside
          the feature drawer dismisses ONLY the drawer, not the sheet */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      {/* Drawer · z-70 sits above Play sheet · right-anchored slide-in */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed right-0 top-0 bottom-0 z-[70] flex w-[85vw] max-w-[380px] flex-col overflow-hidden rounded-l-3xl border border-black/10 bg-white/95 shadow-2xl backdrop-blur transition-transform duration-320 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div
          aria-hidden="true"
          className="absolute left-1.5 top-1/2 h-14 w-1 -translate-y-1/2 rounded-full bg-black/15"
        />
        <header className="flex items-center gap-2.5 border-b border-black/5 bg-white/70 px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-500 text-white">
            {icon}
          </span>
          <div className="flex-1 text-[15px] font-semibold text-black">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-black/50 hover:bg-black/[0.06] hover:text-black/80"
            aria-label={`Close ${title}`}
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>
        <div className="nex-hide-scroll flex-1 overflow-y-auto px-4 py-4">
          {feature === "stickers" && <StickersDrawerContent enabled={toggles.stickers} />}
          {feature === "plans" && (
            <PlansDrawerContent onInsertPlan={onInsertPlan} />
          )}
          {feature === "stairs" && (
            <StairsDrawerContent
              enabled={toggles.stairs}
              onInsertProduct={onInsertProduct}
            />
          )}
        </div>
      </aside>
    </>
  );
}

// ─── Feature drawer content · Stickers (v1 · coming soon) ───────────
function StickersDrawerContent({ enabled: _enabled }: { enabled: boolean }) {
  const stickers = [
    { emoji: "♥", label: "Save", detail: "Save a design to your Saved list" },
    { emoji: "£", label: "Budget", detail: "Capture the price for review" },
    { emoji: "🪟", label: "Show partner", detail: "Share with a nominated contact" },
    { emoji: "📐", label: "Measurements", detail: "Start a measurement request" },
    { emoji: "🗓️", label: "Book viewing", detail: "Set up a site visit" },
    { emoji: "✨", label: "Inspire me", detail: "Pin as inspiration for later" },
  ];
  return (
    <div className="space-y-4">
      <p className="text-[12.5px] leading-snug text-black/65">
        Six action-verb stickers · drop one on any design to turn a moment of
        inspiration into a saved task.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {stickers.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-black/8 bg-white/70 p-3 opacity-60"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-neutral-100 text-lg">
              {s.emoji}
            </div>
            <div className="mt-2 text-[12.5px] font-semibold text-black">{s.label}</div>
            <div className="mt-0.5 text-[10.5px] leading-snug text-black/55">{s.detail}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-dashed border-black/10 bg-neutral-50/60 px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-700">
            In Development
          </span>
        </div>
        <p className="mt-2 text-[11.5px] leading-snug text-black/60">
          Sticker drops become active once the deck ships. Each drop creates a
          visible task in Continue → Now so nothing you save gets lost.
        </p>
      </div>
    </div>
  );
}

// ─── Feature drawer content · Staircase Plans picker ──────────────
//
// Philip 2026-08-03. Category dropdown at top · grid of plan cards
// (name + description + shape glyph) below · tap a card to insert the
// plan into the chat.
function PlansDrawerContent({
  onInsertPlan,
}: {
  onInsertPlan: (plan: StaircasePlan) => void;
}) {
  const [category, setCategory] = useState<PlanCategory | "all">("all");
  const visible =
    category === "all"
      ? STAIRCASE_PLANS
      : STAIRCASE_PLANS.filter((p) => p.category === category);
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3">
        <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-black/50">
          Layout
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as PlanCategory | "all")}
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[12.5px] font-semibold text-black outline-none focus:border-orange-400"
        >
          <option value="all">All layouts ({STAIRCASE_PLANS.length})</option>
          {PLAN_CATEGORIES.map((c) => {
            const count = STAIRCASE_PLANS.filter((p) => p.category === c.id).length;
            return (
              <option key={c.id} value={c.id}>
                {c.label} ({count})
              </option>
            );
          })}
        </select>
      </div>
      <div className="nex-hide-scroll flex-1 overflow-y-auto pb-2">
        <ul className="grid grid-cols-1 gap-2">
          {visible.map((plan) => (
            <li key={plan.id}>
              <button
                type="button"
                onClick={() => onInsertPlan(plan)}
                className="flex w-full items-start gap-3 rounded-2xl border border-black/10 bg-white/80 px-3 py-3 text-left transition hover:border-orange-300 hover:bg-white/95 active:scale-[0.99]"
              >
                <span
                  aria-hidden="true"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-100 text-[22px] font-bold text-orange-800"
                >
                  {plan.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-black">
                    {plan.name}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-black/60">
                    {plan.description}
                  </div>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-black/35" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Feature drawer content · Animation Library picker (legacy) ────
// Kept for reference · not currently mounted. Ambient animation still
// runs via theme defaults through the AmbientParticles component.
//
// Two-tab picker (Yours / Trades) with live mini-preview on every card.
// Tap a card to select — takes effect immediately and persists. On/off
// toggle at the top controls whether the currently-selected animation
// renders. Selected card highlighted with theme accent.
function AnimationDrawerContent({
  enabled,
  onToggle,
  themeId,
  chosenAnimationId,
  onChooseAnimation,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  themeId: "original_nex" | "blossom" | "staircase_light_cream" | "staircase_walnut";
  chosenAnimationId: string | null;
  onChooseAnimation: (id: string | null) => void;
}) {
  const [tab, setTab] = useState<"user" | "trade">("user");
  const themeDefault = defaultAnimationFor(themeId);
  const effectiveId = chosenAnimationId ?? themeDefault;
  const visibleAnimations = AMBIENT_LIBRARY.filter((a) => a.set === tab);

  return (
    <div className="flex h-full flex-col">
      {/* On/off · the live gate */}
      <div className="mb-3 rounded-2xl border border-black/8 bg-white/70 px-3.5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-black">Enable ambient</div>
            <div className="text-[11px] text-black/55">
              Runs behind the chat · respects reduced motion.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => onToggle(!enabled)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              enabled ? "bg-orange-500" : "bg-black/15"
            }`}
            aria-label="Ambient animation toggle"
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tabs · Yours / Trades */}
      <div className="mb-3 flex gap-1 rounded-2xl border border-black/8 bg-white/70 p-1">
        {(["user", "trade"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-1.5 text-[12px] font-semibold transition ${
              tab === t
                ? "bg-orange-500 text-white shadow-sm"
                : "text-black/60 hover:text-black/80"
            }`}
          >
            {t === "user" ? "Yours" : "Trades"}
          </button>
        ))}
      </div>

      {/* Library grid · scrollable */}
      <div className="nex-hide-scroll flex-1 overflow-y-auto pb-2">
        <ul className="grid grid-cols-2 gap-2">
          {visibleAnimations.map((a) => {
            const active = effectiveId === a.id;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onChooseAnimation(a.id)}
                  className={`block w-full overflow-hidden rounded-2xl border-2 text-left transition ${
                    active
                      ? "border-orange-500 bg-orange-50 shadow-md ring-2 ring-orange-300/60"
                      : "border-black/10 bg-white/80 hover:border-orange-300"
                  }`}
                >
                  {/* Live mini-preview with checkmark badge when active */}
                  <AnimationPreviewTile animation={a} active={active} />
                  {/* Label */}
                  <div className="px-2.5 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12.5px] font-semibold text-black">{a.displayName}</span>
                      {active && (
                        <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-black/55">{a.description}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Reset to theme default */}
        {chosenAnimationId && (
          <button
            type="button"
            onClick={() => onChooseAnimation(null)}
            className="mt-3 w-full rounded-xl border border-black/10 bg-white/70 py-2 text-[11.5px] font-semibold text-black/65 hover:bg-white/95"
          >
            Reset to theme default
          </button>
        )}
      </div>
    </div>
  );
}

// Small live-animated tile shown inside each library card. Uses the
// SHORT-DISTANCE preview keyframes (nex-pv-*) that translate only ~80px
// vertically so particles stay inside the 72px preview area instead of
// flying off to 110vh (which caused the "flowing everywhere" bug and
// dead-looking tiles).
function AnimationPreviewTile({
  animation,
  active,
}: {
  animation: AmbientAnimation;
  active: boolean;
}) {
  const p = animation.particle;
  const specs = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        id: i,
        left: 8 + Math.random() * 84,
        size: Math.max(2, p.minSize + Math.random() * p.sizeRange),
        // Slower on the preview so particles are visible in the tile
        duration: 4 + Math.random() * 4,
        delay: -Math.random() * 6,
        swayX: (Math.random() - 0.5) * 12,
      })),
    [p.minSize, p.sizeRange],
  );
  const isFalling = p.direction === "down";
  const isSpark = animation.id === "welding_sparks";
  const previewName = isSpark
    ? "nex-pv-spark"
    : isFalling
    ? "nex-pv-down"
    : "nex-pv-up";
  // Palette hint at the base of the tile so users can distinguish
  // animations at a glance even before the particles cycle.
  const hint = p.glow.replace(/rgba\(([^)]+)\)/, (_m, inner) =>
    `rgba(${inner.split(",").slice(0, 3).join(",")}, 0.22)`,
  );
  return (
    <div
      className="relative h-[72px] w-full overflow-hidden"
      style={{
        background: `linear-gradient(180deg, transparent 0%, ${hint} 100%)`,
      }}
    >
      {/* Palette swatch pill · always visible so users identify the
          animation even if particles are between cycles */}
      <div
        className="absolute left-2 top-2 h-2 w-8 rounded-full"
        style={{ backgroundColor: p.color, boxShadow: `0 0 6px ${p.glow}` }}
      />
      {active && (
        <div className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-orange-500 text-white shadow-sm">
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5">
            <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      {specs.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: `${s.left}%`,
            [isFalling ? "top" : "bottom"]: "-4px",
            width: `${s.size}px`,
            height: `${s.size}px`,
            backgroundColor: p.color,
            boxShadow: `0 0 ${s.size * 2}px ${p.glow}`,
            animation: `${previewName} ${s.duration}s linear infinite`,
            animationDelay: `${s.delay}s`,
            willChange: "transform, opacity",
            ["--nex-sway" as string]: `${s.swayX}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ─── Feature drawer content · Stairs (v1 · owner product catalog) ──
//
// Two internal modes:
//   · "browse" — grid of owner's uploaded products, filtered by category,
//                tap card to INSERT into chat, footer Upload button
//   · "upload" — form: image URL, name, description, price, delivery
//                yes/no, category dropdown (built-ins + user-added)
// Products persist to localStorage under nex.stairs.products; custom
// categories under nex.stairs.categories. Cross-device sync deferred.
function StairsDrawerContent({
  enabled: _enabled,
  onInsertProduct,
}: {
  enabled: boolean;
  onInsertProduct: (product: StairsProduct) => void;
}) {
  const [mode, setMode] = useState<"browse" | "upload">("browse");
  const [products, setProducts] = useState<StairsProduct[]>([]);
  const [customCategories, setCustomCategories] = useState<{ id: string; label: string }[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Hydrate from localStorage on mount + listen for updates from other tabs.
  // First-time visitors get seeded with MOCK_STAIRS_PRODUCTS so the drawer
  // isn't empty for demo/preview. Uses a persistent flag so mocks aren't
  // re-seeded if the user later clears their own catalog.
  useEffect(() => {
    try {
      const seeded = window.localStorage.getItem(STAIRS_STORAGE_SEEDED);
      const existing = loadStairsProducts();
      if (seeded !== "1" && existing.length === 0) {
        saveStairsProducts(MOCK_STAIRS_PRODUCTS);
        window.localStorage.setItem(STAIRS_STORAGE_SEEDED, "1");
      } else if (seeded !== "1") {
        // User already has products but seeded flag missing — set it so
        // we never overwrite their work.
        window.localStorage.setItem(STAIRS_STORAGE_SEEDED, "1");
      }
    } catch {
      /* silent · localStorage blocked */
    }
    setProducts(loadStairsProducts());
    setCustomCategories(loadCustomCategories());
    const handler = () => setProducts(loadStairsProducts());
    window.addEventListener(STAIRS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(STAIRS_UPDATED_EVENT, handler);
  }, []);

  const allCategories = [...BUILT_IN_STAIRS_CATEGORIES, ...customCategories];

  const visibleProducts =
    filterCategory === "all"
      ? products
      : products.filter((p) => p.category === filterCategory);

  const handleSave = (draft: {
    category: string;
    categoryLabel: string;
    name: string;
    description: string;
    imageUrl: string;
    price: number | null;
    deliveryIncluded: boolean;
    vatIncluded: boolean;
    installationIncluded: boolean;
    addAsNewCategory: boolean;
  }) => {
    // If a new category was added, persist it first
    if (draft.addAsNewCategory) {
      const exists =
        allCategories.some((c) => c.id === draft.category) ||
        BUILT_IN_STAIRS_CATEGORIES.some((c) => c.id === draft.category);
      if (!exists) {
        const nextCats = [...customCategories, { id: draft.category, label: draft.categoryLabel }];
        setCustomCategories(nextCats);
        saveCustomCategories(nextCats);
      }
    }
    const product: StairsProduct = {
      id: makeStairsId(),
      category: draft.category,
      name: draft.name,
      description: draft.description,
      imageUrl: draft.imageUrl,
      price: draft.price,
      deliveryIncluded: draft.deliveryIncluded,
      vatIncluded: draft.vatIncluded,
      installationIncluded: draft.installationIncluded,
      // v1: uploader identity is a generic "You" until real auth lands.
      // Real user profile replaces this at that point.
      uploadedBy: DEFAULT_UPLOADER,
      createdAt: new Date().toISOString(),
    };
    const nextProducts = [product, ...products];
    setProducts(nextProducts);
    saveStairsProducts(nextProducts);
    setMode("browse");
  };

  if (mode === "upload") {
    return (
      <StairsUploadForm
        categories={allCategories}
        onCancel={() => setMode("browse")}
        onSave={handleSave}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Category filter dropdown · sticky at top of scroll area */}
      <div className="mb-3">
        <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-black/50">
          Category
        </label>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[12.5px] font-semibold text-black outline-none focus:border-orange-400"
        >
          <option value="all">All categories ({products.length})</option>
          {allCategories.map((c) => {
            const count = products.filter((p) => p.category === c.id).length;
            return (
              <option key={c.id} value={c.id}>
                {c.label} ({count})
              </option>
            );
          })}
        </select>
      </div>

      {/* Product grid · scrollable */}
      <div className="nex-hide-scroll flex-1 overflow-y-auto">
        {visibleProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-neutral-50/60 px-3.5 py-6 text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-orange-100 text-orange-700">
              <Layers className="h-5 w-5" />
            </div>
            <p className="mt-3 text-[13px] font-semibold text-black">
              {products.length === 0
                ? "No staircases uploaded yet"
                : "None in this category yet"}
            </p>
            <p className="mt-1 px-2 text-[11.5px] leading-snug text-black/55">
              {products.length === 0
                ? "Tap Upload to add your first staircase. It'll appear here so you can share it with customers in one tap."
                : "Try a different category or upload one now."}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {visibleProducts.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onInsertProduct(p)}
                  className="relative block w-full overflow-hidden rounded-2xl border border-black/10 bg-white text-left transition hover:border-orange-300 active:scale-[0.99]"
                >
                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    {/* Gradient veil at bottom for legibility */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                    <div className="absolute inset-x-2 bottom-1.5 text-white">
                      <div className="text-[12.5px] font-semibold leading-tight drop-shadow">
                        {p.name}
                      </div>
                      {p.price !== null && (
                        <div className="mt-0.5 text-[10.5px] font-semibold opacity-90">
                          £{p.price.toLocaleString("en-GB")}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer · Upload button */}
      <div className="mt-3 shrink-0">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 text-[13px] font-semibold text-white shadow-sm transition hover:bg-orange-600 active:scale-[0.99]"
        >
          <Layers className="h-4 w-4" strokeWidth={2.4} />
          Upload staircase
        </button>
      </div>
    </div>
  );
}

// ─── Stairs upload form · Philip 2026-08-03 ─────────────────────────
// Image: PHONE FILE PICKER (accept=image/* + capture=environment brings
// up the camera on iOS/Android). Compressed on-device via canvas before
// storing as a data URL. Toggles: Delivery · VAT · Installation.
function StairsUploadForm({
  categories,
  onCancel,
  onSave,
}: {
  categories: { id: string; label: string }[];
  onCancel: () => void;
  onSave: (draft: {
    category: string;
    categoryLabel: string;
    name: string;
    description: string;
    imageUrl: string;
    price: number | null;
    deliveryIncluded: boolean;
    vatIncluded: boolean;
    installationIncluded: boolean;
    addAsNewCategory: boolean;
  }) => void;
}) {
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? "staircase");
  const [customCategoryName, setCustomCategoryName] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [imageDataUrl, setImageDataUrl] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [priceText, setPriceText] = useState<string>("");
  const [deliveryIncluded, setDeliveryIncluded] = useState<boolean>(false);
  const [vatIncluded, setVatIncluded] = useState<boolean>(false);
  const [installationIncluded, setInstallationIncluded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const usingCustom = categoryId === "__custom__";

  const handleFilePick = async (file: File | null | undefined) => {
    if (!file) return;
    setUploadingImage(true);
    setError(null);
    try {
      const dataUrl = await compressImageFile(file);
      setImageDataUrl(dataUrl);
    } catch {
      setError("Couldn't read that photo. Try a different one.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const validateAndSave = () => {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) return setError("Give your staircase a name.");
    if (!imageDataUrl) return setError("Add a photo of the staircase.");

    let finalCategoryId = categoryId;
    let finalCategoryLabel =
      categories.find((c) => c.id === categoryId)?.label ?? "Staircase";
    let addingNew = false;
    if (usingCustom) {
      const label = customCategoryName.trim();
      if (!label) return setError("Name your new category or pick an existing one.");
      finalCategoryLabel = label;
      finalCategoryId = slugifyCategory(label);
      addingNew = true;
    }

    const parsedPrice = priceText.trim() === "" ? null : Number(priceText.replace(/[£,]/g, ""));
    if (parsedPrice !== null && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
      return setError("Price must be a positive number, or leave blank.");
    }

    onSave({
      category: finalCategoryId,
      categoryLabel: finalCategoryLabel,
      name: trimmedName,
      description: description.trim(),
      imageUrl: imageDataUrl,
      price: parsedPrice,
      deliveryIncluded,
      vatIncluded,
      installationIncluded,
      addAsNewCategory: addingNew,
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Category selector at TOP · per Philip's spec */}
      <div className="mb-3">
        <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-black/50">
          Category
        </label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[12.5px] font-semibold text-black outline-none focus:border-orange-400"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
          <option value="__custom__">+ Add own category</option>
        </select>
        {usingCustom && (
          <input
            type="text"
            placeholder="New category name (e.g. Handrails)"
            value={customCategoryName}
            onChange={(e) => setCustomCategoryName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[12.5px] text-black outline-none focus:border-orange-400"
          />
        )}
      </div>

      {/* Scrollable form body */}
      <div className="nex-hide-scroll flex-1 space-y-3 overflow-y-auto">
        <UploadField label="Photo">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void handleFilePick(e.target.files?.[0])}
          />
          {imageDataUrl ? (
            <div className="space-y-2">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-black/5 bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageDataUrl}
                  alt="Preview"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImageDataUrl("")}
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-red-500 text-white shadow-lg ring-2 ring-white/80 hover:bg-red-600"
                  aria-label="Remove photo"
                  title="Remove photo"
                >
                  <XIcon className="h-3.5 w-3.5" strokeWidth={2.6} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-xl border border-black/10 bg-white py-2 text-[12px] font-semibold text-black/70 hover:bg-black/[0.03]"
              >
                Change photo
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/15 bg-white/60 py-8 text-[12.5px] font-semibold text-black/60 transition hover:border-orange-300 hover:bg-orange-50/40 disabled:opacity-50"
            >
              {uploadingImage ? (
                <span>Preparing photo…</span>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  Take photo or choose from gallery
                </>
              )}
            </button>
          )}
        </UploadField>

        <UploadField label="Name">
          <input
            type="text"
            placeholder="e.g. Oak floating staircase"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[12.5px] text-black outline-none focus:border-orange-400"
          />
        </UploadField>

        <UploadField label="Description">
          <textarea
            rows={3}
            placeholder="Materials, style, dimensions, lead time…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-[12.5px] text-black outline-none focus:border-orange-400"
          />
        </UploadField>

        <UploadField label="Price (GBP · optional)">
          <input
            type="text"
            inputMode="decimal"
            placeholder="e.g. 4850"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[12.5px] text-black outline-none focus:border-orange-400"
          />
          <p className="mt-1 text-[10.5px] italic text-black/50">
            Leave blank to hide the price on the card.
          </p>
        </UploadField>

        {/* Three toggles grouped in one card · Delivery / VAT / Installation */}
        <div className="rounded-2xl border border-black/8 bg-white/70 px-3.5 py-1">
          <ToggleRow
            label="Delivery included"
            value={deliveryIncluded}
            onChange={setDeliveryIncluded}
          />
          <ToggleRow
            label="VAT included"
            value={vatIncluded}
            onChange={setVatIncluded}
          />
          <ToggleRow
            label="Installation included"
            value={installationIncluded}
            onChange={setInstallationIncluded}
            last
          />
        </div>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] leading-snug text-amber-900">
            {error}
          </div>
        )}
      </div>

      {/* Footer · Save / Cancel (Cancel = dark red destructive · Philip 2026-08-03) */}
      <div className="mt-3 flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-2xl bg-red-700 py-2.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-red-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={validateAndSave}
          className="flex-[2] rounded-2xl bg-orange-500 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-600"
        >
          Save listing
        </button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  last,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 py-2.5 ${
        last ? "" : "border-b border-black/5"
      }`}
    >
      <span className="flex-1 text-[12.5px] font-semibold text-black">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          value ? "bg-orange-500" : "bg-black/15"
        }`}
        aria-label={`${label} toggle`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            value ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function UploadField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-black/50">
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Persistent footer button ────────────────────────────────────────
// Global navigation aid. Never hidden by conversation state. Optional
// badge shows live count (Projects · Workspace) — the first step toward
// the smart-footer live-status pattern (Philip 2026-08-03).
function PersistentFooterButton({
  icon,
  label,
  badge,
  alerting,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  // Alerting · Philip 2026-08-03. Reused for the Tasks button — flips to
  // red + heartbeat pulse when any reminder has fired and the user hasn't
  // yet opened the sheet. Opening the sheet clears the alert.
  alerting?: boolean;
  onClick: () => void;
}) {
  const alertRing = alerting ? "nex-tasks-alert" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-1.5 text-[11.5px] font-semibold transition-all active:scale-[0.98] ${
        alerting
          ? `border-red-400 bg-red-500 text-white hover:bg-red-600 ${alertRing}`
          : "border-black/10 bg-white/80 text-black/70 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-800"
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={`ml-0.5 grid h-4 min-w-[16px] shrink-0 place-items-center rounded-full px-1 text-[9.5px] font-bold text-white ${
          alerting ? "bg-white/25" : "bg-orange-500"
        }`}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

// ─── Session workspace helpers (Philip 2026-08-03) ────────────────────
// Extract the current session's live card-objects for the Continue card's
// Now lane. Filter to real work items (Meeting · Image Creation) — skip
// the meta footer cards (Contacts / Continue / Play). Dismissed cards
// drop out so the count reflects what's actually open.

function collectWorkspaceItems(
  messages: Message[],
): ContinueCardData["items"] {
  const items: ContinueCardData["items"] = [];
  for (const m of messages) {
    if (!m.card || m.cardDismissed) continue;
    if (m.card.type === "meeting") {
      const f = m.card.fields;
      items.push({
        kind: "meeting",
        title: f.title || "Meeting",
        detail: `${f.date} · ${f.time}`,
        status:
          m.cardState === "prepared_waiting"
            ? "Waiting"
            : m.card.status_label,
      });
    } else if (m.card.type === "image_creation") {
      const f = m.card.fields;
      items.push({
        kind: "image_creation",
        title: f.subject !== "Not specified" ? f.subject : "Image",
        detail: f.overlay !== "Not specified" ? `Text: ${f.overlay}` : "Preview",
        status: "Preview",
      });
    }
  }
  return items;
}

function workspaceItemCount(messages: Message[]): number {
  return collectWorkspaceItems(messages).length;
}
