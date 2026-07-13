// bespoke prose — Knowledge Graph → per-page copy generation.
//
// The moat. Horizontal AI app builders (Lovable, v0, Bolt) hallucinate
// UK-trade language. They don't know a CPCS blue card signals to a
// site manager. They don't know Gas Safe registration numbers should
// be surfaced verbatim. They can't distinguish a plumber's callout
// hero from an electrician's.
//
// We can — because packageForTrade() returns a real Knowledge Graph
// package with the trade's canonical services, customer types,
// workflow steps, FAQs, and compliance requirements. This task feeds
// that structured knowledge into Claude Opus 4.7 with a trades-native
// system prompt and gets back per-page copy that reads like an
// actual UK trade wrote it themselves.
//
// Downstream: StudioBuilderPreviewCanvas consumes the bespoke copy
// per page, overriding the trade-typical defaults.

import { completeWithUsage, type CompleteResult } from "@/lib/llm/anthropic";
import { packageForTrade } from "@/lib/knowledge";
import type { ExtractedIntent } from "./extractIntent";
import { UNIVERSAL_DESIGN_RULES } from "./designConstitution";
import {
  validateBespokeProse,
  withConstitutionRetry,
  type ConstitutionViolation
} from "./constitutionValidator";

export type BespokePageCopy = {
  pageId: string;
  hero?: {
    eyebrow: string;
    headline: string;
    subhead: string;
    ctaPrimary: string;
    ctaSecondary?: string;
  };
  about?: {
    heading: string;
    story: string;
    stats: { label: string; value: string }[];
  };
  services?: {
    heading: string;
    items: { title: string; description: string; priceHint: string }[];
  };
  contact?: {
    heading: string;
    subhead: string;
    responsePromise: string;
  };
  projects?: {
    heading: string;
    subhead: string;
  };
  faq?: {
    heading: string;
    items: { question: string; answer: string }[];
  };
  reviews?: {
    heading: string;
    subhead: string;
  };
};

export type BespokeProse = {
  merchantName: string;
  tradeSlug: string;
  pages: BespokePageCopy[];
};

export type BespokeProseInput = {
  merchantName: string;
  tradeSlug: string;
  city?: string;
  intent: ExtractedIntent;
  pageIds: readonly string[];
  journeySlug: string;
};

export type BespokeProseResult = {
  prose: BespokeProse | null;
  usage: CompleteResult["usage"] | null;
  /** How many LLM attempts were consumed (1 = clean first pass, >1 =
   *  constitution violations triggered retries). */
  attempts: number;
  /** Any violations left in the final response (should be empty when
   *  attempts < maxRetries + 1). */
  finalViolations: ConstitutionViolation[];
};

const SYSTEM_PROMPT = `You are a bespoke-copy generator for Thenetworkers — a UK-trades platform where merchants pay £14.99/month for a polished profile that reads like they wrote it themselves.

You have privileged access to a Knowledge Graph for each UK trade — real services, real compliance (Gas Safe, CPCS, NICEIC), real workflow, real FAQs. You use this to write copy that OUT-CLASSES general-purpose AI builders on trade authenticity, because horizontal builders have no idea what a CPCS blue card signals to a site manager or how a boiler swap actually flows.

STRICT RULES (NON-NEGOTIABLE):
- Return ONLY a JSON object matching the schema at the bottom. No markdown fences. No prose outside JSON.
- Every field MUST be trades-native. No "premium", "curated", "boutique", "elevated", "solutions", "empowering", "unlock", "delight", "revolutionise".
- Yes to real UK trade language: "on the tools", "smashed it", "callout", "Gas Safe registered", "£5m public liability", "mate".
- Every claim must be groundable in the KG package supplied. Do NOT invent accreditations, years, prices, or coverage areas.
- When the KG lists a real service, use its verbatim name (e.g. "Emergency boiler repair", not "Rapid response boiler solutions").
- Response times, accreditation numbers, and specific prices ARE OK as placeholders when the merchant will fill them in — use the placeholder pattern e.g. "[response time]" or "£[from]".
- Length ceilings: hero headline ≤ 60 chars, subhead ≤ 140 chars, about story ≤ 400 chars, service description ≤ 90 chars, FAQ answer ≤ 200 chars.
- Voice: short sentences. First-person plural ("we"). Direct. No fluff.
- When the intent tone is "urgent" (emergency callout), lead every hero with the promise of availability + region.
- When the intent tone is "premium" (portfolio-showcase), soften the CTA — "See our work" over "Get a quote".

SCHEMA (return this shape):
{
  "pages": [
    {
      "pageId": "<one of the requested ids>",
      "hero": { "eyebrow": "...", "headline": "...", "subhead": "...", "ctaPrimary": "...", "ctaSecondary": "..." },
      "about": { "heading": "...", "story": "...", "stats": [{"label": "...", "value": "..."}] },
      "services": { "heading": "...", "items": [{"title": "...", "description": "...", "priceHint": "..."}] },
      "contact": { "heading": "...", "subhead": "...", "responsePromise": "..." },
      "projects": { "heading": "...", "subhead": "..." },
      "faq": { "heading": "...", "items": [{"question": "...", "answer": "..."}] },
      "reviews": { "heading": "...", "subhead": "..." }
    }
  ]
}

Include ONLY the sub-blocks (hero / about / services / contact / projects / faq / reviews) that apply to each pageId. E.g. the "contact" page gets hero + contact; the "projects" page gets hero + projects; the "home" page usually gets hero + services + about excerpts.

Return the raw JSON object.

---

${UNIVERSAL_DESIGN_RULES}`;

function buildKgContext(tradeSlug: string, merchantName: string, city: string | undefined): string {
  const pkg = packageForTrade(tradeSlug);
  if (!pkg) {
    return `KNOWLEDGE GRAPH: no package registered for trade "${tradeSlug}" — write from general UK-trades voice with the placeholder pattern for facts.`;
  }
  const services = pkg.services
    .slice(0, 12)
    .map((s) => `- ${s.name} (${s.frequency}, ${s.pricingModel}): ${s.description}`)
    .join("\n");
  const customerTypes = (pkg.customerTypes ?? [])
    .slice(0, 6)
    .map((c) => `- ${c.name}: ${c.description}`)
    .join("\n");
  const faqs = (pkg.commonFaqs ?? [])
    .slice(0, 6)
    .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
    .join("\n\n");
  const workflow = (pkg.workflow ?? [])
    .slice(0, 8)
    .map((w) => `- ${w.name}: ${w.description}`)
    .join("\n");
  return `KNOWLEDGE GRAPH PACKAGE — ${pkg.name} (${pkg.tagline})

Trade: ${tradeSlug}
Merchant name: ${merchantName}
${city ? `City: ${city}` : ""}

CANONICAL SERVICES (use these names verbatim where relevant):
${services}

CUSTOMER TYPES:
${customerTypes}

WORKFLOW STEPS:
${workflow}

CANONICAL FAQs (rewrite in the merchant's voice, keep the facts):
${faqs}`;
}

function coerceProse(
  raw: unknown,
  merchantName: string,
  tradeSlug: string
): BespokeProse | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { pages?: unknown };
  if (!Array.isArray(r.pages)) return null;

  const pages: BespokePageCopy[] = [];
  for (const p of r.pages) {
    if (!p || typeof p !== "object") continue;
    const page = p as Record<string, unknown>;
    if (typeof page.pageId !== "string") continue;
    const copy: BespokePageCopy = { pageId: page.pageId };
    if (page.hero && typeof page.hero === "object") {
      const h = page.hero as Record<string, unknown>;
      copy.hero = {
        eyebrow: typeof h.eyebrow === "string" ? h.eyebrow.slice(0, 60) : "",
        headline: typeof h.headline === "string" ? h.headline.slice(0, 80) : "",
        subhead: typeof h.subhead === "string" ? h.subhead.slice(0, 180) : "",
        ctaPrimary: typeof h.ctaPrimary === "string" ? h.ctaPrimary.slice(0, 40) : "Get a Quote",
        ctaSecondary:
          typeof h.ctaSecondary === "string" ? h.ctaSecondary.slice(0, 40) : undefined
      };
    }
    if (page.about && typeof page.about === "object") {
      const a = page.about as Record<string, unknown>;
      const stats = Array.isArray(a.stats)
        ? (a.stats as unknown[])
            .filter((x): x is { label: string; value: string } =>
              !!x &&
              typeof x === "object" &&
              typeof (x as Record<string, unknown>).label === "string" &&
              typeof (x as Record<string, unknown>).value === "string"
            )
            .slice(0, 4)
        : [];
      copy.about = {
        heading: typeof a.heading === "string" ? a.heading.slice(0, 60) : "About us",
        story: typeof a.story === "string" ? a.story.slice(0, 500) : "",
        stats
      };
    }
    if (page.services && typeof page.services === "object") {
      const s = page.services as Record<string, unknown>;
      const items = Array.isArray(s.items)
        ? (s.items as unknown[])
            .filter((x): x is { title: string; description: string; priceHint: string } => {
              if (!x || typeof x !== "object") return false;
              const o = x as Record<string, unknown>;
              return (
                typeof o.title === "string" &&
                typeof o.description === "string" &&
                typeof o.priceHint === "string"
              );
            })
            .slice(0, 8)
        : [];
      copy.services = {
        heading: typeof s.heading === "string" ? s.heading.slice(0, 60) : "Our services",
        items
      };
    }
    if (page.contact && typeof page.contact === "object") {
      const c = page.contact as Record<string, unknown>;
      copy.contact = {
        heading: typeof c.heading === "string" ? c.heading.slice(0, 60) : "Get in touch",
        subhead: typeof c.subhead === "string" ? c.subhead.slice(0, 200) : "",
        responsePromise:
          typeof c.responsePromise === "string" ? c.responsePromise.slice(0, 140) : ""
      };
    }
    if (page.projects && typeof page.projects === "object") {
      const j = page.projects as Record<string, unknown>;
      copy.projects = {
        heading: typeof j.heading === "string" ? j.heading.slice(0, 60) : "Our work",
        subhead: typeof j.subhead === "string" ? j.subhead.slice(0, 200) : ""
      };
    }
    if (page.faq && typeof page.faq === "object") {
      const f = page.faq as Record<string, unknown>;
      const items = Array.isArray(f.items)
        ? (f.items as unknown[])
            .filter((x): x is { question: string; answer: string } => {
              if (!x || typeof x !== "object") return false;
              const o = x as Record<string, unknown>;
              return typeof o.question === "string" && typeof o.answer === "string";
            })
            .slice(0, 8)
        : [];
      copy.faq = {
        heading: typeof f.heading === "string" ? f.heading.slice(0, 60) : "Common questions",
        items
      };
    }
    if (page.reviews && typeof page.reviews === "object") {
      const rv = page.reviews as Record<string, unknown>;
      copy.reviews = {
        heading: typeof rv.heading === "string" ? rv.heading.slice(0, 60) : "What our customers say",
        subhead: typeof rv.subhead === "string" ? rv.subhead.slice(0, 200) : ""
      };
    }
    pages.push(copy);
  }
  return { merchantName, tradeSlug, pages };
}

/** Generate bespoke per-page copy from the trade's Knowledge Graph.
 *
 *  Runs the LLM → validates against the Constitution → retries up to
 *  2 times if the model drifted into banned marketing-speak, exceeded
 *  length ceilings, or lost the trades-native voice. Every retry
 *  feeds the specific violations back into the prompt as feedback. */
export async function generateBespokeProse(
  input: BespokeProseInput
): Promise<BespokeProseResult> {
  const kg = buildKgContext(input.tradeSlug, input.merchantName, input.city);
  const goals = input.intent.goals.join(", ");
  const wants = Object.entries(input.intent.wants)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(", ");
  const keywords = input.intent.keywords.join(", ");

  const baseUserMessage = `${kg}

INTENT SUMMARY:
- Audience: ${input.intent.audience}
- Tone: ${input.intent.tone}
- Style: ${input.intent.style}
- Urgency: ${input.intent.urgency}
- Goals: ${goals || "(none)"}
- Wants: ${wants || "(none)"}
- Keywords: ${keywords || "(none)"}
- Chosen journey: ${input.journeySlug}

PAGES TO WRITE COPY FOR (return one entry per pageId, only the applicable sub-blocks):
${input.pageIds.map((p) => `- ${p}`).join("\n")}

Write bespoke copy for each requested page, per the STRICT RULES. Return the JSON object.`;

  let accumulatedUsage: CompleteResult["usage"] = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0
  };

  const retry = await withConstitutionRetry<BespokeProse>({
    maxRetries: 2,
    run: async (feedback) => {
      const userMessage = feedback
        ? `${baseUserMessage}\n\n${feedback}`
        : baseUserMessage;

      const result = await completeWithUsage({
        system: "Return ONLY valid JSON. No markdown fences. No prose.",
        cachedSystem: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
        maxTokens: 2500,
        temperature: 0.4
      });

      if (!result?.text) return null;

      accumulatedUsage = {
        inputTokens: accumulatedUsage.inputTokens + result.usage.inputTokens,
        outputTokens: accumulatedUsage.outputTokens + result.usage.outputTokens,
        cacheReadTokens: accumulatedUsage.cacheReadTokens + result.usage.cacheReadTokens,
        cacheCreationTokens:
          accumulatedUsage.cacheCreationTokens + result.usage.cacheCreationTokens
      };

      let parsed: unknown = null;
      try {
        const cleaned = result.text
          .replace(/^\s*```(?:json)?\s*/i, "")
          .replace(/\s*```\s*$/i, "")
          .trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = null;
      }

      return coerceProse(parsed, input.merchantName, input.tradeSlug);
    },
    validate: (prose) => validateBespokeProse(prose)
  });

  if (!retry) {
    return {
      prose: null,
      usage: accumulatedUsage.inputTokens > 0 ? accumulatedUsage : null,
      attempts: 0,
      finalViolations: []
    };
  }

  return {
    prose: retry.value,
    usage: accumulatedUsage,
    attempts: retry.attempts,
    finalViolations: retry.finalViolations
  };
}
