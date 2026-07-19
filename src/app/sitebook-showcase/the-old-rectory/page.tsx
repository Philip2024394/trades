// /sitebook-showcase/the-old-rectory — fully populated demo SiteBook
// (post-centric center-feed with 3-column layout).
//
// PUBLIC route (no auth required). Meant to be linked to prospects
// so they can see what a lived-in SiteBook actually looks like — 3
// years of projects surfaced as a stacked feed of scoped posts.
//
// LAYOUT (2026-07-18):
//   - Full-bleed hero image at top (canteen-style)
//   - Sticky project filter tabs
//   - 3-column grid on desktop:
//       LEFT  (280px) — trade search + categories + hired trades
//       CENTER (flex)  — composer + post feed
//       RIGHT (280px) — owner profile + project location (private) + WhatsApp
//   - On mobile: right (profile) card first, then center feed, then left (trades) collapsed at bottom
//
// Every image is a CSS gradient placeholder or the marketing banner —
// swap for real URLs when finalising.

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { SiteBookInboxPanel, type SiteBookInboxRow } from "@/components/homeowners/SiteBookInboxPanel";
import { HowItWorksSlot } from "@/components/homeowners/howItWorks/HowItWorksSlot";
import { SiteBookGalleryCard } from "@/components/homeowners/SiteBookGalleryCard";
import { FullGalleryView } from "@/components/homeowners/FullGalleryView";
import { AppStoreView } from "@/components/homeowners/AppStoreView";
import { FeedSectionHeader } from "@/components/homeowners/FeedSectionHeader";
import { allApps } from "@/apps/sitebook/registry";
import type { SiteBookPhoto } from "@/lib/homeowners/photos";
import { ProjectCostCard } from "@/components/homeowners/ProjectCostCard";
import { MockAppTileWrapper } from "@/components/homeowners/MockAppTileWrapper";
import { SiteBookMobileNavShell } from "@/components/homeowners/SiteBookMobileNavShell";
import { EditableHeroImage } from "@/components/homeowners/EditableHeroImage";
import { EditBannerButton } from "@/components/homeowners/EditBannerButton";
import { SitebookCardActions } from "@/components/homeowners/SitebookCardActions";
import { CostLedgerView } from "@/components/homeowners/CostLedgerView";
import type { ProjectCostSummary, CostWithPayments } from "@/lib/homeowners/costs";
import type { CostDocument } from "@/lib/homeowners/costDocuments";
import { UnifiedPostComposerPreview } from "@/components/homeowners/UnifiedPostComposerPreview";
import { UserMenuDropdown } from "@/components/UserMenuDropdown";
import type { UserMenuContext } from "@/lib/userMenuContext";
import { AskSiteBookButton } from "@/components/homeowners/AskSiteBookButton";
import { HowItWorksSectionChip } from "@/components/homeowners/howItWorks/HowItWorksSectionChip";
import {
  ShieldCheck,
  Users,
  Camera,
  MessageCircle,
  ArrowRight,
  MapPin,
  Wallet,
  Sparkles,
  Hammer,
  BookOpen,
  Send,
  MoreHorizontal,
  Star,
  Eye,
  Lock,
  Home,
  Phone,
  Mail,
  Info
} from "lucide-react";

export const metadata: Metadata = {
  title:   "SiteBook · The Old Rectory · Preview | Thenetworkers",
  robots:  { index: false, follow: false }
};

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

// ============ Fixture data ============

const OWNER = {
  firstName:   "Sarah",
  lastName:    "K.",
  nickname:    "The Old Rectory",
  slug:        "theoldrectory",
  city:        "Manchester",
  postcode:    "M15 5EQ",
  addressLine: "17 Rectory Lane",           // Private — trades with assigned projects only
  memberSince: "March 2023",
  whatsapp:    "+44 7700 900123",           // Private — trades with assigned projects only
  bio:         "Restoring a Victorian home in south Manchester. Quality over speed. Cash budget preferred, but happy to invoice.",
  avatarUrl:   "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces"
};

const STATS = {
  yearsActive: 3,
  projects:    8,
  warranties:  24,
  tradesHired: 7,
  totalSpent:  47300,
  photos:      146
};

// Trades the owner has hired on The Old Rectory (my-trades list).
// avatarUrl mirrors the canteen-member pattern — some avatars are
// images, others fall back to the yellow-circle-with-initial treatment.
// `role` matches the canteen's admin/member vocabulary so the badge
// pattern renders 1:1 with CanteenMembersStrip.
const HIRED_TRADES: Array<{
  name:            string;
  trade:           string;
  activeProjects:  number;
  rating:          number;
  featured?:       boolean;
  role?:           "lead" | "member";
  avatarUrl?:      string;
}> = [
  { name: "Watson Plumbing",     trade: "Gas engineer",        activeProjects: 2, rating: 5, featured: true, role: "lead" },
  { name: "Joe's Building",      trade: "Builder / kitchens",  activeProjects: 0, rating: 5, role: "member" },
  { name: "Sarah Tiles + Co",    trade: "Tiler",               activeProjects: 0, rating: 5, role: "member" },
  { name: "Manchester Electric", trade: "Electrician",         activeProjects: 1, rating: 4, role: "lead" },
  { name: "Manchester Roofing",  trade: "Roofer",              activeProjects: 0, rating: 5, role: "member" },
  { name: "Green Landscapes",    trade: "Landscaper",          activeProjects: 0, rating: 5, role: "member" },
  { name: "MidTown Locksmiths",  trade: "Locksmith · 24h",     activeProjects: 0, rating: 5, role: "member" }
];

// Yard-inbox-style rows for the left rail on the mock. Real /sitebook
// pulls these from hammerex_sitebook_wa_threads — see loadInboxRows in
// src/app/sitebook/page.tsx.
const nowIso = new Date().toISOString();
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const hoursAgo   = (h: number) => new Date(Date.now() - h * 60 * 60_000).toISOString();
const daysAgo    = (d: number) => new Date(Date.now() - d * 24 * 60 * 60_000).toISOString();

const MOCK_INBOX_ROWS: SiteBookInboxRow[] = [
  // ─── Trades ───────────────────────────────────────────
  { id: "t1", kind: "whatsapp", entityKind: "trade", title: "Watson Plumbing",      preview: "Yes still on for Wed 9am. Bringing the compression fitting…", createdAt: minutesAgo(12), avatarInitial: "W", isUnread: true,  linkHref: "#", projectTitle: "En-suite plumbing",  projectCity: "Manchester" },
  { id: "t2", kind: "whatsapp", entityKind: "trade", title: "Manchester Electric",  preview: "Rewire quote ready — £2,450 for the en-suite loop.",           createdAt: hoursAgo(2),   avatarInitial: "M", isUnread: true,  linkHref: "#", projectTitle: "En-suite plumbing",  projectCity: "Manchester" },
  { id: "t3", kind: "post",     entityKind: "trade", title: "Joe's Building",       preview: "Skip going in Monday. Want me to move the compost bin?",       createdAt: hoursAgo(6),   avatarInitial: "J",                  linkHref: "#", projectTitle: "Kitchen refit",       projectCity: "Manchester" },
  { id: "t6", kind: "post",     entityKind: "trade", title: "MidTown Locksmiths",   preview: "Job complete — receipt uploaded. Warranty saved 12 months.",   createdAt: daysAgo(2),    avatarInitial: "M",                  linkHref: "#", projectTitle: "Front door lock",     projectCity: "Manchester" },
  { id: "t7", kind: "whatsapp", entityKind: "trade", title: "Manchester Roofing",   preview: "Scaffold coming down Fri. Want a slate inspection while up?",  createdAt: daysAgo(3),    avatarInitial: "M",                  linkHref: "#", projectTitle: "Roof re-slate",       projectCity: "Manchester" },
  { id: "t8", kind: "whatsapp", entityKind: "trade", title: "Green Landscapes",     preview: "Priced up new gravel drive at £1,850 laid — half yours.",      createdAt: daysAgo(4),    avatarInitial: "G",                  linkHref: "#", projectTitle: "Gravel driveway",     projectCity: "Manchester" },
  { id: "t9", kind: "post",     entityKind: "trade", title: "Watson Plumbing",      preview: "New leak under en-suite basin. Photo attached — see post.",    createdAt: daysAgo(6),    avatarInitial: "W",                  linkHref: "#", projectTitle: "En-suite plumbing",  projectCity: "Manchester" },
  // ─── Merchants + Suppliers (both fold into the Suppliers section) ─
  { id: "s1", kind: "whatsapp", entityKind: "merchant", title: "Hammerex Direct",   preview: "Order out for delivery Friday — 40 boxes on the pallet.",        createdAt: hoursAgo(4),   avatarInitial: "H", isUnread: true,  linkHref: "#", projectTitle: "Kitchen refit",       projectCity: "Manchester" },
  { id: "s2", kind: "whatsapp", entityKind: "supplier", title: "Sarah Tiles + Co",  preview: "Photos of the 600x1200 samples attached in WhatsApp.",           createdAt: hoursAgo(9),   avatarInitial: "S",                  linkHref: "#", projectTitle: "En-suite plumbing",  projectCity: "Manchester" },
  { id: "s3", kind: "whatsapp", entityKind: "merchant", title: "Wickes Kitchens",   preview: "Delivery confirmed for 07:30 Monday — needs 2 parking bays.",    createdAt: daysAgo(1),    avatarInitial: "W",                  linkHref: "#", projectTitle: "Kitchen refit",       projectCity: "Manchester" },
  { id: "s4", kind: "system",   entityKind: "supplier", title: "Bosch Warranty",    preview: "Watson Plumbing · Boiler service · 5-year cover expires 2031",  createdAt: daysAgo(1),    avatarInitial: "B",                  linkHref: "#", projectTitle: "Boiler service",      projectCity: "Manchester" },
  { id: "s5", kind: "whatsapp", entityKind: "merchant", title: "Travis Perkins",    preview: "Timber ready to collect — will hold until Wed 5pm.",              createdAt: daysAgo(5),    avatarInitial: "T",                  linkHref: "#", projectTitle: "Garden decking",      projectCity: "Manchester" }
];
// Silence unused-var warning when nowIso isn't referenced.
void nowIso;

// Photo library fixtures for the mock — Facebook-style gallery card.
// On the real /sitebook these come from hammerex_sitebook_photos
// (photos survive post deletion via ON DELETE SET NULL).
const MOCK_GALLERY: SiteBookPhoto[] = [
  { id: "g1",  project_id: "proj-ensuite", post_id: "p1",  uploaded_by_type: "homeowner", uploaded_by_name: "Sarah",       storage_url: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=400&h=400&fit=crop",  caption: "En-suite before rip-out",         stage: "before",     created_at: new Date(Date.now() - 22 * 24 * 60 * 60_000).toISOString() },
  { id: "g2",  project_id: "proj-ensuite", post_id: "p2",  uploaded_by_type: "trade",     uploaded_by_name: "Watson",      storage_url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=400&fit=crop", caption: "New pipework routed",              stage: "in-progress",created_at: new Date(Date.now() - 18 * 24 * 60 * 60_000).toISOString() },
  { id: "g3",  project_id: "proj-kitchen", post_id: "p3",  uploaded_by_type: "homeowner", uploaded_by_name: "Sarah",       storage_url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",  caption: "Kitchen day 1 — skip in",          stage: "in-progress",created_at: new Date(Date.now() - 14 * 24 * 60 * 60_000).toISOString() },
  { id: "g4",  project_id: "proj-kitchen", post_id: null,  uploaded_by_type: "trade",     uploaded_by_name: "Joe's",       storage_url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=400&fit=crop",  caption: "Layout markout on floor",          stage: "in-progress",created_at: new Date(Date.now() - 12 * 24 * 60 * 60_000).toISOString() },
  { id: "g5",  project_id: "proj-kitchen", post_id: "p4",  uploaded_by_type: "trade",     uploaded_by_name: "Wickes",      storage_url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=400&fit=crop",  caption: "Units delivered",                  stage: null,         created_at: new Date(Date.now() - 10 * 24 * 60 * 60_000).toISOString() },
  { id: "g6",  project_id: "proj-ensuite", post_id: "p5",  uploaded_by_type: "trade",     uploaded_by_name: "Sarah Tiles", storage_url: "https://images.unsplash.com/photo-1620626011761-996317b8d101?w=400&h=400&fit=crop",  caption: "Tile samples on wall",             stage: null,         created_at: new Date(Date.now() - 8  * 24 * 60 * 60_000).toISOString() },
  { id: "g7",  project_id: "proj-kitchen", post_id: null,  uploaded_by_type: "homeowner", uploaded_by_name: "Sarah",       storage_url: "https://images.unsplash.com/photo-1600566753086-00f18fe6ba48?w=400&h=400&fit=crop",  caption: "Progress mid-week",                stage: "in-progress",created_at: new Date(Date.now() - 6  * 24 * 60 * 60_000).toISOString() },
  { id: "g8",  project_id: "proj-boiler",  post_id: "p6",  uploaded_by_type: "trade",     uploaded_by_name: "Watson",      storage_url: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=400&fit=crop",  caption: "Service completion cert",          stage: "after",      created_at: new Date(Date.now() - 4  * 24 * 60 * 60_000).toISOString() },
  { id: "g9",  project_id: "proj-kitchen", post_id: "p7",  uploaded_by_type: "homeowner", uploaded_by_name: "Sarah",       storage_url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",  caption: "Cabinets in — worktop next",       stage: "in-progress",created_at: new Date(Date.now() - 3  * 24 * 60 * 60_000).toISOString() },
  { id: "g10", project_id: "proj-ensuite", post_id: null,  uploaded_by_type: "homeowner", uploaded_by_name: "Sarah",       storage_url: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=400&h=400&fit=crop",  caption: "Tiler starting today",             stage: null,         created_at: new Date(Date.now() - 2  * 24 * 60 * 60_000).toISOString() },
  { id: "g11", project_id: "proj-kitchen", post_id: "p8",  uploaded_by_type: "trade",     uploaded_by_name: "Joe's",       storage_url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=400&fit=crop",  caption: "Splashback going up",              stage: "in-progress",created_at: new Date(Date.now() - 1  * 24 * 60 * 60_000).toISOString() },
  { id: "g12", project_id: "proj-decking", post_id: null,  uploaded_by_type: "homeowner", uploaded_by_name: "Sarah",       storage_url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=400&fit=crop",  caption: "Garden before decking",            stage: "before",     created_at: new Date().toISOString() }
];

// Project Cost fixtures for the mock. Real /sitebook pulls from
// loadProjectCostSummary (hammerex_sitebook_costs aggregate).
// project_image comes from hammerex_sitebook_projects.cover_photo_url.
const MOCK_COST_SUMMARY: ProjectCostSummary[] = [
  {
    project_id:    "proj-ensuite",
    project_title: "En-suite plumbing",
    project_image: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=200&h=200&fit=crop",
    agreed_pence:  550000, paid_pence: 324000, costs_count: 4, status: "watch", activated: true
  },
  {
    project_id:    "proj-kitchen",
    project_title: "Kitchen refit",
    project_image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&h=200&fit=crop",
    agreed_pence:  4500000, paid_pence: 3640000, costs_count: 8, status: "watch", activated: true
  },
  {
    project_id:    "proj-boiler",
    project_title: "Boiler service",
    project_image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=200&h=200&fit=crop",
    agreed_pence:  18000, paid_pence: 18000, costs_count: 1, status: "healthy", activated: false
  },
  {
    project_id:    "proj-decking",
    project_title: "Garden decking",
    project_image: null,   // empty state — icon fallback demonstrated
    agreed_pence:  0, paid_pence: 0, costs_count: 0, status: "empty", activated: false
  }
];

// Document fixtures for the mock ledger. Shows PDF quotes, an image
// snap of a paper receipt and a spreadsheet — the full range of what
// the upload flow accepts. All URLs are illustrative placeholders —
// real /sitebook uses signed URLs from the private bucket.
const MOCK_DOCUMENTS_BY_PROJECT: Record<string, CostDocument[]> = {
  "proj-ensuite": [
    {
      id: "d1", homeowner_id: "mock", project_id: "proj-ensuite", cost_id: "c1", post_id: null,
      kind: "quote", file_name: "Watson-Plumbing-Quote.pdf",
      storage_path: "mock/watson-quote.pdf",
      storage_url:  "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400",
      mime_type: "application/pdf", size_bytes: 184_500, note: null,
      created_at: new Date(Date.now() - 6 * 24 * 60 * 60_000).toISOString()
    },
    {
      id: "d2", homeowner_id: "mock", project_id: "proj-ensuite", cost_id: "c3", post_id: null,
      kind: "receipt", file_name: "Sarah-Tiles-Receipt.jpg",
      storage_path: "mock/sarah-tiles.jpg",
      storage_url:  "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=400&fit=crop",
      mime_type: "image/jpeg", size_bytes: 342_800, note: "Snapped in store",
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60_000).toISOString()
    }
  ],
  "proj-kitchen": [
    {
      id: "d3", homeowner_id: "mock", project_id: "proj-kitchen", cost_id: "k2", post_id: null,
      kind: "invoice", file_name: "Wickes-Invoice-Q3.pdf",
      storage_path: "mock/wickes-invoice.pdf",
      storage_url:  "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400",
      mime_type: "application/pdf", size_bytes: 268_300, note: null,
      created_at: new Date(Date.now() - 8 * 24 * 60 * 60_000).toISOString()
    },
    {
      id: "d4", homeowner_id: "mock", project_id: "proj-kitchen", cost_id: "k7", post_id: null,
      kind: "spreadsheet", file_name: "Kitchen-Cost-Breakdown.xlsx",
      storage_path: "mock/kitchen.xlsx",
      storage_url:  "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400",
      mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size_bytes: 24_120, note: null,
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString()
    }
  ],
  "proj-boiler":  [],
  "proj-decking": []
};

// Helper to build a fixture cost+payments row without repeating the
// column zoo. Every value pence-precise.
function mockCost(input: {
  id: string; projectId: string; trade: string; kind: string;
  description: string; agreedPence: number; payments: Array<{ pence: number; method: string; day: string; note?: string }>;
  dueDays?: number;
}): CostWithPayments {
  const paidPence = input.payments.reduce((sum, p) => sum + p.pence, 0);
  const status = paidPence <= 0 ? "agreed" : paidPence >= input.agreedPence ? "paid" : "part_paid";
  return {
    id:                  input.id,
    homeowner_id:        "mock",
    project_id:          input.projectId,
    trade_listing_id:    null,
    trade_name:          input.trade,
    kind:                input.kind as CostWithPayments["kind"],
    description:         input.description,
    agreed_pence:        input.agreedPence,
    paid_pence:          paidPence,
    status:              status as CostWithPayments["status"],
    post_id:             null,
    invitation_id:       null,
    agreed_at:           new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString(),
    due_at:              input.dueDays !== undefined ? new Date(Date.now() + input.dueDays * 24 * 60 * 60_000).toISOString() : null,
    created_at:          new Date().toISOString(),
    updated_at:          new Date().toISOString(),
    payments: input.payments.map((p, i) => ({
      id:            `${input.id}-p${i}`,
      cost_id:       input.id,
      amount_pence:  p.pence,
      method:        p.method as CostWithPayments["payments"][number]["method"],
      paid_at:       new Date(Date.now() - (30 - Number(p.day || 0)) * 24 * 60 * 60_000).toISOString(),
      note:          p.note ?? null,
      created_at:    new Date().toISOString()
    }))
  };
}

// Ledger fixtures per project. Sums match MOCK_COST_SUMMARY above so
// summary + ledger stay consistent when Philip navigates between them.
const MOCK_LEDGER_BY_PROJECT: Record<string, CostWithPayments[]> = {
  "proj-ensuite": [
    mockCost({ id: "c1", projectId: "proj-ensuite", trade: "Watson Plumbing",   kind: "deposit",  description: "50% deposit — boiler swap + first-fix", agreedPence: 240000, payments: [{ pence: 240000, method: "bank", day: "5" }] }),
    mockCost({ id: "c2", projectId: "proj-ensuite", trade: "Watson Plumbing",   kind: "final",    description: "Balance on completion + certificate", agreedPence: 200000, payments: [], dueDays: 5 }),
    mockCost({ id: "c3", projectId: "proj-ensuite", trade: "Sarah Tiles + Co",  kind: "materials",description: "Porcelain 600×300 · matte grey grout", agreedPence: 84000,  payments: [{ pence: 84000, method: "cash", day: "12", note: "Collected + paid in store" }] }),
    mockCost({ id: "c4", projectId: "proj-ensuite", trade: "Sarah Tiles + Co",  kind: "labour",   description: "Tiler day rate × 3 days",              agreedPence: 26000,  payments: [], dueDays: 8 })
  ],
  "proj-kitchen": [
    mockCost({ id: "k1", projectId: "proj-kitchen", trade: "Joe's Building",      kind: "labour",    description: "Demolition + skip week 1",         agreedPence: 480000,  payments: [{ pence: 480000, method: "cash",  day: "3" }] }),
    mockCost({ id: "k2", projectId: "proj-kitchen", trade: "Wickes Kitchens",     kind: "supplier",  description: "Shaker units + worktop delivery",  agreedPence: 1890000, payments: [{ pence: 1890000, method: "card", day: "5" }] }),
    mockCost({ id: "k3", projectId: "proj-kitchen", trade: "Manchester Electric", kind: "labour",    description: "Rewire + downlights + sockets",    agreedPence: 250000,  payments: [{ pence: 250000, method: "bank",  day: "10" }] }),
    mockCost({ id: "k4", projectId: "proj-kitchen", trade: "Sarah Tiles + Co",    kind: "materials", description: "Splashback + adhesive",            agreedPence: 320000,  payments: [{ pence: 320000, method: "bank",  day: "14" }] }),
    mockCost({ id: "k5", projectId: "proj-kitchen", trade: "Watson Plumbing",     kind: "labour",    description: "Sink + tap + dishwasher connect",  agreedPence: 240000,  payments: [{ pence: 240000, method: "bank",  day: "18" }] }),
    mockCost({ id: "k6", projectId: "proj-kitchen", trade: "Joe's Building",      kind: "labour",    description: "Install + trim week 3",            agreedPence: 460000,  payments: [{ pence: 460000, method: "cash",  day: "22" }] }),
    mockCost({ id: "k7", projectId: "proj-kitchen", trade: "Joe's Building",      kind: "final",     description: "Final trims + snag list",          agreedPence: 660000,  payments: [], dueDays: 3 }),
    mockCost({ id: "k8", projectId: "proj-kitchen", trade: "Rebecca Ashworth",    kind: "labour",    description: "Interior design final review",     agreedPence: 200000,  payments: [], dueDays: 10 })
  ],
  "proj-boiler": [
    mockCost({ id: "b1", projectId: "proj-boiler",  trade: "Watson Plumbing",   kind: "labour",   description: "Annual boiler service + certificate", agreedPence: 18000,  payments: [{ pence: 18000, method: "cash", day: "26" }] })
  ],
  "proj-decking": []
};

// Fixture UserMenuDropdown context for the mock header. Real /sitebook
// resolves this from cookies via resolveUserMenuContext.
const MOCK_USER_MENU_CTX: UserMenuContext = {
  kind:         "homeowner",
  displayName:  "Sarah K.",
  initial:      "S",
  avatarUrl:    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces",
  homeHref:     "/sitebook-showcase/the-old-rectory",
  homeLabel:    "My SiteBook",
  logoutAction: "/api/homeowner/logout",
  links: [
    { label: "Threads",  href: "#", hint: "WhatsApp conversations" },
    { label: "Settings", href: "#" }
  ]
};

type PostData = {
  id:          string;
  project:     string;
  projectTint: string;
  kindLabel:   string;
  kindTone:    "amber" | "green" | "blue" | "grey" | "yellow";
  authorType:  "homeowner" | "trade" | "system";
  author:      string;
  authorBadge?: string;
  when:        string;
  visibility:  "all-trades" | "selected";
  invitedTrades?: string[];
  title?:      string;
  body:        string;
  photos?:     Array<{ tint: string; label: string; stage?: "Before" | "In-progress" | "After" }>;
  replies?:    Array<{
    author:     string;
    authorType: "homeowner" | "trade";
    when:       string;
    body:       string;
    /** Nested replies — trades + owner cross-conversation. */
    children?:  Array<{ author: string; authorType: "homeowner" | "trade"; when: string; body: string }>;
  }>;
  pinned?:     boolean;
};

const FEED: PostData[] = [
  // ─── Freshly added showcase cards ─────────────────────────────────
  // Two owner-led threads at the top of the feed to make the
  // "owner posts · trades reply" pattern obvious. Both use invite-
  // scoped visibility so only the named trades can see them.
  {
    id: "np1",
    project:     "Kitchen refit",
    projectTint: "from-yellow-200 via-amber-100 to-orange-50",
    kindLabel:   "New work",
    kindTone:    "amber",
    authorType:  "homeowner",
    author:      "Sarah K.",
    authorBadge: "Project Owner · The Old Rectory · Manchester",
    when:        "22 min ago",
    visibility:  "selected",
    invitedTrades: ["Joe's Building", "Manchester Electric", "Wickes Kitchens"],
    title:       "Kitchen refit — quotes please (Nov start)",
    body:        "Full refit: rip-out, floor level, rewire, plumbing move, Shaker units from Wickes (already ordered — arriving 3rd Nov). Ballpark for labour only please + your earliest available week. Photos attached.",
    photos: [
      { tint: "from-neutral-200 via-stone-100 to-white",   label: "Kitchen as-is",    stage: "Before" },
      { tint: "from-amber-100 via-yellow-50  to-orange-50", label: "Layout markup",   stage: "Before" }
    ],
    replies: [
      {
        author: "Joe's Building", authorType: "trade", when: "18 min ago",
        body: "Cheers Sarah. Rip-out + install week ~£4,800 labour, 8 working days. Could start Mon 6 Nov if the units land on the 3rd. Free site visit Tue evening if that works?",
        children: [
          { author: "Manchester Electric", authorType: "trade", when: "14 min ago", body: "Joe — quick one: are you first-fixing the pantry side too? I want to route the ring-main to match your channels." },
          { author: "Joe's Building",      authorType: "trade", when: "10 min ago", body: "Yes mate, all four walls stripped Day 1. Channels chased Day 2 — you can pop in Wed to mark up." }
        ]
      },
      {
        author: "Manchester Electric", authorType: "trade", when: "12 min ago",
        body: "Rewire + downlights + sockets: £2,450 labour. Can slot in after Joe's first-fix — say Thu that week.",
        children: [
          { author: "Sarah K.", authorType: "homeowner", when: "8 min ago", body: "Thanks — happy with £2,450. Please confirm the downlight spec + spacing on Thu." }
        ]
      },
      { author: "Sarah K.", authorType: "homeowner", when: "6 min ago", body: "Great, both. Joe — Tue 6.30pm works. I'll be in. Manchester Electric — pencilled in for Thu 9 Nov, please confirm nearer the time." }
    ],
    pinned: true
  },
  {
    id: "np2",
    project:     "En-suite plumbing",
    projectTint: "from-blue-200 via-sky-100 to-white",
    kindLabel:   "Question",
    kindTone:    "blue",
    authorType:  "homeowner",
    author:      "Sarah K.",
    authorBadge: "Project Owner · The Old Rectory · Manchester",
    when:        "1 hour ago",
    visibility:  "selected",
    invitedTrades: ["Watson Plumbing", "Sarah Tiles + Co"],
    title:       "Waste pipe — 40mm or 50mm before the tiler starts?",
    body:        "Watson — before Sarah Tiles boxes anything in, are we running the basin waste in 40mm or 50mm? Sarah — do you need to know the pipe size before you start cutting on Fri? Just want zero surprises when the two of you cross over.",
    replies: [
      { author: "Watson Plumbing",   authorType: "trade",     when: "45 min ago", body: "40mm — code compliant for a single basin and keeps the boxing tight. Will be run + boxed before Sarah arrives Fri." },
      { author: "Sarah Tiles + Co",  authorType: "trade",     when: "30 min ago", body: "40mm suits me fine — I'll leave a 45mm cut-out for service access. Standing by for Fri." },
      { author: "Sarah K.",          authorType: "homeowner", when: "20 min ago", body: "Perfect, thanks both. Logged." }
    ]
  },
  // ─── Existing cards ───────────────────────────────────────────────
  {
    id: "p1",
    project:     "En-suite plumbing upgrade",
    projectTint: "from-yellow-200 via-amber-100 to-orange-50",
    kindLabel:   "Trade update",
    kindTone:    "blue",
    authorType:  "trade",
    author:      "Watson Plumbing",
    authorBadge: "Gas engineer · 4 projects with Sarah",
    when:        "2 hours ago",
    visibility:  "selected",
    invitedTrades: ["Watson Plumbing"],
    body:        "Valve installed. Going to leave the pressure test running overnight — will confirm no leaks tomorrow AM. Photo below.",
    photos: [
      { tint: "from-blue-200 via-slate-100 to-white", label: "Valve installed", stage: "In-progress" }
    ],
    replies: [
      { author: "Sarah (you)",     authorType: "homeowner", when: "1 hour ago",  body: "Perfect. What time will you be back tomorrow?" },
      { author: "Watson Plumbing", authorType: "trade",     when: "45 min ago", body: "Between 9 and 10 AM. Won't need site access after that — just checking + sign-off." }
    ]
  },
  {
    id: "p2",
    project:     "En-suite plumbing upgrade",
    projectTint: "from-yellow-200 via-amber-100 to-orange-50",
    kindLabel:   "Update",
    kindTone:    "yellow",
    authorType:  "homeowner",
    author:      "Sarah",
    when:        "Yesterday",
    visibility:  "selected",
    invitedTrades: ["Watson Plumbing"],
    title:       "Tile arrived — final grout colour picked",
    body:        "The matte grey grout won. Going with 3mm spacing to match the main bathroom. Not sure if you need to know this but posting so it's on record.",
    photos: [
      { tint: "from-neutral-200 via-stone-100 to-white",   label: "Grout sample" },
      { tint: "from-slate-200 via-stone-50 to-neutral-100", label: "Tile stack",  stage: "Before" }
    ],
    replies: [
      { author: "Watson Plumbing", authorType: "trade", when: "Yesterday", body: "Thanks Sarah. Doesn't affect the plumbing side but good to have logged." }
    ]
  },
  {
    id: "p3",
    project:     "Boiler service — annual",
    projectTint: "from-blue-100 via-sky-50 to-white",
    kindLabel:   "Completed",
    kindTone:    "green",
    authorType:  "homeowner",
    author:      "Sarah",
    when:        "2 weeks ago",
    visibility:  "all-trades",
    body:        "Annual boiler service done. 12-month warranty logged in the vault (auto-reminder set for Jan 2027). Thanks Watson Plumbing — third year in a row.",
    photos: [
      { tint: "from-blue-100 via-sky-50 to-white", label: "Service certificate" }
    ]
  },
  {
    id: "p4",
    project:     "Garden decking + planters",
    projectTint: "from-green-200 via-lime-100 to-emerald-50",
    kindLabel:   "Warranty logged",
    kindTone:    "green",
    authorType:  "system",
    author:      "SiteBook",
    when:        "3 days ago",
    visibility:  "all-trades",
    title:       "3-year timber warranty · Green Landscapes",
    body:        "Green Landscapes logged a 3-year timber workmanship warranty valid until May 2029. Auto-reminder set for 30 days before expiry."
  },
  {
    id: "p5",
    project:     "New request · Garden tap",
    projectTint: "from-green-200 via-lime-100 to-emerald-50",
    kindLabel:   "New work",
    kindTone:    "yellow",
    authorType:  "homeowner",
    author:      "Sarah",
    when:        "5 days ago",
    visibility:  "selected",
    invitedTrades: ["Watson Plumbing"],
    title:       "Leaky garden tap — can you take a look?",
    body:        "Hi — the outdoor tap on the north wall is dripping when the main is on. Not urgent. Would rather rebook you than try someone new. Cash budget around £80–£120 depending on part.",
    photos: [
      { tint: "from-red-100 via-rose-50 to-orange-50", label: "Leak spot", stage: "Before" }
    ],
    replies: [
      { author: "Watson Plumbing", authorType: "trade", when: "5 days ago", body: "Sure — I'll swing by Saturday morning when I'm doing the en-suite check. Free of charge if it's just the washer, £95 if the whole tap needs swapping." },
      { author: "Sarah (you)",     authorType: "homeowner", when: "5 days ago", body: "Perfect. Ta." }
    ]
  },
  {
    id: "p6",
    project:     "En-suite plumbing upgrade",
    projectTint: "from-yellow-200 via-amber-100 to-orange-50",
    kindLabel:   "Question",
    kindTone:    "blue",
    authorType:  "homeowner",
    author:      "Sarah",
    when:        "1 week ago",
    visibility:  "selected",
    invitedTrades: ["Manchester Electric"],
    title:       "Ceiling extractor — do you have a preferred model?",
    body:        "For the en-suite I need an extractor with humidistat + timer. Any model you use regularly? Prefer quiet if there's a trade-off.",
    replies: [
      { author: "Manchester Electric", authorType: "trade", when: "1 week ago", body: "Envirovent Silent 100T is the one I use most — 22 dB, humidistat + 15 min timer, £68 trade price. I have one in the van." }
    ]
  },
  {
    id: "p7",
    project:     "Bathroom refit",
    projectTint: "from-teal-200 via-cyan-100 to-blue-50",
    kindLabel:   "Update",
    kindTone:    "yellow",
    authorType:  "homeowner",
    author:      "Sarah",
    when:        "Sep 2025",
    visibility:  "selected",
    invitedTrades: ["Watson Plumbing", "Sarah Tiles + Co", "Manchester Electric"],
    title:       "Handover schedule agreed — pinning this",
    body:        "Just documenting so we all have it: Plumber Mon-Wed → Tiler Thu-Sat → Electric Mon following. Watson to confirm Wed evening before Sarah Tiles start. Anyone hits a delay please post here so nobody drives over for nothing.",
    replies: [
      { author: "Watson Plumbing",   authorType: "trade", when: "Sep 2025", body: "Agreed. First fix Mon 8am." },
      { author: "Sarah Tiles + Co",  authorType: "trade", when: "Sep 2025", body: "Understood. Standing by for the Wed evening confirm." }
    ],
    pinned: true
  },
  {
    id: "p8",
    project:     "Roof repair — chimney flashing",
    projectTint: "from-neutral-300 via-stone-200 to-slate-100",
    kindLabel:   "Completed",
    kindTone:    "green",
    authorType:  "trade",
    author:      "Manchester Roofing",
    when:        "Feb 2025",
    visibility:  "all-trades",
    title:       "Chimney flashing complete · warranty in vault",
    body:        "All flashing replaced, mortar re-pointed, gutter cleared while up there (no charge). 15-year workmanship warranty logged. Any issues in the next 15 years — call me direct.",
    photos: [
      { tint: "from-neutral-300 via-stone-200 to-slate-100", label: "Chimney",     stage: "Before" },
      { tint: "from-stone-100 via-neutral-50 to-white",       label: "New flashing", stage: "After" }
    ]
  }
];

// ============ Page ============

export default async function TheOldRectoryShowcase({
  searchParams
}: {
  searchParams: Promise<{ guide?: string; view?: string; project?: string }>;
}) {
  const sp         = await searchParams;
  // Guide mode is driven by URL — ?guide=1 opens the guide with no
  // specific card focused. ?guide=<featureId> deep-links to that card.
  const guideMode  = typeof sp.guide === "string" && sp.guide.length > 0;
  const guideFocus = guideMode && sp.guide !== "1" ? sp.guide : null;

  // Cost ledger mode — ?view=costs&project=<id> swaps the CENTER feed
  // for the Cost Ledger of that project.
  const activeProject   = sp.project ?? null;
  const costLedgerMode  = sp.view === "costs" && !!activeProject;
  const galleryMode     = sp.view === "gallery";
  const appsMode        = sp.view === "apps";
  const ledgerCosts     = costLedgerMode && activeProject ? (MOCK_LEDGER_BY_PROJECT[activeProject] ?? []) : [];
  const ledgerDocs      = costLedgerMode && activeProject ? (MOCK_DOCUMENTS_BY_PROJECT[activeProject] ?? []) : [];
  const ledgerTitle     = costLedgerMode
    ? (MOCK_COST_SUMMARY.find((s) => s.project_id === activeProject)?.project_title ?? "Project")
    : "";
  const HREF_BASE = "/sitebook-showcase/the-old-rectory";

  return (
    // Normal page-scroll layout with sticky sidebars — single SiteBook
    // shell header (no XratedHeader) so the SiteBook feels like its
    // own app-shell, not nested inside the marketing site.
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>

      {/* SINGLE SiteBook shell header — no marketing header above it. */}
      <div className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-neutral-900 shadow-sm" style={{ backgroundColor: BRAND_YELLOW }}>
              <BookOpen size={14} strokeWidth={2.4}/>
            </span>
            <span className="font-black text-neutral-900">SiteBook</span>
          </div>
          <div className="flex items-center gap-3 text-[11.5px] font-bold text-neutral-700">
            <span className="hidden sm:inline">Projects</span>
            <span className="hidden sm:inline">Warranties</span>
            <span className="hidden sm:inline">Settings</span>
            {/* Round avatar + dropdown menu — replaces the flat "Sarah K."
                pill per Philip 2026-07-19. Uses UserMenuDropdown with a
                static fixture ctx so the mock renders without auth. */}
            <UserMenuDropdown ctx={MOCK_USER_MENU_CTX}/>
          </div>
        </div>
      </div>

      {/* FULL-SIZE HERO — spans the full page width above the 3-column
          grid. Marketing-scale banner (480/560/640 px tall by breakpoint). */}
      <section className="relative overflow-hidden" style={{ backgroundColor: "#0A0A0A" }}>
        <EditableHeroImage
          defaultUrl="https://ik.imagekit.io/9huhxxvtr/tr:w-1920,f-auto,q-80/ChatGPT%20Image%20Jul%2018,%202026,%2009_33_33%20AM.png"
          alt="The Old Rectory — Sarah's SiteBook"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.45) 55%, rgba(10,10,10,0.10) 100%)"
          }}
        />

        <div className="relative mx-auto flex min-h-[420px] max-w-7xl flex-col justify-end px-4 pb-8 pt-14 text-white sm:min-h-[500px] sm:px-6 sm:pb-10 sm:pt-20 lg:min-h-[560px] lg:pb-12 lg:pt-24">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl backdrop-blur-md" style={{ backgroundColor: "rgba(255,179,0,0.90)" }}>
                  <Home size={20} strokeWidth={2.5} className="text-neutral-900"/>
                </span>
                <div>
                  <p className="text-[9.5px] font-black uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>SiteBook</p>
                  <p className="text-[9.5px] text-white/70">since {OWNER.memberSince}</p>
                </div>
              </div>
              <h1 className="mt-3 text-3xl font-black leading-tight drop-shadow-lg sm:text-5xl lg:text-6xl">
                {OWNER.nickname}
              </h1>
              <p className="mt-1 text-[13px] text-white/85 drop-shadow">
                <MapPin className="mr-0.5 inline h-3 w-3 -translate-y-0.5"/> {OWNER.city} · thenetworkers.app/<span className="font-black text-white">{OWNER.slug}</span>
              </p>
            </div>
            {/* Edit banner — owner-only control, replaces the old
                Private badge. Opens a modal with Upload + Library
                tabs. Only the SiteBook owner sees this. */}
            <EditBannerButton currentBannerId="the-old-rectory" demoMode/>
          </div>

          {/* Stats strip overlaid on hero */}
          <div className="mt-5 grid grid-cols-4 gap-2">
            <HeroStat icon={<Hammer size={12}/>}      value={STATS.projects.toString()}                   label="Projects"/>
            <HeroStat icon={<ShieldCheck size={12}/>} value={STATS.warranties.toString()}                 label="Warranties"/>
            <HeroStat icon={<Users size={12}/>}       value={STATS.tradesHired.toString()}                label="Trades"/>
            <HeroStat icon={<Wallet size={12}/>}      value={`£${(STATS.totalSpent/1000).toFixed(0)}k`}   label="Spent"/>
          </div>
        </div>
      </section>

      {/* 3-column layout — normal page scroll, sticky sidebars. */}
      <div className="mx-auto max-w-6xl px-0 lg:px-4">
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[300px_minmax(0,1fr)_320px]">

          {/* ==================== LEFT SIDEBAR ==================== */}
          {/* Yard-style SiteBookInboxPanel is the ONLY left container.
              Team & Trades avatar strip removed per Philip's directive. */}
          <aside className="order-3 hidden lg:order-1 lg:block" data-tour="left-panel">
            <div className="space-y-4 p-4" data-tour="inbox-row">
              {/* Inline chip above the panel that jumps straight to the
                  Search-project feature card in the guide. */}
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-[9.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
                  Trades &amp; Suppliers
                </span>
                <HowItWorksSectionChip featureId="search-project" title="Trades &amp; Suppliers"/>
              </div>
              <SiteBookInboxPanel
                rows={MOCK_INBOX_ROWS}
                addHref="/trade-off/yard/canteens?previewInvite=1"
              />

              {/* Photo library — Facebook-style thumbnail grid.
                  Replaces Home Care + Things to fix on the left rail
                  (Philip 2026-07-19). Photos survive post deletion
                  (post_id FK is SET NULL). Click a thumbnail to open
                  a lightbox with source-post link. */}
              <SiteBookGalleryCard
                photos={MOCK_GALLERY}
                projects={[
                  { id: "proj-ensuite", title: "En-suite plumbing" },
                  { id: "proj-kitchen", title: "Kitchen refit"     },
                  { id: "proj-boiler",  title: "Boiler service"    },
                  { id: "proj-decking", title: "Garden decking"    }
                ]}
                seeAllHref={`${HREF_BASE}?view=gallery`}
                postHrefPrefix={HREF_BASE}
                demoMode
              />
            </div>
          </aside>

          {/* ==================== CENTER — feed column (normal flow) ==================== */}
          <div className="order-2">

            <div className="w-full px-[5px] py-6">
              {guideMode ? (
                /* Guide-mode swap — replaces composer + feed with the
                   HowItWorksGuide surface. Deep-link support via
                   ?guide=<featureId> is handled inside the component. */
                <>
                  <FeedSectionHeader hrefBase={HREF_BASE} activeView="guide"/>
                  <HowItWorksSlot focusId={guideFocus}/>
                </>
              ) : costLedgerMode && activeProject ? (
                /* Cost-ledger swap — right-rail Project Cost row
                   navigation lands here. Full ledger for one project
                   with per-row Mark paid / Delete actions. Fixture
                   data lives in MOCK_LEDGER_BY_PROJECT. */
                <CostLedgerView
                  projectId={activeProject}
                  projectTitle={ledgerTitle}
                  costs={ledgerCosts}
                  documents={ledgerDocs}
                  hrefBase={HREF_BASE}
                  demoMode
                />
              ) : galleryMode ? (
                /* Full gallery swap — Photo Library "See all" lands
                   here (?view=gallery). Same mock fixtures the card
                   already uses, in a larger grid with filters. */
                <>
                  <FeedSectionHeader hrefBase={HREF_BASE} activeView="gallery"/>
                  <FullGalleryView
                    photos={MOCK_GALLERY}
                    projects={[
                      { id: "proj-ensuite", title: "En-suite plumbing" },
                      { id: "proj-kitchen", title: "Kitchen refit"     },
                      { id: "proj-boiler",  title: "Boiler service"    },
                      { id: "proj-decking", title: "Garden decking"    }
                    ]}
                    hrefBase={HREF_BASE}
                    postHrefPrefix={HREF_BASE}
                    demoMode
                  />
                </>
              ) : appsMode ? (
                /* App Store swap — the "App Store" link in the section
                   header lands here. Mock shows Project Cost installed
                   to match Sarah's fixture. */
                <>
                  <FeedSectionHeader hrefBase={HREF_BASE} activeView="apps"/>
                  <AppStoreView
                    apps={allApps()}
                    installedSlugs={["project-cost"]}
                    demoMode
                  />
                </>
              ) : (
                <>
                  {/* Section-header row — three feed-area links
                      (Composer / App Store / How it works). Active
                      link is underlined in brand yellow. */}
                  <FeedSectionHeader hrefBase={HREF_BASE} activeView="composer"/>
                  <div data-tour="composer">
                    <UnifiedPostComposerPreview
                      authorInitial="S"
                      authorName="Sarah K."
                      authorSubtitle="Project Owner · The Old Rectory · Manchester"
                      authorAvatarUrl={OWNER.avatarUrl}
                      projects={[
                        { id: "proj-ensuite", title: "En-suite plumbing" },
                        { id: "proj-kitchen", title: "Kitchen refit"     },
                        { id: "proj-boiler",  title: "Boiler service"    },
                        { id: "proj-decking", title: "Garden decking"    }
                      ]}
                      trades={[
                        { listingId: "L-watson",  name: "Watson Plumbing",     tradeType: "Plumber" },
                        { listingId: "L-electric",name: "Manchester Electric", tradeType: "Electrician" },
                        { listingId: "L-tiles",   name: "Sarah Tiles + Co",    tradeType: "Tiler" },
                        { listingId: "L-joe",     name: "Joe's Building",      tradeType: "Builder" },
                        { listingId: "L-roofing", name: "Manchester Roofing",  tradeType: "Roofer" }
                      ]}
                    />
                  </div>

                  <div className="mt-6 mb-3 flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Feed</span>
                    <HowItWorksSectionChip featureId="thread-replies" title="Feed"/>
                  </div>
                  <div className="space-y-4">
                    {FEED.map((post, i) => (
                      <div key={post.id} {...(i === 0 ? { "data-tour": "post-card" } : {})}>
                        <PostCard post={post}/>
                      </div>
                    ))}
                  </div>

                  {/* Bottom "this is a preview" CTA — lives inside the
                      center scroll so users hit it after all the posts. */}
                  <div className="mt-14 rounded-3xl px-6 py-10 text-center text-white sm:px-10 sm:py-14" style={{ backgroundColor: "#0A0A0A" }}>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: BRAND_YELLOW }}>This is a preview SiteBook</p>
                    <h2 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">Every homeowner gets a feed like this.</h2>
                    <p className="mx-auto mt-3 max-w-lg text-[13px] text-white/80">
                      One post per topic. Invite only the trades who need to see it. Everything logged, forever.
                    </p>
                    <Link
                      href="/homeowners"
                      className="mt-6 inline-flex h-12 items-center gap-2 rounded-full px-6 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-lg transition hover:brightness-95"
                      style={{ backgroundColor: BRAND_YELLOW }}
                    >
                      Create my SiteBook — free
                      <ArrowRight className="h-3.5 w-3.5"/>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ==================== RIGHT SIDEBAR — sticky ==================== */}
          {/* Hidden on mobile; the owner profile card renders inline
              above the composer on mobile via MobileOwnerCard below. */}
          <aside className="order-1 hidden lg:order-3 lg:block">
            <div className="space-y-4 p-4">

              {/* Owner profile card — FIRST on right rail per Philip
                  2026-07-19. Home Care moved to LEFT rail; HowItWorks
                  bumped below the profile. Contact identity is the
                  first thing under the hero banner. */}
              <div className="overflow-hidden rounded-2xl border-2 bg-white shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                <div className="h-16 w-full" style={{ background: `linear-gradient(135deg, ${BRAND_YELLOW} 0%, #F59E0B 100%)` }}/>
                <div className="px-4 pb-4">
                  <div className="-mt-8 flex items-end justify-between">
                    {/* Round profile photo — over Sarah's name per
                        Philip 2026-07-19. Falls back to a yellow-tinted
                        initial circle when avatarUrl is missing. */}
                    {OWNER.avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={OWNER.avatarUrl}
                        alt={`${OWNER.firstName} ${OWNER.lastName}`}
                        className="h-16 w-16 rounded-full border-4 border-white object-cover shadow-md"
                      />
                    ) : (
                      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border-4 border-white text-[22px] font-black text-neutral-900 shadow-md" style={{ backgroundColor: BRAND_YELLOW }}>
                        {OWNER.firstName.substring(0,1)}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[15px] font-black text-neutral-900">{OWNER.firstName} {OWNER.lastName}</p>
                  <p className="text-[10.5px] text-neutral-500">Owner · SiteBook since {OWNER.memberSince}</p>
                  <p className="mt-2 text-[11.5px] leading-snug text-neutral-700">{OWNER.bio}</p>

                  {/* Location — merged into the profile card (city public,
                      exact address only shown to assigned trades). */}
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2">
                    <MapPin size={13} className="shrink-0 text-neutral-500"/>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-black text-neutral-900">
                        {OWNER.city}
                        <span className="ml-1.5 text-[10.5px] font-bold text-neutral-500">
                          · {OWNER.postcode.split(" ")[0]} area
                        </span>
                      </p>
                    </div>
                    <Lock size={11} className="shrink-0 text-neutral-400" aria-label="Exact address hidden — assigned trades only"/>
                  </div>

                  <div className="mt-4 border-t border-neutral-100 pt-3">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[9.5px] font-black uppercase tracking-[0.22em] text-neutral-500">Contact {OWNER.firstName}</p>
                      <HowItWorksSectionChip featureId="reveals-pricing" title="Reveals + Pricing"/>
                    </div>
                    <a
                      href={`https://wa.me/${OWNER.whatsapp.replace(/\D/g, "")}`}
                      className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[12px] font-black uppercase tracking-wider text-white shadow-sm transition hover:brightness-95"
                      style={{ backgroundColor: BRAND_GREEN }}
                    >
                      <MessageCircle size={13}/> WhatsApp
                    </a>
                    <p className="mt-2 text-[10px] leading-snug text-neutral-500">Number revealed on tap</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-neutral-500">
                      <span className="inline-flex items-center gap-0.5"><Phone size={9}/> Phone hidden</span>
                      <span className="inline-flex items-center gap-0.5"><Mail size={9}/> Email hidden</span>
                      <span className="inline-flex items-center gap-0.5 text-neutral-400">until hired</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Project Cost — now a SiteBook App (see /sitebook/apps).
                  In this showcase Sarah has installed it, so the tile
                  renders. On a fresh /sitebook the tile is absent
                  until the homeowner installs it from the App Store. */}
              <MockAppTileWrapper slug="project-cost" initialInstalled>
                <ProjectCostCard summaries={MOCK_COST_SUMMARY} hrefBase={HREF_BASE}/>
              </MockAppTileWrapper>

              {/* Right rail trimmed per Philip 2026-07-19 — App-Store
                  discovery chip, Share block and How-it-works button
                  all removed. App Store now lives only in the top
                  section-header row (Feed Posting / App Store / How it
                  works). Right rail leads with the owner profile and
                  ends with the Project Cost tile. */}
            </div>
          </aside>

        </div>
      </div>


      <XratedFooter/>

      {/* Ask SiteBook — floating yellow pill bottom-right. Overlay,
          doesn't touch the 3-column layout (Rule 3). */}
      <AskSiteBookButton/>

      {/* Mobile bottom nav — only visible < md. Rails on this page
          are hidden on mobile; their panels open here as sheets. */}
      <SiteBookMobileNavShell
        tradesContent={
          <SiteBookInboxPanel
            rows={MOCK_INBOX_ROWS}
            addHref="/trade-off/yard/canteens?previewInvite=1"
          />
        }
        photosContent={
          <SiteBookGalleryCard
            photos={MOCK_GALLERY}
            projects={[
              { id: "proj-ensuite", title: "En-suite plumbing" },
              { id: "proj-kitchen", title: "Kitchen refit"     },
              { id: "proj-boiler",  title: "Boiler service"    },
              { id: "proj-decking", title: "Garden decking"    }
            ]}
            seeAllHref={`${HREF_BASE}?view=gallery`}
            postHrefPrefix={HREF_BASE}
            demoMode
          />
        }
      />
    </main>
  );
}

// ============ Components ============

function HeroStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/10 p-2 backdrop-blur-md">
      <div className="flex items-center gap-1 text-white/70">
        {icon}<p className="text-[8.5px] font-black uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-0.5 text-[15px] font-black text-white drop-shadow">{value}</p>
    </div>
  );
}


function PostCard({ post }: { post: PostData }) {
  const kindTones: Record<PostData["kindTone"], { bg: string; fg: string }> = {
    amber:  { bg: "#FFFBEB", fg: "#B45309" },
    green:  { bg: "#F0FDF4", fg: "#166534" },
    blue:   { bg: "#EFF6FF", fg: "#1D4ED8" },
    grey:   { bg: "#F5F5F5", fg: "#404040" },
    yellow: { bg: "#FEF9C3", fg: "#854D0E" }
  };
  const tone = kindTones[post.kindTone];

  return (
    <article className="rounded-2xl border-2 bg-white p-5 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AuthorAvatar post={post}/>
          <div>
            <div className="flex flex-wrap items-baseline gap-1.5">
              <p className="text-[13.5px] font-black text-neutral-900">{post.author}</p>
              {post.authorType === "system" && <span className="inline-flex items-center rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-neutral-500">system</span>}
              {post.authorType === "trade" && <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-800">trade</span>}
              {post.pinned && <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-800"><Star size={9}/> pinned</span>}
            </div>
            {post.authorBadge && <p className="text-[10.5px] text-neutral-500">{post.authorBadge}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-neutral-500">
              <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `linear-gradient(to right, ${tone.bg}, white)`, color: tone.fg }}>
                {post.kindLabel}
              </span>
              <span>·</span>
              <span className={`inline-flex items-center gap-0.5 rounded-full bg-gradient-to-br ${post.projectTint} px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-neutral-800`}>
                {post.project}
              </span>
              <span>·</span>
              <span>{post.when}</span>
            </div>
          </div>
        </div>
        <button className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100"><MoreHorizontal size={14}/></button>
      </div>

      {/* Body */}
      {post.title && <p className="mt-3 text-[15px] font-black text-neutral-900">{post.title}</p>}
      <p className={`text-[13px] leading-relaxed text-neutral-700 ${post.title ? "mt-1.5" : "mt-3"}`}>{post.body}</p>

      {/* Photos — deliberately kept small (thumbnail-scale). Real
          social feeds go big; SiteBook goes small because these are
          documentation photos, not hero content. Single photo caps
          at ~200px tall; multiple photos = grid of small squares. */}
      {post.photos && post.photos.length > 0 && (
        <div className={`mt-3 grid gap-2 ${post.photos.length === 1 ? "grid-cols-1 max-w-[220px]" : "max-w-md grid-cols-3"}`}>
          {post.photos.map((ph, i) => (
            <div key={i} className={`relative aspect-square rounded-lg bg-gradient-to-br ${ph.tint} p-1 shadow-sm`}>
              <div className="flex h-full w-full items-center justify-center rounded text-center text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                {ph.label}
              </div>
              {ph.stage && (
                <span className="absolute left-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
                  {ph.stage}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Visibility + invited trades */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg bg-neutral-50 px-3 py-2 text-[10.5px]">
        {post.visibility === "all-trades" ? (
          <>
            <Eye size={11} className="text-neutral-500"/>
            <span className="font-black uppercase tracking-wider text-neutral-600">All trades on this project</span>
          </>
        ) : (
          <>
            <Lock size={11} className="text-neutral-500"/>
            <span className="font-black uppercase tracking-wider text-neutral-600">Visible to:</span>
            {post.invitedTrades?.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-800 shadow-sm">
                {t}
              </span>
            ))}
          </>
        )}
      </div>

      {/* Card footer — reactions + collapsible comments panel.
          Same shape as YardPostCard / CanteenPostCard. NO WhatsApp
          on SiteBook cards (invited trades already have direct
          access; WhatsApp bounce is for Yard/Canteen public posts). */}
      <SitebookCardActions
        replies={post.replies ?? []}
        initialCounts={{
          like: post.authorType === "trade" ? 2 : (post.pinned ? 3 : 1)
        }}
        viewerName="Sarah"
        viewerInitial="S"
      />
    </article>
  );
}

function AuthorAvatar({ post }: { post: PostData }) {
  if (post.authorType === "system") {
    return (
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
        <Sparkles size={16}/>
      </span>
    );
  }
  if (post.authorType === "trade") {
    return (
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[13px] font-black text-blue-900">
        {post.author.substring(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-black text-neutral-900" style={{ backgroundColor: BRAND_YELLOW }}>
      {post.author.substring(0, 1)}
    </span>
  );
}
