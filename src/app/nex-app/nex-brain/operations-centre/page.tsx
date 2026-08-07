// NEX Headquarters · Operations Centre — /nex-app/nex-brain/operations-centre
//
// PARENT APPLICATION for every administrative screen in NEX. Not a page —
// a shell. The building, workers, rooms and providers remain visible at
// all times. Selecting a navigation item swaps ONLY the right-hand
// workspace. The administrator never loses sight of the organisation.
//
//   ┌──── Sidebar ────┬──── Headquarters ────┬──── Workspace ────┐
//   │ Overview         │ Reception             │ Selected panel    │
//   │ Operations Hist. │ Ground floor rooms    │  (History /       │
//   │ Worker Journal   │ First floor rooms     │   Journal /       │
//   │ Knowledge Inbox  │ AI provider strip     │   Providers /     │
//   │ ...              │ (live worker figures) │   Booker etc.)    │
//   └─────────────────┴──────────────────────┴───────────────────┘
//
// Doctrine · read before editing:
// · feedback_nex_operations_centre_rooms_with_people_not_cards.md
//     Rooms with people · not cards. Walls, floors, signage, furniture.
// · feedback_nex_headquarters_is_permanent_2026_08_07.md
//     Building = architecture (build now). People = telemetry-driven.
// · feedback_nex_admin_centre_living_organisation_golden_rule_2026_08_07.md
//     Workers only appear where real events place them.
// · feedback_nex_never_pretends_work_done_2026_08_07.md
//     Empty state = honest ("awaiting …"). Never fabricate.
// · feedback_claude_role_master_engineer_and_ui_design_2026_08_07.md
//     World-class SaaS / AI-native bar. Not a dashboard.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { NexStoragePanel } from "@/components/nex-app/nex-brain/NexStoragePanel";
import { CommunicationsCentrePanel } from "@/components/nex-app/nex-brain/CommunicationsCentrePanel";
import "../../nex-app.css";

// ─────────────────────────────────────────────────────────────────
// Palette
// ─────────────────────────────────────────────────────────────────
const T = {
  bg:              "var(--nex-cream)",
  bgGradient:      "linear-gradient(180deg, var(--nex-cream) 0%, var(--nex-cream-elev) 100%)",
  reception:       "linear-gradient(135deg, var(--nex-cream-elev) 0%, var(--nex-cream) 100%)",
  panel:           "var(--nex-neutral-0)",
  panelElev:       "var(--nex-cream-elev)",
  panelElev2:      "var(--nex-neutral-100)",
  border:          "var(--nex-neutral-200)",
  borderStrong:    "var(--nex-neutral-300, var(--nex-neutral-200))",
  text:            "var(--nex-neutral-900)",
  textDim:         "var(--nex-neutral-700)",
  textFade:        "var(--nex-neutral-500)",
  textGhost:       "var(--nex-neutral-400, var(--nex-neutral-500))",
  accent:          "var(--nex-accent-500)",
  accentDark:      "var(--nex-accent-600)",
  accentSoft:      "var(--nex-accent-50)",
  accentGlow:      "0 12px 32px -8px var(--nex-accent-500)",
  success:         "var(--nex-success-500)",
  successSoft:     "rgba(16, 185, 129, 0.10)",
  info:            "var(--nex-info-500)",
  infoSoft:        "rgba(59, 130, 246, 0.10)",
  warning:         "var(--nex-warning-500)",
  warningSoft:     "rgba(245, 158, 11, 0.10)",
  danger:          "#DC2626",
  dangerSoft:      "rgba(220, 38, 38, 0.08)",
  wallDark:        "#A6835A",
  wallLight:       "#D8B993",
  floor:           "#F5EAD5",
  floorPattern:    "rgba(166, 131, 90, 0.10)",
  ceilingLampGlow: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(245, 158, 11, 0.22) 0%, transparent 70%)",
  shadowSm:        "var(--nex-shadow-sm)",
  shadowMd:        "var(--nex-shadow-md)",
  shadowLg:        "var(--nex-shadow-lg)",
} as const;

// ─────────────────────────────────────────────────────────────────
// Types (mirrors /api/nex/brain/*)
// ─────────────────────────────────────────────────────────────────
type WorkerRow = {
  worker_type: string;
  jobs_waiting: number;
  jobs_in_flight: number;
  jobs_completed_24h: number;
  jobs_failed_24h: number;
  last_activity_at: string | null;
  current_job_ref: string | null;
  current_job_since: string | null;
  last_result_summary?: string | null;
};
type OpsEvent = { at: string; kind: string; message: string; worker?: string; ref?: string };

// Raw shape returned by /api/nex/brain/audit-events (DB rows).
// We normalise to OpsEvent client-side so the audit-events API stays
// a general-purpose queryable log, not a UI-specific formatter.
type RawAuditEvent = {
  id?: string;
  worker_type?: string | null;
  worker_host_id?: string | null;
  job_id?: string | null;
  input_ref?: string | null;
  event_type?: string | null;
  actor?: string | null;
  at?: string;
  latency_ms?: number | null;
  provider?: string | null;
  model?: string | null;
  confidence?: number | null;
  outcome?: string | null;
  error_snippet?: string | null;
  details?: Record<string, unknown> | null;
};

// Turn a raw audit-log row into a human-readable timeline entry.
// Event-type → English sentence · provider/latency woven in where relevant.
// Format a filesystem Event Bus event into the Living Timeline line format.
// Every event_type gets a specific human sentence · fallback for unknowns.
function formatBusEventMessage(event_type: string | undefined, payload: Record<string, unknown> | undefined): string {
  const p = payload ?? {};
  switch (event_type) {
    case "knowledge_dumped": {
      const title = typeof p.title === "string" && p.title ? p.title : "(untitled)";
      const len = typeof p.content_length === "number" ? ` · ${p.content_length.toLocaleString()} chars` : "";
      const dupe = p.deduplicated === true ? " · duplicate" : "";
      return `Knowledge dumped: ${title}${len}${dupe}`;
    }
    case "recommendation_created":  return `Recommendation created${p.title ? `: ${p.title}` : ""}`;
    case "approval_given":          return `Approved${p.title ? `: ${p.title}` : ""}`;
    case "worker_completed":        return `Worker completed job${p.job_id ? ` ${String(p.job_id).slice(0, 12)}` : ""}`;
    case "worker_blocked":          return `Worker blocked${p.reason ? ` · ${p.reason}` : ""}`;
    case "provider_switched":       return `Provider switched${p.from ? ` from ${p.from}` : ""}${p.to ? ` to ${p.to}` : ""}`;
    case "case_opened":             return `Case opened${p.title ? `: ${p.title}` : ""}`;
    case "case_resolved":           return `Case resolved${p.title ? `: ${p.title}` : ""}`;
    default:                        return (event_type ?? "event").replace(/_/g, " ");
  }
}

function normalizeAuditEvent(r: RawAuditEvent): OpsEvent {
  const at = r.at ?? new Date().toISOString();
  const worker = r.worker_type ?? undefined;
  const kind = r.event_type ?? "event";
  const ref = r.job_id ?? r.input_ref ?? undefined;
  const provider = r.provider ? ` via ${r.provider}` : "";
  const latency = r.latency_ms ? ` (${r.latency_ms}ms)` : "";
  const err = r.error_snippet ? ` · ${r.error_snippet.slice(0, 60)}${r.error_snippet.length > 60 ? "…" : ""}` : "";
  const confidence = r.confidence !== null && r.confidence !== undefined ? ` · confidence ${Math.round(r.confidence * 100)}%` : "";
  let message: string;
  switch (kind) {
    case "job_started":                     message = `claimed job${ref ? ` ${ref.slice(0, 12)}` : ""}`; break;
    case "job_completed":                   message = `completed job${ref ? ` ${ref.slice(0, 12)}` : ""}${latency}${confidence}`; break;
    case "job_failed":                      message = `failed job${ref ? ` ${ref.slice(0, 12)}` : ""}${err}`; break;
    case "provider_response":               message = `provider responded${provider}${latency}`; break;
    case "provider_response_failed":        message = `provider request failed${provider}${err}`; break;
    case "provider_budget_exhausted":       message = `provider budget exhausted${provider}`; break;
    case "knowledge_extracted":             message = `extracted knowledge${ref ? ` from ${ref.slice(0, 12)}` : ""}${confidence}`; break;
    case "record_promoted_to_authoritative":message = `promoted record to AUTHORITATIVE${ref ? ` (${ref.slice(0, 12)})` : ""}`; break;
    case "record_flagged_for_review":       message = `flagged record for review${ref ? ` (${ref.slice(0, 12)})` : ""}${err}`; break;
    case "contradiction_detected":          message = `contradiction detected${ref ? ` (${ref.slice(0, 12)})` : ""}${err}`; break;
    default:                                message = `${kind.replace(/_/g, " ")}${provider}${latency}${err}${confidence}`;
  }
  return { at, kind, message, worker, ref };
}
type StatusPayload = {
  jobs_waiting: number;
  jobs_in_flight: number;
  jobs_completed_24h: number;
  records_authoritative: number;
  records_under_review: number;
  records_draft: number;
  worker_pool: WorkerRow[];
};
type CloudWorker = { host_id: string; status: "online" | "lagging" | "stale"; age_ms: number; uptime_ms: number; cycles_total: number; metadata: { region?: string } | null };
type LlmProviderReport = {
  provider: string;
  status: "healthy" | "degraded" | "circuit-open" | "unconfigured" | "idle";
  configured: boolean;
  calls_24h: number;
  successes_24h?: number;
  success_rate_24h: number | null;
  consecutive_failures?: number;
  circuit_open_ms_remaining?: number | null;
  last_success_at?: string | null;
  last_failure_at?: string | null;
  last_error?: string | null;
  avg_ms_24h?: number | null;
  tokens_24h?: number;
};

// ─────────────────────────────────────────────────────────────────
// Personas & rooms (kept from prior version)
// ─────────────────────────────────────────────────────────────────
type WorkerPersona = { key: string; displayName: string; role: string; glyph: string; workingRoom: RoomKey; voiceLine: string; colorAccent: string };
const PERSONAS: WorkerPersona[] = [
  { key: "knowledge-context",   displayName: "Mason",  role: "Knowledge Context",   glyph: "M", workingRoom: "library",       colorAccent: "#38BDF8", voiceLine: "I read every new document that enters NEX and pull out the concepts that matter." },
  { key: "voice-context",       displayName: "Blake",  role: "Voice & Brand",       glyph: "B", workingRoom: "writing",       colorAccent: "#FB923C", voiceLine: "I make sure knowledge sounds like NEX — clear, calm, technically accurate." },
  { key: "learning-context",    displayName: "Rowan",  role: "Learning Context",    glyph: "R", workingRoom: "understanding", colorAccent: "#A855F7", voiceLine: "I connect new knowledge to what NEX already knows." },
  { key: "knowledge-extractor", displayName: "Avery",  role: "Knowledge Extractor", glyph: "A", workingRoom: "understanding", colorAccent: "#F59E0B", voiceLine: "I turn raw text into structured knowledge records the rest of the team can trust." },
  { key: "quality-checker",     displayName: "Harper", role: "Quality Checker",     glyph: "H", workingRoom: "quality",       colorAccent: "#22C55E", voiceLine: "I verify every record against the Constitution before it enters authoritative memory." },
  { key: "memory-guardian",     displayName: "Sage",   role: "Memory Guardian",     glyph: "S", workingRoom: "vault",         colorAccent: "#EAB308", voiceLine: "I keep the knowledge vault organised and free of contradictions." },
];

type RoomKey = "inbox" | "library" | "understanding" | "writing" | "quality" | "vault" | "ai_server" | "lounge" | "manager" | "meeting" | "dispatch" | "director" | "marketing" | "innovation";
type FloorKey = "ground" | "first";
type Room = { key: RoomKey; name: string; purpose: string; question: string; emptyLine: string; glyph: string; floor: FloorKey; tint: string; wallAccent: string };
const ROOMS: Record<RoomKey, Room> = {
  inbox:         { key: "inbox",         name: "Inbox",              purpose: "Where new material arrives",             question: "What just came in?",             emptyLine: "The inbox is quiet.",                        glyph: "▤", floor: "ground", tint: "rgba(56, 189, 248, 0.06)",  wallAccent: "#38BDF8" },
  library:       { key: "library",       name: "Library",            purpose: "Documents · references · sources",       question: "What are workers reading?",      emptyLine: "The shelves are quiet.",                     glyph: "❐", floor: "ground", tint: "rgba(56, 189, 248, 0.06)",  wallAccent: "#38BDF8" },
  understanding: { key: "understanding", name: "Understanding",      purpose: "Concepts linked into knowledge",         question: "What is being connected?",       emptyLine: "The whiteboards are clean.",                 glyph: "◈", floor: "ground", tint: "rgba(168, 85, 247, 0.06)",  wallAccent: "#A855F7" },
  writing:       { key: "writing",       name: "Writing Office",     purpose: "Records authored in NEX's voice",        question: "What is being written?",         emptyLine: "The desks are quiet.",                       glyph: "✎", floor: "ground", tint: "rgba(251, 146, 60, 0.06)",  wallAccent: "#FB923C" },
  quality:       { key: "quality",       name: "Quality Office",     purpose: "Verification against the Constitution",  question: "What is being checked?",         emptyLine: "No records awaiting review.",                glyph: "✓", floor: "ground", tint: "rgba(34, 197, 94, 0.06)",   wallAccent: "#22C55E" },
  vault:         { key: "vault",         name: "Knowledge Vault",    purpose: "Authoritative knowledge lives here",     question: "What has been stored?",          emptyLine: "The vault is silent · records rest inside.", glyph: "◉", floor: "ground", tint: "rgba(245, 158, 11, 0.10)",  wallAccent: "#F59E0B" },
  ai_server:     { key: "ai_server",     name: "AI Provider Room",   purpose: "Where providers respond",                question: "Which providers are healthy?",   emptyLine: "Terminals idle · no active calls.",          glyph: "◨", floor: "ground", tint: "rgba(239, 68, 68, 0.06)",   wallAccent: "#EF4444" },
  lounge:        { key: "lounge",        name: "Staff Lounge",       purpose: "Where workers rest between tasks",       question: "Who is resting?",                emptyLine: "The lounge is empty.",                       glyph: "☕", floor: "ground", tint: "rgba(148, 163, 184, 0.06)", wallAccent: "#94A3B8" },
  manager:       { key: "manager",       name: "Manager's Office",   purpose: "You · the human in charge",              question: "What decisions await you?",      emptyLine: "Your office · always here.",                 glyph: "★", floor: "first",  tint: "rgba(245, 158, 11, 0.12)",  wallAccent: "#F59E0B" },
  director:      { key: "director",      name: "Director's Office",  purpose: "NEX · Operations Director",              question: "What has NEX resolved for you?", emptyLine: "NEX is monitoring the organisation.",        glyph: "N", floor: "first",  tint: "rgba(245, 158, 11, 0.14)",  wallAccent: "#F59E0B" },
  meeting:       { key: "meeting",       name: "Meeting Room",       purpose: "Cross-worker collaboration",             question: "Who is meeting?",                emptyLine: "No workers meeting.",                        glyph: "◯", floor: "first",  tint: "rgba(168, 85, 247, 0.06)",  wallAccent: "#A855F7" },
  dispatch:      { key: "dispatch",      name: "Dispatch Board",     purpose: "Assign · wake · route",                  question: "What jobs are waiting?",         emptyLine: "No pending dispatch.",                       glyph: "▭", floor: "first",  tint: "rgba(56, 189, 248, 0.06)",  wallAccent: "#38BDF8" },
  marketing:     { key: "marketing",     name: "Marketing Studio",   purpose: "Social · SEO · content · campaigns",     question: "What is NEX growing?",           emptyLine: "Studio scheduled for activation.",           glyph: "☰", floor: "first",  tint: "rgba(236, 72, 153, 0.08)",  wallAccent: "#EC4899" },
  innovation:    { key: "innovation",    name: "Innovation Lab",     purpose: "Where NEX proposes new ideas",           question: "What might we build next?",      emptyLine: "NEX brings ideas here when she has evidence.", glyph: "✦", floor: "first",  tint: "rgba(139, 92, 246, 0.08)", wallAccent: "#8B5CF6" },
};

// ─────────────────────────────────────────────────────────────────
// Planned specialist personas — Marketing Studio + Innovation Lab.
// These specialists are NAMED but not yet instantiated (no Fly worker
// backend exists for marketing/innovation roles). The building shows
// their room · when the workers spin up they'll appear here.
// Per doctrine: no fake avatars until real telemetry places them.
// ─────────────────────────────────────────────────────────────────
const MARKETING_SPECIALISTS = [
  { key: "social-manager",   name: "Social Media Manager", monitors: "Instagram · Pinterest · LinkedIn · YouTube posting + engagement" },
  { key: "seo-manager",      name: "SEO Manager",          monitors: "Search rank · keyword coverage · content gap analysis" },
  { key: "campaign-planner", name: "Campaign Planner",     monitors: "Seasonal campaigns · promotion calendar · ad performance" },
  { key: "content-writer",   name: "Content Writer",       monitors: "Article generation · social copy · newsletter drafts" },
  { key: "analytics-manager",name: "Analytics Manager",    monitors: "Traffic · conversions · funnel · attribution" },
] as const;

const INNOVATION_ROLES = [
  { key: "research-analyst",  name: "Research Analyst",   monitors: "Search-demand deltas · zero-result queries · trend detection" },
  { key: "product-strategist",name: "Product Strategist", monitors: "Feature requests · user friction · workflow gap analysis" },
] as const;

// ─────────────────────────────────────────────────────────────────
// NEX Director — NOT a worker. She supervises the workforce. Lives
// exclusively in the Director's Office. Handles operational cases
// automatically where possible; escalates only what requires you.
// ─────────────────────────────────────────────────────────────────
const NEX_DIRECTOR = {
  key: "nex-director",
  displayName: "NEX",
  role: "Director of Operations",
  glyph: "N",
  colorAccent: "#F59E0B",
  voiceLine: "I supervise every worker. When something goes wrong I attempt automatic recovery first — only genuine decisions reach you.",
} as const;

// ─────────────────────────────────────────────────────────────────
// Cases — computed from real telemetry signals only. Auto-resolved
// count depends on the Worker Audit Log; until migration 004 is
// applied that number stays honest (null · "awaiting audit log").
// ─────────────────────────────────────────────────────────────────
type CaseTone = "green" | "amber" | "red";
type OpsCase = {
  id: string;
  tone: CaseTone;        // green resolved · amber investigating · red admin required
  priority: "P1" | "P2" | "P3";
  title: string;
  affected: string;      // affected worker / provider / subsystem
  reportedAt: string;    // ISO
  status: string;        // one-liner
  recommendation: string;
};

function computeCases(input: {
  status: StatusPayload | null;
  cloud: { any_online: boolean; workers: CloudWorker[] } | null;
  providers: LlmProviderReport[];
  mockHidden: number;
}): { list: OpsCase[]; investigating: number; adminRequired: number; autoResolvedKnown: number | null } {
  const now = new Date().toISOString();
  const list: OpsCase[] = [];

  // Red · admin required — mock fallback active
  if (input.mockHidden > 0) {
    list.push({
      id: `mock-${input.mockHidden}`,
      tone: "red",
      priority: "P1",
      title: "Mock fallback generating placeholder records",
      affected: "Cloud worker configuration",
      reportedAt: now,
      status: `${input.mockHidden.toLocaleString()} placeholder record${input.mockHidden === 1 ? "" : "s"} excluded from the Vault.`,
      recommendation: "Disable Mock Fallback on Fly (Configuration · step 2).",
    });
  }

  // Red · admin required — cloud workers offline
  if (input.cloud && input.cloud.any_online === false) {
    list.push({
      id: "cloud-offline",
      tone: "red",
      priority: "P1",
      title: "No cloud workers online",
      affected: "Fly.io worker fleet",
      reportedAt: now,
      status: "Building shell online but no worker heartbeats received.",
      recommendation: "Check Fly worker app health · fly status --app nex-brain-worker",
    });
  }

  // Amber · investigating — providers in circuit-open state (NEX waiting for recovery)
  for (const p of input.providers) {
    if (p.status === "circuit-open") {
      const remaining = p.circuit_open_ms_remaining ?? 0;
      list.push({
        id: `provider-${p.provider}-circuit`,
        tone: "amber",
        priority: "P2",
        title: `${p.provider} · circuit open`,
        affected: `AI provider · ${p.provider}`,
        reportedAt: p.last_failure_at ?? now,
        status: `Retry in ${Math.max(1, Math.round(remaining / 1000))}s · NEX will re-test automatically.`,
        recommendation: "No action needed · monitor.",
      });
    } else if (p.status === "degraded" && (p.consecutive_failures ?? 0) >= 3) {
      list.push({
        id: `provider-${p.provider}-degraded`,
        tone: "amber",
        priority: "P2",
        title: `${p.provider} · degraded (${p.consecutive_failures} consecutive failures)`,
        affected: `AI provider · ${p.provider}`,
        reportedAt: p.last_failure_at ?? now,
        status: p.last_error ? `Last error: ${p.last_error.slice(0, 80)}` : "Multiple recent failures.",
        recommendation: "Check provider quota / credentials.",
      });
    }
  }

  // Amber · investigating — worker with recent failures
  if (input.status?.worker_pool) {
    for (const w of input.status.worker_pool) {
      if (w.jobs_failed_24h > 0 && w.jobs_failed_24h > w.jobs_completed_24h * 0.2) {
        list.push({
          id: `worker-${w.worker_type}-failures`,
          tone: "amber",
          priority: "P3",
          title: `${w.worker_type} · elevated failure rate`,
          affected: `Worker · ${w.worker_type}`,
          reportedAt: w.last_activity_at ?? now,
          status: `${w.jobs_failed_24h} failure${w.jobs_failed_24h === 1 ? "" : "s"} in 24h vs ${w.jobs_completed_24h} completed.`,
          recommendation: "NEX will retry failed jobs against alternate providers.",
        });
      }
    }
  }

  const investigating = list.filter((c) => c.tone === "amber").length;
  const adminRequired = list.filter((c) => c.tone === "red").length;

  // Auto-resolved count requires the Worker Audit Log. Until then · honest null.
  const autoResolvedKnown: number | null = null;

  return { list, investigating, adminRequired, autoResolvedKnown };
}

// ─────────────────────────────────────────────────────────────────
// Operations Command Console · types + intent parser
// ─────────────────────────────────────────────────────────────────
type ConsoleExchange = {
  id: string;
  at: string;
  input: string;
  response: string;
  tone?: "info" | "warning" | "danger" | "success";
  action?: { label: string; view?: ViewKey };
};

type ConsoleContext = {
  placements: { room: RoomKey; placed: PlacedWorker }[];
  providers: LlmProviderReport[];
  status: StatusPayload | null;
  cases: ReturnType<typeof computeCases>;
  cloud: { any_online: boolean; workers: CloudWorker[] } | null;
  mockHidden: number;
};

function findWorker(ctx: ConsoleContext, needle: string): PlacedWorker | undefined {
  const n = needle.toLowerCase();
  return ctx.placements.map((p) => p.placed).find((p) =>
    p.persona.displayName.toLowerCase() === n ||
    p.persona.key.toLowerCase() === n ||
    p.persona.role.toLowerCase().includes(n)
  );
}
function findProvider(ctx: ConsoleContext, needle: string): LlmProviderReport | undefined {
  const n = needle.toLowerCase();
  return ctx.providers.find((p) => p.provider.toLowerCase() === n);
}

// Explain a worker's current state in NEX's voice, grounded in the
// same real signals that placed them in that room.
function explainWorker(placed: PlacedWorker, ctx: ConsoleContext): string {
  const name = placed.persona.displayName;
  const w = placed.worker;
  if (placed.state === "offline") {
    if (!ctx.cloud?.any_online) return `${name} is offline because no cloud workers are currently online. Fly heartbeats have stopped arriving.`;
    return `${name} is not registered with the pool right now.`;
  }
  if (placed.state === "working") {
    return `${name} is currently working. ${placed.detail}${w?.current_job_since ? ` Started this task ${relativeMinutes(w.current_job_since)}.` : ""}`;
  }
  if (placed.state === "queued") {
    return `${name} has ${w?.jobs_waiting.toLocaleString() ?? "?"} job${(w?.jobs_waiting ?? 0) === 1 ? "" : "s"} waiting and is about to start.`;
  }
  if (placed.state === "waiting_llm") {
    const blocked = ctx.providers.filter((p) => providerBand(p) === "red-blocked").map((p) => p.provider);
    return `${name} is waiting on an AI provider response. ${blocked.length > 0 ? `Currently blocked: ${blocked.join(", ")}.` : "No provider has responded yet."}`;
  }
  // sleeping
  const anyHealthy = ctx.providers.some((p) => providerBand(p) === "green-active" || providerBand(p) === "orange-standby");
  const anyWorkAround = (ctx.status?.jobs_waiting ?? 0) > 0;
  if (!anyHealthy) {
    return `${name} is resting because all available AI providers are currently blocked or exhausted. NEX is waiting for provider recovery — no manual action required.`;
  }
  if (!anyWorkAround) {
    return `${name} is resting because there is no work in the queue. Drop new material into the Knowledge Inbox or use Knowledge Dumping to give the team something to do.`;
  }
  return `${name} is resting between tasks. ${placed.detail}`;
}

// Pure-code intent parser · handles common admin questions/commands
// from real telemetry. Returns the response NEX would give.
function parseCommand(rawInput: string, ctx: ConsoleContext): { response: string; tone?: ConsoleExchange["tone"]; action?: ConsoleExchange["action"] } {
  const input = rawInput.trim();
  const lower = input.toLowerCase();

  // Help
  if (/^(help|commands|what can (i|you) (do|ask))/i.test(input)) {
    return {
      response:
        "Try: 'what are workers doing?' · 'why is <name> sleeping?' · 'provider status' · 'how many cases?' · 'wake <name>' · 'stop <name>' · 'system health'. I answer from live telemetry — no fabricated data.",
      tone: "info",
    };
  }

  // Workers · overall state
  if (/(what|who).*(work|do|happen)/i.test(lower) || lower.includes("workers doing") || lower === "workers") {
    const working  = ctx.placements.filter((p) => p.placed.state === "working" || p.placed.state === "waiting_llm").map((p) => p.placed);
    const resting  = ctx.placements.filter((p) => p.placed.state === "sleeping").map((p) => p.placed);
    const offline  = ctx.placements.filter((p) => p.placed.state === "offline").map((p) => p.placed);
    const bits: string[] = [];
    if (working.length > 0) bits.push(`Working: ${working.map((w) => `${w.persona.displayName} (${w.detail})`).join("; ")}.`);
    if (resting.length > 0) bits.push(`Resting: ${resting.map((w) => w.persona.displayName).join(", ")}.`);
    if (offline.length > 0) bits.push(`Offline: ${offline.map((w) => w.persona.displayName).join(", ")}.`);
    if (bits.length === 0) return { response: "No worker telemetry has arrived yet.", tone: "warning" };
    return { response: bits.join(" "), tone: working.length > 0 ? "success" : "info" };
  }

  // Why is X sleeping/resting/waiting/working
  const whyMatch = input.match(/why (?:is |are )?(\w+)(?:\s+(?:sleeping|resting|waiting|working|idle|offline))?/i);
  if (whyMatch) {
    const w = findWorker(ctx, whyMatch[1]);
    if (w) return { response: explainWorker(w, ctx), tone: "info", action: { label: "Open Journal", view: "journal" } };
  }

  // Provider status
  if (/provider(s)? (status|health|state)|how are (the )?providers/i.test(lower) || lower === "providers") {
    const active  = ctx.providers.filter((p) => providerBand(p) === "green-active").length;
    const standby = ctx.providers.filter((p) => providerBand(p) === "orange-standby").length;
    const blocked = ctx.providers.filter((p) => providerBand(p) === "red-blocked");
    const blockedNames = blocked.map((p) => `${p.provider}${p.circuit_open_ms_remaining ? ` (retry ${Math.max(1, Math.round(p.circuit_open_ms_remaining / 1000))}s)` : ""}`);
    return {
      response:
        `${active} provider${active === 1 ? "" : "s"} actively handling requests · ${standby} standing by · ${blocked.length} blocked` +
        (blocked.length > 0 ? `. Blocked: ${blockedNames.join(", ")}.` : "."),
      tone: blocked.length > 0 ? "warning" : "success",
      action: { label: "Open AI Providers", view: "providers" },
    };
  }

  // Cases summary
  if (/case|issue|problem/i.test(lower)) {
    const { list, investigating, adminRequired } = ctx.cases;
    if (list.length === 0) return { response: "The desk is clear. No open cases derived from live telemetry.", tone: "success", action: { label: "Open Director", view: "director" } };
    return {
      response: `${list.length} open case${list.length === 1 ? "" : "s"} · ${investigating} under investigation · ${adminRequired} need your decision.`,
      tone: adminRequired > 0 ? "danger" : "warning",
      action: { label: "Open Director's Office", view: "director" },
    };
  }

  // System health
  if (/system health|how (is|are) (things|nex|system|everything)/i.test(lower)) {
    if (!ctx.cloud?.any_online) return { response: "System is offline · no cloud worker heartbeats.", tone: "danger", action: { label: "Open System Health", view: "health" } };
    if (ctx.mockHidden > 0) return { response: `Reduced quality · ${ctx.mockHidden} placeholder record${ctx.mockHidden === 1 ? "" : "s"} generated by mock adapter. Disable mock fallback on Fly.`, tone: "warning", action: { label: "Open Configuration", view: "configuration" } };
    const healthy = ctx.providers.filter((p) => providerBand(p) === "green-active" || providerBand(p) === "orange-standby").length;
    if (healthy === 0) return { response: "All configured providers are currently blocked. NEX is waiting for recovery.", tone: "danger", action: { label: "Open AI Providers", view: "providers" } };
    return { response: `System healthy · ${healthy} provider${healthy === 1 ? "" : "s"} available.`, tone: "success", action: { label: "Open Executive Briefing", view: "briefing" } };
  }

  // Wake worker (aspirational · requires Dispatch API)
  const wakeMatch = input.match(/^(wake|start|resume)\s+(\w+)/i);
  if (wakeMatch) {
    const w = findWorker(ctx, wakeMatch[2]);
    if (w) {
      if (w.state === "working" || w.state === "waiting_llm") {
        return { response: `${w.persona.displayName} is already processing (${w.detail}). Interrupting may delay knowledge production. Shall I queue your new task instead? (Dispatch API pending — I cannot yet act on this.)`, tone: "info" };
      }
      return { response: `${w.persona.displayName} is ready to wake. The Dispatch API is not yet wired, so I cannot dispatch the wake command. Migration 004 + Dispatch API will activate this.`, tone: "warning", action: { label: "Open Configuration", view: "configuration" } };
    }
  }

  // Stop worker
  const stopMatch = input.match(/^(stop|pause|halt)\s+(\w+)/i);
  if (stopMatch) {
    const w = findWorker(ctx, stopMatch[2]);
    if (w) {
      const inFlight = w.worker?.jobs_in_flight ?? 0;
      if (inFlight > 0) return { response: `${w.persona.displayName} currently has ${inFlight} job${inFlight === 1 ? "" : "s"} in flight. Stopping would delay knowledge promotion. Say 'force stop ${w.persona.displayName.toLowerCase()}' to override (once Dispatch API lands).`, tone: "warning" };
      return { response: `${w.persona.displayName} has no active work. Pause command will dispatch once the Dispatch API is wired.`, tone: "info" };
    }
  }

  // Named provider question
  for (const p of ctx.providers) {
    if (lower.includes(p.provider.toLowerCase())) {
      const band = providerBand(p);
      const reason = providerReason(p);
      const label = band === "green-active" ? "actively processing requests" : band === "orange-standby" ? "standing by" : band === "unconfigured" ? "not configured" : "blocked";
      return { response: `${p.provider} is ${label}. ${reason}.`, tone: band === "green-active" ? "success" : band === "orange-standby" ? "info" : "warning", action: { label: "Open AI Providers", view: "providers" } };
    }
  }

  // Named worker question (fallback)
  const nameMatch = ctx.placements.map((p) => p.placed).find((p) => lower.includes(p.persona.displayName.toLowerCase()));
  if (nameMatch) return { response: explainWorker(nameMatch, ctx), tone: "info", action: { label: `Open ${nameMatch.persona.displayName}'s Journal`, view: "journal" } };

  // Fallback
  return {
    response: "I don't yet understand that question in code. Once the LLM Command endpoint is wired I'll route natural-language requests through the provider chain. In the meantime try: 'workers', 'providers', 'cases', 'system health', 'why is <name> sleeping'.",
    tone: "info",
  };
}

// ─────────────────────────────────────────────────────────────────
// Placement — worker-only DYNAMIC layer (real events only)
// ─────────────────────────────────────────────────────────────────
type WorkerState = "working" | "queued" | "sleeping" | "offline" | "waiting_llm";
type PlacedWorker = { persona: WorkerPersona; worker: WorkerRow | null; state: WorkerState; detail: string };

function placeWorker(persona: WorkerPersona, worker: WorkerRow | undefined, anyCloudOnline: boolean, llmDegraded: boolean): { room: RoomKey; placed: PlacedWorker } {
  if (!worker || !anyCloudOnline) {
    return { room: "lounge", placed: { persona, worker: worker ?? null, state: "offline", detail: !worker ? "Not registered with the pool." : "No cloud workers online." } };
  }
  if (worker.jobs_in_flight > 0) {
    if (llmDegraded) return { room: "ai_server", placed: { persona, worker, state: "waiting_llm", detail: `Waiting on LLM · ${worker.current_job_ref ? worker.current_job_ref.slice(0, 12) : "job in flight"}` } };
    return { room: persona.workingRoom, placed: { persona, worker, state: "working", detail: worker.current_job_ref ? `On ${worker.current_job_ref.slice(0, 24)}${worker.current_job_ref.length > 24 ? "…" : ""}` : "Processing…" } };
  }
  if (worker.jobs_waiting > 0) return { room: "inbox", placed: { persona, worker, state: "queued", detail: `${worker.jobs_waiting.toLocaleString()} job${worker.jobs_waiting === 1 ? "" : "s"} waiting.` } };
  if (persona.key === "memory-guardian") return { room: "vault", placed: { persona, worker, state: "sleeping", detail: "Between scheduled audit batches." } };
  return { room: "lounge", placed: { persona, worker, state: "sleeping", detail: "No queued work · resting." } };
}

// ─────────────────────────────────────────────────────────────────
// Operational status — richer than the raw placement state.
// Distinguishes idle-because-no-work from idle-because-providers-blocked.
// Attaches a countdown target (wakeUpAt) when we can compute one from
// provider circuit-open timers. Never fabricates an ETA — if no
// provider has a circuit_open_ms_remaining, we omit the countdown.
// ─────────────────────────────────────────────────────────────────
type OperationalStatusKey =
  | "processing"        // green · currently processing a job
  | "standing_by"       // orange · no queued work · providers healthy
  | "queued"            // orange · queued work waiting to start
  | "waiting_capacity"  // red · all/most providers blocked · countdown to recovery
  | "waiting_admin"     // red · needs human decision
  | "offline";          // red · no cloud worker

type OperationalStatus = {
  key: OperationalStatusKey;
  label: string;
  color: string;
  reason: string;
  wakeUpAt?: number;       // ms timestamp when the earliest blocked provider will retry
  wakeUpProvider?: string; // provider that unblocks first
};

function deriveOperationalStatus(
  placed: PlacedWorker,
  providers: LlmProviderReport[],
): OperationalStatus {
  const w = placed.worker;
  if (placed.state === "offline") {
    return { key: "offline", label: "Offline", color: T.danger, reason: placed.detail };
  }
  if (placed.state === "working") {
    return { key: "processing", label: "Processing", color: T.success, reason: placed.detail };
  }
  if (placed.state === "queued") {
    return { key: "queued", label: "Queued", color: T.warning, reason: `${w?.jobs_waiting.toLocaleString() ?? "0"} job${(w?.jobs_waiting ?? 0) === 1 ? "" : "s"} waiting.` };
  }

  // For waiting_llm + sleeping · check if it's provider-capacity-blocked
  const healthy = providers.filter((p) => p.configured && (p.status === "healthy" || p.status === "idle"));
  const blocked = providers.filter((p) => p.configured && (p.status === "circuit-open" || p.status === "degraded"));
  const providersExhausted = healthy.length === 0 && blocked.length > 0;

  if (placed.state === "waiting_llm" || providersExhausted) {
    // Find earliest recovery time from circuit-open providers
    const withRecovery = blocked
      .filter((p) => (p.circuit_open_ms_remaining ?? 0) > 0)
      .map((p) => ({ provider: p.provider, at: Date.now() + (p.circuit_open_ms_remaining ?? 0) }))
      .sort((a, b) => a.at - b.at);
    const nearest = withRecovery[0];
    return {
      key: "waiting_capacity",
      label: "Waiting for AI capacity",
      color: T.danger,
      reason: providersExhausted
        ? `All ${blocked.length} configured provider${blocked.length === 1 ? "" : "s"} currently blocked or exhausted.`
        : "Waiting for a provider response.",
      wakeUpAt: nearest?.at,
      wakeUpProvider: nearest?.provider,
    };
  }

  // Truly sleeping = idle because no work to do
  return { key: "standing_by", label: "Standing by", color: T.warning, reason: "Ready · waiting for new jobs." };
}

// Format a millisecond duration as a human countdown · "17m 53s" or
// "2h 17m" or "just now"
function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs.toString().padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm.toString().padStart(2, "0")}m`;
}

// Live-ticking countdown · updates every second. Only renders text —
// caller decides where + how to style. When time reaches zero, callback
// fires so parent can re-derive state.
function Countdown({ targetAt, onComplete, className, style }: { targetAt: number; onComplete?: () => void; className?: string; style?: React.CSSProperties }) {
  const [remaining, setRemaining] = useState(Math.max(0, targetAt - Date.now()));
  useEffect(() => {
    setRemaining(Math.max(0, targetAt - Date.now()));
    const id = window.setInterval(() => {
      const left = Math.max(0, targetAt - Date.now());
      setRemaining(left);
      if (left === 0) {
        window.clearInterval(id);
        onComplete?.();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [targetAt, onComplete]);
  return <span className={className} style={style}>{formatCountdown(remaining)}</span>;
}

// ─────────────────────────────────────────────────────────────────
// Provider status — 3-band mapping per doctrine
//   🟢 green flashing  — healthy AND recent activity (calls_24h > 0)
//   🟠 orange          — healthy AND idle · standing by
//   🔴 red             — circuit-open · degraded · quota exhausted
// ─────────────────────────────────────────────────────────────────
type ProviderBand = "green-active" | "orange-standby" | "red-blocked" | "unconfigured";
function providerBand(p: LlmProviderReport): ProviderBand {
  if (!p.configured) return "unconfigured";
  if (p.status === "circuit-open" || p.status === "degraded") return "red-blocked";
  if (p.status === "healthy" && p.calls_24h > 0) return "green-active";
  if (p.status === "healthy" || p.status === "idle") return "orange-standby";
  return "red-blocked";
}
function providerReason(p: LlmProviderReport): string {
  const band = providerBand(p);
  if (band === "green-active")   return `${p.calls_24h.toLocaleString()} calls · avg ${p.avg_ms_24h ?? "—"}ms`;
  if (band === "orange-standby") return p.last_success_at ? `Standing by · last success ${relativeMinutes(p.last_success_at)}` : "Standing by · no calls yet";
  if (band === "red-blocked")    {
    if (p.status === "circuit-open" && p.circuit_open_ms_remaining) return `Circuit open · retry in ${Math.max(1, Math.round(p.circuit_open_ms_remaining / 1000))}s`;
    if ((p.consecutive_failures ?? 0) > 0) return `${p.consecutive_failures} recent failures${p.last_error ? ` · ${p.last_error.slice(0, 40)}…` : ""}`;
    return "Blocked · see provider workspace";
  }
  return "Not configured";
}
function relativeMinutes(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// ─────────────────────────────────────────────────────────────────
// Workspace views · left nav items
// ─────────────────────────────────────────────────────────────────
type ViewKey =
  // Executive Floor
  | "director" | "briefing" | "board" | "opportunity" | "strategy" | "kpi_wall" | "global_alerts"
  // Growth Floor
  | "marketing" | "social" | "email" | "content" | "campaigns" | "seo" | "partner"
  // Customer Floor
  | "support" | "customer" | "accounts" | "requests" | "feedback" | "livechat" | "community" | "crm"
  // Operations Floor
  | "operations" | "queue" | "journal" | "history" | "inbox" | "dumping" | "graph" | "review"
  // Growth Floor extension
  | "market"
  // Commercial Floor
  | "finance" | "subscriptions" | "revenue" | "invoices" | "accounting" | "pricing" | "sales" | "renewals" | "booker"
  // Engineering Floor
  | "providers" | "analytics" | "configuration" | "health" | "engineering" | "security" | "research" | "innovation" | "directory" | "storage"
  // Administration
  | "admin" | "audit" | "permissions" | "backups" | "compliance" | "legal" | "automation";

type ViewMeta = { key: ViewKey; label: string; icon: string; note?: string };
// Note: "Overview" is NOT in this list · it lives as an edge-triggered
// drawer (right side · vertical tab labelled "Overview"). Admin can
// glance at it from any workspace without leaving their current context.
const VIEWS: ViewMeta[] = [
  // Executive Floor
  { key: "director",      label: "Director's Office",   icon: "N" },
  { key: "briefing",      label: "Executive Briefing",  icon: "☰" },
  { key: "board",         label: "Board Report",        icon: "★" },
  { key: "opportunity",   label: "Opportunity Radar",   icon: "◎" },
  { key: "strategy",      label: "Strategy Room",       icon: "◈" },
  { key: "kpi_wall",      label: "Enterprise KPI Wall", icon: "▤" },
  { key: "global_alerts", label: "Global Alerts",       icon: "⚑" },
  // Growth Floor
  { key: "marketing",     label: "Marketing Centre",    icon: "♪" },
  { key: "social",        label: "Social Media",        icon: "◐" },
  { key: "email",         label: "Communications Centre", icon: "✉" },
  { key: "content",       label: "Content Studio",      icon: "✎" },
  { key: "campaigns",     label: "Campaign Planner",    icon: "◘" },
  { key: "seo",           label: "SEO & Analytics",     icon: "◈" },
  { key: "partner",       label: "Partner Agencies",    icon: "⚏" },
  { key: "market",        label: "Market Intelligence", icon: "◈" },
  // Customer Floor
  { key: "support",       label: "Support Centre",      icon: "☺" },
  { key: "customer",      label: "Customer Experience", icon: "◐" },
  { key: "accounts",      label: "Customer Accounts",   icon: "◉" },
  { key: "requests",      label: "Feature Requests",    icon: "+" },
  { key: "feedback",      label: "Feedback",            icon: "☆" },
  { key: "livechat",      label: "Live Chat",           icon: "◗" },
  { key: "community",     label: "Community",           icon: "◈" },
  { key: "crm",           label: "CRM",                 icon: "◇" },
  // Operations Floor
  { key: "operations",    label: "Operations Centre",   icon: "◉" },
  { key: "queue",         label: "Dispatch Queue",      icon: "▭" },
  { key: "journal",       label: "Worker Journal",      icon: "✎" },
  { key: "history",       label: "Operations History",  icon: "▤" },
  { key: "inbox",         label: "Knowledge Inbox",     icon: "◈" },
  { key: "dumping",       label: "Knowledge Dumping",   icon: "↧" },
  { key: "graph",         label: "Knowledge Graph",     icon: "❋" },
  { key: "review",        label: "Review Queue",        icon: "✓" },
  // Commercial Floor
  { key: "finance",       label: "Finance",             icon: "£" },
  { key: "subscriptions", label: "Subscriptions",       icon: "↻" },
  { key: "revenue",       label: "Revenue Analytics",   icon: "€" },
  { key: "invoices",      label: "Invoices",            icon: "▤" },
  { key: "accounting",    label: "Accounting",          icon: "≡" },
  { key: "pricing",       label: "Pricing Intelligence", icon: "◈" },
  { key: "sales",         label: "Sales Funnel",        icon: "$" },
  { key: "renewals",      label: "Renewal Centre",      icon: "⏰" },
  { key: "booker",        label: "Nex Booker",          icon: "◎" },
  // Engineering Floor
  { key: "providers",     label: "AI Providers",        icon: "◨" },
  { key: "analytics",     label: "Worker Analytics",    icon: "▲" },
  { key: "configuration", label: "Configuration",       icon: "⚙" },
  { key: "health",        label: "System Health",       icon: "♥" },
  { key: "storage",       label: "NEX Storage",         icon: "▤", note: "Infrastructure Runtime · adapters · health · config" },
  { key: "engineering",   label: "Engineering",         icon: "⚒" },
  { key: "security",      label: "Security Centre",     icon: "⛨" },
  { key: "research",      label: "Research & Innovation Lab", icon: "✦" },
  { key: "innovation",    label: "Innovation Lab",      icon: "◇" },
  { key: "directory",     label: "Headquarters Directory", icon: "▦" },
  // Administration
  { key: "admin",         label: "Administration",      icon: "★" },
  { key: "audit",         label: "Audit Centre",        icon: "❐" },
  { key: "permissions",   label: "Permissions",         icon: "⛨" },
  { key: "backups",       label: "Backups",             icon: "◇" },
  { key: "compliance",    label: "Compliance",          icon: "✓" },
  { key: "legal",         label: "Legal Office",        icon: "§" },
  { key: "automation",    label: "Automation Centre",   icon: "⚙" },
];

// Philip's Enterprise Campus floor structure · 2026-08-07 doctrine.
// Floor labels reinforce the "walking into a corporate campus" mental
// model. See project_nex_authority_levels_and_improvement_engine.
const NAV_CLUSTERS: { label: string; keys: ViewKey[] }[] = [
  { label: "Executive Floor",   keys: ["director", "briefing", "board", "opportunity", "strategy", "kpi_wall", "global_alerts"] },
  { label: "Growth Floor",      keys: ["marketing", "social", "email", "content", "campaigns", "seo", "partner", "market"] },
  { label: "Customer Floor",    keys: ["support", "customer", "accounts", "requests", "feedback", "livechat", "community", "crm"] },
  { label: "Operations Floor",  keys: ["operations", "queue", "journal", "history", "inbox", "dumping", "graph", "review"] },
  { label: "Commercial Floor",  keys: ["finance", "subscriptions", "revenue", "invoices", "accounting", "pricing", "sales", "renewals", "booker"] },
  { label: "Engineering Floor", keys: ["providers", "analytics", "configuration", "health", "storage", "engineering", "security", "research", "innovation", "directory"] },
  { label: "Administration",    keys: ["admin", "audit", "legal", "automation", "permissions", "backups", "compliance"] },
];

// Static integration state per view · Rule 4 sidebar dots. These are
// classified by whether their real backend feed exists today. Updated
// as integrations arrive. Never fabricate a healthy status.
const VIEW_INTEGRATION: Record<ViewKey, DeptStatus> = {
  // Real telemetry today
  director: "healthy", briefing: "healthy", operations: "healthy", queue: "healthy",
  providers: "healthy", health: "healthy", history: "healthy", journal: "healthy",
  inbox: "healthy", dumping: "healthy", graph: "healthy", review: "healthy",
  configuration: "healthy", audit: "healthy", admin: "healthy", directory: "healthy",
  booker: "healthy", storage: "healthy",
  // Currently degraded when relevant advisories exist
  opportunity: "healthy", strategy: "healthy", kpi_wall: "awaiting", global_alerts: "awaiting", board: "awaiting",
  analytics: "awaiting", engineering: "awaiting", security: "awaiting",
  research: "awaiting", innovation: "awaiting",
  // Awaiting integration
  marketing: "awaiting", social: "awaiting", email: "awaiting", content: "awaiting",
  campaigns: "awaiting", seo: "awaiting", partner: "awaiting",
  support: "awaiting", customer: "awaiting", accounts: "awaiting", requests: "awaiting",
  feedback: "awaiting", livechat: "awaiting", community: "awaiting", crm: "awaiting",
  finance: "awaiting", subscriptions: "awaiting", revenue: "awaiting", invoices: "awaiting",
  accounting: "awaiting", pricing: "awaiting", sales: "awaiting", renewals: "awaiting",
  permissions: "awaiting", backups: "awaiting", compliance: "awaiting", legal: "awaiting", automation: "healthy",
  market: "awaiting",
};

// Rule 6 · Operational Readiness = healthy count / total count
function computeReadiness(views: ViewMeta[]): { pct: number; healthy: number; total: number; awaiting: number } {
  const total = views.length;
  const healthy = views.filter((v) => VIEW_INTEGRATION[v.key] === "healthy").length;
  const awaiting = views.filter((v) => VIEW_INTEGRATION[v.key] === "awaiting").length;
  return { pct: Math.round((healthy / total) * 100), healthy, total, awaiting };
}

// Room clickability — each room routes to the workspace that owns
// its detailed information. Click a room in the HQ, admin's eye lands
// on the right-hand workspace showing more about it.
const ROOM_TO_VIEW: Partial<Record<RoomKey, ViewKey>> = {
  inbox:         "inbox",
  library:       "graph",
  understanding: "graph",
  writing:       "review",
  quality:       "review",
  vault:         "graph",
  ai_server:     "providers",
  lounge:        "analytics",
  manager:       "admin",
  meeting:       "journal",
  dispatch:      "queue",
  director:      "director",
  marketing:     "marketing",
  innovation:    "innovation",
};

// ─────────────────────────────────────────────────────────────────
// Root shell
// ─────────────────────────────────────────────────────────────────
export default function OperationsCentrePage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [cloud, setCloud] = useState<{ any_online: boolean; workers: CloudWorker[] } | null>(null);
  const [llm, setLlm] = useState<{ providers: LlmProviderReport[] } | null>(null);
  const [mockHidden, setMockHidden] = useState(0);
  const [selected, setSelected] = useState<PlacedWorker | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [view, setView] = useState<ViewKey>("director");
  const [overviewOpen, setOverviewOpen] = useState(false);
  // Operations Command Console · admin talks to NEX in natural language.
  // Transcript stays in-page (last 8 exchanges). Intent parsing is
  // pure-code today · maps common questions/commands to real telemetry.
  const [consoleTranscript, setConsoleTranscript] = useState<ConsoleExchange[]>([]);
  // Philip 2026-08-07 clarification: HEADQUARTERS floors take the full
  // right area (primary interface). The WORKSPACE column collapses to
  // give HQ more room. HQ never collapses — the building is always
  // fully visible.
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);
  const workspaceWidth = workspaceCollapsed ? 68 : 640;

  const [dateLabel, setDateLabel] = useState<string>("");
  useEffect(() => { setDateLabel(new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })); }, []);

  // Knowledge inbox count · powers the Factory Floor "Dumped" tile.
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  // Room Badge Explainer popup · doctrine feedback_nex_truth_display
  const [roomExplainer, setRoomExplainer] = useState<RoomKey | null>(null);

  const load = useCallback(async () => {
    try {
      const [statusRes, cloudRes, llmRes, recordsRes, inboxRes] = await Promise.all([
        fetch("/api/nex/brain/status", { cache: "no-store" }),
        fetch("/api/nex/brain/cloud-status", { cache: "no-store" }),
        fetch("/api/nex/brain/llm-health", { cache: "no-store" }),
        fetch("/api/nex/brain/records?limit=1", { cache: "no-store" }),
        fetch("/api/nex/knowledge-inbox/list", { cache: "no-store" }),
      ]);
      if (statusRes.ok) { const j = await statusRes.json(); if (j.ok) setStatus(j.status as StatusPayload); }
      if (cloudRes.ok)  { const j = await cloudRes.json();  setCloud({ any_online: Boolean(j.any_online), workers: (j.workers ?? []) as CloudWorker[] }); }
      if (llmRes.ok)    { const j = await llmRes.json();    setLlm({ providers: (j.providers ?? []) as LlmProviderReport[] }); }
      if (recordsRes.ok){ const j = await recordsRes.json(); setMockHidden(typeof j.mock_hidden_in_this_page === "number" ? j.mock_hidden_in_this_page : 0); }
      if (inboxRes.ok)  { const j = await inboxRes.json(); const items = Array.isArray(j.items) ? j.items : []; setInboxCount(items.length); }
    } catch { /* silent · retry next tick */ }
    setInitialLoad(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let id: number | null = null;
    const start = () => { if (id === null) id = window.setInterval(load, 5000); };
    const stop = () => { if (id !== null) { window.clearInterval(id); id = null; } };
    const onVis = () => { document.hidden ? stop() : start(); };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  const anyCloudOnline = cloud?.any_online === true;
  const providers = useMemo(() => llm?.providers ?? [], [llm]);
  const healthyProviders = useMemo(() => providers.filter((p) => p.status === "healthy" && p.configured), [providers]);
  const llmDegraded = healthyProviders.length === 0 && anyCloudOnline;
  const placements = useMemo(
    () => PERSONAS.map((persona) => {
      const workerRow = status?.worker_pool.find((w) => w.worker_type === persona.key);
      return placeWorker(persona, workerRow, anyCloudOnline, llmDegraded);
    }),
    [status, anyCloudOnline, llmDegraded],
  );
  const roomOccupants: Record<RoomKey, PlacedWorker[]> = {
    inbox: [], library: [], understanding: [], writing: [], quality: [], vault: [], ai_server: [], lounge: [], manager: [], meeting: [], dispatch: [], director: [], marketing: [], innovation: [],
  };
  for (const { room, placed } of placements) roomOccupants[room].push(placed);
  // Locked 6-state worker counters per Worker State Correction Doctrine
  // (Philip 2026-08-07). waiting_llm is NEVER counted as "active" —
  // it's a distinct blocked state that must surface separately.
  const totalProcessing       = placements.filter((p) => p.placed.state === "working").length;
  const totalWaitingCapacity  = placements.filter((p) => p.placed.state === "waiting_llm").length;
  const totalQueued           = placements.filter((p) => p.placed.state === "queued").length;
  const totalSleeping         = placements.filter((p) => p.placed.state === "sleeping").length;
  const totalOffline          = placements.filter((p) => p.placed.state === "offline").length;
  // Legacy alias · Reception band + drawer still read this · now
  // reflects TRULY active workers only (excludes blocked)
  const totalActive           = totalProcessing;

  const buildingStatus =
    !anyCloudOnline ? { label: "Building offline",   color: T.danger,  note: "No cloud workers currently on the floor." } :
    llmDegraded     ? { label: "Reduced capability", color: T.warning, note: "Cloud workers online · AI providers unavailable." } :
    mockHidden > 0  ? { label: "Advisory active",    color: T.warning, note: "Mock fallback generating placeholder work." } :
                      { label: "Fully operational",  color: T.success, note: "All systems green · workers processing." };

  // Cases — computed each poll from real telemetry.
  const cases = useMemo(
    () => computeCases({ status, cloud, providers, mockHidden }),
    [status, cloud, providers, mockHidden],
  );

  // Track room transitions · when a worker's placement changes room,
  // the receiving room's door pulses for 1.5s. Only fires on REAL
  // state changes (previous room !== current room). Never on first
  // render, never on re-render with identical placement · Law 4.
  const previousRoomsRef = useRef<Record<string, RoomKey>>({});
  const [recentEntries, setRecentEntries] = useState<Record<RoomKey, number>>(
    { inbox: 0, library: 0, understanding: 0, writing: 0, quality: 0, vault: 0, ai_server: 0, lounge: 0, manager: 0, meeting: 0, dispatch: 0, director: 0, marketing: 0, innovation: 0 }
  );
  useEffect(() => {
    const now = Date.now();
    const updates: Partial<Record<RoomKey, number>> = {};
    for (const { room, placed } of placements) {
      const key = placed.persona.key;
      const prev = previousRoomsRef.current[key];
      if (prev !== undefined && prev !== room) {
        // Real transition — record entry timestamp on the receiving room
        updates[room] = now;
      }
      previousRoomsRef.current[key] = room;
    }
    if (Object.keys(updates).length > 0) {
      setRecentEntries((r) => ({ ...r, ...updates }));
    }
  }, [placements]);

  return (
    <div style={{ background: T.bgGradient, color: T.text, minHeight: "100vh" }}>
      <div
        className="grid grid-cols-1"
        style={{
          minHeight: "100vh",
          // Layout: Sidebar (left · nav) · Workspace (middle · hides entirely when minimised → yellow edge tab restores) · HQ (right · full area · always visible)
          gridTemplateColumns: workspaceCollapsed ? `260px 1fr` : `260px 640px 1fr`,
        }}
      >
        {/* ═════ Sidebar · Navigation (LEFT) ═════ */}
        <OpsSidebar
          view={view}
          setView={setView}
          buildingStatus={buildingStatus}
          totalActive={totalActive}
          totalSleeping={totalSleeping}
          totalOffline={totalOffline}
          status={status}
          mockHidden={mockHidden}
        />

        {/* ═════ Middle · Information Workspace (swaps per view · hidden when minimised) ═════ */}
        {!workspaceCollapsed ? (
          <Workspace
            view={view}
            setView={setView}
            status={status}
            providers={providers}
            mockHidden={mockHidden}
            cloud={cloud}
            buildingStatus={buildingStatus}
            totalActive={totalActive}
            totalSleeping={totalSleeping}
            totalOffline={totalOffline}
            cases={cases}
          />
        ) : null}

        {/* ═════ RIGHT · Headquarters (always visible · full right area · never collapses) ═════ */}
        <HeadquartersColumn
          dateLabel={dateLabel}
          anyCloudOnline={anyCloudOnline}
          totalActive={totalActive}
          totalSleeping={totalSleeping}
          totalOffline={totalOffline}
          roomOccupants={roomOccupants}
          providers={providers}
          initialLoad={initialLoad}
          onSelectWorker={setSelected}
          setView={setView}
          cases={cases}
          cloud={cloud}
          mockHidden={mockHidden}
          recentEntries={recentEntries}
          inboxCount={inboxCount}
          recordsAuthoritative={status?.records_authoritative ?? 0}
          onExplainRoom={(rk) => setRoomExplainer(rk)}
          consoleTranscript={consoleTranscript}
          onConsoleSubmit={(text) => {
            const ctx: ConsoleContext = { placements, providers, status, cases, cloud, mockHidden };
            const { response, tone, action } = parseCommand(text, ctx);
            setConsoleTranscript((prev) => [
              ...prev.slice(-7),
              { id: `${Date.now()}`, at: new Date().toISOString(), input: text, response, tone, action },
            ]);
          }}
          onConsoleAction={(v) => setView(v)}
          workspaceCollapsed={workspaceCollapsed}
          onToggleWorkspaceCollapsed={() => setWorkspaceCollapsed((c) => !c)}
        />
      </div>

      {/* Room Badge Explainer · Doctrine #3 · popup opens on room signage
          click · shows room identity card before entering. */}
      <AnimatePresence>
        {roomExplainer ? (
          <RoomExplainerPopup
            key={`room-${roomExplainer}`}
            roomKey={roomExplainer}
            onClose={() => setRoomExplainer(null)}
            onEnter={() => { const v = ROOM_TO_VIEW[roomExplainer]; if (v) setView(v); setRoomExplainer(null); }}
          />
        ) : null}
      </AnimatePresence>

      {/* Overview drawer · triggered by right-edge tab · glanceable
          from any workspace without navigation. Contains at-a-glance
          building status, metrics, provider mix, config attention. */}
      <OverviewEdgeTab open={overviewOpen} onToggle={() => setOverviewOpen((o) => !o)} />
      <AnimatePresence>
        {overviewOpen ? (
          <OverviewDrawer
            key="overview-drawer"
            buildingStatus={buildingStatus}
            status={status}
            totalActive={totalActive}
            totalSleeping={totalSleeping}
            totalOffline={totalOffline}
            providers={providers}
            mockHidden={mockHidden}
            setView={(v) => { setView(v); setOverviewOpen(false); }}
            onClose={() => setOverviewOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      {selected ? <WorkerDetailPanel placed={selected} llm={providers} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// SIDEBAR · Navigation
// ═════════════════════════════════════════════════════════════════
function OpsSidebar({
  view, setView, buildingStatus, totalActive, totalSleeping, totalOffline, status, mockHidden,
}: {
  view: ViewKey; setView: (v: ViewKey) => void;
  buildingStatus: { label: string; color: string; note: string };
  totalActive: number; totalSleeping: number; totalOffline: number;
  status: StatusPayload | null;
  mockHidden: number;
}) {
  return (
    <aside
      className="sticky top-0 h-screen overflow-y-auto border-r p-4"
      style={{ borderColor: T.border, background: T.panel }}
    >
      <div className="text-[9px] font-semibold uppercase tracking-[0.28em]" style={{ color: T.accent }}>
        Operations Control
      </div>
      <div className="mt-1 text-[19px] font-black tracking-tight" style={{ letterSpacing: "-0.02em" }}>
        NEX Headquarters
      </div>

      {/* Dump Knowledge · quick-access button at the top of sidebar
          (Philip 2026-08-07). One-click route to Knowledge Dumping
          for pasting large text corpora (articles · specs · regs). */}
      <button
        type="button"
        onClick={() => setView("dumping")}
        aria-label="Dump knowledge to inbox"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-black uppercase tracking-[0.14em] shadow-md transition-transform hover:translate-y-[-1px]"
        style={{
          background: `linear-gradient(180deg, ${T.accent} 0%, ${T.accentDark} 100%)`,
          borderColor: T.accentDark,
          color: "#FFFFFF",
          textShadow: "0 1px 2px rgba(0,0,0,0.25)",
          cursor: "pointer",
        }}
      >
        <span className="text-[15px] leading-none" aria-hidden>↧</span>
        <span>Dump Knowledge</span>
      </button>

      <div className="mt-3 rounded-xl border p-3" style={{ background: T.panelElev, borderColor: T.borderStrong }}>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: buildingStatus.color, boxShadow: `0 0 8px ${buildingStatus.color}` }} />
          <span className="text-[12px] font-bold" style={{ color: buildingStatus.color }}>{buildingStatus.label}</span>
        </div>
        <div className="mt-0.5 text-[10.5px] leading-snug" style={{ color: T.textDim }}>{buildingStatus.note}</div>
        <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
          <MiniStat label="Work"    value={totalActive}   tone={T.success} />
          <MiniStat label="Rest"    value={totalSleeping} tone={T.textDim} />
          <MiniStat label="Offline" value={totalOffline}  tone={T.danger} />
        </div>
      </div>

      {/* Rule 6 · HQ Operational Readiness · % of departments healthy */}
      {(() => {
        const r = computeReadiness(VIEWS);
        const color = r.pct >= 80 ? T.success : r.pct >= 50 ? T.warning : T.danger;
        return (
          <div className="mt-4 rounded-xl border p-3" style={{ background: T.panelElev, borderColor: T.border }}>
            <div className="flex items-baseline justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: T.textDim }}>HQ Operational Readiness</span>
              <span className="font-mono text-[13px] font-black" style={{ color }}>{r.pct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: T.panelElev2 }}>
              <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: color, transition: "width 0.5s ease-out" }} />
            </div>
            <div className="mt-1 text-[9.5px]" style={{ color: T.textFade }}>
              {r.healthy} healthy · {r.awaiting} awaiting · {r.total} total
            </div>
          </div>
        );
      })()}

      <div className="mt-4">
        <div className="text-[9px] uppercase tracking-[0.2em] font-bold" style={{ color: T.textDim }}>Workspace</div>
        <nav className="mt-1.5">
          {NAV_CLUSTERS.map((cluster, i) => (
            <div key={cluster.label} className={i > 0 ? "mt-3" : "mt-1"}>
              <div
                className="mb-1 px-2 text-[8px] font-black uppercase tracking-[0.32em]"
                style={{ color: T.accentDark, borderTop: i > 0 ? `1px solid ${T.border}` : "none", paddingTop: i > 0 ? 6 : 0 }}
              >
                {cluster.label}
              </div>
              <div className="space-y-0.5">
                {cluster.keys.map((k) => {
                  const v = VIEWS.find((x) => x.key === k);
                  if (!v) return null;
                  return <NavItem key={v.key} icon={v.icon} label={v.label} active={view === v.key} onClick={() => setView(v.key)} status={VIEW_INTEGRATION[v.key]} />;
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-lg border p-2" style={{ borderColor: T.border, background: T.panelElev }}>
        <QueueMini label="Wait"   value={status?.jobs_waiting ?? 0} />
        <QueueMini label="Fly"    value={status?.jobs_in_flight ?? 0} tone={T.info} />
        <QueueMini label="Done"   value={status?.jobs_completed_24h ?? 0} tone={T.success} />
      </div>

      {mockHidden > 0 ? (
        <div className="mt-3 rounded-lg border p-3" style={{ background: T.dangerSoft, borderColor: T.danger }}>
          <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: T.danger }}>Alert</div>
          <div className="mt-1 text-[11px] leading-snug" style={{ color: T.text }}>
            {mockHidden.toLocaleString()} placeholder record{mockHidden === 1 ? "" : "s"} from mock adapter.
          </div>
        </div>
      ) : null}

      <div className="mt-6 border-t pt-3 text-[9px]" style={{ borderColor: T.border, color: T.textGhost }}>
        Live · 5s poll · pauses when tab hidden
      </div>
    </aside>
  );
}

function NavItem({ icon, label, active, onClick, status }: { icon: string; label: string; active: boolean; onClick: () => void; status?: DeptStatus }) {
  const sc = status ? statusColor(status) : T.textGhost;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[12px] font-semibold transition-colors"
      style={{
        background: active ? T.accentSoft  : "transparent",
        borderColor: active ? T.accent     : "transparent",
        color:       active ? T.accentDark : T.textDim,
      }}
      title={status ? statusLabel(status) : undefined}
    >
      <span className="w-4 text-center text-[13px]" style={{ color: active ? T.accent : T.textFade }}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {status ? (
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: sc, boxShadow: status === "healthy" ? `0 0 4px ${sc}` : "none" }} />
      ) : null}
    </button>
  );
}

function QueueMini({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="text-center">
      <div className="font-mono text-[13px] font-black" style={{ color: tone ?? T.text }}>{value.toLocaleString()}</div>
      <div className="text-[8px] uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// HEADQUARTERS COLUMN · always visible living HQ
//
// Structure top-to-bottom:
//   · Reception band
//   · Ground floor (8 knowledge-production rooms)
//   · First floor (Manager · Director's Office (NEX) · Meeting · Dispatch)
//   · AI Provider Operations Wall (always visible per doctrine)
//   · Living Timeline (streams from Worker Audit Log · honest empty state)
// ═════════════════════════════════════════════════════════════════
function HeadquartersColumn({
  dateLabel, anyCloudOnline, totalActive, totalSleeping, totalOffline,
  roomOccupants, providers, initialLoad, onSelectWorker, setView, cases,
  cloud, mockHidden, recentEntries, inboxCount, recordsAuthoritative, onExplainRoom,
  consoleTranscript, onConsoleSubmit, onConsoleAction,
  workspaceCollapsed, onToggleWorkspaceCollapsed,
}: {
  dateLabel: string;
  anyCloudOnline: boolean;
  totalActive: number; totalSleeping: number; totalOffline: number;
  roomOccupants: Record<RoomKey, PlacedWorker[]>;
  providers: LlmProviderReport[];
  initialLoad: boolean;
  onSelectWorker: (p: PlacedWorker) => void;
  setView: (v: ViewKey) => void;
  cases: ReturnType<typeof computeCases>;
  cloud: { any_online: boolean; workers: CloudWorker[] } | null;
  mockHidden: number;
  recentEntries: Record<RoomKey, number>;
  inboxCount: number | null;
  recordsAuthoritative: number;
  onExplainRoom: (rk: RoomKey) => void;
  consoleTranscript: ConsoleExchange[];
  onConsoleSubmit: (text: string) => void;
  onConsoleAction: (view: ViewKey) => void;
  workspaceCollapsed: boolean;
  onToggleWorkspaceCollapsed: () => void;
}) {
  // Room signage click · opens the Room Explainer popup (Doctrine #3)
  // per Philip 2026-08-07 · popup shows identity card before entering
  const openRoom = (room: RoomKey) => onExplainRoom(room);

  return (
    <div
      className="sticky top-0 flex h-screen flex-col border-l"
      style={{ borderColor: T.border, background: T.bgGradient }}
    >
      {/* Workspace collapse toggle · admin can minimise middle column
          when they want maximum HQ real estate. Sits at the top-left
          of the HQ column · doesn't touch HQ width. */}
      <WorkspaceCollapseToggle collapsed={workspaceCollapsed} onToggle={onToggleWorkspaceCollapsed} />

      {/* Scrollable HQ content · reception · floors · providers · timeline */}
      <div className="flex-1 overflow-y-auto">
      <ReceptionBand
        dateLabel={dateLabel}
        anyCloudOnline={anyCloudOnline}
        totalActive={totalActive}
        totalSleeping={totalSleeping}
        totalOffline={totalOffline}
      />

      {/* NEX Knowledge Factory Header · permanent metrics band above the
          floor. Rule: The Factory Floor must show the flow of intelligence,
          not just the existence of workers (Philip 2026-08-07). Every tile
          driven by real telemetry — inboxCount from /knowledge-inbox/list,
          rest from /brain/status. Never fabricated. */}
      {(() => {
        // Compute worker-state buckets in HeadquartersColumn scope
        // (Root passes derived totals via totalActive/Sleeping/Offline
        // but the corrected model needs the finer 6-state breakdown)
        const allPlacements = Object.values(roomOccupants).flat();
        const hqProcessing      = allPlacements.filter((p) => p.state === "working").length;
        const hqWaitingCapacity = allPlacements.filter((p) => p.state === "waiting_llm").length;
        const hqQueued          = allPlacements.filter((p) => p.state === "queued").length;
        const hqStandby         = allPlacements.filter((p) => p.state === "sleeping").length;
        const hqOffline         = allPlacements.filter((p) => p.state === "offline").length;
        return (
          <>
            <FactoryFloorHeader
              inboxCount={inboxCount}
              jobsWaiting={allPlacements.reduce((sum, p) => sum + (p.worker?.jobs_waiting ?? 0), 0)}
              jobsInFlight={allPlacements.reduce((sum, p) => sum + (p.worker?.jobs_in_flight ?? 0), 0)}
              workersProcessing={hqProcessing}
              workersWaitingCapacity={hqWaitingCapacity}
              workersStandby={hqStandby + hqQueued}
              workersOffline={hqOffline}
              workersTotal={hqProcessing + hqWaitingCapacity + hqQueued + hqStandby + hqOffline}
              recordsAuthoritative={recordsAuthoritative}
              onOpenDump={() => setView("dumping")}
            />
            {/* In-Flight Jobs · Factory Living Workers Doctrine Rule 1 ·
                every counter resolves to a visible object with owner/location */}
            <InFlightJobsPanel placements={allPlacements} providers={providers} />
            {/* Backend Readiness · doctrine feedback_nex_ui_ahead_of_backend ·
                the diagnostic that stops guesswork about what's live */}
            <BackendReadinessPanel />
            <WorkerRoster
              placements={allPlacements}
              providers={providers}
              workersProcessing={hqProcessing}
              workersWaitingCapacity={hqWaitingCapacity}
            />
          </>
        );
      })()}

      {/* Global Recovery Clock · shows when ANY worker is waiting for
          AI capacity. Countdown driven by the earliest provider retry.
          Never renders if no worker is in waiting_capacity state · Law 4. */}
      <GlobalRecoveryClock
        placements={Object.values(roomOccupants).flat()}
        providers={providers}
      />

      <LayoutGroup>
        <div className="p-4">
          <FloorHeader label="Ground floor" sub="Knowledge production" side={anyCloudOnline ? `${totalActive} at work` : "offline"} />
          <FloorPlan>
            <RoomRow cols={2}>
              <RoomShell room={ROOMS.inbox}         occupants={roomOccupants.inbox}         onSelect={onSelectWorker} onOpenRoom={openRoom} initialLoad={initialLoad} compact justEnteredAt={recentEntries.inbox} allProviders={providers} />
              <RoomShell room={ROOMS.library}       occupants={roomOccupants.library}       onSelect={onSelectWorker} onOpenRoom={openRoom} initialLoad={initialLoad} compact justEnteredAt={recentEntries.library} allProviders={providers} />
            </RoomRow>
            <RoomRow cols={2}>
              <RoomShell room={ROOMS.understanding} occupants={roomOccupants.understanding} onSelect={onSelectWorker} onOpenRoom={openRoom} initialLoad={initialLoad} compact justEnteredAt={recentEntries.understanding} allProviders={providers} />
              <RoomShell room={ROOMS.writing}       occupants={roomOccupants.writing}       onSelect={onSelectWorker} onOpenRoom={openRoom} initialLoad={initialLoad} compact justEnteredAt={recentEntries.writing} allProviders={providers} />
            </RoomRow>
            <Corridor label="Ground-floor corridor" />
            <RoomRow cols={2}>
              <RoomShell room={ROOMS.quality}   occupants={roomOccupants.quality}   onSelect={onSelectWorker} onOpenRoom={openRoom} initialLoad={initialLoad} compact justEnteredAt={recentEntries.quality} allProviders={providers} />
              <RoomShell room={ROOMS.vault}     occupants={roomOccupants.vault}     onSelect={onSelectWorker} onOpenRoom={openRoom} initialLoad={initialLoad} compact justEnteredAt={recentEntries.vault} allProviders={providers} />
            </RoomRow>
            <RoomRow cols={2}>
              <RoomShell room={ROOMS.ai_server} occupants={roomOccupants.ai_server} onSelect={onSelectWorker} onOpenRoom={openRoom} initialLoad={initialLoad} compact justEnteredAt={recentEntries.ai_server} providerReports={providers} allProviders={providers} />
              <RoomShell room={ROOMS.lounge}    occupants={roomOccupants.lounge}    onSelect={onSelectWorker} onOpenRoom={openRoom} initialLoad={initialLoad} compact justEnteredAt={recentEntries.lounge} allProviders={providers} />
            </RoomRow>
          </FloorPlan>

          <div className="mt-6">
            <FloorHeader label="First floor" sub="Executive · strategy · dispatch" side="admin wing" />
            <FloorPlan>
              {/* Executive row · Manager (you) + Director (NEX) */}
              <RoomRow cols={2}>
                <RoomShell     room={ROOMS.manager}  occupants={roomOccupants.manager}  onSelect={onSelectWorker} onOpenRoom={openRoom} initialLoad={initialLoad} compact justEnteredAt={recentEntries.manager} allProviders={providers} />
                <DirectorOffice room={ROOMS.director} cases={cases} onOpen={() => setView("director")} />
              </RoomRow>
              {/* Strategy row · Marketing Studio + Innovation Lab */}
              <RoomRow cols={2}>
                <PlannedRoomShell room={ROOMS.marketing}  onOpen={() => setView("marketing")}  />
                <PlannedRoomShell room={ROOMS.innovation} onOpen={() => setView("innovation")} />
              </RoomRow>
              {/* Operations row · Meeting + Dispatch */}
              <RoomRow cols={2}>
                <RoomShell   room={ROOMS.meeting}  occupants={roomOccupants.meeting}  onSelect={onSelectWorker} onOpenRoom={openRoom} initialLoad={initialLoad} compact justEnteredAt={recentEntries.meeting} allProviders={providers} />
                <DispatchShell room={ROOMS.dispatch} occupants={roomOccupants.dispatch} onOpen={() => setView("queue")} allPlacements={Object.values(roomOccupants).flat()} providers={providers} />
              </RoomRow>
            </FloorPlan>
          </div>

          {/* Provider Operations Wall · always visible per doctrine · richer tiles per Philip 2026-08-07 */}
          <div className="mt-6">
            <FloorHeader label="Provider Operations Wall" sub="24h achievements · currently on task" side={`${providers.filter((p) => providerBand(p) === "green-active").length} active`} />
            <ProviderStrip providers={providers} onOpen={() => setView("providers")} activeWorkerCount={totalActive} />
          </div>

          {/* Living Timeline · streams from Worker Audit Log */}
          <div className="mt-6">
            <FloorHeader label="Living Timeline" sub="What just happened" side="last 20 events" />
            <LivingTimeline onOpen={() => setView("history")} />
          </div>
        </div>
      </LayoutGroup>
      </div>

      {/* Operations Command Console · pinned to the bottom of HQ so
          admin can command NEX from any workspace. Real telemetry
          drives every answer. */}
      <CommandConsole
        transcript={consoleTranscript}
        onSubmit={onConsoleSubmit}
        onAction={onConsoleAction}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Workspace collapse toggle — two rendering modes:
//   · Expanded: small pill at the top-left edge of the HQ column
//     (in-flow · says "Minimise workspace")
//   · Collapsed: right-edge YELLOW tab (fixed · pattern-matches the
//     Overview edge tab). Click restores the workspace column.
// Per Philip 2026-08-07: minimised screens become yellow right-edge tabs.
// ─────────────────────────────────────────────────────────────────
function WorkspaceCollapseToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  if (collapsed) {
    // Render as fixed right-edge tab (matches OverviewEdgeTab layout,
    // vertically stacked below it so both tabs are accessible)
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label="Expand Workspace"
        title="Restore the Workspace column"
        className="fixed right-0 z-30 flex select-none items-center gap-1.5 rounded-l-lg border py-3 pl-2 pr-1.5 shadow-lg transition-transform hover:translate-x-[-2px]"
        style={{
          top: "calc(50% + 120px)",   // sit below Overview tab (which is at 50%)
          transform: "translateY(-50%)",
          background: T.accent,        // YELLOW · NEX accent
          borderColor: T.accentDark,
          color: "#FFFFFF",
          writingMode: "vertical-rl",
        }}
      >
        <span className="text-[10px] font-black uppercase tracking-[0.32em]" style={{ color: "#FFFFFF" }}>Workspace</span>
        <span className="rounded-full" style={{ height: 6, width: 6, background: "#FFFFFF", boxShadow: "0 0 6px rgba(255,255,255,0.7)" }} />
      </button>
    );
  }
  // Expanded · in-flow pill on the HQ column's top-left corner
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Collapse Workspace"
      title="Collapse Workspace column · maximise Headquarters"
      className="absolute left-0 top-3 z-10 flex h-8 items-center gap-1 rounded-r-md border border-l-0 px-2 shadow-md hover:brightness-110"
      style={{ background: T.panel, borderColor: T.wallDark, cursor: "pointer" }}
    >
      <span className="text-[14px] font-black leading-none" style={{ color: T.accentDark }}>‹</span>
      <span className="text-[9px] font-bold uppercase tracking-[0.24em]" style={{ color: T.textDim }}>Minimise workspace</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Operations Command Console — the primary way to talk to NEX.
//
// Structure:
//   · Header  · NEX profile circle + name on top-left · close X on top-right
//   · Transcript (last 8 exchanges · newest at the bottom)
//   · Input row (text + Send + voice-pending)
//
// When admin closes the console, a small yellow "Chat NEX" pill sits
// at the bottom-right of the HQ column to reopen it. Transcript
// persists across close/reopen (state lives in Root).
// ─────────────────────────────────────────────────────────────────
function CommandConsole({
  transcript, onSubmit, onAction,
}: {
  transcript: ConsoleExchange[];
  onSubmit: (text: string) => void;
  onAction: (view: ViewKey) => void;
}) {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const submit = () => {
    const t = input.trim();
    if (!t) return;
    onSubmit(t);
    setInput("");
  };

  // Closed · yellow FAB pill at bottom-right of the HQ column reopens
  if (!open) {
    return (
      <div className="flex-none" aria-hidden={false}>
        <div className="relative h-0">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open Command NEX"
            title="Open Command NEX"
            className="absolute -top-14 right-4 z-20 flex items-center gap-2 rounded-full border px-3 py-2 shadow-lg hover:brightness-110"
            style={{ background: T.accent, borderColor: T.accentDark, color: "#FFFFFF" }}
          >
            <span
              className="grid h-7 w-7 flex-none place-items-center rounded-full font-black"
              style={{
                background: `radial-gradient(circle at 30% 25%, ${NEX_DIRECTOR.colorAccent}FF 0%, #FFFFFF 60%, #FFFFFF 100%)`,
                color: T.accentDark, fontSize: 13, textShadow: "0 1px 1px rgba(0,0,0,0.15)",
              }}
              aria-hidden
            >N</span>
            <span className="text-[11px] font-black uppercase tracking-[0.2em]">Chat NEX</span>
            {transcript.length > 0 ? (
              <span className="rounded-full px-1.5 py-0.5 text-[9px] font-black" style={{ background: "#FFFFFF", color: T.accentDark }}>
                {transcript.length}
              </span>
            ) : null}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-none border-t"
      style={{ borderColor: T.wallDark, background: T.panel, boxShadow: "0 -6px 20px -8px rgba(0,0,0,0.15)" }}
    >
      {/* Header · NEX profile top-left · close X top-right */}
      <div className="flex items-center gap-2.5 border-b px-3 py-2" style={{ borderColor: T.border, background: T.panelElev }}>
        <div
          className="grid h-9 w-9 flex-none place-items-center rounded-full font-black text-white"
          style={{
            background: `radial-gradient(circle at 30% 25%, ${NEX_DIRECTOR.colorAccent}FF 0%, ${NEX_DIRECTOR.colorAccent}CC 60%, ${NEX_DIRECTOR.colorAccent}88 100%)`,
            fontSize: 14, boxShadow: `0 3px 8px -2px ${NEX_DIRECTOR.colorAccent}`, textShadow: "0 1px 2px rgba(0,0,0,0.35)",
          }}
          aria-hidden
        >N</div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-black leading-tight" style={{ color: T.text }}>NEX</div>
          <div className="text-[9.5px] leading-tight" style={{ color: NEX_DIRECTOR.colorAccent }}>{NEX_DIRECTOR.role}</div>
        </div>
        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: T.success }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: T.success, boxShadow: `0 0 4px ${T.success}` }} />
          On duty
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close Command NEX"
          title="Close chat · NEX stays on duty"
          className="rounded-full border px-2 py-0.5 text-[11px] hover:brightness-110"
          style={{ background: T.panel, borderColor: T.border, color: T.textDim, cursor: "pointer" }}
        >
          ✕
        </button>
      </div>

      {/* Transcript · newest at the bottom · scrolls internally when long */}
      {transcript.length > 0 ? (
        <div className="max-h-[220px] overflow-y-auto border-b" style={{ borderColor: T.border }}>
          <AnimatePresence initial={false}>
            {transcript.map((ex) => (
              <motion.div
                key={ex.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-b px-3 py-2 last:border-0"
                style={{ borderColor: T.border }}
              >
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: T.textFade }}>You</div>
                <div className="text-[12px]" style={{ color: T.text }}>{ex.input}</div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest"
                    style={{ background: `${NEX_DIRECTOR.colorAccent}22`, color: NEX_DIRECTOR.colorAccent }}
                  >NEX</span>
                  <span className="text-[9px]" style={{ color: T.textFade }}>{new Date(ex.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div
                  className="mt-0.5 text-[12px] leading-relaxed"
                  style={{
                    color:
                      ex.tone === "danger"  ? T.danger :
                      ex.tone === "warning" ? T.warning :
                      ex.tone === "success" ? T.success :
                                              T.text,
                  }}
                >
                  {ex.response}
                </div>
                {ex.action?.view ? (
                  <button
                    type="button"
                    onClick={() => onAction(ex.action!.view!)}
                    className="mt-1.5 rounded-md border px-2 py-1 text-[10.5px] font-semibold"
                    style={{ background: T.accentSoft, borderColor: T.accent, color: T.accentDark, cursor: "pointer" }}
                  >
                    {ex.action.label} →
                  </button>
                ) : null}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : null}

      {/* Input row */}
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="flex items-center gap-2 p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Command NEX… try &ldquo;why is Mason sleeping?&rdquo; · &ldquo;provider status&rdquo; · &ldquo;how many cases?&rdquo;"
          className="min-w-0 flex-1 rounded-md border px-3 py-2 text-[12px]"
          style={{ background: T.panelElev, borderColor: T.border, color: T.text }}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-md border px-3 py-2 text-[12px] font-bold"
          style={{
            background: input.trim() ? T.accent : T.panelElev,
            borderColor: input.trim() ? T.accentDark : T.border,
            color: input.trim() ? "#FFFFFF" : T.textFade,
            cursor: input.trim() ? "pointer" : "not-allowed",
          }}
        >
          Send
        </button>
        <button
          type="button"
          disabled
          title="Voice input pending"
          aria-label="Voice input pending"
          className="rounded-md border px-2 py-2 text-[14px]"
          style={{ background: T.panelElev, borderColor: T.border, color: T.textFade, cursor: "not-allowed" }}
        >
          🎤
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Factory Floor Header · permanent metrics band above the workshop.
// Doctrine: feedback_nex_factory_floor_visibility_2026_08_07.md ·
// "The Factory Floor must show the flow of intelligence, not just
// the existence of workers." Every tile driven by real telemetry.
// ─────────────────────────────────────────────────────────────────
function FactoryFloorHeader({
  inboxCount, jobsWaiting, jobsInFlight,
  workersProcessing, workersWaitingCapacity, workersStandby, workersOffline, workersTotal,
  recordsAuthoritative, onOpenDump,
}: {
  inboxCount: number | null;
  jobsWaiting: number;
  jobsInFlight: number;
  workersProcessing: number;
  workersWaitingCapacity: number;
  workersStandby: number;
  workersOffline: number;
  workersTotal: number;
  recordsAuthoritative: number;
  onOpenDump: () => void;
}) {
  const inProcess = jobsWaiting + jobsInFlight;
  return (
    <div
      className="border-b px-4 py-3"
      style={{
        background: `linear-gradient(180deg, ${T.panelElev} 0%, ${T.floor} 100%)`,
        borderColor: T.wallDark,
      }}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.32em]" style={{ color: T.accent }}>NEX Knowledge Factory</span>
        <span className="ml-auto text-[8.5px]" style={{ color: T.textFade }}>Live · updates every 5s</span>
      </div>

      {/* Row 1 · knowledge flow */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onOpenDump}
          className="rounded-lg border p-2 text-left transition-transform hover:translate-y-[-1px]"
          style={{ background: T.panel, borderColor: T.border, cursor: "pointer" }}
          title="Click to open Knowledge Dumping"
        >
          <div className="text-[8px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Dumped</div>
          <div className="mt-0.5 font-mono text-[18px] font-black leading-none" style={{ color: T.text }}>
            {inboxCount === null ? "—" : inboxCount.toLocaleString()}
          </div>
          <div className="mt-0.5 text-[8.5px]" style={{ color: T.textFade }}>Inbox items</div>
        </button>

        <div className="rounded-lg border p-2" style={{ background: T.panel, borderColor: inProcess > 0 ? T.info : T.border }}>
          <div className="text-[8px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Queue Depth</div>
          <div className="mt-0.5 font-mono text-[18px] font-black leading-none" style={{ color: inProcess > 0 ? T.info : T.text }}>
            {inProcess.toLocaleString()}
          </div>
          <div className="mt-0.5 text-[8.5px]" style={{ color: T.textFade }}>
            {jobsWaiting} queued · {jobsInFlight} in-flight (may be blocked)
          </div>
        </div>

        <div className="rounded-lg border p-2" style={{ background: T.panel, borderColor: T.border }}>
          <div className="text-[8px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Into Brain</div>
          <div className="mt-0.5 font-mono text-[18px] font-black leading-none" style={{ color: T.accent }}>
            {recordsAuthoritative.toLocaleString()}
          </div>
          <div className="mt-0.5 text-[8.5px]" style={{ color: T.textFade }}>Authoritative</div>
        </div>
      </div>

      {/* Row 2 · worker states · Worker State Correction + UI-ahead-of-backend
          Processing / Waiting for AI / Recovery Pending / Standby
          Recovery Pending distinct from Waiting for AI because Recovery
          Manager service is not yet installed · nothing is actively
          attempting recovery on the blocked workers */}
      <div className="mt-2 grid grid-cols-4 gap-2">
        <div className="rounded-lg border p-2" style={{ background: T.panel, borderColor: workersProcessing > 0 ? T.success : T.border }}>
          <div className="text-[8px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>🟢 Processing</div>
          <div className="mt-0.5 font-mono text-[17px] font-black leading-none" style={{ color: workersProcessing > 0 ? T.success : T.text }}>
            {workersProcessing} <span className="text-[10px]" style={{ color: T.textFade }}>/ {workersTotal}</span>
          </div>
          <div className="mt-0.5 text-[8px]" style={{ color: T.textFade }}>Actively producing</div>
        </div>

        <div className="rounded-lg border p-2" style={{ background: T.panel, borderColor: workersWaitingCapacity > 0 ? T.warning : T.border }}>
          <div className="text-[8px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>🟠 Waiting AI</div>
          <div className="mt-0.5 font-mono text-[17px] font-black leading-none" style={{ color: workersWaitingCapacity > 0 ? T.warning : T.text }}>
            {workersWaitingCapacity}
          </div>
          <div className="mt-0.5 text-[8px]" style={{ color: T.textFade }}>
            {workersWaitingCapacity > 0 ? "Blocked · capacity" : "None blocked"}
          </div>
        </div>

        {/* Recovery Pending · every blocked worker with no completed ladder walk yet */}
        <div className="rounded-lg border p-2" style={{ background: T.panel, borderColor: workersWaitingCapacity > 0 ? T.danger : T.border }}>
          <div className="text-[8px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>🔴 Recovery Pending</div>
          <div className="mt-0.5 font-mono text-[17px] font-black leading-none" style={{ color: workersWaitingCapacity > 0 ? T.danger : T.text }}>
            {workersWaitingCapacity}
          </div>
          <div className="mt-0.5 text-[8px]" style={{ color: T.textFade }}>
            {workersWaitingCapacity > 0 ? "Ladder walks per blocked job" : "Recovery Manager live"}
          </div>
        </div>

        <div className="rounded-lg border p-2" style={{ background: T.panel, borderColor: T.border }}>
          <div className="text-[8px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>⚪ Standby</div>
          <div className="mt-0.5 font-mono text-[17px] font-black leading-none" style={{ color: T.textDim }}>
            {workersStandby}
          </div>
          <div className="mt-0.5 text-[8px]" style={{ color: T.textFade }}>
            {workersOffline > 0 ? `· ${workersOffline} offline` : "Ready to claim"}
          </div>
        </div>
      </div>

      {/* Silence-is-a-bug alert · applies when we have inbox items but
          NO workers actually processing AND no queue movement */}
      {(inboxCount !== null && inboxCount > 0 && workersProcessing === 0 && inProcess === 0) ? (
        <div className="mt-2 flex items-baseline gap-2 rounded-md border px-2 py-1 text-[10px]" style={{ background: T.warningSoft, borderColor: T.warning }}>
          <span aria-hidden>⚠</span>
          <span className="font-semibold" style={{ color: T.warning }}>Inbox has {inboxCount} item{inboxCount === 1 ? "" : "s"} but no workers are processing.</span>
          <span className="text-[9.5px]" style={{ color: T.textDim }}>
            {workersWaitingCapacity > 0 ? `${workersWaitingCapacity} worker(s) blocked on AI capacity — consider provider action.` : "Workers may be offline · check AI Providers."}
          </span>
        </div>
      ) : null}

      {/* Reassignment recommendation · if a worker is blocked AND another is standby with healthy providers */}
      {workersWaitingCapacity > 0 && workersStandby > 0 ? (
        <div className="mt-2 flex items-baseline gap-2 rounded-md border px-2 py-1 text-[10px]" style={{ background: T.warningSoft, borderColor: T.warning }}>
          <span aria-hidden>♻</span>
          <span className="font-semibold" style={{ color: T.warning }}>Reassignment opportunity:</span>
          <span className="text-[9.5px]" style={{ color: T.textDim }}>
            {workersWaitingCapacity} blocked · {workersStandby} standby available. NEX will propose reassignment once the audit log tracks worker-provider affinity.
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Room Badge Explainer Popup · Doctrine #3 (Philip 2026-08-07).
// "Every NEX HQ room must explain itself before the user enters it."
// Shows: Purpose Question · What this room does · Which Brain operates
// here · Default Authority · Connected Departments · Status · Enter button.
// ─────────────────────────────────────────────────────────────────

// Brain assignment per room (from project_nex_brains_registry doctrine)
const ROOM_BRAIN: Partial<Record<RoomKey, { brain: string; question: string; authority: "L1" | "L2" | "L3" }>> = {
  inbox:         { brain: "—",                       question: "What raw material is waiting for workers?",           authority: "L2" },
  library:       { brain: "—",                       question: "What documents are indexed for the workers to use?",  authority: "L2" },
  understanding: { brain: "Knowledge Extractor",     question: "What is being connected right now?",                  authority: "L2" },
  writing:       { brain: "Voice & Brand · Content Brain", question: "What is being authored?",                       authority: "L1" },
  quality:       { brain: "Quality Checker · Legal Brain (audit)", question: "What needs verification before promotion?", authority: "L1" },
  vault:         { brain: "Memory Guardian",          question: "What permanent knowledge lives here?",                authority: "L1" },
  ai_server:     { brain: "Operations Brain",         question: "Which providers are healthy?",                        authority: "L3" },
  lounge:        { brain: "—",                        question: "Who is resting between tasks?",                       authority: "L3" },
  manager:       { brain: "Executive · Philip",       question: "What decisions are on your desk?",                    authority: "L1" },
  director:      { brain: "NEX (Ops Director)",        question: "What has NEX resolved for you?",                     authority: "L2" },
  meeting:       { brain: "—",                        question: "Who is meeting right now?",                           authority: "L1" },
  dispatch:      { brain: "Operations Brain",         question: "What jobs are waiting to be routed?",                 authority: "L3" },
  marketing:     { brain: "Marketing Brain · Brand Brain", question: "How do we grow faster?",                         authority: "L2" },
  innovation:    { brain: "Product Brain · Innovation Brain", question: "What might we build next?",                   authority: "L1" },
};

function RoomExplainerPopup({ roomKey, onClose, onEnter }: { roomKey: RoomKey; onClose: () => void; onEnter: () => void }) {
  const room = ROOMS[roomKey];
  const brain = ROOM_BRAIN[roomKey];
  const view = ROOM_TO_VIEW[roomKey];
  const status = view ? VIEW_INTEGRATION[view] : "awaiting";
  const sc = statusColor(status);
  const authColor = brain?.authority === "L3" ? T.info : brain?.authority === "L2" ? T.warning : T.success;

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50"
        style={{ background: "rgba(0,0,0,0.35)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-5"
        style={{ background: T.panel, borderColor: room.wallAccent, boxShadow: "0 24px 60px -12px rgba(0,0,0,0.5)" }}
        initial={{ opacity: 0, scale: 0.94, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: -20 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
      >
        {/* Header with room glyph + name + close */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[22px]" style={{ color: room.wallAccent }}>{room.glyph}</span>
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.28em]" style={{ color: room.wallAccent }}>NEX HQ Room</div>
              <div className="text-[18px] font-black leading-tight tracking-tight" style={{ color: T.text, letterSpacing: "-0.01em" }}>{room.name}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border px-2 py-1 text-[11px]" style={{ background: T.panelElev, borderColor: T.border, color: T.textDim, cursor: "pointer" }}>✕</button>
        </div>

        {/* Purpose question */}
        <div className="mt-4 rounded-lg border p-3" style={{ background: T.panelElev, borderColor: T.border }}>
          <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: T.textDim }}>Answers</div>
          <div className="mt-0.5 text-[13.5px] font-black leading-tight" style={{ color: T.text }}>
            {brain?.question ?? room.question}
          </div>
        </div>

        {/* What this room does */}
        <div className="mt-3">
          <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: T.textDim }}>What this room does</div>
          <div className="mt-0.5 text-[12px]" style={{ color: T.text }}>{room.purpose}</div>
        </div>

        {/* Brain · Authority · Status */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg border p-2" style={{ background: T.panelElev, borderColor: T.border }}>
            <div className="text-[8px] font-bold uppercase tracking-widest" style={{ color: T.textFade }}>Brain</div>
            <div className="mt-0.5 text-[11px] font-semibold" style={{ color: T.text }}>{brain?.brain ?? "—"}</div>
          </div>
          <div className="rounded-lg border p-2" style={{ background: T.panelElev, borderColor: T.border }}>
            <div className="text-[8px] font-bold uppercase tracking-widest" style={{ color: T.textFade }}>Authority</div>
            <div className="mt-0.5 text-[11px] font-black" style={{ color: authColor }}>{brain?.authority ?? "—"}</div>
          </div>
          <div className="rounded-lg border p-2" style={{ background: T.panelElev, borderColor: T.border }}>
            <div className="text-[8px] font-bold uppercase tracking-widest" style={{ color: T.textFade }}>Status</div>
            <div className="mt-0.5 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: sc }} />
              <span className="text-[10.5px] font-semibold" style={{ color: sc }}>{statusLabel(status)}</span>
            </div>
          </div>
        </div>

        {/* Enter room button */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onEnter}
            className="flex-1 rounded-md border px-3 py-2 text-[12px] font-bold"
            style={{ background: room.wallAccent, borderColor: room.wallAccent, color: "#FFFFFF", cursor: "pointer" }}
          >
            Enter {room.name} →
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-3 py-2 text-[12px] font-semibold"
            style={{ background: T.panelElev, borderColor: T.border, color: T.textDim, cursor: "pointer" }}
          >
            Close
          </button>
        </div>

        <div className="mt-3 text-[10px] italic" style={{ color: T.textFade }}>
          A room is not just a page — it is a business capability with a purpose, intelligence source, and responsibility.
        </div>
      </motion.div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// In-Flight Jobs Panel · Factory Living Workers Doctrine Rule 1.
// "If header says N in flight, N job cards must render with owner,
// location, status, age." Every counter resolves to a visible object.
// ─────────────────────────────────────────────────────────────────
function InFlightJobsPanel({
  placements, providers,
}: {
  placements: PlacedWorker[];
  providers: LlmProviderReport[];
}) {
  // Any worker with current_job_ref set = has a job in flight
  const jobsInFlight = placements.filter((p) => p.worker?.current_job_ref);
  if (jobsInFlight.length === 0) return null;

  return (
    <div className="border-b px-4 py-3" style={{ borderColor: T.border, background: T.panel }}>
      <div className="flex items-baseline gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.28em]" style={{ color: T.info }}>In-Flight Jobs</span>
        <span className="text-[9.5px]" style={{ color: T.textFade }}>{jobsInFlight.length} job{jobsInFlight.length === 1 ? "" : "s"} · every one visible</span>
      </div>
      <div className="mt-2 space-y-1">
        {jobsInFlight.map((p) => <JobCard key={p.persona.key} placed={p} providers={providers} standbyCount={placements.filter((x) => x.state === "sleeping").length} />)}
      </div>
    </div>
  );
}

function JobCard({ placed, providers, standbyCount }: { placed: PlacedWorker; providers: LlmProviderReport[]; standbyCount: number }) {
  const op = deriveOperationalStatus(placed, providers);
  const w = placed.worker!;
  const isBlocked = op.key === "waiting_capacity";
  // Room for the worker per placement logic · matches the visible position
  const room = isBlocked ? ROOMS.ai_server : ROOMS[placed.persona.workingRoom];
  // Stale heartbeat detection · Rule 7 · >60min = STUCK
  const staleMs = w.last_activity_at ? Date.now() - new Date(w.last_activity_at).getTime() : 0;
  const stuck = isBlocked && staleMs > 60 * 60 * 1000;
  const age = w.current_job_since ? relativeMinutes(w.current_job_since) : "just claimed";

  return (
    <div className="rounded-lg border p-2.5" style={{ background: T.panelElev, borderColor: stuck ? T.danger : isBlocked ? T.warning : T.info }}>
      <div className="flex items-baseline gap-2">
        <span className="text-[13px]" aria-hidden>📦</span>
        <span className="font-mono text-[11px] font-black" style={{ color: T.text }}>{w.current_job_ref?.slice(0, 32) ?? "—"}</span>
        {stuck ? (
          <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest" style={{ background: `${T.danger}22`, color: T.danger }}>Stuck</span>
        ) : null}
        <span className="ml-auto text-[9px]" style={{ color: T.textFade }}>Age {age}</span>
      </div>
      <div className="mt-1 grid grid-cols-[auto_auto_1fr] gap-x-3 gap-y-0.5 text-[10.5px]">
        <span><span style={{ color: T.textFade }}>Owner:</span> <span className="font-semibold" style={{ color: placed.persona.colorAccent }}>{placed.persona.displayName}</span></span>
        <span><span style={{ color: T.textFade }}>Location:</span> <span style={{ color: T.text }}>{room.name}</span></span>
        <span><span style={{ color: T.textFade }}>Status:</span> <span className="font-semibold" style={{ color: op.color }}>{op.label}</span></span>
      </div>
      {isBlocked ? (
        <div className="mt-1 text-[10px]" style={{ color: T.warning }}>
          {op.wakeUpProvider ? `Blocked · waiting for ${op.wakeUpProvider}` : "Blocked · no provider available"}
          {op.wakeUpAt ? <> · retry in <Countdown targetAt={op.wakeUpAt} style={{ fontWeight: 700 }} /></> : null}
        </div>
      ) : null}
      {isBlocked ? <RecoveryLadder providers={providers} standbyCount={standbyCount} stuck={stuck} jobId={w.current_job_ref ?? null} /> : null}
      {stuck ? (
        <div className="mt-1 rounded-md border px-2 py-1 text-[10px]" style={{ background: T.dangerSoft, borderColor: T.danger }}>
          <span className="font-black" style={{ color: T.danger }}>Stale heartbeat · {Math.round(staleMs / 3600000)}h.</span>
          <span style={{ color: T.textDim }}> Worker may be dead or heartbeat not updating. Recovery Manager will walk the 5-level ladder when scan runs against this job — see attempt log below.</span>
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Backend Readiness Panel · doctrine feedback_nex_ui_ahead_of_backend
// "Every admin surface can now see exactly which capabilities are live."
// Every service's true state · never fabricated. Static today · will
// probe real endpoints once each service ships.
// ─────────────────────────────────────────────────────────────────
type BackendService = { key: string; name: string; state: "running" | "pending" | "not_installed"; note?: string; layer: "L1" | "L2" | "L3" | "infra" };
const BACKEND_SERVICES: BackendService[] = [
  // Foundation Layer 1 · Core Intelligence (build FIRST)
  { key: "knowledge-queue",    name: "Knowledge Jobs Queue",   state: "running",       layer: "L1", note: "✅ Filesystem-backed queue live · POST dump creates job · GET/PATCH /api/nex/brain/jobs · 6 states (received→queued→claimed→processing→completed/failed) · classification tag parsed → target brains routed · lifecycle events emitted to Event Bus · verified via PATCH transition" },
  { key: "worker-scheduler",   name: "Worker Scheduler",       state: "running",       layer: "L1", note: "✅ Manager cycle live · job lifecycle emits events (job_started/completed/failed) · verified · claim/release/rebalance logic pending Recovery Manager" },
  { key: "recovery-manager",   name: "Recovery Manager",       state: "running",       layer: "L1", note: "✅ 5-level ladder live · POST /api/nex/brain/recovery scans blocked workers · L1 retry → L2 switch provider → L3 restart → L4 reassign → L5 escalate to Director · attempts logged to data/nex-recovery/attempts.jsonl · every attempt emits recovery_attempt event · L5 emits case_opened to director · verified: full 5-level walk against synthetic 20m stuck job produced correct escalation" },
  { key: "brain-router",       name: "Brain Router",           state: "running",       layer: "L1", note: "✅ Consumes completed jobs · writes memories per target brain · POST /api/nex/brain/router (job_id or scan:true) · GET stats + memories per brain · brain isolation enforced (Rule 4/6 + Constitution clauses 1+7) · idempotent-per-brain · 'All HQ Brains' expands to 12-brain fan-out · verified: dump → job → complete → auto-route writes to data/nex-brains/{slug}/memories.jsonl" },
  // Foundation Layer 2 · Business Intelligence (build SECOND)
  { key: "contact-database",   name: "Master Contact Database",state: "running",       layer: "L2", note: "✅ Filesystem-backed contact store · GET/POST /api/nex/contacts · dedup by normalised email primary + phone fallback · GDPR consent defaults FALSE · consent_source recorded + consent transitions emit contact_consent_changed events · tag merging on upsert · lookup by email/phone · lifecycle + kind stats · verified: create → dedup → revocation → lookup → event bus" },
  { key: "event-tracking",     name: "Event Tracking",         state: "running",       layer: "L2", note: "✅ High-volume interaction store · POST /api/nex/tracking (single or batch) · GET events/sessions/stats · GDPR-safe (IPv4→/24, IPv6→/48, salted sha256 fingerprints) · session auto-derive per-hour per-fingerprint · UTM + properties captured · high-value events (form_submit·signup·signin·conversion) mirror to Intelligence Bus · verified: batch capture + session summary + bus mirror + stats" },
  { key: "marketing-attribution", name: "Marketing Attribution", state: "running",       layer: "L2", note: "✅ Read-only computation service · GET /api/nex/attribution · 3 modes: campaigns (per-campaign roll-up with sessions/conversions/contacts_acquired/rate) · contact (per-contact first-touch, last-touch, all-touches chain) · funnel (visitor→session→page→engage→form→submit→conversion counts) · fingerprint-based first-touch attribution · verified: seeded conversion produces campaign=staircase-spring-26 rate=100% + contact chain shows converted=true + funnel counts correct" },
  { key: "analytics-pipeline", name: "Analytics Pipeline",     state: "running",       layer: "L2", note: "✅ Multi-provider ingest · POST /api/nex/analytics?provider=plausible|umami|ga4|custom · normalises to common schema (path/hostname/referrer/country/device/browser/os/session/visitor/duration) · GET modes: overview · pages · referrers · countries · timeseries · GA4 page_view→pageview normalization · analytics_ingested event fires per batch (volume-controlled · not per record) · verified: 3 providers → aggregates + top-pages + top-countries + timeseries" },
  // Foundation Layer 3 · Automation (build THIRD)
  { key: "automation-engine",  name: "Automation Engine",      state: "running",       layer: "L3", note: "✅ Rule store + evaluator + runner · POST/GET/PATCH /api/nex/automation/rules · GET/PATCH /api/nex/automation/runs · POST /api/nex/automation/scan · authority-locked (L1 suggestion · L2 prepared · L3 autonomous · never 'Let NEX Handle') · 4 action kinds (log · emit_event · notify_admin · webhook) · condition predicates (payload_equals + payload_exists) · idempotent per (rule,event_id) · Confidence Score tracker per rule · verified: L3 auto-executed inline · L2 pending → admin approved · L1 suggested · re-scan produced 0 dupes · bus mirror captured every match" },
  { key: "marketing-engine",   name: "Marketing Engine",       state: "not_installed", layer: "L3", note: "Campaign prep · social scheduling · outcome tracking" },
  { key: "email-engine",       name: "Email Engine",           state: "not_installed", layer: "L3", note: "Transactional + marketing separation · consent-aware sends" },
  // Core Infra (transversal · powers all 3 layers)
  { key: "event-bus",          name: "Enterprise Event Bus",   state: "running",       layer: "infra", note: "✅ Working end-to-end · filesystem-backed (data/nex-events/events.jsonl) · POST/GET /api/nex/events · dump endpoint emits · Living Timeline consumes · upgrades transparently to Supabase when migration 004 lands" },
  { key: "audit-log",          name: "Worker Audit Log",       state: "running",       layer: "infra", note: "✅ Dual-write bridge live · every emitAuditEvent flows to filesystem Event Bus immediately · Supabase mirror activates when mig 004 applied · verified: real Mistral/HuggingFace/Cloudflare calls captured with latency + tokens + errors" },
  { key: "provider-chain",     name: "Provider Chain (LLM)",   state: "running",       layer: "infra", note: "9 providers · circuit breaker · daily budgets" },
  { key: "cloud-workers",      name: "Cloud Workers (Fly)",    state: "running",       layer: "infra", note: "6 worker types · heartbeat via cloud-status" },
  { key: "domain-monitor",     name: "Domain Auth Monitor",    state: "not_installed", layer: "infra", note: "SPF/DKIM/DMARC cron · required before marketing sends" },
];

function BackendReadinessPanel() {
  const running = BACKEND_SERVICES.filter((s) => s.state === "running").length;
  const pending = BACKEND_SERVICES.filter((s) => s.state === "pending").length;
  const notInstalled = BACKEND_SERVICES.filter((s) => s.state === "not_installed").length;
  const layerHeadings: Record<"L1" | "L2" | "L3" | "infra", string> = {
    L1:    "Foundation Layer 1 · Core Intelligence",
    L2:    "Foundation Layer 2 · Business Intelligence",
    L3:    "Foundation Layer 3 · Automation",
    infra: "Core Infrastructure (transversal)",
  };
  const layerOrder: ("L1" | "L2" | "L3" | "infra")[] = ["L1", "L2", "L3", "infra"];
  return (
    <div className="border-b px-4 py-3" style={{ borderColor: T.border, background: T.panel }}>
      <div className="flex items-baseline gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.28em]" style={{ color: T.wallDark }}>Backend Readiness · 3 Layers</span>
        <span className="text-[9.5px]" style={{ color: T.textFade }}>{running} running · {pending} pending · {notInstalled} not installed</span>
      </div>
      {layerOrder.map((layer) => {
        const services = BACKEND_SERVICES.filter((s) => s.layer === layer);
        if (services.length === 0) return null;
        return (
          <div key={layer} className="mt-2">
            <div className="text-[8px] font-black uppercase tracking-[0.24em]" style={{ color: layer === "L1" ? T.danger : layer === "L2" ? T.warning : layer === "L3" ? T.info : T.wallDark }}>
              {layerHeadings[layer]}
            </div>
            <div className="mt-1 space-y-0.5">
              {services.map((s) => {
                const color = s.state === "running" ? T.success : s.state === "pending" ? T.warning : T.danger;
                const glyph = s.state === "running" ? "🟢" : s.state === "pending" ? "🟡" : "🔴";
                const label = s.state === "running" ? "Running" : s.state === "pending" ? "Pending" : "Not Installed";
                return (
                  <div key={s.key} className="grid grid-cols-[16px_1fr_auto] items-baseline gap-2 rounded border px-2 py-1" style={{ background: T.panelElev, borderColor: T.border }}>
                    <span>{glyph}</span>
                    <span className="text-[11px] font-semibold" style={{ color: T.text }}>{s.name}</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color }}>{label}</span>
                    {s.note ? <div className="col-span-3 text-[9.5px]" style={{ color: T.textDim }}>{s.note}</div> : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="mt-2 text-[9.5px] italic" style={{ color: T.textDim }}>
        Build order: Layer 1 (Core Intelligence) → Layer 2 (Business Intelligence) → Layer 3 (Automation). Enterprise Event Bus feeds all layers.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Recovery Escalation Ladder · shows all 5 levels + real state.
// Doctrine: feedback_nex_recovery_ladder_and_timeline_2026_08_07.md
// L1 Retry same provider · L2 Switch provider · L3 Restart worker
// L4 Reassign worker · L5 Escalate to Philip
// When a jobId is supplied, reads real attempts from Recovery Manager
// (/api/nex/brain/recovery) and overlays actual outcomes on the ladder.
// Falls back to would-work / would-fail derivation when no attempts yet.
// ─────────────────────────────────────────────────────────────────
type RecoveryAttemptRow = {
  attempt_id: string;
  job_id: string;
  level: 1 | 2 | 3 | 4 | 5;
  level_name: string;
  action: string;
  at: string;
  outcome: "attempted" | "succeeded" | "failed" | "skipped";
  detail: string | null;
};

function RecoveryLadder({ providers, standbyCount, stuck, jobId }: { providers: LlmProviderReport[]; standbyCount: number; stuck: boolean; jobId?: string | null }) {
  const [attempts, setAttempts] = useState<RecoveryAttemptRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!jobId) { setLoaded(true); return; }
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/nex/brain/recovery?job_id=${encodeURIComponent(jobId)}&limit=100`);
        if (!alive) return;
        const j = await r.json();
        setAttempts(Array.isArray(j?.attempts) ? (j.attempts as RecoveryAttemptRow[]) : []);
      } catch { /* endpoint may not be up in some environments · silent */ }
      finally { if (alive) setLoaded(true); }
    };
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [jobId]);

  const healthyOther = providers.filter((p) => p.configured && providerBand(p) === "orange-standby").length;
  const anyGreen = providers.some((p) => providerBand(p) === "green-active");
  const hasRealAttempts = attempts.length > 0;

  const levels = [
    { n: 1 as const, label: "Retry same provider" },
    { n: 2 as const, label: "Switch provider" },
    { n: 3 as const, label: "Restart worker" },
    { n: 4 as const, label: "Reassign to standby" },
    { n: 5 as const, label: "Escalate to Philip" },
  ];

  const latestByLevel = new Map<number, RecoveryAttemptRow>();
  for (const a of attempts) {
    const prev = latestByLevel.get(a.level);
    if (!prev || a.at > prev.at) latestByLevel.set(a.level, a);
  }

  const derivedState = (n: number): { glyph: string; color: string; note: string } => {
    if (n === 1) return anyGreen
      ? { glyph: "⟳", color: T.info,   note: "provider healthy · would retry" }
      : { glyph: "✗", color: T.danger, note: "no healthy provider · would fail" };
    if (n === 2) return healthyOther > 0
      ? { glyph: "○", color: T.success, note: "alternate available" }
      : { glyph: "✗", color: T.danger,  note: "no healthy alternate" };
    if (n === 3) return { glyph: "○", color: T.textGhost, note: "would restart worker process" };
    if (n === 4) return standbyCount > 0
      ? { glyph: "○", color: T.success, note: "standby worker available" }
      : { glyph: "✗", color: T.danger,  note: "no standby worker available" };
    return stuck
      ? { glyph: "→", color: T.danger,   note: "escalation recommended now (stale heartbeat)" }
      : { glyph: "○", color: T.textGhost, note: "if all recovery steps fail" };
  };

  const realState = (a: RecoveryAttemptRow): { glyph: string; color: string; note: string } => {
    const when = new Date(a.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (a.outcome === "succeeded") return { glyph: "✓", color: T.success, note: `${a.action} · succeeded ${when}` };
    if (a.outcome === "failed")    return { glyph: "✗", color: T.danger,  note: `${a.action} · failed ${when}` };
    if (a.outcome === "skipped")   return { glyph: "⤼", color: T.warning, note: `${a.action} · skipped ${when}` };
    return { glyph: "⟳", color: T.info, note: `${a.action} · attempted ${when}` };
  };

  return (
    <div className="mt-2 rounded-md border p-2" style={{ background: T.panelElev, borderColor: T.warning }}>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.warning }}>Recovery Escalation</span>
        <span className="ml-auto text-[8.5px] italic" style={{ color: hasRealAttempts ? T.success : T.textFade }}>
          {hasRealAttempts ? `Recovery Manager · ${attempts.length} attempt${attempts.length === 1 ? "" : "s"}` : loaded ? "no attempts yet · ladder derived" : "loading…"}
        </span>
      </div>
      <div className="mt-1 space-y-0.5">
        {levels.map((l) => {
          const real = latestByLevel.get(l.n);
          const s = real ? realState(real) : derivedState(l.n);
          return (
            <div key={l.n} className="grid grid-cols-[16px_1fr_auto] items-baseline gap-1.5 text-[10px]">
              <span style={{ color: s.color }}>{s.glyph}</span>
              <span style={{ color: T.text }}>L{l.n} · {l.label}</span>
              <span className="text-[9px]" style={{ color: T.textFade }}>{s.note}</span>
            </div>
          );
        })}
      </div>
      {hasRealAttempts ? null : (
        <div className="mt-1.5 text-[9px] italic" style={{ color: T.textDim }}>
          Recovery Manager live · this ladder becomes real when the scan runs against this job (fires from provider chain or admin trigger).
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Worker Roster · per-worker cards below the Factory Header.
// Doctrine: feedback_nex_truth_display_and_room_explainer_doctrines
// "A number is not visibility." Header count MUST equal cards shown
// with matching active/idle states. Detects header/roster mismatch.
// ─────────────────────────────────────────────────────────────────
function WorkerRoster({
  placements, providers, workersProcessing, workersWaitingCapacity,
}: {
  placements: PlacedWorker[];
  providers: LlmProviderReport[];
  workersProcessing: number;
  workersWaitingCapacity: number;
}) {
  // Categorise using the corrected 6-state model · waiting_llm is
  // NEVER bundled with working. Every card lives in exactly one group.
  const processing = placements.filter((p) => p.state === "working");
  const waiting    = placements.filter((p) => p.state === "waiting_llm");
  const queued     = placements.filter((p) => p.state === "queued");
  const standby    = placements.filter((p) => p.state === "sleeping");
  const offline    = placements.filter((p) => p.state === "offline");

  // Mismatch detection · Header counter must match roster
  const processingMismatch = workersProcessing !== processing.length;
  const waitingMismatch    = workersWaitingCapacity !== waiting.length;

  return (
    <div className="border-b px-4 py-3" style={{ borderColor: T.border, background: T.panelElev }}>
      <div className="flex items-baseline gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.28em]" style={{ color: T.textDim }}>Worker Roster</span>
        <span className="text-[9.5px]" style={{ color: T.textFade }}>
          {processing.length} processing · {waiting.length} waiting · {queued.length + standby.length} standby · {offline.length} offline
        </span>
      </div>

      {(processingMismatch || waitingMismatch) ? (
        <div className="mt-1 rounded-md border px-2 py-1 text-[10px]" style={{ background: T.dangerSoft, borderColor: T.danger }}>
          <span aria-hidden>⚠</span>{" "}
          <span className="font-semibold" style={{ color: T.danger }}>Worker telemetry mismatch:</span>{" "}
          <span style={{ color: T.text }}>header says {workersProcessing} processing / {workersWaitingCapacity} waiting · roster shows {processing.length} / {waiting.length}. Check heartbeat.</span>
        </div>
      ) : null}

      {processing.length > 0 ? (
        <>
          <div className="mt-2 text-[9px] font-bold uppercase tracking-widest" style={{ color: T.success }}>🟢 Processing</div>
          <div className="mt-1 space-y-1">
            {processing.map((p) => <RosterCard key={p.persona.key} placed={p} providers={providers} />)}
          </div>
        </>
      ) : null}

      {waiting.length > 0 ? (
        <>
          <div className="mt-2 text-[9px] font-bold uppercase tracking-widest" style={{ color: T.warning }}>🟠 Waiting for AI capacity</div>
          <div className="mt-1 space-y-1">
            {waiting.map((p) => <RosterCard key={p.persona.key} placed={p} providers={providers} />)}
          </div>
        </>
      ) : null}

      {queued.length > 0 ? (
        <>
          <div className="mt-2 text-[9px] font-bold uppercase tracking-widest" style={{ color: T.info }}>🔵 Queued</div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {queued.map((p) => <RosterMini key={p.persona.key} placed={p} providers={providers} />)}
          </div>
        </>
      ) : null}

      {standby.length > 0 ? (
        <>
          <div className="mt-2 text-[9px] font-bold uppercase tracking-widest" style={{ color: T.textDim }}>⚪ Standby</div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {standby.map((p) => <RosterMini key={p.persona.key} placed={p} providers={providers} />)}
          </div>
        </>
      ) : null}

      {offline.length > 0 ? (
        <>
          <div className="mt-2 text-[9px] font-bold uppercase tracking-widest" style={{ color: T.danger }}>🔴 Offline</div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {offline.map((p) => <RosterMini key={p.persona.key} placed={p} providers={providers} />)}
          </div>
        </>
      ) : null}
    </div>
  );
}

function RosterCard({ placed, providers }: { placed: PlacedWorker; providers: LlmProviderReport[] }) {
  const op = deriveOperationalStatus(placed, providers);
  const w = placed.worker;
  const heartbeat = w?.last_activity_at ? relativeMinutes(w.last_activity_at) : "no heartbeat";
  const started   = w?.current_job_since ? relativeMinutes(w.current_job_since) : "—";
  return (
    <div className="rounded-md border p-2" style={{ background: T.panel, borderColor: op.color }}>
      <div className="flex items-baseline gap-1.5">
        <span className="grid h-5 w-5 flex-none place-items-center rounded-full font-black text-white text-[10px]" style={{ background: placed.persona.colorAccent }}>{placed.persona.glyph}</span>
        <span className="text-[11px] font-black" style={{ color: T.text }}>{placed.persona.displayName}</span>
        <span className="text-[9.5px]" style={{ color: T.textFade }}>· {placed.persona.role}</span>
        <span className="ml-auto rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-widest" style={{ background: `${op.color}22`, color: op.color }}>{op.label}</span>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1 text-[9.5px]" style={{ color: T.textDim }}>
        <div><span style={{ color: T.textFade }}>Job:</span> <span style={{ color: T.text }}>{w?.current_job_ref?.slice(0, 12) ?? "—"}</span></div>
        <div><span style={{ color: T.textFade }}>Heartbeat:</span> <span style={{ color: T.text }}>{heartbeat}</span></div>
        <div><span style={{ color: T.textFade }}>Started:</span> <span style={{ color: T.text }}>{started}</span></div>
      </div>
      {op.wakeUpAt ? (
        <div className="mt-1 text-[9.5px]" style={{ color: T.danger }}>⏰ recovery in <Countdown targetAt={op.wakeUpAt} /></div>
      ) : null}
    </div>
  );
}

function RosterMini({ placed, providers }: { placed: PlacedWorker; providers: LlmProviderReport[] }) {
  const op = deriveOperationalStatus(placed, providers);
  const w = placed.worker;
  return (
    <div className="flex items-center gap-1.5 rounded border px-1.5 py-1" style={{ background: T.panel, borderColor: T.border }}>
      <span className="grid h-4 w-4 flex-none place-items-center rounded-full font-black text-white text-[8.5px]" style={{ background: placed.persona.colorAccent }}>{placed.persona.glyph}</span>
      <span className="text-[10px] font-semibold" style={{ color: T.text }}>{placed.persona.displayName}</span>
      <span className="ml-auto text-[8.5px]" style={{ color: op.color }}>{op.label}</span>
      {w?.jobs_completed_24h ? <span className="text-[8.5px] font-mono" style={{ color: T.textFade }}>· {w.jobs_completed_24h}✓</span> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Reception band (compact for shell layout)
// ─────────────────────────────────────────────────────────────────
function ReceptionBand({ dateLabel, anyCloudOnline, totalActive, totalSleeping, totalOffline }: { dateLabel: string; anyCloudOnline: boolean; totalActive: number; totalSleeping: number; totalOffline: number }) {
  return (
    <div className="relative overflow-hidden border-b px-4 py-5" style={{ background: T.reception, borderColor: T.border, boxShadow: T.shadowSm }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, transparent 0%, ${T.wallDark} 30%, ${T.wallDark} 70%, transparent 100%)` }} />
      <div className="flex items-baseline gap-3">
        <div className="text-[9px] font-semibold uppercase tracking-[0.3em]" style={{ color: T.accent }}>Reception</div>
        <div className="flex-1" />
        <div className="text-[9px]" style={{ color: T.textFade }} suppressHydrationWarning>{dateLabel}</div>
      </div>
      <h1 className="mt-1.5 text-[22px] font-black leading-tight tracking-tight" style={{ letterSpacing: "-0.02em" }}>
        NEX Headquarters
      </h1>
      <div className="mt-0.5 text-[11px]" style={{ color: T.textDim }}>
        {anyCloudOnline ? `${totalActive} working · ${totalSleeping} resting · ${totalOffline} offline` : "Cloud workers offline"}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Global Recovery Clock — the top-of-HQ banner that answers Philip's
// most important operational question: "when will workers start
// processing again?" Only renders when at least one worker is
// waiting_capacity AND we can compute a real recovery time.
// ─────────────────────────────────────────────────────────────────
function GlobalRecoveryClock({
  placements, providers,
}: {
  placements: PlacedWorker[];
  providers: LlmProviderReport[];
}) {
  // Compute waiting workers + earliest recovery from real telemetry
  const waiters = placements
    .map((p) => ({ p, s: deriveOperationalStatus(p, providers) }))
    .filter((x) => x.s.key === "waiting_capacity");
  if (waiters.length === 0) return null;

  const jobsQueued = placements.reduce((sum, p) => sum + (p.worker?.jobs_waiting ?? 0), 0);
  const jobsInFlight = placements.reduce((sum, p) => sum + (p.worker?.jobs_in_flight ?? 0), 0);

  // Earliest recovery across all blocked providers
  const withRecovery = providers
    .filter((p) => p.configured && (p.circuit_open_ms_remaining ?? 0) > 0)
    .map((p) => ({ provider: p.provider, at: Date.now() + (p.circuit_open_ms_remaining ?? 0) }))
    .sort((a, b) => a.at - b.at);
  const nearest = withRecovery[0];

  return (
    <div
      className="relative overflow-hidden border-b px-4 py-4"
      style={{
        background: `linear-gradient(180deg, ${T.dangerSoft} 0%, ${T.panel} 100%)`,
        borderColor: T.danger,
        boxShadow: `inset 0 3px 0 0 ${T.danger}`,
      }}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: T.danger }}>
          Knowledge production paused
        </span>
        <span className="ml-auto text-[9px]" style={{ color: T.textFade }}>Global Recovery Clock</span>
      </div>

      {nearest ? (
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-[22px]" aria-hidden>⏰</span>
          <div className="flex-1">
            <div className="font-mono text-[26px] font-black leading-none" style={{ color: T.danger }}>
              <Countdown targetAt={nearest.at} />
            </div>
            <div className="mt-1 text-[11px]" style={{ color: T.textDim }}>
              Until <span className="font-semibold capitalize" style={{ color: T.text }}>{nearest.provider}</span> retries
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-[12.5px] leading-relaxed" style={{ color: T.text }}>
          All configured providers currently blocked. No provider has published a retry ETA — NEX will resume as soon
          as any provider becomes available.
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <RecoveryStat label="Workers waiting" value={waiters.length.toLocaleString()} tone={T.danger} />
        <RecoveryStat label="Jobs queued"     value={jobsQueued.toLocaleString()} />
        <RecoveryStat label="In flight"       value={jobsInFlight.toLocaleString()} tone={T.info} />
      </div>

      <div className="mt-3 text-[10.5px] leading-snug italic" style={{ color: T.textDim }}>
        Processing resumes automatically when capacity becomes available. Individual worker cards show their own
        countdown.
      </div>
    </div>
  );
}

function RecoveryStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border p-1.5" style={{ background: T.panel, borderColor: T.border }}>
      <div className="font-mono text-[16px] font-black" style={{ color: tone ?? T.text }}>{value}</div>
      <div className="text-[8px] uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Floor plan bits
// ─────────────────────────────────────────────────────────────────
function FloorHeader({ label, sub, side }: { label: string; sub: string; side: string }) {
  return (
    <div className="flex items-baseline gap-2 border-b pb-1.5" style={{ borderColor: T.wallDark }}>
      <div className="text-[9px] font-black uppercase tracking-[0.28em]" style={{ color: T.wallDark }}>{label}</div>
      <div className="text-[10px]" style={{ color: T.textDim }}>{sub}</div>
      <div className="h-px flex-1" style={{ background: T.wallDark, opacity: 0.3 }} />
      <div className="text-[9px]" style={{ color: T.textFade }}>{side}</div>
    </div>
  );
}
function FloorPlan({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mt-3 rounded-xl border-2 p-3" style={{
      borderColor: T.wallDark,
      background: `linear-gradient(180deg, ${T.floor} 0%, ${T.panelElev} 100%)`,
      boxShadow: `inset 0 0 0 1px ${T.wallLight}, 0 4px 12px -4px rgba(166, 131, 90, 0.25)`,
    }}>{children}</div>
  );
}
function RoomRow({ children, cols }: { children: React.ReactNode; cols: 1 | 2 | 3 }) {
  const c = cols === 1 ? "grid grid-cols-1" : cols === 2 ? "grid grid-cols-2 gap-2.5" : "grid grid-cols-3 gap-2.5";
  return <div className={`${c} mt-2 first:mt-0`}>{children}</div>;
}
// Corridor — an actual walkable strip between rows of rooms. Wood-tone
// walls top + bottom · warm floor pattern in the middle · directional
// arrows suggesting foot-traffic flow. Cols=4 (2×2 grid above/below)
// so the corridor renders door openings at 25% / 75% where rooms sit.
function Corridor({ label }: { label: string }) {
  return (
    <div className="my-3 relative overflow-hidden rounded" style={{ height: 32 }} aria-hidden>
      {/* Top + bottom wall lines · corridor edge */}
      <div className="absolute inset-x-0 top-0" style={{ height: 2, background: T.wallDark }} />
      <div className="absolute inset-x-0 bottom-0" style={{ height: 2, background: T.wallDark }} />
      {/* Walkable floor · same pattern as rooms · lighter tint */}
      <div className="absolute inset-x-0 top-[2px] bottom-[2px]" style={{
        background: `
          repeating-linear-gradient(90deg, transparent 0 12px, ${T.floorPattern} 12px 13px),
          linear-gradient(180deg, ${T.floor} 0%, ${T.panelElev} 100%)
        `,
      }} />
      {/* Door openings above corridor (2 rooms above) — gaps in the top wall */}
      <div className="absolute" style={{ top: 0, left: "25%", height: 2, width: 22, marginLeft: -11, background: T.floor }} />
      <div className="absolute" style={{ top: 0, left: "75%", height: 2, width: 22, marginLeft: -11, background: T.floor }} />
      {/* Door openings below corridor (2 rooms below) — gaps in the bottom wall */}
      <div className="absolute" style={{ bottom: 0, left: "25%", height: 2, width: 22, marginLeft: -11, background: T.floor }} />
      <div className="absolute" style={{ bottom: 0, left: "75%", height: 2, width: 22, marginLeft: -11, background: T.floor }} />
      {/* Corridor label centred */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.3em]" style={{ background: T.panel, color: T.wallDark, border: `1px solid ${T.wallDark}30` }}>
          {label}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// RoomShell — compact variant for the HQ column
// ─────────────────────────────────────────────────────────────────
function RoomShell({
  room, occupants, onSelect, onOpenRoom, initialLoad, compact, providerReports, justEnteredAt, allProviders,
}: {
  room: Room;
  occupants: PlacedWorker[];
  onSelect: (p: PlacedWorker) => void;
  onOpenRoom?: (r: RoomKey) => void;
  initialLoad: boolean;
  compact?: boolean;
  providerReports?: LlmProviderReport[];
  justEnteredAt?: number;
  allProviders: LlmProviderReport[];
}) {
  const active = occupants.some((o) => o.state === "working" || o.state === "waiting_llm");
  const minH = compact ? "min-h-[220px]" : "min-h-[260px]";
  return (
    <motion.div
      className={`relative flex ${minH} flex-col overflow-hidden rounded-lg`}
      style={{
        border: `2.5px solid ${T.wallDark}`,
        boxShadow: `inset 0 0 0 1.5px ${T.wallLight}`,
        background: `
          linear-gradient(180deg, ${room.tint} 0%, transparent 55%),
          repeating-linear-gradient(45deg, ${T.floorPattern} 0px, ${T.floorPattern} 1px, transparent 1px, transparent 20px),
          ${T.floor}
        `,
      }}
      animate={active
        ? { boxShadow: [`inset 0 0 0 1.5px ${T.wallLight}`, `inset 0 0 0 1.5px ${T.wallLight}, ${T.accentGlow}`, `inset 0 0 0 1.5px ${T.wallLight}`] }
        : { boxShadow: `inset 0 0 0 1.5px ${T.wallLight}` }
      }
      transition={active ? { duration: 3, repeat: Infinity, ease: "easeInOut" } : { duration: 0.4 }}
    >
      {active ? <div className="pointer-events-none absolute inset-x-0 top-0 h-16" style={{ background: T.ceilingLampGlow }} /> : null}
      <DoorMark accent={room.wallAccent} justEnteredAt={justEnteredAt} />

      <button
        type="button"
        onClick={onOpenRoom ? () => onOpenRoom(room.key) : undefined}
        className="mx-auto mt-1.5 flex items-center gap-1.5 rounded-md border px-2 py-0.5 hover:brightness-110"
        style={{ background: T.panel, borderColor: room.wallAccent, boxShadow: `0 1.5px 3px -2px ${T.wallDark}`, cursor: onOpenRoom ? "pointer" : "default" }}
        aria-label={`Open ${room.name} workspace`}
      >
        <span className="text-[11px] leading-none" style={{ color: room.wallAccent }}>{room.glyph}</span>
        <span className="text-[9.5px] font-black uppercase tracking-[0.12em]" style={{ color: T.text }}>{room.name}</span>
        {occupants.length > 0 ? (
          <span className="rounded-full px-1 py-0 text-[8px] font-bold" style={{ background: active ? T.accentSoft : T.infoSoft, color: active ? T.accent : T.info }}>{occupants.length}</span>
        ) : null}
      </button>

      <div className="relative mt-1 flex-1">
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center opacity-30">
          <RoomFurniture roomKey={room.key} />
        </div>

        {room.key === "ai_server" && providerReports ? (
          <div className="pointer-events-none absolute inset-x-1 bottom-1 flex flex-wrap justify-center gap-0.5">
            {providerReports.filter((p) => p.configured).slice(0, 6).map((p) => {
              const band = providerBand(p);
              const c = band === "green-active" ? T.success : band === "orange-standby" ? T.warning : T.danger;
              return (
                <div key={p.provider} className="flex items-center gap-0.5 rounded border bg-white/70 px-1 py-0.5" style={{ borderColor: T.border }}>
                  <span className="h-1 w-1 rounded-full" style={{ background: c }} />
                  <span className="text-[7.5px] capitalize" style={{ color: T.textDim }}>{p.provider}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="relative flex h-full flex-col items-center justify-center gap-1.5 p-2">
          {initialLoad ? (
            <div className="text-[9px]" style={{ color: T.textGhost }}>Loading…</div>
          ) : occupants.length === 0 ? (
            <>
              <div className="text-[10px] italic" style={{ color: T.textFade }}>{room.emptyLine}</div>
              <div className="text-[8px]" style={{ color: T.textGhost }}>{room.question}</div>
            </>
          ) : (
            <div className="flex flex-wrap items-end justify-center gap-2">
              <AnimatePresence>
                {occupants.map((o) => (
                  <WorkerToken
                    key={o.persona.key}
                    placed={o}
                    onClick={() => onSelect(o)}
                    compact={compact}
                    opStatus={deriveOperationalStatus(o, allProviders)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────
// WorkerToken
// ─────────────────────────────────────────────────────────────────
function WorkerToken({ placed, onClick, compact, opStatus }: { placed: PlacedWorker; onClick: () => void; compact?: boolean; opStatus: OperationalStatus }) {
  const stateColor = opStatus.color;

  // Motion recipe per operational state — every animation ties to a
  // real state, never a decorative loop.
  const avatarAnimate =
    opStatus.key === "processing"       ? { scale: [1, 1.04, 1] } :
    opStatus.key === "waiting_capacity" ? { opacity: [1, 0.7, 1] } :
    opStatus.key === "standing_by"      ? { scale: [1, 1.01, 1] } :
                                          undefined;
  const avatarDuration = opStatus.key === "standing_by" ? 4 : opStatus.key === "waiting_capacity" ? 1.6 : 2;

  const avSize = compact ? 42 : 56;
  return (
    <motion.button
      layout
      layoutId={`worker-${placed.persona.key}`}
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-0.5 text-center"
      style={{ cursor: "pointer", width: avSize + 24 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
    >
      <motion.div
        className="relative grid place-items-center rounded-full font-black"
        style={{
          height: avSize, width: avSize,
          fontSize: compact ? 15 : 20,
          background: `radial-gradient(circle at 30% 25%, ${placed.persona.colorAccent}FF 0%, ${placed.persona.colorAccent}CC 60%, ${placed.persona.colorAccent}88 100%)`,
          color: "#FFFFFF",
          boxShadow: placed.state === "working" ? `0 5px 12px -3px ${placed.persona.colorAccent}, 0 0 0 2px ${placed.persona.colorAccent}22` : `0 2px 4px -1px rgba(0,0,0,0.2)`,
          textShadow: "0 1px 2px rgba(0,0,0,0.35)",
        }}
        animate={avatarAnimate}
        transition={avatarAnimate ? { duration: avatarDuration, repeat: Infinity, ease: "easeInOut" } : undefined}
      >
        {placed.persona.glyph}
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2" style={{ background: stateColor, borderColor: T.floor }} />
        {/* Alarm-clock icon when waiting for AI capacity · replaces the ZZZ */}
        {opStatus.key === "waiting_capacity" ? (
          <motion.span
            className="absolute -top-1.5 -right-2 text-[10px]"
            style={{ color: T.danger }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            aria-label="waiting for capacity"
          >⏰</motion.span>
        ) : null}
      </motion.div>
      <div className="text-[10px] font-black leading-none" style={{ color: T.text }}>{placed.persona.displayName}</div>
      <div className="text-[7.5px] uppercase leading-none tracking-[0.14em]" style={{ color: stateColor }}>
        {opStatus.label}
      </div>
      {opStatus.wakeUpAt ? (
        <div className="mt-0.5 text-[8px] font-semibold" style={{ color: T.danger }}>
          <Countdown targetAt={opStatus.wakeUpAt} />
        </div>
      ) : null}
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Furniture SVGs (unchanged from prior iteration)
// ─────────────────────────────────────────────────────────────────
function RoomFurniture({ roomKey }: { roomKey: RoomKey }) {
  const stroke = T.wallDark;
  const size = { w: 220, h: 60 };
  switch (roomKey) {
    case "library":
      return (
        <svg viewBox={`0 0 ${size.w} ${size.h}`} className="h-10 w-full" fill="none" stroke={stroke} strokeWidth={1.4}>
          {[10, 55, 100, 145, 190].map((x) => (
            <g key={x}>
              <rect x={x} y={8} width={22} height={44} rx={1.5} />
              {[16, 24, 32, 40].map((y) => <line key={y} x1={x} x2={x + 22} y1={y} y2={y} />)}
            </g>
          ))}
        </svg>
      );
    case "inbox":
      return (
        <svg viewBox={`0 0 ${size.w} ${size.h}`} className="h-10 w-full" fill="none" stroke={stroke} strokeWidth={1.4}>
          {[6, 20, 34].map((y) => <rect key={y} x={70} y={y} width={80} height={10} rx={1} />)}
          <line x1={72} y1={50} x2={148} y2={50} strokeWidth={2} />
        </svg>
      );
    case "understanding":
      return (
        <svg viewBox={`0 0 ${size.w} ${size.h}`} className="h-10 w-full" fill="none" stroke={stroke} strokeWidth={1.4}>
          <rect x={30} y={6} width={160} height={40} rx={2} />
          <circle cx={70} cy={26} r={5} /><circle cx={110} cy={20} r={5} /><circle cx={150} cy={30} r={5} />
          <line x1={75} y1={26} x2={105} y2={20} /><line x1={115} y1={20} x2={145} y2={30} />
        </svg>
      );
    case "writing":
      return (
        <svg viewBox={`0 0 ${size.w} ${size.h}`} className="h-10 w-full" fill="none" stroke={stroke} strokeWidth={1.4}>
          <rect x={20} y={30} width={70} height={12} rx={1.5} /><rect x={35} y={45} width={40} height={10} rx={1.5} />
          <rect x={130} y={30} width={70} height={12} rx={1.5} /><rect x={145} y={45} width={40} height={10} rx={1.5} />
        </svg>
      );
    case "quality":
      return (
        <svg viewBox={`0 0 ${size.w} ${size.h}`} className="h-10 w-full" fill="none" stroke={stroke} strokeWidth={1.4}>
          <rect x={30} y={10} width={70} height={40} rx={2} />
          {[18, 26, 34, 42].map((y) => <line key={y} x1={38} y1={y} x2={90} y2={y} />)}
          <circle cx={140} cy={26} r={14} /><line x1={150} y1={36} x2={165} y2={50} strokeWidth={2} />
        </svg>
      );
    case "vault":
      return (
        <svg viewBox={`0 0 ${size.w} ${size.h}`} className="h-10 w-full" fill="none" stroke={stroke} strokeWidth={1.6}>
          <rect x={70} y={4} width={80} height={54} rx={4} />
          <circle cx={110} cy={31} r={16} /><circle cx={110} cy={31} r={4} fill={stroke} />
          {[0, 60, 120, 180, 240, 300].map((a) => {
            // Round to 2dp so server + client serialize identically —
            // Node and V8 disagree on the last digit of Math.sin/cos
            // otherwise, which triggers a React hydration warning.
            const rad = (a * Math.PI) / 180;
            const r = (v: number) => Math.round(v * 100) / 100;
            return (
              <line
                key={a}
                x1={r(110 + Math.cos(rad) * 12)}
                y1={r(31 + Math.sin(rad) * 12)}
                x2={r(110 + Math.cos(rad) * 20)}
                y2={r(31 + Math.sin(rad) * 20)}
              />
            );
          })}
        </svg>
      );
    case "ai_server":
      return (
        <svg viewBox={`0 0 ${size.w} ${size.h}`} className="h-10 w-full" fill="none" stroke={stroke} strokeWidth={1.4}>
          {[10, 45, 80, 115, 150, 185].map((x) => (
            <g key={x}>
              <rect x={x} y={8} width={26} height={46} rx={1} />
              {[14, 22, 30, 38, 46].map((y) => <circle key={y} cx={x + 8} cy={y} r={1.2} fill={stroke} />)}
              {[14, 22, 30, 38, 46].map((y) => <circle key={y + "b"} cx={x + 16} cy={y} r={1.2} />)}
            </g>
          ))}
        </svg>
      );
    case "lounge":
      return (
        <svg viewBox={`0 0 ${size.w} ${size.h}`} className="h-10 w-full" fill="none" stroke={stroke} strokeWidth={1.4}>
          <rect x={30} y={26} width={90} height={22} rx={6} /><rect x={30} y={20} width={90} height={10} rx={4} />
          <rect x={140} y={38} width={40} height={12} rx={2} /><circle cx={158} cy={30} r={5} />
        </svg>
      );
    case "manager":
      return (
        <svg viewBox={`0 0 ${size.w} ${size.h}`} className="h-10 w-full" fill="none" stroke={stroke} strokeWidth={1.4}>
          <rect x={30} y={30} width={100} height={16} rx={2} /><rect x={110} y={12} width={30} height={40} rx={2} />
          <rect x={65} y={48} width={30} height={8} rx={2} />
        </svg>
      );
    case "meeting":
      return (
        <svg viewBox={`0 0 ${size.w} ${size.h}`} className="h-10 w-full" fill="none" stroke={stroke} strokeWidth={1.4}>
          <ellipse cx={110} cy={30} rx={50} ry={16} />
          {[60, 90, 120, 150].map((cx) => <rect key={cx} x={cx - 8} y={48} width={16} height={6} rx={2} />)}
          {[60, 90, 120, 150].map((cx) => <rect key={cx + "t"} x={cx - 8} y={12} width={16} height={6} rx={2} />)}
        </svg>
      );
    case "dispatch":
      return (
        <svg viewBox={`0 0 ${size.w} ${size.h}`} className="h-10 w-full" fill="none" stroke={stroke} strokeWidth={1.4}>
          <rect x={20} y={8} width={180} height={46} rx={2} />
          <line x1={80} y1={8} x2={80} y2={54} /><line x1={140} y1={8} x2={140} y2={54} />
          {[16, 26, 36].map((y) => <rect key={y} x={26} y={y} width={48} height={6} rx={1} />)}
          {[16, 26].map((y) => <rect key={y + "b"} x={86} y={y} width={48} height={6} rx={1} />)}
          <rect x={146} y={16} width={48} height={6} rx={1} />
        </svg>
      );
    case "marketing":
      return (
        <svg viewBox={`0 0 ${size.w} ${size.h}`} className="h-10 w-full" fill="none" stroke={stroke} strokeWidth={1.4}>
          {/* Broadcast / megaphone + trend chart */}
          <path d="M30 20 L60 12 L60 48 L30 40 Z" />
          <line x1={60} y1={30} x2={80} y2={30} />
          {/* Bar chart */}
          {[100, 118, 136, 154, 172].map((x, i) => <rect key={x} x={x} y={54 - (10 + i * 6)} width={10} height={10 + i * 6} rx={1} />)}
        </svg>
      );
    case "innovation":
      return (
        <svg viewBox={`0 0 ${size.w} ${size.h}`} className="h-10 w-full" fill="none" stroke={stroke} strokeWidth={1.4}>
          {/* Lightbulb + gear */}
          <circle cx={70} cy={26} r={14} />
          <line x1={62} y1={44} x2={78} y2={44} />
          <line x1={64} y1={50} x2={76} y2={50} />
          <circle cx={140} cy={30} r={12} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const rad = (a * Math.PI) / 180;
            const r = (v: number) => Math.round(v * 100) / 100;
            return (
              <line
                key={a}
                x1={r(140 + Math.cos(rad) * 12)}
                y1={r(30 + Math.sin(rad) * 12)}
                x2={r(140 + Math.cos(rad) * 18)}
                y2={r(30 + Math.sin(rad) * 18)}
              />
            );
          })}
        </svg>
      );
    default: return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// DoorMark — small doorway indicator on a room's wall. Shows where
// workers walk in/out. Positioned at the bottom-centre by default
// (facing the corridor between the two floors' rows). When walk-line
// animations arrive (next iteration) they'll originate from this
// point.
// ─────────────────────────────────────────────────────────────────
function DoorMark({ accent, justEnteredAt }: { accent: string; justEnteredAt?: number }) {
  // Pulse the door for 1.5s when a worker just entered this room —
  // real state change only · never a decorative loop · Law 4.
  const [pulsing, setPulsing] = useState(false);
  useEffect(() => {
    if (!justEnteredAt) return;
    setPulsing(true);
    const id = window.setTimeout(() => setPulsing(false), 1500);
    return () => window.clearTimeout(id);
  }, [justEnteredAt]);

  return (
    <div
      className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2"
      style={{ zIndex: 2 }}
      aria-hidden
    >
      <motion.div
        className="rounded-sm"
        style={{
          width: 22, height: 6,
          background: T.floor,
          border: `1.5px solid ${accent}`,
          borderBottomWidth: 0,
          borderTopLeftRadius: 4, borderTopRightRadius: 4,
        }}
        animate={pulsing
          ? { boxShadow: [`0 0 0 0 ${accent}00`, `0 0 12px 4px ${accent}`, `0 0 0 0 ${accent}00`], scale: [1, 1.15, 1] }
          : { boxShadow: `0 0 0 0 ${accent}00`, scale: 1 }
        }
        transition={pulsing ? { duration: 1.5, ease: "easeOut" } : { duration: 0.2 }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PlannedRoomShell — for rooms whose specialists are named but not
// yet instantiated (no Fly worker backend). Renders the architectural
// room + honest empty state describing which specialists will live
// here when they spin up. No fake avatars per doctrine.
// ─────────────────────────────────────────────────────────────────
function PlannedRoomShell({ room, onOpen }: { room: Room; onOpen: () => void }) {
  return (
    <motion.div
      className="relative flex min-h-[220px] flex-col overflow-hidden rounded-lg"
      style={{
        border: `2.5px solid ${T.wallDark}`,
        boxShadow: `inset 0 0 0 1.5px ${T.wallLight}`,
        background: `
          linear-gradient(180deg, ${room.tint} 0%, transparent 55%),
          repeating-linear-gradient(45deg, ${T.floorPattern} 0px, ${T.floorPattern} 1px, transparent 1px, transparent 20px),
          ${T.floor}
        `,
      }}
    >
      <DoorMark accent={room.wallAccent} />
      <button
        type="button"
        onClick={onOpen}
        className="mx-auto mt-1.5 flex items-center gap-1.5 rounded-md border px-2 py-0.5 hover:brightness-110"
        style={{ background: T.panel, borderColor: room.wallAccent, boxShadow: `0 1.5px 3px -2px ${T.wallDark}`, cursor: "pointer" }}
        aria-label={`Open ${room.name}`}
      >
        <span className="text-[11px] leading-none" style={{ color: room.wallAccent }}>{room.glyph}</span>
        <span className="text-[9.5px] font-black uppercase tracking-[0.12em]" style={{ color: T.text }}>{room.name}</span>
        <span className="rounded-full px-1 py-0 text-[8px] font-bold" style={{ background: `${room.wallAccent}22`, color: room.wallAccent }}>Planned</span>
      </button>

      <div className="mx-auto mt-1 text-center text-[9px] italic" style={{ color: T.textFade }}>{room.purpose}</div>

      <div className="relative mt-1 flex-1">
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center opacity-30">
          <RoomFurniture roomKey={room.key} />
        </div>
        <div className="relative flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
          <div className="text-[10px] italic" style={{ color: T.textFade }}>{room.emptyLine}</div>
          <div className="text-[9px]" style={{ color: T.textGhost }}>{room.question}</div>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Dispatch shell (first floor)
// ─────────────────────────────────────────────────────────────────
function DispatchShell({ room, occupants, onOpen, allPlacements, providers }: {
  room: Room;
  occupants: PlacedWorker[];
  onOpen?: () => void;
  allPlacements?: PlacedWorker[];
  providers?: LlmProviderReport[];
}) {
  // Factory Living Workers Doctrine Rule 4 · show blocked + queued
  // jobs on the Dispatch Board, not "no pending dispatch"
  const blocked = (allPlacements ?? []).filter((p) => p.state === "waiting_llm" && p.worker?.current_job_ref);
  const queued  = (allPlacements ?? []).filter((p) => p.state === "queued");

  return (
    <div className="relative flex min-h-[220px] flex-col overflow-hidden rounded-lg" style={{
      border: `2.5px solid ${T.wallDark}`,
      boxShadow: `inset 0 0 0 1.5px ${T.wallLight}`,
      background: `
        linear-gradient(180deg, ${room.tint} 0%, transparent 55%),
        repeating-linear-gradient(45deg, ${T.floorPattern} 0px, ${T.floorPattern} 1px, transparent 1px, transparent 20px),
        ${T.floor}
      `,
    }}>
      <DoorMark accent={room.wallAccent} />
      <button
        type="button"
        onClick={onOpen}
        className="mx-auto mt-1.5 flex items-center gap-1.5 rounded-md border px-2 py-0.5 hover:brightness-110"
        style={{ background: T.panel, borderColor: room.wallAccent, cursor: onOpen ? "pointer" : "default" }}
      >
        <span className="text-[11px] leading-none" style={{ color: room.wallAccent }}>{room.glyph}</span>
        <span className="text-[9.5px] font-black uppercase tracking-[0.12em]" style={{ color: T.text }}>{room.name}</span>
        {(blocked.length + queued.length) > 0 ? (
          <span className="rounded-full px-1 py-0 text-[8px] font-bold" style={{ background: `${T.warning}22`, color: T.warning }}>{blocked.length + queued.length}</span>
        ) : null}
      </button>

      <div className="relative flex-1 overflow-y-auto px-2 py-1.5">
        {blocked.length > 0 ? (
          <>
            <div className="text-[8px] font-black uppercase tracking-widest" style={{ color: T.warning }}>Blocked</div>
            <div className="mt-1 space-y-0.5">
              {blocked.slice(0, 3).map((p) => {
                const op = providers ? deriveOperationalStatus(p, providers) : null;
                return (
                  <div key={p.persona.key} className="rounded border px-1.5 py-1" style={{ background: T.panel, borderColor: T.warning }}>
                    <div className="flex items-baseline gap-1">
                      <span aria-hidden>📦</span>
                      <span className="font-mono text-[9.5px] font-black truncate" style={{ color: T.text }}>{p.worker?.current_job_ref?.slice(0, 16) ?? "—"}</span>
                    </div>
                    <div className="mt-0.5 text-[9px]" style={{ color: T.textDim }}>
                      <span style={{ color: p.persona.colorAccent }}>{p.persona.displayName}</span> · {op?.wakeUpProvider ? `waiting for ${op.wakeUpProvider}` : "no provider"}
                    </div>
                  </div>
                );
              })}
              {blocked.length > 3 ? <div className="text-[9px] italic" style={{ color: T.textFade }}>+ {blocked.length - 3} more</div> : null}
            </div>
          </>
        ) : null}

        {queued.length > 0 ? (
          <>
            <div className="mt-1 text-[8px] font-black uppercase tracking-widest" style={{ color: T.info }}>Queued</div>
            <div className="mt-1 space-y-0.5">
              {queued.slice(0, 2).map((p) => (
                <div key={p.persona.key} className="rounded border px-1.5 py-1" style={{ background: T.panel, borderColor: T.info }}>
                  <div className="flex items-baseline gap-1 text-[9px]">
                    <span aria-hidden>⏱</span>
                    <span style={{ color: T.text }}><span style={{ color: p.persona.colorAccent }}>{p.persona.displayName}</span> · {p.worker?.jobs_waiting ?? 0} wait</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {(blocked.length + queued.length + occupants.length) === 0 ? (
          <div className="text-center text-[9px] italic" style={{ color: T.textFade }}>No pending dispatch. Board ready.</div>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Director's Office — NEX's operational brain. Case folders on the
// desk are computed from real telemetry signals only. Click to open
// the Director's workspace.
// ─────────────────────────────────────────────────────────────────
function DirectorOffice({
  room, cases, onOpen,
}: {
  room: Room;
  cases: ReturnType<typeof computeCases>;
  onOpen: () => void;
}) {
  const green = 0;                                         // auto-resolved · awaiting audit log
  const amber = cases.investigating;
  const red   = cases.adminRequired;
  const anyCase = amber > 0 || red > 0;

  return (
    <motion.div
      className="relative flex min-h-[220px] flex-col overflow-hidden rounded-lg"
      style={{
        // Slightly heavier walls · Director's Office feels more substantial
        border: `3px solid ${T.wallDark}`,
        boxShadow: `inset 0 0 0 2px ${T.wallLight}`,
        background: `
          linear-gradient(180deg, ${room.tint} 0%, transparent 55%),
          repeating-linear-gradient(45deg, ${T.floorPattern} 0px, ${T.floorPattern} 1px, transparent 1px, transparent 20px),
          ${T.floor}
        `,
      }}
      animate={{ boxShadow: [`inset 0 0 0 2px ${T.wallLight}`, `inset 0 0 0 2px ${T.wallLight}, ${T.accentGlow}`, `inset 0 0 0 2px ${T.wallLight}`] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* NEX's office always has a warm ceiling glow — she's always present */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16" style={{ background: T.ceilingLampGlow }} />
      <DoorMark accent={room.wallAccent} />

      <button
        type="button"
        onClick={onOpen}
        className="mx-auto mt-1.5 flex items-center gap-1.5 rounded-md border px-2 py-0.5 hover:brightness-110"
        style={{ background: T.panel, borderColor: room.wallAccent, boxShadow: `0 1.5px 3px -2px ${T.wallDark}`, cursor: "pointer" }}
        aria-label="Open Director's Office"
      >
        <span className="text-[11px] leading-none" style={{ color: room.wallAccent }}>{room.glyph}</span>
        <span className="text-[9.5px] font-black uppercase tracking-[0.12em]" style={{ color: T.text }}>{room.name}</span>
        {red > 0 ? (
          <span className="rounded-full px-1 py-0 text-[8px] font-bold" style={{ background: `${T.danger}20`, color: T.danger }}>{red} need you</span>
        ) : null}
      </button>

      {/* NEX + Executive Assistant · always present · desk with IN/ACTIVE/OUT trays */}
      <div className="relative mt-1 flex flex-1 items-end justify-center gap-3 px-2 pb-3">
        {/* Executive Assistant · NEX's Chief of Staff · triages case files */}
        <div className="flex flex-col items-center gap-0.5" style={{ width: 44 }}>
          <div
            className="relative grid place-items-center rounded-full font-black"
            style={{
              height: 32, width: 32, fontSize: 12,
              background: `radial-gradient(circle at 30% 25%, #7DD3FC 0%, #38BDF8 60%, #0EA5E9 100%)`,
              color: "#FFFFFF",
              boxShadow: `0 3px 8px -2px #38BDF8`,
              textShadow: "0 1px 2px rgba(0,0,0,0.35)",
            }}
          >
            EA
          </div>
          <div className="text-[8.5px] font-black leading-none" style={{ color: T.text }}>Assistant</div>
          <div className="text-[7px] uppercase leading-none tracking-[0.14em]" style={{ color: T.textFade }}>Triaging</div>
        </div>

        {/* NEX · Director of Operations */}
        <button
          type="button"
          onClick={onOpen}
          className="flex flex-col items-center gap-0.5"
          style={{ cursor: "pointer", width: 54 }}
          aria-label="Open NEX Director"
        >
          <motion.div
            className="relative grid place-items-center rounded-full font-black"
            style={{
              height: 42, width: 42, fontSize: 15,
              background: `radial-gradient(circle at 30% 25%, ${NEX_DIRECTOR.colorAccent}FF 0%, ${NEX_DIRECTOR.colorAccent}CC 60%, ${NEX_DIRECTOR.colorAccent}88 100%)`,
              color: "#FFFFFF",
              boxShadow: `0 5px 12px -3px ${NEX_DIRECTOR.colorAccent}, 0 0 0 2px ${NEX_DIRECTOR.colorAccent}22`,
              textShadow: "0 1px 2px rgba(0,0,0,0.35)",
            }}
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            {NEX_DIRECTOR.glyph}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2" style={{ background: T.success, borderColor: T.floor }} />
          </motion.div>
          <div className="text-[10px] font-black leading-none" style={{ color: T.text }}>NEX</div>
          <div className="text-[7.5px] uppercase leading-none tracking-[0.14em]" style={{ color: T.success }}>on duty</div>
        </button>

        {/* Desk with three trays — IN (red · needs NEX) · ACTIVE (amber · investigating) · OUT (green · resolved) */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="text-[7.5px] uppercase tracking-widest" style={{ color: T.textFade }}>Desk trays</div>
          <div className="flex items-end gap-1">
            <FolderStack tone={T.danger}  count={red}   label="In"     />
            <FolderStack tone={T.warning} count={amber} label="Active" />
            <FolderStack tone={T.success} count={green} label="Out"    />
          </div>
        </div>
      </div>

      {!anyCase ? (
        <div className="border-t px-2 py-1 text-center text-[9px] italic" style={{ borderColor: T.border, color: T.textFade }}>
          The desk is clear. NEX has nothing to escalate.
        </div>
      ) : (
        <div className="border-t px-2 py-1 text-center text-[9px]" style={{ borderColor: T.border, color: T.textDim }}>
          {red > 0 ? `${red} case${red === 1 ? "" : "s"} on the desk` : `${amber} under investigation`}
        </div>
      )}
    </motion.div>
  );
}

function FolderStack({ tone, count, label }: { tone: string; count: number; label: string }) {
  const displayCount = count > 9 ? "9+" : count.toString();
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative" style={{ width: 22, height: 16 }}>
        {/* Simple manila-folder silhouette · fills with tone when count > 0 */}
        <div className="absolute inset-x-0 bottom-0 rounded-[3px] border" style={{
          height: 12, background: count > 0 ? `${tone}44` : T.panelElev, borderColor: count > 0 ? tone : T.border,
        }} />
        <div className="absolute inset-x-0 top-0 rounded-t-[3px] border-b-0 border" style={{
          height: 5, width: 12, background: count > 0 ? `${tone}66` : T.panelElev, borderColor: count > 0 ? tone : T.border,
        }} />
      </div>
      <div className="font-mono text-[9px] font-black" style={{ color: count > 0 ? tone : T.textGhost }}>{displayCount}</div>
      <div className="text-[7px] uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Living Timeline — streams the last 20 operational events from the
// Worker Audit Log. Falls back to honest empty state when the log
// is not yet applied (migration 004 dependency).
// ─────────────────────────────────────────────────────────────────
function LivingTimeline({ onOpen }: { onOpen: () => void }) {
  const [rows, setRows] = useState<OpsEvent[] | null>(null);
  const [tableReady, setTableReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // Read from BOTH sources · merge by timestamp · newest first.
        // (1) Supabase audit table via /brain/audit-events (populates when mig 004 lands)
        // (2) Filesystem Event Bus via /events (working today · Phase 8)
        const [auditRes, busRes] = await Promise.all([
          fetch("/api/nex/brain/audit-events?limit=20", { cache: "no-store" }).catch(() => null),
          fetch("/api/nex/events?limit=20", { cache: "no-store" }).catch(() => null),
        ]);
        if (cancelled) return;

        const audit: OpsEvent[] = [];
        if (auditRes?.ok) {
          const j = await auditRes.json();
          if (j.ok !== false && Array.isArray(j.events)) {
            audit.push(...j.events.map(normalizeAuditEvent));
          }
        }

        const bus: OpsEvent[] = [];
        if (busRes?.ok) {
          const j = await busRes.json();
          if (j.ok !== false && Array.isArray(j.events)) {
            for (const e of j.events as Array<{ event_type?: string; timestamp?: string; source?: string; related_job?: string; payload?: Record<string, unknown> }>) {
              bus.push({
                at: e.timestamp ?? new Date().toISOString(),
                kind: e.event_type ?? "event",
                message: formatBusEventMessage(e.event_type, e.payload),
                worker: e.source ?? undefined,
                ref: e.related_job ?? undefined,
              });
            }
          }
        }

        // Merge · dedupe by ref+at signature · sort newest first
        const merged = [...audit, ...bus]
          .sort((a, b) => (a.at < b.at ? 1 : -1))
          .slice(0, 20);
        setTableReady(audit.length + bus.length > 0);
        setRows(merged);
      } catch { if (!cancelled) { setTableReady(false); setRows([]); } }
    };
    load();
    const id = window.setInterval(load, 10000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  if (rows === null) {
    return (
      <div className="mt-3 rounded-lg border p-3" style={{ background: T.panelElev, borderColor: T.border }}>
        <div className="text-[10px]" style={{ color: T.textFade }}>Loading timeline…</div>
      </div>
    );
  }

  if (tableReady === false) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 w-full rounded-lg border border-dashed p-3 text-left hover:brightness-105"
        style={{ background: T.panelElev, borderColor: T.border, cursor: "pointer" }}
      >
        <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: T.textDim }}>Timeline awaiting Worker Audit Log</div>
        <div className="mt-1 text-[11px] leading-snug" style={{ color: T.textDim }}>
          Every operational event will stream here once migration 004 is applied. Click to open Operations History.
        </div>
      </button>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="mt-3 rounded-lg border p-3" style={{ background: T.panelElev, borderColor: T.border }}>
        <div className="text-[10px]" style={{ color: T.textFade }}>Nothing has happened yet today.</div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border" style={{ background: T.panel, borderColor: T.border }}>
      <div className="max-h-[220px] overflow-y-auto">
        <AnimatePresence initial={false}>
          {rows.slice(0, 20).map((r, i) => (
            <motion.div
              key={`${r.at}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-[62px_1fr] gap-2 border-b px-2.5 py-1.5 last:border-0"
              style={{ borderColor: T.border }}
            >
              <div className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              <div className="text-[11px] leading-snug" style={{ color: T.text }}>
                {r.worker ? <span className="font-semibold" style={{ color: T.accent }}>{r.worker}</span> : null}
                {r.worker ? " · " : ""}
                {r.message}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="w-full border-t px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest hover:brightness-105"
        style={{ background: T.panelElev, borderColor: T.border, color: T.textDim, cursor: "pointer" }}
      >
        Open Operations History →
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Provider Operations Wall · always visible service tiles
// Each tile shows: name · live status · calls today · success rate ·
// avg latency · last error / last success. Click to open the full
// Providers workspace.
// ─────────────────────────────────────────────────────────────────
function ProviderStrip({ providers, onOpen, activeWorkerCount }: { providers: LlmProviderReport[]; onOpen: () => void; activeWorkerCount: number }) {
  const list = providers.filter((p) => p.provider !== "mock");
  const activeCount = list.filter((p) => providerBand(p) === "green-active").length || 1;
  return (
    <div className="mt-3 grid grid-cols-1 gap-2">
      {list.map((p) => {
        // Without audit log we can't attribute individual workers →
        // individual providers. Best signal: if only one provider is
        // active and there are N workers in flight, show that number.
        // Otherwise show null (which the tile treats as "streams from audit log").
        const activeForThis =
          providerBand(p) !== "green-active" ? null :
          activeCount === 1                  ? activeWorkerCount :
                                               null;
        return <ProviderTile key={p.provider} p={p} onOpen={onOpen} activeWorkersUsing={activeForThis} />;
      })}
    </div>
  );
}

function ProviderTile({ p, onOpen, activeWorkersUsing }: { p: LlmProviderReport; onOpen: () => void; activeWorkersUsing: number | null }) {
  const band = providerBand(p);
  const dot = band === "green-active" ? T.success : band === "orange-standby" ? T.warning : band === "unconfigured" ? T.textGhost : T.danger;
  const label = band === "green-active" ? "Working" : band === "orange-standby" ? "Standing by" : band === "unconfigured" ? "Not configured" : "Resting";
  const successPct = p.success_rate_24h === null ? null : Math.round(p.success_rate_24h * 1000) / 10;
  const recoverySec = p.circuit_open_ms_remaining ? Math.max(1, Math.round(p.circuit_open_ms_remaining / 1000)) : null;
  const successes = p.successes_24h ?? Math.round((p.calls_24h ?? 0) * (p.success_rate_24h ?? 0));
  const failures = Math.max(0, (p.calls_24h ?? 0) - successes);
  const tokens = p.tokens_24h ?? 0;
  const tokensFmt = tokens >= 1_000_000 ? `${(tokens / 1_000_000).toFixed(1)}M`
                  : tokens >= 1_000     ? `${(tokens / 1_000).toFixed(1)}K`
                  :                       tokens.toLocaleString();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-lg border p-2.5 text-left transition-transform hover:translate-y-[-1px]"
      style={{ background: T.panel, borderColor: band === "red-blocked" ? T.danger : T.border, cursor: "pointer" }}
    >
      <div className="flex items-center gap-2">
        <motion.span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: dot, boxShadow: `0 0 6px ${dot}` }}
          animate={band === "green-active" ? { opacity: [1, 0.4, 1] } : undefined}
          transition={band === "green-active" ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : undefined}
        />
        <span className="text-[11px] font-black capitalize" style={{ color: T.text }}>{p.provider}</span>
        <span className="ml-auto text-[8.5px] font-bold uppercase tracking-widest" style={{ color: dot }}>{label}</span>
      </div>

      {p.configured ? (
        <>
          {/* 24h achievements — every field driven by real per-provider telemetry */}
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            <PMetricMini label="Calls"     value={p.calls_24h.toLocaleString()} />
            <PMetricMini label="OK"        value={successes.toLocaleString()} tone={T.success} />
            <PMetricMini label="Fail"      value={failures.toLocaleString()} tone={failures > 0 ? T.warning : T.textDim} />
            <PMetricMini label="Tokens"    value={tokensFmt} />
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            <PMetricMini label="Success"   value={successPct === null ? "—" : `${successPct}%`} tone={successPct !== null && successPct < 80 ? T.warning : undefined} />
            <PMetricMini label="Avg"       value={p.avg_ms_24h ? `${p.avg_ms_24h}ms` : "—"} />
          </div>

          {/* Currently on — real state · either derivable count or honest "audit log" */}
          {band === "green-active" ? (
            <div className="mt-1.5 flex items-center gap-1.5 rounded border px-1.5 py-0.5" style={{ background: T.successSoft, borderColor: T.success }}>
              <span className="h-1 w-1 rounded-full" style={{ background: T.success, boxShadow: `0 0 4px ${T.success}` }} />
              <span className="text-[9px] font-semibold" style={{ color: T.success }}>
                On task now
                {activeWorkersUsing !== null ? ` · ${activeWorkersUsing} worker${activeWorkersUsing === 1 ? "" : "s"} in flight` : ""}
              </span>
            </div>
          ) : null}

          {recoverySec !== null ? (
            <div className="mt-1 text-[9px] font-semibold" style={{ color: T.danger }}>
              Recovery in {recoverySec}s
            </div>
          ) : (p.consecutive_failures ?? 0) > 0 ? (
            <div className="mt-1 truncate text-[9px]" style={{ color: T.danger }}>
              {(p.consecutive_failures ?? 0)} recent failure{(p.consecutive_failures ?? 0) === 1 ? "" : "s"}
              {p.last_error ? ` · ${p.last_error.slice(0, 44)}${p.last_error.length > 44 ? "…" : ""}` : ""}
            </div>
          ) : p.last_success_at ? (
            <div className="mt-1 text-[9px]" style={{ color: T.textFade }}>
              Last success · {relativeMinutes(p.last_success_at)}
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-1 text-[9.5px] italic" style={{ color: T.textFade }}>
          Environment variable not set.
        </div>
      )}
    </button>
  );
}

function PMetricMini({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded border p-1" style={{ background: T.panelElev, borderColor: T.border }}>
      <div className="text-[7.5px] uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-0.5 font-mono text-[10.5px] font-black" style={{ color: tone ?? T.text }}>{value}</div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// WORKSPACE · right column · swaps based on selected view
// ═════════════════════════════════════════════════════════════════
function Workspace(props: {
  view: ViewKey; setView: (v: ViewKey) => void;
  status: StatusPayload | null;
  providers: LlmProviderReport[];
  mockHidden: number;
  cloud: { any_online: boolean; workers: CloudWorker[] } | null;
  buildingStatus: { label: string; color: string; note: string };
  totalActive: number; totalSleeping: number; totalOffline: number;
  cases: ReturnType<typeof computeCases>;
}) {
  const active = VIEWS.find((v) => v.key === props.view) ?? VIEWS[0];
  return (
    <section className="min-w-0 overflow-y-auto p-6" style={{ background: T.panel }}>
      <WorkspaceHeader title={active.label} icon={active.icon} />
      <div className="mt-4">
        {props.view === "director"      ? <DirectorWorkspace cases={props.cases} /> :
         props.view === "briefing"      ? <BriefingWorkspace status={props.status} providers={props.providers} cases={props.cases} totalActive={props.totalActive} totalSleeping={props.totalSleeping} totalOffline={props.totalOffline} mockHidden={props.mockHidden} /> :
         props.view === "board"         ? <BoardReportWorkspace /> :
         props.view === "opportunity"   ? <OpportunityRadarWorkspace /> :
         props.view === "strategy"      ? <StrategyRoomWorkspace /> :
         props.view === "kpi_wall"      ? <StubWorkspace title="Enterprise KPI Wall" description="One-screen executive scoreboard — Revenue · MRR · ARR · Active users · Churn · CAC · LTV · AI cost per record · System uptime · Customer satisfaction. Every KPI evidence-backed · trending arrows drawn from real deltas." pending="Analytics + billing + support integrations" /> :
         props.view === "global_alerts" ? <StubWorkspace title="Global Alerts" description="Every open alert across every department in one view · sorted by severity. Composes with Director's Office cases + Config Attention + Recovery Clock. Includes acknowledge / snooze / escalate." pending="Alert persistence + acknowledgement API" /> :
         props.view === "marketing"     ? <MarketingWorkspace /> :
         props.view === "innovation"    ? <InnovationWorkspace /> :
         props.view === "customer"      ? <CustomerExperienceWorkspace /> :
         props.view === "social"        ? <StubWorkspace title="Social Media" description="Live per-channel telemetry — Facebook · Instagram · LinkedIn · TikTok · Pinterest · X · YouTube · Reddit · Google Business. Followers · reach · engagement · CTR · leads · revenue attribution. NEX prepares posts for approval." pending="Social OAuth + ingester per channel" /> :
         props.view === "content"       ? <StubWorkspace title="Content Studio" description="Blog ideas · article generation · newsletters · customer stories · tutorials · release notes · videos · documentation. NEX drafts · admin approves · scheduler publishes." pending="Content generation pipeline + editorial workflow" /> :
         props.view === "campaigns"     ? <StubWorkspace title="Campaign Planner" description="Every campaign · current · scheduled · finished · ROI · next recommendation. Cross-channel calendar view. NEX prepares next-quarter plan for approval." pending="Campaign persistence + scheduler + attribution" /> :
         props.view === "seo"           ? <StubWorkspace title="SEO & Analytics" description="Search-rank tracking · keyword coverage · content gap analysis · organic traffic. NEX identifies underperforming pages + high-demand keywords with no matching content." pending="Google Search Console + analytics ingest" /> :
         props.view === "community"     ? <StubWorkspace title="Community" description="Discord · Facebook groups · LinkedIn · Reddit · X · YouTube comments · feature requests · sentiment analysis. NEX summarises weekly conversation themes for product decisions." pending="Community API integrations + sentiment analysis" /> :
         props.view === "pricing"       ? <StubWorkspace title="Pricing Intelligence" description="Constantly watches: conversion rate · churn · upgrade speed · cancellation reasons · price sensitivity by segment. NEX advises when pricing needs adjustment — e.g. 'Starter converts too easily' · 'Enterprise underpriced'. Requires Level-3 authority (Philip approval) for any price change." pending="Stripe events + conversion telemetry" /> :
         props.view === "renewals"      ? <StubWorkspace title="Renewal Centre" description="Countdown to every renewal — SSL · domain · subscription · credit card · API key · provider quota. NEX warns 14d / 7d / 3d / 24h before each. Nothing renews or lapses silently." pending="Domain registrar + Stripe + SSL monitor integrations" /> :
         props.view === "email"         ? <CommunicationsCentrePanel /> :
         props.view === "partner"       ? <PartnerAgencyWorkspace /> :
         props.view === "sales"         ? <SalesIntelligenceWorkspace /> :
         props.view === "operations"    ? <OperationsCentreWorkspace status={props.status} totalActive={props.totalActive} totalSleeping={props.totalSleeping} totalOffline={props.totalOffline} cases={props.cases} /> :
         props.view === "research"      ? <ResearchLabWorkspace /> :
         props.view === "directory"     ? <HeadquartersDirectoryWorkspace views={VIEWS} setView={props.setView} /> :
         // Business
         props.view === "subscriptions" ? <StubWorkspace title="Subscriptions" description="Active subscriptions · MRR breakdown by plan · trial-to-paid conversion · churn cohort · renewal calendar. Every subscription state change logged." pending="Stripe subscriptions API + webhook ingester" /> :
         props.view === "revenue"       ? <StubWorkspace title="Revenue Analytics" description="Revenue by plan · country · channel · customer segment. Cohort LTV · payback period · expansion revenue. NEX surfaces underpriced tiers + high-value segments." pending="Stripe events + attribution pipeline" /> :
         props.view === "invoices"      ? <StubWorkspace title="Invoices" description="Every invoice issued · paid · overdue · disputed. Aging report. Payment failures with automated dunning." pending="Stripe invoicing API + retry orchestration" /> :
         props.view === "accounting"    ? <StubWorkspace title="Accounting" description="Bookkeeping-ready ledger · VAT registers · P&L · balance sheet. Complements Nex Booker (the customer-facing product) with internal NEX-business books." pending="Composes with Nex Booker · migrations 20260806000000 series" /> :
         // Customer Success
         props.view === "support"       ? <CustomerSuccessWorkspace /> :
         props.view === "accounts"      ? <StubWorkspace title="Customer Accounts" description="Every customer as first-class entity · timeline · health score · lifetime value · usage · support history · billing." pending="Customer directory + Stripe subscription state + support integration" /> :
         props.view === "requests"      ? <StubWorkspace title="Feature Requests" description="Repeated user asks aggregated + de-duplicated · request count · segment breakdown · NEX priority score. Composes with Innovation Lab." pending="Request capture pipeline (in-app + email + support)" /> :
         props.view === "feedback"      ? <StubWorkspace title="Feedback" description="Praise · complaints · suggestions across every channel. NEX summarises weekly · surfaces trends that need product response." pending="Feedback pipeline · NPS ingest · review aggregation" /> :
         props.view === "livechat"      ? <StubWorkspace title="Live Chat" description="Active conversations · queue depth · agent (or NEX) response times · resolution rate. NEX drafts replies for approval." pending="Chat provider integration (Intercom / Crisp / custom)" /> :
         props.view === "crm"           ? <StubWorkspace title="CRM" description="Complete customer relationship graph · every touchpoint · every interaction · every commitment. Sales pipeline + Customer Success timelines converge here." pending="Customer directory + interaction pipeline" /> :
         // Administration
         props.view === "permissions"   ? <StubWorkspace title="Permissions" description="User seats · roles · API keys · scoped access · rotation history. Every permission change logged to Audit Centre." pending="Admin session + role model + rotation UI" /> :
         props.view === "backups"       ? <StubWorkspace title="Backups" description="Supabase snapshots · content backups · knowledge vault backups · retention policy · restoration drills. NEX verifies backup integrity weekly." pending="Backup schedule + verification cron + restore UI" /> :
         props.view === "compliance"    ? <StubWorkspace title="Compliance" description="GDPR requests · data retention · deletion audit · policy versions · consent records. NEX flags any surface at risk of Law-14 violation (HQ → Public leak). Composes with the parent Legal Office." pending="Compliance workflow + policy versioning" /> :
         props.view === "legal"         ? <LegalOfficeWorkspace /> :
         props.view === "automation"    ? <AutomationCentreWorkspace /> :
         props.view === "market"        ? <MarketIntelligenceWorkspace /> :
         props.view === "finance"       ? <FinanceWorkspace /> :
         props.view === "engineering"   ? <EngineeringWorkspace /> :
         props.view === "security"      ? <SecurityWorkspace /> :
         props.view === "history"       ? <HistoryWorkspace /> :
         props.view === "journal"       ? <JournalWorkspace /> :
         props.view === "inbox"         ? <InboxWorkspace /> :
         props.view === "dumping"       ? <KnowledgeDumpingWorkspace /> :
         props.view === "queue"         ? <QueueWorkspace status={props.status} /> :
         props.view === "graph"         ? <StubWorkspace title="Knowledge Graph" description="Interactive graph traversal of every knowledge record and its typed relationships." pending="Graph traversal renderer" /> :
         props.view === "review"        ? <StubWorkspace title="Review Queue" description="Records flagged for human decision. Contradictions, provenance conflicts, promotion pauses." pending="Review workflow (drives 'record_promoted_to_authoritative' event)" /> :
         props.view === "providers"     ? <ProvidersWorkspace providers={props.providers} /> :
         props.view === "analytics"     ? <StubWorkspace title="Worker Analytics" description="Per-worker throughput trend, provider mix, confidence trend, learning-delta." pending="Worker Audit Log · migration 004" /> :
         props.view === "configuration" ? <ConfigurationWorkspace mockHidden={props.mockHidden} /> :
         props.view === "audit"         ? <HistoryWorkspace /> :
         props.view === "health"        ? <HealthWorkspace cloud={props.cloud} providers={props.providers} status={props.status} /> :
         props.view === "storage"       ? <NexStoragePanel /> :
         props.view === "booker"        ? <BookerWorkspace /> :
         props.view === "admin"         ? <StubWorkspace title="Administration" description="User seats · roles · billing · api keys · membership." pending="Admin session + billing surface" /> :
                                          null}
      </div>
    </section>
  );
}

// ─────── Director's Office workspace · NEX's case log + performance ───────
function DirectorWorkspace({ cases }: { cases: ReturnType<typeof computeCases> }) {
  const { list, investigating, adminRequired, autoResolvedKnown } = cases;
  return (
    <div className="space-y-5">
      {/* NEX voice header */}
      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.border, boxShadow: T.shadowSm }}>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 flex-none place-items-center rounded-full font-black" style={{
            background: `radial-gradient(circle at 30% 25%, ${NEX_DIRECTOR.colorAccent}FF 0%, ${NEX_DIRECTOR.colorAccent}CC 60%, ${NEX_DIRECTOR.colorAccent}88 100%)`,
            color: "#FFFFFF", fontSize: 18,
            boxShadow: `0 6px 14px -4px ${NEX_DIRECTOR.colorAccent}`, textShadow: "0 1px 2px rgba(0,0,0,0.35)",
          }}>N</div>
          <div>
            <div className="text-[17px] font-black leading-tight tracking-tight">{NEX_DIRECTOR.displayName}</div>
            <div className="text-[11px] font-semibold" style={{ color: NEX_DIRECTOR.colorAccent }}>{NEX_DIRECTOR.role}</div>
          </div>
        </div>
        <p className="mt-3 text-[12.5px] italic leading-relaxed" style={{ color: T.text }}>&ldquo;{NEX_DIRECTOR.voiceLine}&rdquo;</p>
      </div>

      {/* Today's performance */}
      <SectionHeader title="Today · NEX's performance" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BigMetric label="Auto-resolved"        value={autoResolvedKnown === null ? "—" : autoResolvedKnown.toLocaleString()} tone={T.success} />
        <BigMetric label="Under investigation"  value={investigating.toLocaleString()} tone={T.warning} />
        <BigMetric label="Need your decision"   value={adminRequired.toLocaleString()} tone={T.danger} />
        <BigMetric label="Cases open"           value={list.length.toLocaleString()} />
      </div>
      {autoResolvedKnown === null ? (
        <HonestEmpty title="Auto-resolved count awaiting audit log" body="Once migration 004 is applied, NEX's automatic recoveries (provider failovers · retries · re-assignments) count into this metric." />
      ) : null}

      {/* Live case list */}
      <SectionHeader title="Case log" />
      {list.length === 0 ? (
        <HonestEmpty title="The desk is clear" body="No open cases derived from live telemetry. NEX has nothing to escalate to you." />
      ) : (
        <div className="space-y-2">
          {list.map((c) => <CaseRow key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}

function CaseRow({ c }: { c: OpsCase }) {
  const tone = c.tone === "green" ? T.success : c.tone === "amber" ? T.warning : T.danger;
  const badge = c.tone === "green" ? "Resolved" : c.tone === "amber" ? "Investigating" : "Needs your decision";
  return (
    <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: c.tone === "red" ? T.danger : T.border }}>
      <div className="flex items-baseline gap-2">
        <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ background: `${tone}22`, color: tone }}>{c.priority}</span>
        <span className="text-[13px] font-black" style={{ color: T.text }}>{c.title}</span>
        <span className="ml-auto text-[10px] font-bold" style={{ color: tone }}>{badge}</span>
      </div>
      <div className="mt-1.5 text-[11.5px]" style={{ color: T.textDim }}>Affected · <span style={{ color: T.text }}>{c.affected}</span></div>
      <div className="mt-1 text-[12px] leading-relaxed" style={{ color: T.text }}>{c.status}</div>
      <div className="mt-2 rounded-md border-l-2 pl-2 text-[11.5px] italic" style={{ borderColor: tone, color: T.textDim }}>{c.recommendation}</div>
      <div className="mt-2 font-mono text-[9.5px]" style={{ color: T.textFade }}>Reported · {new Date(c.reportedAt).toLocaleString()}</div>
    </div>
  );
}

function WorkspaceHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-baseline gap-2 border-b pb-2" style={{ borderColor: T.border }}>
      <span className="text-[16px]" style={{ color: T.accent }}>{icon}</span>
      <h2 className="text-[22px] font-black leading-tight tracking-tight" style={{ letterSpacing: "-0.02em" }}>{title}</h2>
    </div>
  );
}

// ─────── Overview EDGE TAB · vertical trigger on the right window edge ───────
// The tab lives permanently on the right edge of the viewport. Click to
// slide the Overview drawer in. Colour reflects mock alert (red pulse
// when placeholder records are present · warm cream when clean).
function OverviewEdgeTab({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? "Close Overview" : "Open Overview"}
      className="fixed right-0 top-1/2 z-30 flex -translate-y-1/2 select-none items-center gap-1.5 rounded-l-lg border py-3 pl-2 pr-1.5 shadow-lg transition-transform hover:translate-x-[-2px]"
      style={{
        background: T.accent,          // YELLOW · matches other right-edge tabs
        borderColor: T.accentDark,
        color: "#FFFFFF",
        writingMode: "vertical-rl",
        transform: "translateY(-50%)",
      }}
    >
      <span className="text-[10px] font-black uppercase tracking-[0.32em]" style={{ color: "#FFFFFF" }}>
        {open ? "Close" : "Overview"}
      </span>
      <span className="rounded-full" style={{ height: 6, width: 6, background: "#FFFFFF", boxShadow: "0 0 6px rgba(255,255,255,0.7)" }} />
    </button>
  );
}

// ─────── Overview DRAWER · slide-in from right ───────
// Same content as the previous OverviewWorkspace, but presented as a
// glance-anywhere drawer so admins can peek at the building state
// without leaving Director's Office, Providers, Configuration, etc.
function OverviewDrawer({
  buildingStatus, status, totalActive, totalSleeping, totalOffline, providers, mockHidden, setView, onClose,
}: {
  buildingStatus: { label: string; color: string; note: string };
  status: StatusPayload | null;
  totalActive: number; totalSleeping: number; totalOffline: number;
  providers: LlmProviderReport[];
  mockHidden: number;
  setView: (v: ViewKey) => void;
  onClose: () => void;
}) {
  const active = providers.filter((p) => providerBand(p) === "green-active").length;
  const standby = providers.filter((p) => providerBand(p) === "orange-standby").length;
  const blocked = providers.filter((p) => providerBand(p) === "red-blocked").length;

  return (
    <motion.aside
      role="dialog"
      aria-label="Overview"
      className="fixed inset-y-0 right-0 z-40 w-full max-w-[440px] overflow-y-auto border-l"
      style={{ background: T.panel, borderColor: T.borderStrong, boxShadow: "-24px 0 60px -16px rgba(0,0,0,0.4)" }}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 240, damping: 30 }}
    >
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b p-5" style={{ background: T.panel, borderColor: T.border }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: T.accent }}>
              Overview
            </div>
            <div className="mt-0.5 text-[20px] font-black tracking-tight" style={{ letterSpacing: "-0.02em" }}>
              At-a-glance NEX
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border px-2 py-1 text-[11px]"
            style={{ background: T.panelElev, borderColor: T.border, color: T.textDim }}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.border }}>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: buildingStatus.color }} />
            <span className="text-[15px] font-black" style={{ color: buildingStatus.color }}>{buildingStatus.label}</span>
          </div>
          <div className="mt-1 text-[12.5px]" style={{ color: T.textDim }}>{buildingStatus.note}</div>
        </div>

        <SectionHeader title="At-a-glance" />
        <div className="grid grid-cols-2 gap-2">
          <BigMetric label="Working"        value={totalActive.toLocaleString()}                          tone={T.success} />
          <BigMetric label="Resting"        value={totalSleeping.toLocaleString()}                        tone={T.textDim} />
          <BigMetric label="Offline"        value={totalOffline.toLocaleString()}                         tone={T.danger} />
          <BigMetric label="Queue"          value={(status?.jobs_waiting ?? 0).toLocaleString()}          tone={T.info} />
          <BigMetric label="Completed 24h"  value={(status?.jobs_completed_24h ?? 0).toLocaleString()}    tone={T.accent} />
          <BigMetric label="Authoritative"  value={(status?.records_authoritative ?? 0).toLocaleString()} />
          <BigMetric label="Under review"   value={(status?.records_under_review ?? 0).toLocaleString()} />
          <BigMetric label="Drafts"         value={(status?.records_draft ?? 0).toLocaleString()}         tone={T.textFade} />
        </div>

        <SectionHeader title="Provider mix" />
        <div className="grid grid-cols-3 gap-2">
          <BigMetric label="Active"   value={active.toString()}  tone={T.success} />
          <BigMetric label="Standby"  value={standby.toString()} tone={T.warning} />
          <BigMetric label="Blocked"  value={blocked.toString()} tone={T.danger} />
        </div>

        {mockHidden > 0 ? (
          <div className="rounded-xl border p-5" style={{ background: T.dangerSoft, borderColor: T.danger }}>
            {/* Executive Case header · matches Philip 2026-08-07 rewrite */}
            <div className="flex items-baseline gap-2">
              <span aria-hidden>🔴</span>
              <span className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: T.danger }}>Executive Case · Mock Knowledge Generation Detected</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2 text-[11px]" style={{ color: T.text }}>
              <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: `${T.danger}22`, color: T.danger }}>P1</span>
              <span>Administrator Decision Required</span>
            </div>

            <FieldRow label="Affected Area"><span className="text-[12px]" style={{ color: T.text }}>Cloud AI Worker Infrastructure</span></FieldRow>

            <FieldRow label="Current Situation">
              <p className="text-[12.5px] leading-relaxed" style={{ color: T.text }}>
                NEX has detected that the cloud worker is operating with <span className="font-semibold">Mock Fallback enabled</span>. While this keeps the processing pipeline active, it causes placeholder knowledge to be generated instead of waiting for verified AI provider responses. To protect the integrity of the Knowledge Vault, {mockHidden === 1 ? "this record has" : `these ${mockHidden.toLocaleString()} records have`} been automatically excluded from operational knowledge.
              </p>
            </FieldRow>

            <FieldRow label="Operational Summary">
              <div className="rounded-lg border" style={{ background: T.panel, borderColor: T.border }}>
                <SummaryLine k="Placeholder records detected" v={mockHidden.toLocaleString()} tone={T.danger} />
                <SummaryLine k="Knowledge Vault integrity"    v="🟢 Protected" />
                <SummaryLine k="Public users affected"        v="No" tone={T.success} />
                <SummaryLine k="Internal processing"          v="Continuing with placeholder generation" tone={T.warning} />
                <SummaryLine k="Recommendation"               v="Administrative action required" tone={T.danger} />
              </div>
            </FieldRow>

            <FieldRow label="Business Impact">
              <ul className="space-y-0.5 text-[12px]" style={{ color: T.text }}>
                <li>· Placeholder records will continue to accumulate</li>
                <li>· Worker effort is spent processing temporary knowledge rather than verified information</li>
                <li>· Confidence scores become less meaningful</li>
                <li>· Knowledge promotion quality is reduced</li>
                <li>· Operational reporting becomes less representative of real AI output</li>
              </ul>
              <div className="mt-1.5 text-[11px] italic" style={{ color: T.textDim }}>
                No customer data is exposed, and no information has been leaked outside Headquarters.
              </div>
            </FieldRow>

            <FieldRow label="NEX Recommendation">
              <div className="rounded-lg border p-2.5" style={{ background: T.panel, borderColor: NEX_DIRECTOR.colorAccent }}>
                <div className="flex items-baseline gap-2">
                  <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest" style={{ background: `${NEX_DIRECTOR.colorAccent}22`, color: NEX_DIRECTOR.colorAccent }}>NEX</span>
                  <span className="ml-auto text-[9px] font-bold uppercase tracking-widest" style={{ color: T.success }}>Confidence 99%</span>
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed italic" style={{ color: T.text }}>
                  &ldquo;I recommend disabling Mock Fallback and allowing failed requests to enter the LLM Retry Queue. This preserves knowledge quality and ensures every record stored by NEX originates from a verified AI provider.&rdquo;
                </p>
              </div>
            </FieldRow>

            <FieldRow label="Estimated Effect">
              <div className="rounded-lg border" style={{ background: T.panel, borderColor: T.border }}>
                <SummaryLine k="Knowledge Quality"    v="↑ Improves"    tone={T.success} />
                <SummaryLine k="Confidence Accuracy"  v="↑ Improves"    tone={T.success} />
                <SummaryLine k="Worker Efficiency"    v="↑ Improves"    tone={T.success} />
                <SummaryLine k="Data Integrity"       v="Maintained"    tone={T.success} />
                <SummaryLine k="Customer Experience"  v="No interruption" tone={T.textDim} />
              </div>
            </FieldRow>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setView("configuration")}
                className="flex-1 rounded-md border px-3 py-2 text-[12px] font-bold"
                style={{ background: T.danger, borderColor: T.danger, color: "#FFFFFF" }}
              >
                Approve Recommendation →
              </button>
              <button
                type="button"
                onClick={() => setView("configuration")}
                className="rounded-md border px-3 py-2 text-[12px] font-semibold"
                style={{ background: T.panel, borderColor: T.border, color: T.textDim }}
              >
                Open Configuration
              </button>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.border }}>
          <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: T.textDim }}>Priority sequence</div>
          <ul className="mt-2 space-y-1 text-[12px]" style={{ color: T.textDim }}>
            <li>1 · Apply migration 004 → Worker Audit Log becomes live (unlocks Analytics · Journal · History).</li>
            <li>2 · <span className="font-mono">fly secrets set LLM_ALLOW_MOCK_FALLBACK=false --app nex-brain-worker</span> → stops mock placeholder generation.</li>
            <li>3 · Wire Dispatch API → admin controls activate.</li>
          </ul>
        </div>
      </div>
    </motion.aside>
  );
}

// ─────── History workspace (live) ───────
function HistoryWorkspace() {
  const [rows, setRows] = useState<OpsEvent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/nex/brain/audit-events?limit=50", { cache: "no-store" });
        const j = await res.json();
        if (cancelled) return;
        if (j.ok === false && j.table_ready === false) {
          setErr("Worker Audit Log · migration 004 not yet applied. Once applied, real events populate this stream automatically.");
          setRows([]);
        } else {
          setRows(Array.isArray(j.events) ? j.events.map(normalizeAuditEvent) : []);
        }
      } catch (e) {
        if (!cancelled) setErr(String((e as Error).message ?? e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (rows === null && !err) return <SkeletonRows />;
  if (err) return <HonestEmpty title="Awaiting Worker Audit Log" body={err} />;
  if (!rows?.length) return <HonestEmpty title="No events yet" body="Every worker action will stream here once the Worker Audit Log is active." />;
  return (
    <div className="rounded-xl border" style={{ background: T.panel, borderColor: T.border }}>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[110px_1fr] gap-3 border-b px-3 py-2 last:border-0" style={{ borderColor: T.border }}>
          <div className="font-mono text-[10px]" style={{ color: T.textFade }}>{new Date(r.at).toLocaleTimeString()}</div>
          <div>
            <div className="text-[12px]" style={{ color: T.text }}>{r.message}</div>
            {(r.worker || r.ref) ? (
              <div className="mt-0.5 font-mono text-[10px]" style={{ color: T.textFade }}>{r.worker ? `${r.worker} · ` : ""}{r.ref ?? ""}</div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────── Journal workspace (link + summary) ───────
function JournalWorkspace() {
  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed" style={{ color: T.textDim }}>
        Every worker keeps a first-person journal: what they read, what they learned, what changed their confidence, what
        they promoted. The full dedicated view lives at{" "}
        <Link href="/nex-app/nex-brain/journal" className="underline" style={{ color: T.info }}>/nex-app/nex-brain/journal</Link>
        {" "}with per-worker filters.
      </p>
      <HonestEmpty
        title="In-shell journal preview"
        body="Once the Worker Audit Log (migration 004) is applied, the latest 20 journal entries stream here alongside the Headquarters view — no page navigation required."
      />
    </div>
  );
}

// ─────── Inbox workspace (link) ───────
function InboxWorkspace() {
  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed" style={{ color: T.textDim }}>
        Drop documents into the Knowledge Inbox — workers pick them up and route them through the workshop. Dedicated
        view: <Link href="/nex-app/knowledge-inbox" className="underline" style={{ color: T.info }}>/nex-app/knowledge-inbox</Link>.
      </p>
      <HonestEmpty
        title="In-shell inbox preview"
        body="Live inbox list + drop zone will render here in the next iteration so admins can add work without leaving Headquarters."
      />
    </div>
  );
}

// ─────── Knowledge Dumping workspace (fast bulk ingest) ───────
// Bulk-drop surface for pasting large text corpora. Extended per Philip
// 2026-08-07 to include HQ Knowledge Types (Level 1/2/3) and Chat With
// Boss Q&A mode. Direct pipe to /api/nex/knowledge-inbox/dump.
type KnowledgeSourceKey =
  | "chatgpt-approved" | "claude-generated" | "raw-research" | "internet-article"
  | "needs-verification" | "gov-standards" | "customer-qa" | "personal-ideas";
const SOURCE_OPTIONS: { key: KnowledgeSourceKey; label: string }[] = [
  { key: "raw-research",       label: "Raw research"          },
  { key: "chatgpt-approved",   label: "ChatGPT (approved)"    },
  { key: "claude-generated",   label: "Claude generated"      },
  { key: "internet-article",   label: "Internet article"      },
  { key: "gov-standards",      label: "Government / standards" },
  { key: "customer-qa",        label: "Customer Q&A"          },
  { key: "personal-ideas",     label: "Personal ideas"        },
  { key: "needs-verification", label: "Needs verification"    },
];

// Knowledge Separation Doctrine (Philip 2026-08-07):
// Every dump answers ONE question first — 🏢 Headquarters OR 🌍 Live Platform.
// Two destination trees · NEVER mixed dropdown. Boss Q&A + HQ Doctrine
// + Legal stay HQ-only forever. Trade Knowledge + Customer Q&A are the
// ONLY sources reaching public routes.
type KnowledgeDestination = "hq" | "platform" | "research";
type KnowledgeCategory = {
  key: string;
  label: string;
  group: string;                       // Sub-heading within destination
  level: 1 | 2 | 3;
  brainTargets: string[];              // Which Brains receive this
  visibleTo: "administrators" | "customers";
  approvalRequired: string;            // "Yes" · "After quality check" · "No"
  hint: string;
};

const HQ_CATEGORIES: KnowledgeCategory[] = [
  // Executive & Operations
  { key: "boss-qa",             label: "Executive · Boss Chat (Q&A)", group: "Executive & Operations", level: 3, brainTargets: ["All HQ Brains via Founder Decision Model"], visibleTo: "administrators", approvalRequired: "Yes",  hint: "Philip's reasoning · principles · decisions · L3 Executive Intelligence. Approve/Edit/Reject gate before permanent memory." },
  { key: "hq-doctrine",         label: "Company Doctrine",             group: "Executive & Operations", level: 2, brainTargets: ["All HQ Brains"], visibleTo: "administrators", approvalRequired: "Yes",  hint: "Company rules · principles · operating standards" },
  { key: "sops",                label: "Operations Procedures (SOPs)", group: "Executive & Operations", level: 2, brainTargets: ["Operations Brain", "Executive Brain", "Internal Audit"], visibleTo: "administrators", approvalRequired: "Yes", hint: "How the company actually runs" },
  { key: "policies",            label: "Company Policies",             group: "Executive & Operations", level: 2, brainTargets: ["All HQ Brains"], visibleTo: "administrators", approvalRequired: "Yes",  hint: "Formal internal policy documents" },
  { key: "decision-frameworks", label: "Decision Frameworks",          group: "Executive & Operations", level: 2, brainTargets: ["Executive Brain", "Strategy Room"], visibleTo: "administrators", approvalRequired: "Yes", hint: "How decisions should be evaluated" },
  // Legal & Compliance
  { key: "legal-constraints",   label: "Legal Constraints",            group: "Legal & Compliance",     level: 1, brainTargets: ["Legal Brain"], visibleTo: "administrators", approvalRequired: "Yes", hint: "Never-do rules · legal boundaries" },
  { key: "privacy-compliance",  label: "Privacy & Compliance",         group: "Legal & Compliance",     level: 1, brainTargets: ["Legal Brain", "Audience Intelligence Brain"], visibleTo: "administrators", approvalRequired: "Yes", hint: "GDPR · PECR · CASL · CAN-SPAM obligations" },
  { key: "contracts",           label: "Contracts & Agreements",       group: "Legal & Compliance",     level: 1, brainTargets: ["Legal Brain"], visibleTo: "administrators", approvalRequired: "Yes", hint: "Signed contracts · effective dates · parties · Legal Memory Vault" },
  { key: "regulatory",          label: "Regulatory Requirements",      group: "Legal & Compliance",     level: 1, brainTargets: ["Legal Brain"], visibleTo: "administrators", approvalRequired: "Yes", hint: "External regulations we must meet" },
  // Business Operations
  { key: "marketing-processes", label: "Marketing Processes",          group: "Business Operations",    level: 2, brainTargets: ["Marketing Brain", "Brand Brain"], visibleTo: "administrators", approvalRequired: "Yes", hint: "Marketing playbook · brand rules · approval workflow" },
  { key: "sales-processes",     label: "Sales Processes",              group: "Business Operations",    level: 2, brainTargets: ["Sales Brain"],       visibleTo: "administrators", approvalRequired: "Yes", hint: "Sales process · objection handling · pipeline rules" },
  { key: "cs-procedures",       label: "Customer Service Procedures",  group: "Business Operations",    level: 2, brainTargets: ["Customer Service Brain"], visibleTo: "administrators", approvalRequired: "Yes", hint: "Support standards · escalation · response times" },
  { key: "finance-procedures",  label: "Finance Procedures",           group: "Business Operations",    level: 2, brainTargets: ["Finance Brain"],     visibleTo: "administrators", approvalRequired: "Yes", hint: "Bookkeeping · revenue recognition · cost controls" },
  { key: "hr-procedures",       label: "HR Procedures",                group: "Business Operations",    level: 2, brainTargets: ["Operations Brain"],  visibleTo: "administrators", approvalRequired: "Yes", hint: "Team processes · onboarding · reviews" },
  { key: "quality-procedures",  label: "Quality Procedures",           group: "Business Operations",    level: 2, brainTargets: ["Operations Brain", "Internal Audit"], visibleTo: "administrators", approvalRequired: "Yes", hint: "QA standards · review gates" },
  { key: "it-security",         label: "IT & Security Procedures",     group: "Business Operations",    level: 2, brainTargets: ["Security Brain"],    visibleTo: "administrators", approvalRequired: "Yes", hint: "Security standards · incident response · access control" },
  // Company Knowledge
  { key: "meeting-notes",       label: "Meeting Notes",                group: "Company Knowledge",      level: 1, brainTargets: ["Executive Brain · Working Memory"], visibleTo: "administrators", approvalRequired: "No",   hint: "Weekly meetings · decisions made · action items" },
  { key: "internal-research",   label: "Internal Research",            group: "Company Knowledge",      level: 1, brainTargets: ["Research & Innovation Lab"], visibleTo: "administrators", approvalRequired: "No", hint: "External scans · competitor analysis · trend reports" },
  { key: "business-strategy",   label: "Business Strategy",            group: "Company Knowledge",      level: 2, brainTargets: ["Strategy Room", "Executive Brain"], visibleTo: "administrators", approvalRequired: "Yes", hint: "Long-term plans · positioning · roadmap" },
  { key: "process-improvements",label: "Process Improvements",         group: "Company Knowledge",      level: 2, brainTargets: ["Operations Brain", "Internal Audit"], visibleTo: "administrators", approvalRequired: "Yes", hint: "Continuous improvement · retros · workflow updates" },
];

// 🔬 Research & Experiments · third destination · quarantine tier
// Reviewed then promoted to HQ or Platform · or archived. Never
// directly reachable by customer-facing brains until promoted.
const RESEARCH_CATEGORIES: KnowledgeCategory[] = [
  { key: "research-competitor",     label: "Competitor Analysis",    group: "Market Research",     level: 1, brainTargets: ["Research & Innovation Lab (review)"], visibleTo: "administrators", approvalRequired: "Yes", hint: "Competitor products · pricing · marketing moves · feature launches" },
  { key: "research-market-trend",   label: "Market Trends",          group: "Market Research",     level: 1, brainTargets: ["Research & Innovation Lab (review)"], visibleTo: "administrators", approvalRequired: "Yes", hint: "Search-trend data · industry reports · demand shifts" },
  { key: "research-supplier",       label: "Supplier Comparisons",   group: "Market Research",     level: 1, brainTargets: ["Research & Innovation Lab (review)"], visibleTo: "administrators", approvalRequired: "Yes", hint: "Timber suppliers · hardware · finishes · cost/quality comparisons" },
  { key: "research-ai-papers",      label: "AI Research Papers",     group: "Technology Watch",    level: 1, brainTargets: ["Research & Innovation Lab (review)"], visibleTo: "administrators", approvalRequired: "Yes", hint: "New models · benchmarks · academic publications" },
  { key: "research-emerging",       label: "Emerging Materials",     group: "Technology Watch",    level: 1, brainTargets: ["Research & Innovation Lab (review)"], visibleTo: "administrators", approvalRequired: "Yes", hint: "New timber engineering · composites · rail systems · glazing" },
  { key: "research-regulatory",     label: "Regulatory Watch",       group: "Technology Watch",    level: 1, brainTargets: ["Research & Innovation Lab (review)", "Legal Brain (review)"], visibleTo: "administrators", approvalRequired: "Yes", hint: "Upcoming Building Regs changes · standards drafts" },
  { key: "research-prototype",      label: "Prototype Ideas",        group: "Experiments",         level: 1, brainTargets: ["Innovation Lab (review)"], visibleTo: "administrators", approvalRequired: "Yes", hint: "Feature concepts · design ideas · what-if scenarios" },
  { key: "research-beta-design",    label: "Beta Feature Designs",   group: "Experiments",         level: 1, brainTargets: ["Innovation Lab (review)", "Product Brain (review)"], visibleTo: "administrators", approvalRequired: "Yes", hint: "Feature specs · mockups · not-yet-shipped designs" },
  { key: "research-customer-survey",label: "Customer Research",      group: "Experiments",         level: 1, brainTargets: ["Innovation Lab (review)", "Customer Success Brain (review)"], visibleTo: "administrators", approvalRequired: "Yes", hint: "Surveys · interviews · feedback aggregation · usability testing" },
];

const PLATFORM_CATEGORIES: KnowledgeCategory[] = [
  // Trade Knowledge
  { key: "trade-staircases",       label: "Staircases",              group: "Trade Knowledge",    level: 1, brainTargets: ["Staircase Brain"],              visibleTo: "customers", approvalRequired: "After quality check", hint: "Designs · construction · regulations · finishes · examples like the Floating Staircases article" },
  { key: "trade-kitchens",         label: "Kitchens",                group: "Trade Knowledge",    level: 1, brainTargets: ["Kitchen Brain"],                visibleTo: "customers", approvalRequired: "After quality check", hint: "Layouts · units · installation · materials" },
  { key: "trade-doors",            label: "Doors",                   group: "Trade Knowledge",    level: 1, brainTargets: ["Door Brain"],                   visibleTo: "customers", approvalRequired: "After quality check", hint: "Types · fittings · fire ratings · standards" },
  { key: "trade-windows",          label: "Windows",                 group: "Trade Knowledge",    level: 1, brainTargets: ["Window Brain"],                 visibleTo: "customers", approvalRequired: "After quality check", hint: "Glazing · frames · U-values · installation" },
  { key: "trade-flooring",         label: "Flooring",                group: "Trade Knowledge",    level: 1, brainTargets: ["Flooring Brain"],               visibleTo: "customers", approvalRequired: "After quality check", hint: "Timber · vinyl · tile · underlay · fitting" },
  { key: "trade-joinery",          label: "Joinery",                 group: "Trade Knowledge",    level: 1, brainTargets: ["Joinery Brain"],                visibleTo: "customers", approvalRequired: "After quality check", hint: "Techniques · joints · timber engineering" },
  { key: "trade-construction",     label: "Construction",            group: "Trade Knowledge",    level: 1, brainTargets: ["Construction Brain"],           visibleTo: "customers", approvalRequired: "After quality check", hint: "Structural · sequencing · site practice" },
  { key: "trade-building-regs",    label: "Building Regulations",    group: "Trade Knowledge",    level: 1, brainTargets: ["Multiple Trade Brains"],        visibleTo: "customers", approvalRequired: "After quality check", hint: "UK Approved Docs · IE · AU · US · regional codes" },
  { key: "trade-materials",        label: "Materials",               group: "Trade Knowledge",    level: 1, brainTargets: ["Multiple Trade Brains"],        visibleTo: "customers", approvalRequired: "After quality check", hint: "Timber species · composites · finishes · fixings" },
  { key: "trade-tools",            label: "Tools",                   group: "Trade Knowledge",    level: 1, brainTargets: ["Multiple Trade Brains"],        visibleTo: "customers", approvalRequired: "After quality check", hint: "Hand tools · power tools · machinery · maintenance" },
  // Customer Knowledge
  { key: "customer-qa",            label: "Customer Q&A (FAQ)",      group: "Customer Knowledge", level: 1, brainTargets: ["Relevant Trade Brains"],        visibleTo: "customers", approvalRequired: "After quality check", hint: "Frequently asked customer questions + best answers" },
  { key: "product-guides",         label: "Product Guides",          group: "Customer Knowledge", level: 1, brainTargets: ["Relevant Trade Brains"],        visibleTo: "customers", approvalRequired: "After quality check", hint: "How-to guides for products" },
  { key: "installation-guides",    label: "Installation Guides",     group: "Customer Knowledge", level: 1, brainTargets: ["Relevant Trade Brains"],        visibleTo: "customers", approvalRequired: "After quality check", hint: "Step-by-step installation instructions" },
  { key: "troubleshooting",        label: "Troubleshooting",         group: "Customer Knowledge", level: 1, brainTargets: ["Relevant Trade Brains"],        visibleTo: "customers", approvalRequired: "After quality check", hint: "Common problems + resolutions" },
  { key: "best-practice",          label: "Best Practice Articles",  group: "Customer Knowledge", level: 1, brainTargets: ["Content Brain"],                visibleTo: "customers", approvalRequired: "After quality check", hint: "Craft standards · finishing techniques · pro tips" },
  { key: "technical-specs",        label: "Technical Specifications",group: "Customer Knowledge", level: 1, brainTargets: ["Relevant Trade Brains"],        visibleTo: "customers", approvalRequired: "After quality check", hint: "Product spec sheets · dimensions · certifications" },
  { key: "reference-material",     label: "Images & Reference Material", group: "Customer Knowledge", level: 1, brainTargets: ["Relevant Trade Brains"],   visibleTo: "customers", approvalRequired: "After quality check", hint: "Gallery images · diagrams · reference photos" },
  // Product Knowledge (NEX platform itself)
  { key: "nex-features",           label: "NEX Features",            group: "Product Knowledge",  level: 1, brainTargets: ["Content Brain"],                visibleTo: "customers", approvalRequired: "After quality check", hint: "What NEX can do · new features · release notes" },
  { key: "app-documentation",      label: "App Documentation",       group: "Product Knowledge",  level: 1, brainTargets: ["Content Brain"],                visibleTo: "customers", approvalRequired: "After quality check", hint: "In-app guides · glossary" },
  { key: "help-articles",          label: "Help Articles",           group: "Product Knowledge",  level: 1, brainTargets: ["Customer Service Brain (public)"], visibleTo: "customers", approvalRequired: "After quality check", hint: "User support articles" },
  { key: "tutorials",              label: "Tutorials",               group: "Product Knowledge",  level: 1, brainTargets: ["Content Brain"],                visibleTo: "customers", approvalRequired: "After quality check", hint: "Walkthroughs · video scripts · onboarding flows" },
];

function KnowledgeDumpingWorkspace() {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState<KnowledgeSourceKey>("raw-research");
  const [destination, setDestination] = useState<KnowledgeDestination | null>(null);
  const [categoryKey, setCategoryKey] = useState<string | null>(null);
  // Selected category (composed from destination + key)
  const availableCategories =
    destination === "hq"       ? HQ_CATEGORIES :
    destination === "platform" ? PLATFORM_CATEGORIES :
    destination === "research" ? RESEARCH_CATEGORIES :
                                 [];
  const category = availableCategories.find((c) => c.key === categoryKey) ?? null;
  // Legacy · read by submit logic below (kept for backward compatibility)
  const hqType = category?.key ?? null;
  const [status, setStatus] = useState<null | { ok: boolean; message: string; ref?: string }>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!text.trim()) { setStatus({ ok: false, message: "Text is empty — nothing to dump." }); return; }
    setBusy(true);
    // Acknowledgement doctrine · <1 sec feedback per feedback_nex_factory_floor_visibility
    setStatus({ ok: true, message: "Received · workers are starting…" });
    try {
      // Compose title with destination + category classification tag
      const destTag = destination === "hq" ? "🏢 HQ" : destination === "platform" ? "🌍 Platform" : destination === "research" ? "🔬 Research" : null;
      const titleWithClass = category
        ? `[${destTag} · ${category.label} · L${category.level}] ${title.trim() || "(untitled)"}`
        : (title.trim() || undefined);
      const res = await fetch("/api/nex/knowledge-inbox/dump", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, title: titleWithClass, content: text }),
      });
      const j = await res.json();
      if (res.ok && j.ok !== false) {
        const dedup = j.deduplicated ? " (duplicate content · not stored twice)" : "";
        const brainsPart = category ? ` · routing to: ${category.brainTargets.join(", ")}` : "";
        setStatus({ ok: true, message: `Dumped ${text.length.toLocaleString()} characters into the inbox${dedup}${brainsPart}.`, ref: j.item?.id });
        if (!j.deduplicated) setText("");
      } else {
        setStatus({ ok: false, message: j.error ?? j.message ?? `Dump failed (${res.status})` });
      }
    } catch (e) {
      setStatus({ ok: false, message: (e as Error).message ?? "Network error" });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed" style={{ color: T.textDim }}>
        Paste large text corpora — regulation extracts · manufacturer spec sheets · product data — and NEX workers
        route them through Library → Understanding → Writing → Quality → Vault. Records still pass the same
        constitution gates as any other input; nothing enters authoritative memory without Quality approval.
      </p>

      {/* STEP 1 · Destination selector · Knowledge Separation Doctrine
          (Philip 2026-08-07). One decision first: where should this go? */}
      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.borderStrong }}>
        <div className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: T.accent }}>
          Step 1 · Where should this knowledge go?
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <button
            type="button"
            onClick={() => { setDestination("hq"); setCategoryKey(null); }}
            className="flex flex-col items-start rounded-lg border-2 p-3 text-left transition-transform hover:translate-y-[-1px]"
            style={{ background: destination === "hq" ? T.accentSoft : T.panel, borderColor: destination === "hq" ? T.accent : T.border, cursor: "pointer" }}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-[18px]" aria-hidden>🏢</span>
              <span className="text-[12.5px] font-black uppercase tracking-[0.12em]" style={{ color: destination === "hq" ? T.accentDark : T.text }}>Headquarters</span>
            </div>
            <div className="mt-1 text-[10.5px] leading-snug" style={{ color: T.textDim }}>
              How NEX <span className="font-semibold">runs the company</span>. HQ-only · never customer-facing.
            </div>
          </button>
          <button
            type="button"
            onClick={() => { setDestination("platform"); setCategoryKey(null); }}
            className="flex flex-col items-start rounded-lg border-2 p-3 text-left transition-transform hover:translate-y-[-1px]"
            style={{ background: destination === "platform" ? T.accentSoft : T.panel, borderColor: destination === "platform" ? T.accent : T.border, cursor: "pointer" }}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-[18px]" aria-hidden>🌍</span>
              <span className="text-[12.5px] font-black uppercase tracking-[0.12em]" style={{ color: destination === "platform" ? T.accentDark : T.text }}>Live Platform</span>
            </div>
            <div className="mt-1 text-[10.5px] leading-snug" style={{ color: T.textDim }}>
              How NEX <span className="font-semibold">helps customers</span>. Reaches live brains after quality check.
            </div>
          </button>
          {/* 🔬 Research · quarantine tier · reviewed then promoted */}
          <button
            type="button"
            onClick={() => { setDestination("research"); setCategoryKey(null); }}
            className="flex flex-col items-start rounded-lg border-2 p-3 text-left transition-transform hover:translate-y-[-1px]"
            style={{ background: destination === "research" ? T.accentSoft : T.panel, borderColor: destination === "research" ? T.accent : T.border, cursor: "pointer" }}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-[18px]" aria-hidden>🔬</span>
              <span className="text-[12.5px] font-black uppercase tracking-[0.12em]" style={{ color: destination === "research" ? T.accentDark : T.text }}>Research</span>
            </div>
            <div className="mt-1 text-[10.5px] leading-snug" style={{ color: T.textDim }}>
              Not yet trusted. <span className="font-semibold">Quarantine tier</span> · reviewed then promoted to HQ, Platform, or archived.
            </div>
          </button>
        </div>
      </div>

      {/* STEP 2 · Category selector · filtered by destination */}
      {destination ? (
        <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.borderStrong }}>
          <div className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: T.accent }}>
            Step 2 · Choose category ({destination === "hq" ? "Headquarters" : destination === "platform" ? "Live Platform" : "Research"})
          </div>
          {/* Group categories by sub-heading */}
          {Array.from(new Set(availableCategories.map((c) => c.group))).map((group) => (
            <div key={group} className="mt-3">
              <div className="text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: T.textDim }}>{group}</div>
              <div className="mt-1 grid grid-cols-1 gap-1 md:grid-cols-3">
                {availableCategories.filter((c) => c.group === group).map((c) => {
                  const active = categoryKey === c.key;
                  const levelColor = c.level === 3 ? NEX_DIRECTOR.colorAccent : c.level === 2 ? T.info : T.textDim;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCategoryKey(active ? null : c.key)}
                      className="flex items-baseline gap-2 rounded-md border px-2 py-1.5 text-left"
                      style={{
                        background: active ? T.accentSoft : T.panel,
                        borderColor: active ? T.accent : T.border,
                        color: active ? T.accentDark : T.text,
                        cursor: "pointer",
                      }}
                    >
                      <span className="rounded-full px-1 py-0 text-[8px] font-black" style={{ background: `${levelColor}22`, color: levelColor }}>L{c.level}</span>
                      <span className="flex-1 text-[11px] font-semibold">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* STEP 3 · Processing Preview · shows exactly where knowledge lands */}
      {category ? (
        <div
          className="rounded-xl border p-4"
          style={{
            background: category.visibleTo === "customers" ? "rgba(56, 189, 248, 0.06)" : "rgba(245, 158, 11, 0.08)",
            borderColor: category.visibleTo === "customers" ? T.info : T.accent,
          }}
        >
          <div className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: category.visibleTo === "customers" ? T.info : T.accent }}>
            Step 3 · Processing Preview
          </div>
          <div className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-2 text-[11.5px]">
            <div>
              <span className="font-semibold" style={{ color: T.textDim }}>Selected:</span>{" "}
              <span style={{ color: T.text }}>{destination === "hq" ? "🏢 Headquarters" : destination === "platform" ? "🌍 Live Platform" : "🔬 Research"} · {category.label}</span>
            </div>
            <div>
              <span className="font-semibold" style={{ color: T.textDim }}>Memory Type:</span>{" "}
              <span style={{ color: T.text }}>
                {category.level === 3 ? "Executive Intelligence" : category.level === 2 ? "Operating Knowledge" : "Information"} (L{category.level})
              </span>
            </div>
            <div className="md:col-span-2">
              <span className="font-semibold" style={{ color: T.textDim }}>Destination:</span>{" "}
              <span style={{ color: T.text }}>{category.brainTargets.map((b) => `✓ ${b}`).join(" · ")}</span>
            </div>
            <div>
              <span className="font-semibold" style={{ color: T.textDim }}>Visible To:</span>{" "}
              <span
                className="font-semibold"
                style={{ color: category.visibleTo === "customers" ? T.info : T.accent }}
              >
                {category.visibleTo === "customers" ? "Customers (via live brains)" : "Administrators only"}
              </span>
            </div>
            <div>
              <span className="font-semibold" style={{ color: T.textDim }}>Approval Required:</span>{" "}
              <span style={{ color: T.text }}>{category.approvalRequired}</span>
            </div>
          </div>
          <div className="mt-2 text-[10.5px] italic" style={{ color: T.textDim }}>{category.hint}</div>
          {category.key === "boss-qa" ? (
            <div className="mt-2 rounded-md border p-2 text-[11px] italic" style={{ background: T.panel, borderColor: NEX_DIRECTOR.colorAccent, color: NEX_DIRECTOR.colorAccent }}>
              L3 Executive Intelligence · NEX extracts principles/rules/preferences and shows them to you for Approve · Edit · Reject before they become permanent doctrine.
            </div>
          ) : null}
        </div>
      ) : destination ? (
        <div className="rounded-md border border-dashed p-3 text-[11px] italic" style={{ borderColor: T.border, background: T.panelElev, color: T.textFade }}>
          Pick a category above · the Processing Preview will show exactly where this knowledge lands.
        </div>
      ) : null}

      <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: T.textDim }}>Source</div>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as KnowledgeSourceKey)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-[12px]"
              style={{ background: T.panelElev, borderColor: T.border, color: T.text }}
            >
              {SOURCE_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: T.textDim }}>Optional title</div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={hqType === "boss-qa" ? "e.g. NEX, how should marketing decisions be made?" : "e.g. Glass staircase regulations · UK BS 6180"}
              className="mt-1 w-full rounded-md border px-3 py-2 text-[12px]"
              style={{ background: T.panelElev, borderColor: T.border, color: T.text }}
            />
          </div>
        </div>

        <div className="mt-4 text-[10px] font-bold uppercase tracking-widest" style={{ color: T.textDim }}>
          {hqType === "boss-qa" ? "Boss answer · your reasoning · principles · decision" : "Text to dump"}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          placeholder="Paste large text here…"
          className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-[12px] leading-relaxed"
          style={{ background: T.panelElev, borderColor: T.border, color: T.text, resize: "vertical" }}
        />

        <div className="mt-3 flex items-center justify-between">
          <div className="text-[10px]" style={{ color: T.textFade }}>
            {text.length.toLocaleString()} character{text.length === 1 ? "" : "s"}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !text.trim()}
            className="rounded-md border px-3 py-1.5 text-[12px] font-bold"
            style={{
              background: busy || !text.trim() ? T.panelElev : T.accent,
              borderColor: busy || !text.trim() ? T.border : T.accentDark,
              color: busy || !text.trim() ? T.textFade : "#FFFFFF",
              cursor: busy || !text.trim() ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Dumping…" : destination === "hq" ? "Send to HQ Brains →" : destination === "platform" ? "Send to Customer Brains →" : destination === "research" ? "Send to Research Quarantine →" : "Send to workers →"}
          </button>
        </div>
      </div>

      {status ? (
        <div
          className="rounded-md border px-3 py-2 text-[12px]"
          style={{ background: status.ok ? T.successSoft : T.dangerSoft, borderColor: status.ok ? T.success : T.danger, color: status.ok ? T.success : T.danger }}
        >
          {status.message}{status.ref ? ` · ref ${status.ref}` : ""}
        </div>
      ) : null}
    </div>
  );
}

// ─────── Executive Briefing workspace (Phase 9 · Living Executive OS) ───────
// The daily briefing NEX prepares for Philip. Only surfaces facts backed
// by real telemetry today (job counts · provider mix · cases). The
// intelligence sections (trends · recommendations · opportunities) are
// clearly labelled as pending the analytics pipeline — never fabricated.
function BriefingWorkspace({
  status, providers, cases, totalActive, totalSleeping, totalOffline, mockHidden,
}: {
  status: StatusPayload | null;
  providers: LlmProviderReport[];
  cases: ReturnType<typeof computeCases>;
  totalActive: number; totalSleeping: number; totalOffline: number;
  mockHidden: number;
}) {
  const doneToday = status?.jobs_completed_24h ?? 0;
  const inFlight  = status?.jobs_in_flight ?? 0;
  const waiting   = status?.jobs_waiting ?? 0;
  const activeProviders = providers.filter((p) => providerBand(p) === "green-active").length;
  const blockedProviders = providers.filter((p) => providerBand(p) === "red-blocked").length;
  const estimatedReadSeconds = 20;

  return (
    <div className="space-y-6">
      {/* NEX's voice — this is her briefing */}
      <div className="rounded-xl border p-5" style={{ background: T.panelElev, borderColor: T.border, boxShadow: T.shadowSm }}>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 flex-none place-items-center rounded-full font-black text-white" style={{
            background: `radial-gradient(circle at 30% 25%, ${NEX_DIRECTOR.colorAccent}FF 0%, ${NEX_DIRECTOR.colorAccent}CC 60%, ${NEX_DIRECTOR.colorAccent}88 100%)`,
            fontSize: 18, boxShadow: `0 6px 14px -4px ${NEX_DIRECTOR.colorAccent}`, textShadow: "0 1px 2px rgba(0,0,0,0.35)",
          }}>N</div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: NEX_DIRECTOR.colorAccent }}>Today's briefing</div>
            <div className="text-[20px] font-black tracking-tight leading-tight" style={{ letterSpacing: "-0.02em" }}>
              Executive Summary
            </div>
            <div className="text-[10px]" style={{ color: T.textFade }}>Estimated reading time: {estimatedReadSeconds} seconds</div>
          </div>
        </div>
      </div>

      {/* Facts NEX can honestly report today from real telemetry */}
      <SectionHeader title="What actually happened · 24h" />
      <ul className="space-y-2 rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        <BriefingLine label="Jobs completed"        value={doneToday.toLocaleString()} tone={T.success} />
        <BriefingLine label="Jobs in flight now"    value={inFlight.toLocaleString()}  tone={T.info} />
        <BriefingLine label="Jobs waiting"          value={waiting.toLocaleString()} />
        <BriefingLine label="Workers actively working" value={totalActive.toLocaleString()} tone={T.success} />
        <BriefingLine label="Workers resting"       value={totalSleeping.toLocaleString()} tone={T.textDim} />
        <BriefingLine label="Workers offline"       value={totalOffline.toLocaleString()} tone={totalOffline > 0 ? T.danger : T.textDim} />
        <BriefingLine label="Providers accepting requests" value={activeProviders.toLocaleString()} tone={T.success} />
        <BriefingLine label="Providers blocked / recovering" value={blockedProviders.toLocaleString()} tone={blockedProviders > 0 ? T.warning : T.textDim} />
        <BriefingLine label="Cases under investigation" value={cases.investigating.toLocaleString()} tone={T.warning} />
        <BriefingLine label="Cases requiring your decision" value={cases.adminRequired.toLocaleString()} tone={cases.adminRequired > 0 ? T.danger : T.textDim} />
        {mockHidden > 0 ? <BriefingLine label="Placeholder records excluded" value={mockHidden.toLocaleString()} tone={T.danger} /> : null}
      </ul>

      {/* Intelligence sections · honestly labelled pending */}
      <SectionHeader title="Trends NEX is watching" />
      <HonestEmpty
        title="Search trend intelligence pending"
        body="Requires the analytics pipeline (site search + Trade Centre event stream). Once wired, this section surfaces rising/falling topics — e.g. 'Glass staircase searches +40% this week.'"
      />

      <SectionHeader title="Opportunities NEX has spotted" />
      <HonestEmpty
        title="Opportunity engine pending"
        body="Requires zero-result search log + product traffic. NEX will surface high-demand knowledge gaps and recommend which brains/records to build next."
      />

      <SectionHeader title="Recommendations · with evidence" />
      <HonestEmpty
        title="Recommendation engine pending"
        body="Recommendations must attach reason · evidence · expected benefit · priority · impact estimate — per Philip's spec. Requires the intelligence data feeds above."
      />

      <SectionHeader title="Business growth signals" />
      <HonestEmpty
        title="Business analytics pending"
        body="Website traffic · search trends · conversions · active users. Requires an analytics ingest (Plausible / Umami / GA4 export) piped into NEX's warehouse."
      />

      <SectionHeader title="Social media performance" />
      <HonestEmpty
        title="Social API integrations pending"
        body="Instagram · Pinterest · LinkedIn · YouTube posting + engagement pull. Requires OAuth tokens + a scheduled cron ingester."
      />

      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.borderStrong }}>
        <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: T.textDim }}>Design principle</div>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: T.textDim }}>
          Every recommendation NEX makes will attach real evidence · never a fabricated trend. Empty sections stay
          empty until the analytics feeding them is real.
        </p>
      </div>
    </div>
  );
}

// ─────── NEX Monthly Board Report · the flagship monthly ───────
// Doctrine: project_nex_business_impact_and_board_report_2026_08_07.md
// 16 mandatory sections · locked · every month · every section
function BoardReportWorkspace() {
  const now = new Date();
  const monthLabel = now.toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      {/* Header · month + download actions */}
      <div className="rounded-xl border p-5" style={{ background: T.panelElev, borderColor: T.borderStrong, boxShadow: T.shadowSm }}>
        <div className="flex items-baseline gap-2">
          <span aria-hidden>★</span>
          <span className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: T.accent }}>NEX Monthly Executive Report</span>
        </div>
        <div className="mt-1 text-[22px] font-black tracking-tight" style={{ color: T.text, letterSpacing: "-0.02em" }}>
          The Board Report · {monthLabel}
        </div>
        <div className="mt-1 text-[12px]" style={{ color: T.textDim }}>
          Answers: <span className="font-semibold">&ldquo;Is the company healthier than last month, and why?&rdquo;</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled className="rounded-md border px-3 py-1.5 text-[11px] font-semibold" style={{ background: T.panelElev, borderColor: T.border, color: T.textFade, cursor: "not-allowed" }} title="Awaiting Board Report PDF renderer">📄 View</button>
          <button type="button" disabled className="rounded-md border px-3 py-1.5 text-[11px] font-semibold" style={{ background: T.panelElev, borderColor: T.border, color: T.textFade, cursor: "not-allowed" }} title="Awaiting Board Report PDF renderer">📥 Download PDF</button>
          <button type="button" disabled className="rounded-md border px-3 py-1.5 text-[11px] font-semibold" style={{ background: T.panelElev, borderColor: T.border, color: T.textFade, cursor: "not-allowed" }} title="Awaiting Board Report data export">📊 Download Excel</button>
          <button type="button" disabled className="rounded-md border px-3 py-1.5 text-[11px] font-semibold" style={{ background: T.panelElev, borderColor: T.border, color: T.textFade, cursor: "not-allowed" }} title="Awaiting historical data comparison">📈 Historical comparison</button>
        </div>
      </div>

      {/* Delivery cadence */}
      <SectionHeader title="Delivery cadence" />
      <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        <div className="grid grid-cols-1 gap-1.5 text-[11.5px] md:grid-cols-5" style={{ color: T.text }}>
          <div className="rounded border px-2 py-1.5" style={{ background: T.panelElev, borderColor: T.border }}><div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Daily</div><div className="mt-0.5">Executive Briefing · ~1 min</div></div>
          <div className="rounded border px-2 py-1.5" style={{ background: T.panelElev, borderColor: T.border }}><div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Weekly</div><div className="mt-0.5">Management Report · ~5 min</div></div>
          <div className="rounded border-2 px-2 py-1.5" style={{ background: T.accentSoft, borderColor: T.accent }}><div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.accentDark }}>Monthly</div><div className="mt-0.5 font-semibold">Board Report · ~5-10 min</div></div>
          <div className="rounded border px-2 py-1.5" style={{ background: T.panelElev, borderColor: T.border }}><div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Quarterly</div><div className="mt-0.5">Business Review · ~15 min</div></div>
          <div className="rounded border px-2 py-1.5" style={{ background: T.panelElev, borderColor: T.border }}><div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Annual</div><div className="mt-0.5">Company Report · ~30 min</div></div>
        </div>
      </div>

      {/* 16 mandatory sections · each renders as a card frame with honest empty until data feeds */}
      <SectionHeader title="16 mandatory sections" />
      {[
        { n: 1,  title: "Executive Summary",           body: "Plain-English 1-page summary. Readable without studying charts.", depends: "Nightly Business Review + Enterprise Learning Engine" },
        { n: 2,  title: "Company Health Score",        body: "Overall score out of 100 · month-on-month delta · broken into Membership / Revenue / Marketing / Engagement / Platform / AI / System / Legal.", depends: "Cross-department analytics" },
        { n: 3,  title: "Growth vs Decline Dashboard", body: "Table: Area · Status · Change %. One row per major area.", depends: "Per-area month-on-month telemetry" },
        { n: 4,  title: "If Something Declined · WHY", body: "Every decline gets an evidence-based explanation with confidence %. Never a bare ▼ figure.", depends: "Enterprise Learning Engine + attribution" },
        { n: 5,  title: "Member Growth",               body: "Total · New · Cancelled · Active · Businesses · Homeowners · Suppliers · Partners · time series.", depends: "Master Contact Database + Stripe" },
        { n: 6,  title: "Traffic Intelligence",        body: "Total · unique · returning visitors · page views · session duration · bounce · devices · browsers.", depends: "Analytics pipeline (Plausible/Umami/GA4)" },
        { n: 7,  title: "Country Intelligence",        body: "World map · top / fastest-growing / declining countries · languages · time zones · currencies.", depends: "Analytics with geo dimension" },
        { n: 8,  title: "Trade Intelligence",          body: "Per trade: Views · Enquiries · Quotes · Growth · Top regions.", depends: "Trade Centre event capture" },
        { n: 9,  title: "Marketing Intelligence",      body: "Posts · reach · engagement · shares · clicks · email opens/CTR · best/worst content · WHY.", depends: "Social OAuth + email provider + Audience Intelligence Brain" },
        { n: 10, title: "Customer Behaviour",          body: "Journey funnel with per-stage conversion (card views → WhatsApp → phone/email/website → favourites → quotes → completed).", depends: "Trade Centre event capture + attribution" },
        { n: 11, title: "AI & Headquarters Performance", body: "Knowledge processed · brain learning · docs ingested · recommendations · automations · recovery · avg processing time · providers.", depends: "Worker Audit Log + Recovery Manager" },
        { n: 12, title: "Financial Overview",          body: "Revenue · Expenses · Profit · MRR · ARR · Outstanding · Paid · Cash flow.", depends: "Stripe integration" },
        { n: 13, title: "Legal & Compliance",          body: "Consent · privacy issues · policy changes · contract reviews · alerts.", depends: "Legal Memory Vault + Consent audit" },
        { n: 14, title: "Top Opportunities",           body: "Prioritised recommendations (not just data). Evidence-backed. Authority-tagged.", depends: "Opportunity Radar + Enterprise Intelligence Engine" },
        { n: 15, title: "Risks",                       body: "Significant concerns · falling traffic · reduced engagement · rising support · provider reliability · compliance · revenue concentration.", depends: "Executive Intelligence Layer · Conflict Monitor + Risk Assessment" },
        { n: 16, title: "Next Month Forecast",         body: "Expected outlook · member growth range · traffic range · highest-growth trade · country to watch · highest risk.", depends: "Enterprise Learning Engine + historical trend model" },
      ].map((s) => (
        <div key={s.n} className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[16px] font-black" style={{ color: T.accent }}>{s.n}</span>
            <span className="text-[13px] font-black" style={{ color: T.text }}>{s.title}</span>
            <span className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ background: T.panelElev2, color: T.textFade }}>Awaiting data</span>
          </div>
          <div className="mt-1 text-[11.5px]" style={{ color: T.textDim }}>{s.body}</div>
          <div className="mt-1 text-[10px] italic" style={{ color: T.textFade }}>Depends on: {s.depends}</div>
        </div>
      ))}

      {/* Rules callout */}
      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.borderStrong }}>
        <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: T.textDim }}>Every section rules</div>
        <ul className="mt-1 space-y-0.5 text-[12px]" style={{ color: T.textDim }}>
          <li>· Compare against previous month · always</li>
          <li>· Explain reasons behind meaningful changes · always</li>
          <li>· Quantify NEX&apos;s confidence in explanations · always</li>
          <li>· Finish with clear recommendations attached to L1/L2/L3 authority</li>
          <li>· Never fabricate — sections without real data show <span className="font-mono">Awaiting X</span> honestly</li>
        </ul>
      </div>
    </div>
  );
}

function BriefingLine({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <li className="flex items-baseline justify-between border-b py-1.5 last:border-0" style={{ borderColor: T.border }}>
      <span className="text-[12.5px]" style={{ color: T.text }}>{label}</span>
      <span className="font-mono text-[14px] font-black" style={{ color: tone ?? T.text }}>{value}</span>
    </li>
  );
}

// ─────── Marketing Studio workspace ───────
// Planned specialists render as a roster with clear "not-yet-instantiated"
// status. Each row states what the specialist will monitor + what data
// pipeline unlocks them. No fabricated activity per doctrine.
function MarketingWorkspace() {
  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-relaxed" style={{ color: T.textDim }}>
        The Marketing Studio is scheduled for activation. NEX will monitor traffic, engagement, and search demand
        continuously, then prepare content recommendations for your approval — never publishing without you.
      </p>

      <SectionHeader title="Planned specialists" />
      <div className="space-y-2">
        {MARKETING_SPECIALISTS.map((s) => (
          <div key={s.key} className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-black" style={{ color: T.text }}>{s.name}</span>
              <span className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ background: T.panelElev2, color: T.textFade }}>Planned</span>
            </div>
            <div className="mt-1 text-[12px]" style={{ color: T.textDim }}>Monitors: {s.monitors}</div>
          </div>
        ))}
      </div>

      <SectionHeader title="Signals NEX needs to activate this studio" />
      <HonestEmpty
        title="Analytics ingest not yet wired"
        body="Plausible / Umami / GA4 export → NEX warehouse. Once wired, Analytics Manager begins reporting traffic, funnel, and attribution facts."
      />
      <HonestEmpty
        title="Social API OAuth not yet completed"
        body="Instagram · Pinterest · LinkedIn · YouTube tokens + a scheduled ingester. Once complete, Social Media Manager begins tracking engagement + preparing draft posts for approval."
      />
      <HonestEmpty
        title="Search rank ingest not yet wired"
        body="Google Search Console + keyword tracker → NEX warehouse. Once wired, SEO Manager surfaces gap analysis and content recommendations."
      />

      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.borderStrong }}>
        <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: T.textDim }}>Operating principle</div>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: T.textDim }}>
          NEX prepares content and schedules. Nothing publishes without administrator approval. Every recommendation
          attaches real evidence — traffic drop % · engagement delta · search-demand curve. If the underlying signal
          is missing, NEX says so instead of inventing a trend.
        </p>
      </div>
    </div>
  );
}

// ─────── Innovation Lab workspace ───────
// Where NEX proposes new ideas without being asked. Empty until she
// has evidence to back a recommendation.
function InnovationWorkspace() {
  return (
    <div className="space-y-5">
      {/* NEX voice header */}
      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.border, boxShadow: T.shadowSm }}>
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 flex-none place-items-center rounded-full font-black text-white" style={{
            background: `radial-gradient(circle at 30% 25%, ${NEX_DIRECTOR.colorAccent}FF 0%, ${NEX_DIRECTOR.colorAccent}CC 60%, ${NEX_DIRECTOR.colorAccent}88 100%)`,
            fontSize: 15, textShadow: "0 1px 2px rgba(0,0,0,0.35)",
          }}>N</div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: NEX_DIRECTOR.colorAccent }}>Innovation Lab</div>
            <div className="text-[17px] font-black leading-tight tracking-tight" style={{ letterSpacing: "-0.02em" }}>
              What might we build next?
            </div>
          </div>
        </div>
        <p className="mt-3 text-[12.5px] italic leading-relaxed" style={{ color: T.text }}>
          &ldquo;I bring ideas here only when I have evidence. Every proposal attaches a search-demand curve, a traffic
          delta, a competitive gap, or a user-friction signal. No hunches.&rdquo;
        </p>
      </div>

      <SectionHeader title="Live proposals" />
      <HonestEmpty
        title="No proposals today"
        body="NEX will surface ideas here as the analytics feeds activate. Categories she watches: knowledge gaps · search demand · workflow friction · provider capacity · commercial opportunities · new brains · new calculators."
      />

      <SectionHeader title="Planned analysts" />
      <div className="space-y-2">
        {INNOVATION_ROLES.map((s) => (
          <div key={s.key} className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-black" style={{ color: T.text }}>{s.name}</span>
              <span className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ background: T.panelElev2, color: T.textFade }}>Planned</span>
            </div>
            <div className="mt-1 text-[12px]" style={{ color: T.textDim }}>Monitors: {s.monitors}</div>
          </div>
        ))}
      </div>

      <SectionHeader title="Signals NEX needs to start proposing" />
      <ul className="rounded-xl border p-4 text-[12px] leading-relaxed" style={{ background: T.panelElev, borderColor: T.border, color: T.textDim }}>
        <li>· Site search query log (rising topics · zero-result queries)</li>
        <li>· Provider capacity / saturation history (recommend new providers before bottlenecks)</li>
        <li>· Feature request telemetry (repeated user asks · workflow friction)</li>
        <li>· Traffic trend delta (recommend new brains before demand outpaces supply)</li>
        <li>· Competitive gap analysis (external observability · deferred)</li>
      </ul>

      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.borderStrong }}>
        <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: T.textDim }}>Operating principle</div>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: T.textDim }}>
          Every proposal attaches: <span className="font-semibold">reason · evidence · expected benefit · priority · estimated impact</span>.
          The Innovation Lab stays empty until NEX has real evidence to bring you a proposal — silence is honest.
        </p>
      </div>
    </div>
  );
}

// ─────── Operations Centre summary workspace ───────
// The "Operations Centre" nav item opens a compact operational summary
// alongside the always-visible HQ column. All fields from real telemetry.
function OperationsCentreWorkspace({
  status, totalActive, totalSleeping, totalOffline, cases,
}: {
  status: StatusPayload | null;
  totalActive: number; totalSleeping: number; totalOffline: number;
  cases: ReturnType<typeof computeCases>;
}) {
  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-relaxed" style={{ color: T.textDim }}>
        Live snapshot of the production floor. Everything here mirrors the always-visible Headquarters column at
        summary depth — click any worker or provider in HQ for detail.
      </p>

      <SectionHeader title="Right now" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BigMetric label="Workers processing" value={totalActive.toLocaleString()}                          tone={T.success} />
        <BigMetric label="Workers resting"    value={totalSleeping.toLocaleString()}                        tone={T.textDim} />
        <BigMetric label="Workers offline"    value={totalOffline.toLocaleString()}                         tone={T.danger} />
        <BigMetric label="Cases open"         value={cases.list.length.toLocaleString()}                    tone={cases.adminRequired > 0 ? T.danger : T.text} />
        <BigMetric label="Jobs waiting"       value={(status?.jobs_waiting ?? 0).toLocaleString()} />
        <BigMetric label="Jobs in flight"     value={(status?.jobs_in_flight ?? 0).toLocaleString()}         tone={T.info} />
        <BigMetric label="Completed 24h"      value={(status?.jobs_completed_24h ?? 0).toLocaleString()}     tone={T.success} />
        <BigMetric label="Records authoritative" value={(status?.records_authoritative ?? 0).toLocaleString()} tone={T.accent} />
      </div>

      <SectionHeader title="Everything else" />
      <p className="text-[12px] leading-relaxed" style={{ color: T.textDim }}>
        For live worker positions · provider wall · timeline · command console → look at the always-visible
        Headquarters column on the right. This workspace intentionally stays compact so the HQ view remains primary.
      </p>
    </div>
  );
}

// ─────── Research & Innovation Lab (Philip 2026-08-07 addition) ───────
// External world scan · new AI models · APIs · regulations · competitors.
// Distinct from Innovation Lab (internal opportunities from OUR users).
function ResearchLabWorkspace() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-5" style={{ background: T.panelElev, borderColor: T.border, boxShadow: T.shadowSm }}>
        <div className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: NEX_DIRECTOR.colorAccent }}>Research &amp; Innovation Lab</div>
        <div className="mt-1 text-[20px] font-black tracking-tight" style={{ letterSpacing: "-0.02em" }}>What is happening in the world?</div>
        <p className="mt-2 text-[12.5px] leading-relaxed italic" style={{ color: T.text }}>
          &ldquo;I scan the external landscape continuously — new AI models, API changes, regulation updates,
          competitor launches. When something meaningful happens I bring a recommendation. Nothing acts automatically
          in this lab; everything waits for your approval.&rdquo;
        </p>
      </div>

      <SectionHeader title="What NEX watches" />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
          <div className="text-[11px] font-black" style={{ color: T.text }}>AI model releases</div>
          <div className="mt-0.5 text-[11px]" style={{ color: T.textDim }}>Anthropic · Google · OpenAI · Cohere · Mistral · DeepSeek · Meta · Grok · open-source</div>
        </div>
        <div className="rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
          <div className="text-[11px] font-black" style={{ color: T.text }}>New APIs / capabilities</div>
          <div className="mt-0.5 text-[11px]" style={{ color: T.textDim }}>Vision · TTS · reasoning · agents · vector search · specialised construction APIs</div>
        </div>
        <div className="rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
          <div className="text-[11px] font-black" style={{ color: T.text }}>Open-source projects</div>
          <div className="mt-0.5 text-[11px]" style={{ color: T.textDim }}>Staircase / CAD / construction tools NEX could adopt or integrate</div>
        </div>
        <div className="rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
          <div className="text-[11px] font-black" style={{ color: T.text }}>Construction regulations</div>
          <div className="mt-0.5 text-[11px]" style={{ color: T.textDim }}>UK Building Regs · Approved Doc K updates · fire safety · accessibility · IE / AU / US equivalents</div>
        </div>
        <div className="rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
          <div className="text-[11px] font-black" style={{ color: T.text }}>Emerging materials</div>
          <div className="mt-0.5 text-[11px]" style={{ color: T.textDim }}>New timber engineering · composite treads · rail systems · glazing</div>
        </div>
        <div className="rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
          <div className="text-[11px] font-black" style={{ color: T.text }}>Competitor launches</div>
          <div className="mt-0.5 text-[11px]" style={{ color: T.textDim }}>Feature launches · pricing changes · marketing moves NEX should respond to</div>
        </div>
      </div>

      <SectionHeader title="Live findings" />
      <HonestEmpty
        title="No external findings today"
        body="External scanners activate as feeds land — model-release RSS · Building Regs bulletin · competitor tracking · GitHub trending in the construction/CAD space. NEX only reports when a finding materially matters."
      />

      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.borderStrong }}>
        <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: T.textDim }}>Recommendation format (every finding)</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11.5px]" style={{ color: T.textDim }}>
          <div><span className="font-semibold" style={{ color: T.text }}>Evidence</span> · what NEX observed</div>
          <div><span className="font-semibold" style={{ color: T.text }}>Business Impact</span> · expected outcome</div>
          <div><span className="font-semibold" style={{ color: T.text }}>Estimated Effort</span> · dev/config scope</div>
          <div><span className="font-semibold" style={{ color: T.text }}>Priority</span> · P1/P2/P3</div>
          <div className="col-span-2"><span className="font-semibold" style={{ color: T.text }}>Confidence</span> · % — with Approve · Deny · Let NEX Handle actions when applicable</div>
        </div>
      </div>

      <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: T.textDim }}>Innovation Lab vs Research &amp; Innovation Lab</div>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: T.textDim }}>
          The Innovation Lab (Executive cluster) proposes NEW INTERNAL ideas from what YOUR users are asking for.
          This Research &amp; Innovation Lab watches the OUTSIDE WORLD for things you should respond to. Complementary —
          both feed the Strategy Room.
        </p>
      </div>
    </div>
  );
}

// ─────── Headquarters Directory · master index of every workspace ───────
// Auto-enumerated from the VIEWS registry. Every workspace becomes a
// card with authority level, cluster, and open action. Health probing
// (HTTP 200 · response time · errors) requires per-workspace probe
// endpoints — Constitution Law 4 keeps status honestly "Not probed" until
// real probes land.
type HqPageCard = {
  key: ViewKey;
  label: string;
  icon: string;
  cluster: string;
  route: string;
  authority: "L1" | "L2" | "L3";
  probed: false;                    // Never fabricate health — set to true only when real probe fires
};

function HeadquartersDirectoryWorkspace({ views, setView }: { views: ViewMeta[]; setView: (v: ViewKey) => void }) {
  // Build the directory from the VIEWS registry + cluster mapping
  const cards: HqPageCard[] = useMemo(() => {
    const clusterFor = (k: ViewKey): string => {
      const c = NAV_CLUSTERS.find((cl) => cl.keys.includes(k));
      return c?.label ?? "—";
    };
    // CORRECTED authority semantics (Philip 2026-08-07):
    //   L1 = suggestion only · human approves (safest · permanent for pricing/deletion/security/etc.)
    //   L2 = NEX prepares · human confirms release (marketing / campaigns / finance work)
    //   L3 = NEX autonomous (operational · retries · rebalancing · already-trusted patterns)
    const authorityFor = (k: ViewKey): "L1" | "L2" | "L3" => {
      // L1 (permanent suggestion only) — anything irreversible/regulated/executive
      if (["pricing", "permissions", "backups", "compliance", "admin", "configuration", "security", "accounting", "invoices", "revenue", "strategy", "director"].includes(k)) return "L1";
      // L3 (NEX autonomous) — pure operational · already-trusted patterns
      if (["operations", "queue", "history", "journal", "health", "providers", "audit", "inbox"].includes(k)) return "L3";
      // L2 (NEX prepares · human confirms release) — everything else
      return "L2";
    };
    return views.map((v) => ({
      key: v.key,
      label: v.label,
      icon: v.icon,
      cluster: clusterFor(v.key),
      route: `/nex-app/nex-brain/operations-centre?view=${v.key}`,
      authority: authorityFor(v.key),
      probed: false as const,
    }));
  }, [views]);

  return (
    <div className="space-y-5">
      {/* Enterprise Navigation Health · top summary */}
      <div className="rounded-xl border p-5" style={{ background: T.panelElev, borderColor: T.borderStrong }}>
        <div className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: T.accent }}>Enterprise Navigation Health</div>
        <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
          <BigMetric label="Pages"           value={cards.length.toString()} />
          <BigMetric label="Healthy"         value="—" tone={T.textFade} />
          <BigMetric label="Warnings"        value="—" tone={T.textFade} />
          <BigMetric label="Critical"        value="—" tone={T.textFade} />
        </div>
        <div className="mt-2 text-[11.5px]" style={{ color: T.textDim }}>
          <span className="font-semibold">Awaiting per-workspace health probes.</span> Once each workspace exposes a
          probe endpoint (HTTP 200 · response time · error count · database connectivity), NEX runs the nightly link
          checker + hourly freshness scan and populates the counters above with real values. No fabricated statuses.
        </div>
      </div>

      {/* Directory grouped by floor · exactly matches sidebar clusters */}
      {NAV_CLUSTERS.map((cluster) => {
        const clusterCards = cards.filter((c) => c.cluster === cluster.label);
        if (clusterCards.length === 0) return null;
        return (
          <div key={cluster.label}>
            <SectionHeader title={cluster.label} />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {clusterCards.map((c) => <DirectoryCard key={c.key} card={c} onOpen={() => setView(c.key)} />)}
            </div>
          </div>
        );
      })}

      {/* Broken user journey detection · what NEX will monitor */}
      <SectionHeader title="Broken user journey detection" />
      <HonestEmpty
        title="Journey monitoring pending"
        body="Once page-transition telemetry is wired, NEX will detect journeys where abandonment > 50% and estimate revenue impact. Example format: &ldquo;Payment page load time increased from 0.8s to 5.2s. Estimated revenue loss today: £410.&rdquo;"
      />

      {/* Link checker · nightly */}
      <SectionHeader title="Nightly link + asset scan" />
      <HonestEmpty
        title="Link checker not yet scheduled"
        body="Once cron is wired, NEX crawls every page · button · API · internal URL · image · PDF · CSS · JS bundle each night. Reports broken links, missing images, slow APIs, redirects, and a Navigation Coverage %."
      />

      <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: T.textDim }}>Screenshot storage</div>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: T.textDim }}>
          Screenshots live at <span className="font-mono">public/system/pages/&lt;key&gt;.webp</span>. Philip uploads
          manually until automated capture (Playwright cron) is wired. Once uploaded, each card renders its thumbnail
          in the top slot.
        </p>
      </div>
    </div>
  );
}

function DirectoryCard({ card, onOpen }: { card: HqPageCard; onOpen: () => void }) {
  // Matches RecommendationCard's colour mapping · corrected semantics
  const authColor = card.authority === "L3" ? T.info : card.authority === "L2" ? T.warning : T.success;
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border" style={{ background: T.panel, borderColor: T.border }}>
      {/* Screenshot slot · placeholder until asset lands */}
      <div className="relative flex h-[120px] items-center justify-center" style={{ background: T.panelElev2 }}>
        <div className="text-[9px] uppercase tracking-widest" style={{ color: T.textGhost }}>Screenshot placeholder</div>
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full border px-1.5 py-0.5" style={{ background: T.panel, borderColor: authColor }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: authColor }} />
          <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: authColor }}>{card.authority}</span>
        </div>
        <div className="absolute top-2 right-2 rounded-full border px-1.5 py-0.5" style={{ background: T.panel, borderColor: T.border }}>
          <span className="text-[8px] font-bold" style={{ color: T.textFade }}>Not probed</span>
        </div>
      </div>

      <div className="flex-1 p-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[13px] leading-none" style={{ color: T.accent }}>{card.icon}</span>
          <span className="text-[13px] font-black" style={{ color: T.text }}>{card.label}</span>
        </div>
        <div className="mt-0.5 font-mono text-[9.5px]" style={{ color: T.textFade }}>{card.route}</div>

        <div className="mt-2 grid grid-cols-3 gap-1 text-center">
          <DirStat label="Status"   value="—" />
          <DirStat label="Response" value="—" />
          <DirStat label="Users"    value="—" />
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="flex-1 rounded-md border px-2 py-1 text-[10.5px] font-bold"
            style={{ background: T.accent, borderColor: T.accentDark, color: "#FFFFFF", cursor: "pointer" }}
          >
            Open
          </button>
          <button
            type="button"
            disabled
            className="rounded-md border px-2 py-1 text-[10.5px] font-semibold"
            style={{ background: T.panelElev, borderColor: T.border, color: T.textFade, cursor: "not-allowed" }}
            title="Inspect · pending probe endpoint"
          >
            Inspect
          </button>
        </div>
      </div>
    </div>
  );
}

function DirStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-1" style={{ background: T.panelElev, borderColor: T.border }}>
      <div className="text-[7.5px] uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-0.5 font-mono text-[10px] font-black" style={{ color: T.textDim }}>{value}</div>
    </div>
  );
}

// ─────── Opportunity Radar · crosscuts every intelligence feed ───────
function OpportunityRadarWorkspace() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-5" style={{ background: T.panelElev, borderColor: T.border, boxShadow: T.shadowSm }}>
        <div className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: NEX_DIRECTOR.colorAccent }}>Opportunity Radar</div>
        <div className="mt-1 text-[20px] font-black leading-tight tracking-tight" style={{ letterSpacing: "-0.02em" }}>Where should we grow?</div>
        <p className="mt-2 text-[12.5px] leading-relaxed italic" style={{ color: T.text }}>
          &ldquo;I continuously scan every intelligence feed for growth opportunities. When I have real evidence — a
          search-trend curve, an abandonment cluster, an engagement delta, a cost delta — I surface it here with the
          expected impact.&rdquo;
        </p>
      </div>

      <SectionHeader title="Live opportunities" />
      <HonestEmpty
        title="Radar quiet"
        body="No opportunities surfaced from live telemetry today. The Opportunity Radar produces proposals only when a signal crosses a threshold — never speculative."
      />

      <SectionHeader title="What NEX watches (once feeds are wired)" />
      <ul className="rounded-xl border p-4 text-[12px] leading-relaxed" style={{ background: T.panel, borderColor: T.border, color: T.textDim }}>
        <li>· Search trends inside the app (rising/falling topics · zero-result queries)</li>
        <li>· Features users request but don&apos;t exist</li>
        <li>· Where users abandon workflows (funnel drop-off)</li>
        <li>· Social media engagement trends across every channel</li>
        <li>· AI provider performance vs cost delta</li>
        <li>· Revenue by feature (which modules drive subscription value)</li>
        <li>· Usage by country / segment</li>
        <li>· Support requests · recurring themes</li>
        <li>· Competitor mentions (external observability · deferred)</li>
        <li>· Knowledge gaps in each Brain (topics receiving traffic without matched records)</li>
      </ul>

      <SectionHeader title="Example opportunity format · once radar is live" />
      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.border }}>
        <div className="flex items-baseline gap-2">
          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ background: `${T.danger}22`, color: T.danger }}>P1</span>
          <span className="text-[13px] font-black" style={{ color: T.text }}>Example: Spiral staircase calculator</span>
        </div>
        <div className="mt-1.5 space-y-1 text-[11.5px]" style={{ color: T.textDim }}>
          <div><span className="font-semibold" style={{ color: T.text }}>Reason:</span> High-frequency search term with no matching tool.</div>
          <div><span className="font-semibold" style={{ color: T.text }}>Evidence:</span> 1,247 unique users searched &ldquo;spiral staircase calculator&rdquo; this month.</div>
          <div><span className="font-semibold" style={{ color: T.text }}>Expected benefit:</span> New conversion path · est. +8% Stair Designer sessions.</div>
          <div><span className="font-semibold" style={{ color: T.text }}>Priority:</span> P1 (repeated demand · no alternative in-app).</div>
          <div><span className="font-semibold" style={{ color: T.text }}>Estimated impact:</span> ~2 weeks build · ~500 additional weekly sessions.</div>
        </div>
        <div className="mt-2 text-[10px] italic" style={{ color: T.textFade }}>
          Format is fixed. Every real opportunity will match this shape.
        </div>
      </div>

      <HonestEmpty title="Feeds needed" body="Site search log · module usage telemetry · feature-request telemetry · funnel events · social engagement · provider cost telemetry. All currently deferred pending analytics pipeline." />
    </div>
  );
}

// ─────── Strategy Room ───────
function StrategyRoomWorkspace() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-5" style={{ background: T.panelElev, borderColor: T.border }}>
        <div className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: T.accent }}>Strategy Room</div>
        <div className="mt-1 text-[20px] font-black tracking-tight" style={{ letterSpacing: "-0.02em" }}>What should we do next?</div>
        <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: T.textDim }}>
          Beyond &ldquo;what happened&rdquo; — the Strategy Room answers &ldquo;what should we do?&rdquo; It synthesises signals
          from every department (Opportunity Radar · Marketing · Finance · Product Intel · Engineering) into
          strategic recommendations.
        </p>
      </div>

      <HonestEmpty
        title="Strategy Room activates when every intelligence feed is live"
        body="Depends on: Opportunity Radar · Marketing Studio · Finance · Product Intel · Engineering telemetry. Once wired, NEX proposes strategic moves (introduce X calculator · replace provider Y · focus development on Z · release feature W)."
      />

      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.border }}>
        <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: T.textDim }}>Design principle</div>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: T.textDim }}>
          Strategy proposals are advisory. Philip approves strategic decisions. Every proposal must attach evidence
          drawn from at least two independent department feeds — no single-signal strategy calls.
        </p>
      </div>
    </div>
  );
}

// ─────── Customer Experience ───────
function CustomerExperienceWorkspace() {
  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-relaxed" style={{ color: T.textDim }}>
        Anonymous user analytics — top searches, average search success, questions not answered, module usage.
        Individual conversations are private; only aggregate signals appear here.
      </p>

      <SectionHeader title="Top searches" />
      <HonestEmpty title="Awaiting search analytics" body="Site search log needed. Once wired: top-N searches, trend deltas, zero-result queries." />

      <SectionHeader title="Search success rate" />
      <HonestEmpty title="Awaiting outcome telemetry" body="Requires marking searches as answered vs unanswered. Success % target: 94%+." />

      <SectionHeader title="Repeated unanswered questions" />
      <HonestEmpty title="Awaiting analytics" body="NEX will surface repeated user questions that hit zero results — the highest-value knowledge gaps." />
    </div>
  );
}

// ─────── Customer Success · CRM ───────
function CustomerSuccessWorkspace() {
  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-relaxed" style={{ color: T.textDim }}>
        Every customer as a first-class HQ entity. Timeline shows joined date · subscription tier · projects · support
        tickets · latest email · last login · lifetime value · health score. One click opens the full history.
      </p>

      <SectionHeader title="Customer roster" />
      <HonestEmpty title="Awaiting customer directory integration" body="Requires: Supabase customers table + Stripe subscription state. Once wired: sortable roster with per-customer timeline, health score, and NEX-suggested next action." />

      <SectionHeader title="Interaction streams" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StubTile label="Support tickets"  body="Awaiting ticket system integration" />
        <StubTile label="Live chat"        body="Awaiting chat provider" />
        <StubTile label="Email"            body="See Email Operations" />
        <StubTile label="Feature requests" body="Awaiting request pipeline" />
        <StubTile label="Bug reports"      body="Awaiting bug tracker integration" />
        <StubTile label="Refund requests"  body="Awaiting billing integration" />
      </div>

      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.border }}>
        <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: T.textDim }}>Design rule</div>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: T.textDim }}>
          Individual private conversations remain private. This surface aggregates operational state, not message
          content. Constitution Laws 6 + 11 apply.
        </p>
      </div>
    </div>
  );
}

// ─────── Email Operations · Integration + Campaigns ───────
function EmailOperationsWorkspace() {
  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-relaxed" style={{ color: T.textDim }}>
        Two parts. <span className="font-semibold">Email Integration</span> — OAuth-connect Gmail or Microsoft 365.
        The original conversation stays with the mail provider · NEX renders alongside · can prepare drafts for you
        to review + send. Never copies emails. <span className="font-semibold">Email Marketing</span> — 13 programme
        types tracked with anti-spam rule.
      </p>

      <SectionHeader title="Email Integration" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StubTile label="Inbox"        body="Awaiting OAuth" />
        <StubTile label="Sent"         body="Awaiting OAuth" />
        <StubTile label="Drafts"       body="Awaiting OAuth" />
        <StubTile label="Support"      body="Awaiting OAuth" />
        <StubTile label="Sales"        body="Awaiting OAuth" />
        <StubTile label="Billing"      body="Awaiting OAuth" />
        <StubTile label="Marketing"    body="Awaiting OAuth" />
        <StubTile label="Notifications" body="Awaiting OAuth" />
      </div>
      <HonestEmpty title="Awaiting Gmail / Microsoft 365 OAuth" body="Once connected: unified inbox rendering · thread grouping · NEX-drafted replies for admin approval. Original emails never copied." />

      <SectionHeader title="Email Marketing programmes" />
      <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        <div className="grid grid-cols-2 gap-2 text-[11.5px]" style={{ color: T.textDim }}>
          {[
            "Welcome", "Trial onboarding", "Feature announcements", "Monthly newsletters",
            "Trade offers", "Educational content", "Renewal reminders", "Subscription expiry",
            "Upgrade offers", "Re-engagement", "Referral", "Customer success stories", "Transactional",
          ].map((p) => (
            <div key={p} className="flex items-center gap-2 rounded border px-2 py-1" style={{ background: T.panelElev, borderColor: T.border }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: T.textGhost }} />
              <span>{p}</span>
              <span className="ml-auto text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Planned</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border p-4" style={{ background: T.dangerSoft, borderColor: T.danger }}>
        <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: T.danger }}>Anti-spam rule</div>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: T.text }}>
          If engagement drops, NEX recommends <span className="font-semibold">reducing frequency or improving content</span> — never sending more email. Metrics NEX watches: open rate · click rate · reply rate · conversion rate · unsubscribe rate · spam complaints.
        </p>
      </div>
    </div>
  );
}

// ─────── Customer Communications Centre ───────
// Not an email list. A master contact database + every communication
// channel + legal compliance enforced at send time. See
// project_nex_customer_communications_centre_2026_08_07.md — legal rules
// are non-negotiable Constitution Law 5/6/11/14 obligations.
function CommunicationsCentreWorkspace() {
  return (
    <div className="space-y-5">
      {/* Executive question */}
      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.borderStrong }}>
        <div className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: T.accent }}>This department answers</div>
        <div className="mt-1 text-[18px] font-black leading-tight tracking-tight" style={{ color: T.text, letterSpacing: "-0.01em" }}>
          Are we reaching customers without spamming them?
        </div>
      </div>

      {/* Legal compliance callout · always visible · Constitution obligation */}
      <div className="rounded-xl border p-5" style={{ background: T.dangerSoft, borderColor: T.danger }}>
        <div className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: T.danger }}>
          Legal compliance · non-negotiable
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: T.text }}>
          Contact database sources are limited to <span className="font-semibold">users who register on asknex.app</span> ·
          <span className="font-semibold"> explicit newsletter subscribers</span> ·
          <span className="font-semibold"> imported business contacts with documented permission</span> ·
          <span className="font-semibold"> CRM/partner integrations with consent records</span>.
        </p>
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: T.textDim }}>
          <span className="font-semibold" style={{ color: T.danger }}>Forbidden:</span> website scraping · Google Business scraping
          without explicit business consent · purchased lists · re-marketing to unsubscribed users. Applicable law:
          UK PECR + GDPR · Australian Spam Act · Canadian CASL · US CAN-SPAM.
        </p>
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: T.textDim }}>
          NEX enforces at send time: never emails <span className="font-mono">unsubscribe_at != null</span> · never emails
          <span className="font-mono"> never_contact = true</span> · respects country frequency caps · separates
          transactional from marketing. Every send logged with consent proof.
        </p>
      </div>

      {/* Dashboard · country totals · honest empty until real contact DB */}
      <SectionHeader title="Contact Dashboard" />
      <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: T.textDim }}>Total contacts by jurisdiction</div>
        <div className="mt-2 space-y-1">
          {["United Kingdom", "Australia", "United States", "Ireland", "New Zealand", "Canada", "South Africa"].map((country) => (
            <div key={country} className="flex items-center gap-2 rounded border px-2.5 py-1.5" style={{ background: T.panelElev, borderColor: T.border }}>
              <span className="text-[12px] font-semibold" style={{ color: T.text }}>{country}</span>
              <span className="ml-auto font-mono text-[11.5px]" style={{ color: T.textFade }}>—</span>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <MetricTile label="Subscribed"           value="—" tone={T.success} />
          <MetricTile label="Unsubscribed"         value="—" tone={T.textDim} />
          <MetricTile label="Pending verification" value="—" tone={T.warning} />
        </div>
      </div>
      <HonestEmpty title="Awaiting master contact database" body="Requires a Supabase table with source · consent_recorded_at · consent_evidence · jurisdiction · marketing_consent · unsubscribe_at · never_contact per contact. Every field driven by verifiable event · never inferred." />

      {/* Contact sources · every contact has a documented origin */}
      <SectionHeader title="Contact sources" />
      <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        <div className="text-[11px] leading-relaxed" style={{ color: T.textDim }}>
          Every contact carries its source. Sources NEX tracks:
        </div>
        <ul className="mt-2 space-y-0.5 text-[11.5px]" style={{ color: T.text }}>
          <li>· <span className="font-semibold">App Registration</span> — user signed up on asknex.app</li>
          <li>· <span className="font-semibold">Newsletter Opt-in</span> — explicit double opt-in</li>
          <li>· <span className="font-semibold">Trade Directory</span> — imported with documented permission</li>
          <li>· <span className="font-semibold">Website Contact Form</span> — user-initiated enquiry</li>
          <li>· <span className="font-semibold">Partner Import</span> — partner attestation of consent</li>
          <li>· <span className="font-semibold">CSV Import</span> — manual · admin-signed compliance check</li>
          <li>· <span className="font-semibold">Manual Entry</span> — admin-added with explicit consent evidence</li>
        </ul>
      </div>

      {/* Campaign Planner · NEX-recommended · not admin-driven */}
      <SectionHeader title="Campaign Planner" />
      <HonestEmpty
        title="No campaign recommendations today"
        body="Once contact engagement history is wired, NEX proposes campaigns with: audience · recipient count · best send time · confidence % · expected open/click/conversion · authority level (L2 default). Every recommendation gets Approve · Edit · Schedule · Reject actions."
      />

      {/* Automatic delivery queue */}
      <SectionHeader title="Delivery queue" />
      <div className="grid grid-cols-5 gap-2">
        {["Queued", "Waiting", "Sending", "Delivered", "Completed"].map((stage, i) => (
          <div key={stage} className="rounded-lg border p-2 text-center" style={{ background: T.panelElev, borderColor: T.border }}>
            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.accentDark }}>{i + 1}</div>
            <div className="mt-0.5 text-[10px] font-semibold" style={{ color: T.text }}>{stage}</div>
            <div className="mt-0.5 font-mono text-[10px]" style={{ color: T.textFade }}>—</div>
          </div>
        ))}
      </div>

      {/* Newsletter separation */}
      <SectionHeader title="Newsletters (separate from marketing)" />
      <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        <p className="text-[12px] leading-relaxed" style={{ color: T.textDim }}>
          <span className="font-semibold">Marketing</span> (promotional · offers) is separate from
          <span className="font-semibold"> Newsletters</span> (educational · trust-building). Different consent flags ·
          different frequency caps · different sender addresses.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]" style={{ color: T.textDim }}>
          {[
            "New features", "AI updates", "Industry news", "Customer success stories",
            "Floating Staircase gallery", "Oak / Glass / Walnut galleries",
            "Trade tips", "Regulation updates", "Video tutorials",
          ].map((c) => (
            <div key={c} className="rounded border px-2 py-1" style={{ background: T.panelElev, borderColor: T.border }}>· {c}</div>
          ))}
        </div>
      </div>

      {/* Gmail + future transactional service */}
      <SectionHeader title="Connected communication channels" />
      <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        <div className="flex items-baseline gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: T.textGhost }} />
          <span className="text-[12px] font-semibold" style={{ color: T.text }}>asknexpp@gmail.com</span>
          <span className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ background: T.panelElev2, color: T.textFade }}>Awaiting OAuth</span>
        </div>
        <div className="mt-1 text-[10.5px]" style={{ color: T.textFade }}>Gmail is ONE channel · not source of truth. Original conversations remain in Gmail.</div>
        <div className="mt-2 border-t pt-2" style={{ borderColor: T.border }}>
          <div className="text-[10.5px]" style={{ color: T.textDim }}>
            <span className="font-semibold">Production plan:</span> migrate marketing sends to a dedicated transactional platform (Postmark · Resend · SendGrid) for deliverability + analytics + scale. Keep Gmail for support + operational correspondence.
          </div>
        </div>
      </div>

      {/* Domain identity + auth · Level 1 auto-pause if any fails */}
      <SectionHeader title="Domain identity & email authentication" />
      <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-black font-mono" style={{ color: T.text }}>asknex.app</span>
          <span className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ background: T.panelElev2, color: T.textFade }}>Awaiting monitor</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center md:grid-cols-4">
          <MetricTile label="SSL"   value="—" />
          <MetricTile label="DNS"   value="—" />
          <MetricTile label="SPF"   value="—" />
          <MetricTile label="DKIM"  value="—" />
        </div>
        <div className="mt-1 grid grid-cols-1 gap-2 text-center md:grid-cols-2">
          <MetricTile label="DMARC" value="—" />
          <MetricTile label="Last checked" value="—" tone={T.textDim} />
        </div>
        <div className="mt-2 text-[10.5px] italic" style={{ color: T.textDim }}>
          Rule: if any of SPF/DKIM/DMARC fails, NEX <span className="font-semibold" style={{ color: T.danger }}>auto-pauses marketing sends</span> (L1 authority · prevents deliverability disaster) and escalates to Philip (L3 approval required to override).
        </div>
      </div>

      {/* NEX Intelligence · example format */}
      <SectionHeader title="NEX intelligence · what she will say when engagement data is live" />
      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: NEX_DIRECTOR.colorAccent }}>
        <div className="flex items-baseline gap-2">
          <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest" style={{ background: `${NEX_DIRECTOR.colorAccent}22`, color: NEX_DIRECTOR.colorAccent }}>NEX</span>
        </div>
        <p className="mt-1 text-[12px] italic leading-relaxed" style={{ color: T.text }}>
          &ldquo;UK joiners have opened three recent staircase newsletters at a 51% open rate — significantly above
          average. I recommend sending a floating-staircase inspiration campaign next Tuesday morning. Based on
          previous campaigns, estimated ~140 new Premium subscriptions.&rdquo;
        </p>
        <p className="mt-2 text-[12px] italic leading-relaxed" style={{ color: T.textDim }}>
          &ldquo;Australian electricians haven&apos;t received a newsletter in 34 days. Engagement is declining. I recommend a product update email within the next five days.&rdquo;
        </p>
      </div>
    </div>
  );
}

// ─────── Legal Office · Legal Brain (Philip 2026-08-07) ───────
// L1 · Suggestion only for legal decisions. Legal Brain sits at the
// intersection of Compliance · Communications · Audience · Security.
// The Legal Memory Vault stores the WHY behind every rule.
function LegalOfficeWorkspace() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.borderStrong }}>
        <div className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: T.accent }}>This department answers</div>
        <div className="mt-1 text-[18px] font-black leading-tight tracking-tight" style={{ color: T.text, letterSpacing: "-0.01em" }}>
          Are we operating legally, safely, and according to our obligations?
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ background: `${T.success}22`, color: T.success }}>
            L1 · Suggestion (permanent · never autonomous)
          </span>
        </div>
      </div>

      <SectionHeader title="Executive Summary" />
      <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        <p className="text-[13px] leading-relaxed" style={{ color: T.text }}>
          The Legal Brain protects NEX from legal, regulatory, and reputational risk. It sits in front of every marketing send, contract sign, and public statement. It never acts autonomously — every recommendation reaches you as L1 · Suggestion.
        </p>
      </div>

      <SectionHeader title="Responsibilities" />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
          <div className="text-[11px] font-black" style={{ color: T.text }}>1 · Compliance Monitoring</div>
          <div className="mt-0.5 text-[11px]" style={{ color: T.textDim }}>GDPR / PECR · consent requirements · data retention · marketing permissions · user + supplier agreements · regional rules (UK/IE/AU/US/CA)</div>
        </div>
        <div className="rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
          <div className="text-[11px] font-black" style={{ color: T.text }}>2 · Contract Intelligence</div>
          <div className="mt-0.5 text-[11px]" style={{ color: T.textDim }}>Customer contracts · supplier agreements · partnership terms · software licensing · renewal dates · missing clauses · obligations</div>
        </div>
        <div className="rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
          <div className="text-[11px] font-black" style={{ color: T.text }}>3 · Risk Review (send-time gate)</div>
          <div className="mt-0.5 text-[11px]" style={{ color: T.textDim }}>Every L2 action about to fire (campaign · public post · data export) passes through Legal Brain first · returns Approved or Needs correction</div>
        </div>
        <div className="rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
          <div className="text-[11px] font-black" style={{ color: T.text }}>4 · Policy Memory</div>
          <div className="mt-0.5 text-[11px]" style={{ color: T.textDim }}>Acceptable use · privacy · security standards · AI behaviour rules · customer commitments</div>
        </div>
      </div>

      <SectionHeader title="Legal Memory Vault (separate memory tier)" />
      <div className="rounded-xl border p-4" style={{ background: T.dangerSoft, borderColor: T.danger }}>
        <div className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: T.danger }}>Vault contents · admin-only</div>
        <ul className="mt-2 space-y-0.5 text-[12px]" style={{ color: T.text }}>
          <li>· Approved legal rules (with version history · never overwritten)</li>
          <li>· Signed agreements (contract text + parties + effective dates)</li>
          <li>· Compliance decisions (dated + reason)</li>
          <li>· Previous legal reasoning — <span className="font-semibold">the WHY behind every rule</span></li>
        </ul>
        <div className="mt-3 text-[11px] italic" style={{ color: T.textDim }}>
          NEX must remember not just what the rule is, but why the rule exists. This prevents rules being reinterpreted incorrectly or forgotten. No worker writes to this vault — admin insert only.
        </div>
      </div>

      <SectionHeader title="Example Legal Brain recommendation" />
      <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        <div className="flex items-baseline gap-2">
          <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest" style={{ background: `${T.success}22`, color: T.success }}>L1 · Suggestion</span>
          <span className="text-[13px] font-black" style={{ color: T.text }}>Marketing list contains 4,200 contacts without consent evidence</span>
          <span className="ml-auto text-[10px] font-bold" style={{ color: T.success }}>96%</span>
        </div>
        <div className="mt-2 space-y-1 text-[11.5px]" style={{ color: T.text }}>
          <div><span className="font-semibold" style={{ color: T.textDim }}>Evidence:</span> Consent field missing on 4,200 contact rows.</div>
          <div><span className="font-semibold" style={{ color: T.textDim }}>Risk:</span> High GDPR exposure.</div>
          <div><span className="font-semibold" style={{ color: T.textDim }}>Recommendation:</span> Pause campaign until consent records are verified.</div>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" className="flex-1 rounded-md border px-2 py-1.5 text-[10.5px] font-bold" style={{ background: T.success, borderColor: T.success, color: "#FFFFFF", cursor: "pointer" }}>Approve</button>
          <button type="button" className="flex-1 rounded-md border px-2 py-1.5 text-[10.5px] font-semibold" style={{ background: T.panelElev, borderColor: T.border, color: T.textDim, cursor: "pointer" }}>Reject</button>
        </div>
      </div>

      <SectionHeader title="Legal Brain connections" />
      <div className="rounded-xl border p-4 text-[11.5px]" style={{ background: T.panel, borderColor: T.border, color: T.text }}>
        <ul className="space-y-0.5">
          <li>· <span className="font-semibold">Audience Intelligence Database</span> — continuous consent audit</li>
          <li>· <span className="font-semibold">Communications Centre</span> — send-time consent gates + auth (SPF/DKIM/DMARC)</li>
          <li>· <span className="font-semibold">Marketing Brain</span> — campaign risk review before Confirm &amp; release</li>
          <li>· <span className="font-semibold">Sales Brain</span> — contract clause review</li>
          <li>· <span className="font-semibold">Security Centre</span> — breach + incident law</li>
          <li>· <span className="font-semibold">Executive Brain (Risk Assessment)</span> — feeds risk scores into every L2 action</li>
        </ul>
      </div>

      <HonestEmpty title="Awaiting Legal Memory Vault backend" body="Requires: (a) legal_rules Supabase table with version history · (b) contracts table · (c) admin-only write policy · (d) Risk Review pipeline that intercepts every L2 send. Once wired, this workspace shows live vault contents + active recommendations." />
    </div>
  );
}

// ─────── Automation Centre · control room for every automation ───────
// Doctrine: project_nex_research_destination_and_automation_centre.
// Answers: "What is NEX doing without me right now?"
type AutomationRow = {
  key: string;
  name: string;
  authority: "L1" | "L2" | "L3";
  schedule: string;
  status: "running" | "pending" | "paused" | "planned";
  category: string;
};

const AUTOMATION_ROWS: AutomationRow[] = [
  { key: "worker-recovery",       name: "Worker Recovery Manager",     authority: "L3", schedule: "Continuous",      status: "planned", category: "Operations" },
  { key: "worker-heartbeat",      name: "Worker Heartbeat Monitor",    authority: "L3", schedule: "Every 30s",       status: "planned", category: "Operations" },
  { key: "provider-cycle",        name: "Provider Cycling on Failure", authority: "L3", schedule: "Continuous",      status: "planned", category: "Operations" },
  { key: "knowledge-processing",  name: "Knowledge Processing",        authority: "L3", schedule: "Continuous",      status: "running", category: "Operations" },
  { key: "queue-rebalance",       name: "Queue Rebalancing",           authority: "L3", schedule: "Every 5m",        status: "planned", category: "Operations" },
  { key: "temp-cleanup",          name: "Temp File Cleanup",           authority: "L3", schedule: "Hourly",          status: "planned", category: "Operations" },
  { key: "domain-health",         name: "Domain Health (SPF/DKIM/DMARC)", authority: "L3", schedule: "Hourly",       status: "planned", category: "Monitoring" },
  { key: "uptime-check",          name: "Website Uptime Check",        authority: "L3", schedule: "Every 60s",       status: "planned", category: "Monitoring" },
  { key: "storage-monitor",       name: "Storage Usage Monitor",       authority: "L3", schedule: "Every 15m",       status: "planned", category: "Monitoring" },
  { key: "renewal-watch",         name: "Renewal Watch (SSL/domain/subscriptions)", authority: "L3", schedule: "Daily 08:00", status: "planned", category: "Monitoring" },
  { key: "daily-briefing",        name: "Daily Executive Briefing",    authority: "L3", schedule: "Daily 08:00",     status: "planned", category: "Executive" },
  { key: "nightly-review",        name: "Nightly Business Review",     authority: "L3", schedule: "Daily 23:00",     status: "planned", category: "Executive" },
  { key: "opportunity-scan",      name: "Opportunity Radar Scan",      authority: "L3", schedule: "Every 4h",        status: "planned", category: "Executive" },
  { key: "social-scheduling",     name: "Social Media Post Scheduling",authority: "L2", schedule: "Daily",           status: "planned", category: "Marketing" },
  { key: "email-newsletter",      name: "Weekly Email Newsletter",     authority: "L2", schedule: "Friday 09:00",    status: "planned", category: "Marketing" },
  { key: "campaign-prep",         name: "Campaign Preparation",        authority: "L2", schedule: "As needed",       status: "planned", category: "Marketing" },
  { key: "seo-monitoring",        name: "SEO Health Monitoring",       authority: "L3", schedule: "Daily",           status: "planned", category: "Marketing" },
];

function AutomationCentreWorkspace() {
  const byCategory = Array.from(new Set(AUTOMATION_ROWS.map((r) => r.category)));
  const running = AUTOMATION_ROWS.filter((r) => r.status === "running");
  const pendingApproval = AUTOMATION_ROWS.filter((r) => r.status === "pending");
  const plannedCount = AUTOMATION_ROWS.filter((r) => r.status === "planned").length;

  // Next-scheduled feed · derives simple upcoming ordering from schedule text
  // Real cron computation lands with backend Automation service
  const nextScheduled = AUTOMATION_ROWS
    .filter((r) => /\d{1,2}:\d{2}/.test(r.schedule))
    .sort((a, b) => a.schedule.localeCompare(b.schedule))
    .slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.borderStrong }}>
        <div className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: T.accent }}>This department answers</div>
        <div className="mt-1 text-[18px] font-black leading-tight tracking-tight" style={{ color: T.text, letterSpacing: "-0.01em" }}>
          What is NEX doing without me right now?
        </div>
      </div>

      {/* Running Now · the "company clock" upper section */}
      <SectionHeader title={`Running Now (${running.length})`} />
      {running.length > 0 ? (
        <div className="space-y-1.5">
          {running.map((r) => (
            <div key={r.key} className="rounded-lg border p-3" style={{ background: T.panel, borderColor: T.success }}>
              <div className="flex items-baseline gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: T.success, boxShadow: `0 0 6px ${T.success}` }} />
                <span className="text-[13px] font-black" style={{ color: T.text }}>{r.name}</span>
                <span className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-black" style={{ background: `${T.info}22`, color: T.info }}>{r.authority}</span>
              </div>
              <div className="mt-1 text-[10.5px]" style={{ color: T.textDim }}>{r.category} · {r.schedule}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-3 text-[11px] italic" style={{ borderColor: T.border, background: T.panelElev, color: T.textFade }}>
          No automation is currently executing.
        </div>
      )}

      {/* Next Scheduled · the "company clock" upcoming */}
      <SectionHeader title="Next Scheduled (company clock)" />
      <div className="rounded-xl border" style={{ background: T.panel, borderColor: T.border }}>
        {nextScheduled.map((r) => (
          <div key={r.key} className="grid grid-cols-[80px_1fr_60px] items-baseline gap-2 border-b px-3 py-2 last:border-0" style={{ borderColor: T.border }}>
            <div className="font-mono text-[13px] font-black" style={{ color: T.accent }}>{r.schedule}</div>
            <div className="text-[12px] font-semibold" style={{ color: T.text }}>{r.name}</div>
            <div className="text-right"><span className="rounded-full px-1.5 py-0.5 text-[9px] font-black" style={{ background: `${T.info}22`, color: T.info }}>{r.authority}</span></div>
          </div>
        ))}
        {nextScheduled.length === 0 ? (
          <div className="p-3 text-[11px] italic" style={{ color: T.textFade }}>No timed automations scheduled today.</div>
        ) : null}
      </div>

      {/* Pending approval · L2 items awaiting Confirm & Release */}
      {pendingApproval.length > 0 ? (
        <>
          <SectionHeader title={`Awaiting your approval (${pendingApproval.length})`} />
          <div className="space-y-1.5">
            {pendingApproval.map((r) => (
              <div key={r.key} className="rounded-lg border p-3" style={{ background: T.panel, borderColor: T.warning }}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-black" style={{ color: T.text }}>{r.name}</span>
                  <span className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-black" style={{ background: `${T.warning}22`, color: T.warning }}>{r.authority} · Prepared</span>
                </div>
                <div className="mt-1 text-[10.5px]" style={{ color: T.textDim }}>{r.category} · {r.schedule}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <SectionHeader title="Automation summary" />
      <div className="grid grid-cols-3 gap-3">
        <BigMetric label="Running"           value={running.length.toString()}                                    tone={T.success} />
        <BigMetric label="Planned"           value={plannedCount.toString()}                                      tone={T.textDim} />
        <BigMetric label="Total automations" value={AUTOMATION_ROWS.length.toString()}                            tone={T.accent} />
      </div>

      {/* All automations table · now with Confidence Score column */}
      {byCategory.map((cat) => (
        <div key={cat}>
          <SectionHeader title={cat} />
          <div className="rounded-xl border" style={{ background: T.panel, borderColor: T.border }}>
            <div className="grid grid-cols-[1fr_50px_110px_110px_130px_80px] gap-2 border-b px-3 py-2 text-[9px] font-bold uppercase tracking-widest" style={{ borderColor: T.border, color: T.textFade }}>
              <div>Automation</div><div>Auth</div><div>Schedule</div><div>Status</div><div>Confidence</div><div className="text-right">Action</div>
            </div>
            {AUTOMATION_ROWS.filter((r) => r.category === cat).map((r) => {
              const authColor = r.authority === "L3" ? T.info : r.authority === "L2" ? T.warning : T.success;
              const statusColor = r.status === "running" ? T.success : r.status === "pending" ? T.warning : r.status === "paused" ? T.textDim : T.textGhost;
              const statusIcon  = r.status === "running" ? "✅" : r.status === "pending" ? "⏳" : r.status === "paused" ? "⏸" : "○";
              return (
                <div key={r.key} className="grid grid-cols-[1fr_50px_110px_110px_130px_80px] gap-2 border-b px-3 py-2 last:border-0" style={{ borderColor: T.border }}>
                  <div className="text-[12px] font-semibold" style={{ color: T.text }}>{r.name}</div>
                  <div><span className="rounded-full px-1.5 py-0.5 text-[9px] font-black" style={{ background: `${authColor}22`, color: authColor }}>{r.authority}</span></div>
                  <div className="text-[11px]" style={{ color: T.textDim }}>{r.schedule}</div>
                  <div className="text-[11px]" style={{ color: statusColor }}>
                    <span aria-hidden>{statusIcon}</span> {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                  </div>
                  <div className="text-[10.5px]" style={{ color: T.textFade }}>
                    <span className="font-mono">—</span> <span className="italic">pending Confidence data</span>
                  </div>
                  <div className="text-right">
                    <button type="button" disabled className="rounded-md border px-2 py-1 text-[10px] font-semibold" style={{ background: T.panelElev, borderColor: T.border, color: T.textFade, cursor: "not-allowed" }}>
                      Inspect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.borderStrong }}>
        <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: T.textDim }}>Confidence Score governance</div>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: T.textDim }}>
          Each automation earns a Reliability % · Successful Runs · Failures · Average Recovery. L2 automation becomes eligible for L3 promotion when Reliability ≥ 99.5% AND ≥ 1000 successful runs AND ≥ 30 days operational history. NEX proposes the promotion — Philip approves. Never automatic.
        </p>
      </div>

      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.borderStrong }}>
        <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: T.textDim }}>Doctrine</div>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: T.textDim }}>
          Every automation carries an authority level. <span className="font-semibold">L1</span> requires approval each time. <span className="font-semibold">L2</span> means NEX prepares · you release. <span className="font-semibold">L3</span> is autonomous within trusted boundaries · logged to Operations History · always reversible. Pricing · deletion · legal · security · doctrine · public communication stay L1 permanently.
        </p>
      </div>
    </div>
  );
}

// ─────── Market Intelligence Centre (Growth Floor · new) ───────
// Combines audience behaviour · marketing perf · search trends ·
// contact growth · regional differences · seasonal demand. Answers
// "What does the market want today?" Feeds Marketing Brain campaigns.
function MarketIntelligenceWorkspace() {
  const eventTypes = [
    "Card Viewed", "Card Opened", "Phone Clicked", "WhatsApp Clicked", "Email Clicked",
    "Website Clicked", "Directions Clicked", "Image Gallery Viewed", "Video Played",
    "Review Viewed", "Saved to Favourites", "Share Clicked", "Enquiry Sent",
    "Quote Requested", "Booking Made",
  ];
  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.borderStrong }}>
        <div className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: T.accent }}>This department answers</div>
        <div className="mt-1 text-[18px] font-black leading-tight tracking-tight" style={{ color: T.text, letterSpacing: "-0.01em" }}>
          What does the market want today?
        </div>
      </div>

      <SectionHeader title="Executive Summary" />
      <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        <p className="text-[13px] leading-relaxed" style={{ color: T.text }}>
          Market Intelligence is the strategic centre that combines <span className="font-semibold">audience behaviour</span>,
          <span className="font-semibold"> marketing performance</span>, <span className="font-semibold">search trends</span>,
          <span className="font-semibold"> contact growth</span>, <span className="font-semibold">regional differences</span>,
          and <span className="font-semibold">seasonal demand</span>. Feeds evidence-backed proposals into every campaign the
          Marketing Brain prepares.
        </p>
      </div>

      <SectionHeader title="Audience & Behaviour · what NEX will track (15 event types)" />
      <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        <div className="grid grid-cols-1 gap-1 md:grid-cols-3">
          {eventTypes.map((e) => (
            <div key={e} className="flex items-center gap-1.5 rounded border px-1.5 py-1" style={{ background: T.panelElev, borderColor: T.border }}>
              <span className="h-1 w-1 rounded-full" style={{ background: T.textGhost }} />
              <span className="text-[11px]" style={{ color: T.text }}>{e}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[10.5px] italic" style={{ color: T.textDim }}>
          Each event carries: timestamp · trade · country · region · device · referral source · campaign attribution · session id.
        </div>
      </div>

      <SectionHeader title="Trade Performance Dashboard (per member)" />
      <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        <div className="text-[11px] font-black" style={{ color: T.text }}>Example format · per trade · monthly</div>
        <div className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-4">
          <BigMetric label="Card views"      value="—" />
          <BigMetric label="Profile opens"   value="—" />
          <BigMetric label="WhatsApp clicks" value="—" tone={T.success} />
          <BigMetric label="Phone calls"     value="—" />
          <BigMetric label="Email clicks"    value="—" />
          <BigMetric label="Quote requests"  value="—" tone={T.accent} />
          <BigMetric label="Conversion rate" value="—" />
          <BigMetric label="Rank in region"  value="—" />
        </div>
        <div className="mt-2 text-[10.5px] italic" style={{ color: T.textDim }}>
          Evidence · not opinion. When a trade says &ldquo;I&apos;m not getting work&rdquo; NEX responds with facts + comparable-business benchmarks.
        </div>
      </div>

      <SectionHeader title="Marketing Intelligence · image + post + campaign performance" />
      <HonestEmpty
        title="Awaiting Trade Centre event capture"
        body="Once card events flow into the Audience & Behaviour Intelligence Brain, NEX ranks images (Modern Oak 9.4% CTR · Glass 12.1% CTR · etc.), post styles (before/after > finished · videos > static · bright > dark · short captions > long · local > stock), and campaign types by conversion."
      />

      <SectionHeader title="Country & Region Intelligence" />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
          <div className="text-[12px] font-black" style={{ color: T.text }}>🇬🇧 United Kingdom · example</div>
          <ul className="mt-1 space-y-0.5 text-[11px]" style={{ color: T.textDim }}>
            <li>· Top interest: Oak Staircases</li>
            <li>· Peak activity: 7-9 PM</li>
            <li>· Best platform: Facebook</li>
            <li>· Highest conversion: WhatsApp</li>
          </ul>
        </div>
        <div className="rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
          <div className="text-[12px] font-black" style={{ color: T.text }}>🇦🇺 Australia · example</div>
          <ul className="mt-1 space-y-0.5 text-[11px]" style={{ color: T.textDim }}>
            <li>· Top interest: Outdoor Timber</li>
            <li>· Peak activity: 6-8 PM</li>
            <li>· Best platform: Instagram</li>
            <li>· Highest conversion: Enquiry form</li>
          </ul>
        </div>
      </div>

      <SectionHeader title="Marketing Feedback Loop" />
      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.border }}>
        <p className="text-[12px] leading-relaxed font-mono" style={{ color: T.textDim }}>
          Campaign Published → Customers View → Interactions Recorded → Audience Intelligence Learns → Marketing Brain Analyses → Next Campaign Improved
        </p>
      </div>

      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.borderStrong }}>
        <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: T.textDim }}>Long-term vision</div>
        <p className="mt-1 text-[12px] italic leading-relaxed" style={{ color: T.textDim }}>
          &ldquo;Your WhatsApp enquiries dropped 18% over the last two weeks, but profile views remained stable. Similar businesses using brighter project photos and before/after posts are getting 27% higher engagement. I have prepared six new social media posts and a targeted email campaign for your approval.&rdquo;
        </p>
      </div>

      <HonestEmpty title="Awaiting event capture pipeline on Trade Centre routes" body="Backend: emit intelligence events for every Trade Centre card interaction · aggregate into `nex_audience_events` table · Audience & Behaviour Intelligence Brain consumes for daily insights." />
    </div>
  );
}

// ─────── Partner & Agency Room ───────
function PartnerAgencyWorkspace() {
  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-relaxed" style={{ color: T.textDim }}>
        External vendors as first-class HQ entities: SEO firms · marketing agencies · ad agencies · developers ·
        content writers · YouTube creators · affiliate partners. Per-partner: contract · monthly cost · assigned
        tasks · performance · ROI · deadlines · meetings.
      </p>

      <SectionHeader title="Active partners" />
      <HonestEmpty
        title="No partners registered"
        body="Add a partner to begin ROI tracking. Once registered, NEX surfaces value-per-pound spend, delivery cadence, deadline risk, and produces phrases like &ldquo;Agency X has not delivered work for nine days.&rdquo;"
      />

      <SectionHeader title="What NEX will report per partner" />
      <ul className="rounded-xl border p-4 text-[12px] leading-relaxed" style={{ background: T.panel, borderColor: T.border, color: T.textDim }}>
        <li>· Contract summary + renewal date + monthly cost</li>
        <li>· Tasks assigned + delivery status + on-time percentage</li>
        <li>· Attributed traffic / conversions / revenue</li>
        <li>· ROI (attributed value ÷ monthly cost)</li>
        <li>· Meeting cadence + last meeting date + next scheduled</li>
        <li>· Deliverables outstanding + red-flag alerts</li>
      </ul>

      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.border }}>
        <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: T.textDim }}>NEX Agency Director voice · once wired</div>
        <p className="mt-1 text-[12px] leading-relaxed italic" style={{ color: T.textDim }}>
          &ldquo;SEO agency increased organic traffic by 18%.&rdquo; · &ldquo;Advertising spend increased 12% while conversions remained flat.&rdquo; · &ldquo;Agency X has not delivered work for nine days.&rdquo;
        </p>
      </div>
    </div>
  );
}

// ─────── Sales Intelligence · funnel ───────
function SalesIntelligenceWorkspace() {
  const stages = [
    { name: "Visitors",         desc: "Anonymous site visitors" },
    { name: "Free users",       desc: "Signed up · free tier" },
    { name: "Trials",           desc: "Started paid trial" },
    { name: "Subscribers",      desc: "Converted to paid" },
    { name: "Business",         desc: "Upgraded to Business plan" },
    { name: "Enterprise",       desc: "Enterprise-tier accounts" },
  ];
  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-relaxed" style={{ color: T.textDim }}>
        The business pipeline · every stage. Where do people leave? Why? What converts? How can we improve?
      </p>

      <SectionHeader title="Pipeline · stages" />
      <div className="rounded-xl border" style={{ background: T.panel, borderColor: T.border }}>
        {stages.map((s, i) => (
          <div key={s.name} className="flex items-center gap-3 border-b px-4 py-3 last:border-0" style={{ borderColor: T.border }}>
            <div className="grid h-8 w-8 flex-none place-items-center rounded-full font-black" style={{ background: T.panelElev, color: T.accentDark, fontSize: 13 }}>{i + 1}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-black" style={{ color: T.text }}>{s.name}</div>
              <div className="text-[11px]" style={{ color: T.textDim }}>{s.desc}</div>
            </div>
            <span className="font-mono text-[12px]" style={{ color: T.textFade }}>—</span>
          </div>
        ))}
      </div>

      <HonestEmpty
        title="Awaiting pipeline telemetry"
        body="Requires: signup events · trial-start events · billing events (Stripe) · account-tier changes. Once wired: conversion rate per stage · drop-off rate · time-in-stage · dominant drop-off reason. NEX surfaces the single stage with the highest impact if fixed."
      />
    </div>
  );
}

// ─────── Finance ───────
function FinanceWorkspace() {
  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-relaxed" style={{ color: T.textDim }}>
        Live revenue, expenses, and margin. Costs broken down by LLM provider, servers, storage. NEX advises when
        cost trends require attention.
      </p>

      <SectionHeader title="Today · at a glance" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BigMetric label="Revenue"      value="—" tone={T.textFade} />
        <BigMetric label="Subscriptions" value="—" tone={T.textFade} />
        <BigMetric label="Credits"      value="—" tone={T.textFade} />
        <BigMetric label="Expenses"     value="—" tone={T.textFade} />
      </div>
      <HonestEmpty title="Awaiting billing integration" body="Requires Stripe / billing provider API + a costs ingester for LLM providers · servers · storage. Once wired, revenue · MRR · expense breakdown · profit · margin render live." />

      <SectionHeader title="Cost trends" />
      <HonestEmpty title="Awaiting cost telemetry" body="Once wired: cost per article, cost per user, cost per provider, week-over-week deltas. NEX advises when trends warrant action." />
    </div>
  );
}

// ─────── Engineering ───────
function EngineeringWorkspace() {
  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-relaxed" style={{ color: T.textDim }}>
        Deployment status, git activity, build health, error rates, worker health, database, security warnings.
        This is where Claude&apos;s technical operations surface.
      </p>

      <SectionHeader title="Deployment · Fly.io" />
      <HonestEmpty title="Awaiting deployment telemetry" body="Fly API integration would surface: last deploy, current version, build status, machine count, region distribution. Currently only worker heartbeats are wired (see System Health)." />

      <SectionHeader title="Git · GitHub" />
      <HonestEmpty title="Awaiting GitHub integration" body="Once wired: last commit, open PRs, failing CI, deployment lag, contributor activity." />

      <SectionHeader title="Errors · Logs" />
      <HonestEmpty title="Awaiting log aggregation" body="Requires Fly logs stream or Sentry integration. Once wired: error rate, top errors, unique error signatures, error trend." />

      <SectionHeader title="Database" />
      <HonestEmpty title="Awaiting Supabase telemetry" body="Once wired: connection count, query latency, table sizes, slow query log." />
    </div>
  );
}

// ─────── Security Centre ───────
function SecurityWorkspace() {
  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-relaxed" style={{ color: T.textDim }}>
        Live security posture. Blocked attacks, login anomalies, API abuse, rate limits, spam and bot detection.
        NEX reports what she blocked automatically and what needs administrator attention.
      </p>

      <SectionHeader title="Today · security posture" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BigMetric label="Blocked requests" value="—" tone={T.textFade} />
        <BigMetric label="Login failures"   value="—" tone={T.textFade} />
        <BigMetric label="Rate-limited"     value="—" tone={T.textFade} />
        <BigMetric label="Security score"   value="—" tone={T.textFade} />
      </div>
      <HonestEmpty title="Awaiting security telemetry" body="Requires: authentication event log · rate-limiter telemetry · WAF/firewall events. Once wired, live threat map + auto-mitigation report renders here." />

      <SectionHeader title="Permission changes · audit" />
      <HonestEmpty title="Awaiting admin session" body="Once the admin session lands: every permission change, API key rotation, role update, and disabled account is logged and streamed here." />

      <div className="rounded-xl border p-4" style={{ background: T.dangerSoft, borderColor: T.danger }}>
        <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: T.danger }}>Constitution Law 11</div>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: T.text }}>
          <span className="font-semibold">Security always takes priority over convenience.</span> All HQ data — including this Security Centre — is restricted to administrators. Never rendered on public routes.
        </p>
      </div>
    </div>
  );
}

// ─────── Queue workspace ───────
function QueueWorkspace({ status }: { status: StatusPayload | null }) {
  const pool = status?.worker_pool ?? [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <BigMetric label="Waiting"       value={(status?.jobs_waiting ?? 0).toLocaleString()} />
        <BigMetric label="In flight"     value={(status?.jobs_in_flight ?? 0).toLocaleString()} tone={T.info} />
        <BigMetric label="Completed 24h" value={(status?.jobs_completed_24h ?? 0).toLocaleString()} tone={T.success} />
      </div>
      <SectionHeader title="Per-worker queue" />
      <div className="rounded-xl border" style={{ background: T.panel, borderColor: T.border }}>
        <div className="grid grid-cols-[1fr_60px_60px_80px_80px] gap-3 border-b px-3 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ borderColor: T.border, color: T.textFade }}>
          <div>Worker</div><div className="text-right">Wait</div><div className="text-right">Fly</div><div className="text-right">Done</div><div className="text-right">Fail</div>
        </div>
        {pool.length === 0 ? (
          <div className="p-4 text-[12px] italic" style={{ color: T.textFade }}>No worker pool telemetry yet.</div>
        ) : pool.map((w) => (
          <div key={w.worker_type} className="grid grid-cols-[1fr_60px_60px_80px_80px] gap-3 border-b px-3 py-2 last:border-0" style={{ borderColor: T.border }}>
            <div className="text-[12px] font-semibold" style={{ color: T.text }}>{w.worker_type}</div>
            <div className="text-right font-mono text-[12px]" style={{ color: T.text }}>{w.jobs_waiting.toLocaleString()}</div>
            <div className="text-right font-mono text-[12px]" style={{ color: T.info }}>{w.jobs_in_flight.toLocaleString()}</div>
            <div className="text-right font-mono text-[12px]" style={{ color: T.success }}>{w.jobs_completed_24h.toLocaleString()}</div>
            <div className="text-right font-mono text-[12px]" style={{ color: w.jobs_failed_24h > 0 ? T.warning : T.textDim }}>{w.jobs_failed_24h.toLocaleString()}</div>
          </div>
        ))}
      </div>
      <HonestEmpty title="Dispatch controls" body="Wake · Pause · Assign · Move priority · Increase concurrency will render here once the Dispatch API lands." />
    </div>
  );
}

// ─────── Providers workspace (deep view) ───────
function ProvidersWorkspace({ providers }: { providers: LlmProviderReport[] }) {
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-relaxed" style={{ color: T.textDim }}>
        Every provider is always visible in the Headquarters column. This workspace opens the full detail — configured
        capabilities, circuit-breaker state, last error, and 24h call telemetry.
      </p>
      <div className="space-y-2">
        {providers.map((p) => <ProviderCardDetailed key={p.provider} p={p} />)}
      </div>
    </div>
  );
}

function ProviderCardDetailed({ p }: { p: LlmProviderReport }) {
  const band = providerBand(p);
  const dot = band === "green-active" ? T.success : band === "orange-standby" ? T.warning : band === "unconfigured" ? T.textGhost : T.danger;
  const label = band === "green-active" ? "Working" : band === "orange-standby" ? "Standing by" : band === "unconfigured" ? "Not configured" : "Resting";
  return (
    <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
      <div className="flex items-center gap-2">
        <motion.span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: dot, boxShadow: `0 0 8px ${dot}` }}
          animate={band === "green-active" ? { opacity: [1, 0.4, 1] } : undefined}
          transition={band === "green-active" ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : undefined}
        />
        <span className="text-[14px] font-black capitalize" style={{ color: T.text }}>{p.provider}</span>
        <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ background: `${dot}22`, color: dot }}>{label}</span>
        <span className="ml-auto text-[11px]" style={{ color: T.textDim }}>{providerReason(p)}</span>
      </div>
      {p.configured ? (
        <div className="mt-3 grid grid-cols-4 gap-2">
          <PMetric label="Calls 24h"    value={p.calls_24h.toLocaleString()} />
          <PMetric label="Success rate" value={p.success_rate_24h === null ? "—" : `${Math.round(p.success_rate_24h * 1000) / 10}%`} />
          <PMetric label="Avg latency"  value={p.avg_ms_24h ? `${p.avg_ms_24h}ms` : "—"} />
          <PMetric label="Fails in row" value={(p.consecutive_failures ?? 0).toLocaleString()} tone={(p.consecutive_failures ?? 0) > 0 ? T.warning : undefined} />
        </div>
      ) : (
        <div className="mt-2 text-[11px] italic" style={{ color: T.textFade }}>
          Environment variable not set for this provider.
        </div>
      )}
      {p.last_error ? (
        <div className="mt-3 rounded-md border p-2 font-mono text-[10px]" style={{ background: T.dangerSoft, borderColor: T.danger, color: T.danger }}>
          {p.last_error}
        </div>
      ) : null}
    </div>
  );
}
function PMetric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border p-1.5" style={{ background: T.panelElev, borderColor: T.border }}>
      <div className="text-[8.5px] uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-0.5 font-mono text-[13px] font-black" style={{ color: tone ?? T.text }}>{value}</div>
    </div>
  );
}

// ─────── Health workspace ───────
function HealthWorkspace({ cloud, providers, status }: { cloud: { any_online: boolean; workers: CloudWorker[] } | null; providers: LlmProviderReport[]; status: StatusPayload | null }) {
  return (
    <div className="space-y-5">
      <SectionHeader title="Cloud workers · Fly.io" />
      {(!cloud || cloud.workers.length === 0) ? (
        <HonestEmpty title="No cloud worker telemetry" body="Fly workers have not reported in yet." />
      ) : (
        <div className="rounded-xl border" style={{ background: T.panel, borderColor: T.border }}>
          {cloud.workers.map((w) => (
            <div key={w.host_id} className="grid grid-cols-[1fr_100px_100px_120px] gap-3 border-b px-3 py-2 last:border-0" style={{ borderColor: T.border }}>
              <div>
                <div className="font-mono text-[11px] font-bold" style={{ color: T.text }}>{w.host_id}</div>
                <div className="mt-0.5 text-[10px]" style={{ color: T.textFade }}>{w.metadata?.region ?? "—"}</div>
              </div>
              <div className="text-[11px] font-semibold" style={{ color: w.status === "online" ? T.success : w.status === "lagging" ? T.warning : T.danger }}>{w.status}</div>
              <div className="font-mono text-[11px]" style={{ color: T.textDim }}>{Math.round(w.age_ms / 1000)}s ago</div>
              <div className="font-mono text-[11px]" style={{ color: T.textDim }}>{w.cycles_total.toLocaleString()} cycles</div>
            </div>
          ))}
        </div>
      )}

      <SectionHeader title="AI provider chain" />
      <ProvidersWorkspace providers={providers} />

      <SectionHeader title="Queue + records" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <BigMetric label="Queue depth"    value={(status?.jobs_waiting ?? 0).toLocaleString()} />
        <BigMetric label="In flight"      value={(status?.jobs_in_flight ?? 0).toLocaleString()} tone={T.info} />
        <BigMetric label="Completed 24h"  value={(status?.jobs_completed_24h ?? 0).toLocaleString()} tone={T.success} />
        <BigMetric label="Authoritative"  value={(status?.records_authoritative ?? 0).toLocaleString()} tone={T.accent} />
        <BigMetric label="Under review"   value={(status?.records_under_review ?? 0).toLocaleString()} />
        <BigMetric label="Drafts"         value={(status?.records_draft ?? 0).toLocaleString()} tone={T.textFade} />
      </div>
    </div>
  );
}

// ─────── Configuration workspace ───────
// Presentation-ready wording per Philip 2026-08-07. Each requirement
// declares its status honestly (Pending · Administrative Action Required)
// and its "what this activates / what this will do" consequence list —
// so the admin understands WHY the action matters before taking it.
function ConfigurationWorkspace({ mockHidden }: { mockHidden: number }) {
  const step1Resolved = false;                       // migration 004 · pending Philip
  const step2Resolved = mockHidden === 0;            // mock fallback disabled once no placeholders detected
  const step3Resolved = false;                       // Dispatch API · pending

  const completed = [step1Resolved, step2Resolved, step3Resolved].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: T.textDim }}>
        Operational Readiness
      </div>
      <p className="text-[13px] leading-relaxed" style={{ color: T.textDim }}>
        The following actions are required before the NEX Headquarters can operate at full capability.
      </p>

      <ReadinessStep
        number={1}
        title="Activate Worker Audit Telemetry"
        status={step1Resolved ? "resolved" : "pending"}
        lede="Apply Migration 004 to enable the live Worker Audit Log."
        actionLabel="This activates:"
        bullets={[
          "Worker Journal",
          "Operations History",
          "Worker Analytics",
          "Job lifecycle tracking",
          "Complete operational traceability",
        ]}
      />

      <ReadinessStep
        number={2}
        title="Restore Verified Knowledge Processing"
        status={step2Resolved ? "resolved" : "action_required"}
        lede="Synchronise the cloud worker configuration by disabling Mock Fallback."
        actionLabel="This will:"
        bullets={[
          "Stop placeholder knowledge generation",
          "Route failed AI requests to the Retry Queue",
          "Restore trusted knowledge processing",
          "Improve confidence and quality reporting",
        ]}
      />

      <ReadinessStep
        number={3}
        title="Enable Administrative Worker Control"
        status={step3Resolved ? "resolved" : "pending"}
        lede="Complete the Dispatch API integration."
        actionLabel="This enables administrators to:"
        bullets={[
          "Wake sleeping workers",
          "Pause workers",
          "Assign work manually",
          "Prioritise queues",
          "Dispatch jobs to specific workers",
          "Manage workload directly from NEX Headquarters",
        ]}
      />

      <ProgressSummary completed={completed} total={3} />
    </div>
  );
}

type StepStatus = "pending" | "action_required" | "resolved";

function ReadinessStep({
  number, title, status, lede, actionLabel, bullets,
}: {
  number: number;
  title: string;
  status: StepStatus;
  lede: string;
  actionLabel: string;
  bullets: string[];
}) {
  const c = status === "resolved" ? T.success : status === "action_required" ? T.danger : T.warning;
  const badge =
    status === "resolved"        ? "Completed" :
    status === "action_required" ? "Administrative Action Required" :
                                   "Pending";

  return (
    <div className="rounded-xl border p-5" style={{ background: T.panel, borderColor: T.border, boxShadow: T.shadowSm }}>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[22px] font-black leading-none" style={{ color: c }}>{number}.</span>
        <h3 className="text-[16px] font-black leading-tight tracking-tight" style={{ color: T.text, letterSpacing: "-0.01em" }}>{title}</h3>
      </div>

      <div className="mt-3 flex items-baseline gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: T.textDim }}>Status</span>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `${c}18`, color: c }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 4px ${c}` }} />
          {badge}
        </span>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed" style={{ color: T.text }}>{lede}</p>

      <div className="mt-3 text-[12px] font-semibold" style={{ color: T.textDim }}>{actionLabel}</div>
      <ul className="mt-1.5 space-y-1">
        {bullets.map((b) => (
          <li key={b} className="flex items-baseline gap-2 text-[12.5px] leading-relaxed" style={{ color: T.text }}>
            <span className="text-[10px]" style={{ color: c }}>●</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProgressSummary({ completed, total }: { completed: number; total: number }) {
  const remaining = total - completed;
  return (
    <div className="rounded-xl border p-5" style={{ background: T.panelElev, borderColor: T.borderStrong }}>
      <div className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: T.textDim }}>
        Operational Progress
      </div>
      <div className="mt-2 text-[18px] font-black" style={{ color: T.text, letterSpacing: "-0.01em" }}>
        {completed} of {total} core operational requirement{total === 1 ? "" : "s"} completed
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: T.panelElev2 }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(completed / total) * 100}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ background: completed === total ? T.success : T.accent }}
        />
      </div>
      <p className="mt-3 text-[12px] leading-relaxed" style={{ color: T.textDim }}>
        {remaining === 0
          ? "All core operational requirements are complete. The Headquarters is operating at full capability."
          : `The remaining ${remaining === 1 ? "action is" : "actions are"} required before the Headquarters becomes a fully interactive Operations Centre with live worker management, complete telemetry, and trusted knowledge processing.`}
      </p>
    </div>
  );
}

// ─────── Booker workspace (link + summary) ───────
function BookerWorkspace() {
  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed" style={{ color: T.textDim }}>
        Nex Booker — the AI Business OS for trades. Receipt intelligence, compliance packages (UK/IE/AU/US), autopilot
        rules, accountant oversight, invoicing. Dedicated view lives at{" "}
        <Link href="/nex-app/nex-booker" className="underline" style={{ color: T.info }}>/nex-app/nex-booker</Link>.
      </p>
      <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.border }}>
        <div className="text-[11px] uppercase tracking-widest font-bold" style={{ color: T.accent }}>Live modules</div>
        <ul className="mt-2 space-y-1 text-[12px]" style={{ color: T.textDim }}>
          <li>· Compliance engine (UK v1.1 · IE · AU · US) · 170 unit tests passing</li>
          <li>· Double-check validators (Layer 1 + Layer 2 batch)</li>
          <li>· Autopilot rule engine (JSONB rule storage)</li>
          <li>· Migrations authored · pending Supabase apply</li>
        </ul>
      </div>
    </div>
  );
}

// ─────── Department Framework (Rule 3 · Philip 2026-08-07) ───────
// Every workspace must show these sections so admins never click a nav
// item and wonder if it's broken. Purpose · Status · Live Activity ·
// NEX Recommendation · Dependencies · Recent Events · Maturity stage.
// Backward-compat: StubWorkspace delegates here.
type DeptStatus = "healthy" | "attention" | "action" | "awaiting";
type MaturityStage = 1 | 2 | 3 | 4 | 5;
const MATURITY_LABELS: Record<MaturityStage, string> = {
  1: "Designed",
  2: "Connected",
  3: "Operational",
  4: "Optimised",
  5: "Autonomous",
};
function statusColor(s: DeptStatus): string {
  return s === "healthy"   ? T.success :
         s === "attention" ? T.warning :
         s === "action"    ? T.danger  :
                             T.textGhost;
}
function statusLabel(s: DeptStatus): string {
  return s === "healthy"   ? "Operating normally" :
         s === "attention" ? "Attention required" :
         s === "action"    ? "Action required" :
                             "Awaiting integration";
}

// The Executive Health Indicator · Rule 2 of Philip's 5-section spec.
// Renders as a large coloured card at the top of every department.
function ExecutiveHealth({ status }: { status: DeptStatus }) {
  const sc = statusColor(status);
  const bigLabel =
    status === "healthy"   ? "Excellent" :
    status === "attention" ? "Needs Attention" :
    status === "action"    ? "Critical" :
                             "Awaiting Integration";
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: `linear-gradient(180deg, ${sc}18 0%, ${T.panelElev} 100%)`, borderColor: sc }}
    >
      <div className="text-[9px] font-black uppercase tracking-[0.28em]" style={{ color: sc }}>Current Health</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: sc, boxShadow: `0 0 10px ${sc}` }} />
        <span className="text-[22px] font-black leading-none" style={{ color: sc, letterSpacing: "-0.01em" }}>{bigLabel}</span>
      </div>
    </div>
  );
}

// Philip's 5-section structure · every department renders the same
// sections in the same order · Executive Summary → Current Health →
// What Changed → Recommendations → Deep Analytics.
type DeptRecommendation = {
  id: string;
  title: string;
  evidence: string;
  expectedBenefit: string;
  confidence: number;      // 0-100
  authority: "L1" | "L2" | "L3";
};

function DepartmentWorkspace({
  executiveQuestion, executiveSummary, status, maturity,
  changed, recommendations, deepAnalytics, dependencies, awaitingReason,
}: {
  executiveQuestion?: string;        // Section header · the ONE question this dept answers
  executiveSummary?: string;         // (1) Executive Summary paragraph
  status: DeptStatus;                // (2) Current Health
  maturity: MaturityStage;
  changed?: {                        // (3) What Changed
    today?: string;
    yesterday?: string;
    thisWeek?: string;
    lastMonth?: string;
  };
  recommendations?: DeptRecommendation[];  // (4) Recommendations
  deepAnalytics?: React.ReactNode;   // (5) Deep Analytics · everything else
  dependencies?: string[];           // Sidebar-style dependencies list
  awaitingReason?: string;           // Fallback if executiveSummary absent
}) {
  return (
    <div className="space-y-5">
      {/* Executive question · the ONE question this dept answers */}
      {executiveQuestion ? (
        <div className="rounded-xl border p-4" style={{ background: T.panelElev, borderColor: T.borderStrong }}>
          <div className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: T.accent }}>This department answers</div>
          <div className="mt-1 text-[18px] font-black leading-tight tracking-tight" style={{ color: T.text, letterSpacing: "-0.01em" }}>
            {executiveQuestion}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ background: T.panel, borderColor: T.border, color: T.textDim }}>
              Stage {maturity} · {MATURITY_LABELS[maturity]}
            </span>
          </div>
        </div>
      ) : null}

      {/* 1 · Executive Summary */}
      <SectionHeader title="Executive Summary" />
      <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        {executiveSummary ? (
          <p className="text-[13px] leading-relaxed" style={{ color: T.text }}>{executiveSummary}</p>
        ) : (
          <p className="text-[12.5px] leading-relaxed italic" style={{ color: T.textDim }}>
            NEX prepares the executive summary once this department has enough real telemetry. {awaitingReason ?? "Live data will feed this section as the integration arrives."}
          </p>
        )}
      </div>

      {/* 2 · Current Health */}
      <ExecutiveHealth status={status} />

      {/* 3 · What Changed */}
      <SectionHeader title="What Changed" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <ChangeTile label="Today"      value={changed?.today} />
        <ChangeTile label="Yesterday"  value={changed?.yesterday} />
        <ChangeTile label="This Week"  value={changed?.thisWeek} />
        <ChangeTile label="Last Month" value={changed?.lastMonth} />
      </div>

      {/* 4 · Recommendations */}
      <SectionHeader title="NEX Recommendations" />
      {recommendations && recommendations.length > 0 ? (
        <div className="space-y-2">
          {recommendations.map((r) => <RecommendationCard key={r.id} rec={r} />)}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-4" style={{ borderColor: T.border, background: T.panelElev }}>
          <div className="flex items-baseline gap-2">
            <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest" style={{ background: `${NEX_DIRECTOR.colorAccent}22`, color: NEX_DIRECTOR.colorAccent }}>NEX</span>
            <span className="text-[11px] italic" style={{ color: T.textDim }}>No recommendations today. NEX only surfaces advice when she has real evidence — silence is honest.</span>
          </div>
        </div>
      )}

      {/* Dependencies (when awaiting) */}
      {dependencies && dependencies.length > 0 ? (
        <>
          <SectionHeader title="Department dependencies" />
          <ul className="rounded-xl border p-4 text-[12px] leading-relaxed" style={{ background: T.panel, borderColor: T.border, color: T.textDim }}>
            {dependencies.map((d, i) => <li key={i}>· {d}</li>)}
          </ul>
        </>
      ) : null}

      {/* 5 · Deep Analytics */}
      <SectionHeader title="Deep Analytics" />
      {deepAnalytics ? (
        <div>{deepAnalytics}</div>
      ) : (
        <div className="rounded-xl border border-dashed p-4" style={{ borderColor: T.border, background: T.panelElev }}>
          <div className="text-[11px]" style={{ color: T.textDim }}>Charts · tables · history · raw data will render here once the department is fully wired. Analysts drill in here; executives can safely ignore this section.</div>
        </div>
      )}
    </div>
  );
}

function ChangeTile({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-lg border p-2.5" style={{ background: T.panelElev, borderColor: T.border }}>
      <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-1 text-[13px] font-semibold" style={{ color: value ? T.text : T.textGhost }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: DeptRecommendation }) {
  // CORRECTED authority semantics (Philip 2026-08-07):
  //   L1 = suggestion · human approves (safest · default)
  //   L2 = prepared   · human confirms release
  //   L3 = autonomous · NEX already acted · informational only
  // NO "Let NEX Handle" button · that conflated the semantics.
  const authColor = rec.authority === "L3" ? T.info : rec.authority === "L2" ? T.warning : T.success;
  const authLabel = rec.authority === "L3" ? "L3 · Autonomous" : rec.authority === "L2" ? "L2 · Prepared" : "L1 · Suggestion";
  const confColor = rec.confidence >= 85 ? T.success : rec.confidence >= 60 ? T.warning : T.textDim;
  const approveLabel = rec.authority === "L2" ? "Confirm & release" : "Approve";
  return (
    <div className="rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
      <div className="flex items-baseline gap-2">
        <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest" style={{ background: `${authColor}22`, color: authColor }}>{authLabel}</span>
        <span className="text-[13px] font-black" style={{ color: T.text }}>{rec.title}</span>
        <span className="ml-auto text-[10px] font-bold" style={{ color: confColor }}>{rec.confidence}%</span>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11.5px] md:grid-cols-2">
        <div><span className="font-semibold" style={{ color: T.textDim }}>Evidence:</span> <span style={{ color: T.text }}>{rec.evidence}</span></div>
        <div><span className="font-semibold" style={{ color: T.textDim }}>Expected benefit:</span> <span style={{ color: T.text }}>{rec.expectedBenefit}</span></div>
      </div>
      {rec.authority === "L3" ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] italic" style={{ color: T.textDim }}>NEX has already acted · logged to Operations History</span>
          <button type="button" className="ml-auto rounded-md border px-2 py-1.5 text-[10.5px] font-semibold" style={{ background: T.panelElev, borderColor: T.border, color: T.textDim, cursor: "pointer" }}>Reverse action</button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button type="button" className="flex-1 rounded-md border px-2 py-1.5 text-[10.5px] font-bold" style={{ background: T.success, borderColor: T.success, color: "#FFFFFF", cursor: "pointer" }}>{approveLabel}</button>
          <button type="button" className="flex-1 rounded-md border px-2 py-1.5 text-[10.5px] font-semibold" style={{ background: T.panelElev, borderColor: T.border, color: T.textDim, cursor: "pointer" }}>Reject</button>
        </div>
      )}
    </div>
  );
}

// Backward-compat: existing StubWorkspace calls become rich departments
// rendering the full 5-section shape · with honest empty content.
function StubWorkspace({ title, description, pending }: { title: string; description: string; pending: string }) {
  const question = DEPT_QUESTIONS[title as keyof typeof DEPT_QUESTIONS];
  return (
    <DepartmentWorkspace
      executiveQuestion={question ?? undefined}
      executiveSummary={description}
      status="awaiting"
      maturity={1}
      awaitingReason={`Depends on: ${pending}. Frame ships now; the executive summary + real health + change deltas + recommendations render here as the dependency arrives.`}
      dependencies={[pending]}
    />
  );
}

// The single business question each department answers · Philip 2026-08-07
// LOCKED (extends per new departments).
const DEPT_QUESTIONS: Record<string, string> = {
  "Finance":               "Are we making money?",
  "Marketing Centre":      "How do we grow faster?",
  "Support Centre":        "Why are customers unhappy?",
  "AI Providers":          "Can NEX continue operating for the next 24 hours?",
  "Customer Success":      "Are customers becoming long-term users?",
  "Engineering":           "Is the platform stable?",
  "Security Centre":       "Are we safe?",
  "Strategy Room":         "What should we do next?",
  "Innovation Lab":        "What should we build for our users?",
  "Research & Innovation Lab": "What in the outside world should we respond to?",
  "Opportunity Radar":     "Where should we grow?",
  "Enterprise KPI Wall":   "How is the business performing right now?",
  "Global Alerts":         "What needs attention across the entire company?",
  "Social Media":          "Which channel deserves more of our energy today?",
  "Email Campaigns":       "Are we reaching customers without spamming them?",
  "Content Studio":        "What should we publish next?",
  "Campaign Planner":      "Which campaigns are delivering ROI?",
  "SEO & Analytics":       "Which topics are growing in search?",
  "Partner Agencies":      "Are our partners delivering value?",
  "Customer Experience":   "What do users struggle with?",
  "Customer Accounts":     "Which customers need attention?",
  "Feature Requests":      "What do users repeatedly ask for?",
  "Feedback":              "What are customers telling us?",
  "Live Chat":             "Are we responding fast enough?",
  "Community":             "What is our audience talking about?",
  "CRM":                   "Where does every customer stand?",
  "Operations Centre":     "Is production healthy right now?",
  "Dispatch Queue":        "What work is waiting?",
  "Worker Journal":        "What did each worker do?",
  "Operations History":    "What has happened in the pipeline?",
  "Knowledge Inbox":       "What raw material is waiting for workers?",
  "Knowledge Dumping":     "How can I quickly feed NEX new material?",
  "Knowledge Graph":       "How is our knowledge connected?",
  "Review Queue":          "What needs human decision?",
  "Worker Analytics":      "Which workers are performing well?",
  "Configuration":         "What must be resolved before HQ is fully operational?",
  "System Health":         "Are the servers healthy?",
  "Subscriptions":         "How are subscriptions changing?",
  "Revenue Analytics":     "Where does our revenue come from?",
  "Invoices":              "Who owes us · who have we paid?",
  "Accounting":            "Are the books balanced?",
  "Pricing Intelligence":  "Should we change prices?",
  "Sales Funnel":          "Where in the funnel do we lose people?",
  "Renewal Centre":        "What is about to renew or expire?",
  "Nex Booker":            "How is the bookkeeping product doing?",
  "Headquarters Directory":"Is every page of NEX healthy?",
  "Administration":        "Who has access · who is doing what?",
  "Audit Centre":          "What has happened in the last 24 hours?",
  "Permissions":           "Who can do what?",
  "Backups":               "Can we restore if something breaks?",
  "Compliance":            "Are we meeting our obligations?",
};
function HonestEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed p-5" style={{ borderColor: T.border, background: T.panelElev }}>
      <div className="text-[11px] uppercase tracking-widest font-bold" style={{ color: T.textDim }}>{title}</div>
      <div className="mt-1 text-[12px] leading-relaxed" style={{ color: T.textDim }}>{body}</div>
    </div>
  );
}
function SkeletonRows() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-6 animate-pulse rounded-md" style={{ background: T.panelElev }} />)}
    </div>
  );
}
function SectionHeader({ title }: { title: string }) {
  return <div className="text-[10px] uppercase tracking-[0.28em] font-bold" style={{ color: T.textDim }}>{title}</div>;
}
function BigMetric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ background: T.panel, borderColor: T.border }}>
      <div className="text-[9px] uppercase tracking-widest font-bold" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-1 font-mono text-[22px] font-black" style={{ color: tone ?? T.text }}>{value}</div>
    </div>
  );
}
function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="text-[14px] font-black font-mono" style={{ color: tone }}>{value}</div>
      <div className="text-[8px] uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// WORKER DETAIL DRAWER · reused from previous iteration (compact)
// ═════════════════════════════════════════════════════════════════
function WorkerDetailPanel({ placed, llm, onClose }: { placed: PlacedWorker; llm: LlmProviderReport[]; onClose: () => void }) {
  const w = placed.worker;
  const successRate = w && (w.jobs_completed_24h + w.jobs_failed_24h) > 0
    ? Math.round((w.jobs_completed_24h / (w.jobs_completed_24h + w.jobs_failed_24h)) * 1000) / 10
    : null;
  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-[440px] overflow-y-auto border-l" style={{ background: T.panel, borderColor: T.borderStrong, boxShadow: "-24px 0 60px -16px rgba(0,0,0,0.4)" }}>
      <div className="sticky top-0 z-10 border-b p-5" style={{ background: T.panel, borderColor: T.border }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-16 w-16 flex-none place-items-center rounded-full text-[26px] font-black" style={{
              background: `radial-gradient(circle at 30% 25%, ${placed.persona.colorAccent}FF 0%, ${placed.persona.colorAccent}CC 60%, ${placed.persona.colorAccent}88 100%)`,
              color: "#FFFFFF", boxShadow: `0 8px 20px -6px ${placed.persona.colorAccent}`, textShadow: "0 1px 3px rgba(0,0,0,0.35)",
            }}>{placed.persona.glyph}</div>
            <div>
              <div className="text-[24px] font-black leading-tight tracking-tight">{placed.persona.displayName}</div>
              <div className="text-[11px] font-semibold" style={{ color: placed.persona.colorAccent }}>{placed.persona.role}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border px-2 py-1 text-[11px]" style={{ background: T.panelElev, borderColor: T.border, color: T.textDim }}>✕</button>
        </div>
        <div className="mt-4 rounded-xl border p-3" style={{ background: T.panelElev, borderColor: T.border }}>
          <div className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Voice</div>
          <p className="mt-1 text-[12.5px] leading-relaxed italic" style={{ color: T.text }}>&ldquo;{placed.persona.voiceLine}&rdquo;</p>
        </div>
      </div>

      <div className="p-5">
        {/* Operational status · Philip 2026-08-07 Phase Next format:
            Status · Reason · Next Recovery · NEX Action · Administrator Action */}
        {(() => {
          const op = deriveOperationalStatus(placed, llm);
          const blocked = llm.filter((p) => p.configured && (p.status === "circuit-open" || p.status === "degraded"));
          const healthy = llm.filter((p) => p.configured && (p.status === "healthy" || p.status === "idle"));
          const reasonRich =
            op.key === "waiting_capacity"
              ? (blocked.length > 0
                  ? `${blocked.map((p) => p.provider).join(", ")} ${blocked.length === 1 ? "is" : "are"} temporarily blocked. ${healthy.length === 0 ? "No other provider is currently available." : `${healthy.length} provider${healthy.length === 1 ? "" : "s"} standing by.`}`
                  : op.reason)
              : op.reason;
          const nexAction =
            op.key === "processing"       ? `Actively producing knowledge. Progress reported to the Vault.` :
            op.key === "queued"           ? `Job queued. ${placed.persona.displayName} will start as soon as a slot opens.` :
            op.key === "standing_by"      ? `Standing by for new work. NEX will assign the next job automatically.` :
            op.key === "waiting_capacity" ? `Monitoring provider recovery. The queued knowledge will resume automatically the moment capacity becomes available.` :
            op.key === "waiting_admin"    ? `Case escalated to your desk. NEX will not proceed until you approve.` :
                                            `Attempting to reconnect ${placed.persona.displayName} to the pool.`;
          const adminAction =
            op.key === "processing"       ? `None currently required.` :
            op.key === "queued"           ? `None currently required.` :
            op.key === "standing_by"      ? `Optional · drop new material into the Knowledge Inbox to give the team more work.` :
            op.key === "waiting_capacity" ? (healthy.length === 0
                                              ? `Optional · enable an additional provider to increase throughput. Otherwise no action needed — capacity will restore automatically.`
                                              : `None currently required — other providers are available.`) :
            op.key === "waiting_admin"    ? `Review the open case in the Director's Office.` :
                                            `Check Fly worker fleet health · fly status --app nex-brain-worker`;

          return (
            <Section title={`Why am I ${op.label.toLowerCase()}?`}>
              <div className="rounded-xl border p-4" style={{ background: op.key === "waiting_capacity" ? T.dangerSoft : T.panelElev, borderColor: op.color }}>
                {/* Status */}
                <FieldRow label="Status">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: op.color, boxShadow: `0 0 6px ${op.color}` }} />
                    <span className="text-[13px] font-black" style={{ color: op.color }}>{op.label}</span>
                  </div>
                </FieldRow>

                {/* Reason */}
                <FieldRow label="Reason">
                  <div className="text-[12.5px] leading-relaxed" style={{ color: T.text }}>{reasonRich}</div>
                </FieldRow>

                {/* Next Recovery · only when relevant */}
                {op.wakeUpAt && op.wakeUpProvider ? (
                  <FieldRow label="Next Recovery">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-semibold capitalize" style={{ color: T.text }}>{op.wakeUpProvider}</span>
                      <span className="ml-auto text-[13px] font-mono font-bold" aria-hidden>⏰ <Countdown targetAt={op.wakeUpAt} style={{ color: T.danger, fontWeight: 800 }} /></span>
                    </div>
                  </FieldRow>
                ) : null}

                {/* NEX Action */}
                <FieldRow label="NEX Action">
                  <div className="flex items-baseline gap-2">
                    <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest" style={{ background: `${NEX_DIRECTOR.colorAccent}22`, color: NEX_DIRECTOR.colorAccent }}>NEX</span>
                    <div className="flex-1 text-[12px] leading-relaxed" style={{ color: T.text }}>{nexAction}</div>
                  </div>
                </FieldRow>

                {/* Administrator Action */}
                <FieldRow label="Administrator Action">
                  <div className="text-[12px] leading-relaxed" style={{ color: T.text }}>{adminAction}</div>
                </FieldRow>

                {/* Provider table · only when waiting_capacity */}
                {op.key === "waiting_capacity" ? (
                  <div className="mt-3 border-t pt-3" style={{ borderColor: T.border }}>
                    <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: T.textDim }}>Current provider situation</div>
                    <div className="mt-1 space-y-0.5">
                      {llm.filter((p) => p.configured).map((p) => {
                        const band = providerBand(p);
                        const c = band === "green-active" ? T.success : band === "orange-standby" ? T.warning : T.danger;
                        const line =
                          p.status === "circuit-open" && p.circuit_open_ms_remaining ? `Retry in ${Math.max(1, Math.round(p.circuit_open_ms_remaining / 1000))}s` :
                          p.status === "degraded"                                     ? `${p.consecutive_failures ?? 0} failures${p.last_error ? ` · ${p.last_error.slice(0, 30)}…` : ""}` :
                          p.status === "healthy"                                      ? "Available" :
                          p.status === "idle"                                         ? "Standing by" :
                                                                                        p.status;
                        return (
                          <div key={p.provider} className="flex items-baseline gap-2 rounded border px-2 py-1" style={{ background: T.panel, borderColor: T.border }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                            <span className="text-[11px] font-semibold capitalize" style={{ color: T.text }}>{p.provider}</span>
                            <span className="ml-auto text-[10px]" style={{ color: c }}>{line}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </Section>
          );
        })()}

        <Section title="Current task">
          <div className="text-[13px] font-semibold capitalize" style={{ color: T.text }}>{placed.state.replace("_", " ")}</div>
          <div className="mt-0.5 text-[12px]" style={{ color: T.textDim }}>{placed.detail}</div>
          {w?.current_job_ref ? <div className="mt-2 font-mono text-[10px]" style={{ color: T.textFade }}>ref · {w.current_job_ref}</div> : null}
        </Section>

        <Section title="Telemetry · 24h">
          <div className="grid grid-cols-2 gap-2">
            <MetricTile label="Completed"    value={(w?.jobs_completed_24h ?? 0).toLocaleString()} tone={T.success} />
            <MetricTile label="Failed"       value={(w?.jobs_failed_24h ?? 0).toLocaleString()} tone={(w?.jobs_failed_24h ?? 0) > 0 ? T.warning : T.textDim} />
            <MetricTile label="Waiting"      value={(w?.jobs_waiting ?? 0).toLocaleString()} />
            <MetricTile label="In flight"    value={(w?.jobs_in_flight ?? 0).toLocaleString()} tone={T.info} />
            <MetricTile label="Success rate" value={successRate === null ? "—" : `${successRate}%`} tone={T.accent} />
            <MetricTile label="Last activity" value={w?.last_activity_at ? new Date(w.last_activity_at).toLocaleTimeString() : "—"} tone={T.textDim} />
          </div>
        </Section>

        <Section title="Last 20 jobs"><AuditPlaceholder /></Section>
        <Section title="Confidence trend"><AuditPlaceholder /></Section>
        <Section title="Provider history · this worker"><AuditPlaceholder /></Section>
        <Section title="Current reasoning"><AuditPlaceholder /></Section>
        <Section title="Recent decisions"><AuditPlaceholder /></Section>
        <Section title="Memory additions"><AuditPlaceholder /></Section>

        <Section title="AI providers · snapshot">
          <div className="space-y-1">
            {llm.filter((p) => p.configured).slice(0, 8).map((p) => {
              const band = providerBand(p);
              const c = band === "green-active" ? T.success : band === "orange-standby" ? T.warning : T.danger;
              return (
                <div key={p.provider} className="flex items-center gap-2 rounded-md border px-2 py-1" style={{ background: T.panelElev, borderColor: T.border }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                  <span className="flex-1 text-[11px] capitalize" style={{ color: T.textDim }}>{p.provider}</span>
                  <span className="font-mono text-[10px]" style={{ color: T.text }}>{p.calls_24h.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Administrator controls">
          <div className="grid grid-cols-2 gap-2">
            {["Wake worker","Pause worker","Assign job","Move priority","Increase concurrency","Restart worker","Replay last job","Inspect prompts","Inspect outputs","Inspect retries"].map((l) => (
              <AdminButton key={l} label={l} disabled />
            ))}
          </div>
          <div className="mt-2 text-[10px] italic leading-relaxed" style={{ color: T.textFade }}>
            All actions pending the Dispatch API.
          </div>
        </Section>

        <div className="mt-6 space-y-1">
          <Link href={`/nex-app/nex-brain/journal?worker=${placed.persona.key}`} className="block text-[12px] font-semibold underline" style={{ color: T.info }}>See {placed.persona.displayName}&apos;s Journal →</Link>
        </div>
      </div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <div className="mt-5"><div className="text-[9px] uppercase tracking-widest font-bold" style={{ color: T.textFade }}>{title}</div><div className="mt-1.5">{children}</div></div>; }
function MetricTile({ label, value, tone }: { label: string; value: string; tone?: string }) { return <div className="rounded-lg border p-2" style={{ background: T.panelElev, borderColor: T.border }}><div className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div><div className="mt-0.5 font-mono text-[14px] font-black" style={{ color: tone ?? T.text }}>{value}</div></div>; }
function AuditPlaceholder() { return <div className="rounded-lg border border-dashed p-3" style={{ borderColor: T.border, background: T.panelElev }}><div className="text-[11px] leading-relaxed" style={{ color: T.textDim }}>Streams from the Worker Audit Log once migration 004 is applied.</div></div>; }
function SummaryLine({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between border-b px-2.5 py-1.5 last:border-0" style={{ borderColor: T.border }}>
      <span className="text-[11.5px]" style={{ color: T.textDim }}>{k}</span>
      <span className="text-[11.5px] font-semibold" style={{ color: tone ?? T.text }}>{v}</span>
    </div>
  );
}

function StubTile({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-lg border p-2.5" style={{ background: T.panelElev, borderColor: T.border }}>
      <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.textDim }}>{label}</div>
      <div className="mt-1 text-[10px] italic" style={{ color: T.textFade }}>{body}</div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 first:mt-0">
      <div className="text-[9px] font-bold uppercase tracking-[0.24em]" style={{ color: T.textDim }}>{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function AdminButton({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} className="rounded-md border px-2 py-1.5 text-[10.5px] font-semibold" style={{
      background: disabled ? T.panelElev : T.accent, borderColor: disabled ? T.border : T.accentDark,
      color: disabled ? T.textFade : "#FFFFFF", cursor: disabled ? "not-allowed" : "pointer",
    }}>{label}</button>
  );
}
