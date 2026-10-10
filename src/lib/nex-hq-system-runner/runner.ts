// nex-hq-system-runner · continuous live workforce runner.
//
// WO-AGENT-RUNTIME-01 + WO-LIVE-WORKFORCE-PROOF-01 · 2026-09-13:
//   - Founder key persisted to data/nex-storage/.founder-dev.key so
//     identities survive dev-server restart.
//   - Every agent spawned via superviseAgent (crash isolation + auto-restart).
//   - Envelope dispatcher wired · agents pull authorised missions.
//   - Runner ticks every 15s AND signs new envelopes every 30s.
//   - HQ observer ticks every 60s.
//   - Growth snapshot every 60s.
//
// Founder-locked: this is real continuous execution. Not a fixture.

import { promises as fs } from "node:fs";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { AGENT_REGISTRY } from "@/lib/nex-hq-agents/registry";
import { provisionAllAgents } from "@/lib/nex-agent-runtime/provisioning";
import { superviseAgent, type SupervisorHandle } from "@/lib/nex-agent-runtime/supervisor";
import { makeEnvelopeDispatcher, signMissionEnvelope, persistEnvelope } from "@/lib/nex-agent-runtime/mission-dispatcher";
import { runHeartbeatTick } from "@/lib/nex-hq-heartbeat/monitor";
import { captureGrowthSnapshot, setSnapshotSigner } from "@/lib/nex-agent-runtime/growth-snapshot";
import { captureNexNetGrowthSnapshot, setNexNetGrowthSigner } from "@/lib/nex-agent-runtime/nex-net-growth";
import { signSourceRegistryManifest, persistSourceRegistryManifest, loadLatestSourceRegistryManifest } from "@/lib/nex-intelligence/source-registry-manifest";

// ── Persistent founder key (dev only) ──────────────────────────────────

const FOUNDER_KEY_PATH = path.join(process.cwd(), "data", "nex-storage", ".founder-dev.key");

interface PersistedFounderKey {
  readonly public_key_hex: string;
  readonly private_key_hex: string;
  readonly created_at: string;
}

async function loadOrCreateFounderKey(): Promise<PersistedFounderKey> {
  try {
    const raw = await fs.readFile(FOUNDER_KEY_PATH, "utf8");
    const parsed = JSON.parse(raw) as PersistedFounderKey;
    if (parsed.public_key_hex && parsed.private_key_hex) return parsed;
  } catch { /* file missing or corrupt — regenerate */ }
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const key: PersistedFounderKey = {
    public_key_hex: (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex"),
    private_key_hex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
    created_at: new Date().toISOString(),
  };
  await fs.mkdir(path.dirname(FOUNDER_KEY_PATH), { recursive: true });
  await fs.writeFile(FOUNDER_KEY_PATH, JSON.stringify(key, null, 2));
  return key;
}

// ── Runner state ───────────────────────────────────────────────────────

interface RunnerState {
  started: boolean;
  founder: PersistedFounderKey | null;
  handles: Map<string, SupervisorHandle>;
  tickTimer: NodeJS.Timeout | null;
  envelopeTimer: NodeJS.Timeout | null;
  observerTimer: NodeJS.Timeout | null;
  snapshotTimer: NodeJS.Timeout | null;
  startedAt: string | null;
  ticks: number;
  envelopesSigned: number;
  observerRuns: number;
  snapshotsCaptured: number;
  lastError: string | null;
}

const state: RunnerState = {
  started: false, founder: null, handles: new Map(),
  tickTimer: null, envelopeTimer: null, observerTimer: null, snapshotTimer: null,
  startedAt: null, ticks: 0, envelopesSigned: 0, observerRuns: 0, snapshotsCaptured: 0,
  lastError: null,
};

const TICK_INTERVAL_MS = 15_000;
const ENVELOPE_INTERVAL_MS = 30_000;
const OBSERVER_INTERVAL_MS = 60_000;
const SNAPSHOT_INTERVAL_MS = 60_000;

// ── Public API ─────────────────────────────────────────────────────────

export function isRunning(): boolean { return state.started; }

export function status(): {
  running: boolean; started_at: string | null; agents: number;
  ticks: number; envelopes_signed: number; observer_runs: number; snapshots_captured: number;
  last_error: string | null;
} {
  return {
    running: state.started,
    started_at: state.startedAt,
    agents: state.handles.size,
    ticks: state.ticks,
    envelopes_signed: state.envelopesSigned,
    observer_runs: state.observerRuns,
    snapshots_captured: state.snapshotsCaptured,
    last_error: state.lastError,
  };
}

export async function startRunner(): Promise<{ ok: true; already_running: boolean; agents_spawned: number } | { ok: false; error: string }> {
  if (state.started) return { ok: true, already_running: true, agents_spawned: state.handles.size };
  try {
    // 1. Load or create founder key (persistent across dev restart)
    const founder = await loadOrCreateFounderKey();
    state.founder = founder;

    // 2. Configure growth snapshot signers to use founder key (production discipline)
    setSnapshotSigner({ private_key_hex: founder.private_key_hex, public_key_hex: founder.public_key_hex });
    setNexNetGrowthSigner({ private_key_hex: founder.private_key_hex, public_key_hex: founder.public_key_hex });

    // 2b. WO-SOURCE-GUARDIAN-01 · founder signs the source registry manifest.
    //     Guardian will verify this signature on every source acquisition.
    const existingManifest = await loadLatestSourceRegistryManifest();
    if (!existingManifest) {
      const manifest = signSourceRegistryManifest({
        manifest_version: 1,
        founder_public_key_hex: founder.public_key_hex,
        founder_private_key_hex: founder.private_key_hex,
      });
      await persistSourceRegistryManifest(manifest);
    }

    // 3. Provision all agents (idempotent · adds one identity per run)
    const prov = await provisionAllAgents({
      founder_attestation_private_key_hex: founder.private_key_hex,
      founder_public_key_hex: founder.public_key_hex,
    });

    // 4. Spawn a supervisor per agent · use envelope dispatcher (NOT idle)
    for (const rec of prov.provisioned) {
      const agent = AGENT_REGISTRY.find((a) => a.id === rec.agent_id);
      if (!agent) continue;
      const handle = superviseAgent({
        agent: {
          agent_id: rec.agent_id,
          identity: rec.identity,
          runtime_private_key_hex: rec.runtime_private_key_hex,
          capability_manifest: rec.capability_manifest,
          authority_manifest: rec.authority_manifest,
          trusted_founder_public_keys_hex: [founder.public_key_hex],
        },
        dispatcher: makeEnvelopeDispatcher({
          authority: rec.authority_manifest,
          trusted_founder_public_keys_hex: [founder.public_key_hex],
        }),
      });
      state.handles.set(rec.agent_id, handle);
      // Fire one immediate tick so ALIVE heartbeat lands quickly
      handle.tick().catch((e) => { state.lastError = (e as Error).message; });
    }

    // 5. Immediate envelope mint so agents have work on first tick
    await mintEnvelopesForAll(prov.provisioned.map((p) => ({ agent_id: p.agent_id, authority: p.authority_manifest })));

    // 6. Kick observer + snapshot immediately
    runHeartbeatTick({ scheduler_examined_workload: true }).then(() => { state.observerRuns++; }).catch((e) => { state.lastError = (e as Error).message; });
    captureGrowthSnapshot().catch((e) => { state.lastError = (e as Error).message; });
    captureNexNetGrowthSnapshot().then(() => { state.snapshotsCaptured++; }).catch((e) => { state.lastError = (e as Error).message; });

    // 7. Timers
    state.tickTimer = setInterval(() => {
      for (const h of state.handles.values()) {
        h.tick().catch((e) => { state.lastError = (e as Error).message; });
      }
      state.ticks++;
    }, TICK_INTERVAL_MS);

    state.envelopeTimer = setInterval(() => {
      mintEnvelopesForAll(prov.provisioned.map((p) => ({ agent_id: p.agent_id, authority: p.authority_manifest })))
        .catch((e) => { state.lastError = (e as Error).message; });
    }, ENVELOPE_INTERVAL_MS);

    state.observerTimer = setInterval(() => {
      runHeartbeatTick({ scheduler_examined_workload: true })
        .then(() => { state.observerRuns++; })
        .catch((e) => { state.lastError = (e as Error).message; });
    }, OBSERVER_INTERVAL_MS);

    state.snapshotTimer = setInterval(() => {
      Promise.all([
        captureGrowthSnapshot(),
        captureNexNetGrowthSnapshot(),
      ])
        .then(() => { state.snapshotsCaptured++; })
        .catch((e) => { state.lastError = (e as Error).message; });
    }, SNAPSHOT_INTERVAL_MS);

    state.started = true;
    state.startedAt = new Date().toISOString();
    return { ok: true, already_running: false, agents_spawned: state.handles.size };
  } catch (e) {
    state.lastError = (e as Error).message;
    return { ok: false, error: (e as Error).message };
  }
}

export async function stopRunner(): Promise<void> {
  if (state.tickTimer) { clearInterval(state.tickTimer); state.tickTimer = null; }
  if (state.envelopeTimer) { clearInterval(state.envelopeTimer); state.envelopeTimer = null; }
  if (state.observerTimer) { clearInterval(state.observerTimer); state.observerTimer = null; }
  if (state.snapshotTimer) { clearInterval(state.snapshotTimer); state.snapshotTimer = null; }
  for (const h of state.handles.values()) {
    try { await h.stop(); } catch { /* ok */ }
  }
  state.handles.clear();
  state.started = false;
}

// ── Envelope minting ────────────────────────────────────────────────────

// Founder-locked 2026-09-13 · NEX Continuous Multi-Source Crawler Directive:
//   Runner mints Crawler envelopes WITHOUT a hint URL. The Crawler's brain
//   selects the next eligible authorised source from the source registry,
//   respecting per-host rate limits and rotating when one source is cooling
//   off. That's how "one source failing does not stop the workforce" works
//   in practice.
const CRAWLER_MIN_INTERVAL_MS = 60_000;    // ≥ 60s between Crawler envelopes
let crawlerLastMintAt = 0;

async function mintEnvelopesForAll(agents: Array<{ agent_id: string; authority: { authorised_hosts: readonly string[] } }>): Promise<void> {
  if (!state.founder) return;
  const now = Date.now();
  for (const a of agents) {
    const agent = AGENT_REGISTRY.find((r) => r.id === a.agent_id);
    if (!agent) continue;
    const isCrawler = a.agent_id === "intelligence-crawler";
    if (isCrawler && now - crawlerLastMintAt < CRAWLER_MIN_INTERVAL_MS) continue;
    try {
      // Crawler mission = "acquire from next eligible authorised source".
      // No hint URL — brain rotates through the registry per its policy.
      const missionInput = isCrawler
        ? { acquire_from_next_eligible_source: true }
        : { template: "hello", path: "package.json", kind: "unit", complexity: 1, files: 1, max_edits: 1 };
      const env = signMissionEnvelope({
        target_agent_id: a.agent_id,
        target_lane: agent.lane as "orchestrator" | "intelligence" | "lab_security" | "nex_coding",
        kind: isCrawler ? "crawl_authorised_source" : "live-workforce-mission",
        input: missionInput,
        authorised_hosts: a.authority.authorised_hosts,   // pass ALL agent-authorised hosts
        authorised_tools: ["*"],
        budget_ms: 30_000, lifetime_ms: 5 * 60_000,
        founder_attestation_private_key_hex: state.founder.private_key_hex,
      });
      await persistEnvelope(env);
      state.envelopesSigned++;
      if (isCrawler) crawlerLastMintAt = now;
    } catch (e) {
      state.lastError = (e as Error).message;
    }
  }
}
