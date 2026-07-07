// Case study composer — takes a closed arc + its events and drafts:
//   - A rich narrative markdown (headline + intro + middle + outro)
//   - Suggested channel-specific renderings (fed into publications)
//
// Uses the LLM when available; falls back to a template composition
// that stitches the arc's facets into a competent-if-boring narrative.

import { completeJson } from "@/lib/llm/anthropic";
import { loadEvent } from "@/lib/events/loader";
import type { StoryArc } from "./types";
import type { BusinessEvent } from "@/lib/events/types";

export type CaseStudyDraft = {
  headline: string;
  intro: string;
  middle: string;
  outro: string;
  hero_image_url: string | null;
  photo_urls: string[];
  facets: Record<string, unknown>;
  channel_hints: {
    instagram_carousel_ideas: string[];
    facebook_hook: string;
    gbp_summary: string;
    linkedin_insight: string;
    website_slug: string;
  };
};

export async function composeCaseStudy(
  arc: StoryArc,
  eventIds: string[]
): Promise<CaseStudyDraft | null> {
  const events: BusinessEvent[] = [];
  for (const id of eventIds) {
    const ev = await loadEvent(id);
    if (ev) events.push(ev);
  }
  if (events.length === 0) return null;

  const allPhotos = events.flatMap(
    (e) => ((e.eventPayload as Record<string, unknown>).photo_urls as string[]) ?? []
  );
  const heroImage = allPhotos[0] ?? null;
  const trade = (arc.facets.trade as string) ?? "";
  const service = (arc.facets.service as string) ?? "";
  const materials = (arc.facets.materials as string[]) ?? [];
  const postcode = (arc.facets.postcode as string) ?? "";

  const eventSummaries = events.map((e, i) => {
    const p = e.eventPayload as Record<string, unknown>;
    return {
      order: i + 1,
      when: e.occurredAt.slice(0, 10),
      stage: (p.stage as string) ?? e.eventType,
      note: [p.trade, p.service, p.stage].filter(Boolean).join(" · ")
    };
  });

  const llm = await completeJson<{
    headline?: string;
    intro?: string;
    middle?: string;
    outro?: string;
    channel_hints?: CaseStudyDraft["channel_hints"];
  }>({
    system: `You draft case studies for UK trade businesses. Direct voice, no marketing-speak,
no superlatives. Reference the material or technique. Mention the location.
Never invent details. Respond in JSON only.`,
    maxTokens: 1400,
    temperature: 0.4,
    messages: [
      {
        role: "user",
        content: `Compose a case study for this completed job.

Trade: ${trade || "unspecified"}
Service: ${service || "unspecified"}
Materials: ${materials.join(", ") || "unspecified"}
Location: ${postcode || "unspecified"}
Job timeline (${events.length} events, oldest to newest):
${eventSummaries.map((s) => `- Day ${s.order} (${s.when}): ${s.stage} — ${s.note}`).join("\n")}

Compose:
- headline (max 60 chars, punchy, no colon-fluff)
- intro (2-3 sentences setting the scene, mention material or context)
- middle (3-5 sentences walking through the work with one specific detail)
- outro (1-2 sentences on the result)
- channel_hints:
  - instagram_carousel_ideas (array of 3-4 short slide titles)
  - facebook_hook (opening line, 1 sentence, conversational)
  - gbp_summary (< 100 chars, local + specific, no exclamation marks)
  - linkedin_insight (1-2 sentences of "here's what we do differently")
  - website_slug (kebab-case, 4-6 words)

Respond with JSON: { "headline": ..., "intro": ..., "middle": ..., "outro": ..., "channel_hints": {...} }`
      }
    ]
  });

  if (llm && llm.headline && llm.channel_hints) {
    return {
      headline: llm.headline,
      intro: llm.intro ?? "",
      middle: llm.middle ?? "",
      outro: llm.outro ?? "",
      hero_image_url: heroImage,
      photo_urls: allPhotos,
      facets: arc.facets,
      channel_hints: llm.channel_hints
    };
  }

  // Fallback template.
  const t = trade ? humanise(trade) : "trade";
  const s = service ? humanise(service).toLowerCase() : "job";
  const mat = materials.length ? materials.map(humanise).join(" and ") : "";
  const where = postcode ? ` in ${postcode}` : "";
  const days = daysBetween(events[0].occurredAt, events[events.length - 1].occurredAt);
  return {
    headline: `${humanise(s)} completed${where}`,
    intro: `A ${days > 0 ? `${days}-day` : "recent"} ${s}${where}${mat ? ` using ${mat}` : ""}.`,
    middle: events
      .map(
        (e) =>
          `Day ${daysBetween(events[0].occurredAt, e.occurredAt) + 1}: ${humanise((e.eventPayload as Record<string, unknown>).stage as string ?? e.eventType)}.`
      )
      .join(" "),
    outro: `Job finished on ${events[events.length - 1].occurredAt.slice(0, 10)}.`,
    hero_image_url: heroImage,
    photo_urls: allPhotos,
    facets: arc.facets,
    channel_hints: {
      instagram_carousel_ideas: events
        .slice(0, 4)
        .map((_, i) => `Day ${i + 1} on the ${s}`),
      facebook_hook: `Another ${s}${where} wrapped.`,
      gbp_summary: `${humanise(s)}${where}${mat ? ` — ${mat}` : ""}`.slice(0, 100),
      linkedin_insight: `Small detail from our latest ${s}: ${mat || "attention on the finish"}.`,
      website_slug: [trade, service, postcode.toLowerCase(), "case"]
        .filter(Boolean)
        .join("-")
    }
  };
}

function humanise(s: string): string {
  return s
    .toString()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function daysBetween(a: string, b: string): number {
  const diff = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}
