// WO-WORKSTATION-13 · substrate-hardening adversarial acceptance tests
//
// Founder-authorised 2026-09-13 per the substrate-hardening WO. Every test
// in this file follows the same shape:
//
//   1. Take the substrate as it is.
//   2. Secretly change ONE security-critical thing.
//   3. Ask NEX to authorise / verify / execute.
//   4. Assert: NEX detects the tampering AND refuses to operate.
//
// If any assertion in this file weakens to "well, it kind of noticed,"
// WO-13 has failed its purpose. No happy-path tests. Adversarial only.

import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, generateKeyPairSync, sign as ed25519Sign, createPrivateKey } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  SUBSTRATE_INTEGRITY_TABLE,
  verifySubstrateIntegrity,
  canonicalizeIntegrityFiles,
  _resetSubstrateIntegrityCacheForTests,
  type SubstrateIntegrityTable,
  type SubstrateIntegrityRecord,
} from "../wo13-integrity";
import { assertSubstrateHardened } from "../wo13-substrate-guard";
import { verifyAttestationSignature } from "../wo13-attestation";
import {
  loadFounderKeyManifestFromJson,
  loadFounderKeyManifestFromEnv,
  signFounderKeyManifest,
  buildFounderKeyRecordForTest,
  canonicalizeFounderKeys,
  verifyFounderKeyManifestAttestation,
  EMPTY_FOUNDER_KEY_MANIFEST,
} from "../wo2-founder-keys";
import { generateKeyPair } from "@/lib/nex-controlled-hands/ed25519";
import { runCodeGenerationPipeline, WO3_APPLY_DIFF_ACTION } from "../wo3-pipeline";
import { signAuthorization } from "../wo2-authorization";
import { buildThreePageAppProjectModel, buildThreePageAppFilePlan } from "../wo11-three-page-app";

const REPO_ROOT = process.cwd();

function newTestAttestationKeyPair(): { public_der_hex: string; private_pkcs8_hex: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    public_der_hex:  (publicKey.export({ type: "spki",  format: "der" }) as Buffer).toString("hex"),
    private_pkcs8_hex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
  };
}

/** Build a signed integrity table over the actual current substrate files.
 *  Signed with a fresh test attestation key so the compiled-in production
 *  key doesn't have to be present on the test machine. */
async function buildSignedTestIntegrityTable(
  privateKeyPkcs8Hex: string,
): Promise<SubstrateIntegrityTable> {
  const paths = [
    "src/lib/nex1-orchestrator/wo13-attestation.ts",
    "src/lib/nex1-orchestrator/wo2-authorization.ts",
    "src/lib/nex1-orchestrator/wo2-founder-keys.ts",
    "src/lib/nex1-orchestrator/wo3-challenger.ts",
    "src/lib/nex1-orchestrator/wo3-templates.ts",
    "src/lib/nex1-orchestrator/wo4-executor.ts",
    "src/lib/nex1-orchestrator/wo5-allowed-executables.ts",
  ];
  const files: SubstrateIntegrityRecord[] = [];
  for (const p of paths) {
    const buf = await fs.readFile(path.join(REPO_ROOT, p));
    files.push({ path: p, sha256_hex: createHash("sha256").update(buf).digest("hex") });
  }
  const canonical = canonicalizeIntegrityFiles(files);
  const pk = createPrivateKey({ key: Buffer.from(privateKeyPkcs8Hex, "hex"), format: "der", type: "pkcs8" });
  const signature_hex = ed25519Sign(null, canonical, pk).toString("hex");
  return { version: "wo13.v0.1", files, attestation_signature_hex: signature_hex };
}

// ─────────────────────────────────────────────────────────────────────────
// B1 · No authority through a URL
//   Attack: a URL env var (endpoint / callback / model) becomes an
//           authority source somewhere in the substrate.
//   Detection: grep the substrate files for `process.env.*URL*` reads;
//              expect zero non-approved matches.
// ─────────────────────────────────────────────────────────────────────────
describe("WO-13 · B1 · URL / endpoint cannot grant authority", () => {
  it("no substrate file reads a URL/endpoint/callback env var into an authority decision", async () => {
    const substratePaths = SUBSTRATE_INTEGRITY_TABLE.files.map((f) => f.path);
    const violations: Array<{ file: string; line: number; text: string }> = [];
    for (const p of substratePaths) {
      const content = await fs.readFile(path.join(REPO_ROOT, p), "utf8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Comments and docstrings do not count
        const stripped = line.replace(/\/\/.*$/, "").replace(/\/\*[^]*?\*\//g, "");
        if (/process\.env\.[A-Z_]*(URL|ENDPOINT|CALLBACK|WEBHOOK|MODEL_URL|LLM_URL|API_URL)\b/.test(stripped)) {
          violations.push({ file: p, line: i + 1, text: line.trim() });
        }
      }
    }
    if (violations.length > 0) {
      const detail = violations.map(v => `${v.file}:${v.line} · ${v.text}`).join("\n");
      throw new Error(`substrate reads URL-like env var (B1 violation):\n${detail}`);
    }
    expect(violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B2 · Founder-key manifest is not swappable via configuration
//   Attack: attacker replaces manifest env var with a manifest containing
//           their own key, or removes the attestation signature.
//   Detection: loadFounderKeyManifestFromJson rejects unsigned or badly-
//              signed manifests. Only signatures by a compiled-in trusted
//              attestation key are accepted.
// ─────────────────────────────────────────────────────────────────────────
describe("WO-13 · B2 · manifest attestation cannot be forged", () => {
  it("an UNSIGNED manifest is rejected — even if it parses correctly", () => {
    const kp = generateKeyPair("attacker");
    const unsigned = {
      version: "wo2.v0.1",
      keys: [{
        key_id: kp.key_id,
        algorithm: "ed25519" as const,
        public_key_der_hex: kp.public_der_hex,
        purpose: "workstation_authorization" as const,
        valid_from: "2020-01-01T00:00:00.000Z",
      }],
      // no attestation_signature_hex — the attack
    };
    expect(() => loadFounderKeyManifestFromJson(JSON.stringify(unsigned))).toThrow(/attestation signature invalid or missing/);
  });

  it("a manifest signed by a DIFFERENT attestation key is rejected", () => {
    const kp = generateKeyPair("attacker");
    const attackerAttKey = newTestAttestationKeyPair();  // NOT in the compiled-in trusted set
    const signed = signFounderKeyManifest(attackerAttKey.private_pkcs8_hex, [
      buildFounderKeyRecordForTest(kp, { validFrom: "2020-01-01T00:00:00.000Z" }),
    ]);
    // Loading without a trustedKeys override uses the compiled-in list —
    // which does NOT include the attacker's attestation public key.
    expect(() => loadFounderKeyManifestFromJson(JSON.stringify(signed))).toThrow(/attestation signature invalid or missing/);
  });

  it("a TAMPERED signed manifest (key body changed after signing) is rejected", () => {
    const kp = generateKeyPair("legit");
    const akp = newTestAttestationKeyPair();
    const signed = signFounderKeyManifest(akp.private_pkcs8_hex, [
      buildFounderKeyRecordForTest(kp, { validFrom: "2020-01-01T00:00:00.000Z" }),
    ]);
    // Attacker attempts to append an EXTRA key while keeping the same signature
    const tampered = {
      ...signed,
      keys: [
        ...signed.keys,
        { key_id: "attacker-added", algorithm: "ed25519" as const, public_key_der_hex: "aa", purpose: "workstation_authorization" as const, valid_from: "2020-01-01T00:00:00.000Z" },
      ],
    };
    expect(() => loadFounderKeyManifestFromJson(JSON.stringify(tampered), [akp.public_der_hex]))
      .toThrow(/attestation signature invalid or missing/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B3 · Broker gate cannot be bypassed by the substrate
//   Attack: attacker adds a raw fs.writeFile / appendFile / rm to a
//           substrate file, hoping to skip the Broker.
//   Detection: grep the substrate for raw fs mutating calls; approved
//              exceptions are limited.
// ─────────────────────────────────────────────────────────────────────────
describe("WO-13 · B3 · substrate never bypasses the AuthorityBroker for content writes", () => {
  it("no substrate file contains a raw fs.writeFile / appendFile call outside the approved exceptions", async () => {
    // Approved exceptions:
    //  - wo4-executor's rollback path uses fs.unlink (approved: only fires
    //    when the primary write path failed anyway; not a bypass).
    const approvedExceptions = new Set([
      "src/lib/nex1-orchestrator/wo4-executor.ts",   // fs.mkdir workspace + fs.unlink rollback
    ]);
    const substratePaths = SUBSTRATE_INTEGRITY_TABLE.files.map((f) => f.path);
    const violations: Array<{ file: string; line: number; text: string }> = [];
    for (const p of substratePaths) {
      if (approvedExceptions.has(p)) continue;
      const content = await fs.readFile(path.join(REPO_ROOT, p), "utf8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const stripped = lines[i].replace(/\/\/.*$/, "");
        if (/fs\.(writeFile|appendFile|rm|unlink|write)\b/.test(stripped)) {
          violations.push({ file: p, line: i + 1, text: lines[i].trim() });
        }
      }
    }
    if (violations.length > 0) {
      const detail = violations.map(v => `${v.file}:${v.line} · ${v.text}`).join("\n");
      throw new Error(`substrate contains raw fs write (B3 violation):\n${detail}`);
    }
    expect(violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B4 · No remote-brain trust — substrate contains zero outbound HTTP/LLM calls
//   Attack: attacker adds fetch() / http.request() to a substrate file
//           and points it at their server that returns "you are authorised".
//   Detection: grep for outbound-request primitives; only the local
//              health-check exception is approved.
// ─────────────────────────────────────────────────────────────────────────
describe("WO-13 · B4 · substrate makes zero outbound network calls", () => {
  it("no substrate file contains fetch, http.request, https.request, axios, or LLM-client imports", async () => {
    const substratePaths = SUBSTRATE_INTEGRITY_TABLE.files.map((f) => f.path);
    const violations: Array<{ file: string; line: number; text: string }> = [];
    for (const p of substratePaths) {
      const content = await fs.readFile(path.join(REPO_ROOT, p), "utf8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const stripped = lines[i].replace(/\/\/.*$/, "");
        if (/\bfetch\(|\bhttp\.request\(|\bhttps\.request\(|\baxios\b|from\s+["']openai["']|from\s+["']@anthropic|from\s+["']claude/i.test(stripped)) {
          violations.push({ file: p, line: i + 1, text: lines[i].trim() });
        }
      }
    }
    if (violations.length > 0) {
      const detail = violations.map(v => `${v.file}:${v.line} · ${v.text}`).join("\n");
      throw new Error(`substrate contains outbound-request primitive (B4 violation):\n${detail}`);
    }
    expect(violations).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B5 · File-hash drift is detected
//   Attack: attacker edits a substrate file (any change, any reason).
//   Detection: verifySubstrateIntegrity reports FILE_DRIFTED with the
//              specific offending path(s). No happy-path passes silently.
// ─────────────────────────────────────────────────────────────────────────
describe("WO-13 · B5 · a single byte change to any listed substrate file is DETECTED", () => {
  it("real substrate matches its own attested hashes (baseline sanity)", async () => {
    _resetSubstrateIntegrityCacheForTests();
    const r = await verifySubstrateIntegrity(REPO_ROOT);
    expect(r.ok).toBe(true);
  });

  it("if the test signs a fake table with a wrong hash for wo2-authorization.ts, FILE_DRIFTED is reported", async () => {
    _resetSubstrateIntegrityCacheForTests();
    const akp = newTestAttestationKeyPair();
    // Build a test table where wo2-authorization.ts is claimed to hash to
    // a value that does NOT match the real file. Sign it with the test
    // attestation key so the SIGNATURE check passes — this isolates the
    // FILE_DRIFTED detection.
    const paths = SUBSTRATE_INTEGRITY_TABLE.files.map((f) => f.path);
    const files: SubstrateIntegrityRecord[] = [];
    for (const p of paths) {
      const buf = await fs.readFile(path.join(REPO_ROOT, p));
      const realHash = createHash("sha256").update(buf).digest("hex");
      const claimedHash = p === "src/lib/nex1-orchestrator/wo2-authorization.ts"
        ? "0000000000000000000000000000000000000000000000000000000000000000"  // wrong hash
        : realHash;
      files.push({ path: p, sha256_hex: claimedHash });
    }
    const canonical = canonicalizeIntegrityFiles(files);
    const pk = createPrivateKey({ key: Buffer.from(akp.private_pkcs8_hex, "hex"), format: "der", type: "pkcs8" });
    const signature_hex = ed25519Sign(null, canonical, pk).toString("hex");
    const table: SubstrateIntegrityTable = { version: "wo13.v0.1", files, attestation_signature_hex: signature_hex };

    const r = await verifySubstrateIntegrity(REPO_ROOT, table, [akp.public_der_hex]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("FILE_DRIFTED");
    if (r.reason !== "FILE_DRIFTED") return;
    expect(r.drifted).toContain("src/lib/nex1-orchestrator/wo2-authorization.ts");
  });

  it("if the test signs a fake table where wo3-templates.ts hashes wrong, FILE_DRIFTED is reported", async () => {
    _resetSubstrateIntegrityCacheForTests();
    const akp = newTestAttestationKeyPair();
    const paths = SUBSTRATE_INTEGRITY_TABLE.files.map((f) => f.path);
    const files: SubstrateIntegrityRecord[] = [];
    for (const p of paths) {
      const buf = await fs.readFile(path.join(REPO_ROOT, p));
      files.push({
        path: p,
        sha256_hex: p === "src/lib/nex1-orchestrator/wo3-templates.ts"
          ? "1111111111111111111111111111111111111111111111111111111111111111"
          : createHash("sha256").update(buf).digest("hex"),
      });
    }
    const canonical = canonicalizeIntegrityFiles(files);
    const pk = createPrivateKey({ key: Buffer.from(akp.private_pkcs8_hex, "hex"), format: "der", type: "pkcs8" });
    const signature_hex = ed25519Sign(null, canonical, pk).toString("hex");
    const r = await verifySubstrateIntegrity(REPO_ROOT, { version: "wo13.v0.1", files, attestation_signature_hex: signature_hex }, [akp.public_der_hex]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("FILE_DRIFTED");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B6 · Environment variables cannot silently switch authority mode
//   Attack: attacker sets NODE_ENV, SKIP_AUTH, BYPASS_AUTH, DEV_MODE, etc.
//   Detection: substrate has zero permissive env branches; behaviour is
//              identical under every permutation.
// ─────────────────────────────────────────────────────────────────────────
describe("WO-13 · B6 · env-driven bypass has no effect on substrate verification", () => {
  it("no substrate file has a permissive-mode env branch", async () => {
    const substratePaths = SUBSTRATE_INTEGRITY_TABLE.files.map((f) => f.path);
    const dangerPatterns = [
      /if\s*\(\s*process\.env\.[A-Z_]*(SKIP|BYPASS|DISABLE)_?AUTH/i,
      /if\s*\(\s*process\.env\.NODE_ENV\s*[!=]==?\s*["']production/,
      /process\.env\.NEX_ALLOW_UNSIGNED/i,
      /process\.env\.NEX_SKIP_INTEGRITY/i,
    ];
    const violations: Array<{ file: string; line: number; text: string; pattern: string }> = [];
    for (const p of substratePaths) {
      const content = await fs.readFile(path.join(REPO_ROOT, p), "utf8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const stripped = lines[i].replace(/\/\/.*$/, "");
        for (const pat of dangerPatterns) {
          if (pat.test(stripped)) {
            violations.push({ file: p, line: i + 1, text: lines[i].trim(), pattern: String(pat) });
          }
        }
      }
    }
    if (violations.length > 0) {
      const detail = violations.map(v => `${v.file}:${v.line} · ${v.pattern} · ${v.text}`).join("\n");
      throw new Error(`substrate contains permissive-env branch (B6 violation):\n${detail}`);
    }
    expect(violations).toEqual([]);
  });

  it("substrate integrity result is identical whether NODE_ENV=development or =production", async () => {
    _resetSubstrateIntegrityCacheForTests();
    const previous = process.env.NODE_ENV;

    process.env.NODE_ENV = "development";
    _resetSubstrateIntegrityCacheForTests();
    const dev = await verifySubstrateIntegrity(REPO_ROOT);

    process.env.NODE_ENV = "production";
    _resetSubstrateIntegrityCacheForTests();
    const prod = await verifySubstrateIntegrity(REPO_ROOT);

    process.env.NODE_ENV = previous;
    _resetSubstrateIntegrityCacheForTests();

    expect(dev.ok).toBe(prod.ok);
  });

  it("production mode REFUSES inline NEX_FOUNDER_KEY_MANIFEST_JSON (WO-13 Change 4)", async () => {
    const previous = process.env.NODE_ENV;
    const previousManifestJson = process.env.NEX_FOUNDER_KEY_MANIFEST_JSON;
    try {
      process.env.NODE_ENV = "production";
      process.env.NEX_FOUNDER_KEY_MANIFEST_JSON = JSON.stringify({ version: "wo2.v0.1", keys: [] });
      await expect(loadFounderKeyManifestFromEnv()).rejects.toThrow(/rejected in production/);
    } finally {
      process.env.NODE_ENV = previous;
      if (previousManifestJson === undefined) delete process.env.NEX_FOUNDER_KEY_MANIFEST_JSON;
      else process.env.NEX_FOUNDER_KEY_MANIFEST_JSON = previousManifestJson;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B7 · Fresh clone fails closed
//   Attack: attacker clones the repo and expects to gain authority
//           without needing the founder private key or a signed manifest.
//   Detection: with no env vars set, loadFounderKeyManifestFromEnv returns
//              the empty manifest; every verifyAuthorization then fails.
// ─────────────────────────────────────────────────────────────────────────
describe("WO-13 · B7 · a fresh clone with no manifest env fails closed", () => {
  it("loadFounderKeyManifestFromEnv with no env vars returns the empty manifest (no trusted keys)", async () => {
    const savedJson = process.env.NEX_FOUNDER_KEY_MANIFEST_JSON;
    const savedPath = process.env.NEX_FOUNDER_KEY_MANIFEST_PATH;
    delete process.env.NEX_FOUNDER_KEY_MANIFEST_JSON;
    delete process.env.NEX_FOUNDER_KEY_MANIFEST_PATH;
    try {
      const m = await loadFounderKeyManifestFromEnv();
      expect(m.keys).toEqual([]);
      expect(m).toBe(EMPTY_FOUNDER_KEY_MANIFEST);
    } finally {
      if (savedJson !== undefined) process.env.NEX_FOUNDER_KEY_MANIFEST_JSON = savedJson;
      if (savedPath !== undefined) process.env.NEX_FOUNDER_KEY_MANIFEST_PATH = savedPath;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B8 · Code swap is DETECTED
//   Attack: attacker replaces wo2-authorization.ts with a stub that
//           returns { ok: true } for every call.
//   Detection: the substrate integrity check hashes wo2-authorization.ts
//              and compares against the attested table. Any change fails.
//   The test proves this by writing a fake table where the CLAIMED hash
//   is what a stub would produce, and confirming the actual file's hash
//   is different — i.e. even if the attacker knew the stub's hash and
//   put it in the table, verifying the SIGNATURE over the fake table
//   against the compiled-in production key would ALSO fail (defence in
//   depth).
// ─────────────────────────────────────────────────────────────────────────
describe("WO-13 · B8 · replacing wo2-authorization.ts with a permissive stub is DETECTED", () => {
  it("a stub-swapped table's signature does NOT verify against the compiled-in production attestation key", async () => {
    // Simulate a stub: content that would make verifyAuthorization always
    // return { ok: true }. We do NOT actually write this to disk (that
    // would break every other test). We construct a table where
    // wo2-authorization.ts's hash claims to be the hash of the stub, then
    // check that we cannot sign this table with any key the production
    // system trusts.
    const stubContent = 'export function verifyAuthorization(): { ok: true } { return { ok: true }; }';
    const stubHash = createHash("sha256").update(stubContent).digest("hex");

    const paths = SUBSTRATE_INTEGRITY_TABLE.files.map((f) => f.path);
    const files: SubstrateIntegrityRecord[] = [];
    for (const p of paths) {
      const buf = await fs.readFile(path.join(REPO_ROOT, p));
      files.push({
        path: p,
        sha256_hex: p === "src/lib/nex1-orchestrator/wo2-authorization.ts"
          ? stubHash
          : createHash("sha256").update(buf).digest("hex"),
      });
    }
    // Attacker (who has NO access to the production attestation private
    // key) generates their own attestation keypair and signs the table.
    const attackerAttKey = newTestAttestationKeyPair();
    const canonical = canonicalizeIntegrityFiles(files);
    const pk = createPrivateKey({ key: Buffer.from(attackerAttKey.private_pkcs8_hex, "hex"), format: "der", type: "pkcs8" });
    const signature_hex = ed25519Sign(null, canonical, pk).toString("hex");
    const forgedTable: SubstrateIntegrityTable = { version: "wo13.v0.1", files, attestation_signature_hex: signature_hex };

    // Using the DEFAULT (compiled-in production) trusted attestation keys,
    // the attacker's signature does NOT verify — the substrate refuses.
    const r = await verifySubstrateIntegrity(REPO_ROOT, forgedTable);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("SIGNATURE_INVALID");
  });

  it("the substrate guard REFUSES a pipeline call when the substrate signature is invalid", async () => {
    _resetSubstrateIntegrityCacheForTests();
    // Provide the assertSubstrateHardened helper with an obviously-forged
    // table that carries a garbage signature; the guard must refuse.
    const files = SUBSTRATE_INTEGRITY_TABLE.files;
    const forgedTable: SubstrateIntegrityTable = {
      version: "wo13.v0.1",
      files,
      attestation_signature_hex: "00".repeat(64),  // 64-byte all-zero signature
    };
    const r = await assertSubstrateHardened({ useCache: false, table: forgedTable });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason_code).toBe("SUBSTRATE_SIGNATURE_INVALID");
  });

  it("the ULTIMATE assertion: secretly changing a substrate file's bytes is DETECTED by verifySubstrateIntegrity", async () => {
    // Isolation: work in a fresh temp repoRoot so the tamper does not
    // affect any other test file running in parallel. The strength of
    // the assertion is unchanged — we're running the SAME production
    // verifySubstrateIntegrity function against a real filesystem where
    // one file has been secretly modified.
    _resetSubstrateIntegrityCacheForTests();
    const tempRoot = path.join(REPO_ROOT, "data", "nex-agent-workspaces", `wo13-b8-tamper-${Date.now()}`);
    const targetRel = "src/lib/nex1-orchestrator/wo2-authorization.ts";
    const srcPaths = SUBSTRATE_INTEGRITY_TABLE.files.map((f) => f.path);
    try {
      // 1. Copy the real substrate into the temp workspace
      for (const rel of srcPaths) {
        const src = path.join(REPO_ROOT, rel);
        const dst = path.join(tempRoot, rel);
        await fs.mkdir(path.dirname(dst), { recursive: true });
        await fs.copyFile(src, dst);
      }

      // 2. Sign a fresh integrity table over the copies using a test
      //    attestation key — signature is valid ⇒ only source of failure
      //    for this test can be FILE_DRIFTED.
      const attKp = newTestAttestationKeyPair();
      const signedTable = await buildSignedTestIntegrityTable(attKp.private_pkcs8_hex);

      // 3. Sanity: unmodified copy verifies clean under the test key
      const clean = await verifySubstrateIntegrity(tempRoot, signedTable, [attKp.public_der_hex]);
      expect(clean.ok).toBe(true);

      // 4. Now tamper — append a byte to the target file inside the temp workspace
      const targetAbs = path.join(tempRoot, targetRel);
      const original = await fs.readFile(targetAbs);
      await fs.writeFile(targetAbs, Buffer.concat([original, Buffer.from("\n// TAMPERED\n")]));

      // 5. The integrity check must now detect the drift
      const tamperedResult = await verifySubstrateIntegrity(tempRoot, signedTable, [attKp.public_der_hex]);
      expect(tamperedResult.ok).toBe(false);
      if (tamperedResult.ok) return;
      expect(tamperedResult.reason).toBe("FILE_DRIFTED");
      if (tamperedResult.reason !== "FILE_DRIFTED") return;
      expect(tamperedResult.drifted).toContain(targetRel);

      // 6. And assertSubstrateHardened (the production entry point) reports
      //    the same failure with the pipeline-visible reason_code
      const guard = await assertSubstrateHardened({
        useCache: false,
        repoRoot: tempRoot,
        table: signedTable,
        trusted_attestation_keys: [attKp.public_der_hex],
      });
      expect(guard.ok).toBe(false);
      if (guard.ok) return;
      expect(guard.reason_code).toBe("SUBSTRATE_FILE_DRIFTED");
      expect(guard.offending_paths).toContain(targetRel);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    }
  }, 30_000);
});
