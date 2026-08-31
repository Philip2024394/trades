// src/lib/nex/brain/action-composer.ts
//
// Stage 3.36 · Action + Verification v2 · reply composer (Philip 2026-08-31).
//
// CONSTITUTIONAL: no reply text can claim an action succeeded when the
// finalState != VERIFIED. This module owns the phrasing table so the
// linter test can prove — with a regex — that success language never
// escapes when the audit says otherwise.
//
// The table is intentionally small · every ChainActionKind × finalState
// combination has one phrasing per language. If an entry is missing,
// composeActionReply throws · never falls back to ad-hoc text.

import type { ActionAudit, ChainActionKind, ChainStage } from "./action-audit";

export type ComposerLang = "en" | "id";

type PhrasingKey = `${ChainActionKind}:${"VERIFIED" | "UNKNOWN" | "FAILED" | "BLOCKED"}`;

type Phrasing = { en: (a: ActionAudit) => string; id: (a: ActionAudit) => string };

const TABLE: Readonly<Record<PhrasingKey, Phrasing>> = {
  "open_directory:VERIFIED": {
    en: (a) => `I've opened the directory page for ${a.target.canonical} — link verified.`,
    id: (a) => `Sudah saya buka halaman direktori untuk ${a.target.canonical} — tautan terverifikasi.`,
  },
  "open_directory:UNKNOWN": {
    en: (a) => `I generated a directory link for ${a.target.canonical}, but the round-trip check didn't verify the encoded target. I won't claim it opened correctly.`,
    id: (a) => `Saya membuat tautan direktori untuk ${a.target.canonical}, tapi pemeriksaan round-trip tidak memverifikasi target ter-encode. Saya tidak akan mengklaim tautan itu benar.`,
  },
  "open_directory:FAILED": {
    en: (a) => `I couldn't open the directory for ${a.target.canonical || "the requested target"}: ${a.verification.reason ?? "no reason recorded"}.`,
    id: (a) => `Saya tidak bisa membuka direktori untuk ${a.target.canonical || "target yang diminta"}: ${a.verification.reason ?? "tidak ada alasan tercatat"}.`,
  },
  "open_directory:BLOCKED": {
    en: (a) => `I can't open that directory yet: ${a.blockedReason ?? "authorization or data missing"}.`,
    id: (a) => `Belum bisa buka direktori itu: ${a.blockedReason ?? "otorisasi atau data belum ada"}.`,
  },
  "contact_via_whatsapp:VERIFIED": {
    en: (a) => `The WhatsApp message to ${a.target.canonical} was delivered — confirmed at ${a.verification.at ?? "unknown time"}.`,
    id: (a) => `Pesan WhatsApp ke ${a.target.canonical} sudah terkirim — dikonfirmasi ${a.verification.at ?? "waktu tidak diketahui"}.`,
  },
  "contact_via_whatsapp:UNKNOWN": {
    // The load-bearing sentence. This must NEVER say "sent" or "delivered".
    en: (a) => `I attempted the WhatsApp to ${a.target.canonical}, but I don't have delivery confirmation. I won't claim it landed — please check on your side.`,
    id: (a) => `Saya sudah mencoba WhatsApp ke ${a.target.canonical}, tapi belum ada konfirmasi pengiriman. Saya tidak akan mengklaim sudah sampai — mohon dicek dari sisi kamu.`,
  },
  "contact_via_whatsapp:FAILED": {
    en: (a) => `The WhatsApp attempt to ${a.target.canonical || "the requested target"} failed: ${a.verification.reason ?? "no reason recorded"}.`,
    id: (a) => `Percobaan WhatsApp ke ${a.target.canonical || "target"} gagal: ${a.verification.reason ?? "tidak ada alasan tercatat"}.`,
  },
  "contact_via_whatsapp:BLOCKED": {
    en: (a) => `I can't send that WhatsApp yet: ${a.blockedReason ?? "authorization or data missing"}.`,
    id: (a) => `Belum bisa kirim WhatsApp itu: ${a.blockedReason ?? "otorisasi atau data belum ada"}.`,
  },
};

/**
 * Words that must never appear in the reply when finalState is not
 * VERIFIED. The linter test scans generated text against this list to
 * enforce the honesty rule at the string level.
 *
 * "attempted" / "tried" / "generated" are all allowed · they honestly
 * describe the effort without claiming outcome.
 */
export const SUCCESS_LANGUAGE_BLACKLIST: readonly RegExp[] = [
  /\bsent\b/i,
  /\bdelivered\b/i,
  /\bsuccessfully\b/i,
  /\bconfirmed\b/i,       // "confirmed" is only allowed when it says WHEN it was confirmed → VERIFIED path
  /\bterkirim\b/i,
  /\bdikirim\b/i,         // ID passive "was sent"
  /\bdikonfirmasi\b/i,
  /\bberhasil\b/i,        // "successful" in ID
];

export function composeActionReply(audit: ActionAudit, lang: ComposerLang): string {
  const state = audit.finalState;
  if (!state) {
    // Non-terminal · never happens through the executor path but guard.
    throw new Error(`composeActionReply called on non-terminal audit (stage=${audit.stage})`);
  }
  const compKey = state as "VERIFIED" | "UNKNOWN" | "FAILED" | "BLOCKED";
  const key = `${audit.intent.kind}:${compKey}` as PhrasingKey;
  const entry = TABLE[key];
  if (!entry) {
    throw new Error(`composeActionReply · no phrasing for key "${key}"`);
  }
  return entry[lang](audit);
}

/**
 * Static-analysis helper · returns the list of blacklist words the
 * given text triggers. Empty array = clean. Used by the linter test
 * to sweep every non-VERIFIED phrasing in the table.
 */
export function findSuccessLanguageLeaks(text: string): string[] {
  const leaks: string[] = [];
  for (const rx of SUCCESS_LANGUAGE_BLACKLIST) {
    const m = text.match(rx);
    if (m) leaks.push(m[0]);
  }
  return leaks;
}
