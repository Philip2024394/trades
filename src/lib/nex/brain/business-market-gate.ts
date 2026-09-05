// src/lib/nex/brain/business-market-gate.ts
//
// NEX Business International Market Intelligence v1 · conversation gate
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE · §3 §10 §14 §15 §16 §17 §26 §30
//
// PURPOSE
//   The conversational bridge between an authenticated business_id +
//   the composed intents (commercial-intent + send-action + draft-action)
//   and the existing NEX conversation architecture. Reuses:
//     · presentation.ts / entity-result-cards.ts for result cards (§15)
//     · session.ts / entities for conversational continuity (§17)
//     · evidence-scope for NO_EVIDENCE handling (Wave 4)
//     · user-fact-memory for business-context facts (existing G23)
//     · honest-boundary-reply for zero-evidence honest reply
//
// SEND BOUNDARY (§10 §30)
//   Any send/contact/message request is DETERMINISTICALLY refused with
//   a clear explanation. Drafting is allowed.

import type { Lang } from "./language-state";
import type { SessionState } from "./session";
import type { BusinessContext } from "./business-context";
import { loadBusinessContext } from "./business-context";
import {
  classifyCommercialIntent,
  detectSendAction,
  detectDraftAction,
  type CommercialObjective,
  type CommercialIntentDetection,
  type SendActionDetection,
  type DraftActionDetection,
} from "./commercial-intent";
import { retrieveCompanies, type DiscoveredCompany } from "./company-intelligence";

// ─── Types ─────────────────────────────────────────────────────

export type BusinessMarketGateDecision =
  | { shouldGate: false; reason: string; observability: BusinessMarketObservability }
  | {
      shouldGate: true;
      reason: string;
      reply: string;
      language: Lang;
      observability: BusinessMarketObservability;
      /** Card-set payload for the client · null when we didn't emit any. */
      cards: BusinessResultCardSet | null;
    };

export type BusinessMarketObservability = {
  business_context_present: boolean;
  business_id: string | null;
  business_name: string | null;
  commercial_objective: CommercialObjective;
  target_market: string | null;
  target_product_hint: string | null;
  send_action_blocked: boolean;
  send_action_kind: SendActionDetection["action"];
  draft_action_offered: boolean;
  draft_action_kind: DraftActionDetection["action"];
  companies_retrieved: number;
  companies_source_classes: string[];
};

export type BusinessResultCard = {
  company_id: string;
  position: number;
  name: string;
  country: string;
  region?: string | null;
  short_description?: string | null;
  public_website?: string | null;
  public_contact_summary: string;
  relevance_summary: string;
  provenance_summary: string;
  evidence_state_summary: {
    known_yes_count: number;
    unknown_count: number;
    unverified_count: number;
    stale_count: number;
  };
};

export type BusinessResultCardSet = {
  vertical: "business_market";
  cards: BusinessResultCard[];
  total_available: number;
  headline: string;
  caveat?: string;
};

// ─── Reply builders (EN + ID) ─────────────────────────────────

function replyNoBusinessContext(lang: Lang): string {
  if (lang === "ID") return "Untuk mencari peluang komersial internasional, saya perlu tahu bisnis mana yang saya wakili. Silakan lampirkan `business_id` pada percakapan atau daftarkan bisnis Anda terlebih dahulu.";
  return "To search for international commercial opportunities, I need to know which business I'm representing. Please attach a `business_id` to the conversation or register your business first.";
}

function replyNoCompaniesFound(input: {
  business_name: string;
  objective: CommercialObjective;
  market: string | null;
  product: string | null;
  lang: Lang;
}): string {
  const { business_name, objective, market, product, lang } = input;
  const marketLabel = market ?? "that market";
  const objectiveLabel = objective
    .replace(/^FIND_/, "")
    .replace(/_/g, " ")
    .toLowerCase();
  const productPart = product ? ` ${product}` : "";
  if (lang === "ID") {
    const marketId = market ?? "pasar tersebut";
    return `Saya belum memiliki${productPart ? " informasi terverifikasi tentang" + productPart : ""} ${objectiveLabel} di ${marketId} untuk ${business_name}. Saya lebih baik jujur sekarang daripada mengarang. Kalau Anda punya nama perusahaan atau direktori publik, saya bisa telusuri dari sana.`;
  }
  return `I don't have verified evidence about${productPart} ${objectiveLabel} in ${marketLabel} for ${business_name} yet. I'd rather say so than invent. If you have a specific company name or a public directory, I can search from there.`;
}

function replySendBlocked(action: SendActionDetection["action"], lang: Lang): string {
  const actionLabel = action === "send_email" ? "email"
    : action === "send_whatsapp" ? "WhatsApp"
    : action === "send_message" ? "message"
    : action === "call" ? "call"
    : action === "post" ? "post"
    : "communication";
  if (lang === "ID") {
    return `Saya belum diizinkan untuk mengirim ${actionLabel} secara mandiri di versi ini. Saya bisa menyiapkan draf agar Anda tinjau dan kirim sendiri.`;
  }
  return `I'm not authorised to send that ${actionLabel} autonomously in this version. I can prepare a draft for you to review and send yourself.`;
}

function replyDraftIntroduction(input: {
  business_name: string;
  business_industry: string | null;
  target_company: DiscoveredCompany | null;
  objective: CommercialObjective;
  market: string | null;
  lang: Lang;
}): string {
  const { business_name, business_industry, target_company, objective, market, lang } = input;
  const marketLabel = market ?? "the market";
  const industryPart = business_industry ? ` (${business_industry})` : "";
  if (!target_company) {
    if (lang === "ID") return `Belum ada perusahaan spesifik yang saya identifikasi di ${marketLabel}. Setelah kita punya perusahaan yang terverifikasi, saya bisa buatkan draf pengantar dari ${business_name}${industryPart}.`;
    return `I haven't identified a specific company in ${marketLabel} yet. Once we have a verified company, I can draft an introduction from ${business_name}${industryPart}.`;
  }
  const objectiveLabel = objective.replace(/^FIND_/, "").replace(/_/g, " ").toLowerCase();
  if (lang === "ID") {
    return [
      `Draf pengantar (silakan tinjau sebelum dikirim):`,
      ``,
      `Kepada ${target_company.name},`,
      ``,
      `Kami dari ${business_name}${industryPart}. Kami sedang mencari ${objectiveLabel} untuk produk kami di ${marketLabel} dan ingin berkenalan untuk mengeksplor peluang bisnis.`,
      ``,
      `Salam hormat,`,
      `${business_name}`,
    ].join("\n");
  }
  return [
    `Draft introduction (please review before sending):`,
    ``,
    `Dear ${target_company.name},`,
    ``,
    `I am writing from ${business_name}${industryPart}. We are exploring ${objectiveLabel} for our products in ${marketLabel} and would like to introduce ourselves and explore whether there may be a commercial fit.`,
    ``,
    `Kind regards,`,
    `${business_name}`,
  ].join("\n");
}

// ─── Card projection ─────────────────────────────────────────

function projectCompanyToCard(company: DiscoveredCompany, position: number): BusinessResultCard {
  const contact = company.public_contact;
  const contactParts: string[] = [];
  if (contact?.email?.state === "KNOWN_YES") contactParts.push(`email: ${contact.email.address}`);
  else if (contact?.email?.state === "UNVERIFIED") contactParts.push(`email (unverified): ${contact.email.address}`);
  if (contact?.website?.state === "KNOWN_YES") contactParts.push(`website: ${contact.website.url}`);
  if (contact?.phone?.state === "KNOWN_YES") contactParts.push(`phone: ${contact.phone.number}`);
  if (contact?.contact_form?.state === "KNOWN_YES") contactParts.push(`contact form: ${contact.contact_form.url}`);
  if (contactParts.length === 0) contactParts.push("no public contact evidence yet");

  const relevanceParts = company.relevance_evidence.slice(0, 2).map((r) => r.claim);
  const relevanceSummary = relevanceParts.length > 0
    ? relevanceParts.join(" · ")
    : "no relevance evidence yet";

  let known_yes = 0, unknown = 0, unverified = 0, stale = 0;
  for (const attr of Object.values(company.attributes)) {
    switch (attr.state) {
      case "KNOWN_YES":  known_yes++; break;
      case "UNKNOWN":    unknown++; break;
      case "UNVERIFIED": unverified++; break;
      case "STALE":      stale++; break;
    }
  }
  return {
    company_id: company.company_id,
    position,
    name: company.name,
    country: company.country,
    region: company.region ?? null,
    short_description: company.short_description ?? null,
    public_website: company.public_website ?? null,
    public_contact_summary: contactParts.join(" · "),
    relevance_summary: relevanceSummary,
    provenance_summary: `${company.provenance.source} (${company.provenance.source_class})`,
    evidence_state_summary: {
      known_yes_count: known_yes,
      unknown_count: unknown,
      unverified_count: unverified,
      stale_count: stale,
    },
  };
}

// ─── Gate decision ────────────────────────────────────────────

export function decideBusinessMarketGate(input: {
  userMessage: string;
  session: SessionState | null | undefined;
  activeLanguage: Lang;
  business_id: string | null;
}): BusinessMarketGateDecision {
  const commercial = classifyCommercialIntent(input.userMessage);
  const send = detectSendAction(input.userMessage);
  const draft = detectDraftAction(input.userMessage);

  const observabilityBase: BusinessMarketObservability = {
    business_context_present: false,
    business_id: null,
    business_name: null,
    commercial_objective: commercial.objective,
    target_market: commercial.target_market,
    target_product_hint: commercial.target_product_hint,
    send_action_blocked: false,
    send_action_kind: send.action,
    draft_action_offered: false,
    draft_action_kind: draft.action,
    companies_retrieved: 0,
    companies_source_classes: [],
  };

  const isCommercialAsk = commercial.objective !== "NONE";
  const isSend = send.is_send_action;
  const isDraft = draft.is_draft_action;
  const hasBusiness = !!input.business_id;

  // Ignore entirely when the message has no commercial · send · draft signal.
  if (!isCommercialAsk && !isSend && !isDraft) {
    return { shouldGate: false, reason: "no_commercial_or_send_or_draft", observability: observabilityBase };
  }

  // Load business context if any.
  let ctx: BusinessContext | null = null;
  if (hasBusiness) {
    try { ctx = loadBusinessContext(input.business_id!); }
    catch { ctx = null; }
  }
  const observability: BusinessMarketObservability = {
    ...observabilityBase,
    business_context_present: !!ctx,
    business_id: input.business_id,
    business_name: ctx?.identity.display_name ?? ctx?.identity.legal_name ?? null,
  };

  // 1 · SEND action — deterministic block (§10 §30) — regardless of context
  if (isSend) {
    observability.send_action_blocked = true;
    return {
      shouldGate: true,
      reason: `send_blocked:${send.action}`,
      reply: replySendBlocked(send.action, input.activeLanguage),
      language: input.activeLanguage,
      observability,
      cards: null,
    };
  }

  // 2 · No business context but commercial or draft ask → guide the user.
  if (!ctx) {
    return {
      shouldGate: true,
      reason: "no_business_context",
      reply: replyNoBusinessContext(input.activeLanguage),
      language: input.activeLanguage,
      observability,
      cards: null,
    };
  }

  // 3 · DRAFT action → build a draft using business + product + market
  if (isDraft) {
    observability.draft_action_offered = true;
    const active = ctx.active_objective;
    const market = active?.target_market ?? commercial.target_market;
    const industry = ctx.identity.industry ?? null;
    // Look for a target company in the current session's memoized entities.
    // v1: no session-side company memo yet · pass null.
    const draftReply = replyDraftIntroduction({
      business_name: ctx.identity.display_name,
      business_industry: industry,
      target_company: null,
      objective: active?.objective_kind ?? commercial.objective,
      market,
      lang: input.activeLanguage,
    });
    return {
      shouldGate: true,
      reason: `draft:${draft.action}`,
      reply: draftReply,
      language: input.activeLanguage,
      observability,
      cards: null,
    };
  }

  // 4 · COMMERCIAL ASK · retrieve companies (deterministic · JSONL only)
  const companies = retrieveCompanies({
    country: commercial.target_market ?? undefined,
    industry: commercial.target_industry_hint ?? ctx.identity.industry ?? undefined,
    objective_kind: commercial.objective,
    product_hint: commercial.target_product_hint ?? undefined,
    limit: 10,
  });
  observability.companies_retrieved = companies.length;
  observability.companies_source_classes = Array.from(new Set(companies.map((c) => c.provenance.source_class)));

  if (companies.length === 0) {
    return {
      shouldGate: true,
      reason: `no_companies_found:${commercial.objective}:${commercial.target_market ?? "none"}`,
      reply: replyNoCompaniesFound({
        business_name: ctx.identity.display_name,
        objective: commercial.objective,
        market: commercial.target_market,
        product: commercial.target_product_hint,
        lang: input.activeLanguage,
      }),
      language: input.activeLanguage,
      observability,
      cards: null,
    };
  }

  // Companies found · project to card set
  const cards = companies.map((c, i) => projectCompanyToCard(c, i + 1));
  const marketLabel = commercial.target_market ?? "the target market";
  const objLabel = commercial.objective.replace(/^FIND_/, "").replace(/_/g, " ").toLowerCase();
  const headline = input.activeLanguage === "ID"
    ? `Ditemukan ${companies.length} kandidat ${objLabel} di ${marketLabel}.`
    : `Found ${companies.length} candidate ${objLabel} in ${marketLabel}.`;

  return {
    shouldGate: true,
    reason: `commercial_result_set:${commercial.objective}:${commercial.target_market ?? "none"}:${companies.length}`,
    reply: headline,
    language: input.activeLanguage,
    observability,
    cards: {
      vertical: "business_market",
      cards,
      total_available: companies.length,
      headline,
    },
  };
}

// ─── Re-exports ────────────────────────────────────────────────

export {
  classifyCommercialIntent,
  detectSendAction,
  detectDraftAction,
} from "./commercial-intent";
export type {
  CommercialObjective,
  CommercialIntentDetection,
  SendActionDetection,
  DraftActionDetection,
} from "./commercial-intent";
