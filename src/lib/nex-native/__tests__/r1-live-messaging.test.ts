// src/lib/nex-native/__tests__/r1-live-messaging.test.ts
//
// R1 · Universal Live Messaging · deterministic guards.
//
// Section A · arrival payload shape is strictly 3 fields
// Section B · forbidden sensitive fields absent from the broadcast
// Section C · both chat surfaces consume the SAME shared module
// Section D · no Vault-only realtime / push / polling exists
// Section E · /peer-message/since is authenticated + participant-gated
// Section F · hard max limit = 50
// Section G · encrypted send emits exactly ONE logical arrival
// Section H · Vault subscription requires unlocked + ready
// Section I · fire-and-forget emit · never blocks or throws the send
// Section J · reconciliation triggers (mount + visibility + reconnect)
//             · never a setInterval

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}
function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

const EMIT_FILE = "src/lib/nex-native/realtime/message-arrival.ts";
const EVENTS_FILE = "src/lib/nex-native/realtime/message-events.ts";
const SINCE_ROUTE = "src/app/api/nex-native/peer-message/since/route.ts";
const ENCRYPTED_ROUTE =
  "src/app/api/nex-native/peer-message/encrypted/route.ts";
const PLAINTEXT_ACTIONS = "src/app/nex-native/_actions.ts";
const NORMAL_CLIENT =
  "src/app/nex-native/chat/peer/[accountId]/_message-events-client.tsx";
const VAULT_CLIENT =
  "src/app/nex-native/vault/home/chats/[conversationId]/_vault-chat-client.tsx";

const FORBIDDEN_PAYLOAD_FIELDS = [
  "body",
  "ciphertext",
  "ciphertext_b64",
  "nonce",
  "nonce_b64",
  "sender_public_key",
  "sender_device_id",
  "recipient_device_id",
  "attachment_url",
  "attachment_type",
  "attachment_meta",
  "reply_to_id",
  "sender_account_id",
];

// ────────────────────────────────────────────────────────────────────
// Section A · arrival payload shape is strictly 3 fields
// ────────────────────────────────────────────────────────────────────

describe("R1 · arrival payload shape", () => {
  it("message-arrival.ts declares exactly conversation_id + message_group_id + sent_at", () => {
    const src = read(EMIT_FILE);
    expect(src).toMatch(/export\s+interface\s+MessageArrivalPayload\s*\{/);
    const iface = src.match(
      /export\s+interface\s+MessageArrivalPayload\s*\{([\s\S]*?)\}/,
    );
    expect(iface).toBeTruthy();
    const body = iface![1]!;
    // The three allowed field names.
    expect(body).toMatch(/conversation_id\s*:/);
    expect(body).toMatch(/message_group_id\s*:/);
    expect(body).toMatch(/sent_at\s*:/);
    // No other field names in the interface.
    const extraFieldMatch = body
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "")
      .match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g);
    const fields = (extraFieldMatch ?? []).map((s) =>
      s.replace(/\s*:$/, "").trim(),
    );
    expect(fields.sort()).toEqual(
      ["conversation_id", "message_group_id", "sent_at"].sort(),
    );
  });

  it("the actual wire envelope built in emitMessageArrival carries only those three fields", () => {
    const src = read(EMIT_FILE);
    // Grep-static that the server builds `envelopePayload` from a
    // single object literal with exactly the 3 fields.
    const literal = src.match(
      /const\s+envelopePayload\s*:\s*MessageArrivalPayload\s*=\s*\{([\s\S]*?)\};/,
    );
    expect(literal).toBeTruthy();
    const body = literal![1]!;
    expect(body).toMatch(/conversation_id\s*:/);
    expect(body).toMatch(/message_group_id\s*:/);
    expect(body).toMatch(/sent_at\s*:/);
  });

  it("message-events.ts receive type MessageArrivalBroadcast has the same three fields", () => {
    const src = read(EVENTS_FILE);
    const iface = src.match(
      /export\s+interface\s+MessageArrivalBroadcast\s*\{([\s\S]*?)\}/,
    );
    expect(iface).toBeTruthy();
    const body = iface![1]!;
    expect(body).toMatch(/conversation_id\s*:/);
    expect(body).toMatch(/message_group_id\s*:/);
    expect(body).toMatch(/sent_at\s*:/);
    const extraFieldMatch = body
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "")
      .match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g);
    const fields = (extraFieldMatch ?? []).map((s) =>
      s.replace(/\s*:$/, "").trim(),
    );
    expect(fields.sort()).toEqual(
      ["conversation_id", "message_group_id", "sent_at"].sort(),
    );
  });
});

// ────────────────────────────────────────────────────────────────────
// Section B · forbidden sensitive fields absent from the broadcast
// ────────────────────────────────────────────────────────────────────

describe("R1 · forbidden fields never in the broadcast envelope", () => {
  it("emitMessageArrival envelope literal does not mention any forbidden field", () => {
    const src = read(EMIT_FILE);
    const literal = src.match(
      /const\s+envelopePayload\s*:\s*MessageArrivalPayload\s*=\s*\{([\s\S]*?)\};/,
    );
    expect(literal).toBeTruthy();
    const body = literal![1]!;
    for (const banned of FORBIDDEN_PAYLOAD_FIELDS) {
      expect(
        body,
        `arrival envelope must not reference '${banned}'`,
      ).not.toContain(banned);
    }
    // Explicit zero-tolerance for PIN / VMK / K_c / plaintext terms.
    expect(body).not.toMatch(/\bPIN\b/i);
    expect(body).not.toMatch(/\bVMK\b/);
    expect(body).not.toMatch(/\bK_c\b/);
    expect(body).not.toMatch(/plaintext/i);
  });

  it("the complete request body built for the Supabase broadcast endpoint only references the strict envelope payload", () => {
    const src = read(EMIT_FILE);
    // The request body construction is bounded between `const body =`
    // and the `fetch(` call that consumes it. The ONLY payload field
    // reference in that span must be the sealed envelopePayload.
    const bodyMatch = src.match(
      /const\s+body\s*=\s*\{([\s\S]*?)\};/,
    );
    expect(bodyMatch).toBeTruthy();
    const codeOnly = bodyMatch![1]!
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    for (const banned of FORBIDDEN_PAYLOAD_FIELDS) {
      const asField = new RegExp(`\\b${banned}\\s*:`, "g");
      expect(
        codeOnly.match(asField),
        `broadcast body must not include '${banned}' as a field`,
      ).toBeNull();
    }
    // Positive signal: the body references the sealed envelopePayload.
    expect(codeOnly).toMatch(/envelopePayload/);
  });
});

// ────────────────────────────────────────────────────────────────────
// Section C · both chat surfaces consume the SAME module
// ────────────────────────────────────────────────────────────────────

describe("R1 · one transport, two consumers", () => {
  it("normal chat consumer imports from the shared realtime/message-events module", () => {
    const src = read(NORMAL_CLIENT);
    expect(src).toMatch(
      /from\s+["']@\/lib\/nex-native\/realtime\/message-events["']/,
    );
    expect(src).toMatch(/openMessageEventsChannel/);
  });

  it("Vault chat consumer imports from the SAME shared module", () => {
    const src = read(VAULT_CLIENT);
    expect(src).toMatch(
      /from\s+["']@\/lib\/nex-native\/realtime\/message-events["']/,
    );
    expect(src).toMatch(/openMessageEventsChannel/);
  });

  it("both consumers register onPeerMessageArrival", () => {
    const normal = read(NORMAL_CLIENT);
    const vault = read(VAULT_CLIENT);
    expect(normal).toMatch(/onPeerMessageArrival\s*:/);
    expect(vault).toMatch(/onPeerMessageArrival\s*:/);
  });
});

// ────────────────────────────────────────────────────────────────────
// Section D · no Vault-only realtime / push / polling
// ────────────────────────────────────────────────────────────────────

function walk(dir: string, acc: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
}
function listVaultFiles(subPath: string): string[] {
  const base = path.join(ROOT, subPath);
  const acc: string[] = [];
  walk(base, acc);
  return acc.map((p) => path.relative(ROOT, p).replace(/\\/g, "/"));
}

describe("R1 · no Vault-only transport exists", () => {
  const vaultLibFiles = listVaultFiles("src/lib/nex-native/vault");
  const vaultAppFiles = listVaultFiles("src/app/nex-native/vault");
  const allVaultFiles = [...vaultLibFiles, ...vaultAppFiles];

  it("no Vault file names realtime message/arrival/subscribe/channel (except the sealed B.6A lock-sweep + the Vault chat consumer that reuses the shared module)", () => {
    const allowed = new Set<string>([
      // Sealed B.6A cross-tab lock-sweep · uses BroadcastChannel for
      // lock, NOT message delivery · explicitly out of R1 scope.
      "src/lib/nex-native/vault/client/lock-sweep.ts",
      "src/app/nex-native/vault/_cross-tab-lock-sweep-client.tsx",
      // R1 · Vault chat consumer that reuses the shared message-events
      // module · its filename does NOT include "realtime" or "arrival".
    ]);
    const offenders = allVaultFiles.filter((f) => {
      if (allowed.has(f)) return false;
      const base = path.basename(f).toLowerCase();
      return (
        base.includes("realtime") ||
        base.includes("arrival") ||
        base.includes("subscribe-messages") ||
        base.includes("message-channel")
      );
    });
    expect(
      offenders,
      `Vault must reuse the shared transport · offending files: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("no Vault file imports a Vault-only realtime library", () => {
    for (const f of allVaultFiles) {
      if (!/\.(ts|tsx)$/.test(f)) continue;
      const src = read(f);
      // Allowed shared transports.
      // The sealed cross-tab lock sweep uses BroadcastChannel ·
      // acceptable per B.6A seal.
      // Everything else that touches realtime MUST route through
      // @/lib/nex-native/realtime/*.
      const bad = src.match(
        /from\s+["']@\/lib\/nex-native\/vault\/[^"']*realtime[^"']*["']/,
      );
      expect(bad, `Vault-only realtime import found in ${f}`).toBeNull();
    }
  });

  it("no Vault-only push subscription module", () => {
    const offenders = allVaultFiles.filter((f) =>
      path.basename(f).toLowerCase().includes("push"),
    );
    expect(offenders).toEqual([]);
  });

  it("no setInterval / message polling anywhere in R1-added code", () => {
    for (const f of [
      EVENTS_FILE,
      EMIT_FILE,
      NORMAL_CLIENT,
      VAULT_CLIENT,
      SINCE_ROUTE,
    ]) {
      const src = read(f);
      const codeOnly = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      expect(codeOnly, `${f} must not use setInterval`).not.toMatch(
        /\bsetInterval\s*\(/,
      );
      expect(codeOnly).not.toMatch(/function\s+poll[A-Z]/);
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// Section E · /peer-message/since is authenticated + participant-gated
// ────────────────────────────────────────────────────────────────────

describe("R1 · reconciliation endpoint authorization", () => {
  it("file exists and uses the nodejs runtime", () => {
    expect(exists(SINCE_ROUTE)).toBe(true);
    const src = read(SINCE_ROUTE);
    expect(src).toMatch(/export\s+const\s+runtime\s*=\s*["']nodejs["']/);
  });

  it("session gate · returns 401 when not signed in", () => {
    const src = read(SINCE_ROUTE);
    expect(src).toMatch(/resolveNexAppSessionFromContext\s*\(\s*\)/);
    expect(src).toMatch(/not_signed_in/);
    expect(src).toMatch(/status:\s*401/);
  });

  it("participant gate · looks up the conversation + rejects non-participants with 403", () => {
    const src = read(SINCE_ROUTE);
    expect(src).toMatch(/getPeerConversationById/);
    expect(src).toMatch(/participant_a_id/);
    expect(src).toMatch(/participant_b_id/);
    expect(src).toMatch(/status:\s*403/);
  });

  it("validates conversation_id as a UUID before touching the DB", () => {
    const src = read(SINCE_ROUTE);
    expect(src).toMatch(/UUID_RE/);
    expect(src).toMatch(/invalid_conversation_id/);
  });
});

// ────────────────────────────────────────────────────────────────────
// Section F · hard max limit = 50
// ────────────────────────────────────────────────────────────────────

describe("R1 · reconciliation endpoint caps page size at 50", () => {
  it("declares HARD_MAX_LIMIT = 50", () => {
    const src = read(SINCE_ROUTE);
    expect(src).toMatch(/HARD_MAX_LIMIT\s*=\s*50\b/);
  });

  it("clamps the query parameter via Math.min", () => {
    const src = read(SINCE_ROUTE);
    expect(src).toMatch(/Math\.min\s*\(\s*limitParsed\s*,\s*HARD_MAX_LIMIT\s*\)/);
  });
});

// ────────────────────────────────────────────────────────────────────
// Section G · encrypted send emits exactly ONE logical arrival
// ────────────────────────────────────────────────────────────────────

describe("R1 · encrypted fan-out send emits one logical arrival", () => {
  it("encrypted route calls emitMessageArrival exactly once after sendEncryptedPeerMessages", () => {
    const src = read(ENCRYPTED_ROUTE);
    expect(src).toMatch(
      /from\s+["']@\/lib\/nex-native\/realtime\/message-arrival["']/,
    );
    // Exactly one emitMessageArrival(...) call in the file.
    const calls = (src.match(/emitMessageArrival\s*\(/g) ?? []).length;
    expect(calls).toBe(1);
    // The call uses body.message_group_id (the Bridge 76 group id,
    // shared across every fan-out sibling), NOT a per-row id.
    expect(src).toMatch(/messageGroupId:\s*body\.message_group_id/);
    // The call appears AFTER sendEncryptedPeerMessages, not before.
    const sendIdx = src.indexOf("sendEncryptedPeerMessages(inserts)");
    const emitIdx = src.indexOf("emitMessageArrival(");
    expect(sendIdx).toBeGreaterThan(-1);
    expect(emitIdx).toBeGreaterThan(sendIdx);
  });

  it("plaintext server action emits one arrival after sendPeerMessage", () => {
    const src = read(PLAINTEXT_ACTIONS);
    expect(src).toMatch(
      /from\s+["']@\/lib\/nex-native\/realtime\/message-arrival["']/,
    );
    // The plaintext send action calls emit exactly once.
    const section = src.slice(
      src.indexOf("export async function sendPeerMessageAction"),
      src.indexOf("export async function joinAffiliateAction"),
    );
    expect(section).toBeTruthy();
    const calls = (section.match(/emitMessageArrival\s*\(/g) ?? []).length;
    expect(calls).toBe(1);
    // Uses the actual inserted row's id as the dedup key + its real
    // server-stamped sent_at.
    expect(section).toMatch(/messageGroupId:\s*insertedRow\.id/);
    expect(section).toMatch(/sentAtIso:\s*insertedRow\.sent_at/);
  });
});

// ────────────────────────────────────────────────────────────────────
// Section H · Vault subscription requires unlocked + ready
// ────────────────────────────────────────────────────────────────────

describe("R1 · Vault locked-state behaviour", () => {
  it("Vault chat subscription is guarded by vault.unlocked && phase === 'ready'", () => {
    const src = read(VAULT_CLIENT);
    // The gated effect checks the guard before opening the channel.
    const effect = src.slice(
      src.indexOf("// Subscription lifecycle"),
      src.indexOf("// ── views"),
    );
    expect(effect).toBeTruthy();
    expect(effect).toMatch(/if\s*\(\s*!vault\.unlocked\s*\)\s*return/);
    expect(effect).toMatch(/if\s*\(\s*phase\s*!==\s*["']ready["']\s*\)\s*return/);
    expect(effect).toMatch(/openMessageEventsChannel/);
    // Dependency array includes vault.unlocked and phase so the
    // channel re-opens/tears-down on lock transitions.
    expect(effect).toMatch(/vault\.unlocked[\s,\]]/);
    expect(effect).toMatch(/phase[\s,\]]/);
  });

  it("catchUpSince also refuses to run when locked or not ready", () => {
    const src = read(VAULT_CLIENT);
    const fn = src.slice(
      src.indexOf("const catchUpSince"),
      src.indexOf("// Subscription lifecycle"),
    );
    expect(fn).toMatch(/if\s*\(\s*!vault\.unlocked\s*\)\s*return/);
    expect(fn).toMatch(/if\s*\(\s*phase\s*!==\s*["']ready["']\s*\)\s*return/);
  });
});

// ────────────────────────────────────────────────────────────────────
// Section I · fire-and-forget · emit never throws, never blocks send
// ────────────────────────────────────────────────────────────────────

describe("R1 · emit is fire-and-forget", () => {
  it("emitMessageArrival wraps the entire body in try/catch and never throws", () => {
    const src = read(EMIT_FILE);
    const fn = src.match(
      /export\s+async\s+function\s+emitMessageArrival[\s\S]+?^\}/m,
    );
    expect(fn).toBeTruthy();
    // Strip comments before scanning for `throw` so a docstring that
    // says "never throws" doesn't trip the guard.
    const codeOnly = fn![0]!
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    const firstTry = codeOnly.indexOf("try {");
    const firstFetch = codeOnly.indexOf("fetch(");
    expect(firstTry).toBeGreaterThan(-1);
    expect(firstFetch).toBeGreaterThan(firstTry);
    expect(codeOnly).toMatch(/catch\s*\{[\s\S]*?\}/);
    expect(codeOnly).not.toMatch(/\bthrow\s+/);
  });

  it("callers use `void emitMessageArrival(...)` so a rejected promise is swallowed by the runtime", () => {
    const enc = read(ENCRYPTED_ROUTE);
    expect(enc).toMatch(/void\s+emitMessageArrival\s*\(/);
    const act = read(PLAINTEXT_ACTIONS);
    expect(act).toMatch(/void\s+emitMessageArrival\s*\(/);
  });

  it("emit has a hard timeout so a hung broadcast endpoint cannot delay the send response", () => {
    const src = read(EMIT_FILE);
    expect(src).toMatch(/AbortController/);
    expect(src).toMatch(/signal:\s*controller\.signal/);
    // Timeout in ms is small (<=5000).
    const match = src.match(/setTimeout\s*\(\s*\(\s*\)\s*=>\s*controller\.abort\(\s*\)\s*,\s*(\d+)\s*\)/);
    expect(match).toBeTruthy();
    const ms = Number.parseInt(match![1]!, 10);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(5000);
  });
});

// ────────────────────────────────────────────────────────────────────
// Section J · reconciliation triggers · no setInterval
// ────────────────────────────────────────────────────────────────────

describe("R1 · reconciliation triggers", () => {
  it("normal chat registers visibilitychange + onSubscribed + arrival · no setInterval", () => {
    const src = read(NORMAL_CLIENT);
    expect(src).toMatch(/visibilitychange/);
    expect(src).toMatch(/onSubscribed/);
    expect(src).toMatch(/onPeerMessageArrival/);
    // Strip comments · a docstring saying "no setInterval" is fine.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toMatch(/setInterval\s*\(/);
  });

  it("Vault chat registers visibilitychange + onSubscribed + arrival · no setInterval", () => {
    const src = read(VAULT_CLIENT);
    expect(src).toMatch(/visibilitychange/);
    expect(src).toMatch(/onSubscribed/);
    expect(src).toMatch(/onPeerMessageArrival/);
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toMatch(/setInterval\s*\(/);
  });

  it("message-events channel helper exposes onSubscribed so reconnect reconciliation works", () => {
    const src = read(EVENTS_FILE);
    expect(src).toMatch(/onSubscribed\?\s*:\s*\(\s*\)\s*=>\s*void/);
    expect(src).toMatch(/onSubscribed:\s*opts\.onSubscribed/);
  });

  it("Vault chat dedupes new rows by id against the current messages ref so lock/unlock boot() cycles correctly reset the watermark", () => {
    const src = read(VAULT_CLIENT);
    // Watermark + dedup set are both computed from the live
    // messagesRef at fetch time · this is what makes lock/unlock
    // correct (boot resets messages to initialMessages → watermark
    // drops back → fetch-since picks up anything that landed while
    // locked).
    expect(src).toMatch(/messagesRef/);
    expect(src).toMatch(/for\s*\(\s*const\s+m\s+of\s+messagesRef\.current\s*\)/);
    expect(src).toMatch(/seenIds\.has/);
    // Final guard · setMessages functional update dedupes by id so
    // overlapping triggers never render the same row twice.
    expect(src).toMatch(/have\.has\(row\.id\)/);
  });
});
