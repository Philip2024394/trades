// NEX Code Brain · Lane registry
// Registered agent lanes with non-overlapping path prefixes.
// The registry validates that no two lanes claim overlapping paths so
// deterministic routing (longest-prefix) always yields exactly one owner.
//
// Seed lanes reflect the CURRENT reality from the 2026-09-15 workstation
// audit. Twin NEX is registered but pending_activation because it has no
// code yet — this reserves its slot without creating a phantom system.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import type { AgentLane, LaneStatus } from "./types";

const REPO_ROOT = process.cwd();

/**
 * The brain root can be overridden via NEX_CODE_BRAIN_ROOT · used in tests so
 * parallel test files can each own an isolated brain-state directory and never
 * race on lanes.json / leases / assignments / feeds.
 */
export function getBrainDir(): string {
  return process.env.NEX_CODE_BRAIN_ROOT || path.join(REPO_ROOT, "data", "nex-code-brain");
}
function getLanesPath(): string {
  return path.join(getBrainDir(), "lanes.json");
}

const SEED_LANES: readonly AgentLane[] = [
  {
    lane_id: "nex-coding-primary",
    display_name: "NEX1 (coding-team runtime)",
    status: "active",
    owner_agent_ids: ["nex-coding-team-runtime", "MAI"],
    path_prefixes: [
      "src/lib/nex-coding-team/",
      "src/lib/nex-coding-chat/",
      "src/app/api/nex-coding-team/",
      "src/app/api/nex-coding-chat/",
      "src/app/nex1/workstation-live/",
      "scripts/nex-coding-team/",
      "scripts/nex-coding-chat/",
      "data/nex-coding-team/",
      "data/nex-coding-chat/",
    ],
    domain_tags: ["typescript", "coding-pipeline", "chat", "dispatcher", "agents"],
    notes: "Owns the 15-agent coding pipeline + coding chat surface. Established 2026-09-15.",
    registered_at: "2026-09-15T00:00:00.000Z",
  },
  {
    lane_id: "nex-runtime-guardian",
    display_name: "NEX Agent Runtime (nex1/nex2/nex3 + supervisor + orchestrator)",
    status: "active",
    owner_agent_ids: [
      "nex-agent-runtime-nex1",
      "nex-agent-runtime-nex2",
      "nex-agent-runtime-nex3",
      "nex-agent-runtime-supervisor",
      "nex-agent-runtime-orchestrator",
    ],
    path_prefixes: [
      "src/lib/nex-agent-runtime/",
      "scripts/nex-agent-runtime.mjs",
      "data/nex-agent-runtime/",
    ],
    domain_tags: ["mission-runtime", "supervisor", "ed25519", "signed-memory"],
    notes: "Owns the independent-process runtime (WO-RUNTIME-01..13) with 7-layer Ed25519 memory.",
    registered_at: "2026-09-15T00:00:00.000Z",
  },
  {
    lane_id: "nex-code-brain-self",
    display_name: "NEX Code Brain (this module)",
    status: "active",
    owner_agent_ids: ["nex-code-brain-runtime"],
    path_prefixes: ["src/lib/nex-code-brain/", "src/app/api/nex-code-brain/", "data/nex-code-brain/"],
    domain_tags: ["brain", "knowledge", "concurrency", "leases"],
    notes: "The Code Brain owns itself. Prevents recursive collision.",
    registered_at: "2026-09-15T00:00:00.000Z",
  },
  {
    lane_id: "nex-security",
    display_name: "NEX Security scanner + integrity",
    status: "active",
    owner_agent_ids: ["nex-security-scanner"],
    path_prefixes: ["src/lib/nex-security/", "src/app/api/nex-security/", "data/nex-security/"],
    domain_tags: ["security", "signatures", "integrity"],
    notes: "Owns signature scanner + integrity manifest.",
    registered_at: "2026-09-15T00:00:00.000Z",
  },
  {
    lane_id: "nex-migration",
    display_name: "NEX Migration engine (TS→SQL DDL)",
    status: "active",
    owner_agent_ids: ["nex-migration-engine"],
    path_prefixes: [
      "src/lib/nex-migration/",
      "src/app/api/nex-migration/",
      "data/nex-migration/",
      "supabase/migrations/",
    ],
    domain_tags: ["sql", "ddl", "postgres", "sqlite", "schema"],
    notes: "Owns TS-interface to SQL DDL pipeline + Supabase migrations. Additive-only.",
    registered_at: "2026-09-15T00:00:00.000Z",
  },
  {
    lane_id: "nex-visual",
    display_name: "NEX Visual (image + video)",
    status: "active",
    owner_agent_ids: ["nex-visual-engine"],
    path_prefixes: [
      "src/lib/nex-image/",
      "src/lib/nex-video/",
      "src/lib/nex/live-chat-completion/image-gen/",
      "src/app/api/nex/image-gen/",
      "src/app/nex-video/",
      "scripts/nex-sd-webui-shim/",
      "scripts/nex-sdxl-generate.py",
      "data/nex-visual-proving/",
      "data/nex-visual-engine-weights/",
    ],
    domain_tags: ["image", "video", "sdxl", "diffusers"],
    notes: "Owns visual engines. Historical Wave Receipt Immutability applies to data/nex-visual-proving/.",
    registered_at: "2026-09-15T00:00:00.000Z",
  },
  {
    lane_id: "nex-workforce",
    display_name: "Walker + acquisition workforce",
    status: "active",
    owner_agent_ids: ["walker-supervisor", "acquisition-workforce-v2"],
    path_prefixes: [
      "scripts/walkers/",
      "scripts/nex-workforce-v2/",
      "scripts/nex-acquisition-workforce/",
      "src/lib/nex-workforce/",
      "src/lib/nex-hq/",
    ],
    domain_tags: ["workforce", "walkers", "acquisition"],
    notes: "v1 acquisition remains but is quarantined per 2026-09-04 gate.",
    registered_at: "2026-09-15T00:00:00.000Z",
  },
  {
    lane_id: "nex-twin",
    display_name: "NEX-Twin (RESERVED slot · no code yet)",
    status: "pending_activation",
    owner_agent_ids: ["nex-twin"],
    // Deliberately empty prefixes — Twin NEX has no owned paths until Founder
    // spec defines them. This slot exists so a future Twin NEX cannot collide
    // by accident with NEX1.
    path_prefixes: [],
    domain_tags: ["twin", "reserved"],
    notes: "Reserved for Twin NEX per Founder direction 2026-09-15. Activate once code exists + Founder assigns path prefixes.",
    registered_at: "2026-09-15T00:00:00.000Z",
  },
];

function ensureBrainDir(): void {
  if (!existsSync(getBrainDir())) mkdirSync(getBrainDir(), { recursive: true });
}

function atomicWrite(abs: string, content: string): void {
  ensureBrainDir();
  const tmp = abs + ".tmp";
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, abs);
}

/** Load current lanes · seeds on first call if the registry file is absent. */
export function loadLanes(): readonly AgentLane[] {
  if (!existsSync(getLanesPath())) {
    seedLanes();
  }
  try {
    return JSON.parse(readFileSync(getLanesPath(), "utf8")) as AgentLane[];
  } catch {
    return SEED_LANES;
  }
}

/** Idempotent · writes seed lanes only if file does not exist. */
export function seedLanes(): void {
  if (existsSync(getLanesPath())) return;
  const problem = validateLanesNonOverlapping(SEED_LANES);
  if (problem) throw new Error(`seed lanes have overlapping prefixes: ${problem}`);
  atomicWrite(getLanesPath(), JSON.stringify(SEED_LANES, null, 2));
}

/** Register a new lane · rejected if it overlaps any existing active lane. */
export function registerLane(lane: AgentLane): { ok: boolean; reason?: string } {
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(lane.lane_id)) {
    return { ok: false, reason: "lane_id must be lowercase alphanumeric with dashes" };
  }
  const current = loadLanes();
  if (current.some((l) => l.lane_id === lane.lane_id)) {
    return { ok: false, reason: `lane_id "${lane.lane_id}" already registered` };
  }
  const candidate: readonly AgentLane[] = [...current, lane];
  const problem = validateLanesNonOverlapping(candidate);
  if (problem) return { ok: false, reason: problem };
  atomicWrite(getLanesPath(), JSON.stringify(candidate, null, 2));
  return { ok: true };
}

/** Update the status of an existing lane · does NOT change path prefixes. */
export function updateLaneStatus(lane_id: string, status: LaneStatus): { ok: boolean; reason?: string } {
  const current = loadLanes();
  const idx = current.findIndex((l) => l.lane_id === lane_id);
  if (idx < 0) return { ok: false, reason: `unknown lane_id: ${lane_id}` };
  const next = current.slice();
  next[idx] = { ...current[idx]!, status };
  atomicWrite(getLanesPath(), JSON.stringify(next, null, 2));
  return { ok: true };
}

/** Look up a lane by id · null if not registered. */
export function findLane(lane_id: string): AgentLane | null {
  return loadLanes().find((l) => l.lane_id === lane_id) ?? null;
}

/**
 * Return the reason if any two lanes claim overlapping path prefixes.
 * Empty-prefix lanes (like pending Twin NEX) never conflict with anyone.
 */
export function validateLanesNonOverlapping(lanes: readonly AgentLane[]): string | null {
  for (let i = 0; i < lanes.length; i++) {
    const a = lanes[i]!;
    for (let j = i + 1; j < lanes.length; j++) {
      const b = lanes[j]!;
      for (const pa of a.path_prefixes) {
        for (const pb of b.path_prefixes) {
          if (prefixesOverlap(pa, pb)) {
            return `overlap: lane "${a.lane_id}" prefix "${pa}" collides with lane "${b.lane_id}" prefix "${pb}"`;
          }
        }
      }
    }
  }
  return null;
}

function prefixesOverlap(a: string, b: string): boolean {
  const na = a.replace(/\\/g, "/");
  const nb = b.replace(/\\/g, "/");
  return na === nb || na.startsWith(nb) || nb.startsWith(na);
}

// Test-only reset · exported so vitest can restore between tests.
export function __resetLanesForTest(): void {
  if (existsSync(getLanesPath())) {
    const { unlinkSync } = require("node:fs") as typeof import("node:fs");
    try {
      unlinkSync(getLanesPath());
    } catch {
      /* nothing */
    }
  }
}

export { getLanesPath };
