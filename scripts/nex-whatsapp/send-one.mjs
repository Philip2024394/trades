#!/usr/bin/env node
// scripts/nex-whatsapp/send-one.mjs
//
// Stage 3.39 · Manual live-fire · human-in-the-loop first real message.
//
// PURPOSE: allow the operator to send ONE real WhatsApp message using
// the full NEX stack (authorization → chain → provider → outbox →
// reconciliation) with real Meta Cloud credentials. This script is
// the acceptance-criterion demonstration for Stage 3.39.
//
// USAGE:
//
//   node scripts/nex-whatsapp/send-one.mjs \
//     --to "+6281234567890" \
//     --body "Test message from NEX" \
//     --target-name "Manual Test Recipient"
//
// REQUIRED ENV (typically in .env.local · NEVER committed):
//   NEX_META_PHONE_NUMBER_ID           · Meta phone number id
//   NEX_META_ACCESS_TOKEN              · Meta Cloud API bearer token
//   NEX_WHATSAPP_OUTBOX_DRIVER=postgres · use durable outbox
//   NEX_POSTGRES_URL                   · Postgres connection string
//
// OPTIONAL ENV (needed to receive the delivery webhook · the webhook
// endpoint runs in the Next.js app, not this script):
//   NEX_META_APP_SECRET                · HMAC verification
//   NEX_WHATSAPP_WEBHOOK_VERIFY_TOKEN  · subscription verification
//
// WHAT THIS SCRIPT DOES:
//   1. Loads config from env
//   2. Constructs the WhatsApp Meta Cloud provider
//   3. Constructs the provider-backed adapter
//   4. Calls runActionChain with a PRE-GRANTED authorization
//      (the human running this script IS the authorization)
//   5. Prints correlation id + terminal state + outbox entry
//
// WHAT THIS SCRIPT DELIBERATELY DOES NOT DO:
//   · Automate the send · human runs it once per message
//   · Retry on UNKNOWN · that requires reconciliation
//   · Loop over recipients · v1 is one-message-per-invocation

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    to:            { type: "string" },
    body:          { type: "string" },
    "target-name": { type: "string" },
    "dry-run":     { type: "boolean" },
  },
});

if (!values.to || !values.body || !values["target-name"]) {
  console.error("Usage: node scripts/nex-whatsapp/send-one.mjs --to \"+62...\" --body \"...\" --target-name \"...\" [--dry-run]");
  process.exit(2);
}

// Dynamic imports so this script works from a bare `node` invocation
// against the tsx/esbuild-compiled brain modules. In practice you run
// this with tsx: `npx tsx scripts/nex-whatsapp/send-one.mjs ...`
const { loadWhatsAppConfig, canSendWhatsApp } = await import("../../src/lib/nex/config/whatsapp.ts");
const { makeMetaCloudProvider }               = await import("../../src/lib/nex/brain/adapters/whatsapp-provider-meta-cloud.ts");
const { makeWhatsAppProviderAdapter }         = await import("../../src/lib/nex/brain/adapters/whatsapp-provider-adapter.ts");
const { runActionChain }                      = await import("../../src/lib/nex/brain/action-chain.ts");
const { getOutboxEntry, _setOutboxDriverForTests, makePostgresOutboxDriver } = await import("../../src/lib/nex/brain/adapters/whatsapp-outbox.ts");
// Dedicated pool for the Trades/Hammerex Supabase (where the outbox
// table lives) · NEVER uses NEX_POSTGRES_URL. Post-cutover, NEX_POSTGRES_URL
// points at Project B, which does not have public.hammerex_nex_whatsapp_outbox.
const { withWhatsAppOutboxClient }            = await import("../../src/lib/nex/brain/adapters/whatsapp-outbox-db.ts");

const cfg = loadWhatsAppConfig();
if (!canSendWhatsApp(cfg)) {
  console.error("FATAL: NEX_META_PHONE_NUMBER_ID or NEX_META_ACCESS_TOKEN is not set in env");
  console.error("This script REQUIRES real credentials in .env.local · it will not use stubs");
  process.exit(3);
}
if (cfg.outboxDriver !== "postgres") {
  console.error("WARN: NEX_WHATSAPP_OUTBOX_DRIVER is not 'postgres' · durability is NOT guaranteed");
  console.error("      For a real live-fire test this MUST be 'postgres' with NEX_POSTGRES_URL set");
  if (!values["dry-run"]) {
    console.error("      Pass --dry-run to bypass this check for a smoke test");
    process.exit(4);
  }
}
if (cfg.outboxDriver === "postgres") {
  // Wire the Postgres driver explicitly for this script's process.
  // withWhatsAppOutboxClient reads NEX_WHATSAPP_OUTBOX_POSTGRES_URL only.
  if (!process.env.NEX_WHATSAPP_OUTBOX_POSTGRES_URL) {
    console.error("FATAL: NEX_WHATSAPP_OUTBOX_POSTGRES_URL is not set");
    console.error("This script requires the outbox URL for the Trades/Hammerex Supabase");
    console.error("(where public.hammerex_nex_whatsapp_outbox lives). Set it in .env.local.");
    process.exit(5);
  }
  _setOutboxDriverForTests(makePostgresOutboxDriver(withWhatsAppOutboxClient));
}

const provider = makeMetaCloudProvider({
  credentials: {
    phoneNumberId: cfg.metaPhoneNumberId,
    accessToken:   cfg.metaAccessToken,
    apiVersion:    cfg.metaApiVersion,
  },
});
const adapter = makeWhatsAppProviderAdapter({ provider });

const nowIso = () => new Date().toISOString();
const target = {
  canonical:      values["target-name"],
  contactChannel: { kind: "whatsapp", value: values.to, source: "manual" },
  resolvedAt:     nowIso(),
};
const authorization = {
  state:    "GRANTED",
  source:   "user_reply",
  at:       nowIso(),
  evidence: `human operator ran send-one.mjs at ${nowIso()}`,
};

console.log("─── send-one · live-fire ────────────────────────────────");
console.log("provider:      ", provider.id);
console.log("outbox driver: ", cfg.outboxDriver);
console.log("target:        ", target.canonical);
console.log("to:            ", values.to);
console.log("body:          ", JSON.stringify(values.body));
console.log("");

if (values["dry-run"]) {
  console.log("DRY RUN · nothing sent");
  process.exit(0);
}

const audit = await runActionChain({
  kind:               "contact_via_whatsapp",
  requestedByMessage: "manual live-fire via send-one.mjs",
  target,
  authorization,
  adapter,
  payload: { body: values.body },
});

console.log("");
console.log("─── result ─────────────────────────────────────────────");
console.log("actionId:        ", audit.actionId);
console.log("correlationId:   ", audit.execution.correlationId);
console.log("finalState:      ", audit.finalState);
console.log("execution:       ", audit.execution.outcome?.kind);
console.log("verification:    ", audit.verification.state);
if (audit.verification.reason) console.log("reason:          ", audit.verification.reason);

if (audit.execution.correlationId) {
  const entry = await getOutboxEntry(audit.execution.correlationId);
  console.log("");
  console.log("─── outbox row ─────────────────────────────────────────");
  console.log(JSON.stringify(entry, null, 2));
}

console.log("");
console.log(audit.finalState === "VERIFIED"
  ? "→ VERIFIED · delivery proof received synchronously (rare · Meta usually sends via webhook)"
  : audit.finalState === "UNKNOWN"
    ? "→ UNKNOWN · message accepted by Meta · watch webhook logs for delivered event"
    : "→ FAILED · check reason above · outbox row captures resolution reason");
