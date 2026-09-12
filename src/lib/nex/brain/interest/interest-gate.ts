// src/lib/nex/brain/interest/interest-gate.ts
//
// NEX Entity → Interest → Owner Conversation Slice
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// PURPOSE (§7 · §8 · §11 · §12 · §15)
//   Compose interest-intent + entity resolution + contactability into
//   one deterministic gate decision. The gate produces a natural
//   conversational reply that:
//     · guides the user to open the draft when a verified contact
//       exists (positive path)
//     · honestly says no verified contact yet when it doesn't
//       (negative path — Wave 6 behaviour preserved)
//     · clarifies which entity when ambiguous
//     · respects G12 negation (never activates from a negated turn)
//     · defers to G03 for reply language

import type { Lang } from "../language-state";
import type { SessionState } from "../session";
import type { WorldRecord } from "../world-adapters/types";
import { classifyInterestIntent, type InterestIntentDetection } from "./interest-intent";
import { assessContactability, type ContactabilityAssessment } from "./contactability";
import { isViewedEntityFresh } from "../universal-discovery/viewed-entity";

// ─── Types ──────────────────────────────────────────────────────

export type InterestGateDecisionKind =
  | "NONE"                              // no interest signal · fall through
  | "INTEREST_NEGATED"                  // G12 · confirms no contact
  | "INTEREST_NO_ENTITY_CONTEXT"        // fresh session · no entity to talk to
  | "INTEREST_AMBIGUOUS_ENTITY"         // multiple candidates · ask which
  | "INTEREST_ACTIVATED_VERIFIED"       // send-flow eligible
  | "INTEREST_HONEST_NO_CONTACT";       // entity exists but no verified contact

export type InterestGateDecision =
  | { shouldGate: false; kind: "NONE"; reason: string; intent: InterestIntentDetection }
  | {
      shouldGate: true;
      kind: Exclude<InterestGateDecisionKind, "NONE">;
      reason: string;
      reply: string;
      language: Lang;
      intent: InterestIntentDetection;
      entity_ref_id?: string;
      entity_name?: string;
      contactability?: ContactabilityAssessment;
      /** When kind is INTEREST_ACTIVATED_VERIFIED, this is the deep-
       *  link URL the client can navigate to · opens the entity detail
       *  page with the interest flow pre-expanded. */
      open_url?: string;
    };

// ─── Public API ────────────────────────────────────────────────

/** Decide the interest gate outcome for this turn.
 *
 *  Inputs:
 *    · message         · raw user text (semantic classifier runs here)
 *    · session         · session state (viewedEntity + turnCount)
 *    · fetchRecord     · async callback to load a WorldRecord by ref_id
 *                        (dependency-injected to avoid a hard import of
 *                        world-adapters from this module — enables
 *                        testing + preserves layering)
 *    · activeLanguage  · G03 · authoritative reply language
 */
export async function decideInterestGate(input: {
  message: string;
  session: SessionState | null | undefined;
  activeLanguage: Lang;
  fetchRecord: (ref_id: string) => Promise<WorldRecord | null>;
}): Promise<InterestGateDecision> {
  const { message, session, activeLanguage, fetchRecord } = input;
  const intent = classifyInterestIntent(message);

  // 1 · no interest signal · never gate
  if (intent.kind === "NONE") {
    return { shouldGate: false, kind: "NONE", reason: "no_interest_signal", intent };
  }

  // 2 · G12 negation · gate with an honest acknowledgement · NEVER
  // activate the send flow
  if (intent.kind === "INTEREST_EXPLICITLY_NEGATED") {
    return {
      shouldGate: true,
      kind: "INTEREST_NEGATED",
      reason: "negation_ack",
      reply: activeLanguage === "ID"
        ? "Baik, tidak apa-apa. Kalau berubah pikiran, tinggal bilang saja."
        : "Understood. No message sent. If you change your mind, just say so.",
      language: activeLanguage,
      intent,
    };
  }

  // 3 · positive interest · resolve which entity the user means
  //
  // Priority: session.viewedEntity (fresh) → single entity in memo →
  // ambiguous. NEVER guesses. When ambiguous we ask.
  const currentTurn = session?.turnCount ?? 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewed = (session as any)?.viewedEntity as import("../universal-discovery/viewed-entity").ViewedEntitySnapshot | undefined;

  let entityRefId: string | undefined;
  let entityName: string | undefined;

  if (viewed && isViewedEntityFresh(viewed, currentTurn)) {
    entityRefId = viewed.ref_id;
    entityName = viewed.name;
  } else {
    const memo = session?.entityCardMemo;
    if (Array.isArray(memo) && memo.length === 1) {
      entityRefId = memo[0].ref_id;
      entityName = memo[0].name;
    } else if (Array.isArray(memo) && memo.length > 1) {
      // Ambiguous · ask which entity
      const nameList = memo.slice(0, 3).map((m) => m.name).join(" · ");
      return {
        shouldGate: true,
        kind: "INTEREST_AMBIGUOUS_ENTITY",
        reason: `ambiguous:${memo.length}_candidates`,
        reply: activeLanguage === "ID"
          ? `Boleh — yang mana? ${nameList}.`
          : `Sure — which one? ${nameList}.`,
        language: activeLanguage,
        intent,
      };
    }
  }

  if (!entityRefId || !entityName) {
    // Fresh session · no entity context · honest boundary
    return {
      shouldGate: true,
      kind: "INTEREST_NO_ENTITY_CONTEXT",
      reason: "no_entity_context",
      reply: activeLanguage === "ID"
        ? "Belum ada yang bisa saya hubungi untuk Anda. Ceritakan dulu apa yang Anda cari."
        : "There's no listing here yet for me to reach out about. Tell me what you're looking for first.",
      language: activeLanguage,
      intent,
    };
  }

  // 4 · fetch the record + assess contactability
  let record: WorldRecord | null = null;
  try {
    record = await fetchRecord(entityRefId);
  } catch {
    record = null;
  }
  if (!record) {
    return {
      shouldGate: true,
      kind: "INTEREST_HONEST_NO_CONTACT",
      reason: "record_unavailable",
      reply: activeLanguage === "ID"
        ? `Saya tidak menemukan ${entityName} lagi di direktori saat ini. Coba pencarian lain?`
        : `I couldn't find ${entityName} in the directory right now. Try another search?`,
      language: activeLanguage,
      intent,
      entity_ref_id: entityRefId,
      entity_name: entityName,
    };
  }

  const contactability = assessContactability(record);

  // 5 · immutable rule: no verified contact → NO SEND ELIGIBILITY
  if (!contactability.interest_send_enabled) {
    return {
      shouldGate: true,
      kind: "INTEREST_HONEST_NO_CONTACT",
      reason: `no_verified_contact:${contactability.state}`,
      reply: activeLanguage === "ID"
        ? `Belum ada saluran kontak terverifikasi untuk ${entityName}. Saya tidak bisa mengirim pesan tanpa itu, dan saya tidak mau mengarang nomornya.`
        : `No verified contact channel exists for ${entityName} yet. I can't send a message without one — and I won't invent a number.`,
      language: activeLanguage,
      intent,
      entity_ref_id: entityRefId,
      entity_name: entityName,
      contactability,
    };
  }

  // 6 · positive path · verified contact exists · guide the user to the
  // detail page's draft flow. Never auto-sends.
  const openUrl = `/nex-app/entity/${encodeURIComponent(entityRefId)}`;
  const reply = activeLanguage === "ID"
    ? `Bagus — saya bisa siapkan draf pesan ke pemilik ${entityName}. Buka halaman detail dan tinjau sebelum mengirim: ${openUrl}`
    : `Great — I can prepare a draft message to the owner of ${entityName}. Open the detail page to review it before you send: ${openUrl}`;

  return {
    shouldGate: true,
    kind: "INTEREST_ACTIVATED_VERIFIED",
    reason: `verified_contact:${contactability.state}`,
    reply,
    language: activeLanguage,
    intent,
    entity_ref_id: entityRefId,
    entity_name: entityName,
    contactability,
    open_url: openUrl,
  };
}
