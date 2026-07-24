// World answer router — routes location / regulation / universal
// search / impact analysis questions.

import { buildImpactAnalysis } from "./impact";
import { normaliseCountry, resolveLocation } from "./location";
import { NO_LOCAL_SOURCE_MESSAGE, regionConfigFor, regulationFor } from "./region";
import { universalSearch } from "./universal_search";
import type { CountryCode } from "./types";
import { opportunitySlot, resolveResultLimit } from "../util/limit";

export type WorldQuestion =
  | { kind: "location" }
  | { kind: "regulation";  topic: "building" | "fire" | "accessibility" | "electrical" | "plumbing" | "stairs" | "energy"; country_hint?: CountryCode }
  | { kind: "universal";   query: string }
  | { kind: "impact";      hint: string }
  | { kind: "none" };

export function classifyWorldQuestion(text: string): WorldQuestion {
  const t = text.toLowerCase().trim();
  if (!t) return { kind: "none" };

  if (/\bwhat\s+country\s+am\s+i\s+in\b|\bwhere\s+am\s+i\b|\bmy\s+location\b|\bset\s+my\s+country\b/.test(t)) return { kind: "location" };

  // Regulation asks with topic + optional country hint.
  const topicMap: Array<{ re: RegExp; topic: WorldQuestion & { kind: "regulation" } extends { topic: infer T } ? T : never }> = [
    { re: /\bstair\b|\bstaircase\b|\bstair\s+width\b/, topic: "stairs" },
    { re: /\bfire\b/,                                    topic: "fire" },
    { re: /\baccess(ibility)?\b|\bdisabled\s+access\b/,  topic: "accessibility" },
    { re: /\belectric|wiring\b/,                          topic: "electrical" },
    { re: /\bplumb|drain\b/,                              topic: "plumbing" },
    { re: /\benergy|insulation|part\s+l\b/,               topic: "energy" },
    { re: /\bbuilding\s+regulation|building\s+regs?\b/,  topic: "building" }
  ];
  const hitTopic = topicMap.find((r) => r.re.test(t));
  if (hitTopic) {
    // Detect explicit country hint (e.g. "in Ireland", "Australian").
    const countryHint: CountryCode =
      /\bireland|irish\b/.test(t)                          ? "IE" :
      /\bengland|scotland|wales|british|uk\b/.test(t)      ? "UK" :
      /\baustralia|australian\b/.test(t)                    ? "AU" :
      /\busa|united\s+states|american\b/.test(t)            ? "US" : "unknown";
    return { kind: "regulation", topic: hitTopic.topic, country_hint: countryHint === "unknown" ? undefined : countryHint };
  }

  const impactMatch = t.match(/\bwhat\s+(happens|if)\s+i\s+(delay|cancel|reprice|reassign)\s+(.+)/);
  if (impactMatch) return { kind: "impact", hint: text };

  const searchMatch = t.match(/\bsearch\s+(?:for\s+)?(.+)/);
  if (searchMatch) return { kind: "universal", query: searchMatch[1].replace(/[.?!]+$/, "").trim() };

  return { kind: "none" };
}

export type AnswerWorldInput = {
  question:     WorldQuestion;
  merchantSlug?: string;
};

export async function answerWorld(input: AnswerWorldInput): Promise<string> {
  const q = input.question;
  switch (q.kind) {
    case "location": {
      const loc = await resolveLocation({ merchantSlug: input.merchantSlug });
      const cfg = regionConfigFor(loc.country);
      const lines = [
        `Location: ${cfg.country_label}${loc.region ? ` (${loc.region})` : ""}${loc.city ? ` · ${loc.city}` : ""}${loc.postcode ? ` · ${loc.postcode}` : ""}.`,
        `Signal: ${loc.source} — ${loc.reason}`,
        `Currency: ${cfg.currency_symbol} ${cfg.currency}. ${cfg.vat_or_gst_label} ${cfg.vat_or_gst_rate}%. Units: ${cfg.unit_system}.`
      ];
      if (loc.source === "engine_default") {
        lines.push("");
        lines.push("Nothing on the merchant record — set your country in Studio so I don't fall back.");
      }
      return lines.join("\n");
    }

    case "regulation": {
      const loc = await resolveLocation({ merchantSlug: input.merchantSlug });
      const country: CountryCode = q.country_hint ?? loc.country;
      const cfg = regionConfigFor(country);
      const source = regulationFor(country, q.topic);
      const lines: string[] = [];
      lines.push(`Country: ${cfg.country_label}.`);
      if (source) {
        lines.push(`Standard: ${source.label} (${source.short})${source.version ? ` — version: ${source.version}` : ""}.`);
        if (source.url) lines.push(`Source: ${source.url}`);
        lines.push("");
        lines.push("Nex points at the standard — always confirm the exact clause with a qualified inspector before signing anything off.");
      } else {
        lines.push("");
        lines.push(NO_LOCAL_SOURCE_MESSAGE);
      }
      return lines.join("\n");
    }

    case "universal": {
      const hits = await universalSearch({ query: q.query, merchantSlug: input.merchantSlug });
      const limit = resolveResultLimit(q.query);
      if (hits.length === 0) {
        const lines = [`No entities on file matching "${q.query}".`];
        for (let i = 0; i < limit; i++) lines.push(`- ${opportunitySlot("project")}`);
        return lines.join("\n");
      }
      const shown = hits.slice(0, limit);
      const lines = [`Top ${limit} match${limit === 1 ? "" : "es"} for "${q.query}" (${hits.length} found):`];
      for (const h of shown) lines.push(`- [${h.entity.kind}] ${h.entity.label} — ${h.snippet.slice(0, 80)}`);
      for (let i = shown.length; i < limit; i++) lines.push(`- ${opportunitySlot("project")}`);
      return lines.join("\n");
    }

    case "impact": {
      // First pass: match against a project title in the ask.
      const projMatch = q.hint.match(/\b(delay|cancel|reprice|reassign)\s+(?:the\s+|my\s+)?(.+?)(?:\?|$|\.)/i);
      if (!projMatch) return "Tell me what you'd delay/cancel/reprice/reassign — e.g. 'what if I delay the Smith kitchen?'.";
      const kind = projMatch[1].toLowerCase() as import("./types").ImpactChange["kind"];
      const targetHint = projMatch[2].trim();
      const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
      const proj = await supabaseAdmin
        .from("hammerex_sitebook_projects")
        .select("id, title")
        .ilike("title", `%${targetHint}%`)
        .limit(3);
      const rows = proj.data ?? [];
      if (rows.length === 0) return `No project matches "${targetHint}".`;
      if (rows.length > 1) {
        const lines = [`I found more than one project matching "${targetHint}":`];
        for (const r of rows) lines.push(`- ${r.title}`);
        lines.push("Say the full name.");
        return lines.join("\n");
      }
      const analysis = await buildImpactAnalysis({
        change: {
          kind,
          target: { kind: "project", id: String(rows[0].id), label: String(rows[0].title) },
          detail: ""
        }
      });
      const lines = [`If you ${kind} "${rows[0].title}":`, ""];
      if (analysis.effects.length === 0) lines.push("Nothing traced — either it's isolated or the linking data isn't captured.");
      for (const e of analysis.effects.slice(0, 8)) lines.push(`- [${e.severity}] ${e.headline} — ${e.reason}`);
      if (analysis.warnings.length > 0) {
        lines.push("");
        for (const w of analysis.warnings) lines.push(`- ${w}`);
      }
      return lines.join("\n");
    }

    case "none":
      return "";
  }
}
