// Network answer router.

import { findMatches } from "./matchmaker";
import type { NetworkSnapshot } from "./types";
import { opportunitySlot, resolveResultLimit } from "../util/limit";

export type NetworkQuestion =
  | { kind: "find";        brief: string }
  | { kind: "trust" }
  | { kind: "collaborators" }
  | { kind: "referrals" }
  | { kind: "unavailable" }
  | { kind: "none" };

export function classifyNetworkQuestion(text: string): NetworkQuestion {
  const t = text.toLowerCase().trim();
  if (!t) return { kind: "none" };

  if (/\bfind\s+me\s+a\b|\brecommend\s+(a|an)\b|\bi\s+need\s+(a|an)\b|\bwho\s+can\s+i\s+call\b/.test(t)) {
    return { kind: "find", brief: text };
  }
  if (/\btrust\s+score\b|\bmy\s+trust\s+profile\b|\bhow\s+trusted\s+am\s+i\b/.test(t)) return { kind: "trust" };
  if (/\bcollaborators?\b|\bpartners?\b|\bwho\s+have\s+i\s+worked\s+with\b/.test(t))    return { kind: "collaborators" };
  if (/\breferrals?\b|\bwho\s+should\s+i\s+ask\s+for\s+a\s+referral\b/.test(t))         return { kind: "referrals" };
  if (/\bwhat\s+can'?t\s+you\s+connect\b|\bwhat'?s\s+missing\s+from\s+the\s+network\b/.test(t)) return { kind: "unavailable" };

  return { kind: "none" };
}

export type AnswerNetworkInput = {
  question:      NetworkQuestion;
  snapshot?:     NetworkSnapshot;
  excludeSlugs?: string[];
};

export async function answerNetwork(input: AnswerNetworkInput): Promise<string> {
  const { question, snapshot } = input;
  switch (question.kind) {
    case "find": {
      const res = await findMatches({ brief: question.brief, excludeSlugs: input.excludeSlugs });
      if (!res) return "I didn't recognise a trade in that. Try 'find me a bricklayer near M25' or 'recommend a roofer in Manchester'.";
      const lines: string[] = [];
      const limit = resolveResultLimit(question.brief);
      lines.push(`Top ${limit} ${res.intent.trade}${limit === 1 ? "" : "s"}${res.intent.area ? ` in ${res.intent.area}` : ""} (${res.matches.length} matched):`);
      const shown = res.matches.slice(0, limit);
      for (const b of shown) {
        const dist = b.distance_km !== null ? ` — ~${b.distance_km} km away` : "";
        lines.push(`- ${b.display_name} (${b.primary_trade}, ${b.city})${dist}`);
      }
      for (let i = shown.length; i < limit; i++) lines.push(`- ${opportunitySlot("trade")}`);
      lines.push("");
      lines.push(res.note);
      return lines.join("\n");
    }
    case "trust": {
      if (!snapshot) return "I need your network snapshot to score trust — ask again.";
      const t = snapshot.trust;
      const lines = [`${t.display_name} — trust ${t.overall_score}% (${t.band}).`];
      lines.push("");
      for (const [k, s] of Object.entries(t.signals)) {
        const scoreLabel = s.score === null ? "no data" : `${s.score}%`;
        lines.push(`- ${k}: ${scoreLabel} — ${s.note}`);
      }
      return lines.join("\n");
    }
    case "collaborators": {
      if (!snapshot) return "I need your network snapshot to list collaborators.";
      if (snapshot.collaborators.length === 0) return "No past co-project collaborators on record yet.";
      const lines = ["Trades you've worked alongside on projects:"];
      for (const c of snapshot.collaborators) {
        const when = c.most_recent_at ? c.most_recent_at.slice(0, 10) : "unknown";
        lines.push(`- ${c.partner_name}${c.partner_trade ? ` (${c.partner_trade})` : ""} — ${c.projects_together} project${c.projects_together === 1 ? "" : "s"} together, last ${when}`);
      }
      return lines.join("\n");
    }
    case "referrals": {
      if (!snapshot) return "I need your network snapshot to find referral opportunities.";
      if (snapshot.referrals.length === 0) return "No obvious referral moments right now.";
      const lines = ["Referral opportunities:"];
      for (const r of snapshot.referrals) lines.push(`- ${r.display_name} — ${r.reason} → ${r.action}`);
      return lines.join("\n");
    }
    case "unavailable": {
      if (!snapshot) return "";
      const lines = ["Not yet connected to the network:"];
      for (const u of snapshot.unavailable) lines.push(`- ${u}`);
      lines.push("");
      lines.push("Add those sources and I'll fold them in without any code change.");
      return lines.join("\n");
    }
    case "none":
      return "";
  }
}
