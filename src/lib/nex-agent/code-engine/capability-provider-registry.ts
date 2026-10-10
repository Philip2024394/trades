// src/lib/nex-agent/code-engine/capability-provider-registry.ts
//
// NEX1 · Provider Registry · Founder-authorised 2026-09-19 (§16).
// Ledger B additive · Zero LLM · Deterministic.
//
// PURPOSE
//   Provider abstraction so GitHub/GitLab/Bitbucket/other-git-remote can plug
//   in without the workstation code being hardcoded to any one of them.
//
// FOUNDER RULE (§16 verbatim)
//   "Only implement providers that are actually supported and tested.
//    Do not claim support merely because an interface exists."
//
// INVARIANTS
//   · No provider implementation ships in this module · only the interface
//   · Registry rejects self-declared "authenticated" without proof-of-life
//   · listProviders() returns only registered providers
//   · Every registration records provenance (who/when/why registered)
//   · Zero LLM · Ledger B additive
//
// AUTHORITY BOUNDARY
//   · Registry is a pure in-memory + JSONL persistence layer
//   · Never actually pushes / authenticates / calls any remote API
//   · Providers must be registered explicitly by name

import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export const PROVIDER_REGISTRY_VERSION = "provider-registry.v1.2026-09-19";

// ── Provider capabilities enum (founder §16) ─────────────────────────────
// Every provider that registers must declare which capabilities it supports.

export type ProviderCapability =
  | "connect"
  | "authenticate"
  | "get_repository"
  | "create_repository"
  | "get_remote_state"
  | "commit"
  | "push"
  | "pull"
  | "check_push_status";

// ── Provider descriptor ──────────────────────────────────────────────────

export interface ProviderDescriptor {
  readonly provider_id: string;
  readonly display_name: string;
  readonly capabilities: readonly ProviderCapability[];
  readonly registered_at_iso: string;
  readonly registered_by: string;
  readonly notes: string;
}

// ── Runtime provider status (from a heartbeat probe) ─────────────────────

export interface ProviderStatus {
  readonly provider_id: string;
  readonly connected: boolean;
  readonly authenticated: boolean;
  readonly has_default_repository: boolean;
  readonly last_check_at_iso: string;
  readonly last_error_reason: string | null;
}

// ── Provider function interface (what a real impl must supply) ───────────
//
// This is the shape each concrete provider (github.ts, gitlab.ts, etc.)
// must implement. This module does NOT ship any implementations · it only
// defines the contract.

export interface ProviderFunctions {
  readonly probeConnection: () => Promise<{
    readonly connected: boolean;
    readonly authenticated: boolean;
    readonly reason: string | null;
  }>;
  readonly getRemoteState?: (repo_url: string) => Promise<{
    readonly reachable: boolean;
    readonly head_sha: string | null;
    readonly branch: string | null;
    readonly reason: string | null;
  }>;
  readonly checkPushStatus?: (repo_url: string, expected_sha: string) => Promise<{
    readonly matched: boolean;
    readonly actual_sha: string | null;
    readonly reason: string | null;
  }>;
}

// ── The registry ─────────────────────────────────────────────────────────

export interface ProviderRegistryOptions {
  /** JSONL persistence root. Default: data/nex1-providers */
  readonly data_root?: string;
}

const registeredProviders = new Map<string, ProviderDescriptor>();
const registeredFunctions = new Map<string, ProviderFunctions>();

/** Register a provider · Ledger B · records provenance · idempotent by ID. */
export function registerProvider(
  descriptor: Omit<ProviderDescriptor, "registered_at_iso">,
  functions: ProviderFunctions,
  opts: ProviderRegistryOptions = {},
): ProviderDescriptor {
  const full: ProviderDescriptor = {
    ...descriptor,
    registered_at_iso: new Date().toISOString(),
  };
  registeredProviders.set(descriptor.provider_id, full);
  registeredFunctions.set(descriptor.provider_id, functions);
  const data_root = opts.data_root ?? path.join(process.cwd(), "data", "nex1-providers");
  if (!existsSync(data_root)) mkdirSync(data_root, { recursive: true });
  appendFileSync(
    path.join(data_root, "registrations.jsonl"),
    JSON.stringify({ event: "register", ...full }) + "\n",
  );
  return full;
}

/** Deregister a provider. */
export function deregisterProvider(provider_id: string): boolean {
  const existed = registeredProviders.delete(provider_id);
  registeredFunctions.delete(provider_id);
  return existed;
}

/** List all registered providers. */
export function listProviders(): readonly ProviderDescriptor[] {
  return [...registeredProviders.values()].sort((a, b) => a.provider_id.localeCompare(b.provider_id));
}

/** Get a specific provider descriptor. */
export function getProvider(provider_id: string): ProviderDescriptor | null {
  return registeredProviders.get(provider_id) ?? null;
}

/** Reset registry · used only by tests. */
export function _resetRegistryForTests(): void {
  registeredProviders.clear();
  registeredFunctions.clear();
}

// ── Status probe · anti-fabrication ──────────────────────────────────────
//
// Runs the provider's own probeConnection · records the observed result.
// NEVER assumes a provider is connected just because it registered.

export interface ProviderStatusSnapshot {
  readonly at_iso: string;
  readonly statuses: readonly ProviderStatus[];
  readonly total_registered: number;
  readonly total_connected: number;
  readonly total_authenticated: number;
  readonly zero_llm: true;
  readonly ledger: "B";
}

export async function snapshotProviderStatus(): Promise<ProviderStatusSnapshot> {
  const statuses: ProviderStatus[] = [];
  for (const [provider_id, functions] of registeredFunctions.entries()) {
    try {
      const probe = await functions.probeConnection();
      statuses.push({
        provider_id,
        connected: probe.connected,
        authenticated: probe.authenticated,
        has_default_repository: false,  // filled by higher-level layer
        last_check_at_iso: new Date().toISOString(),
        last_error_reason: probe.reason,
      });
    } catch (err) {
      statuses.push({
        provider_id,
        connected: false,
        authenticated: false,
        has_default_repository: false,
        last_check_at_iso: new Date().toISOString(),
        last_error_reason: err instanceof Error ? err.message.slice(0, 120) : "probe_threw",
      });
    }
  }
  statuses.sort((a, b) => a.provider_id.localeCompare(b.provider_id));
  return {
    at_iso: new Date().toISOString(),
    statuses,
    total_registered: registeredProviders.size,
    total_connected: statuses.filter((s) => s.connected).length,
    total_authenticated: statuses.filter((s) => s.authenticated).length,
    zero_llm: true,
    ledger: "B",
  };
}

// ── Snapshot digest (for reproducibility) ───────────────────────────────

export function digestRegistry(): string {
  const descriptors = listProviders();
  return createHash("sha256")
    .update(JSON.stringify(descriptors.map((d) => ({
      id: d.provider_id,
      caps: [...d.capabilities].sort(),
    }))))
    .digest("hex")
    .slice(0, 16);
}
