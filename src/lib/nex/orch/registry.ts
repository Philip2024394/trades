// Agent registry. Each entry is a thin wrapper over an existing
// engine's answer function. The orchestrator picks + sequences these.
//
// Adding a new specialist = add a spec to `catalog.ts` + a permission
// row in `permissions.ts`. The audit at boot keeps the registry honest.
//
// Phase 24 grew this from 10 → ~40 agents (baseline 10 + 30 specialists).

import { answerBIQuestion, buildBusinessSnapshot, classifyBIQuestion } from "../bi";
import { answerFinancial, buildFinancialSnapshot, classifyFinancialQuestion } from "../fi";
import { answerMP, classifyMPQuestion } from "../mp";
import { buildEstimate } from "../est";
import { retrieveKnowledge } from "../knowledge";
import { SPECIALIST_AGENTS } from "./catalog";
import { auditRegistry } from "./permissions";
import { evidenceFor, type Agent, type AgentInvocationContext, type AgentResult } from "./types";

// ─── Baseline 10 agents (Phase 15/19) ───────────────────────────

const regulationsAgent: Agent = {
  id:          "regulations",
  name:        "Regulations Agent",
  role:        "Points at the relevant regulatory guidance for a job",
  speciality:  "regulations",
  category:    "regulations",
  permissions: ["read_regulations", "read_knowledge"],
  version:     "2026-07",
  tools:       ["knowledge.retrieve"],
  country_support: ["UK", "IE", "AU", "US", "CA", "NZ", "AE"],
  expertise_keywords: ["regulations", "regs", "compliance", "approved documents", "part a", "part b", "part l", "part p"],
  boundaries:  ["Never a substitute for a Building Control officer or inspector."],
  async invoke(ctx) {
    const hits = await retrieveKnowledge(ctx.focus_ask, 4).catch(() => []);
    const evidence = evidenceFor("hammerex_knowledge_entries (content_type=regulation|standard)", ["hammerex_knowledge_entries"]);
    if (!hits || hits.length === 0) {
      return {
        agent_id:   "regulations",
        headline:   "No specific regulation retrieved for this ask — verify with your inspector.",
        speak:      "Regulations agent: nothing on file for this ask yet. Nex is not a building inspector — always confirm the applicable regulation with a qualified professional.",
        confidence: "low",
        is_official: true,
        evidence
      };
    }
    const lines = hits.map((h) => `- ${h.title ?? "(untitled)"}`);
    return {
      agent_id:   "regulations",
      headline:   `${hits.length} regulation reference${hits.length === 1 ? "" : "s"} pulled.`,
      speak:      `Regulations agent found:\n${lines.join("\n")}\n\nNex is not a building inspector — confirm applicability with a qualified professional.`,
      confidence: hits.length >= 3 ? "medium" : "low",
      is_official: true,
      evidence
    };
  }
};

const estimatingAgent: Agent = {
  id:          "estimating",
  name:        "Estimating Agent",
  role:        "Prices labour + materials + waste + overhead + profit + VAT",
  speciality:  "estimating",
  category:    "commercial",
  permissions: ["read_projects", "read_products", "read_knowledge"],
  version:     "2026-07",
  tools:       ["est.buildEstimate"],
  country_support: ["*"],
  expertise_keywords: ["price", "quote", "estimate", "labour", "material cost", "margin", "profit"],
  async invoke(ctx) {
    const res = await buildEstimate({ brief: ctx.focus_ask, context: { merchantSlug: ctx.merchant_slug } });
    const evidence = evidenceFor("Phase 7 est.buildEstimate", []);
    if (!res.ok) {
      return {
        agent_id: "estimating", headline: "Couldn't estimate.",
        speak: `Estimating agent: I couldn't produce an estimate — ${res.reason}.`,
        confidence: "low", evidence
      };
    }
    const e = res.estimate;
    return {
      agent_id: "estimating",
      headline: `${e.trade_label} · ${e.scope} · total £${(e.total_pence / 100).toLocaleString("en-GB")}.`,
      speak:    `Estimating agent produced: ${e.trade_label} — ${e.scope}. Total £${(e.total_pence / 100).toLocaleString("en-GB")} (net £${(e.net_pence / 100).toLocaleString("en-GB")}, ${e.duration_days.toFixed(1)} days).`,
      confidence: "medium",
      metadata: { trade: e.trade, materials_pence: e.materials_pence, labour_pence: e.labour_pence },
      evidence
    };
  }
};

const procurementAgent: Agent = {
  id:          "procurement",
  name:        "Procurement Agent",
  role:        "Finds suppliers, products, availability, pricing, alternatives",
  speciality:  "procurement",
  category:    "commercial",
  permissions: ["read_products", "read_suppliers"],
  version:     "2026-07",
  tools:       ["mp.searchProducts", "mp.rankListings"],
  country_support: ["*"],
  expertise_keywords: ["supplier", "buy", "source", "delivery", "stock", "catalogue", "catalog"],
  async invoke(ctx) {
    const q = classifyMPQuestion(ctx.focus_ask);
    const res = await answerMP({ question: q.kind === "none" ? { kind: "find_material", ask: ctx.focus_ask } : q, merchantSlug: ctx.merchant_slug });
    const evidence = evidenceFor("Phase 17 mp.answerMP", []);
    return {
      agent_id: "procurement",
      headline: res.data ? `${res.data.results.length} listing${res.data.results.length === 1 ? "" : "s"} on the platform.` : "No listings on the platform.",
      speak:    `Procurement agent:\n${res.speak}`,
      confidence: res.data && res.data.results.length >= 3 ? "medium" : "low",
      evidence
    };
  }
};

const visionAgent: Agent = {
  id:          "vision",
  name:        "Vision Agent",
  role:        "Reads images — analysis, damage, safety, measurement, OCR, compare",
  speciality:  "vision",
  category:    "property",
  permissions: ["read_photos"],
  version:     "2026-07",
  tools:       ["cv.analyze", "cv.damage", "cv.safety", "cv.measure", "cv.ocr", "cv.compare"],
  country_support: ["*"],
  expertise_keywords: ["photo", "image", "drawing", "damage", "defect", "snap", "picture"],
  async invoke(_ctx) {
    return {
      agent_id: "vision", headline: "Vision needs an image.",
      speak: "Vision agent: I need an image URL to analyse. Attach one and re-ask.",
      confidence: "low",
      evidence: evidenceFor("Phase 13 cv.answerVision — requires image", [])
    };
  }
};

const sitebookAgent: Agent = {
  id:          "sitebook",
  name:        "SiteBook Agent",
  role:        "Manages the daily site diary, photos, snags, progress",
  speciality:  "diary",
  category:    "business",
  permissions: ["read_projects", "read_photos"],
  version:     "2026-07",
  tools:       ["pi.buildProjectSnapshot"],
  country_support: ["*"],
  expertise_keywords: ["site diary", "snag", "photo diary", "daily log"],
  async invoke(_ctx) {
    return {
      agent_id: "sitebook", headline: "Ask a project-scoped question.",
      speak: "SiteBook agent: ask me about a specific project (e.g. 'show me the Smith extension') and I'll pull its snapshot.",
      confidence: "low",
      evidence: evidenceFor("Phase 6 pi.buildProjectSnapshot — needs projectId", [])
    };
  }
};

const financeAgent: Agent = {
  id:          "finance",
  name:        "Finance Agent",
  role:        "Reads revenue, profit, cash flow, VAT + affordability",
  speciality:  "finance",
  category:    "business",
  permissions: ["read_projects", "read_costs"],
  version:     "2026-07",
  tools:       ["fi.buildFinancialSnapshot"],
  country_support: ["*"],
  expertise_keywords: ["cash flow", "revenue", "profit report", "vat", "overdue", "invoice"],
  async invoke(ctx) {
    const res = await buildFinancialSnapshot({ merchantSlug: ctx.merchant_slug });
    if (!res.ok) return {
      agent_id: "finance", headline: "Listing not set up.",
      speak: "Finance agent: listing not set up yet.", confidence: "low",
      evidence: evidenceFor("Phase 10 fi.buildFinancialSnapshot", [])
    };
    const q = classifyFinancialQuestion(ctx.focus_ask);
    const speak = answerFinancial(q.kind === "none" ? { kind: "overview" } : q, res.snapshot, null);
    return {
      agent_id: "finance",
      headline: `Financial Health ${res.snapshot.health.score}%.`,
      speak:    `Finance agent:\n${speak}`,
      confidence: "medium",
      evidence:   evidenceFor("Phase 10 fi.buildFinancialSnapshot", [])
    };
  }
};

const marketingAgent: Agent = {
  id:          "marketing",
  name:        "Marketing Agent",
  role:        "Drafts social posts + reads marketing performance",
  speciality:  "marketing",
  category:    "business",
  permissions: ["read_marketing", "read_customers", "write_drafts"],
  version:     "2026-07",
  tools:       ["bi.social", "social.generateAndDraft"],
  country_support: ["*"],
  expertise_keywords: ["post", "marketing", "facebook", "instagram", "tiktok", "campaign", "social"],
  async invoke(ctx) {
    const snap = await buildBusinessSnapshot({ merchantSlug: ctx.merchant_slug });
    const bi = classifyBIQuestion(ctx.focus_ask);
    const speak = answerBIQuestion(bi.kind === "none" ? { kind: "social" } : bi, snap);
    return {
      agent_id: "marketing",
      headline: "Marketing snapshot from BI.",
      speak:    `Marketing agent:\n${speak}`,
      confidence: "low",
      evidence: evidenceFor("Phase 5 bi.answerBIQuestion (social)", []),
      is_draft: false
    };
  }
};

const customerAgent: Agent = {
  id:          "customer",
  name:        "Customer Agent",
  role:        "Reads CRM + drafts customer messages",
  speciality:  "customer_care",
  category:    "business",
  permissions: ["read_customers", "read_projects", "write_drafts"],
  version:     "2026-07",
  tools:       ["cx.findCustomersToContact", "cx.buildCustomerSnapshot"],
  country_support: ["*"],
  expertise_keywords: ["customer", "homeowner", "remind", "appointment", "follow up", "message"],
  async invoke(ctx) {
    return {
      agent_id: "customer",
      headline: "Ask by customer name or use the CX handles.",
      speak:    `Customer agent: use 'tell me about <name>' for a specific customer, or 'who owes me money?' for a list. Original ask: "${ctx.focus_ask}".`,
      confidence: "low",
      evidence: evidenceFor("Phase 8 cx routing", [])
    };
  }
};

const knowledgeAgent: Agent = {
  id:          "knowledge",
  name:        "Knowledge Agent",
  role:        "Retrieves trade knowledge entries with citations",
  speciality:  "knowledge",
  category:    "ai",
  permissions: ["read_knowledge"],
  version:     "2026-07",
  tools:       ["knowledge.retrieve"],
  country_support: ["*"],
  expertise_keywords: ["research", "guide", "advice", "how to", "installation"],
  async invoke(ctx) {
    const hits = await retrieveKnowledge(ctx.focus_ask, 4).catch(() => []);
    const evidence = evidenceFor("hammerex_knowledge_entries", ["hammerex_knowledge_entries"]);
    if (!hits || hits.length === 0) {
      return {
        agent_id: "knowledge", headline: "Nothing on file.",
        speak: "Knowledge agent: nothing on file for this ask. Ask me to research a topic and I'll surface it for approval.",
        confidence: "low", evidence
      };
    }
    return {
      agent_id:   "knowledge",
      headline:   `${hits.length} knowledge entr${hits.length === 1 ? "y" : "ies"}.`,
      speak:      "Knowledge agent found:\n" + hits.map((h) => `- ${h.title ?? "(untitled)"}`).join("\n"),
      confidence: hits.length >= 3 ? "medium" : "low",
      evidence
    };
  }
};

const propertyAgent: Agent = {
  id:          "property",
  name:        "Property Agent",
  role:        "Reads property history + Building Passport data",
  speciality:  "property",
  category:    "property",
  permissions: ["read_property", "read_projects", "read_photos"],
  version:     "2026-07",
  tools:       ["cc.buildPropertySnapshot"],
  country_support: ["*"],
  expertise_keywords: ["property", "passport", "building passport", "address", "house history"],
  async invoke(ctx) {
    return {
      agent_id: "property",
      headline: "Give me an address.",
      speak:    `Property agent: give me an address or "build the passport for <address>". Ask received: "${ctx.focus_ask}".`,
      confidence: "low",
      evidence: evidenceFor("Phase 16 cc property routing", [])
    };
  }
};

// ─── Full registry + boot audit ─────────────────────────────────

const BASELINE_AGENTS: Agent[] = [
  regulationsAgent,
  estimatingAgent,
  procurementAgent,
  visionAgent,
  sitebookAgent,
  financeAgent,
  marketingAgent,
  customerAgent,
  knowledgeAgent,
  propertyAgent
];

export const AGENTS: Agent[] = [...BASELINE_AGENTS, ...SPECIALIST_AGENTS];

const findings = auditRegistry(AGENTS);
if (findings.length > 0) {
  // Fail-loud on permission drift — this block runs once on module
  // load. In production this would surface as a boot error.
  // eslint-disable-next-line no-console
  console.error("[nex/orch] permission audit failed:", findings);
}

export function getAgent(id: import("./types").AgentId): Agent | null {
  return AGENTS.find((a) => a.id === id) ?? null;
}

/** All agents grouped by category. Used by mesh/planner + the
 *  explainer to give a tidy family-view of the workforce. */
export function agentsByCategory(): Record<import("./types").AgentCategory, Agent[]> {
  const cats: import("./types").AgentCategory[] = ["regulations", "trades", "commercial", "business", "property", "ai"];
  const out = {} as Record<import("./types").AgentCategory, Agent[]>;
  for (const c of cats) out[c] = AGENTS.filter((a) => a.category === c);
  return out;
}

/** Test-only: allow tests to inspect the audit result. */
export function _auditFindings(): ReturnType<typeof auditRegistry> {
  return auditRegistry(AGENTS);
}

/** Test-only helper — safely invoke an agent with a mock context.
 *  Never throws even if the agent's engine errors. */
export async function _invoke(id: import("./types").AgentId, ctx: AgentInvocationContext): Promise<AgentResult | null> {
  const agent = getAgent(id);
  if (!agent) return null;
  try {
    return await agent.invoke(ctx);
  } catch (err) {
    return {
      agent_id: id, headline: "error", speak: "",
      confidence: "low",
      evidence: evidenceFor("registry invoke error", []),
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
