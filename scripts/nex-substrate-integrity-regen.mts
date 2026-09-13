// scripts/nex-substrate-integrity-regen.mts
//
// Regenerate the WO-13 substrate integrity table.
//
// Reads the six security-critical substrate files, computes SHA-256 for each,
// signs the canonical (path, hash) list with the attestation private key
// (loaded from .nex-secrets/attestation-private.hex, which is gitignored),
// and prints a ready-to-paste `SUBSTRATE_INTEGRITY_TABLE` const for
// src/lib/nex1-orchestrator/wo13-integrity.ts.
//
// Usage:
//   npx tsx scripts/nex-substrate-integrity-regen.mts
//
// The founder runs this every time a legitimately-authorised change to any
// substrate file is committed. If the private key is not present in
// .nex-secrets/, the script fails loudly rather than silently no-op signing.

import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, createPrivateKey, sign } from "node:crypto";

const SUBSTRATE_FILES = [
  "src/lib/nex1-orchestrator/wo2-founder-keys.ts",
  "src/lib/nex1-orchestrator/wo2-authorization.ts",
  "src/lib/nex1-orchestrator/wo3-challenger.ts",
  "src/lib/nex1-orchestrator/wo3-templates.ts",
  "src/lib/nex1-orchestrator/wo4-executor.ts",
  "src/lib/nex1-orchestrator/wo5-allowed-executables.ts",
  "src/lib/nex1-orchestrator/wo13-attestation.ts",
];

async function main() {
  const repo = process.cwd();

  // 1. hash each file
  const records: Array<{ path: string; sha256_hex: string }> = [];
  for (const rel of SUBSTRATE_FILES) {
    const buf = await fs.readFile(path.join(repo, rel));
    records.push({ path: rel, sha256_hex: createHash("sha256").update(buf).digest("hex") });
  }

  // 2. canonical form = sorted "path<TAB>hash" lines joined with "\n"
  const sorted = [...records].sort((a, b) => a.path.localeCompare(b.path));
  const canonical = Buffer.from(sorted.map(r => `${r.path}\t${r.sha256_hex}`).join("\n"), "utf8");

  // 3. sign with attestation private key
  const pkHex = (await fs.readFile(path.join(repo, ".nex-secrets/attestation-private.hex"), "utf8")).trim();
  const privateKey = createPrivateKey({ key: Buffer.from(pkHex, "hex"), format: "der", type: "pkcs8" });
  const signature_hex = sign(null, canonical, privateKey).toString("hex");

  // 4. emit paste-ready const
  console.log("// ── paste into wo13-integrity.ts ──────────────────────────");
  console.log("export const SUBSTRATE_INTEGRITY_TABLE: SubstrateIntegrityTable = Object.freeze({");
  console.log(`  version: "wo13.v0.1",`);
  console.log(`  files: Object.freeze([`);
  for (const r of sorted) {
    console.log(`    Object.freeze({ path: ${JSON.stringify(r.path)}, sha256_hex: ${JSON.stringify(r.sha256_hex)} }),`);
  }
  console.log(`  ]) as readonly SubstrateIntegrityRecord[],`);
  console.log(`  attestation_signature_hex: ${JSON.stringify(signature_hex)},`);
  console.log("}) as SubstrateIntegrityTable;");
  console.log("// ── end paste ─────────────────────────────────────────────");
}

main().catch(err => { console.error(err); process.exit(1); });
