// NEX Trade Centre search assistant.
//
// Three-layer response (Phase 7 Increment 4B):
//   1. Retrieval — keyword match against knowledge_master.json. If
//      strong matches exist (especially ones with educational
//      diagrams), we surface them so the user gets curated Brain
//      content with attached visuals.
//   2. Product results — real published products from
//      app_products_merchant_offers ranked by promotion + proximity
//      when a postcode is supplied.
//   3. LLM framing — a short conversational reply that either
//      introduces the retrieved matches or, if the Brain has nothing
//      relevant, gives generic help without inventing suppliers or
//      prices.
//
// Body accepted (POST):
//   { query: string, postcode?: string }
//
// Response shape:
//   {
//     reply: string,
//     brain_matches: BrainEntry[],
//     product_matches: CentreFeedItem[],
//     source: "…"
//   }

import { NextResponse } from "next/server";
import { complete } from "@/lib/llm/anthropic";
import { retrieveBrainMatches, type BrainEntry } from "@/lib/nex/knowledge/retrieve";
import { listCentreFeedItems, type CentreFeedItem } from "@/lib/nex/centre-publishing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `You are NEX, the search assistant for NEX Trade Centre — a UK marketplace where homeowners and trades find suppliers, products, services, projects and deals.

When a user asks a question, respond with a short helpful message (2-3 sentences maximum) that:
- Restates the intent in plain English so the user knows you understood
- If Brain matches are supplied below, refer to them naturally and note that a diagram is attached when relevant
- If no Brain matches, suggest 1-2 categories or filters to narrow the search (Products · Suppliers · Services · Projects · Deals)
- If the query is vague, ask ONE clarifying question

Rules:
- UK English throughout (colour, favour, tyre, £, mm, kg)
- Never invent specific supplier names, prices, addresses or listings
- Never mention that you are an AI, LLM, model or system
- Warm workshop tone: direct, useful, no fluff`;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const query: string = String(body?.query ?? "").trim().slice(0, 500);
    const postcode: string | undefined =
      typeof body?.postcode === "string" && body.postcode.trim().length > 0
        ? body.postcode.trim().slice(0, 12)
        : undefined;

    if (!query) {
      return NextResponse.json(
        {
          reply: null,
          brain_matches: [],
          product_matches: [],
          error: "missing_query",
        },
        { status: 400 }
      );
    }

    // 1. Retrieval — Brain + product listings in parallel
    const [brainMatches, productMatches] = await Promise.all([
      Promise.resolve(retrieveBrainMatches(query, 3)) as Promise<BrainEntry[]>,
      listCentreFeedItems({
        query,
        postcode,
        limit: 8,
      }) as Promise<CentreFeedItem[]>,
    ]);

    // 2. LLM framing
    const brainContext = brainMatches.length > 0
      ? "\n\nRelevant Brain entries the user is about to see:\n" +
        brainMatches.map((m, i) =>
          `${i + 1}. ${m.question}${m.diagram ? " (diagram attached)" : ""} — ${m.answer.slice(0, 240)}${m.answer.length > 240 ? "…" : ""}`
        ).join("\n")
      : "";

    const productContext = productMatches.length > 0
      ? "\n\nProducts NEX also found on the Centre for this query:\n" +
        productMatches.slice(0, 5).map((p, i) => {
          const price = `£${(p.price_pence / 100).toFixed(2)}`;
          const distance = p.distance_km != null
            ? ` · ${Math.round(p.distance_km)}km away`
            : "";
          const merchant = p.merchant_display_name
            ? ` from ${p.merchant_display_name}`
            : "";
          return `${i + 1}. ${p.name} (${p.brand_name})${merchant} — ${price}${distance}`;
        }).join("\n")
      : "";

    const reply = await complete({
      system: SYSTEM,
      messages: [
        { role: "user", content: query + brainContext + productContext },
      ],
      maxTokens: 260,
      temperature: 0.4
    });

    if (!reply) {
      return NextResponse.json({
        reply: fallbackReply(query, brainMatches, productMatches),
        brain_matches: brainMatches,
        product_matches: productMatches,
        source: brainMatches.length > 0 ? "brain+fallback" : "fallback"
      });
    }

    return NextResponse.json({
      reply,
      brain_matches: brainMatches,
      product_matches: productMatches,
      source:
        brainMatches.length > 0
          ? productMatches.length > 0
            ? "brain+products+llm"
            : "brain+llm"
          : productMatches.length > 0
          ? "products+llm"
          : "llm",
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[centre-search] error", err);
    return NextResponse.json(
      {
        reply: "NEX can't reach the search service right now. Try browsing the feed below or use the Filters button to narrow results.",
        brain_matches: [],
        product_matches: [],
        source: "error"
      },
      { status: 200 }
    );
  }
}

function fallbackReply(
  query: string,
  matches: BrainEntry[],
  products: CentreFeedItem[] = []
): string {
  if (products.length > 0) {
    const top = products[0];
    const merchant = top.merchant_display_name
      ? ` from ${top.merchant_display_name}`
      : "";
    return `NEX found ${products.length} product${products.length === 1 ? "" : "s"} matching "${query.slice(0, 60)}". Nearest match: ${top.name}${merchant} at £${(top.price_pence / 100).toFixed(2)}.`;
  }
  if (matches.length > 0) {
    return `Here's what NEX found in the Brain for "${query.slice(0, 60)}". The ${matches[0].category_tag} entry below should be a good starting point.`;
  }
  const q = query.toLowerCase();
  if (/plumber|plumbing|drain|leak|boiler/.test(q))
    return "Sounds like you're looking for a plumber or plumbing supplies. Try the Services chip for tradespeople, or Suppliers for parts and fittings.";
  if (/cement|concrete|aggregate|sand|brick/.test(q))
    return "For building materials, use the Products chip and filter by distance. Suppliers will show local trade counters.";
  if (/electrician|electrical|wiring|socket|light/.test(q))
    return "Tap Services for electricians or Suppliers if you're after fittings.";
  if (/stair|staircase|squeak/.test(q))
    return "Have a look under the stairs — most squeaks come from a loose angle block between the tread and riser. See the diagram below for the parts to check.";
  return "Have a scroll of the feed below and use the chips or Filters button to narrow by Products, Suppliers, Services, Projects or Deals.";
}
