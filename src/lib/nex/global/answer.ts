// Global answer helper — the outer layer on top of world/answer.
//
// Adds:
//   • Regulation preamble mandated by Phase 21 —
//     "I've answered using [X] for [country]."
//   • Clarification prompt when Nex isn't confident about the country.
//   • Regional-terminology rewrite so plasterboard becomes drywall for
//     US/CA merchants (etc.).
//   • Country profile reply for "what's my country profile?".

import { resolveLocation } from "../world/location";
import { regionConfigFor, regulationFor } from "../world/region";
import { needsClarification } from "./clarification";
import { profileFor, supportedCountries } from "./profiles";
import { localize } from "./terminology";
import type { CountryCode } from "../world/types";
import type { ClarificationRequest } from "./types";

export type GlobalRegulationTopic = "building" | "fire" | "accessibility" | "electrical" | "plumbing" | "stairs" | "energy";

export type GlobalRegulationInput = {
  topic:         GlobalRegulationTopic;
  country_hint?: CountryCode;
  merchantSlug?: string;
};

export type GlobalRegulationReply = {
  clarify?:   ClarificationRequest;
  speak:      string;
  country:    CountryCode;
};

export async function answerGlobalRegulation(input: GlobalRegulationInput): Promise<GlobalRegulationReply> {
  const loc = await resolveLocation({ merchantSlug: input.merchantSlug });
  const country: CountryCode = input.country_hint ?? loc.country;

  // Clarification gate — regulatory calls MUST NOT proceed on a weak
  // signal. Only skipped when the caller supplied an explicit hint.
  if (!input.country_hint) {
    const clarify = needsClarification({ location: loc, is_regulatory: true });
    if (clarify) {
      const lines = [clarify.reason, "", "Which country should I use?"];
      for (const c of clarify.choices) lines.push(`- ${c.label} (${c.code})`);
      return { clarify, speak: lines.join("\n"), country };
    }
  }

  const cfg    = regionConfigFor(country);
  const source = regulationFor(country, input.topic);

  const lines: string[] = [];

  // MANDATORY preamble — first line of every regulation reply.
  if (source) {
    lines.push(`I've answered using ${source.label} for ${cfg.country_label}.`);
    lines.push("");
    lines.push(`Country: ${cfg.country_label}.`);
    lines.push(`Standard: ${source.label} (${source.short})${source.version ? ` — version: ${source.version}` : ""}.`);
    if (source.url) lines.push(`Source: ${source.url}`);
    lines.push("");
    lines.push("Nex points at the standard — always confirm the exact clause with a qualified inspector before signing anything off.");
  } else {
    lines.push(`I've checked for a source in ${cfg.country_label} but couldn't confirm one.`);
    lines.push("");
    lines.push("I couldn't find an official source for your location. Here's the best available industry guidance, but it should not be treated as a legal or regulatory requirement.");
  }

  return { speak: localize(lines.join("\n"), country), country };
}

/** Country profile reply — for "what's my country profile?" style asks. */
export async function answerCountryProfile(input: { merchantSlug?: string; country_hint?: CountryCode }): Promise<string> {
  const loc = await resolveLocation({ merchantSlug: input.merchantSlug });
  const country = input.country_hint ?? loc.country;
  const cfg = regionConfigFor(country);
  const prof = profileFor(country);

  if (country === "unknown") {
    const lines = ["I don't have your country on file yet, so I can't give you a country profile.", "", "Set one of these:"];
    for (const c of supportedCountries()) lines.push(`- ${c.label} (${c.code})`);
    return lines.join("\n");
  }

  const lines: string[] = [];
  lines.push(`Country profile — ${prof.country_label}.`);
  lines.push("");
  lines.push(prof.industry_overview);
  lines.push("");
  lines.push(`Currency: ${prof.currency_symbol} ${cfg.currency}. ${cfg.vat_or_gst_label} ${cfg.vat_or_gst_rate}%. Units: ${cfg.unit_system}.`);
  lines.push(`Climate: ${prof.climate_zone}.`);
  lines.push(`Labour baseline: ${prof.labour_baseline}.`);
  if (prof.typical_materials.length > 0) {
    lines.push("");
    lines.push("Typical construction:");
    for (const m of prof.typical_materials) lines.push(`- ${m}`);
  }
  if (prof.trade_bodies.length > 0) {
    lines.push("");
    lines.push("Trade bodies:");
    for (const b of prof.trade_bodies) lines.push(`- ${b.name}${b.url ? ` (${b.url})` : ""}`);
  }
  if (prof.government_link.url) {
    lines.push("");
    lines.push(`Government link: ${prof.government_link.name} — ${prof.government_link.url}`);
  }
  if (prof.notes.length > 0) {
    lines.push("");
    for (const n of prof.notes) lines.push(`- ${n}`);
  }
  return localize(lines.join("\n"), country);
}

// ─── Question classifier + top-level dispatch ─────────────────

export type GlobalQuestion =
  | { kind: "regulation"; topic: GlobalRegulationTopic; country_hint?: CountryCode }
  | { kind: "profile";    country_hint?: CountryCode }
  | { kind: "none" };

export function classifyGlobalQuestion(text: string): GlobalQuestion {
  const t = text.toLowerCase().trim();
  if (!t) return { kind: "none" };

  const countryHint = detectCountryHint(t);

  if (/\b(country|regional|market)\s+profile\b|\bwhat'?s\s+my\s+country\b|\btell\s+me\s+about\s+construction\s+in\b/.test(t)) {
    return { kind: "profile", country_hint: countryHint };
  }

  const topicMap: Array<{ re: RegExp; topic: GlobalRegulationTopic }> = [
    { re: /\bstair(case)?\b|\bstair\s+width\b/,  topic: "stairs" },
    { re: /\bfire\b/,                              topic: "fire" },
    { re: /\baccess(ibility)?\b|\bdisabled\s+access\b/, topic: "accessibility" },
    { re: /\belectric|wiring\b/,                   topic: "electrical" },
    { re: /\bplumb|drain\b/,                       topic: "plumbing" },
    { re: /\benergy|insulation\b/,                 topic: "energy" },
    { re: /\bbuilding\s+regulation|building\s+regs?\b|\bbuilding\s+code\b/, topic: "building" }
  ];
  const topicHit = topicMap.find((r) => r.re.test(t));
  if (topicHit && (/\bregulation|standard|code|approved|part\s+[a-z]\b/.test(t) || countryHint !== undefined)) {
    return { kind: "regulation", topic: topicHit.topic, country_hint: countryHint };
  }
  return { kind: "none" };
}

function detectCountryHint(t: string): CountryCode | undefined {
  if (/\bireland|irish\b/.test(t))                          return "IE";
  if (/\bengland|scotland|wales|british|uk\b/.test(t))      return "UK";
  if (/\baustralia|australian\b/.test(t))                    return "AU";
  if (/\busa|united\s+states|american\b/.test(t))            return "US";
  if (/\bcanada|canadian\b/.test(t))                         return "CA";
  if (/\bnew\s+zealand|kiwi|aotearoa\b/.test(t))             return "NZ";
  if (/\buae|dubai|abu\s+dhabi|united\s+arab\s+emirates\b/.test(t)) return "AE";
  return undefined;
}

export async function answerGlobal(input: { question: GlobalQuestion; merchantSlug?: string }): Promise<string> {
  const q = input.question;
  switch (q.kind) {
    case "regulation": {
      const r = await answerGlobalRegulation({ topic: q.topic, country_hint: q.country_hint, merchantSlug: input.merchantSlug });
      return r.speak;
    }
    case "profile":
      return answerCountryProfile({ merchantSlug: input.merchantSlug, country_hint: q.country_hint });
    case "none":
      return "";
  }
}
