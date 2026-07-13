// Seed The Yard with realistic UK trade chat + comments so
// /trade-off/yard renders like a busy forum. Uses only demo-* trades
// (Xrated seed profiles) so nothing collides with real signups.
//
// What it creates:
//   - ~20 chat-kind posts across scattered demo trades
//   - 3-6 comments per post from *other* demo trades
//   - A few reactions
//
// Safe to re-run: uses a `[mock-chat-YYYY-MM-DD]` tag in the body to
// find and delete previous seed rows before inserting fresh.

import { readFileSync } from "node:fs";
const envText = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
);
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";
const SEED_TAG = "[mock-chat]"; // marker so we can wipe + reseed safely

async function sql(q) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: q })
    }
  );
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${txt}`);
  return JSON.parse(txt);
}

function esc(s) {
  return String(s).replace(/'/g, "''");
}

// ─── 1. Wipe previous seed run ────────────────────────────────────
console.log("Wiping previous mock chat seed…");
await sql(
  `DELETE FROM hammerex_trade_off_yard_posts
    WHERE body LIKE '%${SEED_TAG}%'`
);

// ─── 2. Fetch demo trades pool ────────────────────────────────────
const listingsRes = await sql(`
  SELECT id, slug, display_name, trading_name, city, primary_trade
    FROM hammerex_trade_off_listings
   WHERE slug LIKE 'demo-%'
   ORDER BY random()
   LIMIT 40
`);
const listings = listingsRes[0]?.rows ?? listingsRes;
if (!Array.isArray(listings) || listings.length < 6) {
  console.error("Not enough demo listings found:", listings?.length);
  process.exit(1);
}
console.log(`Loaded ${listings.length} demo trades for mock chat pool.`);

function pickAuthor(excludeId = null, tradeHint = null) {
  const pool = listings.filter(
    (l) => l.id !== excludeId && (!tradeHint || l.primary_trade === tradeHint)
  );
  const bag = pool.length > 0 ? pool : listings.filter((l) => l.id !== excludeId);
  return bag[Math.floor(Math.random() * bag.length)];
}

// ─── 3. Chat post templates (real UK trade banter) ────────────────
// Real image URLs from scripts/hero-library.json — Xrated-owned
// ImageKit assets. Adds visual weight to selected posts so the feed
// stops feeling text-only.
const IMG = {
  electrician_real: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_26_18%20AM.png",
  electrician_firstfix: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_23_54%20AM.png",
  plumbing_fittings: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_03_04%20PM.png",
  plumbing_under_sink: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_01_34%20PM.png",
  slate_roof: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2001_44_51%20PM.png",
  plasterer_external: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2001_46_49%20AM.png",
  carpenter_understair: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2001_09_30%20AM.png",
  fence_install: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2010_56_22%20PM.png",
  carpenter_saw: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2009_12_44%20AM.png"
};
// Public sample MP4 — Google Cloud demo bucket. Used purely so the
// yard feed shows a video-post variant for design review.
const SAMPLE_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

const POSTS = [
  {
    tradeHint: "electrician",
    title: "2026 spark day rate in the North West?",
    body: `${SEED_TAG} What's everyone charging for a domestic day rate up around Manchester / Bolton right now? I'm quoting £280 for an approved sparks — feels tight when the merchant bill is up 12% since March. Anyone holding £320+?`,
    region: "Manchester",
    images: [IMG.electrician_real, IMG.electrician_firstfix],
    comments: [
      "£300 flat here mate, £360 for anything notifiable. Customers moaned for a week and then paid it.",
      "I'm £280 with own materials markup on top. Been thinking of moving to £320 in September when the certs renew.",
      "Bolton way it's £260-£280. Under-cutters killed the market post-covid but rates are creeping back.",
      "£340 on new builds, £300 domestic. Depends what part of the week — Friday afternoons only £220 to fill the van.",
      "Whatever you charge — add £50 for consumer unit swaps. Everyone forgets the notification fee."
    ]
  },
  {
    tradeHint: "plumber",
    title: "Best combi under £1,200 fitted right now?",
    body: `${SEED_TAG} Customer wants like-for-like combi swap in a 3-bed semi. Budget cap £1,200 all-in. Ideal 30kW. Worcester Bosch 4000 or Vaillant EcoTec Plus 630 — anyone got fresher install feedback than what's on Merchant Facebook?`,
    region: "Leeds",
    images: [IMG.plumbing_under_sink, IMG.plumbing_fittings],
    comments: [
      "Vaillant every time. Warranty side + parts availability beats Worcester in 2026. Just make sure you get the £150 installer cashback code from Vaillant Advance.",
      "Baxi 800 Combi has been solid on my last 6 installs. Cheaper than both and Baxi are actually answering the phone.",
      "Worcester 4000 for landlords, Vaillant for owner-occupiers who care about the app. Simple as that.",
      "£1,200 all-in is tight — you eating the disposal fee out of that? British Gas started charging £45 for cylinder collections last month."
    ]
  },
  {
    tradeHint: "bricklayer",
    title: "Anyone hiring a decent labourer in Bristol this week?",
    body: `${SEED_TAG} Got a lad who's finishing a job with me Friday and wants continuous work — 4 years brick + block, clean driver, CSCS green, own tools bar the mixer. He's a grafter. £160/day. DM if you need him or want me to pass his number.`,
    region: "Bristol",
    comments: [
      "Passed you my WhatsApp. Got a 2-week job in Bedminster starting Wednesday.",
      "Wish I could — full up til October. Post again in a few weeks if he's still floating.",
      "£160 is fair, tell him to bring his own hi-vis onto Persimmon sites or he'll be sent home."
    ]
  },
  {
    tradeHint: "carpenter",
    title: "Track saw or plunge saw — one to keep?",
    body: `${SEED_TAG} Kitchen fitter mostly. Been getting by with a circular saw + straight edge for 15 years. Time to upgrade. Festool TS55 vs Mafell MT55 — is Mafell really worth 30% more for someone doing 3-4 kitchens a month?`,
    region: "Newcastle",
    images: [IMG.carpenter_saw, IMG.carpenter_understair],
    video: SAMPLE_VIDEO,
    comments: [
      "Mafell all day if you're using it every week. Cleaner cut, less blow-out on worktops. Festool for occasional.",
      "TS55 with the FSK cross-cut track = 90% of the Mafell for 70% of the price.",
      "Neither. Buy the DeWalt DCS520 cordless and stop dragging a lead round jobs. I sold my TS55 in December.",
      "Whatever you buy — get the 3m rail, not the 1.4m. Full kitchen worktop in one pass or you'll regret it.",
      "Mafell resale is insane. Bought mine 2019 for £980, still worth £750. Festool loses half in 3 years."
    ]
  },
  {
    tradeHint: "roofer",
    title: "Slate merchant recommendations near Birmingham?",
    body: `${SEED_TAG} SIG have gone stupid on Spanish slate this quarter. Anyone found a straight importer or a smaller merchant playing ball? Looking for 500x250 Ultra grade, ~2,400 pieces for a re-roof end of the month.`,
    region: "Birmingham",
    images: [IMG.slate_roof],
    comments: [
      "Try Cembrit direct if you can hit their MOQ. Ceteris slate came in £120/pallet under SIG for me in April.",
      "Speyside Slate ship to Brum for free over 20 pallets. Ring the Coventry depot, not head office.",
      "The Roofing Superstore online is punchy on Ultra grade if you catch a promo. Trade log-in gets extra 8%.",
      "Don't touch Chinese slate no matter how cheap. Had a re-roof back on me after 4 winters."
    ]
  },
  {
    tradeHint: "scaffolder",
    title: "New CISRS log book delay — anyone else waiting?",
    body: `${SEED_TAG} Sent my Advanced renewal off in April. Still nothing back. Rung twice, chased email. Anyone else in the same boat? Missing a couple of contracts because clients want the log book in-hand not just proof of application.`,
    region: "London",
    mood: "frustrated",
    comments: [
      "6-week wait quoted now. Chase Simian direct, not CISRS. Faster response.",
      "Mine took 11 weeks in Feb. Nothing you can do — just show the receipt.",
      "Told my client 'delayed at printer' — they accepted the email confirmation as interim. Worth trying.",
      "Getting a lot of card-machine issues too. Whole system needs a re-do."
    ]
  },
  {
    tradeHint: "plasterer",
    title: "British Gypsum vs Knauf ThistlePro — real world?",
    body: `${SEED_TAG} Site foreman insists on British Gypsum. My skimmer says Knauf ThistlePro sets nicer and finishes cleaner. Anyone actually switched between the two mid-job and got a genuine preference? Not brand loyalty — real difference.`,
    region: "Sheffield",
    images: [IMG.plasterer_external],
    comments: [
      "Same bag, different label mostly. Knauf go off marginally quicker in warm rooms. Not enough to move on.",
      "ThistlePro is more forgiving on wet backgrounds. If you're skimming fresh boards go BG, over old plaster go Knauf.",
      "It's the merchant delivery that matters. If Knauf is £2 cheaper and 2 days quicker, use Knauf.",
      "20 years plastering — swapped last year to Knauf. Cleaner mix, less snots.",
      "Foreman is right for a spec job. If the drawings say BG, don't argue over £20 a pallet."
    ]
  },
  {
    tradeHint: "tiler",
    title: "How do you deal with wonky walls on large-format?",
    body: `${SEED_TAG} 600x1200 porcelain going up a shower wall next week. Existing wall is 4mm out over 2m. Level the wall first or scribe the tile edge? Or just accept a 3mm silicone shadow line at the corner? What do the pros do?`,
    region: "Cardiff",
    comments: [
      "Level the wall. Always. Marmox board on the outs, brick up the ins. 3mm silicone = customer complaint in 2 years.",
      "Depends on the corner. Internal — level it. External — scribe with a 45 mitre and forget silicone.",
      "Big-format on wonky walls is where cheap tiling jobs come from. Charge the £180 to level and sleep at night.",
      "Ardex X78 medium-bed adhesive can bury 3mm no problem. Not a fix but if the budget is tight it works."
    ]
  },
  {
    tradeHint: "painter",
    title: "Rain schedule ruining my exterior week — reschedule policy?",
    body: `${SEED_TAG} 3 external jobs booked back to back this week, forecast says rain Wed-Fri. Do you invoice for lost days, reschedule + swallow it, or just move to interior for the week? Getting hit twice a summer with this now.`,
    region: "Edinburgh",
    comments: [
      "T&C's on the quote say 'weather-dependent, no charge for weather cancellations'. Customers accept it easier than you'd think.",
      "Push to interior. Never charge for weather — bad look. Move labour, not the invoice.",
      "I keep a small internal 'fill-in' list. Neighbours of past customers who wanted a quick coat. Zero downtime.",
      "Charge a re-mobilisation fee (£75) not a day rate. Splits the difference and customer gets it.",
      "Buy the Airless HEA and paint through the drizzle. Half joking. Kind of."
    ]
  },
  {
    tradeHint: "handyman",
    title: "Bad review — reply or leave it?",
    body: `${SEED_TAG} 4.9 star Checkatrade profile for 3 years. Just got a 2-star out of nowhere from a customer whose flat-pack collapsed 8 weeks after I built it. They never rang me. Straight to a bad review. Do you reply publicly or let it drop?`,
    region: "Nottingham",
    mood: "confused",
    comments: [
      "Reply — polite, factual, offer to attend. Future customers judge you on your REPLY not the review.",
      "Never reply defensively. 'Sorry to hear this, please contact me directly to inspect the unit.' Done.",
      "Report to Checkatrade — if they didn't ring you first, it's against T&C's. Won them off my page twice in 2025.",
      "Let it sit for a week then reply. Gives you time to breathe and write it clean."
    ]
  },
  {
    tradeHint: "landscaper",
    title: "Best sub-base compactor for tight access gardens?",
    body: `${SEED_TAG} Doing more small city gardens where I can't get the 400kg wacker down a side alley. Looking at a 220kg forward-plate. Wacker Neuson vs Belle Group vs Norton Clipper — any long-timers own multiple?`,
    region: "Manchester",
    comments: [
      "Belle PCX for city work — light, easy to lift, spares from any local plant hire.",
      "Wacker VP1550 is heavier but the anti-vibe handle saves your wrists over a full day.",
      "Hire, don't buy. Speedy do the small plate for £48/day and you keep the £2,400.",
      "Norton Clipper is the sleeper pick — half the price of Wacker, 95% of the compaction. My son runs one."
    ]
  },
  {
    tradeHint: "gas-engineer",
    title: "Gas Safe renewal week — heads-up on the new ACS spec",
    body: `${SEED_TAG} Just did my ACS at Logic4Training this week. FYI: CCN1 has 4 new questions on hydrogen-blend readiness. If you're renewing before December, revise the HyDeploy stuff — I got caught out on the 20% blend detection question.`,
    region: "Coventry",
    comments: [
      "Cheers for the heads-up. Renewal booked for August at Develop.",
      "Same warning came out on the GSR bulletin in June. Anyone not reading those is going to trip.",
      "Doing mine at Trainmet next month. Any other new areas beyond hydrogen?",
      "Old-boiler efficiency questions have moved from CENWAT to CCN1. Watch for that too."
    ]
  },
  {
    tradeHint: "chimney-sweep",
    title: "Selling my old rods — anyone want a full 60ft set?",
    body: `${SEED_TAG} Bought new poly rods last month. Full set of my old fibreglass 60ft (12x5ft) with brushes + soot bag. All working, just heavy. £120 collected Oxford. Better than eBay.`,
    region: "Oxford",
    comments: [
      "Interested — I'm in Reading. Drop me a WhatsApp.",
      "Fair price. Poly is the way now, fibreglass takes wrist damage over 5 years.",
      "Tag @northants-sweep — he was after a spare set last week."
    ]
  },
  {
    tradeHint: "damp-proofer",
    title: "Client wants me to guarantee 20 years — signing this?",
    body: `${SEED_TAG} Retail investor. Bought a Georgian terrace to convert to flats. Wants a 20-year damp-proofing guarantee in writing. My insurance covers 10. Sign it or walk?`,
    region: "Bath",
    mood: "confused",
    comments: [
      "Walk. Any guarantee beyond your insurance term is personally liable — you'll be paying out of your pension.",
      "Structural warranty from GPI or Property Care Association can extend to 20 years but they audit the install and take a chunk of the price.",
      "You can offer a 10-year workmanship + PCA-backed 20-year materials warranty. Two separate documents. Common structure.",
      "20-year guarantees on lime-basement conversions? Not a chance. That's a masonry job the moment groundwater changes.",
      "This is why I stopped doing conversions. Domestic-only now. Sleep at night."
    ]
  },
  {
    tradeHint: "solar-installer",
    title: "MCS audit tomorrow — anything I should double-check?",
    body: `${SEED_TAG} Second annual audit tomorrow. First one went smooth. Anyone got the fresh 2026 audit checklist? Trying to make sure my paperwork on 3 recent 6kW installs is squared away.`,
    region: "Southampton",
    comments: [
      "New audit weight on the DNO G99 timing — they check you submitted within 28 days, not just that you submitted.",
      "Battery commissioning records is the one that catches people. Print them, don't rely on the cloud app.",
      "MCS-004 for design docs. Show them a completed one on your laptop and they usually don't dig further.",
      "Take biscuits. Half joking. Auditors respond to hospitality."
    ]
  },
  {
    tradeHint: "ev-charger-installer",
    title: "OZEV grant paperwork delay — 6 weeks and counting",
    body: `${SEED_TAG} Landlord install claim submitted end of May. Still nothing. Anyone getting quicker turnarounds or is this the new normal? Customer is starting to chase me for the refund I promised.`,
    region: "Reading",
    comments: [
      "6-8 weeks is standard since April. OZEV is understaffed.",
      "Stop promising 'up front discount'. Bill customer full, they claim back after. My cashflow doesn't hate me anymore.",
      "MyEV grant portal is broken for landlord claims specifically this month. Ring don't email.",
      "Just went through same thing — took 11 weeks. Sent invoice + evidence 3 times before they processed."
    ]
  },
  {
    tradeHint: "heat-pump-installer",
    title: "BUS grant admin — is it worth becoming your own installer?",
    body: `${SEED_TAG} MCS 3005 install cert costs me £4k plus annual audit. Half the time customers apply for the BUS themselves and I lose the £150 admin fee. Is it worth it or just partner with an installer?`,
    region: "Cambridge",
    comments: [
      "£4k cert + audit pays back in 2 heat-pump installs if you're doing 5+ a year. Under 5 = partner.",
      "MCS gives you the credibility badge that landlords and estate agents look for. Worth more than the direct BUS admin.",
      "Do it. Once you're MCS your quotes get accepted faster and you can price higher.",
      "Cambridge has a shortage of MCS heat-pump installers. £4k back in one job if you push. Do it."
    ]
  },
  {
    tradeHint: "door-fitter",
    title: "Bi-fold trim mismatch — how do you handle it on-site?",
    body: `${SEED_TAG} Ordered 4-panel Origin bi-fold. Delivered with wrong colour trim (RAL 7016 instead of Anthracite). Origin will send trim only in 4-6 weeks. Fit now with wrong trim + swap later, or wait? Customer wants it open by weekend.`,
    region: "Norwich",
    comments: [
      "Fit now. Trim is 20 minutes to swap when it comes. Customer gets their door, you get paid the balance.",
      "Depends on the customer. If they'll accept two visits, fit now. If they'll knock money off — wait.",
      "Take photos before you fit. Sometimes clients 'forget' about the trim swap and it becomes yours to buy.",
      "Anthracite and RAL 7016 are almost identical unless you get them right next to each other. Might not even notice.",
      "Bill Origin for the second visit. That's how they learn to check paint before dispatch."
    ]
  },
  {
    tradeHint: "groundworker",
    title: "Muckaway rates — Grab hire vs skip run — Bristol area",
    body: `${SEED_TAG} 20 tonnes of clay from a rear-garden extension. Getting quoted £280 for a 8-wheeler grab, or 3x 8-yard skips at £220 each. Skips seem mad on paper but grab needs 3-day notice and I'm mid-job. What are you paying?`,
    region: "Bristol",
    comments: [
      "Grab wins every time on volume. Book the day before with Roydon Grab, they're 24hr notice not 3.",
      "3 skips = £660 vs 1 grab = £280. Not even close. Wait the 3 days if you can.",
      "Depends on tip fees. Clay is inert so it should be £8/t not £15. Get a WTN in your name.",
      "For 20t always grab. Skips are for jobs under 5t or where grab can't reach."
    ]
  },
  {
    tradeHint: "pest-control",
    title: "Bed bug callout — heat treatment vs spray?",
    body: `${SEED_TAG} Landlord flat above a takeaway. Confirmed bed bugs. Tenant is a nurse working nights. Heat treatment = 1 day, £850. Chemical spray = 3 visits over 6 weeks, £480. Which are you recommending in 2026 with the pyrethroid resistance data?`,
    region: "London",
    comments: [
      "Heat every time now. Resistance is real. Chemical only works for 1st-timers and even then 40% failure rate.",
      "£850 for heat is fair. Ask if landlord will cover — most do to keep tenant.",
      "Heat + steam + monitor. Belt and braces. Bed bugs above a takeaway = high re-infest risk from neighbours.",
      "Rentokil charge £1,400 for heat. You're competitively priced."
    ]
  }
];

// ─── 4. Insert posts ──────────────────────────────────────────────
const inserts = [];
for (const tpl of POSTS) {
  const author = pickAuthor(null, tpl.tradeHint);
  if (!author) continue;

  const hoursAgo = Math.floor(Math.random() * 168); // spread across last week
  inserts.push({ tpl, author, hoursAgo });
}

console.log(`Inserting ${inserts.length} chat posts…`);
const insertRows = inserts.map(({ tpl, author, hoursAgo }) => {
  const created = `NOW() - INTERVAL '${hoursAgo} hours'`;
  const expires = `NOW() + INTERVAL '14 days'`;
  // image_urls / video_urls are text[] on prod (later migration
  // changed from the jsonb DEFAULT declared in the base migration).
  const imagesArr = tpl.images
    ? `ARRAY[${tpl.images.map((u) => `'${esc(u)}'`).join(",")}]::text[]`
    : `ARRAY[]::text[]`;
  const videosArr = tpl.video
    ? `ARRAY['${esc(tpl.video)}']::text[]`
    : `ARRAY[]::text[]`;
  // Mood lives in metadata.mood (jsonb) — no schema change needed.
  const metadataJson = tpl.mood
    ? `'${JSON.stringify({ mood: tpl.mood }).replace(/'/g, "''")}'::jsonb`
    : `'{}'::jsonb`;
  return `(
    '${author.id}'::uuid,
    'chat',
    '${esc(author.primary_trade)}',
    '${esc(tpl.title)}',
    '${esc(tpl.body)}',
    'UK',
    ${tpl.region ? `'${esc(tpl.region)}'` : "NULL"},
    ${imagesArr},
    ${videosArr},
    ${metadataJson},
    ${created},
    ${expires}
  )`;
});

const postInsertRes = await sql(`
  INSERT INTO hammerex_trade_off_yard_posts
    (listing_id, kind, trade_slug, title, body, country, region, image_urls, video_urls, metadata, created_at, expires_at)
  VALUES ${insertRows.join(",\n")}
  RETURNING id, title;
`);
const postRows = postInsertRes[0]?.rows ?? postInsertRes;
console.log(`Inserted ${postRows.length} posts.`);

// Match returned IDs back to the templates (RETURNING preserves order).
const insertedById = postRows.map((r, i) => ({
  id: r.id,
  tpl: inserts[i].tpl,
  authorId: inserts[i].author.id
}));

// ─── 5. Insert comments (3-6 per post, from other demo trades) ────
const commentRows = [];
for (const post of insertedById) {
  for (const [i, body] of post.tpl.comments.entries()) {
    const commenter = pickAuthor(post.authorId);
    if (!commenter) continue;
    // Comments spread from post's created time forward
    const minutesAfter = 15 + i * (30 + Math.floor(Math.random() * 90));
    commentRows.push(
      `('${post.id}'::uuid, '${commenter.id}'::uuid, '${esc(body)}', NOW() - INTERVAL '${Math.max(0, 168 - minutesAfter / 60)} hours')`
    );
  }
}

console.log(`Inserting ${commentRows.length} comments…`);
const commentInsertRes = await sql(`
  INSERT INTO hammerex_yard_comments
    (post_id, author_listing_id, body, created_at)
  VALUES ${commentRows.join(",\n")}
  RETURNING id;
`);
const commentInserted = commentInsertRes[0]?.rows ?? commentInsertRes;
console.log(`Inserted ${commentInserted.length} comments.`);

// ─── 6. A few reactions on random posts ───────────────────────────
console.log("Adding reactions…");
const reactionRows = [];
for (const post of insertedById) {
  const reactors = [];
  const count = 1 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const r = pickAuthor(post.authorId);
    if (r && !reactors.includes(r.id)) reactors.push(r.id);
  }
  for (const rid of reactors) {
    reactionRows.push(
      `('${post.id}'::uuid, '${rid}'::uuid, '${Math.random() > 0.15 ? "like" : "dislike"}')`
    );
  }
}

if (reactionRows.length) {
  await sql(`
    INSERT INTO hammerex_trade_off_yard_post_reactions
      (post_id, listing_id, kind)
    VALUES ${reactionRows.join(",\n")}
    ON CONFLICT DO NOTHING;
  `);
  console.log(`Attempted ${reactionRows.length} reactions.`);
}

console.log("Done. Refresh /trade-off/yard to see the mock chat feed.");
