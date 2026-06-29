// One-shot: populate the six commercial-detail fields on each of
// Stuart Kingsley's five Trade Center Picks so the new dedicated pick
// detail page (/<slug>/picks/<pickId>) has rich demo content. Labels
// generalise across merchant categories so a shed / hand-tool /
// workwear / paving merchant can copy the same shape.

import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) throw new Error("SUPABASE_ACCESS_TOKEN missing");
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";
const STUART_SLUG = "demo-stuart-kingsley-building-merchant-hull";

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${txt}`);
  return JSON.parse(txt);
}

function esc(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

// ── Look up Stuart's listing ──────────────────────────────────────────
const listing = (await q(
  `SELECT id FROM hammerex_trade_off_listings WHERE slug = '${STUART_SLUG}'`
))[0];
if (!listing) throw new Error("Stuart listing not found");
console.log("Listing id:", listing.id);

// ── Snapshot current picks ──────────────────────────────────────────────
const picks = await q(`
  SELECT p.id, p.sort_order, p.status, prod.name AS product_name
  FROM hammerex_xrated_trade_center_picks p
  LEFT JOIN hammerex_xrated_products prod ON prod.id = p.product_id
  WHERE p.listing_id = '${listing.id}'
  ORDER BY p.sort_order ASC;
`);
console.log("Existing picks:\n", JSON.stringify(picks, null, 2));

// ── Seed payloads — one row per sort_order slot ────────────────────────
const SEED = [
  {
    sort_order: 0,
    expected_status: "on_promo",
    fields: {
      cta_price_pence: null,
      cta_price_label: "20% off list — pallet only",
      arrival_window_label: "Available immediately",
      delivery_available: true,
      installation_available: false,
      long_description:
        "Limited-run promo on our most-asked-for concrete block.\n\nList price stays the same for single buys; the 20% kicks in the moment you order a full pallet. Order before the end of the month and we'll hold the rate even if the pallet ships in July.\n\nDelivery covered across our usual catchment — message for site access notes so the driver doesn't waste a slot."
    }
  },
  {
    sort_order: 1,
    expected_status: "new_arrival",
    fields: {
      cta_price_pence: 850,
      cta_price_label: null,
      arrival_window_label: "Available immediately",
      delivery_available: true,
      installation_available: null,
      long_description:
        "Standard 25kg bag of multi-purpose cement, CE-marked, suitable for mortars, renders and general concrete.\n\nPriced per bag for tradies grabbing one or two; pallet rates (56 bags) come in noticeably cheaper — message for the trade-account price sheet.\n\nStock turns weekly so the dates on the bags stay fresh."
    }
  },
  {
    sort_order: 2,
    expected_status: "pre_order",
    fields: {
      cta_price_pence: 7500,
      cta_price_label: null,
      arrival_window_label: "End July 2026",
      delivery_available: true,
      installation_available: null,
      long_description:
        "Reservation slot on our next joist hanger drop — packed in 10s, galvanised, for standard 47mm joist sections.\n\nA 25% deposit secures the pack; balance settles on dispatch. Bulk discount kicks in at 5+ packs — message for the rate card.\n\nETA is end of July; if the container clears Felixstowe early we'll roll the dispatch forward and let you know."
    }
  },
  {
    sort_order: 3,
    expected_status: "on_promo",
    fields: {
      cta_price_pence: null,
      cta_price_label: "From £450/pallet",
      arrival_window_label: "Available immediately",
      delivery_available: true,
      installation_available: true,
      long_description:
        "Patio season — pallet quantities while stocks last.\n\nFrom £450 per pallet depending on slab choice; we'll confirm the exact rate once we know which range you're after. Mixed-pallet builds are fine — just say what split you want.\n\nDelivery available across our regular catchment, and we can book in our trusted installer if you'd rather hand the lift to a crew."
    }
  },
  {
    sort_order: 4,
    expected_status: "just_arrived",
    fields: {
      cta_price_pence: 120,
      cta_price_label: null,
      arrival_window_label: "Available immediately",
      delivery_available: true,
      installation_available: null,
      long_description:
        "Standard aircrete block, 100mm — light, easy to cut, ideal for inner-leaf cavity work and partition walls.\n\nPriced per block; full-pack rates (60 blocks) drop the unit price — message for the pack price.\n\nFresh delivery landed this week, stacked and dry — message before noon for same-day collection."
    }
  }
];

// ── Apply ──────────────────────────────────────────────────────────────
for (const entry of SEED) {
  const pick = picks.find((p) => Number(p.sort_order) === entry.sort_order);
  if (!pick) {
    console.warn(`No pick at sort_order ${entry.sort_order}, skipping.`);
    continue;
  }
  const f = entry.fields;
  const sql = `
    UPDATE hammerex_xrated_trade_center_picks
    SET
      long_description = ${esc(f.long_description)},
      cta_price_pence = ${esc(f.cta_price_pence)},
      cta_price_label = ${esc(f.cta_price_label)},
      arrival_window_label = ${esc(f.arrival_window_label)},
      delivery_available = ${esc(f.delivery_available)},
      installation_available = ${esc(f.installation_available)},
      updated_at = now()
    WHERE id = '${pick.id}'
    RETURNING id;
  `;
  const r = await q(sql);
  console.log(
    `sort_order ${entry.sort_order} (${pick.product_name}) updated:`,
    r[0]?.id
  );
}

// ── Verify ─────────────────────────────────────────────────────────────
const after = await q(`
  SELECT
    p.sort_order,
    p.status,
    prod.name AS product_name,
    p.long_description,
    p.cta_price_pence,
    p.cta_price_label,
    p.arrival_window_label,
    p.delivery_available,
    p.installation_available
  FROM hammerex_xrated_trade_center_picks p
  LEFT JOIN hammerex_xrated_products prod ON prod.id = p.product_id
  WHERE p.listing_id = '${listing.id}'
  ORDER BY p.sort_order ASC;
`);
console.log("\n=== Final state ===");
console.log(JSON.stringify(after, null, 2));
