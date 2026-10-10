// WO-NEX-RUNTIME-08 · delegation envelope + NEX authorization tests.
//
// Founder-locked 2026-09-14.
//   - Founder authority is never transferred · only delegated
//   - Authorization is not the same thing as verification
//   - Delegations declare BOTH allowed AND forbidden
//   - On expiry: STOP · not "try anyway" · not "ask another agent"

import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { startNex1Daemon } from "@/lib/nex-agent-runtime/nex1/daemon";
import {
  signFounderDelegation,
  verifyDelegationSignature,
  persistDelegation,
  loadDelegation,
  signFounderRevocation,
  persistRevocation,
  isDelegationRevoked,
} from "../delegation";
import {
  signDelegatedAuthorization,
  verifyAuthorizationSignature,
  verifyDelegatedAuthorization,
  persistDelegatedAuthorization,
} from "../authorization";
import { getStorage } from "@/lib/nex/storage/registry";
import { CAP_ENGINEERING_PROPOSAL_COLLECTION, type CapEngineeringProposal } from "@/lib/nex-cap/nex1-engineer";
import { persistCapabilityGap } from "@/lib/nex-cap/registry";

const REPO = process.cwd();
const RUN = `r08-${randomUUID().slice(0, 8)}`;

async function nuke(p: string): Promise<void> { try { await fs.rm(p, { recursive: true, force: true }); } catch { /* ok */ } }

function makeFounderKp() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicHex: (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex"),
    privateHex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
  };
}

async function seedProposal(overrides: Partial<CapEngineeringProposal>): Promise<CapEngineeringProposal> {
  const base: CapEngineeringProposal = {
    record_type: "NEX_CAP_ENGINEERING_PROPOSAL",
    proposal_id: `CAP-PROP-R08-${RUN}-${randomUUID()}`,
    cap_id: null,
    diagnosed_by_agent: "nex1-master-engineer",
    diagnosis: "bounded diagnosis text long enough to pass validation",
    proposed_fix_summary: "bounded fix summary long enough to pass",
    required_authority_scope: { authorised_tools: [], authorised_hosts: [], authorised_collections_write: [], requires_founder_signature: true },
    authorised_workstation_scope: {
      files_may_touch: ["src/app/shop/product.ts"],
      build_targets: ["node"],
      collections_may_write: [],
      stages_required: ["WO-04"],
      runtime_required: false,
    },
    evidence_chain: ["e-1"],
    resolver_outcome: "PROPOSE",
    founder_signature_slot: null,
    created_at: new Date().toISOString(),
    provenance_chain_hash: "hash",
    ...overrides,
  } as CapEngineeringProposal;
  await getStorage().save(CAP_ENGINEERING_PROPOSAL_COLLECTION, base);
  return base;
}

describe("WO-NEX-RUNTIME-08 · delegation envelope · NEX authorization · combined verifier", () => {
  const stopFns: Array<() => Promise<void>> = [];
  const cleanups: string[] = [];
  afterEach(async () => {
    while (stopFns.length) { const f = stopFns.pop(); if (f) await f(); }
    while (cleanups.length) { const p = cleanups.pop(); if (p) await nuke(p); }
  });

  // ── D-1 · founder signs delegation offline · verifies against trusted key
  it("D-1 · founder-signed delegation verifies against trusted founder public key · fails against untrusted key", async () => {
    const founder = makeFounderKp();
    const attacker = makeFounderKp();
    const delegate = generateKeyPairSync("ed25519");
    const delegatePubHex = (delegate.publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex");
    const del = signFounderDelegation({
      delegate_agent_id: "nex1-cap-executor",
      delegate_public_key_der_hex: delegatePubHex,
      allowed: {
        proposal_kinds: ["rate_limiter.persistent_backoff"],
        file_path_prefixes: ["src/app/shop/"],
        stages_allowed: ["WO-04"],
        max_risk_level: "LOW",
        mission_ids_allowed: [],
        cap_ids_allowed: [],
      },
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      founder_public_key_der_hex: founder.publicHex,
      founder_private_key_pkcs8_hex: founder.privateHex,
    });
    expect(verifyDelegationSignature(del, [founder.publicHex])).toBe(true);
    expect(verifyDelegationSignature(del, [attacker.publicHex])).toBe(false);
    expect(verifyDelegationSignature(del, [])).toBe(false);
  });

  // ── D-2 · every delegation carries the required forbidden set ────────
  it("D-2 · every delegation MUST include required forbidden categories + protected roots", async () => {
    const founder = makeFounderKp();
    const del = signFounderDelegation({
      delegate_agent_id: "nex1-cap-executor",
      delegate_public_key_der_hex: "00".repeat(46),
      allowed: {
        proposal_kinds: ["rate_limiter.persistent_backoff"],
        file_path_prefixes: ["src/app/shop/"],
        stages_allowed: ["WO-04"], max_risk_level: "LOW", mission_ids_allowed: [], cap_ids_allowed: [],
      },
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      founder_public_key_der_hex: founder.publicHex,
      founder_private_key_pkcs8_hex: founder.privateHex,
    });
    expect(del.forbidden.forbidden_categories).toContain("authority_system");
    expect(del.forbidden.forbidden_categories).toContain("security_system");
    expect(del.forbidden.forbidden_categories).toContain("founder_keys");
    expect(del.forbidden.forbidden_categories).toContain("protected_roots");
    expect(del.forbidden.forbidden_categories).toContain("credentials");
    expect(del.forbidden.forbidden_path_prefixes.some((p) => p.includes("nex-authority-broker"))).toBe(true);
    expect(del.forbidden.forbidden_path_prefixes.some((p) => p.includes("nex-controlled-hands"))).toBe(true);
    expect(del.forbidden.forbidden_path_prefixes.some((p) => p.includes("founder-authority"))).toBe(true);
  });

  // ── D-3 · full happy path · AUTHORISED ───────────────────────────────
  it("D-3 · happy path · founder delegation + NEX authorization + in-scope proposal → AUTHORISED", async () => {
    const founder = makeFounderKp();
    const n1 = `nex1-cap-exec-${RUN}-d3`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n1));
    const d1 = await startNex1Daemon({ agent_id: n1, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d1.stop);

    const cap = await persistCapabilityGap({
      kind: "rate_limiter.persistent_backoff",
      category: "PERFORMANCE", priority: "MEDIUM",
      title: "D-3 seed", evidence: [{ collection: "test", record_id: "d3", kind: "t" }],
      detector_agent_id: "r08-d3", dedupe_key: `r08-d3-${RUN}-${randomUUID()}`,
    });
    const proposal = await seedProposal({
      cap_id: cap.cap_id,
      authorised_workstation_scope: {
        files_may_touch: ["src/app/shop/product.ts"],
        build_targets: ["node"], collections_may_write: [],
        stages_required: ["WO-04"], runtime_required: false,
      },
    });

    const del = signFounderDelegation({
      delegate_agent_id: n1, delegate_public_key_der_hex: d1.identity.public_key_der_hex,
      allowed: {
        proposal_kinds: ["rate_limiter.persistent_backoff"],
        file_path_prefixes: ["src/app/shop/"],
        stages_allowed: ["WO-04"], max_risk_level: "LOW",
        mission_ids_allowed: [], cap_ids_allowed: [],
      },
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      founder_public_key_der_hex: founder.publicHex,
      founder_private_key_pkcs8_hex: founder.privateHex,
    });
    const auth = signDelegatedAuthorization({
      delegate_identity: d1.identity, delegation: del, proposal, mission_id: null,
    });
    const result = await verifyDelegatedAuthorization({
      delegation: del, authorization: auth, proposal,
      trusted_founder_public_keys_hex: [founder.publicHex],
    });
    expect(result.verdict).toBe("AUTHORISED");
    expect(result.checks.every((c) => c.ok)).toBe(true);
  });

  // ── D-4 · out-of-scope path · SCOPE_VIOLATION ────────────────────────
  it("D-4 · proposal touches path outside delegation.allowed.file_path_prefixes → SCOPE_VIOLATION", async () => {
    const founder = makeFounderKp();
    const n1 = `nex1-cap-exec-${RUN}-d4`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n1));
    const d1 = await startNex1Daemon({ agent_id: n1, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d1.stop);
    const proposal = await seedProposal({
      authorised_workstation_scope: {
        files_may_touch: ["src/lib/OTHER/x.ts"],   // outside delegation
        build_targets: ["node"], collections_may_write: [],
        stages_required: ["WO-04"], runtime_required: false,
      },
    });
    const del = signFounderDelegation({
      delegate_agent_id: n1, delegate_public_key_der_hex: d1.identity.public_key_der_hex,
      allowed: {
        proposal_kinds: [], file_path_prefixes: ["src/app/shop/"],
        stages_allowed: ["WO-04"], max_risk_level: "LOW", mission_ids_allowed: [], cap_ids_allowed: [],
      },
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      founder_public_key_der_hex: founder.publicHex, founder_private_key_pkcs8_hex: founder.privateHex,
    });
    const auth = signDelegatedAuthorization({ delegate_identity: d1.identity, delegation: del, proposal, mission_id: null });
    const r = await verifyDelegatedAuthorization({ delegation: del, authorization: auth, proposal, trusted_founder_public_keys_hex: [founder.publicHex] });
    expect(r.verdict).toBe("NOT_AUTHORIZED_SCOPE_VIOLATION");
  });

  // ── D-5 · forbidden path · FORBIDDEN_CATEGORY ────────────────────────
  it("D-5 · proposal touches a forbidden path (Authority Broker) → FORBIDDEN_CATEGORY", async () => {
    const founder = makeFounderKp();
    const n1 = `nex1-cap-exec-${RUN}-d5`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n1));
    const d1 = await startNex1Daemon({ agent_id: n1, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d1.stop);
    const proposal = await seedProposal({
      authorised_workstation_scope: {
        files_may_touch: ["src/lib/nex-authority-broker/broker.ts"],   // FORBIDDEN
        build_targets: ["node"], collections_may_write: [],
        stages_required: ["WO-04"], runtime_required: false,
      },
    });
    // Even if founder deliberately signs a delegation that TRIES to allow this,
    // the required-forbidden list is applied automatically and blocks it.
    const del = signFounderDelegation({
      delegate_agent_id: n1, delegate_public_key_der_hex: d1.identity.public_key_der_hex,
      allowed: {
        proposal_kinds: [], file_path_prefixes: ["src/lib/"],   // permissive
        stages_allowed: ["WO-04"], max_risk_level: "LOW", mission_ids_allowed: [], cap_ids_allowed: [],
      },
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      founder_public_key_der_hex: founder.publicHex, founder_private_key_pkcs8_hex: founder.privateHex,
    });
    const auth = signDelegatedAuthorization({ delegate_identity: d1.identity, delegation: del, proposal, mission_id: null });
    const r = await verifyDelegatedAuthorization({ delegation: del, authorization: auth, proposal, trusted_founder_public_keys_hex: [founder.publicHex] });
    expect(r.verdict).toBe("NOT_AUTHORIZED_FORBIDDEN_CATEGORY");
  });

  // ── D-6 · expired delegation · STOP ──────────────────────────────────
  it("D-6 · expired delegation · NOT_AUTHORIZED_DELEGATION_EXPIRED (STOP · never assume)", async () => {
    const founder = makeFounderKp();
    const n1 = `nex1-cap-exec-${RUN}-d6`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n1));
    const d1 = await startNex1Daemon({ agent_id: n1, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d1.stop);
    const proposal = await seedProposal({});
    const del = signFounderDelegation({
      delegate_agent_id: n1, delegate_public_key_der_hex: d1.identity.public_key_der_hex,
      allowed: {
        proposal_kinds: [], file_path_prefixes: ["src/app/shop/"],
        stages_allowed: ["WO-04"], max_risk_level: "LOW", mission_ids_allowed: [], cap_ids_allowed: [],
      },
      expires_at: new Date(Date.now() - 60_000).toISOString(),   // already expired
      founder_public_key_der_hex: founder.publicHex, founder_private_key_pkcs8_hex: founder.privateHex,
    });
    const auth = signDelegatedAuthorization({ delegate_identity: d1.identity, delegation: del, proposal, mission_id: null });
    const r = await verifyDelegatedAuthorization({ delegation: del, authorization: auth, proposal, trusted_founder_public_keys_hex: [founder.publicHex] });
    expect(r.verdict).toBe("NOT_AUTHORIZED_DELEGATION_EXPIRED");
  });

  // ── D-7 · revoked delegation · REVOKED ───────────────────────────────
  it("D-7 · founder-signed revocation blocks the delegation · NOT_AUTHORIZED_DELEGATION_REVOKED", async () => {
    const founder = makeFounderKp();
    const n1 = `nex1-cap-exec-${RUN}-d7`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n1));
    const d1 = await startNex1Daemon({ agent_id: n1, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d1.stop);
    const proposal = await seedProposal({});
    const del = signFounderDelegation({
      delegate_agent_id: n1, delegate_public_key_der_hex: d1.identity.public_key_der_hex,
      allowed: {
        proposal_kinds: [], file_path_prefixes: ["src/app/shop/"],
        stages_allowed: ["WO-04"], max_risk_level: "LOW", mission_ids_allowed: [], cap_ids_allowed: [],
      },
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      founder_public_key_der_hex: founder.publicHex, founder_private_key_pkcs8_hex: founder.privateHex,
    });
    // Founder revokes
    const rev = signFounderRevocation({
      delegation_id: del.delegation_id, reason: "test revoke",
      founder_public_key_der_hex: founder.publicHex, founder_private_key_pkcs8_hex: founder.privateHex,
    });
    await persistRevocation(rev);
    const status = await isDelegationRevoked(del.delegation_id, [founder.publicHex]);
    expect(status.revoked).toBe(true);

    const auth = signDelegatedAuthorization({ delegate_identity: d1.identity, delegation: del, proposal, mission_id: null });
    const r = await verifyDelegatedAuthorization({ delegation: del, authorization: auth, proposal, trusted_founder_public_keys_hex: [founder.publicHex] });
    expect(r.verdict).toBe("NOT_AUTHORIZED_DELEGATION_REVOKED");
  });

  // ── D-8 · delegate cannot re-delegate (uses OWN key to fake founder role)
  it("D-8 · delegate signing a delegation-shaped record with its own key · fails verification against trusted founder set", async () => {
    const founder = makeFounderKp();
    const attackerAsDelegate = makeFounderKp();
    // The delegate signs its own "delegation" attempt
    const badDelegation = signFounderDelegation({
      delegate_agent_id: "malicious", delegate_public_key_der_hex: "00".repeat(46),
      allowed: {
        proposal_kinds: [], file_path_prefixes: ["/"],
        stages_allowed: ["WO-04"], max_risk_level: "SEVERE",
        mission_ids_allowed: [], cap_ids_allowed: [],
      },
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      founder_public_key_der_hex: attackerAsDelegate.publicHex,
      founder_private_key_pkcs8_hex: attackerAsDelegate.privateHex,
    });
    // Only the real founder is trusted
    expect(verifyDelegationSignature(badDelegation, [founder.publicHex])).toBe(false);
  });

  // ── D-9 · delegate mismatch · authorization signed by wrong agent ────
  it("D-9 · authorization signed by an agent OTHER than the delegate the founder empowered · DELEGATE_MISMATCH", async () => {
    const founder = makeFounderKp();
    const n1 = `nex1-cap-exec-${RUN}-d9-a`;
    const other = `nex1-cap-exec-${RUN}-d9-b`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n1));
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", other));
    const dReal = await startNex1Daemon({ agent_id: n1, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(dReal.stop);
    const dOther = await startNex1Daemon({ agent_id: other, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(dOther.stop);
    const proposal = await seedProposal({});
    const del = signFounderDelegation({
      delegate_agent_id: n1, delegate_public_key_der_hex: dReal.identity.public_key_der_hex,
      allowed: {
        proposal_kinds: [], file_path_prefixes: ["src/app/shop/"],
        stages_allowed: ["WO-04"], max_risk_level: "LOW", mission_ids_allowed: [], cap_ids_allowed: [],
      },
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      founder_public_key_der_hex: founder.publicHex, founder_private_key_pkcs8_hex: founder.privateHex,
    });
    // Wrong agent signs the authorization
    const wrongAuth = signDelegatedAuthorization({ delegate_identity: dOther.identity, delegation: del, proposal, mission_id: null });
    const r = await verifyDelegatedAuthorization({ delegation: del, authorization: wrongAuth, proposal, trusted_founder_public_keys_hex: [founder.publicHex] });
    expect(r.verdict).toBe("NOT_AUTHORIZED_DELEGATE_MISMATCH");
  });

  // ── D-10 · delegate cannot extend expiry beyond delegation ───────────
  it("D-10 · delegate authorization tries to expire AFTER delegation · AUTHORIZATION_EXPIRED (no extension)", async () => {
    const founder = makeFounderKp();
    const n1 = `nex1-cap-exec-${RUN}-d10`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n1));
    const d1 = await startNex1Daemon({ agent_id: n1, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d1.stop);
    const proposal = await seedProposal({});
    const delExp = new Date(Date.now() + 60_000).toISOString();   // delegation expires soon
    const del = signFounderDelegation({
      delegate_agent_id: n1, delegate_public_key_der_hex: d1.identity.public_key_der_hex,
      allowed: {
        proposal_kinds: [], file_path_prefixes: ["src/app/shop/"],
        stages_allowed: ["WO-04"], max_risk_level: "LOW", mission_ids_allowed: [], cap_ids_allowed: [],
      },
      expires_at: delExp,
      founder_public_key_der_hex: founder.publicHex, founder_private_key_pkcs8_hex: founder.privateHex,
    });
    // Delegate tries to sign an authorization that expires MUCH LATER than the delegation
    // (signDelegatedAuthorization bounds the requested expiry to min(requested, delegation.expires_at))
    const auth = signDelegatedAuthorization({
      delegate_identity: d1.identity, delegation: del, proposal, mission_id: null,
      authorization_expires_at: new Date(Date.now() + 86_400_000).toISOString(),   // wants +24h
    });
    // Verify the bounding worked
    expect(Date.parse(auth.authorization_expires_at)).toBeLessThanOrEqual(Date.parse(delExp));
    const r = await verifyDelegatedAuthorization({ delegation: del, authorization: auth, proposal, trusted_founder_public_keys_hex: [founder.publicHex] });
    expect(r.verdict).toBe("AUTHORISED");   // it stayed within bounds because sign function bounded it

    // Now craft a MALICIOUS authorization directly bypassing the sign function
    const maliciousBase = {
      ...auth,
      authorization_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    };
    // Re-sign the malicious version with delegate's key (attacker would attempt this)
    const { sign: ed25519Sign } = await import("node:crypto");
    const { canonicaliseAuthorization } = await import("../authorization");
    const { nex_signature_hex: _dropSig, ...maliciousUnsigned } = maliciousBase;
    void _dropSig;
    const badSig = ed25519Sign(null, canonicaliseAuthorization(maliciousUnsigned), d1.identity.private).toString("hex");
    const badAuth = { ...maliciousUnsigned, nex_signature_hex: badSig };
    const r2 = await verifyDelegatedAuthorization({ delegation: del, authorization: badAuth, proposal, trusted_founder_public_keys_hex: [founder.publicHex] });
    expect(r2.verdict).toBe("NOT_AUTHORIZED_AUTHORIZATION_EXPIRED");
  });

  // ── D-11 · persistence round-trip ────────────────────────────────────
  it("D-11 · delegation persists to GB storage · reloadable · signature still verifies", async () => {
    const founder = makeFounderKp();
    const del = signFounderDelegation({
      delegate_agent_id: "some-agent", delegate_public_key_der_hex: "00".repeat(46),
      allowed: {
        proposal_kinds: [], file_path_prefixes: ["src/"],
        stages_allowed: ["WO-04"], max_risk_level: "LOW", mission_ids_allowed: [], cap_ids_allowed: [],
      },
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      founder_public_key_der_hex: founder.publicHex, founder_private_key_pkcs8_hex: founder.privateHex,
    });
    await persistDelegation(del);
    const loaded = await loadDelegation(del.delegation_id);
    expect(loaded).not.toBeNull();
    if (loaded) {
      expect(verifyDelegationSignature(loaded, [founder.publicHex])).toBe(true);
    }
  });

  // ── D-12 · authorization signature verification ──────────────────────
  it("D-12 · verifyAuthorizationSignature succeeds for a correctly signed envelope · fails on tamper", async () => {
    const founder = makeFounderKp();
    const n1 = `nex1-cap-exec-${RUN}-d12`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n1));
    const d1 = await startNex1Daemon({ agent_id: n1, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d1.stop);
    const proposal = await seedProposal({});
    const del = signFounderDelegation({
      delegate_agent_id: n1, delegate_public_key_der_hex: d1.identity.public_key_der_hex,
      allowed: {
        proposal_kinds: [], file_path_prefixes: ["src/app/shop/"],
        stages_allowed: ["WO-04"], max_risk_level: "LOW", mission_ids_allowed: [], cap_ids_allowed: [],
      },
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      founder_public_key_der_hex: founder.publicHex, founder_private_key_pkcs8_hex: founder.privateHex,
    });
    const auth = signDelegatedAuthorization({ delegate_identity: d1.identity, delegation: del, proposal, mission_id: null });
    expect(verifyAuthorizationSignature(auth)).toBe(true);
    // Tamper
    const tampered = { ...auth, proposal_id: "different-proposal" };
    expect(verifyAuthorizationSignature(tampered)).toBe(false);
  });

  // ── D-13 · Orchestrator FOUNDER_AUTH_VALID gate consumes delegation ──
  it("D-13 · Orchestrator's FOUNDER_AUTH_VALID gate consumes the delegation model · VALID on happy path", async () => {
    const { computeFounderAuthGateDelegated } = await import("@/lib/nex-agent-runtime/orchestrator/gate-verification");
    const founder = makeFounderKp();
    const n1 = `nex1-cap-exec-${RUN}-d13`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n1));
    const d1 = await startNex1Daemon({ agent_id: n1, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d1.stop);
    const proposal = await seedProposal({});
    const del = signFounderDelegation({
      delegate_agent_id: n1, delegate_public_key_der_hex: d1.identity.public_key_der_hex,
      allowed: {
        proposal_kinds: [], file_path_prefixes: ["src/app/shop/"],
        stages_allowed: ["WO-04"], max_risk_level: "LOW", mission_ids_allowed: [], cap_ids_allowed: [],
      },
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      founder_public_key_der_hex: founder.publicHex, founder_private_key_pkcs8_hex: founder.privateHex,
    });
    const auth = signDelegatedAuthorization({ delegate_identity: d1.identity, delegation: del, proposal, mission_id: null });
    const gate = await computeFounderAuthGateDelegated({
      proposal, delegation: del, authorization: auth,
      trusted_founder_public_keys_hex: [founder.publicHex],
    });
    expect(gate.verdict).toBe("VALID");
    expect(gate.detail).toMatch(/AUTHORISED/);
  });

  // ── D-14 · Authorization ≠ Verification (NOT_VERIFIED doctrine echo) ─
  it("D-14 · a valid delegation does NOT imply verification of execution · doctrine echo", async () => {
    const founder = makeFounderKp();
    const n1 = `nex1-cap-exec-${RUN}-d14`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n1));
    const d1 = await startNex1Daemon({ agent_id: n1, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d1.stop);
    const proposal = await seedProposal({});
    const del = signFounderDelegation({
      delegate_agent_id: n1, delegate_public_key_der_hex: d1.identity.public_key_der_hex,
      allowed: {
        proposal_kinds: [], file_path_prefixes: ["src/app/shop/"],
        stages_allowed: ["WO-04"], max_risk_level: "LOW", mission_ids_allowed: [], cap_ids_allowed: [],
      },
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      founder_public_key_der_hex: founder.publicHex, founder_private_key_pkcs8_hex: founder.privateHex,
    });
    const auth = signDelegatedAuthorization({ delegate_identity: d1.identity, delegation: del, proposal, mission_id: null });
    const authResult = await verifyDelegatedAuthorization({
      delegation: del, authorization: auth, proposal, trusted_founder_public_keys_hex: [founder.publicHex],
    });
    // Authorization AUTHORISED means "permitted to attempt". Verification is a SEPARATE concept.
    expect(authResult.verdict).toBe("AUTHORISED");
    // The 7-step verification chain is not yet complete for this proposal · no evidence of execution has been recorded
    // (this is enforced elsewhere · Orchestrator's WORKSTATION_ALLOWED gate requires all 6 gates + freshness + consistency;
    //  authorisation is a NECESSARY condition, not a sufficient one for verification)
    expect(authResult.reason_summary).toMatch(/all .* checks passed/);
  });

  // ── D-15 · persisted authorization queryable by proposal_id ──────────
  it("D-15 · delegated authorization persists · queryable by proposal_id", async () => {
    const { loadAuthorizationsForProposal } = await import("../authorization");
    const founder = makeFounderKp();
    const n1 = `nex1-cap-exec-${RUN}-d15`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", n1));
    const d1 = await startNex1Daemon({ agent_id: n1, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d1.stop);
    const proposal = await seedProposal({});
    const del = signFounderDelegation({
      delegate_agent_id: n1, delegate_public_key_der_hex: d1.identity.public_key_der_hex,
      allowed: {
        proposal_kinds: [], file_path_prefixes: ["src/app/shop/"],
        stages_allowed: ["WO-04"], max_risk_level: "LOW", mission_ids_allowed: [], cap_ids_allowed: [],
      },
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      founder_public_key_der_hex: founder.publicHex, founder_private_key_pkcs8_hex: founder.privateHex,
    });
    const auth = signDelegatedAuthorization({ delegate_identity: d1.identity, delegation: del, proposal, mission_id: null });
    await persistDelegatedAuthorization(auth);
    const rows = await loadAuthorizationsForProposal(proposal.proposal_id);
    expect(rows.some((r) => r.authorization_id === auth.authorization_id)).toBe(true);
  });
});
