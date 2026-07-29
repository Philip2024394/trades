"use client";
// MaterialsLanding — Screen 2 module launcher (Philip 2026-07-28).
//
// Structure (top to bottom):
//   · Two-column title area: title/subtitle/description LEFT,
//     "Today's Overview" 2×2 metric card RIGHT
//   · Six large horizontal module cards — timber illustration LEFT,
//     icon badge + title + subtitle + chevron RIGHT
//
// No functionality. This is purely a launcher — every card navigates
// to a dedicated sub-page. Metric overview reads from an existing
// service (stockSummaryForOwner) via the page's server component and
// is passed in as props.

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  Package, FileBox, BarChart3, ClipboardList, Scissors,
  Layers, TreeDeciduous, Lock, TreePine, Blocks, Square,
} from "lucide-react";
import { MT } from "./_tokens";
import { MaterialsAppShell } from "./MaterialsAppShell";
import { TimberIllustration } from "./_TimberIllustration";
import { MaterialsAskBar } from "./MaterialsAskBar";
import { RecentActivity } from "./RecentActivity";
import type { ActivityGroup } from "@/apps/materials/_services/recent_activity";

export type OverviewData = {
  boards: number;
  packs: number;
  availableM3: number;
  reservedM3: number;
};

type ModuleCard = {
  slug: string;
  title: string;
  subtitle: string;
  icon: typeof Package;
  illustration: "packs" | "board" | "measure" | "stack" | "staircase" | "offcuts";
  route: string;
};

// Module cards reshaped 2026-07-28 (Philip) around MATERIAL TYPE at
// the top (Hardwood Stock · Softwood Stock · Stair Parts · Sheets) with
// cross-cutting inventory views below. Suppliers moved out of the card
// grid entirely — reachable from the Recent Activity container.
const MODULES: ModuleCard[] = [
  { slug: "hardwood",    title: "Hardwood Stock",   subtitle: "Oak · Ash · Walnut · Sapele. Packs, boards and measurements.", icon: Package,      illustration: "packs",     route: "/nex-app/materials/packs" },
  { slug: "softwood",    title: "Softwood Stock",   subtitle: "Pine · Redwood · Hemlock. Boards, joists and framing timber.", icon: TreePine,     illustration: "board",     route: "/nex-app/materials/softwood" },
  { slug: "stair-parts", title: "Stair Parts",      subtitle: "Newels · balusters · handrails · baserails · blanks.",         icon: Blocks,       illustration: "staircase", route: "/nex-app/materials/stair-parts" },
  { slug: "sheets",      title: "Sheets",           subtitle: "MDF · plywood · veneered board · flooring.",                   icon: Square,       illustration: "stack",     route: "/nex-app/materials/sheets" },
  { slug: "boards",      title: "Individual Boards",subtitle: "View and manage every board across your stock.",               icon: FileBox,      illustration: "board",     route: "/nex-app/materials/boards" },
  { slug: "stock",       title: "Stock Summary",    subtitle: "See total volume by species and check available stock.",       icon: BarChart3,    illustration: "stack",     route: "/nex-app/materials/stock" },
  { slug: "allocation",  title: "Board Allocation", subtitle: "Reserve boards for projects and manage allocations.",          icon: ClipboardList, illustration: "staircase", route: "/nex-app/materials/allocation" },
  { slug: "offcuts",     title: "Offcuts",          subtitle: "Manage offcuts and remaining timber inventory.",               icon: Scissors,     illustration: "offcuts",   route: "/nex-app/materials/offcuts" },
];

export function MaterialsLanding({
  overview, activity,
}: {
  overview: OverviewData;
  activity: ActivityGroup[];
}) {
  const router = useRouter();
  return (
    <MaterialsAppShell backHref="/nex-app">
      <TitleRow overview={overview} />

      {/* Ask NEX — inline pill-style bar (same placement pattern as the
          Trade Centre page). Owner types what's happened; the input
          routes into the confirmation workflow with the query pre-filled. */}
      <div className="mt-5">
        <MaterialsAskBar />
      </div>

      {/* Recent Activity — reads from the audit log. Empty until the
          owner starts using NEX. */}
      <RecentActivity groups={activity} />

      <div className="mt-6 text-[11px] font-bold uppercase tracking-wider" style={{ color: MT.secondaryGrey }}>
        Or manage manually
      </div>
      <div className="mt-2 flex flex-col gap-3.5">
        {MODULES.map((m) => (
          <ModuleCardView key={m.slug} card={m} onOpen={() => router.push(m.route)} />
        ))}
      </div>
    </MaterialsAppShell>
  );
}

// ── Title + Overview ─────────────────────────────────────────────

function TitleRow({ overview }: { overview: OverviewData }) {
  return (
    <div className="grid grid-cols-1 gap-4 pt-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
      <div className="min-w-0">
        <h1 className="font-extrabold leading-tight tracking-tight" style={{ fontSize: MT.fontPageTitle, letterSpacing: -0.5 }}>
          <span style={{ color: MT.primary }}>NEX</span>
          <span style={{ color: MT.darkGrey }}> MATERIALS</span>
        </h1>
        <p className="mt-1.5 text-[14px] font-semibold" style={{ color: MT.darkGrey }}>
          Hardwood Manager v1.0
        </p>
        <p className="mt-2 max-w-md text-[13.5px] leading-relaxed" style={{ color: MT.secondaryGrey }}>
          Manage your hardwood inventory, measurements and stock with precision.
        </p>
      </div>
      <OverviewCard overview={overview} />
    </div>
  );
}

function OverviewCard({ overview }: { overview: OverviewData }) {
  return (
    <div
      className="p-4"
      style={{
        background: MT.card,
        border: `1px solid ${MT.border}`,
        borderRadius: MT.radiusLg,
        boxShadow: MT.shadowSoft,
      }}
    >
      <div className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ color: MT.secondaryGrey }}>
        Today&apos;s Overview
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Metric icon={<Layers      size={22} strokeWidth={1.9} style={{ color: MT.primary }} />} value={fmt(overview.boards)}       label="Boards" />
        <Metric icon={<Package     size={22} strokeWidth={1.9} style={{ color: MT.primary }} />} value={fmt(overview.packs)}        label="Packs" />
        <Metric icon={<TreeDeciduous size={22} strokeWidth={1.9} style={{ color: MT.success }} />} value={`${overview.availableM3.toFixed(1)} m³`} label="Available" />
        <Metric icon={<Lock        size={22} strokeWidth={1.9} style={{ color: MT.primary }} />} value={`${overview.reservedM3.toFixed(1)} m³`}   label="Reserved" />
      </div>
    </div>
  );
}

function Metric({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[17px] font-bold" style={{ color: MT.darkGrey }}>{value}</div>
        <div className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: MT.secondaryGrey }}>{label}</div>
      </div>
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString();
}

// ── Module card ──────────────────────────────────────────────────

function ModuleCardView({ card, onOpen }: { card: ModuleCard; onOpen: () => void }) {
  const Icon = card.icon;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex overflow-hidden text-left transition-all"
      style={{
        background: MT.card,
        border: `1px solid ${MT.borderLight}`,
        borderRadius: MT.radiusLg,
        boxShadow: MT.shadowSoft,
        minHeight: 128,
        transitionDuration: MT.medium,
        transitionTimingFunction: MT.ease,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = MT.shadowLift;
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = MT.shadowSoft;
        e.currentTarget.style.transform = "translateY(0)";
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = "translateY(0) scale(0.995)"; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
      aria-label={card.title}
    >
      {/* Orange highlight bar on the very left edge */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0"
        style={{ width: 4, background: MT.primary, borderTopLeftRadius: MT.radiusLg, borderBottomLeftRadius: MT.radiusLg }}
      />

      {/* Timber illustration */}
      <div className="relative w-[34%] shrink-0 sm:w-[26%]" style={{ minWidth: 128 }}>
        <TimberIllustration variant={card.illustration} className="absolute inset-0" />
      </div>

      {/* Info block */}
      <div className="relative flex min-w-0 flex-1 items-center gap-4 px-4 py-4 sm:gap-5 sm:px-6">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
          style={{ background: MT.primarySoft, color: MT.primary, border: `1px solid ${MT.primaryBorder}` }}
        >
          <Icon size={20} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-extrabold leading-tight tracking-tight" style={{ color: MT.darkGrey }}>
            {card.title}
          </div>
          <div className="mt-1.5 text-[13px] leading-snug" style={{ color: MT.secondaryGrey }}>
            {card.subtitle}
          </div>
        </div>
        <ChevronArt />
      </div>
    </button>
  );
}

function ChevronArt() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={MT.primary} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}
