// src/lib/nex/brain/commerce-composer.ts
//
// Stage 3.19 · Phase 12 · Commerce Brain composer (Philip 2026-08-31).
//
// Consumer of Stage 4 SellerRecord/ProductRecord/OfferRecord data
// model. Called by orchestrateChatTurn when intent=commerce fires.
// Uses findProducts + findOffers + joinOffers from the commerce
// retrieval primitives. NEVER fabricates a product, seller, or offer.
//
// v1 discipline:
//   · Deterministic · no LLM
//   · Uses market filter (ID by default)
//   · When corpus is empty (which it is · files start empty per
//     Stage 4 doctrine), reply honestly says "no listings yet ·
//     acquisition pipeline is ready · when we onboard sellers this'll
//     surface real options"
//   · When corpus has data (post-workforce integration), reply names
//     real products + honest boundaries for what's missing (stock,
//     shipping, delivery time)
//   · Category detection from the message text (simple keyword scan)

import { findProducts, findOffers, joinOffers } from "@/lib/nex/indonesia/commerce/retrieval";
import type { Market } from "@/lib/nex/indonesia/data/types";
import type { ProductRecord, OfferWithRefs } from "@/lib/nex/indonesia/commerce/types";

// Category keyword map · lowercase message → commerce category prefix.
const CATEGORY_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(headphones?|earbuds?|speaker|audio|hp-?audio)\b/i, "audio"],
  [/\b(phone|smartphone|handphone|\bhp\b)\b/i, "phones"],
  [/\b(laptop|computer|komputer)\b/i, "computers"],
  [/\b(camera|kamera)\b/i, "cameras"],
  [/\b(tablet|ipad)\b/i, "tablets"],
  [/\b(tv|television)\b/i, "tv"],
  [/\b(shoes?|sepatu|sneakers?)\b/i, "footwear"],
  [/\b(clothes|clothing|baju|pakaian)\b/i, "apparel"],
  [/\b(bag|tas|backpack)\b/i, "bags"],
  [/\b(watch|jam)\b/i, "watches"],
  [/\b(book|buku)\b/i, "books"],
];

export type CommerceComposerInput = {
  message: string;
  userMarket?: Market;
};

export type CommerceComposerResult = {
  reply: string;
  suggestions: Array<{ label: string; href: string }>;
  card?: {
    kind: "commerce_discovery";
    payload: {
      category?: string;
      offers: Array<{ id: string; seller: string; product: string; priceAmount: number | null; priceCurrency?: string }>;
      corpusSize: { products: number; sellers: number; offers: number };
    };
  };
  detectedCategory?: string;
  offersMatched: number;
};

function detectCategory(message: string): string | undefined {
  for (const [rx, category] of CATEGORY_KEYWORDS) {
    if (rx.test(message)) return category;
  }
  return undefined;
}

export function composeCommerceReply(input: CommerceComposerInput): CommerceComposerResult {
  const detectedCategory = detectCategory(input.message);
  const market: Market = input.userMarket ?? "ID";

  // Query commerce world · Stage 4 primitives. Never fabricates.
  //
  // Discipline:
  //   · Products are typically market="UNIVERSAL" (Sony headphones are
  //     Sony headphones everywhere) · filter by categoryPrefix ONLY
  //   · Offers are market-specific (a Jogja seller's IDR listing) ·
  //     filter offers by market
  //   · Compose: for the target market's offers, join to products;
  //     when a category is detected, drop offers whose product doesn't
  //     match the category prefix
  const productsInCategory: ProductRecord[] = detectedCategory
    ? findProducts({ categoryPrefix: detectedCategory })
    : findProducts({});

  const allOffersInMarket = findOffers({ market, limit: 50 });
  const offers = detectedCategory
    ? allOffersInMarket.filter((o) => productsInCategory.some((p) => p.id === o.productId))
    : allOffersInMarket.slice(0, 5);

  const joined: OfferWithRefs[] = joinOffers(offers);

  // Corpus size for honest reporting.
  const corpusSize = {
    products: findProducts({}).length,
    sellers: 0,     // computed cheaply inside retrieval · omitted for brevity
    offers: findOffers({ status: ["active", "paused", "delisted", "unknown"] }).length,
  };

  // Case 1 · corpus is empty · honest boundary.
  if (corpusSize.products === 0 && corpusSize.offers === 0) {
    const catNote = detectedCategory ? ` in ${detectedCategory}` : "";
    return {
      reply:
        `I don't have any product listings${catNote} in my commerce world yet · the pipeline is ready but no sellers or products have been onboarded yet. When we acquire real Indonesian sellers and their inventory, this'll surface real options here. In the meantime, try the marketplace directory or a broader web search.`,
      suggestions: [{ label: "Open marketplace", href: "/nex-app/centre" }],
      card: {
        kind: "commerce_discovery",
        payload: { category: detectedCategory, offers: [], corpusSize },
      },
      detectedCategory,
      offersMatched: 0,
    };
  }

  // Case 2 · corpus has data but nothing matches this category.
  if (joined.length === 0) {
    return {
      reply:
        `I have ${corpusSize.products} products and ${corpusSize.offers} offers in my commerce world${detectedCategory ? `, but none in ${detectedCategory}` : ""}. Want to broaden the search, or shall I list what's available?`,
      suggestions: [{ label: "Browse all", href: "/nex-app/centre" }],
      card: {
        kind: "commerce_discovery",
        payload: { category: detectedCategory, offers: [], corpusSize },
      },
      detectedCategory,
      offersMatched: 0,
    };
  }

  // Case 3 · real matches · surface them.
  const names = joined.slice(0, 3).map((j) => `${j.product.name} (from ${j.seller.name})`);
  const catNote = detectedCategory ? ` for ${detectedCategory}` : "";
  const priceNote = joined.some((j) => j.offer.price)
    ? " Prices where published are shown as-of the last update."
    : " No prices published yet on these offers.";
  return {
    reply:
      `I have ${joined.length} real offers${catNote} — ${names.join(", ")}${joined.length > 3 ? ", and more" : ""}.${priceNote} Want me to compare them, or open the marketplace for one?`,
    suggestions: [{ label: "Open marketplace", href: "/nex-app/centre" }],
    card: {
      kind: "commerce_discovery",
      payload: {
        category: detectedCategory,
        offers: joined.slice(0, 5).map((j) => ({
          id: j.offer.id,
          seller: j.seller.name,
          product: j.product.name,
          priceAmount: j.offer.price?.amount ?? null,
          priceCurrency: j.offer.price?.currency,
        })),
        corpusSize,
      },
    },
    detectedCategory,
    offersMatched: joined.length,
  };
}
