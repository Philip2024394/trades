// src/app/nex-head-quarters/work-map/page.tsx
//
// NEX Master Work & Architecture Map · founder-facing view.
//
// Reads docs/nex-work-map.json (canonical source · v1.1.0) and renders:
//   - Status distribution bar
//   - Groups of capability cards with build-sequence badges
//   - Heartbeat pulse on the currently-building capability
//   - Green "NEXT BEST" ring on the next suggested build (max NEX growth)
//   - Red flashing retro-benefit dots · click to reveal cross-section uplift
//   - Impact-boost graph (what this capability boosts when built)
//   - Do-not-repeat register (completed investigations)
//   - Rogue-pages + duplicate-paths report
//   - Programmer-agent teaching feed (NEX1/NEX2/NEX3 read this before code changes)
//
// Route: /nex-head-quarters/work-map

import Link from "next/link";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Ban,
  Zap,
  ArrowRight,
  Activity as ActivityIcon,
} from "lucide-react";
import QuickNavStrip from "./QuickNavStrip";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "NEX Work Map · Headquarters",
  robots: { index: false },
};

type Status =
  | "DISCOVERED"
  | "AUDITED"
  | "IMPLEMENTED"
  | "ACTIVE"
  | "DEFERRED"
  | "BLOCKED";

interface RetroBenefit {
  target_cap: string;
  suggested_sub_capability: string;
  intelligence_uplift: string;
  priority: "high" | "medium" | "low";
  surfaced_by: string;
}

interface Capability {
  id: string;
  name: string;
  group: string;
  status: Status;
  audit_refs: string[];
  architecture_refs: string[];
  implementation_refs: string[];
  storage_home: string;
  active_components: string[];
  tests: string[];
  known_gaps: string[];
  dependencies: string[];
  ui_url: string | null;
  last_verified: string;
  next_authorised_action: string;
  do_not_repeat: { audit: boolean | string; reason: string };
  build_sequence_number: number | null;
  is_currently_building: boolean;
  impact_score: number;
  build_sequence_note: string | null;
  impact_boost_to: string[];
  retro_benefits_available: RetroBenefit[];
}

interface Investigation {
  id: string;
  name: string;
  adr: string;
  date: string;
  status: string;
  do_not_repeat: boolean;
  reason: string;
}

interface RoguePage {
  path: string;
  url: string;
  flag: "review" | "keep" | "consolidate";
  reason: string;
}

interface DuplicatePath {
  paths: string[];
  flag: string;
  reason: string;
}

interface WorkMap {
  map_version: string;
  last_updated: string;
  authored_by: string;
  authorised_by: string;
  purpose: string;
  constitutional_rule: string;
  constitutional_rule_v2?: string;
  groups: string[];
  capabilities: Capability[];
  completed_investigations: Investigation[];
  rogue_pages: RoguePage[];
  duplicate_ui_paths: DuplicatePath[];
  active_build: string | null;
  next_suggested_build: string | null;
  build_sequence_rationale: string;
}

const STATUS_STYLE: Record<Status, { bg: string; text: string; label: string; ring: string }> = {
  DISCOVERED: { bg: "bg-blue-500", text: "text-white", label: "🔵 Discovered", ring: "ring-blue-500" },
  AUDITED: { bg: "bg-yellow-500", text: "text-black", label: "🟡 Audited", ring: "ring-yellow-500" },
  IMPLEMENTED: { bg: "bg-orange-500", text: "text-white", label: "🟠 Implemented", ring: "ring-orange-500" },
  ACTIVE: { bg: "bg-green-600", text: "text-white", label: "🟢 Active", ring: "ring-green-600" },
  DEFERRED: { bg: "bg-gray-500", text: "text-white", label: "⚫ Deferred", ring: "ring-gray-500" },
  BLOCKED: { bg: "bg-red-600", text: "text-white", label: "🔴 Blocked", ring: "ring-red-600" },
};

const HEARTBEAT_CSS = `
@keyframes nex-heartbeat {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
  25% { transform: scale(1.15); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.3); }
  50% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
  75% { transform: scale(1.10); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.2); }
}
@keyframes nex-retro-dot {
  0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
  50% { transform: scale(1.4); opacity: 0.7; box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
}
@keyframes nex-next-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0.2); }
}
.nex-heartbeat { animation: nex-heartbeat 1.4s ease-in-out infinite; }
.nex-retro-dot { animation: nex-retro-dot 1.2s ease-in-out infinite; }
.nex-next-glow { animation: nex-next-glow 2.4s ease-in-out infinite; }
`;

async function loadMap(): Promise<WorkMap> {
  const filePath = join(process.cwd(), "docs", "nex-work-map.json");
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as WorkMap;
}

function StatusPill({ status }: { status: Status }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.DISCOVERED;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.bg} ${s.text}`}
    >
      {s.label}
    </span>
  );
}

function BuildSequenceBadge({
  seq,
  isBuilding,
  isNextBest,
  impactScore,
}: {
  seq: number | null;
  isBuilding: boolean;
  isNextBest: boolean;
  impactScore: number;
}) {
  if (seq === null || seq === 0) return null;
  const base =
    "inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold flex-shrink-0";
  if (isBuilding) {
    return (
      <div
        className={`${base} bg-red-600 text-white nex-heartbeat`}
        title={`ACTIVE BUILD · sequence ${seq} · impact ${impactScore}`}
      >
        {seq}
      </div>
    );
  }
  if (isNextBest) {
    return (
      <div
        className={`${base} bg-emerald-600 text-white nex-next-glow ring-2 ring-emerald-400`}
        title={`NEXT BEST for NEX growth · sequence ${seq} · impact ${impactScore}`}
      >
        {seq}
      </div>
    );
  }
  return (
    <div
      className={`${base} bg-neutral-200 text-neutral-800 border border-neutral-300`}
      title={`Build sequence ${seq} · impact ${impactScore}`}
    >
      {seq}
    </div>
  );
}

function CapabilityCard({
  cap,
  isNextBest,
  retroInboundCount,
}: {
  cap: Capability;
  isNextBest: boolean;
  retroInboundCount: number;
}) {
  const hasUi = cap.ui_url && cap.ui_url.length > 0;
  const cardBorder = cap.is_currently_building
    ? "border-2 border-red-500"
    : isNextBest
      ? "border-2 border-emerald-500"
      : "border border-neutral-300";

  return (
    <div className={`${cardBorder} rounded-lg p-4 bg-white shadow-sm relative`}>
      {/* Retro-benefit red flashing dot (top-right corner) */}
      {retroInboundCount > 0 && (
        <div
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center nex-retro-dot z-10 cursor-help"
          title={`${retroInboundCount} retro-benefit${retroInboundCount > 1 ? "s" : ""} available · click card to see details`}
        >
          {retroInboundCount}
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-2">
        <BuildSequenceBadge
          seq={cap.build_sequence_number}
          isBuilding={cap.is_currently_building}
          isNextBest={isNextBest}
          impactScore={cap.impact_score}
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-neutral-500 font-mono">{cap.id}</div>
          <div className="font-semibold text-neutral-900 leading-tight">
            {cap.name}
          </div>
          {cap.impact_score > 0 && (
            <div className="text-xs text-neutral-500 mt-1 inline-flex items-center gap-1">
              <Zap size={11} strokeWidth={2} />
              impact {cap.impact_score}/100
            </div>
          )}
        </div>
        <StatusPill status={cap.status} />
      </div>

      {isNextBest && (
        <div className="mb-2 text-xs font-bold text-emerald-700 inline-flex items-center gap-1">
          <ArrowRight size={12} strokeWidth={2.5} />
          NEXT BEST FOR NEX GROWTH
        </div>
      )}
      {cap.is_currently_building && (
        <div className="mb-2 text-xs font-bold text-red-700 inline-flex items-center gap-1">
          <ActivityIcon size={12} strokeWidth={2.5} />
          ACTIVE BUILD
        </div>
      )}

      {hasUi && (
        <div className="mb-2">
          <Link
            href={cap.ui_url!}
            className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-900 underline"
          >
            <ExternalLink size={14} strokeWidth={2} />
            {cap.ui_url}
          </Link>
        </div>
      )}

      <div className="text-xs text-neutral-700 space-y-1">
        {cap.build_sequence_note && (
          <div className="text-neutral-600 italic">{cap.build_sequence_note}</div>
        )}
        {cap.storage_home && cap.storage_home !== "pending" && (
          <div>
            <span className="text-neutral-500">Storage:</span>{" "}
            <span className="font-mono">{cap.storage_home}</span>
          </div>
        )}
        {cap.impact_boost_to.length > 0 && (
          <div>
            <span className="text-neutral-500">Boosts when built:</span>{" "}
            <span className="text-emerald-700 font-mono">
              {cap.impact_boost_to.join(" · ")}
            </span>
          </div>
        )}
        {cap.known_gaps.length > 0 && (
          <div className="text-amber-700">
            <span className="text-amber-600">Gaps:</span>{" "}
            {cap.known_gaps[0]}
            {cap.known_gaps.length > 1 && (
              <span className="text-amber-500"> (+{cap.known_gaps.length - 1})</span>
            )}
          </div>
        )}
        {cap.next_authorised_action &&
          !["none", "none · continuous", "none · locked"].includes(cap.next_authorised_action) && (
            <div>
              <span className="text-neutral-500">Next:</span>{" "}
              <span className="text-blue-800">{cap.next_authorised_action}</span>
            </div>
          )}
        {cap.retro_benefits_available.length > 0 && (
          <details className="mt-2 border-t border-red-200 pt-2">
            <summary className="text-xs font-semibold text-red-700 cursor-pointer">
              🔴 {cap.retro_benefits_available.length} retro-benefit
              {cap.retro_benefits_available.length > 1 ? "s" : ""} available (click)
            </summary>
            <div className="mt-2 space-y-2">
              {cap.retro_benefits_available.map((rb, i) => (
                <div key={i} className="bg-red-50 border border-red-200 rounded p-2 text-xs">
                  <div className="font-semibold text-red-900">
                    Build here:{" "}
                    <span className="font-normal">{rb.suggested_sub_capability}</span>
                  </div>
                  <div className="text-red-800 mt-1">
                    <span className="font-semibold">Uplift:</span> {rb.intelligence_uplift}
                  </div>
                  <div className="text-red-600 mt-1 text-[10px]">
                    Surfaced by: <span className="font-mono">{rb.surfaced_by}</span> · priority:{" "}
                    <span className="font-semibold uppercase">{rb.priority}</span>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function StatusDistributionBar({ capabilities }: { capabilities: Capability[] }) {
  const counts: Record<Status, number> = {
    DISCOVERED: 0,
    AUDITED: 0,
    IMPLEMENTED: 0,
    ACTIVE: 0,
    DEFERRED: 0,
    BLOCKED: 0,
  };
  for (const c of capabilities) counts[c.status] = (counts[c.status] ?? 0) + 1;
  const total = capabilities.length;
  const order: Status[] = ["ACTIVE", "IMPLEMENTED", "AUDITED", "DISCOVERED", "DEFERRED", "BLOCKED"];

  return (
    <div className="border border-neutral-300 rounded-lg p-4 bg-white">
      <div className="text-sm font-semibold text-neutral-900 mb-3">
        Progress · {total} capabilities
      </div>
      <div className="flex h-6 rounded overflow-hidden mb-3">
        {order.map((status) => {
          const c = counts[status];
          if (c === 0) return null;
          const pct = (c / total) * 100;
          const s = STATUS_STYLE[status];
          return (
            <div
              key={status}
              className={`${s.bg} ${s.text} flex items-center justify-center text-xs font-medium`}
              style={{ width: `${pct}%` }}
              title={`${status}: ${c} (${pct.toFixed(1)}%)`}
            >
              {c}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
        {order.map((status) => (
          <div key={status} className="flex items-center gap-1">
            <span className={`inline-block w-3 h-3 rounded ${STATUS_STYLE[status].bg}`} />
            <span className="text-neutral-700">
              {STATUS_STYLE[status].label.replace(/^\S+\s/, "")}:{" "}
              <span className="font-semibold">{counts[status]}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActiveBuildBanner({
  activeCap,
  nextCap,
}: {
  activeCap: Capability | null;
  nextCap: Capability | null;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {activeCap && (
        <div className="border-2 border-red-500 rounded-lg p-4 bg-red-50 relative">
          <div className="absolute -top-3 left-4 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded uppercase">
            🫀 Active Build · Heartbeat
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="w-12 h-12 rounded-full bg-red-600 text-white text-lg font-bold flex items-center justify-center nex-heartbeat">
              {activeCap.build_sequence_number}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-red-700 font-mono">{activeCap.id}</div>
              <div className="font-bold text-red-900">{activeCap.name}</div>
              <div className="text-xs text-red-800 mt-0.5">{activeCap.build_sequence_note}</div>
            </div>
          </div>
        </div>
      )}
      {nextCap && (
        <div className="border-2 border-emerald-500 rounded-lg p-4 bg-emerald-50 relative nex-next-glow">
          <div className="absolute -top-3 left-4 bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded uppercase">
            ▶ Next Best for NEX Growth
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="w-12 h-12 rounded-full bg-emerald-600 text-white text-lg font-bold flex items-center justify-center">
              {nextCap.build_sequence_number}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-emerald-700 font-mono">{nextCap.id}</div>
              <div className="font-bold text-emerald-900">{nextCap.name}</div>
              <div className="text-xs text-emerald-800 mt-0.5">{nextCap.build_sequence_note}</div>
              <div className="text-xs text-emerald-700 mt-1 inline-flex items-center gap-1">
                <Zap size={11} strokeWidth={2} />
                impact {nextCap.impact_score}/100 · boosts:{" "}
                {nextCap.impact_boost_to.join(" · ")}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConstitutionalRuleBanner({
  rule,
  v2,
}: {
  rule: string;
  v2?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="border-2 border-emerald-600 bg-emerald-50 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <CheckCircle2 size={20} className="text-emerald-700 mt-0.5 flex-shrink-0" strokeWidth={2} />
          <div>
            <div className="text-sm font-semibold text-emerald-900 mb-1">
              Constitutional rule for Master AI
            </div>
            <div className="text-sm text-emerald-800">{rule}</div>
          </div>
        </div>
      </div>
      {v2 && (
        <div className="border-2 border-indigo-600 bg-indigo-50 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={20} className="text-indigo-700 mt-0.5 flex-shrink-0" strokeWidth={2} />
            <div>
              <div className="text-sm font-semibold text-indigo-900 mb-1">
                Extended rule for NEX1 / NEX2 / NEX3 programmer agents
              </div>
              <div className="text-sm text-indigo-800">{v2}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DoNotRepeatSection({ investigations }: { investigations: Investigation[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold text-neutral-900 mb-3 flex items-center gap-2">
        <Ban size={20} className="text-red-600" strokeWidth={2} />
        Do-not-repeat register · completed investigations ({investigations.length})
      </h2>
      <p className="text-sm text-neutral-600 mb-4">
        Master AI must not re-audit any of these without a specifically identified unresolved question.
      </p>
      <div className="space-y-2">
        {investigations.map((inv) => (
          <div key={inv.id} className="border border-neutral-300 rounded p-3 bg-white text-sm">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="font-semibold text-neutral-900">
                <span className="font-mono text-xs text-neutral-500 mr-2">{inv.id}</span>
                {inv.name}
              </div>
              {inv.do_not_repeat && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-100 text-red-800 border border-red-300 flex-shrink-0">
                  <Ban size={12} strokeWidth={2} /> DO NOT REPEAT
                </span>
              )}
            </div>
            <div className="text-xs text-neutral-600 mb-1">
              <span className="font-mono">{inv.adr}</span> · {inv.date}
            </div>
            <div className="text-xs text-neutral-700">{inv.reason}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RoguePagesSection({
  rogue,
  duplicates,
}: {
  rogue: RoguePage[];
  duplicates: DuplicatePath[];
}) {
  const review = rogue.filter((r) => r.flag === "review");
  const keep = rogue.filter((r) => r.flag === "keep");

  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold text-neutral-900 mb-3 flex items-center gap-2">
        <AlertTriangle size={20} className="text-amber-600" strokeWidth={2} />
        Rogue / unclear pages ({rogue.length}) + duplicate paths ({duplicates.length})
      </h2>
      <p className="text-sm text-neutral-600 mb-4">
        Pages that exist under <code className="font-mono bg-neutral-100 px-1 rounded">src/app/*</code>{" "}
        but do not clearly map to a capability. Each needs a founder decision.
      </p>

      {review.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-semibold text-amber-800 mb-2">
            🚩 Review ({review.length}) · candidates for /dev/ namespace or removal
          </div>
          <div className="space-y-1">
            {review.map((r) => (
              <div
                key={r.path}
                className="border border-amber-200 rounded p-2 bg-amber-50 text-sm flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={r.url}
                    className="text-amber-900 hover:text-amber-950 underline font-mono text-sm inline-flex items-center gap-1"
                  >
                    <ExternalLink size={12} strokeWidth={2} />
                    {r.url}
                  </Link>
                  <div className="text-xs text-neutral-600">{r.reason}</div>
                </div>
                <span className="text-xs text-neutral-500 font-mono flex-shrink-0">{r.path}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {keep.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-semibold text-emerald-800 mb-2">
            ✅ Reviewed · keep ({keep.length})
          </div>
          <div className="space-y-1">
            {keep.map((r) => (
              <div
                key={r.path}
                className="border border-emerald-200 rounded p-2 bg-emerald-50 text-sm flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={r.url}
                    className="text-emerald-900 hover:text-emerald-950 underline font-mono text-sm inline-flex items-center gap-1"
                  >
                    <ExternalLink size={12} strokeWidth={2} />
                    {r.url}
                  </Link>
                  <div className="text-xs text-neutral-600">{r.reason}</div>
                </div>
                <span className="text-xs text-neutral-500 font-mono flex-shrink-0">{r.path}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {duplicates.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-orange-800 mb-2">
            🟠 Duplicate paths · consolidation candidates ({duplicates.length})
          </div>
          <div className="space-y-1">
            {duplicates.map((d, i) => (
              <div key={i} className="border border-orange-200 rounded p-2 bg-orange-50 text-sm">
                <div className="font-mono text-xs mb-1">{d.paths.join(" + ")}</div>
                <div className="text-xs text-neutral-700">{d.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ProgrammerFeedSection({ map }: { map: WorkMap }) {
  const activeCap = map.capabilities.find((c) => c.id === map.active_build);
  const nextCap = map.capabilities.find((c) => c.id === map.next_suggested_build);
  const highRetro = map.capabilities.filter((c) => c.retro_benefits_available.some((r) => r.priority === "high"));

  return (
    <section className="mt-8 border-2 border-indigo-400 rounded-lg p-4 bg-indigo-50">
      <h2 className="text-xl font-bold text-indigo-900 mb-2 flex items-center gap-2">
        🤖 NEX1 / NEX2 / NEX3 Programmer Agent Feed
      </h2>
      <p className="text-sm text-indigo-800 mb-3">
        This section is machine-readable and mandatory reading for programmer agents BEFORE
        any code change. Also available programmatically at{" "}
        <Link
          href="/api/nex/work-map"
          className="font-mono text-indigo-900 underline hover:text-indigo-950"
        >
          /api/nex/work-map
        </Link>
        .
      </p>
      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <div className="bg-white rounded p-3 border border-indigo-200">
          <div className="font-semibold text-indigo-900 mb-1">
            Currently building (any code touching this must respect its in-flight state):
          </div>
          <div className="font-mono text-indigo-800">
            {activeCap ? `${activeCap.id} · ${activeCap.name}` : "none"}
          </div>
        </div>
        <div className="bg-white rounded p-3 border border-indigo-200">
          <div className="font-semibold text-indigo-900 mb-1">
            Next best for NEX growth (code changes preparing this are welcome):
          </div>
          <div className="font-mono text-indigo-800">
            {nextCap ? `${nextCap.id} · ${nextCap.name}` : "none"}
          </div>
        </div>
      </div>
      <div className="mt-3 bg-white rounded p-3 border border-indigo-200 text-sm">
        <div className="font-semibold text-indigo-900 mb-1">
          High-priority retro-benefits ({highRetro.length}):
        </div>
        <ul className="list-disc pl-5 text-indigo-800 space-y-0.5">
          {highRetro.map((c) =>
            c.retro_benefits_available
              .filter((r) => r.priority === "high")
              .map((rb, i) => (
                <li key={`${c.id}-${i}`}>
                  Add on <span className="font-mono">{c.id}</span>:{" "}
                  <em>{rb.suggested_sub_capability}</em> · uplift: {rb.intelligence_uplift}
                </li>
              )),
          )}
        </ul>
      </div>
      <div className="mt-3 text-xs text-indigo-700">
        <strong>Rule:</strong> Before any code change, identify which CAP-XXX capabilities the
        change touches. Consult <code className="font-mono">impact_boost_to</code> to verify no
        sibling capability breaks. Preserve Stage 1a foundation invariants. Never weaken NEX.
      </div>
    </section>
  );
}

export default async function WorkMapPage() {
  const map = await loadMap();

  const grouped = new Map<string, Capability[]>();
  for (const c of map.capabilities) {
    if (!grouped.has(c.group)) grouped.set(c.group, []);
    grouped.get(c.group)!.push(c);
  }

  // Sort each group's cards by build_sequence_number (nulls last)
  for (const caps of grouped.values()) {
    caps.sort((a, b) => {
      const sa = a.build_sequence_number ?? 9999;
      const sb = b.build_sequence_number ?? 9999;
      return sa - sb;
    });
  }

  // Count retro-benefit inbound per capability (how many others surface a retro on this one)
  // The retro_benefits_available on each cap already IS the inbound count.
  const retroInboundCount = new Map<string, number>();
  for (const c of map.capabilities) {
    retroInboundCount.set(c.id, c.retro_benefits_available.length);
  }

  const activeCap = map.capabilities.find((c) => c.id === map.active_build) ?? null;
  const nextCap = map.capabilities.find((c) => c.id === map.next_suggested_build) ?? null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: HEARTBEAT_CSS }} />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-neutral-900">
            NEX Master Work &amp; Architecture Map
          </h1>
          <div className="text-sm text-neutral-600 mt-1">
            v{map.map_version} · updated {map.last_updated} · authored by {map.authored_by} ·
            authorised by {map.authorised_by}
          </div>
          <div className="text-sm text-neutral-700 mt-2 max-w-3xl">{map.purpose}</div>
        </header>

        <QuickNavStrip />

        <ConstitutionalRuleBanner
          rule={map.constitutional_rule}
          v2={map.constitutional_rule_v2}
        />

        <ActiveBuildBanner activeCap={activeCap} nextCap={nextCap} />

        <StatusDistributionBar capabilities={map.capabilities} />

        <div className="grid gap-6">
          {map.groups.map((group) => {
            const caps = grouped.get(group) ?? [];
            if (caps.length === 0) return null;
            return (
              <section key={group}>
                <h2 className="text-lg font-bold text-neutral-900 mb-3">
                  {group}{" "}
                  <span className="text-sm font-normal text-neutral-500">({caps.length})</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {caps.map((c) => (
                    <CapabilityCard
                      key={c.id}
                      cap={c}
                      isNextBest={c.id === map.next_suggested_build}
                      retroInboundCount={retroInboundCount.get(c.id) ?? 0}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <ProgrammerFeedSection map={map} />

        <DoNotRepeatSection investigations={map.completed_investigations} />

        <RoguePagesSection rogue={map.rogue_pages} duplicates={map.duplicate_ui_paths} />

        <footer className="text-xs text-neutral-500 mt-8 pt-4 border-t border-neutral-200">
          Canonical source of truth: <code className="font-mono">docs/nex-work-map.json</code> ·
          Human-readable: <code className="font-mono">docs/NEX-MASTER-WORK-MAP.md</code> ·
          Machine API: <code className="font-mono">/api/nex/work-map</code> · Rationale:{" "}
          {map.build_sequence_rationale}
        </footer>
      </div>
    </>
  );
}
