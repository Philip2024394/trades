// Multi-agent facade. "Marketing Nex / Finance Nex / Projects Nex"
// are named entry points that route to the right engine. It's a
// framing layer — no separate reasoning happens here.

import { answerBIQuestion, buildBusinessSnapshot, classifyBIQuestion } from "../bi";
import { answerFinancial, buildFinancialSnapshot, classifyFinancialQuestion } from "../fi";
import {
  buildProjectsOverview,
  detectDelayedProjects,
  formatDelayed,
  formatPortfolioOverview,
  formatWorstProject
} from "../pm";
import {
  buildCustomerSnapshot,
  classifyCustomerQuestion,
  findCustomersToContact,
  formatCustomerList,
  formatCustomerOverview
} from "../cx";
import { answerSC, buildSCSnapshot, classifySCQuestion } from "../sc";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { NexAgent } from "./types";
import { AGENT_DESCRIPTIONS } from "./types";

/** Detect an agent handle at the start of the text: "marketing nex,
 *  <rest>" or "@finance <rest>". Returns null when nothing matches. */
export function detectAgent(text: string): { agent: NexAgent; rest: string } | null {
  const t = text.trim();
  const patterns: Array<{ agent: NexAgent; re: RegExp }> = [
    { agent: "marketing",   re: /^(marketing\s+nex[,:]\s*|@marketing[,:]?\s*)/i },
    { agent: "finance",     re: /^(finance\s+nex[,:]\s*|@finance[,:]?\s*)/i },
    { agent: "projects",    re: /^(projects\s+nex[,:]\s*|@projects[,:]?\s*)/i },
    { agent: "customer",    re: /^(customer\s+nex[,:]\s*|@customer[,:]?\s*)/i },
    { agent: "procurement", re: /^(procurement\s+nex[,:]\s*|@procurement[,:]?\s*)/i },
    { agent: "compliance",  re: /^(compliance\s+nex[,:]\s*|@compliance[,:]?\s*)/i }
  ];
  for (const p of patterns) {
    const m = t.match(p.re);
    if (m) return { agent: p.agent, rest: t.slice(m[0].length).trim() };
  }
  return null;
}

export type RouteAgentInput = {
  agent:         NexAgent;
  question:      string;
  merchantSlug:  string;
};

export async function routeToAgent(input: RouteAgentInput): Promise<string> {
  const q = input.question;
  switch (input.agent) {
    case "marketing": {
      // Delegate to BI (its social observations cover the marketing
      // KPIs — posts, views, WhatsApp conversion).
      const snap = await buildBusinessSnapshot({ merchantSlug: input.merchantSlug });
      const bi   = classifyBIQuestion(q.length > 0 ? q : "how's my social");
      const speak = answerBIQuestion(bi.kind === "none" ? { kind: "social" } : bi, snap);
      return `${AGENT_DESCRIPTIONS.marketing}\n\n${speak}`;
    }
    case "finance": {
      const fi = await buildFinancialSnapshot({ merchantSlug: input.merchantSlug });
      if (!fi.ok) return `${AGENT_DESCRIPTIONS.finance}\n\nYour listing isn't set up yet — I can't build a finance snapshot.`;
      const cls = classifyFinancialQuestion(q.length > 0 ? q : "how are my finances?");
      const speak = answerFinancial(cls.kind === "none" ? { kind: "overview" } : cls, fi.snapshot, null);
      return `${AGENT_DESCRIPTIONS.finance}\n\n${speak}`;
    }
    case "projects": {
      const listing = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id")
        .eq("slug", input.merchantSlug)
        .maybeSingle();
      if (!listing.data) return `${AGENT_DESCRIPTIONS.projects}\n\nListing not set up yet.`;
      const merchantListingId = String(listing.data.id);
      const merchantId = merchantListingId;
      if (/behind|delay/i.test(q)) {
        const d = await detectDelayedProjects({ merchantId, merchantListingId });
        return `${AGENT_DESCRIPTIONS.projects}\n\n${formatDelayed(d)}`;
      }
      if (/worst|worries|worries you/i.test(q)) {
        const o = await buildProjectsOverview({ merchantSlug: input.merchantSlug, merchantId, merchantListingId });
        return `${AGENT_DESCRIPTIONS.projects}\n\n${formatWorstProject(o)}`;
      }
      const o = await buildProjectsOverview({ merchantSlug: input.merchantSlug, merchantId, merchantListingId });
      return `${AGENT_DESCRIPTIONS.projects}\n\n${formatPortfolioOverview(o)}`;
    }
    case "customer": {
      const listing = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id")
        .eq("slug", input.merchantSlug)
        .maybeSingle();
      if (!listing.data) return `${AGENT_DESCRIPTIONS.customer}\n\nListing not set up yet.`;
      const merchantId = String(listing.data.id);
      const cls = classifyCustomerQuestion(q);
      if (cls.kind === "customer_overview" || cls.kind === "customer_search") {
        const name = cls.kind === "customer_overview" ? cls.name : cls.name;
        if (!name) return `${AGENT_DESCRIPTIONS.customer}\n\nWhich customer? Give me a name.`;
        const res = await buildCustomerSnapshot({ merchantId, merchantListingId: merchantId, ref: { kind: "search", query: name } });
        if (!res.ok) return `${AGENT_DESCRIPTIONS.customer}\n\nNo customer matches "${name}".`;
        return `${AGENT_DESCRIPTIONS.customer}\n\n${formatCustomerOverview(res.snapshot)}`;
      }
      const list = await findCustomersToContact(merchantId);
      return `${AGENT_DESCRIPTIONS.customer}\n\n${formatCustomerList("who_to_contact", list)}`;
    }
    case "procurement": {
      const res = await buildSCSnapshot({ merchantSlug: input.merchantSlug });
      if (!res.ok) return `${AGENT_DESCRIPTIONS.procurement}\n\nListing not set up yet.`;
      const cls = classifySCQuestion(q.length > 0 ? q : "what materials do I need next week?");
      const speak = await answerSC(cls.kind === "none" ? { kind: "shopping_list" } : cls, res.snapshot);
      return `${AGENT_DESCRIPTIONS.procurement}\n\n${speak}`;
    }
    case "compliance": {
      return [
        AGENT_DESCRIPTIONS.compliance,
        "",
        "No source data for compliance yet — RAMS, PPE, training, incident and certificate tables aren't wired.",
        "When they arrive I'll surface expiry warnings, missing certifications, and safety-audit gaps here."
      ].join("\n");
    }
  }
}
