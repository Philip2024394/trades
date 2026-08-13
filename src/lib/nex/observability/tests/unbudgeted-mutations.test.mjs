#!/usr/bin/env node
// unbudgeted-mutations.test.mjs · Wave 3 · H3 · T-5b drift-catcher
//
// Governed by: docs/headquarters-production-readiness/WAVE-3-H3-TIMEOUT-BUDGETS.md
//
// T-5b (mutation-oriented external calls) is EXPLICITLY DEFERRED by the design
// (see W-C-TIMEOUT-BUDGETS-DESIGN.md §3). Setting a naïve timeout on a mutating
// external call risks a duplicate side-effect if the external system completed
// at second 31 but we timed out at second 30 and then retried. That is the
// exact class of failure Headquarters must prevent.
//
// This drift-catcher does NOT force a timeout onto these files. It DOES
// ensure the set of known T-5b sites doesn't grow silently — any new mutation
// adapter must either add a timeout AND idempotency key (out of scope this
// batch) OR be added to the allowlist below with a justification.
//
// Assertions:
//   TB1 · every file in the allowlist EXISTS in the repo (bit-rot guard)
//   TB2 · no NEW file under src/lib/nex/{delivery,notifications,push}/
//         appears without either (a) being on the allowlist OR (b) importing
//         from @/lib/nex/config/timeouts (indicates the author added a timeout
//         and considered the T-5b implications)
//   TB3 · every allowlist entry has a documented reason (non-empty)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..", "..", "..");

// Explicit allowlist of the 11 mutation-oriented external-call sites known to
// the H3 design. Each entry MUST have a non-empty reason. Adding an entry is
// a code change reviewers must approve. Removing an entry means the timeout
// should now be enforced OR the site has been retired — both require review.
const T5B_ALLOWLIST = [
  { path: "src/lib/nex/delivery/adapters/mailgun.ts",
    reason: "Mailgun send · deferred pending v-api-key idempotency design" },
  { path: "src/lib/nex/delivery/adapters/postmark.ts",
    reason: "Postmark send · deferred pending idempotency-key header design" },
  { path: "src/lib/nex/delivery/adapters/sendgrid.ts",
    reason: "SendGrid send · deferred pending X-SG-Message-ID dedup design" },
  { path: "src/lib/nex/delivery/adapters/ses.ts",
    reason: "SES send · deferred pending SES SDK idempotency review" },
  { path: "src/lib/nex/delivery/adapters/smtp.ts",
    reason: "Raw SMTP send · deferred pending SMTP Message-ID dedup design" },
  { path: "src/lib/nex/notifications/adapters/twilio_sms.ts",
    reason: "Twilio SMS · deferred pending Twilio Idempotency-Key header design" },
  { path: "src/lib/nex/notifications/adapters/whatsapp_meta.ts",
    reason: "WhatsApp Cloud · deferred pending message-id dedup design" },
  { path: "src/lib/nex/notifications/adapters/web_push.ts",
    reason: "Web Push notifications adapter · deferred pending topic/collapse-id design" },
  { path: "src/lib/nex/push/client.ts",
    reason: "Push client · 6 push sites · deferred pending topic/collapse-id design" },
  { path: "src/lib/nex/push/server.ts",
    reason: "Push server-side send · deferred pending push idempotency-key design" },
  { path: "src/lib/nex/alerts/dispatch.ts",
    reason: "Alert webhook dispatch · 2 mutation sites use AbortSignal.timeout(8s) locally · retained pending centralised design" },
];

test("TB1 · every allowlist entry exists in the repo", () => {
  const missing = [];
  for (const entry of T5B_ALLOWLIST) {
    const abs = join(REPO, entry.path);
    if (!existsSync(abs)) missing.push(entry.path);
  }
  assert.equal(missing.length, 0,
    `T-5b allowlist references files that no longer exist: ${missing.join(" · ")}. Either the file was moved (update the allowlist) or retired (remove the entry).`);
});

test("TB2 · no new mutation-adapter file appears outside the allowlist without opting into timeouts", () => {
  const roots = [
    "src/lib/nex/delivery/adapters",
    "src/lib/nex/notifications/adapters",
    "src/lib/nex/push",
  ];
  const allowedPaths = new Set(T5B_ALLOWLIST.map((e) => e.path));
  const violations = [];

  for (const root of roots) {
    const abs = join(REPO, root);
    if (!existsSync(abs)) continue;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (!/\.ts$/.test(entry.name)) continue;
      if (/\.test\.(ts|mjs)$/.test(entry.name)) continue;
      // Skip filenames prefixed with `_` (private helpers, not adapters).
      if (entry.name.startsWith("_")) continue;
      // Skip files that are clearly non-network (mock chaos harness).
      if (entry.name === "chaos.ts") continue;
      // web_push.ts is on the boundary · include it in the drift-catcher.
      const rel = `${root}/${entry.name}`;
      if (allowedPaths.has(rel)) continue;
      // If not on allowlist, require the file to at least import from the
      // timeouts config module (a proxy signal that the author considered
      // the T-5b implications). If it does, drift-catcher passes; if not,
      // it needs review.
      const src = readFileSync(join(REPO, rel), "utf8");
      const optedIn = /from\s+["']@\/lib\/nex\/config\/timeouts["']/.test(src);
      if (!optedIn) {
        violations.push(rel);
      }
    }
  }
  assert.equal(violations.length, 0,
    `T-5b drift-catcher · new mutation-adapter file(s) appeared without a timeout-config import AND without an allowlist entry: ${violations.join(" · ")}. Either add a timeout+idempotency-key AND import from @/lib/nex/config/timeouts, or add an allowlist entry with a justification.`);
});

test("TB3 · every allowlist entry has a non-empty reason", () => {
  for (const entry of T5B_ALLOWLIST) {
    assert.ok(typeof entry.reason === "string" && entry.reason.trim().length >= 10,
      `Allowlist entry ${entry.path} needs a real reason (≥ 10 chars). Got: ${JSON.stringify(entry.reason)}`);
  }
});
