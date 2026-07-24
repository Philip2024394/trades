#!/usr/bin/env node
/* eslint-disable no-console */
// Issue a signed invite token for either a Trade Brain Author OR a
// Brain Admin. Uses the same HMAC scheme the runtime session helpers
// use — see src/lib/nex/brains/_studio/_session.ts +
// src/lib/nex/brains/_admin/_session.ts.
//
// Usage:
//   node scripts/issue-brain-invite.mjs --role author --id you@example.com
//   node scripts/issue-brain-invite.mjs --role admin  --id you@example.com --ttl-days 14
//
// Env required (per role):
//   Author:
//     NEX_AUTHOR_ALLOWLIST         (must contain --id)
//     NEX_AUTHOR_INVITE_SECRET     (≥32 chars)
//   Admin:
//     NEX_BRAIN_ADMIN_ALLOWLIST    (must contain --id)
//     NEX_BRAIN_ADMIN_INVITE_SECRET (≥32 chars)
//
// The script does not persist anything. It just prints the token to
// stdout. Copy it and paste into the sign-in form at /authors (Author)
// or /admin-brains (Brain Admin).

import { createHmac } from "node:crypto";

function args() {
  const argv = process.argv.slice(2);
  const out = { role: null, id: null, ttlDays: 7 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--role") out.role = argv[++i];
    else if (a === "--id") out.id = argv[++i];
    else if (a === "--ttl-days") out.ttlDays = parseInt(argv[++i], 10);
    else if (a === "--help" || a === "-h") { help(); process.exit(0); }
    else { console.error(`Unknown arg: ${a}`); help(); process.exit(2); }
  }
  return out;
}

function help() {
  console.log(`Issue a Brain invite token.

Usage:
  node scripts/issue-brain-invite.mjs --role <author|admin> --id <email> [--ttl-days N]

Options:
  --role       author  (Trade Brain Author) OR admin  (Brain Admin reviewer)
  --id         Email or user id · must appear on the corresponding allowlist env var
  --ttl-days   Token validity (default 7)
  --help       Show this help
`);
}

function normalise(s) { return String(s).trim().toLowerCase(); }

function readAllowlist(envVar) {
  const raw = process.env[envVar] ?? "";
  return raw.split(",").map(normalise).filter(Boolean);
}

function requireSecret(envVar) {
  const v = process.env[envVar];
  if (!v || v.length < 32) {
    console.error(`Missing or too-short env var ${envVar} (need ≥32 chars).`);
    process.exit(1);
  }
  return v;
}

function issueToken({ id, ttlSeconds, secret }) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const salt    = Math.random().toString(36).slice(2, 14);
  const payload = `${id}|${expires}|${salt}`;
  const sig     = createHmac("sha256", secret).update(payload).digest("hex");
  return { token: `${payload}.${sig}`, expiresAt: new Date(expires * 1000).toISOString() };
}

const { role, id, ttlDays } = args();

if (!role || !id) {
  console.error("Both --role and --id are required.");
  help();
  process.exit(2);
}
if (role !== "author" && role !== "admin") {
  console.error(`--role must be 'author' or 'admin' (got '${role}')`);
  process.exit(2);
}
if (!Number.isFinite(ttlDays) || ttlDays < 1) {
  console.error(`--ttl-days must be a positive integer (got '${ttlDays}')`);
  process.exit(2);
}

const idNorm = normalise(id);

const allowlistEnv = role === "author" ? "NEX_AUTHOR_ALLOWLIST" : "NEX_BRAIN_ADMIN_ALLOWLIST";
const secretEnv    = role === "author" ? "NEX_AUTHOR_INVITE_SECRET" : "NEX_BRAIN_ADMIN_INVITE_SECRET";

const allowlist = readAllowlist(allowlistEnv);
if (allowlist.length === 0) {
  console.error(`${allowlistEnv} is empty or unset. Add '${id}' to that env var and restart.`);
  process.exit(1);
}
if (!allowlist.includes(idNorm)) {
  console.error(`'${id}' is not on ${allowlistEnv}. Current allowlist: ${allowlist.join(", ")}`);
  process.exit(1);
}

const secret = requireSecret(secretEnv);
const { token, expiresAt } = issueToken({ id: idNorm, ttlSeconds: ttlDays * 86400, secret });

console.log("─".repeat(72));
console.log(`Role:       ${role}`);
console.log(`Id:         ${idNorm}`);
console.log(`Expires:    ${expiresAt}`);
console.log(`Sign-in at: ${role === "author" ? "http://localhost:3008/authors" : "http://localhost:3008/admin-brains"}`);
console.log("─".repeat(72));
console.log(token);
console.log("─".repeat(72));
console.log("Paste the token above into the sign-in form. The token can be used once (a new one is issued on request).");
