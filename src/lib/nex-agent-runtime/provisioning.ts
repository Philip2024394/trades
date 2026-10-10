// WO-AGENT-RUNTIME-01 · provisioning module (idempotent per agent_id).
//
// Creates real signed identities + capability manifests + authority
// manifests for every registered agent. Every agent gets:
//   1. Its own Ed25519 runtime keypair (private key held by the runtime worker)
//   2. A CapabilityManifest signed by that key
//   3. An AuthorityManifest signed by the founder attestation root
//   4. An AgentIdentity signed by the founder attestation root
//   5. An empty per-agent memory collection initialised
//
// Founder-locked 2026-09-13: NO EVIDENCE = NO CLAIM. Provisioning marks
// most facets as CLAIMED (code exists) — they only advance to
// RUNTIME_VERIFIED once adversarial tests pass for the agent AND
// PRODUCTION_VERIFIED after real mission observation.

import { promises as fs } from "node:fs";
import path from "node:path";
import { getStorage } from "@/lib/nex/storage/registry";
import { AGENT_REGISTRY } from "@/lib/nex-hq-agents/registry";
import type { AgentDescriptor } from "@/lib/nex-hq-agents/types";
import { generateAgentKeypair, createAgentIdentity, hashCapabilityManifest, hashAuthorityManifest } from "./identity";
import { buildCapabilityManifest, ALL_FACETS } from "./capability-manifest";
import { buildAuthorityManifest } from "./authority-manifest";
import type { AgentIdentity, AuthorityManifest, CapabilityManifest, FacetKey, FacetStatus, FacetVerificationTier } from "./types";
import { agentMemoryCollectionName } from "./memory";

export const IDENTITIES_COLLECTION = "nex_agent_identities";
export const CAPABILITY_MANIFESTS_COLLECTION = "nex_agent_capability_manifests";
export const AUTHORITY_MANIFESTS_COLLECTION = "nex_agent_authority_manifests";

// ── Per-lane authority profile (founder-locked defaults · P-U preserved) ─

interface LaneProfile {
  readonly authorised_tools: readonly string[];
  readonly authorised_hosts: readonly string[];
  readonly prohibited_actions: readonly string[];
  readonly specialist_domain: string;
  readonly facet_defaults: Readonly<Partial<Record<FacetKey, FacetVerificationTier>>>;
}

const LANE_PROFILES: Record<AgentDescriptor["lane"], LaneProfile> = {
  orchestrator: {
    authorised_tools: ["compose_wo_envelope", "verify_attestation", "state_transition"],
    authorised_hosts: [],   // orchestrator agents do not touch the internet
    prohibited_actions: ["POST", "authorise", "modify-substrate", "self-modify"],
    specialist_domain: "software-engineering-orchestration",
    facet_defaults: {
      identity: "RUNTIME_VERIFIED", liveness: "RUNTIME_VERIFIED",
      authority_boundary: "RUNTIME_VERIFIED", recovery_state: "RUNTIME_VERIFIED",
      // brain, memory, tools, evidence still CLAIMED until the specific agent is refactored
      network: "NOT_APPLICABLE", vision: "NOT_APPLICABLE", experiment: "NOT_APPLICABLE",
    },
  },
  intelligence: {
    authorised_tools: ["http_get", "parse_atom", "parse_pdf", "content_hash", "dedupe", "fragment_extract"],
    authorised_hosts: ["export.arxiv.org", "nodejs.org", "github.com"],
    prohibited_actions: ["POST", "authorise", "modify-substrate", "self-modify"],
    specialist_domain: "authorised-knowledge-acquisition",
    facet_defaults: {
      identity: "RUNTIME_VERIFIED", liveness: "RUNTIME_VERIFIED",
      authority_boundary: "RUNTIME_VERIFIED", recovery_state: "RUNTIME_VERIFIED",
      vision: "NOT_APPLICABLE",
    },
  },
  lab_security: {
    authorised_tools: ["read_substrate_manifest", "hash_file", "signature_verify", "detect_anomaly", "emit_alert"],
    authorised_hosts: [],   // lab security is local observation only
    prohibited_actions: ["POST", "authorise", "modify-substrate", "modify-code", "self-modify"],
    specialist_domain: "system-integrity-observation",
    facet_defaults: {
      identity: "RUNTIME_VERIFIED", liveness: "RUNTIME_VERIFIED",
      authority_boundary: "RUNTIME_VERIFIED", recovery_state: "RUNTIME_VERIFIED",
      network: "NOT_APPLICABLE", experiment: "NOT_APPLICABLE",
    },
  },
  nex_coding: {
    authorised_tools: ["read_workspace", "analyse_ast", "propose_diff", "type_check", "lint_check"],
    authorised_hosts: [],   // coding agents operate on local workspace only
    prohibited_actions: ["POST", "authorise", "modify-substrate", "write-outside-workspace", "self-modify"],
    specialist_domain: "software-engineering-specialist",
    facet_defaults: {
      identity: "RUNTIME_VERIFIED", liveness: "RUNTIME_VERIFIED",
      authority_boundary: "RUNTIME_VERIFIED", recovery_state: "RUNTIME_VERIFIED",
      network: "NOT_APPLICABLE", vision: "NOT_APPLICABLE", experiment: "NOT_APPLICABLE",
    },
  },
};

// ── Provisioning result ────────────────────────────────────────────────

export interface AgentProvisioningRecord {
  readonly agent_id: string;
  readonly identity: AgentIdentity;
  readonly capability_manifest: CapabilityManifest;
  readonly authority_manifest: AuthorityManifest;
  readonly runtime_public_key_hex: string;
  /** Kept in memory ONLY during provisioning; the worker persists its
   *  private key locally. In production it is provisioned to the worker
   *  process out of band. */
  readonly runtime_private_key_hex: string;
  readonly memory_collection: string;
}

export interface ProvisionAllInput {
  readonly founder_attestation_private_key_hex: string;
  readonly runtime_version?: string;
  /** Founder-locked 2026-09-13: environment classification signed into
   *  every AgentIdentity. Runner default = PRODUCTION_WORKFORCE. Tests
   *  and fixtures must pass "TEST" / "FIXTURE" / "SIMULATION" so their
   *  activity NEVER inflates production HQ metrics. */
  readonly environment?: import("./types").AgentEnvironment;
}

export interface ProvisionAllResult {
  readonly provisioned: readonly AgentProvisioningRecord[];
  readonly founder_public_key_hex: string;
}

/**
 * Provision every agent in the AGENT_REGISTRY. Persists identities +
 * manifests to GB. Returns the private keys keyed by agent_id so the
 * worker layer can spawn workers with them.
 */
const AGENT_KEYS_STORE_PATH = path.join(process.cwd(), "data", "nex-storage", ".agent-runtime-keys.json");

interface AgentKeyStore {
  readonly runtime_version: string;
  readonly keys: Readonly<Record<string, { public_key_hex: string; private_key_hex: string; identity_id: string }>>;
}

async function loadAgentKeyStore(runtime_version: string): Promise<AgentKeyStore | null> {
  try {
    const raw = await fs.readFile(AGENT_KEYS_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as AgentKeyStore;
    if (parsed.runtime_version === runtime_version && parsed.keys) return parsed;
  } catch { /* missing / corrupt / version mismatch → regenerate */ }
  return null;
}

async function saveAgentKeyStore(store: AgentKeyStore): Promise<void> {
  await fs.mkdir(path.dirname(AGENT_KEYS_STORE_PATH), { recursive: true });
  await fs.writeFile(AGENT_KEYS_STORE_PATH, JSON.stringify(store, null, 2));
}

/** Founder-locked 2026-09-13: idempotent per (agent_id, runtime_version).
 *  If keys already exist on disk for the current runtime_version, reuse them
 *  (returns the same identity_id across restarts). Otherwise generate + persist. */
export async function provisionAllAgents(input: ProvisionAllInput & { founder_public_key_hex: string }): Promise<ProvisionAllResult> {
  // WO-CRAWLER-INTERNET-01 · bump to 0.3.0 for environment field (PRODUCTION_WORKFORCE tagging).
  const runtime_version = input.runtime_version ?? "0.3.0";
  const environment = input.environment ?? "PRODUCTION_WORKFORCE";
  const store = getStorage();
  const provisioned: AgentProvisioningRecord[] = [];

  const existingStore = await loadAgentKeyStore(runtime_version);
  const outStore: { runtime_version: string; keys: Record<string, { public_key_hex: string; private_key_hex: string; identity_id: string }> } = {
    runtime_version, keys: { ...(existingStore?.keys ?? {}) },
  };

  // Load ALL existing identities/manifests keyed by agent_id — reuse the
  // newest per agent regardless of what the key store claims.
  const existingIdentities = await store.query<AgentIdentity>(IDENTITIES_COLLECTION, { limit: 10_000, order_by: "spawned_at", order_dir: "desc" }).catch(() => []);
  const newestIdentityByAgent = new Map<string, AgentIdentity>();
  for (const i of existingIdentities) if (!newestIdentityByAgent.has(i.agent_id)) newestIdentityByAgent.set(i.agent_id, i);
  const existingCap = await store.query<CapabilityManifest>(CAPABILITY_MANIFESTS_COLLECTION, { limit: 10_000, order_by: "emitted_at", order_dir: "desc" }).catch(() => []);
  const existingCapByAgent = new Map<string, CapabilityManifest>();
  for (const c of existingCap) if (!existingCapByAgent.has(c.agent_id)) existingCapByAgent.set(c.agent_id, c);
  const existingAuth = await store.query<AuthorityManifest>(AUTHORITY_MANIFESTS_COLLECTION, { limit: 10_000, order_by: "emitted_at", order_dir: "desc" }).catch(() => []);
  const existingAuthByAgent = new Map<string, AuthorityManifest>();
  for (const a of existingAuth) if (!existingAuthByAgent.has(a.agent_id)) existingAuthByAgent.set(a.agent_id, a);

  for (const agent of AGENT_REGISTRY) {
    const profile = LANE_PROFILES[agent.lane];
    // Founder-locked idempotent path:
    //   (a) newest identity for this agent must exist AND its runtime_version matches
    //   (b) key store must have the private key for that identity_id
    //   (c) both cap + auth manifests must be present
    // If ALL true → reuse. Otherwise regenerate + persist (and align key store to
    // the newly-emitted identity_id so future runs also reuse it).
    const newestIdentity = newestIdentityByAgent.get(agent.id);
    const stored = outStore.keys[agent.id];
    const identityMatchesStore = newestIdentity && stored && stored.identity_id === newestIdentity.identity_id;
    if (newestIdentity && newestIdentity.runtime_version === runtime_version && identityMatchesStore && stored) {
      const cap = existingCapByAgent.get(agent.id);
      const auth = existingAuthByAgent.get(agent.id);
      if (cap && auth) {
        provisioned.push({
          agent_id: agent.id, identity: newestIdentity,
          capability_manifest: cap, authority_manifest: auth,
          runtime_public_key_hex: stored.public_key_hex,
          runtime_private_key_hex: stored.private_key_hex,
          memory_collection: agentMemoryCollectionName(agent.id),
        });
        continue;
      }
    }
    // New agent — or identity/store misalignment · regenerate
    const kp = generateAgentKeypair();

    // Build facet map: defaults from lane, with per-agent overrides layered on top.
    const facets: Partial<Record<FacetKey, Omit<FacetStatus, "facet">>> = {};
    for (const f of ALL_FACETS) {
      const tier = profile.facet_defaults[f] ?? "CLAIMED";
      facets[f] = { tier, evidence_pointer: null, last_verified_at: null };
    }

    const capManifest = buildCapabilityManifest({
      agent_id: agent.id, runtime_version, version: 1,
      specialist_domain: profile.specialist_domain,
      facets, runtime_private_key_hex: kp.privateKeyHex,
    });

    const authManifest = buildAuthorityManifest({
      agent_id: agent.id, runtime_version,
      authorised_tools: profile.authorised_tools,
      authorised_hosts: profile.authorised_hosts,
      authorised_collections_read: [agent.source_collection, agentMemoryCollectionName(agent.id)],
      authorised_collections_write: [agent.source_collection, agentMemoryCollectionName(agent.id), "nex_agent_heartbeat_events", "nex_agent_performance_history", "nex_agent_learning_contributions"],
      prohibited_actions: profile.prohibited_actions,
      founder_attestation_private_key_hex: input.founder_attestation_private_key_hex,
    });

    const cap_hash = hashCapabilityManifest({
      record_type: "NEX_AGENT_CAPABILITY_MANIFEST",
      manifest_id: capManifest.manifest_id,
      agent_id: agent.id,
      runtime_version,
      version: 1,
      emitted_at: capManifest.emitted_at,
      facets: capManifest.facets,
      specialist_domain: profile.specialist_domain,
    });
    const auth_hash = hashAuthorityManifest({
      record_type: "NEX_AGENT_AUTHORITY_MANIFEST",
      manifest_id: authManifest.manifest_id,
      agent_id: agent.id,
      runtime_version,
      authorised_tools: authManifest.authorised_tools,
      authorised_hosts: authManifest.authorised_hosts,
      authorised_collections_read: authManifest.authorised_collections_read,
      authorised_collections_write: authManifest.authorised_collections_write,
      prohibited_actions: authManifest.prohibited_actions,
      emitted_at: authManifest.emitted_at,
    });

    const identity = createAgentIdentity({
      agent_id: agent.id, runtime_version,
      agent_public_key_hex: kp.publicKeyHex,
      capability_manifest_hash: cap_hash,
      authority_manifest_hash: auth_hash,
      environment,
      founder_attestation_private_key_hex: input.founder_attestation_private_key_hex,
    });

    await store.save(IDENTITIES_COLLECTION, identity);
    await store.save(CAPABILITY_MANIFESTS_COLLECTION, capManifest);
    await store.save(AUTHORITY_MANIFESTS_COLLECTION, authManifest);
    // Persist this agent's runtime key so restarts reuse the same identity.
    outStore.keys[agent.id] = {
      public_key_hex: kp.publicKeyHex,
      private_key_hex: kp.privateKeyHex,
      identity_id: identity.identity_id,
    };

    provisioned.push({
      agent_id: agent.id,
      identity,
      capability_manifest: capManifest,
      authority_manifest: authManifest,
      runtime_public_key_hex: kp.publicKeyHex,
      runtime_private_key_hex: kp.privateKeyHex,
      memory_collection: agentMemoryCollectionName(agent.id),
    });
  }

  // Persist updated key store to disk (idempotent · unchanged between calls).
  await saveAgentKeyStore(outStore);

  return { provisioned, founder_public_key_hex: input.founder_public_key_hex };
}

// ── Read-side helpers ──────────────────────────────────────────────────

export async function loadAgentIdentity(agent_id: string): Promise<AgentIdentity | null> {
  const records = await getStorage().query<AgentIdentity>(IDENTITIES_COLLECTION, {
    limit: 500, order_by: "spawned_at", order_dir: "desc",
  });
  return records.find((r) => r.agent_id === agent_id) ?? null;
}

export async function loadAllAgentIdentities(): Promise<AgentIdentity[]> {
  return getStorage().query<AgentIdentity>(IDENTITIES_COLLECTION, {
    limit: 1000, order_by: "spawned_at", order_dir: "desc",
  });
}

export async function loadAgentCapabilityManifest(agent_id: string): Promise<CapabilityManifest | null> {
  const records = await getStorage().query<CapabilityManifest>(CAPABILITY_MANIFESTS_COLLECTION, {
    limit: 500, order_by: "emitted_at", order_dir: "desc",
  });
  return records.find((r) => r.agent_id === agent_id) ?? null;
}

export async function loadAgentAuthorityManifest(agent_id: string): Promise<AuthorityManifest | null> {
  const records = await getStorage().query<AuthorityManifest>(AUTHORITY_MANIFESTS_COLLECTION, {
    limit: 500, order_by: "emitted_at", order_dir: "desc",
  });
  return records.find((r) => r.agent_id === agent_id) ?? null;
}
