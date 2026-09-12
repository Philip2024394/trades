// src/lib/nex/brain/reasoning/reasoning-reply.ts
//
// NEX Wave 7 · Conversational Entity Reasoning
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// PURPOSE (§3 · §5 · §9 · §17 · §18)
//   Turn a ReasoningPayload into a natural EN or ID reply that
//   preserves the FACT / EVIDENCE / INFERENCE / RECOMMENDATION /
//   UNKNOWN distinction. Deterministic · no LLM · shipped claims only.
//
// STRICT (§16 · §17)
//   NEVER emits a claim that isn't in payload.claims (which the
//   verifier already filtered to SUPPORTED / PARTIAL). NEVER invents
//   numbers, prices, contact channels, availability. The renderer's
//   only sources of information are:
//     · payload.entities_in_scope (names + attribute states)
//     · payload.claims            (verified · shippable)
//     · payload.missing_evidence  (what would matter but is unknown)
//     · payload.recommendation    (if the composer produced one)

import type { ReasoningPayload } from "./entity-reasoning";
import type { VerifiedClaim } from "./claim";

// ─── Public API ────────────────────────────────────────────────

export type ReasoningReplyResult = {
  reply: string;
  shouldReply: boolean;
  reason: string;
};

/** Render a natural reply from a ReasoningPayload. Returns
 *  `shouldReply: false` when the payload has no active result set
 *  (so the caller can fall through to fresh-session guards). */
export function renderReasoningReply(payload: ReasoningPayload): ReasoningReplyResult {
  const { intent, language, has_active_result_set } = payload;

  // Fresh-session · nothing to reason over · defer to P0.4 guards
  if (!has_active_result_set) {
    return {
      reply: language === "ID"
        ? "Belum ada hasil yang bisa saya bandingkan di percakapan ini. Ingin saya cari dulu?"
        : "I don't have any results to reason over in this conversation yet. Want me to search first?",
      shouldReply: true,
      reason: "no_active_result_set",
    };
  }

  switch (intent) {
    case "ENTITY_EVIDENCE_REQUEST":
      return renderEvidenceRequest(payload);
    case "ENTITY_UNKNOWN_REQUEST":
      return renderUnknownRequest(payload);
    case "ENTITY_REASON_REQUEST":
      return renderReasonRequest(payload);
    case "ENTITY_PROS_CONS":
      return renderProsCons(payload);
    case "ENTITY_COMPARISON":
      return renderComparison(payload);
    case "ENTITY_BEST_FOR":
    case "ENTITY_RECOMMENDATION_REQUEST":
      return renderRecommendation(payload);
    case "ENTITY_RANKING":
      return renderRanking(payload);
    case "ENTITY_SUITABILITY":
      return renderSuitability(payload);
    case "ENTITY_OPINION_REQUEST":
      return renderOpinion(payload);
    default:
      return { reply: "", shouldReply: false, reason: `unknown_intent:${intent}` };
  }
}

// ─── Renderers ─────────────────────────────────────────────────

function renderEvidenceRequest(p: ReasoningPayload): ReasoningReplyResult {
  const shipped = p.claims.filter((c) => c.state === "SUPPORTED" || c.state === "PARTIAL");
  if (shipped.length === 0) {
    return {
      reply: p.language === "ID"
        ? "Terus terang, saya belum punya bukti yang cukup untuk membuat pernyataan itu. Saya lebih baik jujur bilang begitu daripada mengarang."
        : "Honestly, I don't have enough verified evidence to back that up. I'd rather say so than make something up.",
      shouldReply: true,
      reason: "no_evidence_to_cite",
    };
  }
  const cited = shipped.slice(0, 3).map(renderClaimText).join(" · ");
  return {
    reply: p.language === "ID"
      ? `Yang saya lihat sejauh ini: ${cited}. Kalau ada yang lain yang penting untuk Anda, tanyakan saja.`
      : `Here's what I can actually see: ${cited}. If there's something else that matters to you, let me know.`,
    shouldReply: true,
    reason: "evidence_cited",
  };
}

function renderUnknownRequest(p: ReasoningPayload): ReasoningReplyResult {
  if (p.missing_evidence.length === 0) {
    return {
      reply: p.language === "ID"
        ? "Untuk apa yang Anda tanyakan sejauh ini, evidensi yang saya butuhkan tampaknya sudah ada."
        : "For what you've asked so far, I appear to have the evidence I need.",
      shouldReply: true,
      reason: "no_missing_evidence",
    };
  }
  const missingList = p.missing_evidence.slice(0, 5).map((m) => prettyAttr(m.key)).join(", ");
  return {
    reply: p.language === "ID"
      ? `Yang belum saya ketahui secara terverifikasi: ${missingList}. Kalau salah satu penting untuk keputusan Anda, saya harus jujur bilang saya belum tahu.`
      : `What I don't have verified yet: ${missingList}. If any of those matter for your decision, I'd rather flag it than guess.`,
    shouldReply: true,
    reason: "listed_missing",
  };
}

function renderReasonRequest(p: ReasoningPayload): ReasoningReplyResult {
  const supported = p.claims.filter((c) => c.state === "SUPPORTED");
  if (supported.length === 0) {
    return {
      reply: p.language === "ID"
        ? "Saya sebenarnya belum punya dasar yang kuat untuk membuat rekomendasi. Kalau saya bilang begitu tadi, itu keliru — saya cabut."
        : "I don't actually have strong evidence to back a specific pick. If I sounded certain earlier, I was overreaching — I'll walk that back.",
      shouldReply: true,
      reason: "no_supported_reason",
    };
  }
  const top = supported.slice(0, 3).map(renderClaimText).join(" · ");
  const gapHedge = p.missing_evidence.length > 0
    ? ` I don't have verified ${p.missing_evidence.slice(0, 2).map((m) => prettyAttr(m.key)).join(" or ")} so that's not part of the reasoning.`
    : "";
  const gapHedgeID = p.missing_evidence.length > 0
    ? ` Saya belum punya data ${p.missing_evidence.slice(0, 2).map((m) => prettyAttr(m.key)).join(" atau ")}, jadi itu tidak jadi bahan pertimbangan.`
    : "";
  return {
    reply: p.language === "ID"
      ? `Karena ${top}.${gapHedgeID}`
      : `Because ${top}.${gapHedge}`,
    shouldReply: true,
    reason: "reason_from_supported",
  };
}

function renderProsCons(p: ReasoningPayload): ReasoningReplyResult {
  const entityName = p.entities_in_scope[0]?.name ?? "this one";
  const pros = p.claims.filter((c) => c.state === "SUPPORTED").slice(0, 4);
  const partial = p.claims.filter((c) => c.state === "PARTIAL").slice(0, 4);
  const gaps = p.missing_evidence.slice(0, 4);
  const parts: string[] = [];
  if (pros.length > 0) {
    parts.push(
      p.language === "ID"
        ? `Kelebihan (terverifikasi): ${pros.map(renderClaimText).join(" · ")}`
        : `Verified strengths: ${pros.map(renderClaimText).join(" · ")}`,
    );
  }
  if (partial.length > 0) {
    parts.push(
      p.language === "ID"
        ? `Belum sepenuhnya terverifikasi: ${partial.map(renderClaimText).join(" · ")}`
        : `Listed but not owner-verified: ${partial.map(renderClaimText).join(" · ")}`,
    );
  }
  if (gaps.length > 0) {
    parts.push(
      p.language === "ID"
        ? `Yang belum diketahui: ${gaps.map((g) => prettyAttr(g.key)).join(", ")}`
        : `Not established: ${gaps.map((g) => prettyAttr(g.key)).join(", ")}`,
    );
  }
  if (parts.length === 0) {
    return {
      reply: p.language === "ID"
        ? `Saya belum punya cukup evidensi terverifikasi tentang ${entityName} untuk kelebihan/kekurangan yang jujur.`
        : `I don't have enough verified evidence about ${entityName} to give an honest pros/cons yet.`,
      shouldReply: true,
      reason: "no_pros_cons_evidence",
    };
  }
  return {
    reply: parts.join("\n"),
    shouldReply: true,
    reason: "pros_cons_rendered",
  };
}

function renderComparison(p: ReasoningPayload): ReasoningReplyResult {
  const [a, b] = p.entities_in_scope;
  if (!a || !b) {
    return {
      reply: p.language === "ID"
        ? "Untuk membandingkan, saya butuh dua entitas dalam daftar hasil aktif."
        : "I need two entities in the active result set to compare.",
      shouldReply: true,
      reason: "need_two",
    };
  }
  const supported = p.claims.filter((c) => c.state === "SUPPORTED");
  const parts: string[] = [];
  const aClaims = supported.filter((c) => c.subject_ref_id === a.ref_id).slice(0, 4);
  const bClaims = supported.filter((c) => c.subject_ref_id === b.ref_id).slice(0, 4);
  if (aClaims.length > 0) parts.push(`${a.name}: ${aClaims.map((c) => prettyAttr(c.evidence_keys[0])).join(" · ")}`);
  if (bClaims.length > 0) parts.push(`${b.name}: ${bClaims.map((c) => prettyAttr(c.evidence_keys[0])).join(" · ")}`);
  const gaps = p.missing_evidence.slice(0, 3);
  if (gaps.length > 0) {
    parts.push(
      p.language === "ID"
        ? `Belum bisa saya bandingkan (data belum terverifikasi): ${gaps.map((g) => prettyAttr(g.key)).join(", ")}`
        : `Can't compare honestly (missing evidence): ${gaps.map((g) => prettyAttr(g.key)).join(", ")}`,
    );
  }
  if (parts.length === 0) {
    return {
      reply: p.language === "ID"
        ? `Untuk perbandingan yang jujur antara ${a.name} dan ${b.name}, saya belum punya cukup evidensi terverifikasi.`
        : `I don't have enough verified evidence to compare ${a.name} and ${b.name} honestly.`,
      shouldReply: true,
      reason: "no_comparable_evidence",
    };
  }
  return { reply: parts.join("\n"), shouldReply: true, reason: "comparison_rendered" };
}

function renderRecommendation(p: ReasoningPayload): ReasoningReplyResult {
  if (!p.recommendation) {
    return {
      reply: p.language === "ID"
        ? "Saya belum punya dasar terverifikasi yang cukup untuk merekomendasikan satu di atas yang lain. Mau saya sebutkan apa yang saya perlu tahu?"
        : "I don't have enough verified evidence to honestly recommend one over the others. Want me to name what I'd need to know?",
      shouldReply: true,
      reason: "no_recommendation_evidence",
    };
  }
  const { winner_name, based_on, honest_gaps } = p.recommendation;
  const basedList = based_on.slice(0, 3).map(prettyAttr).join(", ");
  const gapList = honest_gaps.slice(0, 2).map(prettyAttr).join(" and ");
  const leanEN = `I'd lean toward ${winner_name}` + (basedList ? ` — mainly based on ${basedList}.` : ".");
  const leanID = `Saya cenderung memilih ${winner_name}` + (basedList ? ` — terutama berdasarkan ${basedList}.` : ".");
  const gapEN = honest_gaps.length > 0
    ? ` I don't have verified ${gapList} so those aren't part of the pick.`
    : "";
  const gapID = honest_gaps.length > 0
    ? ` Saya belum punya data ${gapList}, jadi itu tidak jadi pertimbangan.`
    : "";
  return {
    reply: p.language === "ID" ? leanID + gapID : leanEN + gapEN,
    shouldReply: true,
    reason: "recommendation_from_supported",
  };
}

function renderRanking(p: ReasoningPayload): ReasoningReplyResult {
  const supported = p.claims.filter((c) => c.state === "SUPPORTED");
  if (supported.length === 0) {
    return {
      reply: p.language === "ID"
        ? "Untuk membuat peringkat yang jujur, saya butuh data terverifikasi. Saat ini datanya belum ada — saya lebih baik jujur bilang begitu daripada mengarang."
        : "For an honest ranking I need verified data for that attribute. I don't have it — I'd rather say so than make one up.",
      shouldReply: true,
      reason: "no_rankable_data",
    };
  }
  // Group supported claims by attribute · report which entities have data
  const byAttr = new Map<string, string[]>();
  for (const claim of supported) {
    for (const key of claim.evidence_keys) {
      const name = p.entities_in_scope.find((e) => e.ref_id === claim.subject_ref_id)?.name;
      if (!name) continue;
      const list = byAttr.get(key) ?? [];
      if (!list.includes(name)) list.push(name);
      byAttr.set(key, list);
    }
  }
  const lines: string[] = [];
  for (const [attr, names] of byAttr) {
    if (names.length > 0) {
      lines.push(
        p.language === "ID"
          ? `Data ${prettyAttr(attr)} tersedia untuk: ${names.join(", ")}`
          : `${prettyAttr(attr)} data available for: ${names.join(", ")}`,
      );
    }
  }
  return { reply: lines.join("\n"), shouldReply: true, reason: "ranking_from_supported" };
}

function renderSuitability(p: ReasoningPayload): ReasoningReplyResult {
  // Same shape as recommendation but framed as suitability
  return renderRecommendation(p);
}

function renderOpinion(p: ReasoningPayload): ReasoningReplyResult {
  const first = p.entities_in_scope[0];
  if (!first) {
    return { reply: "", shouldReply: false, reason: "no_entity" };
  }
  const supported = p.claims.filter((c) => c.state === "SUPPORTED" && c.subject_ref_id === first.ref_id);
  if (supported.length === 0) {
    return {
      reply: p.language === "ID"
        ? `Terus terang saya belum punya cukup evidensi terverifikasi tentang ${first.name} untuk beropini secara jujur.`
        : `Honestly I don't have enough verified evidence about ${first.name} to have a defensible opinion yet.`,
      shouldReply: true,
      reason: "no_opinion_evidence",
    };
  }
  const strengths = supported.slice(0, 3).map(renderClaimText).join(" · ");
  return {
    reply: p.language === "ID"
      ? `Dari yang terverifikasi tentang ${first.name}: ${strengths}. Untuk penilaian lebih dalam saya butuh data yang belum ada.`
      : `From what's verified about ${first.name}: ${strengths}. For anything beyond that I'd need data I don't have.`,
    shouldReply: true,
    reason: "opinion_from_supported",
  };
}

// ─── Helpers ──────────────────────────────────────────────────

function renderClaimText(claim: VerifiedClaim): string {
  return claim.text;
}

function prettyAttr(attr: string): string {
  return attr.replace(/_/g, " ");
}
