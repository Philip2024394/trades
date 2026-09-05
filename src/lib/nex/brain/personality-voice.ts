// src/lib/nex/brain/personality-voice.ts
//
// Stage 3.40 · NEX Personality Voice Layer (Philip 2026-08-31).
//
// CONSTITUTIONAL DOCTRINE (Philip 2026-08-31):
//   NEX is never unnecessarily formal. NEX speaks like a relaxed,
//   intelligent friend hanging out with the user. It becomes serious
//   only when the situation itself requires seriousness.
//
// The voice layer sits AS POST-PROCESSING over the honest structured
// output produced by the constitutional composers (recommendation ·
// comparison · reasoning · action · authorization). The existing
// composers stay UNTOUCHED · the voice layer's job is to render their
// honest content in friend-language.
//
// LOAD-BEARING INVARIANT: the voice layer NEVER upgrades a state.
// If structured content says UNKNOWN / BLOCKED / FAILED / uncertain,
// the friend voice must still say that honestly ("I can't see the
// price, so I'm not gonna BS you"). G7 (from action-composer) still
// applies over every voice output · sweeps enforced by tests.
//
// Two modes · same brain:
//   HANGOUT — greeting · discovery · reasoning · comparison ·
//             recommendation · food · light chat.
//   TASK    — action proposal · authorization confirm/decline ·
//             action audit · BLOCKED · error report.
//   Mode auto-selected from `intent`. Manual override supported.

import { SUCCESS_LANGUAGE_BLACKLIST, findSuccessLanguageLeaks } from "./action-composer";

// ─── Public types ──────────────────────────────────────────────────

export type VoiceMode = "HANGOUT" | "TASK";

/** The high-level thing NEX is trying to say · not the specific text. */
export type VoiceIntent =
  | "greeting"
  | "acknowledge_slot"     // "got it · cheap · near Malioboro"
  | "acknowledge_reference" // Stage 3.41.d P1 · "Yep — Griya Sentana." after user says "the second one"
  | "entity_followup"      // Stage 3.41.d P2 · reasoning about the currently-picked entity
  | "discovery_hit"        // "found 3 hotels"
  | "discovery_empty"      // "no matches"
  | "recommendation_pick"  // "start with X · closest at 0.14km"
  | "recommendation_no_signal"
  | "comparison_result"
  | "reasoning_partial"    // partial evidence coverage
  | "reasoning_full"
  | "reasoning_zero"
  | "propose_action"
  | "auth_ambiguous"
  | "auth_declined"
  | "action_verified"
  | "action_unknown"
  | "action_failed"
  | "action_blocked"
  | "clarify_ambiguous"
  | "unsupported"
  | "honest_gap"           // "I can't see X, not gonna make it up"
  | "social_reply"         // Stage 3.42 · social acknowledgement continuation
  | "context_signal";      // Stage 3.42 · user gave a bare context/place · NEX asks what they're after

/**
 * Structured content the voice layer renders. Fields optional so a
 * single VoicePlea shape works for all intents.
 */
export type VoiceContent = {
  targetName?: string;
  count?: number;
  items?: readonly string[];
  pickName?: string;
  pickDetail?: string;            // e.g. "closest at 0.14km"
  primarySignal?: string;         // e.g. "area_proximity"
  missingFields?: readonly string[]; // fields NEX honestly can't see
  reason?: string;
  message?: string;               // the proposed message body for actions
  slotSummary?: string;           // "cheap · near Malioboro"
  // Stage 3.42 · Conversation Layer fields (Philip 2026-09-01)
  contextSignal?: string;         // e.g. "yogyakarta" · echoed back to the user for context_signal
  priorQuestion?: string;         // NEX's most recent question · used only for observability
  addressName?: string;           // user's preferred name/address · used in social_reply
};

export type VoicePlea = {
  intent: VoiceIntent;
  mode?: VoiceMode;               // omit for auto
  content: VoiceContent;
};

export type VoiceReply = {
  en: string;
  id: string;
  mode: VoiceMode;                // resolved · surfaced for observability
};

// ─── Deterministic mode selection ──────────────────────────────────

/**
 * TASK-mode intents · anything with real stakes (action, authorization,
 * BLOCKED). Everything else falls to HANGOUT by default.
 */
const TASK_INTENTS: ReadonlySet<VoiceIntent> = new Set<VoiceIntent>([
  "propose_action",
  "auth_ambiguous",
  "auth_declined",
  "action_verified",
  "action_unknown",
  "action_failed",
  "action_blocked",
]);

export function selectMode(intent: VoiceIntent, override?: VoiceMode): VoiceMode {
  if (override) return override;
  return TASK_INTENTS.has(intent) ? "TASK" : "HANGOUT";
}

// ─── Phrasing pack · HANGOUT · English ─────────────────────────────
//
// House style:
//   · Short sentences. Occasional emoji (never stacked).
//   · "Yep." / "Hmm." / "Nah." are welcome.
//   · The "can't see X so I won't BS you" line is the signature.
//   · No slang stacks. No CAPS excitement. No teenager-trying-to-be-cool.

function joinList(items: readonly string[], lang: "en" | "id"): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return lang === "id" ? `${items[0]} sama ${items[1]}` : `${items[0]} and ${items[1]}`;
  const head = items.slice(0, -1).join(", ");
  const tail = items[items.length - 1];
  return lang === "id" ? `${head}, sama ${tail}` : `${head}, and ${tail}`;
}

function honestGapEN(missing: readonly string[] | undefined): string {
  if (!missing || missing.length === 0) return "";
  const list = joinList(missing, "en");
  return ` I can't see ${list}, so I'm not gonna make that part up.`;
}
function honestGapID(missing: readonly string[] | undefined): string {
  if (!missing || missing.length === 0) return "";
  const list = joinList(missing, "id");
  return ` ${list} belum kelihatan, jadi bagian itu nggak akan saya karang.`;
}

function hangoutEN(intent: VoiceIntent, c: VoiceContent): string {
  switch (intent) {
    case "greeting":
      return "Hey — what are we doing?";
    case "acknowledge_slot":
      return c.slotSummary ? `Got it — ${c.slotSummary}.` : "Got it.";
    case "acknowledge_reference":
      // Stage 3.41.d P1 · after user says "the second one" and we
      // resolved the reference · never re-run discovery in the reply.
      return c.pickName ? `Yep — ${c.pickName}.` : "Yep — got it.";
    case "entity_followup":
      // Stage 3.41.d P2 · user is asking about the entity they just
      // picked · we describe it honestly from what we can see AND
      // flag what we can't.
      if (c.pickName && c.pickDetail) {
        return `${c.pickName}? ${c.pickDetail}.${honestGapEN(c.missingFields)}`;
      }
      if (c.pickName) {
        return `${c.pickName}? Not much more I can tell you from what's public.${honestGapEN(c.missingFields)}`;
      }
      return "Not much I can add from what's public.";
    case "discovery_hit":
      return c.count && c.count > 1
        ? `Yep — found ${c.count}.`
        : `Yep — found one.`;
    case "discovery_empty":
      return "Hmm — nothing's coming back for that. Want me to loosen the search a bit?";
    case "recommendation_pick":
      return c.pickName && c.pickDetail
        ? `I'd start with ${c.pickName} — ${c.pickDetail}.${honestGapEN(c.missingFields)}`
        : c.pickName
          ? `I'd start with ${c.pickName}.${honestGapEN(c.missingFields)}`
          : "I've got a couple of decent ones.";
    case "recommendation_no_signal":
      return "I've got matches, but nothing I can rank on — tell me what matters most and I'll try again.";
    case "comparison_result":
      return c.pickName && c.pickDetail
        ? `${c.pickName} looks like the strongest on ${c.pickDetail}.${honestGapEN(c.missingFields)} But that's not the same as saying it's the best overall.`
        : "Here's the comparison.";
    case "reasoning_partial":
      return c.pickName && c.pickDetail
        ? `Best I can say from what's public: ${c.pickName} — ${c.pickDetail}.${honestGapEN(c.missingFields)} So this is the best match on partial evidence, not a full ranking.`
        : "Only partial data available.";
    case "reasoning_full":
      return c.pickName
        ? `On the criteria you gave me, ${c.pickName} is the strongest match across the board.`
        : "Clean winner.";
    case "reasoning_zero":
      return "None of the fields you care about are actually published for these — I can't rank them without guessing.";
    case "clarify_ambiguous":
      return "Hmm — bit vague. Can you give me a bit more? Like a place, an activity, or what you're after?";
    case "unsupported":
      return "That's outside what I can do right now — but tell me what you're trying to get done and I'll find the closest thing.";
    case "honest_gap":
      return c.missingFields
        ? `${honestGapEN(c.missingFields).trim()}`
        : "I can't see that part, so I won't make it up.";
    case "social_reply":
      // Stage 3.42 · social acknowledgement continuation · deliberately
      // context-neutral · "Good to hear" would be wrong when user just
      // said they were tired / bored / stressed. This wording works for
      // "im good", "not bad", "im tired", "just want to chat" alike.
      return c.addressName
        ? `Got it, ${c.addressName}. What would you like to do?`
        : "Got it. What would you like to do?";
    case "context_signal":
      // Stage 3.42 · user gave a bare context/place · echo it back and
      // offer natural next steps instead of asking generically for
      // "a place, an activity, or what you're after".
      return c.contextSignal
        ? `${titleCase(c.contextSignal)} — nice. What are you looking for — food, places to stay, things to do, or just want to chat about it?`
        : "Got it. What are you thinking about — food, stays, things to do, or something else?";
    default:
      return "";
  }
}

function titleCase(s: string): string {
  return s.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function hangoutID(intent: VoiceIntent, c: VoiceContent): string {
  switch (intent) {
    case "greeting":
      return "Halo — mau ngapain nih?";
    case "acknowledge_slot":
      return c.slotSummary ? `Oke — ${c.slotSummary}.` : "Oke.";
    case "acknowledge_reference":
      return c.pickName ? `Sip — ${c.pickName}.` : "Sip — oke.";
    case "entity_followup":
      if (c.pickName && c.pickDetail) {
        return `${c.pickName}? ${c.pickDetail}.${honestGapID(c.missingFields)}`;
      }
      if (c.pickName) {
        return `${c.pickName}? Nggak banyak info tambahan yang bisa saya lihat dari yang publik.${honestGapID(c.missingFields)}`;
      }
      return "Nggak banyak yang bisa saya tambahkan.";
    case "discovery_hit":
      return c.count && c.count > 1 ? `Sip — ketemu ${c.count}.` : `Sip — ada satu.`;
    case "discovery_empty":
      return "Hmm — nggak ada yang cocok. Mau saya longgarin dikit filternya?";
    case "recommendation_pick":
      return c.pickName && c.pickDetail
        ? `Saya mulai dari ${c.pickName} — ${c.pickDetail}.${honestGapID(c.missingFields)}`
        : c.pickName
          ? `Saya mulai dari ${c.pickName}.${honestGapID(c.missingFields)}`
          : "Ada beberapa yang lumayan.";
    case "recommendation_no_signal":
      return "Ada matches, tapi belum ada data buat ranking — kasih tahu apa yang paling penting, saya coba lagi.";
    case "comparison_result":
      return c.pickName && c.pickDetail
        ? `${c.pickName} paling kuat di ${c.pickDetail}.${honestGapID(c.missingFields)} Tapi bukan berarti dia terbaik secara keseluruhan.`
        : "Ini perbandingannya.";
    case "reasoning_partial":
      return c.pickName && c.pickDetail
        ? `Dari data yang ada: ${c.pickName} — ${c.pickDetail}.${honestGapID(c.missingFields)} Jadi ini match terbaik dari evidence yang ada, bukan ranking lengkap.`
        : "Data cuma sebagian.";
    case "reasoning_full":
      return c.pickName
        ? `Buat kriteria yang kamu kasih, ${c.pickName} paling cocok di semuanya.`
        : "Pemenang jelas.";
    case "reasoning_zero":
      return "Field yang kamu peduli sama sekali nggak dipublikasikan buat yang ini — nggak bisa ranking tanpa nebak.";
    case "clarify_ambiguous":
      return "Hmm — masih ambigu nih. Boleh kasih detail dikit? Misal tempat, aktivitas, atau lagi cari apa?";
    case "unsupported":
      return "Itu di luar yang saya bisa sekarang — tapi ceritakan tujuannya, saya cariin yang paling mendekati.";
    case "honest_gap":
      return c.missingFields
        ? `${honestGapID(c.missingFields).trim()}`
        : "Bagian itu belum kelihatan, jadi nggak akan saya karang.";
    case "social_reply":
      // Context-neutral · Indonesian variant. Avoids "syukurlah" which
      // (like "good to hear" in EN) reads wrong when user is tired /
      // stressed. Works for oke/sip/iya/im-good/im-tired/lagi-bosen alike.
      return c.addressName
        ? `Oke, ${c.addressName}. Mau ngapain?`
        : "Oke. Mau ngapain?";
    case "context_signal":
      return c.contextSignal
        ? `${titleCase(c.contextSignal)} — asik. Mau cari apa — makan, penginapan, tempat jalan, atau ngobrol aja?`
        : "Oke. Mau ngapain — makan, nginap, jalan-jalan, atau yang lain?";
    default:
      return "";
  }
}

// ─── Phrasing pack · TASK · English ────────────────────────────────
//
// House style:
//   · Focused. Precise. Still human — not corporate.
//   · Zero success language when the audit says otherwise.
//   · Buttons/actions phrased directly · "Want me to fire it off?"

function taskEN(intent: VoiceIntent, c: VoiceContent): string {
  switch (intent) {
    case "propose_action": {
      const msg = c.message ? `\n\n"${c.message}"` : "";
      const target = c.targetName ?? "the target";
      return `I've got a message ready for ${target}:${msg}\n\nWant me to fire it off?`;
    }
    case "auth_ambiguous":
      return c.targetName
        ? `Couldn't tell if that was a yes or no. Send to ${c.targetName}? Just say "yes" or "no".`
        : `Couldn't tell if that was a yes or no. Say "yes" to send or "no" to cancel.`;
    case "auth_declined":
      return c.targetName
        ? `Cool — leaving ${c.targetName} alone.`
        : `Cool — not sending.`;
    case "action_verified":
      return c.targetName
        ? `The WhatsApp to ${c.targetName} was delivered — confirmed.`
        : `Message was delivered — confirmed.`;
    case "action_unknown":
      return c.targetName
        ? `I fired off the WhatsApp to ${c.targetName}, but no delivery confirmation yet. Not gonna claim it landed — check on your side if you can.`
        : `Fired it off, but no delivery confirmation yet. Not gonna claim it landed.`;
    case "action_failed":
      return c.reason
        ? `Send didn't go through: ${c.reason}.`
        : `Send didn't go through.`;
    case "action_blocked":
      return c.reason
        ? `Can't do that yet: ${c.reason}.`
        : `Can't do that yet.`;
    default:
      return "";
  }
}

function taskID(intent: VoiceIntent, c: VoiceContent): string {
  switch (intent) {
    case "propose_action": {
      const msg = c.message ? `\n\n"${c.message}"` : "";
      const target = c.targetName ?? "target";
      return `Pesan siap buat ${target}:${msg}\n\nKirim?`;
    }
    case "auth_ambiguous":
      return c.targetName
        ? `Belum jelas itu iya atau bukan. Kirim ke ${c.targetName}? Balas "iya" atau "jangan".`
        : `Belum jelas iya atau bukan. Balas "iya" buat kirim atau "jangan" buat batal.`;
    case "auth_declined":
      return c.targetName
        ? `Oke — nggak jadi kirim ke ${c.targetName}.`
        : `Oke — nggak jadi kirim.`;
    case "action_verified":
      return c.targetName
        ? `WhatsApp ke ${c.targetName} sudah nyampai — sudah terverifikasi.`
        : `Pesan sudah nyampai — sudah terverifikasi.`;
    case "action_unknown":
      return c.targetName
        ? `Saya kirim ke ${c.targetName}, tapi belum ada konfirmasi pengiriman. Nggak akan saya klaim sudah sampai — coba cek dari sisi kamu.`
        : `Sudah dikirim, tapi belum ada konfirmasi. Nggak akan saya klaim sudah sampai.`;
    case "action_failed":
      return c.reason
        ? `Kirim gagal: ${c.reason}.`
        : `Kirim gagal.`;
    case "action_blocked":
      return c.reason
        ? `Belum bisa: ${c.reason}.`
        : `Belum bisa.`;
    default:
      return "";
  }
}

// ─── Public renderer ───────────────────────────────────────────────

export function renderVoice(plea: VoicePlea): VoiceReply {
  const mode = selectMode(plea.intent, plea.mode);
  const en = mode === "TASK" ? taskEN(plea.intent, plea.content) : hangoutEN(plea.intent, plea.content);
  const id = mode === "TASK" ? taskID(plea.intent, plea.content) : hangoutID(plea.intent, plea.content);
  // Load-bearing safety net: even though every phrasing above is
  // hand-authored to avoid success words on non-VERIFIED intents, we
  // still sweep the output. If a future edit smuggles a leak in, the
  // renderer throws · never silently emits false success.
  if (plea.intent !== "action_verified") {
    const enLeaks = findSuccessLanguageLeaks(en);
    const idLeaks = findSuccessLanguageLeaks(id);
    if (enLeaks.length + idLeaks.length > 0) {
      throw new Error(
        `personality-voice · G7 leak · intent=${plea.intent} mode=${mode} · EN[${enLeaks.join(",")}] ID[${idLeaks.join(",")}]`,
      );
    }
  }
  return { en, id, mode };
}

// ─── Anti-slang guard · linter-friendly regex list ─────────────────

/** Slang patterns NEX must NEVER produce. Cool-friend, not desperate-teenager. */
export const OVER_SLANG_BLACKLIST: readonly RegExp[] = [
  /\bBRO+\b/,                              // BROOO
  /\bLET'?S\s+GO+\b/i,                     // LETS GOOO
  /\bYAS+\b/i,                             // YAAAS
  /\bLIT\b/i,                              // "lit"
  /\bfr\s+fr\b/i,                          // "fr fr"
  /🔥{3,}/,                                // 🔥🔥🔥+
  /😂{3,}/,                                // 😂😂😂+
  /😄{3,}/,                                // 😄😄😄+
  /🚀{3,}/,                                // 🚀🚀🚀+
  /[!]{3,}/,                               // !!!+
  /[?]{4,}/,                               // ????+
];

export function findOverSlang(text: string): string[] {
  const hits: string[] = [];
  for (const rx of OVER_SLANG_BLACKLIST) {
    const m = text.match(rx);
    if (m) hits.push(m[0]);
  }
  return hits;
}

// Re-export the composer honesty blacklist so external callers can
// sweep any hand-written voice patterns before wiring.
export { SUCCESS_LANGUAGE_BLACKLIST };
