#!/usr/bin/env node
// scripts/nex-v1-rotate-founder-credential.mjs
//
// V.1 SECURITY CLOSURE (2026-09-08) · Founder-authorized narrow-scope V.1 diff
//
// PURPOSE
// -------
// Manual, single-run credential rotation CLI for the Founder.
//
// Generates a cryptographically-strong new Founder credential, scrypt-hashes
// it in memory, persists ONLY the hash record to the store (via
// rotateCredentialStore), then prints the plaintext ONCE to stdout for the
// Founder to capture into a secure secret manager. The plaintext is NEVER
// written to disk by this script and never returned by any API surface.
//
// USAGE (Founder runs this manually · never in CI · never automated)
// ------------------------------------------------------------------
//   node scripts/nex-v1-rotate-founder-credential.mjs
//
// SECURITY DISCIPLINE
// -------------------
//   1. This script must NOT be piped, redirected, or captured to a file.
//   2. Founder should run this in a private terminal · then clear terminal
//      scrollback + shell history immediately after.
//   3. Founder should copy the plaintext into a secure secret manager
//      (1Password / Bitwarden / OS keychain) · never a text file.
//   4. Every rotation atomically supersedes ALL prior active credentials
//      so the previous plaintext is definitively invalidated.
//
// This CLI DOES NOT accept a plaintext argument — that would leak the
// credential into shell history. It ALWAYS generates a fresh, high-entropy
// random credential.

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

// ─── Guard: refuse to run if stdout is being captured/piped ──────

if (!process.stdout.isTTY) {
  console.error("");
  console.error("[nex-v1-rotate-founder-credential] REFUSED");
  console.error("");
  console.error("Standard output is not a TTY — this looks like the script is being");
  console.error("piped, redirected, or captured. That would persist the plaintext");
  console.error("credential to a file or another process. This script MUST run in a");
  console.error("private interactive terminal so the plaintext appears only on the");
  console.error("Founder's screen and never enters any log, file, or captured stream.");
  console.error("");
  console.error("Correct usage:  node scripts/nex-v1-rotate-founder-credential.mjs");
  console.error("");
  process.exit(2);
}

// ─── Confirmation prompt (belt + braces) ─────────────────────────

console.log("");
console.log("=========================================================");
console.log(" V.1 · FOUNDER CREDENTIAL ROTATION");
console.log("=========================================================");
console.log("");
console.log(" This will:");
console.log("   1. Generate a fresh 32-char cryptographically-random credential");
console.log("   2. scrypt-hash it in memory");
console.log("   3. Append the hash to data/owner-identity/credentials.jsonl");
console.log("   4. Supersede ALL previously-active credentials atomically");
console.log("   5. Print the NEW plaintext ONCE on screen for you to capture");
console.log("");
console.log(" Capture the plaintext into a secure secret manager NOW.");
console.log(" This script will not print it again. It is not stored anywhere");
console.log(" other than your screen at the moment of rotation.");
console.log("");
console.log(" Continue in 3 seconds. Ctrl-C to abort.");
console.log("");

await new Promise((r) => setTimeout(r, 3000));

// ─── Invoke the store via a tiny TypeScript runner ───────────────

const inner = String.raw`
import { randomBytes } from "node:crypto";
import { hashOwnerCredential } from "@/lib/nex/owner-identity/hash";
import { rotateCredentialStore, summarizeCredentialStore } from "@/lib/nex/owner-identity/store";

// Cryptographically-random 32-char credential from base58 alphabet
// (no 0/O/I/l ambiguity · high entropy · safe to type)
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function generatePlaintext(): string {
  const bytes = randomBytes(64);
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

const plaintext = generatePlaintext();
const hash = hashOwnerCredential(plaintext);
const rotation = rotateCredentialStore({
  new_hash: hash,
  created_by: "founder_rotation_cli",
  note: "v1_security_closure_rotation",
});
const summary = summarizeCredentialStore();

console.log("");
console.log("=========================================================");
console.log(" ROTATION COMPLETE");
console.log("=========================================================");
console.log("");
console.log(" NEW CREDENTIAL (capture NOW · will not be shown again):");
console.log("");
console.log("    " + plaintext);
console.log("");
console.log(" Store fingerprint (safe · not the credential):");
console.log("    new_record_id      = " + rotation.new_record_id);
console.log("    superseded_count   = " + rotation.superseded_count);
console.log("    active_count       = " + summary.active_count);
console.log("    active_fingerprints= " + JSON.stringify(summary.active_fingerprints));
console.log("    ledger_path        = " + summary.ledger_path);
console.log("");
console.log(" Next steps:");
console.log("   1. Copy the credential above into 1Password/Bitwarden/keychain.");
console.log("   2. Clear your terminal scrollback (Ctrl-L / clear && printf '\\033c').");
console.log("   3. Clear shell history if you scrolled back after seeing the value.");
console.log("");
console.log(" This plaintext exists nowhere else. If lost, run rotation again.");
console.log("");
`;

const dir = path.resolve(process.cwd(), "scripts", ".v1-rotate-runner");
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const tsPath = path.join(dir, "runner.ts");
writeFileSync(tsPath, inner, "utf8");
process.on("exit", () => { try { unlinkSync(tsPath); } catch { /* */ } });

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", tsPath],
  { cwd: process.cwd(), stdio: "inherit", env: { ...process.env, NODE_NO_WARNINGS: "1" }, shell: true }
);
child.on("exit", (code) => process.exit(code ?? 1));
