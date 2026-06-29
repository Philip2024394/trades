// scripts/seed-product-reviews.mjs
//
// Seed per-product (and Charlotte's per-priced-service) reviews on the
// three merchant case studies that have a shopfront / priced offerings:
//
//   1. Stuart Kingsley (Building Merchant — Hull) — products
//   2. Rebecca Fawcett (Tool Hire — Derby)         — products
//   3. Charlotte Pemberton (Kitchen Manufacturer — Bath) — priced_services
//
// For Stuart + Rebecca every row gets `product_id` set so the
// ProductReviewsBlock on the per-product PDP renders them. Charlotte has
// no rows in hammerex_xrated_products (she lists priced_services on the
// listing record) — her reviews are seeded listing-level with
// service_name matching each priced_service entry, no product_id.
//
// Idempotent: customer_email tag `customer-product-<slug>-<n>@example.com`
// detects existing seeded rows and skips them on rerun.
//
// Run: node scripts/seed-product-reviews.mjs

import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.tools.local");
const TOKEN = tokenMatch[1].trim();
const REF = "msdonkkechxzgagyguoe";

async function query(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Supabase ${r.status}: ${txt}`);
  }
  return r.json();
}

function esc(s) {
  if (s === null || s === undefined) return "NULL";
  if (typeof s === "number") return s.toString();
  if (typeof s === "boolean") return s ? "true" : "false";
  return "'" + String(s).replace(/'/g, "''") + "'";
}

// Avatar index: 100-200 to avoid collision with seed-case-studies (14-99)
// and seed-demo-trades (1-90).
let avatarCursor = 100;
function nextAvatar(gender) {
  const n = avatarCursor++;
  if (avatarCursor > 199) avatarCursor = 100;
  return `https://randomuser.me/api/portraits/${gender}/${n}.jpg`;
}

// Customer email tag — identifiable later and dedupable per (productId, n)
// or per (listingId+slug, n) for priced services.
function customerEmail(key, n) {
  return `customer-product-${key}-${n}@example.com`;
}

// Spread `goes_live_at` over the last 6 months. Caller supplies a seed
// integer per review so the spread is deterministic across reruns.
function daysAgo(n) {
  return `now() - interval '${n} days'`;
}

// ───────────────────────────────────────────────────────────────────────
// REVIEW LIBRARIES per merchant — product slug → list of review templates
// ───────────────────────────────────────────────────────────────────────
//
// Each item: { name, gender, rating, type, body, days }
// rating 4 or 5 only — overall + all 4 sub-ratings will use this number.
// type ∈ { new_build, renovation, repair }

const STUART_REVIEWS = {
  "concrete-block-100mm-7-3-n-mm-pack-of-80": [
    { name: "Trevor J.", gender: "men", rating: 5, type: "new_build", days: 18, body: "Two packs delivered to a footings job in Beverley first thing Tuesday. Blocks were the right strength grade, no shorts in the load, driver was sharp with the offloading. Cheaper per pack than the national chain I usually phone." },
    { name: "Karen O.", gender: "women", rating: 5, type: "new_build", days: 47, body: "Ordered 80 blocks Friday lunchtime for a Monday start on a side extension in Hessle. On site 8am Monday, no damaged corners, all stacked tidy on the pallet. Stuart's office knew exactly what I needed before I'd finished describing the job." },
    { name: "Phil G.", gender: "men", rating: 5, type: "new_build", days: 82, body: "Used these for the inner skin on a single-storey rear extension. Sat on the brickie's line cleanly, no warps. Price was £20 a pack under the merchant by the dock road." },
    { name: "Nicola S.", gender: "women", rating: 4, type: "renovation", days: 118, body: "Half pack short on the first delivery — phoned the office, they had the rest on the van out the next morning at no extra charge. Sorted it without drama. Blocks themselves are spot on." },
    { name: "Mark D.", gender: "men", rating: 5, type: "new_build", days: 156, body: "Footings pour for a garage in Anlaby. The blocks arrived banded properly, no chips off the corners from the forklift. Trade price stacks up against anyone in HU postcodes." },
    { name: "Helen R.", gender: "women", rating: 5, type: "new_build", days: 195, body: "Ran a small new-build inner-skin job needing two packs. Stuart's took the order on the phone, billed monthly to the account, no faff. Blocks consistent batch to batch." },
  ],
  "hanson-multicem-cement-25kg-pallet-of-56": [
    { name: "Aaron W.", gender: "men", rating: 5, type: "new_build", days: 14, body: "Pallet dropped Thursday morning for a Friday pour. Bags all in date, dry, no torn corners. Cheaper per pallet than ordering by the bag from the shed up the road." },
    { name: "Lisa B.", gender: "women", rating: 5, type: "new_build", days: 55, body: "Booked a pallet on the standing order for a fortnight's worth of mixing on a small build. Stuart's team chased the haulier when traffic on the A63 held them up — landed two hours late but they'd called ahead so I could shuffle the gang." },
    { name: "Trevor J.", gender: "men", rating: 5, type: "new_build", days: 89, body: "Multicem mixes nicely with our ballast and the bags are bone-dry off the pallet. Will keep coming back, the price is keen and the office picks up the phone." },
    { name: "Karen O.", gender: "women", rating: 4, type: "renovation", days: 126, body: "Last pallet had one bag with a small split — yard threw in a spare on the next delivery without arguing. That's how proper merchants behave. Will reorder." },
    { name: "Phil G.", gender: "men", rating: 5, type: "new_build", days: 162, body: "Used for the footings and the rising brickwork on a side extension in Cottingham. Setting time is consistent, no nasties in the mix. Pallet was wrapped tight against the wet." },
    { name: "Daniel L.", gender: "men", rating: 5, type: "new_build", days: 198, body: "Half pallet next-day on a phone order at 4pm. Yard team didn't blink. Cement was dry, banded, ready to go straight into the mixer." },
  ],
  "galvanised-roofing-joist-hanger-pack-50-hangers": [
    { name: "Sam H.", gender: "men", rating: 5, type: "new_build", days: 22, body: "Pack of fifty for a loft conversion in Hull — galvanising was clean, no rough edges round the nail holes, fit the timber I was hanging without bending the flanges. Decent kit." },
    { name: "Megan T.", gender: "women", rating: 5, type: "renovation", days: 68, body: "Needed hangers fast for a flat roof rebuild where the original spec turned up rusty. Stuart's had a pack on the shelf, picked them up by lunchtime. Same hanger as the ones we use on the bigger sites." },
    { name: "Robbie F.", gender: "men", rating: 5, type: "new_build", days: 104, body: "Ordered on the phone for a same-day collection. Pack was on the counter when I walked in. Galvanised coating is proper thick — won't rust through in a damp loft." },
    { name: "Janet C.", gender: "women", rating: 4, type: "new_build", days: 141, body: "Did the job on a single-storey rear extension. Hangers are standard spec, nothing fancy, but the price beat the big sheds and they had stock when nobody else did." },
    { name: "Lewis P.", gender: "men", rating: 5, type: "new_build", days: 177, body: "Building Control didn't bat an eye at these on the final sign-off. That's all you need from a joist hanger — sized right, marked properly, certificate behind it." },
  ],
  "tarmac-bulk-bag-ballast-mixed-20mm-to-dust": [
    { name: "Phil G.", gender: "men", rating: 5, type: "new_build", days: 11, body: "Bulk bag delivered on the moffett straight onto the slab in the back garden. Dry-ish mix considering the weather, plenty of fine in there for the screed. Reasonable rate." },
    { name: "Lauren H.", gender: "women", rating: 5, type: "new_build", days: 49, body: "Three bags for the footings on a granny annexe. Stuart's lorry parked up tight to the gate, no faff. Ballast mixed clean with the OPC, no clay lumps." },
    { name: "Daniel L.", gender: "men", rating: 5, type: "new_build", days: 86, body: "Mixed grade with a proper spread of stone size down to fines. Good for footings, oversite concrete and the base under a paving slab job all in one bag." },
    { name: "Helen R.", gender: "women", rating: 4, type: "renovation", days: 124, body: "Bag came slightly wet after a rainy night before delivery — yard explained the haulier had it sat overnight. Once spread out for an hour it mixed fine. Fair price for the volume." },
    { name: "Aaron W.", gender: "men", rating: 5, type: "new_build", days: 165, body: "Standing order — bulk bag every Monday for the duration of a small site. Stuart's team kept the rota without me having to phone every week." },
    { name: "Karen O.", gender: "women", rating: 5, type: "new_build", days: 201, body: "Ordered four bags for a driveway sub-base. Driver dropped them exactly where I wanted, no scuffed lawn, no overhanging wires hit. Drivers know what they're doing." },
  ],
  "celcon-standard-aircrete-block-pack-of-60": [
    { name: "Trevor J.", gender: "men", rating: 5, type: "new_build", days: 26, body: "Aircrete inner skin for an extension in Hedon. Light to handle, cut clean with the saw, brickie was happy with how they sat on the line. No shorts in the pack." },
    { name: "Janet C.", gender: "women", rating: 5, type: "renovation", days: 64, body: "Used for a single-storey kitchen extension. Sound insulation between the kitchen and the boiler cupboard is noticeably better than the heavy concrete blocks we used to spec. Glad I switched." },
    { name: "Sam H.", gender: "men", rating: 5, type: "new_build", days: 102, body: "Pack arrived banded properly, every block tight to its neighbour, no chips off the corners. Brickie laid 20 an hour comfortably. Decent product, decent price." },
    { name: "Megan T.", gender: "women", rating: 5, type: "new_build", days: 138, body: "Two packs for a new-build garage on a tight infill plot. Stuart's delivered with a forklift that could swing right onto the strip footings, saved an hour of barrowing." },
    { name: "Robbie F.", gender: "men", rating: 4, type: "new_build", days: 178, body: "Aircrete dust gets everywhere when you cut them but that's the block, not the merchant. Pack was tidy on the truck, price was right. Will reorder." },
    { name: "Lewis P.", gender: "men", rating: 5, type: "new_build", days: 215, body: "Standing order — two packs every fortnight for a six-week run. Stuart's office set up the schedule, billed monthly, never had to chase a delivery once." },
  ],
  "marshalls-600-600-paving-slab-pallet-of-60": [
    { name: "Greg P.", gender: "men", rating: 5, type: "renovation", days: 33, body: "Pallet for a front-garden patio in Anlaby. Slabs were colour-consistent across the pallet, no chips off the edges, sat true on the screed. Marshalls quality at a sensible trade rate." },
    { name: "Yasmin A.", gender: "women", rating: 5, type: "renovation", days: 72, body: "Stuart's delivered on the moffett right round the side return — couldn't have wheelbarrowed sixty slabs through the house, so that mattered. Driver knew what he was doing." },
    { name: "Conor F.", gender: "men", rating: 5, type: "new_build", days: 108, body: "Two pallets for a back garden patio with a step down. Slabs came in tight batches so the colour didn't lottery between them. Saved an hour of sorting on site." },
    { name: "Holly W.", gender: "women", rating: 4, type: "renovation", days: 145, body: "One slab had a corner chip from the haulage strap — yard sent a replacement with my next order without me having to push for it. Sensible response, will keep using them." },
    { name: "Adam K.", gender: "men", rating: 5, type: "renovation", days: 182, body: "Customer wanted the Marshalls Saxon range — Stuart's had them in stock when the big chain quoted three-week lead time. Pallet arrived the next morning, job done on schedule." },
    { name: "Sarah M.", gender: "women", rating: 5, type: "renovation", days: 219, body: "Decent paving at a fair price, on a pallet that didn't fall apart on the truck. Driver placed it where I asked, no faff. Honest yard." },
  ],
  "pir-insulation-board-100mm-pack-of-6-2400-1200": [
    { name: "Mark D.", gender: "men", rating: 5, type: "renovation", days: 17, body: "Bought 8 boards for a flat roof in Beverley. Cut clean, fit tight, no cold spots come November. Foil facing was perfect for the membrane to sit on. Will reorder." },
    { name: "Helen R.", gender: "women", rating: 5, type: "renovation", days: 58, body: "Six 100mm boards for a warm pitched roof. Stuart's were £30 a pack under the merchant I used to use in Hull centre. Same Celotex spec, faster delivery." },
    { name: "Aaron W.", gender: "men", rating: 5, type: "new_build", days: 95, body: "PIR for a loft conversion — taping the joints between the boards was easy because the cut was true. Spec was exactly what the architect specified." },
    { name: "Karen O.", gender: "women", rating: 5, type: "renovation", days: 132, body: "Pack delivered next morning on a phone order at 3pm. Boards bundled properly so they didn't flex in transit. Foil intact on every face. That's what trade pricing should buy you." },
    { name: "Phil G.", gender: "men", rating: 4, type: "renovation", days: 168, body: "First pack was a few days late — Stuart's office phoned me before I phoned them, explained the haulier's issue, gave me a credit on the next order. Sorted it like grown-ups." },
    { name: "Daniel L.", gender: "men", rating: 5, type: "renovation", days: 205, body: "Sorted my replacement quickly when one board came damaged. Customer service answered the phone first ring. That's why I keep coming back instead of using the big sheds." },
    { name: "Sarah M.", gender: "women", rating: 5, type: "new_build", days: 240, body: "Spec'd 100mm rigid PIR for a side extension cold roof — Stuart's matched the U-value calc the architect wanted without me having to argue. Boards landed the morning the roofer started." },
  ],
  "dpc-damp-proof-course-112-5mm-30m-roll": [
    { name: "Trevor J.", gender: "men", rating: 5, type: "new_build", days: 19, body: "Roll arrived flat, no kinks, no perished edges — the thirty metres was the full thirty, not the eighteen-and-a-bit you sometimes get from cheap stock. Sat into the bed neatly." },
    { name: "Janet C.", gender: "women", rating: 5, type: "new_build", days: 61, body: "Picked up two rolls at the trade counter — no minimum order grief, in and out in five minutes. Reasonable price for a brand-name DPC." },
    { name: "Sam H.", gender: "men", rating: 5, type: "new_build", days: 98, body: "Used round a new-build cavity wall — sat clean against the mortar, didn't tear when the brickie pulled it tight. Decent gauge of polythene, not the thin rubbish." },
    { name: "Megan T.", gender: "women", rating: 4, type: "renovation", days: 134, body: "First roll had a fold mark down one face — yard swapped it for a fresh roll on the same visit, no fuss. Honest counter staff." },
    { name: "Robbie F.", gender: "men", rating: 5, type: "new_build", days: 170, body: "Standing item on my account — Stuart's always have stock when I phone, never had to wait. The kind of merchant you build a routine round." },
    { name: "Lewis P.", gender: "men", rating: 5, type: "renovation", days: 207, body: "Needed three rolls on short notice for a row of houses being underpinned and re-coursed. Office found them in the back yard within ten minutes of me phoning." },
  ],
};

const REBECCA_REVIEWS = {
  "hilti-te-30-a36-cordless-sds-plus-drill-1-day-hire": [
    { name: "Greg P.", gender: "men", rating: 5, type: "renovation", days: 14, body: "Hired the TE30 for a day knocking off old tiles and drilling deep into a brick chimney breast for a flue liner. Battery lasted the day with a spare, drill is night-and-day faster than my own SDS. Picked up Monday, back Tuesday morning, no fuss." },
    { name: "Yasmin A.", gender: "women", rating: 5, type: "renovation", days: 47, body: "First time hiring an SDS — Rebecca's counter walked me through the chuck change and which bit suited the wall I was drilling. Got the kit, did the job, returned it clean. The quote came through clean and the invoice matched. No upsell, just the right tool." },
    { name: "Conor F.", gender: "men", rating: 5, type: "renovation", days: 89, body: "Day rate is sharp for a Hilti — cheaper than the chain hire shop and the kit's in proper order, not battered. Two fresh batteries, charger, full case. That's what hire should be." },
    { name: "Holly W.", gender: "women", rating: 5, type: "repair", days: 124, body: "Needed it for one heavy drilling job — old wall plug needed punching out before re-fixing a handrail. Picked it up at 8am, back by 11. Pro-rata charge was honest, not the full day." },
    { name: "Tom B.", gender: "men", rating: 4, type: "renovation", days: 162, body: "Account customer here — Rebecca's yard is the only place I hire from now. Quick on the phone, the kit's always in good order. Battery was a touch tired on this one, swapped it without an argument when I rang." },
    { name: "Sarah M.", gender: "women", rating: 5, type: "renovation", days: 198, body: "Hired the TE30 for a kitchen refit — old anchor bolts in the floor had to come out before the new units went in. Did the job in an afternoon. Honest, simple hire." },
  ],
  "festool-domino-df500-set-1-day-hire": [
    { name: "Lauren H.", gender: "women", rating: 5, type: "renovation", days: 22, body: "Domino for a built-in wardrobe carcass — set of tenons across two panels, dead aligned every time. Faster than dowelling, neater than biscuits. Hired for a day, did the lot." },
    { name: "Adam K.", gender: "men", rating: 5, type: "renovation", days: 58, body: "Rebecca had the DF500 ready to collect with a fresh case of tenons in three sizes. Saved me buying the tool just for one job. Returned it the same evening — got the half-day rate. Fair." },
    { name: "Tom B.", gender: "men", rating: 5, type: "new_build", days: 95, body: "Site cabinetry job — Domino made the box construction in a third of the time it would have taken with screws and plugs. Festool kit was clean, no missing parts in the systainer." },
    { name: "Holly W.", gender: "women", rating: 5, type: "renovation", days: 133, body: "Had never used a Domino before — Rebecca's team showed me how to set the cutter depth and the fence height on the counter. Walked out confident, made my joints, returned the kit happy." },
    { name: "Conor F.", gender: "men", rating: 4, type: "new_build", days: 174, body: "Hired this for a study fit-out. Tool itself is faultless — the only minor was the dust extractor connector needed a wipe down on collection. Counter team saw it before I did and grabbed a clean one." },
    { name: "Yasmin A.", gender: "women", rating: 5, type: "renovation", days: 212, body: "Day hire saved me about £900 over buying the tool for a one-off job. That's the value of a proper hire yard — and Rebecca's range goes beyond just the diggers." },
  ],
  "bosch-gbh-18v-26-sds-plus-gsb-18v-drill-twin-pack-1-day": [
    { name: "Adam K.", gender: "men", rating: 5, type: "renovation", days: 18, body: "Hired the twin pack for a day on a kitchen refit — combi for the screws into the units, SDS for the masonry anchors into the back wall. Two batteries and a charger, all charged on collection. No surprise charges." },
    { name: "Sarah M.", gender: "women", rating: 5, type: "renovation", days: 52, body: "Picked up the twin pack at 4pm Friday, back Monday morning — paid the weekend rate, not three days. Rebecca's prices are straight. Both drills ran fine, no faff." },
    { name: "Greg P.", gender: "men", rating: 5, type: "new_build", days: 88, body: "Decent kit, no missing chucks or bit holders. Bosch 18V system means one charger does both — the combi for the screws, the SDS for the anchors. Did a full day of drilling no problem." },
    { name: "Lauren H.", gender: "women", rating: 5, type: "renovation", days: 125, body: "Hired for a single day to put up the new garage door tracks. Both tools were straight out of the case, batteries full. Returned, paid, done. Honest hire." },
    { name: "Tom B.", gender: "men", rating: 4, type: "renovation", days: 161, body: "Combi battery was at about 80% on collection, not 100% — minor but worth flagging. Rebecca's counter swapped it for a fully charged one when I phoned. That's the kind of fix you want from a hire yard." },
    { name: "Conor F.", gender: "men", rating: 5, type: "new_build", days: 198, body: "Twin pack is the right hire for any day where you're doing a mix of masonry and timber. Saves swapping batteries between systems. Rebecca's stock both 18V Bosch and 18V DeWalt so you can match what you already own." },
    { name: "Holly W.", gender: "women", rating: 5, type: "renovation", days: 234, body: "Repeat customer at this point — Rebecca's team know me by name now. Twin pack for a kitchen install yet again. In, out, fair price." },
  ],
  "stihl-ms-261-petrol-chainsaw-1-day-hire": [
    { name: "Conor F.", gender: "men", rating: 5, type: "renovation", days: 24, body: "Big sycamore down the back garden after the storm — hired the MS-261 for a day, dropped the trunk and limbed it out before lunch. Chain was sharp, bar oil was topped up, fuel can included." },
    { name: "Adam K.", gender: "men", rating: 5, type: "renovation", days: 62, body: "Rebecca's team checked I'd handled a chainsaw before and offered ear defenders, chaps and a helmet bundle as an add-on. Sensible. Returned the saw clean, no quibble on the deposit." },
    { name: "Greg P.", gender: "men", rating: 5, type: "renovation", days: 102, body: "MS-261 starts on the second pull every time, runs sweet. Decent kit, looked after. Day rate is sharp considering what a new one costs to buy." },
    { name: "Lauren H.", gender: "women", rating: 4, type: "renovation", days: 138, body: "Chain needed a quick re-tension after the first hour but that's normal on any saw, not Rebecca's fault. Job done by 4pm, returned, paid. Will hire again next season." },
    { name: "Yasmin A.", gender: "women", rating: 5, type: "renovation", days: 174, body: "Weekend hire to clear an overgrown hedge that had gone to small trees. Picked up Saturday, back Monday — paid two days, not three. Honest weekend pricing." },
    { name: "Sarah M.", gender: "women", rating: 5, type: "renovation", days: 212, body: "Hired with the felling wedge add-on for a couple of trees on a customer's plot. Rebecca's team explained the wedge technique on the counter — first time using one. Worked a treat." },
  ],
  "honda-eu22i-inverter-generator-2-2kw-1-day": [
    { name: "Tom B.", gender: "men", rating: 5, type: "new_build", days: 16, body: "Hired the EU22i for a wedding marquee in the garden — ran the lights, a couple of warmers and the PA all night without missing a beat. Quiet enough that you could hear the music over the genny." },
    { name: "Holly W.", gender: "women", rating: 5, type: "new_build", days: 54, body: "Site with no mains yet — hired this for a day to run the SDS and the site lights. Petrol came topped up, owner's manual in the case. Didn't have to fiddle with anything." },
    { name: "Greg P.", gender: "men", rating: 5, type: "new_build", days: 91, body: "Honda EU22i is the gold standard for small site work — silent, sips fuel, doesn't trip on inductive loads. Rebecca's day rate is half what the chain hires it for." },
    { name: "Lauren H.", gender: "women", rating: 5, type: "renovation", days: 128, body: "Power cut took out the workshop on a Saturday — hired the EU22i to keep the freezer and a couple of fans running until Monday. Saved me a freezer's worth of stock." },
    { name: "Conor F.", gender: "men", rating: 4, type: "new_build", days: 165, body: "Generator was great — fuel can on the day was nearly empty though, so I had to fetch fresh petrol. Minor but worth flagging. Rebecca's team apologised and credited me a tenner." },
    { name: "Adam K.", gender: "men", rating: 5, type: "new_build", days: 203, body: "Hired for a one-day off-grid job in the Peak District. Inverter output is clean enough for a laptop and a circular saw on the same circuit. Honda quality, honest hire." },
  ],
  "belle-pcx-13-40-plate-compactor-1-day-hire": [
    { name: "Adam K.", gender: "men", rating: 5, type: "renovation", days: 21, body: "Phoned Rebecca on the Friday for a wacker plate for the weekend — picked it up at 4pm, back on Monday morning, all sorted. She talked me out of the bigger plate I asked for because for my patio sub-base the smaller one was actually right. Saved me money." },
    { name: "Holly W.", gender: "women", rating: 5, type: "renovation", days: 59, body: "First time I'd hired a wacker — Rebecca's team walked me through the throttle and the safety stop without making me feel daft. Came back to a fair invoice. Will definitely go back when the next garden project starts." },
    { name: "Conor F.", gender: "men", rating: 5, type: "new_build", days: 96, body: "Belle PCX is plenty for a domestic driveway sub-base — Rebecca didn't try to push me onto the bigger pedestrian roller. Honest yard. Compactor ran like new, day rate was fair." },
    { name: "Sarah M.", gender: "women", rating: 5, type: "renovation", days: 134, body: "Hired for two days on a back-garden paving job. Picked up Friday morning, back Sunday evening — paid the weekend rate. Plate compacted the MOT type 1 properly, no settlement come spring." },
    { name: "Greg P.", gender: "men", rating: 5, type: "new_build", days: 171, body: "Reliable little plate — started first pull both days, vibration was strong enough for the depth of sub-base I was compacting. Counter team threw in a pair of ear defenders without asking." },
    { name: "Lauren H.", gender: "women", rating: 4, type: "renovation", days: 209, body: "Plate had a bit of dried sand stuck round the base on collection — Rebecca's team apologised, knocked a fiver off. Job did fine. Honest mistake, honest response." },
  ],
  "avant-528-mini-loader-self-drive-1-day-hire": [
    { name: "Tom B.", gender: "men", rating: 5, type: "new_build", days: 27, body: "Hired the Avant for a day to shift a tonne of muck round the back of a tight site — wouldn't have got a digger or even a barrow round there. Saved an hour of grafting. Rebecca's drivers delivered on the trailer and showed me the controls before they left." },
    { name: "Yasmin A.", gender: "women", rating: 5, type: "renovation", days: 64, body: "Day rate is sharp for a self-drive loader. Rebecca's machine was clean, fuelled, all attachments accounted for. Walk-around video on the keyring app meant I knew what condition to return it in. Honest." },
    { name: "Greg P.", gender: "men", rating: 5, type: "new_build", days: 102, body: "Avant 528 fits through a 1.2m gateway with the wings folded — for back gardens that's a massive deal. Hired for landscaping a back-of-terrace project. Saved a week of barrowing." },
    { name: "Holly W.", gender: "women", rating: 5, type: "renovation", days: 141, body: "Rebecca's team trailered it to site, demoed the controls on arrival, came back at the agreed time. Day went exactly to plan. No surprises on the invoice." },
    { name: "Adam K.", gender: "men", rating: 4, type: "new_build", days: 178, body: "Mini-dumper had a flat battery on collection — yard sorted it in 20 minutes — barely lost any time. Avant itself was perfect, did the job in a day." },
    { name: "Sarah M.", gender: "women", rating: 5, type: "renovation", days: 215, body: "Hired the Avant + pallet forks combo for a day moving sleepers round a back garden. Saved my back and saved a day's labour. Rebecca's the only yard in Derby I'd trust on the Avant — kit's looked after." },
  ],
  "mobile-scaffold-tower-6m-7-day-hire": [
    { name: "Conor F.", gender: "men", rating: 5, type: "renovation", days: 31, body: "Six-metre tower for a fascia replacement on a two-storey semi. Picked up on the Saturday, back the following Friday — full week, no overtime charge. Tower came complete with stabilisers and toeboards." },
    { name: "Sarah M.", gender: "women", rating: 5, type: "renovation", days: 68, body: "Week-long hire for re-pointing a chimney stack. Rebecca's team trailered it round, helped wheel it through the side gate. All pieces accounted for, instruction sheet inside the diagonals." },
    { name: "Holly W.", gender: "women", rating: 5, type: "renovation", days: 105, body: "First time hiring a tower — Rebecca's team walked me through the safe build sequence on the yard before I left. Confidence to put it up properly is worth the hire on its own." },
    { name: "Tom B.", gender: "men", rating: 5, type: "renovation", days: 142, body: "Did a week of external repair work — soffit replacement, gutter renewal, exterior painting. Tower was solid, no rattle in the joints, levellers worked properly. Decent kit." },
    { name: "Lauren H.", gender: "women", rating: 4, type: "renovation", days: 179, body: "Hire week ran into the following Monday because of the weather — Rebecca's team didn't charge me the extra day, just rolled the return over. That's a yard that understands the trade." },
    { name: "Greg P.", gender: "men", rating: 5, type: "renovation", days: 218, body: "Six metres got me onto the eaves of a 1930s semi with room to work. Tower didn't sway, deck plates were tight, the kit's clearly maintained. Will hire again for the matching house next door." },
  ],
};

const CHARLOTTE_REVIEWS = {
  // priced_service.name as key
  "Bespoke in-frame painted kitchen (medium 6-8m run)": [
    { name: "Beatrice H.", gender: "women", rating: 5, type: "renovation", days: 26, body: "Charlotte built our seven-metre in-frame kitchen for a Bath townhouse — twelve weeks from sign-off to install, paint colour matched to a Mylands swatch we chose at the workshop. Drawers are dovetailed, doors are solid tulipwood, you can feel the difference between this and a unit-shop kitchen." },
    { name: "George F.", gender: "men", rating: 5, type: "renovation", days: 72, body: "In-frame shaker came out flawless. Charlotte coordinated the install with our builder, took three tidy days. Painted finish is solid — no chips after six months of heavy use. Worth the wait." },
    { name: "Isabella M.", gender: "women", rating: 5, type: "renovation", days: 118, body: "Twelve-week lead time but worth every day. Charlotte was honest about that from the first meeting. Quote came through fully itemised — door style, paint, hardware, lead time all written down. Final invoice matched to the penny." },
    { name: "Henry T.", gender: "men", rating: 5, type: "renovation", days: 164, body: "Six-metre in-frame run for a Georgian townhouse in Widcombe. Charlotte's install team were the same people who built it in the workshop — no handover to a fitter who doesn't know the cabinets. Felt that quality at every step." },
    { name: "Amelia N.", gender: "women", rating: 5, type: "renovation", days: 210, body: "We had three other quotes from local makers — Charlotte's was the most honest about lead time and the only one that itemised the paint spec and the runner brand. Two years on, drawers still soft-close like new." },
  ],
  "Bespoke shaker kitchen (medium 6-8m run)": [
    { name: "Edward L.", gender: "men", rating: 5, type: "new_build", days: 22, body: "Shaker for a new-build cottage in Frome — wanted something timeless not the gloss-flatpack everyone else was putting in. Charlotte's quote was honest, lead time held to the day, install was three days clean." },
    { name: "Florence K.", gender: "women", rating: 5, type: "renovation", days: 65, body: "Replaced a tired flat-pack with one of Charlotte's shaker designs. She came out, measured, sent a properly itemised quote with door style, paint, hardware, lead time written down. No surprises." },
    { name: "Oliver R.", gender: "men", rating: 4, type: "renovation", days: 109, body: "Standard 7m shaker — Charlotte recommended a slightly off-white Mylands colour over the brilliant white I'd initially asked for, said it would age better. She was right. Two years in, no chips, no yellowing." },
    { name: "Lucy P.", gender: "women", rating: 5, type: "renovation", days: 155, body: "Six-metre shaker run for a Bath flat — Charlotte fitted to the inch round a chimney breast and an awkward bay window. Bespoke means it actually fits the wall, not the other way round. Beautiful work." },
    { name: "Rupert C.", gender: "men", rating: 5, type: "renovation", days: 201, body: "Painted shaker doors in a deep navy Mylands — Charlotte talked me through which paint sheen would wear best in a busy family kitchen. Picked eggshell, two years on it still wipes clean and looks fresh." },
  ],
  "Large bespoke in-frame kitchen (10m+ with island)": [
    { name: "Theodora S.", gender: "women", rating: 5, type: "renovation", days: 18, body: "Twelve-metre in-frame with island and a separate larder — Charlotte was honest about the twelve-week lead time from the first call, and didn't promise anything she couldn't deliver. The finish on the painted in-frame is gorgeous." },
    { name: "Sebastian G.", gender: "men", rating: 5, type: "new_build", days: 58, body: "Large island kitchen for a new-build in Wells. Spec we agreed at quote was what arrived on the truck — solid tulipwood doors, Blum Movento runners, dovetailed oak drawers. Three-day install by Charlotte's own team." },
    { name: "Penelope V.", gender: "women", rating: 5, type: "renovation", days: 102, body: "Bath Georgian renovation — Charlotte's in-frame kitchen anchored the whole ground floor. Lead time was held to within two days of the original date. Genuinely beautiful work, you only notice the details when you start opening drawers." },
    { name: "Marcus E.", gender: "men", rating: 5, type: "renovation", days: 148, body: "10m run with island for a family home — Charlotte designed three workable triangles round the island so two people can cook without dancing round each other. Practical design, beautiful build." },
    { name: "Cordelia W.", gender: "women", rating: 5, type: "renovation", days: 192, body: "Big project, big island, full bespoke. Charlotte coordinated the timber finish on the island top with the painted cabinets so they sit together naturally. Worth every week of the wait." },
  ],
  "Bespoke utility room": [
    { name: "Imogen B.", gender: "women", rating: 5, type: "renovation", days: 14, body: "Did the kitchen and a matching utility room. Charlotte coordinated both so the paint colour and door style matched exactly. Drawers are heavy, soft-close, you can feel the difference between a real bespoke piece and a unit shop kitchen." },
    { name: "Frederick O.", gender: "men", rating: 5, type: "new_build", days: 52, body: "Matching cabinetry for a boot room and the main kitchen. Charlotte's workshop built both in the same paint batch so the colour matches dead on. Install crew (her own people) were tidy, on time, and snags were sorted in a single return visit." },
    { name: "Annabelle T.", gender: "women", rating: 5, type: "renovation", days: 95, body: "Bradford-on-Avon boot room — Charlotte's team built the matching cabinets in the same Mylands paint batch as our kitchen from two years earlier. Colour-matched perfectly. That's craftsmanship." },
    { name: "Hugo D.", gender: "men", rating: 5, type: "renovation", days: 138, body: "Utility room with butler sink housing and a broom cupboard — Charlotte designed round a tight 2.4m wall with an awkward boiler position. Looks like it was always meant to be there." },
    { name: "Beatrix L.", gender: "women", rating: 5, type: "renovation", days: 184, body: "Bespoke utility to match a five-year-old Pemberton kitchen — Charlotte's workshop still had the paint code on file. Colour matched on first coat. That's the value of going with a real maker, not a unit-shop." },
  ],
  "Single bespoke dresser or larder unit": [
    { name: "Eleanor J.", gender: "women", rating: 5, type: "renovation", days: 30, body: "Standalone glazed dresser to fit between two chimney breasts — Charlotte measured, drew it up, six-week lead time, install was a single afternoon. Solid tulipwood, hand-painted, dovetailed drawers. Sits perfectly." },
    { name: "Augustus H.", gender: "men", rating: 5, type: "renovation", days: 78, body: "Full-height larder for a Wells cottage kitchen. Charlotte specified internal racks, soft-close pull-outs and an integral worktop spice shelf. Considered piece, properly made." },
    { name: "Harriet M.", gender: "women", rating: 4, type: "renovation", days: 125, body: "Pantry cupboard for an existing kitchen — Charlotte matched the paint colour to a paint sample we sent her. Slight tonal mismatch in certain light but corrected on a return visit. Honest response to a small problem." },
    { name: "Charles W.", gender: "men", rating: 5, type: "new_build", days: 172, body: "Freestanding dresser as a feature piece in a dining room — Charlotte designed it like a proper piece of furniture, not a flat-pack cabinet on legs. Detailing on the cornice and the bun feet is beautiful." },
    { name: "Genevieve P.", gender: "women", rating: 5, type: "renovation", days: 215, body: "Larder unit fitted into an awkward corner where no flat-pack would have worked. Charlotte's workshop drew it round the wonky wall and the sloped floor. That's what bespoke is for." },
  ],
  "Workshop visit and design consultation": [
    { name: "Tobias Y.", gender: "men", rating: 5, type: "renovation", days: 11, body: "Two hours at Charlotte's Bath workshop looking at sample doors, paint finishes and hardware. She took our floor plan, sketched a CAD layout in front of us, and explained which compromises were worth making. £250 refunded against the deposit when we proceeded." },
    { name: "Esme G.", gender: "women", rating: 5, type: "renovation", days: 48, body: "Worth every penny just for the design conversation — Charlotte spotted three things on our drawings the architect had got slightly wrong for kitchen workflow. Saved us a fortune in change orders later." },
    { name: "Reuben A.", gender: "men", rating: 5, type: "new_build", days: 92, body: "Visited the workshop, met the team, saw the timber stocks and the paint room. Confidence-inspiring — you can see this isn't a sales showroom hiding a factory in China. Real makers, real workshop." },
    { name: "Sophia E.", gender: "women", rating: 5, type: "renovation", days: 142, body: "Charlotte's two-hour studio visit gave us more useful advice than four other 'free' kitchen consultations combined. Sample doors to handle, paint chips under different lights, runner brands explained. Booked her on the spot." },
    { name: "Quentin H.", gender: "men", rating: 4, type: "renovation", days: 188, body: "Useful consultation — Charlotte was upfront that our budget was a bit tight for the in-frame range and steered us to shaker without making it feel like a downsell. Honest advice." },
  ],
};

// ───────────────────────────────────────────────────────────────────────
// Run
// ───────────────────────────────────────────────────────────────────────

async function getListing(slug) {
  const rows = await query(
    `SELECT id, slug, priced_services FROM hammerex_trade_off_listings WHERE slug=${esc(slug)};`
  );
  return rows[0];
}

async function getProducts(listingId) {
  return await query(
    `SELECT id, name, slug FROM hammerex_xrated_products WHERE listing_id=${esc(listingId)} ORDER BY sort_order, name;`
  );
}

async function existingProductReviewCount(productId) {
  const rows = await query(
    `SELECT COUNT(*)::int AS n FROM hammerex_xrated_reviews WHERE product_id=${esc(productId)};`
  );
  return rows[0]?.n ?? 0;
}

async function existingServiceReviewCountForMember(listingId, serviceName) {
  // Count reviews seeded by THIS script (identified by customer_email tag)
  const rows = await query(
    `SELECT COUNT(*)::int AS n FROM hammerex_xrated_reviews
      WHERE listing_id=${esc(listingId)}
        AND product_id IS NULL
        AND service_name=${esc(serviceName)}
        AND customer_email LIKE 'customer-product-%';`
  );
  return rows[0]?.n ?? 0;
}

async function insertReview({ listingId, productId, serviceName, key, idx, r }) {
  const goesLive = daysAgo(r.days);
  const avatar = nextAvatar(r.gender);
  const sql = `
    INSERT INTO hammerex_xrated_reviews (
      listing_id, product_id,
      customer_name, customer_email, customer_avatar_url,
      project_type, service_name,
      overall_rating, workmanship_rating, communication_rating,
      value_rating, timeliness_rating,
      body, status, submitted_at, goes_live_at
    ) VALUES (
      ${esc(listingId)}, ${productId ? esc(productId) : "NULL"},
      ${esc(r.name)}, ${esc(customerEmail(key, idx + 1))}, ${esc(avatar)},
      ${esc(r.type)}, ${esc(serviceName)},
      ${r.rating}, ${r.rating}, ${r.rating}, ${r.rating}, ${r.rating},
      ${esc(r.body)},
      'live',
      ${goesLive},
      ${goesLive}
    );
  `;
  await query(sql);
}

const report = {
  stuart: { products: 0, reviewsSeeded: 0, productsSkipped: 0 },
  rebecca: { products: 0, reviewsSeeded: 0, productsSkipped: 0 },
  charlotte: { services: 0, reviewsSeeded: 0, servicesSkipped: 0, mode: "priced_services" },
};

// Stuart Kingsley
{
  console.log("\n=== Stuart Kingsley — Building Merchant (Hull) ===");
  const listing = await getListing("demo-stuart-kingsley-building-merchant-hull");
  const products = await getProducts(listing.id);
  report.stuart.products = products.length;
  for (const p of products) {
    const reviews = STUART_REVIEWS[p.slug];
    if (!reviews) {
      console.log(`  SKIP (no reviews defined): ${p.slug}`);
      report.stuart.productsSkipped++;
      continue;
    }
    const existing = await existingProductReviewCount(p.id);
    if (existing > 0) {
      console.log(`  SKIP (${existing} reviews exist): ${p.name}`);
      report.stuart.productsSkipped++;
      continue;
    }
    for (let i = 0; i < reviews.length; i++) {
      await insertReview({
        listingId: listing.id,
        productId: p.id,
        serviceName: p.name,
        key: `stuart-${p.slug}`,
        idx: i,
        r: reviews[i],
      });
      report.stuart.reviewsSeeded++;
    }
    console.log(`  +${reviews.length} reviews → ${p.name}`);
  }
}

// Rebecca Fawcett
{
  console.log("\n=== Rebecca Fawcett — Tool Hire (Derby) ===");
  const listing = await getListing("demo-rebecca-fawcett-tool-hire-derby");
  const products = await getProducts(listing.id);
  report.rebecca.products = products.length;
  for (const p of products) {
    const reviews = REBECCA_REVIEWS[p.slug];
    if (!reviews) {
      console.log(`  SKIP (no reviews defined): ${p.slug}`);
      report.rebecca.productsSkipped++;
      continue;
    }
    const existing = await existingProductReviewCount(p.id);
    if (existing > 0) {
      console.log(`  SKIP (${existing} reviews exist): ${p.name}`);
      report.rebecca.productsSkipped++;
      continue;
    }
    for (let i = 0; i < reviews.length; i++) {
      await insertReview({
        listingId: listing.id,
        productId: p.id,
        serviceName: p.name,
        key: `rebecca-${p.slug}`,
        idx: i,
        r: reviews[i],
      });
      report.rebecca.reviewsSeeded++;
    }
    console.log(`  +${reviews.length} reviews → ${p.name}`);
  }
}

// Charlotte Pemberton — no products, fall back to priced_services
{
  console.log("\n=== Charlotte Pemberton — Kitchen Manufacturer (Bath) ===");
  console.log("  (no products in hammerex_xrated_products — using priced_services fallback)");
  const listing = await getListing("demo-charlotte-pemberton-kitchen-manufacturer-bath");
  const services = listing.priced_services || [];
  report.charlotte.services = services.length;
  for (const svc of services) {
    const reviews = CHARLOTTE_REVIEWS[svc.name];
    if (!reviews) {
      console.log(`  SKIP (no reviews defined): ${svc.name}`);
      report.charlotte.servicesSkipped++;
      continue;
    }
    const existing = await existingServiceReviewCountForMember(listing.id, svc.name);
    if (existing > 0) {
      console.log(`  SKIP (${existing} script-seeded reviews exist): ${svc.name}`);
      report.charlotte.servicesSkipped++;
      continue;
    }
    const key = `charlotte-${svc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;
    for (let i = 0; i < reviews.length; i++) {
      await insertReview({
        listingId: listing.id,
        productId: null,
        serviceName: svc.name,
        key,
        idx: i,
        r: reviews[i],
      });
      report.charlotte.reviewsSeeded++;
    }
    console.log(`  +${reviews.length} reviews → ${svc.name}`);
  }
}

// Final count report — direct from the DB to confirm what's visible.
console.log("\n=== Final counts (direct DB query) ===");
for (const [merchant, slug] of [
  ["Stuart Kingsley", "demo-stuart-kingsley-building-merchant-hull"],
  ["Rebecca Fawcett", "demo-rebecca-fawcett-tool-hire-derby"],
  ["Charlotte Pemberton", "demo-charlotte-pemberton-kitchen-manufacturer-bath"],
]) {
  const rows = await query(`
    SELECT
      COUNT(*) FILTER (WHERE product_id IS NOT NULL)::int AS product_reviews,
      COUNT(*) FILTER (WHERE product_id IS NULL)::int AS listing_or_service_reviews,
      COUNT(*)::int AS total
    FROM hammerex_xrated_reviews
    WHERE listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug=${esc(slug)})
      AND status IN ('live','disputed');
  `);
  const r = rows[0];
  console.log(`  ${merchant}: ${r.product_reviews} product-level + ${r.listing_or_service_reviews} listing-level = ${r.total} total`);
}

console.log("\n=== Seed summary ===");
console.log(JSON.stringify(report, null, 2));
