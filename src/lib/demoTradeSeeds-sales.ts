// Demo profile seeds for Xrated Trade Off — UK 2026 — SALES additions (phase 2).
//
// These 17 entries cover catalogue + cart merchant businesses (timber yard,
// plumbing merchant, electrical wholesaler, showrooms, etc.). They follow the
// same DemoTradeSeed shape as `demoTradeSeeds.ts` but `priced_services` is
// repurposed as a PRODUCT line-item catalogue rather than labour services.
//
// Phone numbers use the Ofcom fiction range +44 7700 902XXX to stay clear of
// the labour-trade seeds.
// Avatar IDs use randomuser.me N=60-99 (fresh range — no clash with phase 1).
// Female-owned: paint-merchant, kitchen-showroom, tile-shop, door-showroom,
// bathroom-showroom, flooring-shop (6 of 17 ≈ 35%).

import type { DemoTradeSeed } from "./demoTradeSeeds";

export const DEMO_TRADE_SEEDS_SALES: DemoTradeSeed[] = [
  // 1. TIMBER MERCHANT
  {
    trade_slug: "timber-merchant",
    profile_slug: "demo-gareth-pritchard-timber-merchant-bristol",
    display_name: "Gareth Pritchard",
    trading_name: "Pritchard Timber & Sheet",
    city: "Bristol",
    postcode_prefix: "BS5",
    whatsapp: "+44 7700 902101",
    email: "trade@pritchardtimber.co.uk",
    bio: "Pritchard Timber has been on the same yard in St Philip's since 1998 — I took it on from my old man in 2015. We stock around 1,400 lines of sawn and planed softwood, hardwoods, decking, mouldings, sheet materials and engineered timber. Everything structural is PEFC chain-of-custody and kiln-dried to a stable moisture content — no soaking-wet C16 dumped off a flatbed here. We run two box vans and a Hiab for pallet drops across BS, BA and parts of GL. Free delivery within 10 miles on trade orders over £100. Trade accounts open same day if your VAT number checks out, 30-day terms after a quick credit check. Counter staff are joiners and chippies by background — bring a sketch or a photo and we'll match the spec. We're independent, we don't play tier-pricing games, and our trade list is transparent.",
    years_in_trade: 28,
    start_year: 1998,
    priced_services: [
      { name: "C24 4x2 kiln-dried softwood (per linear m)", price: 2.85, unit: "per linear m", description: "Structural softwood, PEFC certified, kiln-dried to 18-20%. Trade price ex VAT. Stocked in 2.4m to 4.8m lengths." },
      { name: "C16 3x2 carcassing (per linear m)", price: 1.65, unit: "per linear m", description: "Standard carcassing softwood for partition studs and noggins. PEFC, 2.4-4.8m lengths." },
      { name: "PAR redwood skirting 19x119 torus (per linear m)", price: 4.20, unit: "per linear m", description: "Planed all round Scandinavian redwood, torus profile, ready to prime. Per linear metre ex VAT." },
      { name: "Siberian larch decking 28x145 (per linear m)", price: 8.50, unit: "per linear m", description: "Premium Siberian larch, smooth/reeded reversible profile. Naturally durable Class 3. Per linear m." },
      { name: "OSB3 18mm 2440x1220 sheet", price: 36, unit: "per item", description: "Tongue-and-groove OSB3 structural sheet, EN300 graded. Per 8x4 sheet, trade price ex VAT." },
      { name: "WBP plywood 18mm hardwood-faced", price: 58, unit: "per item", description: "B/BB grade hardwood-faced WBP ply, 2440x1220x18mm. Per sheet, ex VAT." },
      { name: "Engineered I-joist 240mm (per linear m)", price: 14.50, unit: "per linear m", description: "James Jones JJI joists, 240mm depth, span tables on request. Per linear m, ex VAT." },
      { name: "Free delivery (orders over £100, within 10 miles)", price: 0, unit: "fixed", description: "Free same-day or next-day delivery for trade orders over £100 net within 10 miles of BS5. Box van or Hiab as needed." }
    ],
    faq_items: [
      { q: "Is your structural timber PEFC certified?", a: "Yes — every length of C16, C24 and engineered joist is PEFC chain-of-custody. We can supply the certificate for Building Control sign-off without a fuss." },
      { q: "Will you cut to size on the counter?", a: "Yes — sawn-to-length on the panel saw is free up to 10 cuts per sheet, £1 a cut after that. Pre-order email through and we'll have it stickered and ready when you pull up." },
      { q: "What moisture content do you sell at?", a: "Structural softwood goes out at 18-20%. We don't take pallets off the truck if they read above 22%. Bare wet C16 ends up cupping and twisting on site and we won't be the cause of it." },
      { q: "How fast can you open a trade account?", a: "Same day if your company is VAT-registered and the credit check comes back clean. 30-day terms after that, online portal for invoices." },
      { q: "Do you stock hardwoods?", a: "European oak, ash, beech, sapele and walnut in stock as PAR and rough sawn. American black walnut and white oak by special order, 5-7 days." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["TTF Timber Industry Training", "PEFC Chain of Custody"],
    trade_memberships: ["Timber Trade Federation (TTF)", "Builders Merchants Federation (BMF)"],
    dbs_checked: false,
    has_own_transport: true,
    has_own_tools: false,
    minimum_job_gbp: 25,
    free_site_visits: false,
    quote_availability: "Same-day quotes for stock items",
    quote_turnaround_hours: 8,
    current_status_note: "Yard open Mon-Fri 7am-5pm, Sat 8am-12. Trade accounts welcome — same-day delivery on orders before 11am.",
    availability: "now",
    reviews: [
      { customer_name: "Daniel M.", rating: 5, title: "Ordered Wednesday, on site Thursday 7am", body: "Phoned in 60 lengths of C24 4x2 plus 12 sheets of OSB late Wednesday afternoon — driver was unloading at the site Thursday before I'd had my first cuppa. Counter lad knew exactly which span tables I needed too.", service_name: "C24 4x2 kiln-dried softwood (per linear m)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/60.jpg" },
      { customer_name: "Lewis B.", rating: 5, title: "Larch decking was bang-on grade", body: "Last yard I tried sent me half a pack of split and twisted larch. Pritchard's pack was straight, dry and graded properly. Trade discount applied without me even asking.", service_name: "Siberian larch decking 28x145 (per linear m)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/61.jpg" },
      { customer_name: "Megan T.", rating: 5, title: "Saved us on a tight roof spec", body: "Architect changed the joist spec mid-build, Pritchard had James Jones I-joists in 240 depth on the shelf when nowhere else in the South-West did. Loaded on a Hiab same afternoon.", service_name: "Engineered I-joist 240mm (per linear m)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/62.jpg" }
    ]
  },

  // 2. PLUMBING MERCHANT
  {
    trade_slug: "plumbing-merchant",
    profile_slug: "demo-craig-donnelly-plumbing-merchant-glasgow",
    display_name: "Craig Donnelly",
    trading_name: "Donnelly Plumbing Supplies",
    city: "Glasgow",
    postcode_prefix: "G31",
    whatsapp: "+44 7700 902115",
    email: "trade@donnellyplumbing.co.uk",
    bio: "Donnelly Plumbing has run out of the same yard in Dennistoun since 2007. We're a Worcester Bosch Accredited Installer Centre, official Wavin stockist for plastic pipework, and we hold deep stock on copper, brass fittings, valves, radiators, towel rails, cylinders and bathroom rough-in. About 80% of our business is registered Gas Safe plumbers and heating engineers across Glasgow and Lanarkshire — the other 20% is the keen DIY-er we don't sneer at. We'll open a trade account same day if you've got a UTR or company number, 30-day terms after a Sage credit check. Counter pricing is sparks-and-plumber trade rates, no faff. Vans run all over the Central Belt — local delivery free over £150, next-day country-wide. Boiler held on the shelf for collection 9 out of 10 times if you ring before lunchtime.",
    years_in_trade: 19,
    start_year: 2007,
    priced_services: [
      { name: "Worcester Bosch Greenstar 30i combi boiler", price: 945, unit: "per item", description: "30kW combi, ErP A-rated, 10-year warranty when fitted by accredited installer. Trade price ex VAT, stock item." },
      { name: "Copper pipe 22mm x 3m EN1057", price: 18.50, unit: "per item", description: "Half-hard EN1057 copper tube. Per 3m length, trade price ex VAT. Lager bundles discounted." },
      { name: "Wavin Hep2O barrier pipe 22mm x 50m coil", price: 78, unit: "per item", description: "Polybutylene barrier pipe, push-fit. 50m coil, trade price ex VAT." },
      { name: "Stelrad K2 double-panel radiator 600x1200", price: 124, unit: "per item", description: "Type 22 double-convector radiator, white. Heat output 1,830W @ dT50. Per item ex VAT." },
      { name: "Megaflo Eco 210L unvented cylinder", price: 760, unit: "per item", description: "Heatrae Sadia Megaflo Eco 210L direct cylinder, 25-year warranty. Trade price ex VAT, stocked." },
      { name: "TRV pair (Drayton TRV4)", price: 16.50, unit: "per item", description: "Drayton TRV4 thermostatic valve + lockshield pair, white. Per pair, ex VAT." },
      { name: "Trade account setup", price: 0, unit: "fixed", description: "Free trade account application — same-day approval for Gas Safe / SNIPEF registered installers. 30-day terms." },
      { name: "Same-day delivery (within 15 miles, orders over £150)", price: 0, unit: "fixed", description: "Free same-day delivery for trade orders over £150 within Glasgow city and 15-mile radius if ordered before 12pm." }
    ],
    faq_items: [
      { q: "Are you a Worcester Bosch Accredited centre?", a: "Yes, full Accredited Installer Centre — that means my trade customers get the 10-year warranty on Greenstar boilers and you can collect the same morning if it's on the shelf, which it usually is." },
      { q: "Do I need to be Gas Safe to open a trade account?", a: "For gas products yes — you'll need a Gas Safe number or SNIPEF for unvented cylinders. For general plumbing rough-in we'll open accounts for any VAT-registered trader." },
      { q: "Do you do same-day delivery?", a: "Yes within 15 miles of G31 if ordered before noon, free over £150. Outside that radius it's next-day country-wide on stock items." },
      { q: "Will you price-match the national chains?", a: "Show me a like-for-like written quote on a stock item and I'll match it 9 times out of 10. No silly games — but we'd rather you stayed loyal than chase 50p off a fitting." },
      { q: "Do you stock spares for older Worcester boilers?", a: "Stock all common spares — diverter valves, PCBs, fans, expansion vessels — for the last 15 years of Greenstar range. Special order 24-48hr on anything else." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["Worcester Bosch Accredited Installer Centre", "BMF Plumbing Merchant Course"],
    trade_memberships: ["Builders Merchants Federation (BMF)", "Scottish & Northern Ireland Plumbing Employers' Federation (SNIPEF)"],
    dbs_checked: false,
    has_own_transport: true,
    has_own_tools: false,
    minimum_job_gbp: 40,
    free_site_visits: false,
    quote_availability: "Same-day counter quotes",
    quote_turnaround_hours: 6,
    current_status_note: "Counter open Mon-Fri 7am-5.30pm, Sat 8am-1pm. Boiler stock holding healthy.",
    availability: "now",
    reviews: [
      { customer_name: "Stephen R.", rating: 5, title: "Greenstar on the shelf, trade account opened the same morning", body: "Lost a boiler at a customer's house first thing Monday. Walked into Donnelly's at 8am, walked out at 8.20 with a Greenstar 30i, trade account opened, full installer warranty registered. That's what a merchant should be.", service_name: "Worcester Bosch Greenstar 30i combi boiler", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/men/63.jpg" },
      { customer_name: "Paul G.", rating: 5, title: "Best copper price in Glasgow", body: "Counter price for half-hard 22mm copper is consistently cheaper than the big chains and they pull it straight off the rack — no waiting on a goods-in lad with a trolley.", service_name: "Copper pipe 22mm x 3m EN1057", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/64.jpg" },
      { customer_name: "Andrew M.", rating: 5, title: "Megaflo delivered to a top-floor flat", body: "Ordered a 210L Megaflo at 11am, lads carried it up three flights of stairs by 2pm. Free delivery, no fuss. Customer was made up.", service_name: "Megaflo Eco 210L unvented cylinder", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/65.jpg" }
    ]
  },

  // 3. ELECTRICAL WHOLESALER
  {
    trade_slug: "electrical-wholesaler",
    profile_slug: "demo-anwar-rashid-electrical-wholesaler-birmingham",
    display_name: "Anwar Rashid",
    trading_name: "Rashid Electrical Wholesale",
    city: "Birmingham",
    postcode_prefix: "B11",
    whatsapp: "+44 7700 902128",
    email: "trade@rashidelectrical.co.uk",
    bio: "Rashid Electrical has been wholesaling out of Sparkbrook since 2010 — we set up to give Brummie sparks an alternative to CEF and Edmundson at the time, and we still hold that line. Stock breadth is around 8,000 SKUs across MK Logic Plus, MK Edge, Hager consumer units and accessories, Click, Schneider Lisse, Aico smoke alarms, Aurora LED downlights, Knightsbridge USB sockets, Doncaster Cables 6242Y T&E and SWA. Counter is sparks-only pricing — show me your ECS or NICEIC card and you'll see the trade rate instantly, no online tier-game. Trade accounts open within 24 hours, 30-day terms. We run two vans across the West Midlands daily and free delivery is anything over £80 net within 12 miles. If you need an 18th edition CU on a Friday afternoon for a Monday RCD job, we keep the common Hager and Wylex configurations on the rack — not in a warehouse 80 miles away.",
    years_in_trade: 16,
    start_year: 2010,
    priced_services: [
      { name: "Doncaster T&E 2.5mm 6242Y 100m drum", price: 78, unit: "per item", description: "Twin & earth 2.5mm² cable, BS 6004, 100m drum. Trade price ex VAT, stocked." },
      { name: "MK Logic Plus 13A double socket white", price: 4.50, unit: "per item", description: "MK Logic Plus K2747WHI flush double socket, screwed. Per item ex VAT — sparks counter price." },
      { name: "Hager 10-way dual-RCD consumer unit", price: 145, unit: "per item", description: "Hager Design 10 VML910CU 10-way 100A main switch + 2x RCDs, 18th Edition. Per CU ex VAT, stocked." },
      { name: "Click Mode CMA035 25A DP switch", price: 6.80, unit: "per item", description: "Click Mode 25A double-pole switch with flex outlet. Cooker/water-heater isolator. Per item ex VAT." },
      { name: "Aurora EFD 5W IP65 fire-rated downlight", price: 11.50, unit: "per item", description: "Aurora EFD dimmable 5W fire-rated downlight, GU10, IP65. Per item ex VAT." },
      { name: "Aico Ei3024 mains smoke + heat alarm (radio-interlinked)", price: 38, unit: "per item", description: "Aico Ei3024 multi-sensor alarm with built-in radio interlink. Per item, ex VAT." },
      { name: "SWA 2.5mm 3-core armoured (per linear m)", price: 4.20, unit: "per linear m", description: "Doncaster 3-core 2.5mm² SWA cable, BS5467. Cut to length on the drum. Per linear m, ex VAT." },
      { name: "Trade account setup (24-hour approval)", price: 0, unit: "fixed", description: "Sparks-only trade account, opened within 24 hours on production of ECS / NICEIC / NAPIT / Stroma card. 30-day terms after credit check." }
    ],
    faq_items: [
      { q: "Are you really cheaper than CEF and Edmundson?", a: "On the bread-and-butter MK, Hager, Doncaster T&E and Aurora gear — yes, our counter price beats them consistently. Where the chains have edge is rare brands and one-off Schneider PLC stuff. We're honest about that." },
      { q: "What do I need to bring to open a trade account?", a: "Your ECS, NICEIC, NAPIT, Stroma or SELECT registration card, a VAT certificate if registered, and one bit of company ID. 24-hour turnaround on approval." },
      { q: "Do you stock the 18th Edition Amendment 3 consumer units?", a: "Yes — all common Hager Design 10, Wylex Compact and Schneider Easy9 configurations are on the rack. AFDD-protected variants we keep the popular sizes — anything bespoke 24-48 hours." },
      { q: "Can I order cable cut to length off the drum?", a: "Yes, free cuts on T&E, SWA, NYY and 6491X — counter takes it straight off the drum. Coils less than 25m we round up to nearest 5m to avoid waste." },
      { q: "Do you do same-day delivery in Birmingham?", a: "Yes within 12 miles of B11 on orders over £80 net — two vans run a morning and afternoon loop. Outside 12 miles it's next-day country-wide." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["EDA Electrical Distributors Course"],
    trade_memberships: ["Electrical Distributors' Association (EDA)", "Builders Merchants Federation (BMF)"],
    dbs_checked: false,
    has_own_transport: true,
    has_own_tools: false,
    minimum_job_gbp: 25,
    free_site_visits: false,
    quote_availability: "Same-day counter quotes",
    quote_turnaround_hours: 6,
    current_status_note: "Counter Mon-Fri 7am-5pm, Sat 8am-1pm. Strong stock on Hager CUs and 6242Y this month.",
    availability: "now",
    reviews: [
      { customer_name: "Steve M.", rating: 5, title: "Trade rate applied without a single haggle", body: "Showed my NICEIC card on the counter and the trade discount went straight on the till without me having to ask. Saved me about 18% over CEF on the same Hager CU.", service_name: "Hager 10-way dual-RCD consumer unit", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/66.jpg" },
      { customer_name: "Marcus B.", rating: 5, title: "Had the Aico when no-one else did", body: "Council rewire chasing me for radio-interlinked smoke heads on a Friday. Three other wholesalers were out of stock — Rashid had the Ei3024s on the shelf, full pack of 8. Saved the certification.", service_name: "Aico Ei3024 mains smoke + heat alarm (radio-interlinked)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/67.jpg" },
      { customer_name: "Jordan A.", rating: 5, title: "Cable cut and delivered same afternoon", body: "Phoned in 80m of 3-core SWA at 11am for a garden room job — counter cut it off the drum and the van had it at site by 3. That's a proper wholesaler.", service_name: "SWA 2.5mm 3-core armoured (per linear m)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/68.jpg" }
    ]
  },

  // 4. TILE SHOP
  {
    trade_slug: "tile-shop",
    profile_slug: "demo-francesca-de-luca-tile-shop-london",
    display_name: "Francesca De Luca",
    trading_name: "De Luca Tile Studio",
    city: "London",
    postcode_prefix: "SW18",
    whatsapp: "+44 7700 902142",
    email: "hello@delucatile.co.uk",
    bio: "De Luca Tile Studio opened in Wandsworth in 2014 after I spent ten years on the trade side of an Italian tile importer in Surrey. We're a Porcelanosa Tier-2 partner, hold deep stock on BAL adhesives and Mapei grouts, and curate around 320 lines of porcelain, ceramic, natural stone and large-format slabs across the showroom. About 60% of our customers are tilers and bathroom installers buying for clients — the rest is homeowners who want a real surface to look at, not just a screen. We don't do online-only ranges; if it's on the website it's in the warehouse. Trade accounts open same day for VAT-registered fitters with 30-day terms, and the tile-fitter discount is automatic on the trade card — no haggling. We deliver across Greater London with our own van and offer free local delivery on orders over £400. Large-format porcelain (1200x600 up to 3200x1600 slabs) handled with care — we crate everything properly.",
    years_in_trade: 12,
    start_year: 2014,
    priced_services: [
      { name: "Porcelanosa Carrara Blanco 60x120 polished (per sqm)", price: 78, unit: "per sqm", description: "Premium polished porcelain, rectified edge, Carrara marble effect. Per sqm ex VAT — trade pricing." },
      { name: "Mid-range matt porcelain 60x60 (per sqm)", price: 32, unit: "per sqm", description: "Spanish/Italian R10 anti-slip matt porcelain, suitable for floor or wall. Per sqm ex VAT." },
      { name: "Metro brick gloss white 7.5x15 (per sqm)", price: 22, unit: "per sqm", description: "Classic metro tile, ceramic gloss white, bevelled edge. Per sqm ex VAT — splashback favourite." },
      { name: "BAL Single Part Flexible adhesive 20kg", price: 26, unit: "per item", description: "BAL SPF S1 flexible cement-based tile adhesive, suitable for floor + wall, porcelain rated. Per bag ex VAT." },
      { name: "Mapei Ultracolor Plus grout 5kg", price: 18.50, unit: "per item", description: "Mapei Ultracolor Plus high-performance grout, anti-mould BioBlock. 36 colours in stock. Per bag ex VAT." },
      { name: "Large-format porcelain slab 1200x2800x6mm (per slab)", price: 380, unit: "per item", description: "Italian thin porcelain slab, marble or stone effect. Per slab ex VAT. Crated delivery only — minimum order 2 slabs." },
      { name: "Free design consultation + sample box (showroom or in-home)", price: 0, unit: "fixed", description: "30-minute consultation with sample box made up. In-home consult free within 8 miles of SW18, otherwise £45 redeemable against order." },
      { name: "Trade account + 12% tiler discount", price: 0, unit: "fixed", description: "Free trade account application — 30-day terms after credit check. Automatic 12% tiler discount applied at till." }
    ],
    faq_items: [
      { q: "Do you stock everything that's on the website?", a: "Yes — if it's listed, it's in the Wandsworth warehouse or available within 5 working days on a back-to-back order. I won't put a tile on the site that's a 12-week lead time and pretend it's available." },
      { q: "Can my tiler get a trade discount?", a: "Yes — automatic 12% off our trade price the moment we open the account. VAT number, ID and a quick credit check, same-day approval most days. 30-day terms after that." },
      { q: "Do you do large-format porcelain slabs?", a: "Yes — up to 3200x1600 thin porcelain slabs from Florim, Inalco and Laminam. We crate them properly, deliver on a Hiab and the showroom has handling A-frames for collection. Minimum order 2 slabs." },
      { q: "Will you match my old discontinued tile?", a: "Bring a photo and a sample if possible — if the original supplier still trades I'll usually find it within 24 hours. If it's truly discontinued I'll find the closest match in current stock and lay both samples next to each other in the showroom." },
      { q: "Do you sell adhesive and grout to match?", a: "Always — every tile sale is paired with a recommended BAL adhesive grade and a Mapei grout colour. We won't sell you a porcelain without telling you it needs an S1-grade adhesive." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["Porcelanosa Tier-2 Accredited Partner", "BAL Approved Stockist"],
    trade_memberships: ["The Tile Association (TTA)"],
    dbs_checked: false,
    has_own_transport: true,
    has_own_tools: false,
    minimum_job_gbp: 40,
    free_site_visits: false,
    quote_availability: "Same-day showroom or photo-based quotes",
    quote_turnaround_hours: 12,
    current_status_note: "Showroom open Mon-Sat. Porcelanosa autumn 2026 collection just landed.",
    availability: "now",
    reviews: [
      { customer_name: "Daniel C.", rating: 5, title: "Specs matched off a photo from my client", body: "Customer sent me a photo of a tile from a magazine. Francesca identified the range, found a current Porcelanosa equivalent and had samples for me to take to site in 24 hours. That's expertise.", service_name: "Porcelanosa Carrara Blanco 60x120 polished (per sqm)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/69.jpg" },
      { customer_name: "Olivia P.", rating: 5, title: "Trade discount on the till, no nonsense", body: "Opened a trade account on the Monday, picked up 18sqm of porcelain for my client's bathroom on the Tuesday, the 12% came off automatically. Adhesive and grout colour spec on the receipt too.", service_name: "BAL Single Part Flexible adhesive 20kg", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/70.jpg" },
      { customer_name: "Henry W.", rating: 5, title: "Slab delivery was textbook", body: "Two 1200x2800 thin porcelain slabs crated, delivered on a Hiab, lowered carefully onto my prepped A-frames. Zero chips. Tells you everything about how they treat the stock.", service_name: "Large-format porcelain slab 1200x2800x6mm (per slab)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/71.jpg" }
    ]
  },

  // 5. FLOORING SHOP
  {
    trade_slug: "flooring-shop",
    profile_slug: "demo-rebecca-hartley-flooring-shop-leeds",
    display_name: "Rebecca Hartley",
    trading_name: "Hartley Floors Leeds",
    city: "Leeds",
    postcode_prefix: "LS11",
    whatsapp: "+44 7700 902154",
    email: "hello@hartleyfloors.co.uk",
    bio: "Hartley Floors has been on the south side of Leeds since 2011 — I started behind the till at my dad's shop in Pudsey and bought it off him in 2019. Karndean Designflooring Authorised Retailer, Amtico Specialist Centre, Cormar Carpets stockist and V4 Wood Flooring partner. We carry around 280 displayed samples across LVT, vinyl sheet, carpet, hardwood and engineered wood, plus underlay, scotia, threshold bars and adhesives. Counter staff are fitters by background — bring a sketch and we'll work out the sqm including waste factor properly. We don't fit ourselves but we have a list of vetted fitters we recommend across LS, BD and WF postcodes. Trade discounts for registered fitters are automatic on the trade card. Delivery is free over £250 within 15 miles of LS11, otherwise a flat £35.",
    years_in_trade: 15,
    start_year: 2011,
    priced_services: [
      { name: "Karndean Korlok Select Riven Slate (per sqm)", price: 42, unit: "per sqm", description: "Karndean rigid-core LVT, 6.5mm with attached underlay, click system. Per sqm ex VAT, trade pricing." },
      { name: "Amtico Spacia LVT (per sqm)", price: 36, unit: "per sqm", description: "Amtico Spacia 2.5mm glue-down LVT, 65 designs in stock. Per sqm ex VAT — fitter discount automatic." },
      { name: "Cormar Avebury saxony carpet (per sqm)", price: 24, unit: "per sqm", description: "Cormar Avebury 80/20 wool-mix saxony, 5m and 4m broadloom. Per sqm ex VAT." },
      { name: "V4 Wood Engineered oak T&G 14/3mm (per sqm)", price: 49, unit: "per sqm", description: "V4 engineered oak, 180mm wide, 14mm overall with 3mm wear layer, brushed and matt-lacquered. Per sqm ex VAT." },
      { name: "Tarkett Safetred R10 vinyl sheet (per sqm)", price: 28, unit: "per sqm", description: "Commercial-grade safety vinyl sheet, 2mm, R10 slip-rated. Wet areas + kitchens. Per sqm ex VAT." },
      { name: "Ball & Young Cloud 9 11mm underlay (per roll)", price: 68, unit: "per item", description: "PU foam underlay, 11mm, 15m roll. Per roll, ex VAT — pairs with most carpets." },
      { name: "Free measure-up (within 15 miles)", price: 0, unit: "fixed", description: "Free in-home measure-up service within 15 miles of LS11. We don't fit but we'll get the sqm + waste calculation right for your fitter." },
      { name: "Trade account + 10% fitter discount", price: 0, unit: "fixed", description: "Free trade account application for registered fitters. Automatic 10% off our trade price at till. 30-day terms after credit check." }
    ],
    faq_items: [
      { q: "Do you also fit the floor?", a: "No — we're a supplier not a fitting firm. But we keep a list of 8 vetted independent fitters across LS, BD and WF that we recommend, and we'll happily get them to quote your room separately." },
      { q: "What waste factor should my fitter add?", a: "Rule of thumb: 7-10% for plank LVT and carpet in a square room, 10-12% for herringbone and patterned LVT, 12-15% for sheet vinyl with seams. Our counter staff will work it out from a sketch." },
      { q: "Karndean or Amtico — which is better?", a: "Both are great. Karndean has the edge on rigid-core click-fit options (Korlok), Amtico has slightly broader design range on the glue-down side. Price-wise they're within 5% of each other on most lines." },
      { q: "Can you order something you don't stock?", a: "Yes — Karndean and Amtico full ranges are next-day on stock items, 3-5 days on the specialist patterns. Cormar carpets 3-5 days. V4 engineered wood 5-7 days." },
      { q: "Do you do free samples?", a: "Yes, take any 5 samples home free, additional samples 50p each refundable on order. LVT samples are a decent size — not the postage-stamp things you get online." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["Karndean Authorised Retailer", "Amtico Specialist Centre"],
    trade_memberships: ["Contract Flooring Association (CFA)"],
    dbs_checked: false,
    has_own_transport: true,
    has_own_tools: false,
    minimum_job_gbp: 40,
    free_site_visits: true,
    quote_availability: "Same-day showroom or measure-up quotes",
    quote_turnaround_hours: 24,
    current_status_note: "Showroom open Mon-Sat 9-5. Free measure-up bookings 3-4 days out.",
    availability: "now",
    reviews: [
      { customer_name: "Liam P.", rating: 5, title: "Counter knew their stuff", body: "Walked in with a sketch of three rooms and 15 minutes later walked out with an accurate sqm, the right waste factor, underlay spec and a Karndean order placed for Wednesday. No upsell either.", service_name: "Karndean Korlok Select Riven Slate (per sqm)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/72.jpg" },
      { customer_name: "Charlotte S.", rating: 5, title: "Measure-up bang-on", body: "Rebecca came out within the week, measured up three reception rooms and a hallway — the order was 38sqm + 9% waste. Fitter said it was the most accurate cut-list he'd seen all month.", service_name: "Free measure-up (within 15 miles)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/73.jpg" },
      { customer_name: "Mark T.", rating: 5, title: "Engineered oak delivered Thursday morning", body: "Ordered 22sqm of V4 brushed and matt oak Tuesday afternoon. On site Thursday 8am, packs were dead straight, zero damage. Trade discount applied without a word.", service_name: "V4 Wood Engineered oak T&G 14/3mm (per sqm)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/74.jpg" }
    ]
  },

  // 6. DOOR SHOWROOM
  {
    trade_slug: "door-showroom",
    profile_slug: "demo-imogen-redgrave-door-showroom-nottingham",
    display_name: "Imogen Redgrave",
    trading_name: "Redgrave Door Studio",
    city: "Nottingham",
    postcode_prefix: "NG7",
    whatsapp: "+44 7700 902167",
    email: "hello@redgravedoors.co.uk",
    bio: "Redgrave Door Studio opened in Lenton in 2016 — a proper door showroom rather than a corner of a builder's merchant. We display 90+ internal and external doors with the ironmongery hung up next to them so you can actually see how a brushed-brass lever sits on an oak-veneered Deanta panel before you commit. Stockists for Deanta, LPD Doors, JB Kind, XL Joinery and Hyperion external. About 70% of our work is supplying chippies, joiners and small builders — the rest is homeowners who've been let down by the flat-pack pre-hung doors from the big sheds. Trade accounts open same day for registered fitters with 12% off the trade list. We deliver across the East Midlands on our own van, free local on orders over £250. We don't fit, but we'll match you with a trusted chippy from our list if needed.",
    years_in_trade: 10,
    start_year: 2016,
    priced_services: [
      { name: "Deanta Walden oak internal door 762x1981", price: 145, unit: "per item", description: "Pre-finished oak veneered internal door, vertical grain, FD30 fire-rated variant available. Per door ex VAT." },
      { name: "LPD Mexicano oak FD30 fire door 838x1981", price: 198, unit: "per item", description: "LPD Mexicano fire door, 30-minute fire rating, pre-finished oak. Required for loft conversion stairwells. Per door ex VAT." },
      { name: "JB Kind Eldon 4-light glazed primed white", price: 168, unit: "per item", description: "Primed white 4-light glazed door with clear bevelled glass. Per door ex VAT." },
      { name: "Hyperion composite external door (full set, painted)", price: 1180, unit: "from", description: "GRP composite external door, multi-point lock, 70mm frame, painted to any RAL. Includes glazed sidelight if specified. From price ex VAT." },
      { name: "Carlisle Brass lever-on-rose set (satin)", price: 38, unit: "per pair", description: "Carlisle Brass Eden lever on rose, satin nickel, including pair of latch + 2 hinges. Per set ex VAT." },
      { name: "Door hanging service (recommended local chippy)", price: 75, unit: "per door", description: "Vetted independent chippies on our list — typical hang including planing, hinging, latch and handle. Quoted by the chippy, not us." },
      { name: "Trade account + 12% trade discount", price: 0, unit: "fixed", description: "Free trade account for registered chippies and builders. 12% off trade list, 30-day terms after credit check." }
    ],
    faq_items: [
      { q: "Do you hang the doors or just supply?", a: "Supply only — but we keep a list of 6 independent chippies across NG and DE postcodes who'll quote the hanging separately. Cleaner accounting for everyone and we can't be accused of overcharging on labour we don't control." },
      { q: "What's the lead time on a Hyperion composite door?", a: "5-7 working days on the standard RAL colours, 10-12 days on a custom RAL. Glazing options add 2 days. Hardware is paired and pre-fitted." },
      { q: "Are your fire doors fully certified?", a: "Yes — Deanta and LPD FD30 doors come with the BWF Certifire certification label visible on the top edge. Building Control accepts these without question." },
      { q: "Can I see a door hung with the hardware I'm choosing?", a: "Yes — every showroom door has 2-3 example handles fitted so you can see Carlisle Brass, Heritage and Atlantic finishes against the actual veneer. Beats imagining it from a catalogue." },
      { q: "Do you do made-to-measure doors?", a: "Yes via Hyperion (external) and a local joinery shop we sub to for internal one-offs in oak, walnut or painted MDF. Lead time 3-4 weeks, priced per door." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["Deanta Trade Partner", "Hyperion Approved Stockist"],
    trade_memberships: ["British Woodworking Federation (BWF)"],
    dbs_checked: false,
    has_own_transport: true,
    has_own_tools: false,
    minimum_job_gbp: 40,
    free_site_visits: false,
    quote_availability: "Same-day showroom quotes",
    quote_turnaround_hours: 24,
    current_status_note: "Showroom open Mon-Sat. Hyperion composite lead time currently 5-7 days.",
    availability: "now",
    reviews: [
      { customer_name: "Sam B.", rating: 5, title: "Best door range in Nottingham", body: "Three Howdens equivalents had nothing close to a real oak veneer door I could look at. Imogen has Deanta and LPD in the flesh, ironmongery hung next to them. Customer chose in 20 minutes.", service_name: "Deanta Walden oak internal door 762x1981", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/75.jpg" },
      { customer_name: "Aisha N.", rating: 5, title: "Hyperion arrived painted to spec", body: "Custom RAL 7016 anthracite grey on the composite door, glazing pattern as drawn. 9 days from order, no chips, multi-point lock pre-fitted. Customer was speechless.", service_name: "Hyperion composite external door (full set, painted)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/76.jpg" },
      { customer_name: "Joe K.", rating: 5, title: "Fire-doors certified and stocked", body: "Loft conversion sign-off was waiting on three FD30 doors for the stairwell. Imogen had them off the shelf with the Certifire labels, delivered next morning. Building Control passed first time.", service_name: "LPD Mexicano oak FD30 fire door 838x1981", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/77.jpg" }
    ]
  },

  // 7. KITCHEN SHOWROOM
  {
    trade_slug: "kitchen-showroom",
    profile_slug: "demo-charlotte-mainwaring-kitchen-showroom-cheshire",
    display_name: "Charlotte Mainwaring",
    trading_name: "Mainwaring Kitchen Studio",
    city: "Wilmslow",
    postcode_prefix: "SK9",
    whatsapp: "+44 7700 902179",
    email: "design@mainwaringkitchens.co.uk",
    bio: "Mainwaring Kitchen Studio opened in Wilmslow in 2013 after I spent twelve years designing kitchens for a national firm. We display 14 full kitchens across the showroom — shaker, handleless, in-frame, slab — paired with Neff, Bosch, Siemens and Quooker appliances so you can open every drawer, run every tap and try every soft-close before you sign. Carcasses are German-engineered (Nobilia + a Manchester-made alternative for budgets under £18k). Granite and quartz worktops installed by our partner stonemason in Macclesfield. We're a Magnet/Wren rival but independent — same German cabinetry, no commission-driven hard sell. Free in-home design and 3D plan. Lead time 6-8 weeks from sign-off, install in 5-10 days depending on size. Trade accounts available for builders supplying the kitchen to their own clients with a 15% supply-only trade rate.",
    years_in_trade: 13,
    start_year: 2013,
    priced_services: [
      { name: "Entry-range shaker kitchen (supply only, average 12-unit run)", price: 8500, unit: "from", description: "Painted MDF shaker doors on German carcasses, soft-close hinges and drawers, brushed-steel handles. Supply only, ex appliances and worktop. From price ex VAT." },
      { name: "Mid-range handleless kitchen (supply only, average 14-unit run)", price: 14500, unit: "from", description: "Matt-lacquered handleless doors on Nobilia carcasses, full-extension drawers, integrated LED plinth lighting. From price ex VAT." },
      { name: "Premium in-frame painted kitchen (supply only)", price: 24000, unit: "from", description: "Hand-painted in-frame shaker, dovetailed solid-oak drawer boxes, premium hinges. From price ex VAT — typical project £35-£45k all-in." },
      { name: "Quartz worktop install (per linear m, 20mm)", price: 480, unit: "per linear m", description: "Caesarstone or Silestone quartz, 20mm, templated and installed by our partner stonemason. Includes upstand. Per linear m ex VAT." },
      { name: "Granite worktop install (per linear m, 30mm)", price: 420, unit: "per linear m", description: "Premium granite slab, 30mm, templated and installed. Includes 100mm upstand. Per linear m ex VAT." },
      { name: "Neff Slide-and-Hide single oven (B6CCG7AN0B)", price: 985, unit: "per item", description: "Neff N70 Slide-and-Hide single oven, pyrolytic, A energy rating. Per unit ex VAT, supplied as part of kitchen package." },
      { name: "Free in-home design consultation + 3D plan", price: 0, unit: "fixed", description: "Free in-home measure + design consultation within 25 miles of SK9, including printed 3D walk-through plan. No obligation." },
      { name: "Trade account + 15% supply-only discount", price: 0, unit: "fixed", description: "Trade accounts for builders supplying kitchens to clients. 15% off supply-only RRP, 30-day terms after credit check." }
    ],
    faq_items: [
      { q: "Are your carcasses really better than Magnet or Wren?", a: "Same German factory as several Magnet and Wren ranges — the difference is door quality, drawer-box construction and the design service. Our entry kitchens compete with Wren mid-range, our mid-range competes with Wren premium." },
      { q: "Do you fit the kitchen or just supply?", a: "We supply only — but we have three trusted independent kitchen fitters across SK and CH postcodes that we recommend, and they quote you separately. Cleaner contracts, no margin-stacking." },
      { q: "How long is the lead time?", a: "6-8 weeks from final sign-off and 50% deposit. Install runs 5-10 working days depending on size. Worktop is templated post-install and fitted 7-10 days after that." },
      { q: "Can builders open a trade account?", a: "Yes — 15% off supply-only RRP for VAT-registered builders supplying the kitchen as part of a wider project. 30-day terms after credit check." },
      { q: "Do you do appliances or just cabinetry?", a: "Both — full Neff, Bosch, Siemens, Miele and Quooker price list, supplied at trade margin within a kitchen package. We don't sell appliances stand-alone — go to a dedicated dealer for that." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["KBSA Designer Member", "Neff Master Partner"],
    trade_memberships: ["Kitchen Bathroom Bedroom Specialists Association (KBSA)"],
    dbs_checked: false,
    has_own_transport: true,
    has_own_tools: false,
    minimum_job_gbp: 6000,
    free_site_visits: true,
    quote_availability: "Design appointments within the week",
    quote_turnaround_hours: 72,
    current_status_note: "Showroom open Mon-Sat, design appointments 3-5 days out. 14 full kitchens displayed.",
    availability: "this_week",
    reviews: [
      { customer_name: "Olivia C.", rating: 5, title: "Same German carcass at a better price than Wren", body: "Got a quote from Wren that was £4k more for what turned out to be the same Nobilia carcass. Charlotte was straight with us about the differences and walked us through every drawer in the showroom. Five months on, kitchen is faultless.", service_name: "Mid-range handleless kitchen (supply only, average 14-unit run)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/78.jpg" },
      { customer_name: "Robert B.", rating: 5, title: "Quartz install was textbook", body: "Templated the Monday after install, fitted the following Wednesday morning. Joints invisible, undermount sink lined up perfectly. Their stonemason knows his trade.", service_name: "Quartz worktop install (per linear m, 20mm)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/79.jpg" },
      { customer_name: "Jasmine P.", rating: 5, title: "Trade account saved my client thousands", body: "Builder here — opened a trade account, 15% off the supply price on a £22k kitchen meant I could pass the saving on to my client and still earn margin. No hard sell from Charlotte either, just good design.", service_name: "Trade account + 15% supply-only discount", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/women/80.jpg" }
    ]
  },

  // 8. WINDOW SHOWROOM
  {
    trade_slug: "window-showroom",
    profile_slug: "demo-david-fothergill-window-showroom-newcastle",
    display_name: "David Fothergill",
    trading_name: "Fothergill Glazing Studio",
    city: "Newcastle upon Tyne",
    postcode_prefix: "NE6",
    whatsapp: "+44 7700 902192",
    email: "info@fothergillglazing.co.uk",
    bio: "Fothergill Glazing has been on the same site in Byker since 2009. The showroom displays full-size UPVC, aluminium and timber-framed windows in real openings — six casement, four sash, two tilt-and-turn and three Origin aluminium bifolds. You can open every one, listen to the close and judge the sightlines yourself. We're an Anglian-rival but independent: same fenestration suppliers, no commission staff. Authorised Origin OB-49 aluminium dealer, Liniar UPVC fabricator partner, Mumford & Wood timber. Survey and install handled by our own fitters — Fensa-registered, BS 7950 compliant. Full home windows (8-12 openings) typically delivered and installed within 4-6 weeks from survey. Free no-obligation survey within 25 miles of NE6, fixed-price written quote within 48 hours.",
    years_in_trade: 17,
    start_year: 2009,
    priced_services: [
      { name: "Liniar UPVC casement window (1200x1200, white, A-rated)", price: 480, unit: "from", description: "Liniar UPVC casement, 70mm frame, A-rated 1.2 U-value double glazing. Per opening ex VAT — supply + install in NE area." },
      { name: "Mumford & Wood timber sash window (1200x1800, primed)", price: 1850, unit: "from", description: "Engineered timber sliding sash, 16mm dg unit, traditional Georgian-bar configuration. Per opening ex VAT, primed for paint." },
      { name: "Origin OB-49 aluminium tilt-and-turn (1500x1500)", price: 2280, unit: "from", description: "Origin OB-49 polyester powder-coated aluminium, 1.4 U-value DG, 20-year frame guarantee. Per opening ex VAT." },
      { name: "Origin OB-72 bifold door (3m, 3-panel, anthracite)", price: 4850, unit: "from", description: "Origin OB-72 aluminium bifold, 3m wide, 3-panel configuration, anthracite RAL 7016. From price ex VAT, supply + install." },
      { name: "Roof lantern (2m x 1.5m, slim-frame aluminium)", price: 2950, unit: "from", description: "Korniche-style slim-frame aluminium roof lantern, self-cleaning glass, anthracite RAL 7016. From price ex VAT." },
      { name: "Full-house window package (8 openings, UPVC)", price: 5800, unit: "from", description: "Average mid-terrace 8-opening UPVC supply + install package, A-rated glass, white frames. Lead time 4-5 weeks. From price ex VAT." },
      { name: "Free no-obligation survey + fixed quote (within 25 miles)", price: 0, unit: "fixed", description: "Free home survey within 25 miles of NE6, written fixed-price quote within 48 hours. No deposit until you sign." }
    ],
    faq_items: [
      { q: "How are you cheaper than Anglian or Everest?", a: "Same fabricators behind the scenes — Liniar, Origin, Mumford & Wood. We don't have the national TV advertising spend or the salesman's company car. Independent, family-owned, direct from showroom to install." },
      { q: "Are you Fensa-registered?", a: "Yes — Fensa and Certass for all our installs. You'll get the Building Regulations compliance certificate posted out within 14 days of completion." },
      { q: "What's the lead time on aluminium?", a: "Origin OB-49 windows: 3-4 weeks from sign-off and survey-finalised. Origin bifolds 4-6 weeks depending on size and configuration. Roof lanterns 5-6 weeks." },
      { q: "Do you replace timber sash in conservation areas?", a: "Yes — Mumford & Wood timber sash windows are accepted in most conservation officer specs. We've done dozens in Jesmond and Tynemouth without issue. Survey will flag any heritage requirements." },
      { q: "What guarantee do I get?", a: "10-year frame guarantee on UPVC (Liniar), 20-year on Origin aluminium, 10-year on Mumford & Wood timber, 10-year on installation workmanship by us." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["FENSA Registered Installer", "Certass Approved", "Origin OB-49/OB-72 Authorised Dealer"],
    trade_memberships: ["Glass and Glazing Federation (GGF)", "FENSA"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: true,
    minimum_job_gbp: 480,
    free_site_visits: true,
    quote_availability: "Survey within 3-5 days, written quote within 48 hours",
    quote_turnaround_hours: 48,
    current_status_note: "Booking installs 4-6 weeks out. Showroom open Mon-Sat. Origin OB-49 stock healthy.",
    availability: "this_week",
    reviews: [
      { customer_name: "Andrew T.", rating: 5, title: "Saved £4k vs Anglian on a like-for-like spec", body: "Anglian quoted £14,200 for 9 windows. David quoted £9,950 for the same Liniar frames, same A-rated glass, same Fensa cert. Job came in on time, no aggressive sales pitch, no upgrade-pricing tricks.", service_name: "Full-house window package (8 openings, UPVC)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/81.jpg" },
      { customer_name: "Sophie L.", rating: 5, title: "Origin bifold transformed the kitchen", body: "3m anthracite OB-72 bifold delivered 5 weeks from sign-off, installed in a day. Threshold is bang flush, glass spotless. The showroom demo meant we knew exactly what we were getting.", service_name: "Origin OB-72 bifold door (3m, 3-panel, anthracite)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/82.jpg" },
      { customer_name: "Patrick M.", rating: 5, title: "Conservation officer happy with timber sash", body: "Jesmond conservation area — Mumford & Wood timber sashes approved without a single revision from the officer. Survey was thorough, paint finish faultless.", service_name: "Mumford & Wood timber sash window (1200x1800, primed)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/83.jpg" }
    ]
  },

  // 9. BATHROOM SHOWROOM
  {
    trade_slug: "bathroom-showroom",
    profile_slug: "demo-natalia-vance-bathroom-showroom-cardiff",
    display_name: "Natalia Vance",
    trading_name: "Vance Bathroom Studio",
    city: "Cardiff",
    postcode_prefix: "CF14",
    whatsapp: "+44 7700 902205",
    email: "hello@vancebathrooms.co.uk",
    bio: "Vance Bathroom Studio opened in Whitchurch in 2015 after I worked in bathroom retail for a decade across South Wales. We display 11 full bathroom vignettes — wet rooms, walk-in showers, traditional roll-tops, family bathrooms — paired with the tile, the tap, the radiator and the lighting so you can see the whole scheme, not pieces in catalogues. Stockists for Roca, Villeroy & Boch, Crosswater, Lakes Showering, Bathstore Trade and BC Designs. About 60% of our work is supplying installers, the rest is homeowners. Trade accounts open same day for registered fitters, 14% off trade list. We don't fit but we keep a list of 5 vetted independent bathroom installers across CF and NP postcodes. Delivery on our own van across South Wales — free over £400 within 20 miles of CF14.",
    years_in_trade: 11,
    start_year: 2015,
    priced_services: [
      { name: "Roca The Gap WC + soft-close seat", price: 220, unit: "per item", description: "Roca close-coupled WC with soft-close quick-release seat, dual flush 4.5/3L. Per unit ex VAT — trade pricing." },
      { name: "Villeroy & Boch Subway 3.0 vanity basin 600", price: 280, unit: "per item", description: "Villeroy & Boch Subway 3.0 600mm vanity basin, CeramicPlus glaze. Per item ex VAT." },
      { name: "Crosswater MPRO matt-black thermostatic shower set", price: 485, unit: "per item", description: "Crosswater MPRO thermostatic mixer with overhead and handset, matt black PVD finish. Per set ex VAT." },
      { name: "Lakes Showering 1400mm walk-in 8mm glass screen", price: 380, unit: "per item", description: "Lakes Coastline 8mm toughened glass walk-in screen, polished silver profile. Per item ex VAT." },
      { name: "BC Designs Magnus copper roll-top bath 1700", price: 4850, unit: "per item", description: "BC Designs Magnus polished copper double-skinned bath, 1700mm. Per item ex VAT — statement piece." },
      { name: "Bathroom Bizjos heated towel rail 1200x500 chrome", price: 145, unit: "per item", description: "Chrome flat-panel heated towel rail, 1200x500, 1,650 BTU. Per item ex VAT." },
      { name: "Free 3D bathroom design + walk-in survey", price: 0, unit: "fixed", description: "Free in-home survey + 3D bathroom design service within 20 miles of CF14. No-obligation written quote within 5 days." },
      { name: "Trade account + 14% installer discount", price: 0, unit: "fixed", description: "Free trade account for bathroom installers and builders. 14% off trade list, 30-day terms after credit check." }
    ],
    faq_items: [
      { q: "Do you fit the bathroom?", a: "No — but we keep a vetted list of 5 independent bathroom installers across Cardiff and Newport. They quote separately so you see the labour cost honestly and we're not stacking margin on top." },
      { q: "Can I see a full bathroom set up, not just a basin in a row?", a: "Yes — that's the whole point of the showroom. 11 full vignettes, real tile floors, real lighting, taps running. Bring your room dimensions and we'll spec something that suits." },
      { q: "How do I open a trade account?", a: "VAT cert, ID, quick credit check. Same-day approval most days for registered bathroom installers, 30-day terms. 14% auto-discount applied at till." },
      { q: "Do you do free design?", a: "Yes — free 3D design service for any project over £3.5k including a printed walk-through plan. We don't charge for it, but the deal is you've shortlisted us as one of the suppliers you're considering." },
      { q: "What lead time on Villeroy & Boch?", a: "5-7 working days on stock ranges, 2-3 weeks on the specialist Subway and Octagon series. Roca stock items are next-day." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["KBSA Member", "Villeroy & Boch Trade Partner"],
    trade_memberships: ["Kitchen Bathroom Bedroom Specialists Association (KBSA)"],
    dbs_checked: false,
    has_own_transport: true,
    has_own_tools: false,
    minimum_job_gbp: 80,
    free_site_visits: true,
    quote_availability: "Design quotes within 5 working days",
    quote_turnaround_hours: 72,
    current_status_note: "Showroom open Mon-Sat. Walk-in display refresh just completed. Design appointments 4-7 days out.",
    availability: "this_week",
    reviews: [
      { customer_name: "Gareth D.", rating: 5, title: "Counter staff knew the rough-in dimensions cold", body: "Walked in with a sketch and 20 minutes later had the WC, basin, shower and tile spec sorted. The girl behind the counter knew the rough-in heights off the top of her head — saved me a trip back.", service_name: "Roca The Gap WC + soft-close seat", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/84.jpg" },
      { customer_name: "Hannah W.", rating: 5, title: "3D plan made the decision easy", body: "Natalia did a free survey, came back with a 3D plan two days later that showed exactly how the walk-in screen sat against the tile. We could see it before we paid a penny. Project completed last month — looks identical to the render.", service_name: "Free 3D bathroom design + walk-in survey", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/85.jpg" },
      { customer_name: "Owen P.", rating: 5, title: "Trade discount kicked in without prompting", body: "Bathroom installer — opened a trade account on the Monday, 14% off auto-applied on the till on Tuesday's collection. Clean accounts, easy 30-day terms.", service_name: "Trade account + 14% installer discount", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/86.jpg" }
    ]
  },

  // 10. PAINT MERCHANT
  {
    trade_slug: "paint-merchant",
    profile_slug: "demo-priya-okonkwo-paint-merchant-london",
    display_name: "Priya Okonkwo",
    trading_name: "Okonkwo Paint Centre",
    city: "London",
    postcode_prefix: "E8",
    whatsapp: "+44 7700 902218",
    email: "trade@okonkwopaint.co.uk",
    bio: "Okonkwo Paint Centre has been on Mare Street in Hackney since 2012. We're a Dulux Trade flagship stockist, official Farrow & Ball retailer, Little Greene Paint Co. partner and Crown Trade dealer. Around 4,200 colours in tinting range across the wall — Dulux Trade Diamond Matt, Vinyl Matt, Eggshell, Satinwood; F&B Estate Emulsion and Modern; Little Greene Intelligent Matt; Mythic; Sikkens for exterior wood. Counter is decorators-only pricing for trade-card holders — show me your CSCS or PASA card and 18% comes off the till. Tinting bench runs from 7.30am — we can match any BS 4800, RAL or Pantone code from a swatch, and we keep the common Farrow & Ball whites pre-mixed for walk-in collection. Free local delivery over £100 within Zone 1-3, two scooters and a van running daily.",
    years_in_trade: 14,
    start_year: 2012,
    priced_services: [
      { name: "Dulux Trade Vinyl Matt 10L (white or magnolia)", price: 42, unit: "per item", description: "Dulux Trade emulsion, 10L, trade price ex VAT. White or magnolia off the shelf; tinted to any BS/RAL £4 extra." },
      { name: "Dulux Trade Diamond Matt 10L (washable)", price: 58, unit: "per item", description: "Premium washable emulsion, scuff-resistant, 10L. Trade price ex VAT — tinted to any colour included." },
      { name: "Farrow & Ball Estate Emulsion 5L", price: 95, unit: "per item", description: "F&B Estate matt emulsion, 5L tin, full colour card available. Per tin ex VAT — trade card discount applies." },
      { name: "Little Greene Intelligent Matt 5L", price: 88, unit: "per item", description: "Little Greene Intelligent washable matt emulsion, 5L. Tinted to any LG colour card. Per tin ex VAT." },
      { name: "Crown Trade Clean Extreme matt 10L", price: 65, unit: "per item", description: "Crown Trade Clean Extreme stain-resistant matt emulsion, 10L. Healthcare and hospitality spec. Per tin ex VAT." },
      { name: "Sikkens Cetol HLS Plus 1L", price: 32, unit: "per item", description: "Sikkens Cetol HLS Plus exterior wood stain, 1L. Trade price ex VAT — 36 colour tints available." },
      { name: "BS 4800 / RAL / Pantone tinting (any colour)", price: 4, unit: "per item", description: "Add to any tin: tinting to any BS 4800, RAL or Pantone code from a swatch or sample. Free for trade-card holders ordering >5 tins." },
      { name: "Trade account + 18% decorator discount", price: 0, unit: "fixed", description: "Free trade account for CSCS / PASA decorators. 18% auto-discount applied at till. 30-day terms after credit check." }
    ],
    faq_items: [
      { q: "Are you cheaper than Brewers or Johnstone's?", a: "On Dulux Trade and Crown Trade lines yes — our trade-card discount is 18% vs the chain norm of 12-15%, and we keep our overheads tight with one shop. On F&B and Little Greene we match RRP for trade card holders." },
      { q: "Can you tint to any colour?", a: "Yes — Dulux Trade range covers any BS 4800, RAL, NCS, Pantone and full F&B/Little Greene colour cards by computer match. Bring a swatch, fabric, paint chip, anything — we'll match it." },
      { q: "How early can I collect on a job day?", a: "Counter opens 7.30am Monday to Friday. Common Dulux Trade and Crown stock is off-the-shelf; tinted colours take 5-10 minutes on the bench. Saturday from 8am." },
      { q: "Do you deliver?", a: "Yes — free local delivery on orders over £100 within Zones 1-3 (E, EC, N, NW, SE, SW, W postcodes via scooter), £20 within M25, £35 outside. Next-day standard, same-day in Hackney/Islington/Tower Hamlets if before 11am." },
      { q: "Will the F&B from you be the real thing?", a: "Yes — we're an official F&B retailer, ratecards same as the F&B shops, batch numbers logged. Trade card holders get 10% off F&B — not advertised by F&B themselves but it's our long-standing arrangement." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["Dulux Trade Flagship Centre", "Farrow & Ball Official Retailer", "Little Greene Trade Partner"],
    trade_memberships: ["British Coatings Federation (BCF)", "Painting and Decorating Association (PDA)"],
    dbs_checked: false,
    has_own_transport: true,
    has_own_tools: false,
    minimum_job_gbp: 15,
    free_site_visits: false,
    quote_availability: "Same-day counter quotes",
    quote_turnaround_hours: 4,
    current_status_note: "Counter open Mon-Fri 7.30am-5.30pm, Sat 8am-2pm. Tinting bench fully stocked.",
    availability: "now",
    reviews: [
      { customer_name: "Tom B.", rating: 5, title: "Tinted to BS 4800 off a magazine photo", body: "Brought in a magazine page with a colour I needed for a client's lounge. Priya put it on the spectro, gave me three Dulux Trade matches within 5 minutes, tinted 20L of Diamond Matt while I had a coffee. Decorator dream.", service_name: "BS 4800 / RAL / Pantone tinting (any colour)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/87.jpg" },
      { customer_name: "Naomi R.", rating: 5, title: "Real F&B at a real discount", body: "F&B Estate Emulsion at trade rate — most stockists pretend it's not possible. Priya's got the official supply line, batch numbers tracked. Saved 10% on a 22L order.", service_name: "Farrow & Ball Estate Emulsion 5L", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/women/88.jpg" },
      { customer_name: "Carl J.", rating: 5, title: "Counter staff opens at 7.30 sharp", body: "Phoned in 12 tins of Dulux Diamond Matt the night before, walked in at 7.30, loaded the van and was on site by 8. That's why I drive past two other stockists to get to Mare Street.", service_name: "Dulux Trade Diamond Matt 10L (washable)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/89.jpg" }
    ]
  },

  // 11. IRONMONGERY
  {
    trade_slug: "ironmongery",
    profile_slug: "demo-jonathan-eastwood-ironmongery-london",
    display_name: "Jonathan Eastwood",
    trading_name: "Eastwood Architectural Ironmongery",
    city: "London",
    postcode_prefix: "N1",
    whatsapp: "+44 7700 902232",
    email: "sales@eastwoodironmongery.co.uk",
    bio: "Eastwood Ironmongery has supplied architectural hardware out of Islington since 1996 — I joined in 2004 and bought it out in 2018. We hold deep stock on Carlisle Brass, Atlantic Handles, Heritage Brass, Hafele, Yale, ERA, Banham, Mortice & Brett, Frelan and Burlington Bathrooms hardware. About 12,000 SKUs on the shelf and online, with every common finish — satin nickel, polished chrome, satin brass, antique brass, matt black PVD, polished bronze. Specifiers, fit-out contractors and joiners account for most of the business; we do a fair bit of National Trust restoration work too. Trade accounts opened within 24 hours, 30-day terms, online portal with saved spec lists. Banham and Yale high-security lock cylinders held in stock and key-coded same day. Free delivery within M25 over £150, next-day country-wide.",
    years_in_trade: 22,
    start_year: 2004,
    priced_services: [
      { name: "Carlisle Brass Eden lever-on-rose (satin nickel)", price: 24, unit: "per pair", description: "Carlisle Brass Eden lever on rose, satin nickel, pair (front + back). Per pair ex VAT — trade price." },
      { name: "Heritage Brass cabinet handle 96mm (satin brass)", price: 14, unit: "per item", description: "Heritage Brass solid-brass cabinet pull, 96mm centres, satin brass finish. Per unit ex VAT." },
      { name: "Banham M2002 high-security mortice lock", price: 145, unit: "per item", description: "Banham M2002 BS3621 5-lever mortice deadlock, registered key cylinder. Per unit ex VAT — key-coded same day." },
      { name: "Yale Superior 1109 night latch", price: 68, unit: "per item", description: "Yale 1109 BS3621 night latch with deadlocking facility, polished brass. Per unit ex VAT." },
      { name: "Hafele soft-close cabinet hinge (Blum-style)", price: 4.50, unit: "per pair", description: "Hafele soft-close concealed cabinet hinge, 110-degree opening, Blum-equivalent. Per pair ex VAT." },
      { name: "Mortice & Brett satin brass espagnolette window handle", price: 38, unit: "per item", description: "Mortice & Brett solid-brass espagnolette window handle, satin brass, sold pair (handle + receiver). Per item ex VAT." },
      { name: "Project schedule / spec service (per project)", price: 0, unit: "fixed", description: "Free ironmongery schedule service for specifiers, architects and contractors. We'll spec the full set from your door schedule and quote it line-by-line." },
      { name: "Trade account (24-hour approval)", price: 0, unit: "fixed", description: "Free trade account for specifiers, contractors and joiners. 30-day terms after credit check, online spec portal with saved schedules." }
    ],
    faq_items: [
      { q: "Can you spec ironmongery from my architect's door schedule?", a: "Yes — send the schedule (PDF or Excel) and we'll come back within 48 hours with a full ironmongery spec line-by-line, priced and stock-checked. Free service, no obligation." },
      { q: "Do you stock matt black PVD finishes?", a: "Yes — Carlisle Brass, Atlantic and Heritage all do matt black PVD on their popular ranges, all stocked. PVD wears far better than powder-coat on door furniture — worth the extra." },
      { q: "Can you key-alike a Banham or Yale set?", a: "Yes — Banham M2002 cylinders key-coded same day, Yale Superior keyed-alike to your existing master if you bring a key or quote the keyway code. Banham restricted keyway requires customer signature." },
      { q: "Do you do conservation-spec ironmongery?", a: "Yes — Heritage Brass and Frelan ranges replicate Georgian and Victorian patterns, accepted by most conservation officers. We've supplied dozens of listed-building projects across north London." },
      { q: "How fast is delivery?", a: "Same-day within M25 on orders before 11am, free over £150. Next-day country-wide on stock items via DPD. Project orders pre-picked and palletised to site as scheduled." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["GAI Diploma in Architectural Ironmongery", "Banham Authorised Dealer"],
    trade_memberships: ["Guild of Architectural Ironmongers (GAI)"],
    dbs_checked: true,
    has_own_transport: true,
    has_own_tools: false,
    minimum_job_gbp: 25,
    free_site_visits: false,
    quote_availability: "Project schedules quoted within 48 hours",
    quote_turnaround_hours: 48,
    current_status_note: "Counter and online open Mon-Fri 8-5, Sat 9-1. PVD matt black stock just topped up.",
    availability: "now",
    reviews: [
      { customer_name: "Edward H.", rating: 5, title: "Specced a 32-door schedule in 36 hours", body: "Sent over a refurb door schedule from the architect. Jonathan came back with a full ironmongery spec line-by-line within 36 hours including PVD finishes and BS3621 lock options. Free service. Then delivered the lot palletised.", service_name: "Project schedule / spec service (per project)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/90.jpg" },
      { customer_name: "Rachel V.", rating: 5, title: "Banham keys cut same morning", body: "Walked in at 9am needing M2002 cylinder key-coded to an existing keyway. Out by 9.45 with two keys cut. Knew the keyway by sight.", service_name: "Banham M2002 high-security mortice lock", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/women/91.jpg" },
      { customer_name: "Marcus L.", rating: 5, title: "Had what no-one else stocked", body: "Needed satin-bronze espagnolette window handles for a 1920s house in Hampstead. Mortice & Brett had them — three other ironmongers said discontinued. Eastwood had a full set on the shelf.", service_name: "Mortice & Brett satin brass espagnolette window handle", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/92.jpg" }
    ]
  },

  // 12. PPE SUPPLIER
  {
    trade_slug: "ppe-supplier",
    profile_slug: "demo-kieran-okeefe-ppe-supplier-manchester",
    display_name: "Kieran O'Keefe",
    trading_name: "O'Keefe Site Safety Supplies",
    city: "Manchester",
    postcode_prefix: "M40",
    whatsapp: "+44 7700 902246",
    email: "trade@okeefesafety.co.uk",
    bio: "O'Keefe Site Safety supplies PPE and workwear to construction sites, scaffolding gangs, civils contractors and fit-out crews across the North West. We've been in Newton Heath since 2008. Stock includes JSP MK7 and EVO5 hard hats, ToughBuilt knee pads and tool belts, Pyramex hi-vis, Portwest Aramark workwear, Skytec gloves, Showa nitrile, Snickers and Mascot trousers. Around 6,000 SKUs. Everything we sell carries the relevant BSI EN standard (EN 397, EN 471, EN 388, EN 388:2016 etc.) — printed on the box and on our invoices for your H&S file. Trade accounts opened within 48 hours, site delivery free over £100 within 25 miles of M40, next-day country-wide via DPD. Group discounts on hi-vis and hard hat bulk orders (10+) for site mobilisation.",
    years_in_trade: 18,
    start_year: 2008,
    priced_services: [
      { name: "JSP EVO5 hard hat with chinstrap (any colour)", price: 12.50, unit: "per item", description: "JSP EVO5 vented hard hat, EN 397 + EN 50365, with 4-point chinstrap. Per hat ex VAT, 10+ discount 10%." },
      { name: "JSP MK7 vented hard hat (basic)", price: 8.50, unit: "per item", description: "JSP MK7 vented hard hat, EN 397, replaceable harness. Per hat ex VAT — site issue volume favourite." },
      { name: "Pyramex Class 2 hi-vis vest (yellow, M-XXXL)", price: 5.20, unit: "per item", description: "EN 471 Class 2 hi-vis vest, yellow, hook-and-loop closure. Per vest ex VAT — 50+ bulk discount 15%." },
      { name: "Skytec Argon EN 388 cut-resistant gloves", price: 4.80, unit: "per pair", description: "Skytec Argon Level 5 cut-resistant glove, EN 388:2016 4543C. Per pair ex VAT, 24-pack discount." },
      { name: "ToughBuilt GelFit knee pads (pair)", price: 32, unit: "per pair", description: "ToughBuilt GelFit knee pads, snap-on shell, EN 14404. Per pair ex VAT." },
      { name: "Portwest Aramark FR coverall (orange)", price: 78, unit: "per item", description: "Flame-resistant orange coverall, EN ISO 11612 + EN 1149-5. Per coverall ex VAT — utilities + civils issue." },
      { name: "Mascot Customised harness (EN 361 + EN 358)", price: 145, unit: "per item", description: "Full body harness with positioning belt, EN 361 + EN 358. Per harness ex VAT, includes 6-month inspection record card." },
      { name: "Trade account + 48-hour approval", price: 0, unit: "fixed", description: "Trade account opened within 48 hours for VAT-registered contractors. 30-day terms after credit check. Online ordering portal with saved site lists." }
    ],
    faq_items: [
      { q: "Do all your products carry the BSI EN standard?", a: "Every single item. Standard codes (EN 397, EN 471, EN 388, EN ISO 11612 etc.) are printed on the box, on our invoices and on our website. Tick that off your H&S compliance audit." },
      { q: "Can I get hi-vis and hard hats printed with our logo?", a: "Yes — minimum order 25 units, screen-print or heat-transfer logo on hi-vis vests and side-print on hard hats. 7-10 working days lead time. Set-up fee one-off." },
      { q: "Do you do same-day delivery in Manchester?", a: "Yes within 25 miles of M40 if ordered before noon — free over £100 net. Outside that radius next-day DPD country-wide." },
      { q: "How do I open a trade account?", a: "Online application with VAT number and one form of ID, 48-hour approval. 30-day terms after credit check. Online portal with saved purchase lists for repeat site issues." },
      { q: "Do you stock harness inspection logs?", a: "Yes — every harness, lanyard and fall arrester we sell comes with a 6-month inspection record card. We also do annual harness inspections in-house — £18 per harness, certified by our LOLER-trained inspector." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["JSP Authorised Dealer", "LOLER Harness Inspector (in-house)"],
    trade_memberships: ["British Safety Industry Federation (BSIF)"],
    dbs_checked: false,
    has_own_transport: true,
    has_own_tools: false,
    minimum_job_gbp: 25,
    free_site_visits: false,
    quote_availability: "Same-day bulk quotes",
    quote_turnaround_hours: 6,
    current_status_note: "Counter open Mon-Fri 7am-5pm. Hi-vis and JSP hat stock healthy for site mobilisations.",
    availability: "now",
    reviews: [
      { customer_name: "Liam B.", rating: 5, title: "30-hat site mobilisation next morning", body: "Phoned at 4pm Thursday for 30 JSP EVO5 hats with our logo on the side for a Friday mobilisation. Kieran got the print done overnight, hats delivered to site at 7am Friday. Honestly didn't think it was possible.", service_name: "JSP EVO5 hard hat with chinstrap (any colour)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/93.jpg" },
      { customer_name: "Joseph N.", rating: 5, title: "BSI codes printed on the invoice — auditor loved it", body: "H&S audit asked for proof of EN certification on every PPE item. Kieran's invoices already list every EN standard against every line. Auditor signed it off in 20 minutes.", service_name: "Pyramex Class 2 hi-vis vest (yellow, M-XXXL)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/94.jpg" },
      { customer_name: "Owen K.", rating: 5, title: "Harness inspections in-house", body: "20 harnesses sent in for annual inspection — back within a week, certificates filed, two replaced where stitching had gone. Cheaper than the inspection contractor we used to use, and faster.", service_name: "Mascot Customised harness (EN 361 + EN 358)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/95.jpg" }
    ]
  },

  // 13. TOOL SHOP
  {
    trade_slug: "tool-shop",
    profile_slug: "demo-darren-paxton-tool-shop-sheffield",
    display_name: "Darren Paxton",
    trading_name: "Paxton Tool Centre",
    city: "Sheffield",
    postcode_prefix: "S9",
    whatsapp: "+44 7700 902259",
    email: "sales@paxtontools.co.uk",
    bio: "Paxton Tool Centre has been on Carlisle Street in Attercliffe since 2002. Deep stock on DeWalt, Makita, Milwaukee 18V platforms, Festool, Stanley FatMax hand tools, Bahco, Knipex and a serious accessories wall covering circular saw blades, drill bits, router cutters, abrasives and consumables. Around 11,000 lines. We're a Festool service centre — repairs in-house with genuine parts, typically 5-7 working days turnaround. Trade accounts opened in 24 hours, 12% off trade list automatic for registered traders. Same-day click-and-collect across the M1 corridor, next-day Royal Mail country-wide. We don't sell counterfeit kit — every battery, every consumable comes from authorised distribution channels and we'll show you the box-and-batch if you ask.",
    years_in_trade: 24,
    start_year: 2002,
    priced_services: [
      { name: "DeWalt DCD796 18V combi drill kit (2x5Ah)", price: 245, unit: "per item", description: "DeWalt DCD796P2 18V XR brushless combi drill, 2x 5.0Ah batteries, charger, TSTAK case. Per kit ex VAT." },
      { name: "Makita DLX2145TJ 18V combi + impact twin pack", price: 320, unit: "per item", description: "Makita LXT twin kit: DHP482 combi + DTD152 impact driver, 2x 5.0Ah batteries, charger, makpac. Per kit ex VAT." },
      { name: "Milwaukee M18 FPP2A2-502X fuel twin kit", price: 380, unit: "per item", description: "Milwaukee M18 Fuel brushless combi + impact, 2x 5.0Ah batteries, dynacase. Per kit ex VAT — flagship trade pack." },
      { name: "Festool TS 55 FEBQ-Plus plunge saw + 1.4m rail", price: 580, unit: "per item", description: "Festool TS 55 plunge saw with 1400mm rail and systainer. Genuine UK Festool stock with 3-year warranty. Per item ex VAT." },
      { name: "Stanley FatMax XL 35-piece socket set 1/2in", price: 78, unit: "per item", description: "Stanley FatMax 35pc 1/2in drive socket set, chrome-vanadium, hard case. Per set ex VAT." },
      { name: "Bahco ERGO bi-material screwdriver set 7-piece", price: 32, unit: "per item", description: "Bahco BE-9882 ERGO bi-material screwdriver set, 7-piece slotted + Phillips. Per set ex VAT." },
      { name: "Festool service centre (in-house repair)", price: 0, unit: "fixed", description: "In-house Festool authorised service centre. Diagnostic quote within 5 working days. Genuine parts only, original warranty maintained." },
      { name: "Trade account + 12% trade discount", price: 0, unit: "fixed", description: "Free trade account for registered traders. 12% auto-discount applied at till. 30-day terms after credit check." }
    ],
    faq_items: [
      { q: "Are your batteries genuine?", a: "Every battery comes from authorised UK distribution — DeWalt direct, Makita UK, Milwaukee TTI UK. We'll show you the box and the batch number if you have any doubt. Counterfeit cells are dangerous and we don't touch them." },
      { q: "Do you repair power tools?", a: "Yes — full Festool authorised service centre on site with genuine parts. DeWalt and Makita repairs we send to the manufacturer service hubs but we manage the collection and return. Typical Festool turnaround 5-7 working days." },
      { q: "Can I open a trade account?", a: "Yes — VAT-registered trader, 24-hour approval, 12% off trade price auto-applied. 30-day terms after a quick credit check." },
      { q: "What's the difference between DeWalt XR and Atomic?", a: "XR is the standard 18V brushless line; Atomic is a sub-compact range — same battery platform, smaller body, slightly lower torque. Atomic is great for cabinet fit-out and ceiling work; XR is the workhorse for general site." },
      { q: "Do you do click and collect?", a: "Yes — order online by noon, pick up after 3pm same day from the Carlisle Street counter. Next-day Royal Mail country-wide on stock items." }
    ],
    is_insured: true,
    insurance_cover_gbp: 2000000,
    qualifications: ["Festool Authorised Service Centre", "DeWalt Approved Dealer", "Makita Authorised Reseller"],
    trade_memberships: ["British Hardware Federation (BHF)"],
    dbs_checked: false,
    has_own_transport: true,
    has_own_tools: false,
    minimum_job_gbp: 15,
    free_site_visits: false,
    quote_availability: "Same-day counter quotes",
    quote_turnaround_hours: 4,
    current_status_note: "Counter open Mon-Sat. Strong stock on DeWalt XR and Festool TS 55 this month.",
    availability: "now",
    reviews: [
      { customer_name: "Ryan F.", rating: 5, title: "Festool repair in 4 days", body: "Sent in a TS 55 with a knackered plunge mechanism. Diagnosis in 2 days, repaired with genuine parts in another 2. Came back with the original 3-year warranty intact. Beats the 3-week wait at the main service hub.", service_name: "Festool service centre (in-house repair)", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/men/96.jpg" },
      { customer_name: "Connor B.", rating: 5, title: "Trade discount applied without me asking", body: "First trip in with my new trade card and the 12% came off the till automatically. £45 saved on a Makita twin pack vs Screwfix. Easy decision who I'm buying off from now on.", service_name: "Makita DLX2145TJ 18V combi + impact twin pack", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/97.jpg" },
      { customer_name: "Aaron P.", rating: 5, title: "Ordered Wednesday, on site Thursday", body: "Phoned in a Milwaukee M18 Fuel twin kit Wednesday afternoon, ready for collection at 4pm same day. Genuine UK stock with full warranty. That's how a tool shop should run.", service_name: "Milwaukee M18 FPP2A2-502X fuel twin kit", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/98.jpg" }
    ]
  },

  // 14. LANDSCAPE SUPPLIES
  {
    trade_slug: "landscape-supplies",
    profile_slug: "demo-michael-armitage-landscape-supplies-derby",
    display_name: "Michael Armitage",
    trading_name: "Armitage Landscape Centre",
    city: "Derby",
    postcode_prefix: "DE21",
    whatsapp: "+44 7700 902273",
    email: "trade@armitagelandscape.co.uk",
    bio: "Armitage Landscape Centre has been on the same yard off the A52 since 1999 — my old man started it, I joined in 2008 and run it now. We're a Marshalls Register Approved reseller, Tobermore stockist, Brett Landscaping authorised partner and Bradstone trade dealer. Yard holds around 1.5 acres of paving, decking, fencing, sleepers, edging, kerbs, sub-base and decorative aggregates on pallets and in bays. Trade accounts open same day for landscapers and ground-workers — 12% off trade list, 30-day terms after credit check. We deliver across Derbyshire, Notts and South Yorkshire on our own crane-arm lorries — Hiab to back garden if access allows. Free local delivery over £350 within 15 miles of DE21. We don't lay paving ourselves but we keep a list of recommended local landscapers, all Marshalls Register members.",
    years_in_trade: 18,
    start_year: 2008,
    priced_services: [
      { name: "Marshalls Tegula Trio block paving (per sqm)", price: 38, unit: "per sqm", description: "Marshalls Tegula riven block paving, mixed 3-size pack. Per sqm ex VAT — driveway favourite." },
      { name: "Marshalls Saxon textured slab 450x450 (per sqm)", price: 32, unit: "per sqm", description: "Marshalls Saxon textured concrete slab, 450x450x35mm. Per sqm ex VAT — patio + path standard." },
      { name: "Tobermore Sienna setts (per sqm)", price: 48, unit: "per sqm", description: "Tobermore Sienna granite-effect concrete setts, premium textured finish. Per sqm ex VAT." },
      { name: "Bradstone Smooth Natural Sandstone paving 600x900 (per sqm)", price: 58, unit: "per sqm", description: "Bradstone smooth Indian sandstone, calibrated 22mm. Per sqm ex VAT — high-spec garden patio." },
      { name: "Treated softwood deck board 28x145 (per linear m)", price: 4.20, unit: "per linear m", description: "Pressure-treated softwood deck board, smooth/grooved reversible. Per linear m ex VAT — 3.6m or 4.8m lengths." },
      { name: "Closeboard fence panel 6x6 (treated)", price: 65, unit: "per item", description: "Pressure-treated closeboard fence panel, 1830x1830mm, vertical featheredge. Per panel ex VAT." },
      { name: "Treated softwood sleeper 200x100x2400 (per item)", price: 24, unit: "per item", description: "Pressure-treated softwood sleeper, 200x100x2.4m. Per item ex VAT — bed-edging + retaining favourite." },
      { name: "Free local delivery (within 15 miles, over £350)", price: 0, unit: "fixed", description: "Free same/next-day delivery within 15 miles of DE21 for trade orders over £350 net. Hiab to back garden where access allows." }
    ],
    faq_items: [
      { q: "Are you cheaper than the national landscape chains?", a: "On Marshalls and Tobermore lines — we match RRP for trade card holders and beat the chains on bulk pallet quantities. Bradstone we sometimes lose on heavy promotions, sometimes win — depends on the month." },
      { q: "Do you Hiab into back gardens?", a: "Yes where access allows — typical reach 6m over a single-storey roof. Tight access (terraces, side-passages) we'll do barrow drops or recommend a half-pallet split for manual carry." },
      { q: "What's the lead time on natural stone?", a: "Indian sandstone and porcelain typically 5-7 days from order if not in stock. Marshalls and Tobermore stock paving is same/next day. Premium Marshalls Symphony range and bespoke colours 2-3 weeks." },
      { q: "Can my landscaper open a trade account?", a: "Yes — VAT cert, ID, quick credit check. Same-day approval most days for registered landscapers, 30-day terms. 12% auto-discount on trade list." },
      { q: "Do you lay the paving yourselves?", a: "No — but we keep a vetted list of 6 Marshalls Register landscapers across Derbyshire and Notts. They quote you separately so margins are transparent." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["Marshalls Register Approved Reseller", "Tobermore Trade Partner"],
    trade_memberships: ["BALI (British Association of Landscape Industries)", "Builders Merchants Federation (BMF)"],
    dbs_checked: false,
    has_own_transport: true,
    has_own_tools: false,
    minimum_job_gbp: 80,
    free_site_visits: false,
    quote_availability: "Same-day yard quotes",
    quote_turnaround_hours: 8,
    current_status_note: "Yard open Mon-Sat 7-5. Strong Marshalls and Bradstone stock for spring 2026 patio season.",
    availability: "now",
    reviews: [
      { customer_name: "Chris L.", rating: 5, title: "Hiab dropped 4 pallets in a tight back garden", body: "Side access was 3m wide and a dead end. The Hiab driver swung 4 pallets of Tegula over the side wall like it was nothing. Saved me half a day of barrowing. Trade discount applied without me asking.", service_name: "Marshalls Tegula Trio block paving (per sqm)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/99.jpg" },
      { customer_name: "Daniel R.", rating: 5, title: "Spec was matched off a photo I sent", body: "Sent a photo of a Bradstone sandstone patio my client wanted to copy. Michael ID'd the exact range from the texture and tone, had a sample on the counter for me by lunchtime. That's a yardman who knows his product.", service_name: "Bradstone Smooth Natural Sandstone paving 600x900 (per sqm)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/12.jpg" },
      { customer_name: "Mason A.", rating: 5, title: "Ordered Tuesday, delivered Wednesday morning", body: "12 fence panels and 30 sleepers ordered late Tuesday. On site 8am Wednesday, all dry, none broken. Driver helped offload too. Trade account opened same week, easy as.", service_name: "Closeboard fence panel 6x6 (treated)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/13.jpg" }
    ]
  },

  // 15. AGGREGATE SUPPLIER
  {
    trade_slug: "aggregate-supplier",
    profile_slug: "demo-paul-blackshaw-aggregate-supplier-stoke",
    display_name: "Paul Blackshaw",
    trading_name: "Blackshaw Aggregates",
    city: "Stoke-on-Trent",
    postcode_prefix: "ST3",
    whatsapp: "+44 7700 902286",
    email: "yard@blackshawaggregates.co.uk",
    bio: "Blackshaw Aggregates has run a weighbridge-ticketed yard near Longton since 1995 — my dad started it and I took it on in 2014. We supply sand, gravel, MOT Type 1, ballast, hardcore, decorative aggregates and topsoil across the Midlands. Stock comes from quarries we know — Cemex, Hanson and a couple of independent Staffordshire pits — and every load goes over our weighbridge so what you pay for is what's on the truck. Available as bulk bags (850kg standard), loose by tipper (8t, 16t, 20t) or by 8-wheel Hiab if you need it placed rather than tipped. Trade accounts open within 24 hours, 30-day terms. Free delivery within 10 miles of ST3 on orders over £200 net, sliding scale beyond. We don't sell anything we wouldn't tip onto our own driveway.",
    years_in_trade: 12,
    start_year: 2014,
    priced_services: [
      { name: "MOT Type 1 sub-base (per bulk bag, 850kg)", price: 85, unit: "per item", description: "Limestone MOT Type 1 sub-base, BS EN 13242 compliant. Per 850kg bulk bag ex VAT, weighbridge-ticketed." },
      { name: "MOT Type 1 sub-base (loose tipper, per tonne)", price: 32, unit: "per tonne", description: "Loose MOT Type 1 by 8t/16t/20t tipper. Per tonne ex VAT — minimum 4 tonne load, weighbridge ticket supplied." },
      { name: "Sharp sand (per bulk bag, 850kg)", price: 68, unit: "per item", description: "Washed sharp concreting sand, BS EN 12620. Per 850kg bulk bag ex VAT." },
      { name: "Building sand (per bulk bag, 850kg)", price: 62, unit: "per item", description: "Soft red building sand for mortar mixes. Per 850kg bulk bag ex VAT." },
      { name: "20mm gravel (per bulk bag, 850kg)", price: 78, unit: "per item", description: "20mm clean limestone gravel, BS EN 12620. Per 850kg bulk bag ex VAT." },
      { name: "Ballast 20mm (per bulk bag, 850kg)", price: 72, unit: "per item", description: "20mm ballast (gravel + sand pre-mix) for concrete. Per bulk bag ex VAT." },
      { name: "Hiab placement (per drop, within 10 miles)", price: 65, unit: "per visit", description: "8-wheel Hiab placement of bulk bags or pallets into back garden or behind fence. Per drop within 10 miles of ST3." },
      { name: "Free delivery (within 10 miles, over £200)", price: 0, unit: "fixed", description: "Free tipper or van delivery within 10 miles of ST3 on orders over £200 net. Sliding scale beyond — quote on order." }
    ],
    faq_items: [
      { q: "Bulk bag or loose — which is cheaper?", a: "Loose by tipper is cheaper per tonne — typically £32 a tonne for MOT vs £85 for an 850kg bulk bag (= £100/t). But you need somewhere to tip it. If your driveway will take a 16t load and you can move it within a few days, go loose. If access is tight or you need it over time, bulk bag." },
      { q: "Is the weighbridge ticket accurate?", a: "Our weighbridge is calibrated annually by Avery Weigh-Tronix and certified. Ticket shows weight on, weight off and net delivered. You pay for net, not gross." },
      { q: "What's the minimum tipper load?", a: "4 tonnes is the practical minimum on the 8-tonne tipper — below that the per-tonne cost makes a bulk bag better value. 16t and 20t trucks for larger orders, free local delivery on 16t+ orders within 10 miles." },
      { q: "Do you do decorative aggregates?", a: "Yes — Cotswold buff, Scottish Cobbles, slate chips, granite gravel, polar white marble — all by bulk bag. Order before midweek for weekend delivery." },
      { q: "How fast can you deliver?", a: "Same day on bulk bag orders before 11am within 10 miles, next-day country-wide. Tipper loads typically next-day depending on truck schedule." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["BMF Aggregate Course", "Avery Weighbridge Calibrated"],
    trade_memberships: ["Mineral Products Association (MPA)", "Builders Merchants Federation (BMF)"],
    dbs_checked: false,
    has_own_transport: true,
    has_own_tools: false,
    minimum_job_gbp: 60,
    free_site_visits: false,
    quote_availability: "Same-day weighbridge quotes",
    quote_turnaround_hours: 4,
    current_status_note: "Yard open Mon-Fri 7am-5pm, Sat 7-12. Strong stock on MOT, sand and ballast.",
    availability: "now",
    reviews: [
      { customer_name: "Gary T.", rating: 5, title: "20 tonnes tipped to the inch", body: "Ordered 20t of MOT Type 1 for a driveway sub-base. Driver tipped it exactly where I wanted — neat heap right next to the dig. Weighbridge ticket showed 20.04t net, paid for what arrived.", service_name: "MOT Type 1 sub-base (loose tipper, per tonne)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/14.jpg" },
      { customer_name: "Wayne H.", rating: 5, title: "Hiab over a fence — flawless", body: "Back garden with no rear access. Paul's Hiab driver swung 4 bulk bags of sharp sand and ballast over a 7ft fence into the exact spot I needed. No damage, no faff.", service_name: "Hiab placement (per drop, within 10 miles)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/15.jpg" },
      { customer_name: "Jordan B.", rating: 5, title: "Trade rate, no haggle, weighbridge ticket", body: "Opened the trade account on the Monday, ordered 8t of ballast loose Tuesday, ticket in the cab when the driver arrived showing net delivered. 30-day terms applied. Cleanest aggregate buy I've done in years.", service_name: "Ballast 20mm (per bulk bag, 850kg)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/16.jpg" }
    ]
  },

  // 16. ROOFING SUPPLIES
  {
    trade_slug: "roofing-supplies",
    profile_slug: "demo-callum-mcphee-roofing-supplies-belfast",
    display_name: "Callum McPhee",
    trading_name: "McPhee Roofing Supplies",
    city: "Belfast",
    postcode_prefix: "BT5",
    whatsapp: "+44 7700 902299",
    email: "trade@mcpheeroofing.co.uk",
    bio: "McPhee Roofing has supplied trade roofers across NI and Donegal since 2006. We're a Marley Eternit + Redland authorised stockist, Welsh slate direct from Penrhyn quarry, Klober membrane partner and a full Lead Sheet Association supplier for Code 4, 5, 6 and 7 milled lead. Stock breadth runs to around 3,800 lines — interlocking tiles, plain tiles, ridge and hip, battens (BS 5534 Grade A), breather membranes, dry verge systems, lead, soakers, fixings and underlay. Trade accounts open within 24 hours, 30-day terms after credit check — 14% trade discount auto-applied for registered roofers. We deliver across Northern Ireland and into Donegal with our own crane-arm lorries — typical lead time same-day or next-day on stock items. We don't sell to homeowners DIYing a roof — this is a trade-only counter.",
    years_in_trade: 20,
    start_year: 2006,
    priced_services: [
      { name: "Marley Modern interlocking tile (per 1000)", price: 685, unit: "per item", description: "Marley Modern smooth concrete interlocking tile, anthracite. Per 1000 ex VAT — bulk order for full re-roof." },
      { name: "Redland 49 plain clay tile (per 1000)", price: 1450, unit: "per item", description: "Redland 49 plain clay tile, natural red. Per 1000 ex VAT — traditional double-lap." },
      { name: "Welsh slate Penrhyn Heather Blue (per 1000, 500x250)", price: 4850, unit: "per item", description: "Penrhyn Welsh slate, premium Heather Blue, 500x250mm. Per 1000 ex VAT — specifier-grade roofing." },
      { name: "BS 5534 Grade A treated batten 25x50 (per linear m)", price: 0.85, unit: "per linear m", description: "BS 5534 Grade A treated softwood batten, 25x50mm. Per linear m ex VAT — graded and stamped to standard." },
      { name: "Klober Permo Air breather membrane (1.5m x 50m roll)", price: 165, unit: "per item", description: "Klober Permo Air vapour-permeable underlay, 1.5m x 50m roll. BS 5534-compliant. Per roll ex VAT." },
      { name: "Code 4 milled lead (per linear m, 600mm wide)", price: 38, unit: "per linear m", description: "Lead Sheet Association Code 4 milled lead, 600mm wide. Per linear m ex VAT — flashings + soakers." },
      { name: "Dry verge unit Marley (per linear m)", price: 12, unit: "per linear m", description: "Marley dry verge system, anthracite. Per linear m ex VAT — modern fixed-verge alternative to bedded mortar." },
      { name: "Trade account + 14% trade discount", price: 0, unit: "fixed", description: "Free trade account for registered roofers. 14% auto-discount on trade list. 30-day terms after credit check." }
    ],
    faq_items: [
      { q: "What's the lead time on Welsh slate?", a: "Penrhyn Heather Blue we stock continuously — same/next-day on quantities up to 5000. Larger orders or premium grades 5-10 days direct from the quarry. Slate certificate of origin supplied with every load." },
      { q: "Are your battens BS 5534 graded?", a: "Yes — every batten we sell is stamped Grade A to BS 5534. Building Control won't sign off the roof otherwise and we won't risk our reputation on cheaper ungraded stock." },
      { q: "Can I open a trade account?", a: "Yes — trade only, no DIY accounts. Registered roofer or builder with VAT cert, 24-hour approval, 14% auto-discount, 30-day terms after credit check." },
      { q: "Do you stock Klober membranes?", a: "Yes — full Klober range: Permo Air, Permo Forte, Wallint and Permo Sec. Stock the Permo Air 1.5m x 50m roll continuously, larger formats and dry fix systems next-day from regional warehouse." },
      { q: "How fast is lead delivery?", a: "Code 4-7 milled lead in standard widths (200/240/300/450/600mm) is same-day for stock cuts, next-day for bespoke cuts. Lead Sheet Association certificate supplied with every order." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["Marley Authorised Stockist", "Lead Sheet Association Supplier", "Klober Trade Partner"],
    trade_memberships: ["National Federation of Roofing Contractors (NFRC)", "Builders Merchants Federation (BMF)"],
    dbs_checked: false,
    has_own_transport: true,
    has_own_tools: false,
    minimum_job_gbp: 50,
    free_site_visits: false,
    quote_availability: "Same-day counter quotes",
    quote_turnaround_hours: 6,
    current_status_note: "Counter open Mon-Fri 7am-5pm, Sat 7-12. Strong Welsh slate stock. Marley anthracite in depth.",
    availability: "now",
    reviews: [
      { customer_name: "Stephen R.", rating: 5, title: "Welsh slate certificate supplied without asking", body: "Building Control wanted proof of origin on the Penrhyn slate. Callum had the certificate stapled to the delivery note. Three other suppliers I tried had no idea what I was asking for.", service_name: "Welsh slate Penrhyn Heather Blue (per 1000, 500x250)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/17.jpg" },
      { customer_name: "Patrick D.", rating: 5, title: "Marley anthracite delivered next morning", body: "Phoned in 3500 Marley Modern tiles Thursday afternoon for a Friday tile-strip-and-replace. Crane-arm lorry on site 7.30am Friday, lifted onto the scaffold by 8.15. That's how you keep a roofing job moving.", service_name: "Marley Modern interlocking tile (per 1000)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/18.jpg" },
      { customer_name: "Ciaran K.", rating: 5, title: "Lead cut to spec on the bench", body: "Needed Code 5 lead in 380mm width for a tricky chimney detail. Counter cut it on the lead bench to my dimensions while I waited. No mucking about. Lead Sheet Association cert in the bag.", service_name: "Code 4 milled lead (per linear m, 600mm wide)", project_type: "repair", avatar_url: "https://randomuser.me/api/portraits/men/19.jpg" }
    ]
  },

  // 17. INSULATION SUPPLIES
  {
    trade_slug: "insulation-supplies",
    profile_slug: "demo-frank-novosel-insulation-supplies-coventry",
    display_name: "Frank Novosel",
    trading_name: "Novosel Insulation Direct",
    city: "Coventry",
    postcode_prefix: "CV6",
    whatsapp: "+44 7700 902312",
    email: "trade@novoselinsulation.co.uk",
    bio: "Novosel Insulation Direct has been on Foleshill Road since 2010 — I worked for a national insulation distributor for fifteen years before going on my own. Specialist stockist for Kingspan Kooltherm and Therma PIR, Celotex GA4000 and TB4000, Rockwool Flexi and RWA45, Knauf Earthwool and Loft Roll 44, plus Actis multifoil, OSB3 reinforcement boards and full vapour control layer accessories. Around 1,200 SKUs — we focus deep on insulation rather than broad on builder's merchant lines. Trade accounts opened within 24 hours, 30-day terms after credit check — 10% auto-discount for trade. Same-day delivery across the Midlands on our own articulated trailers — Hiab offload for PIR pallets to first-floor balconies and roofs. We hold the U-value calculation service in-house — submit your wall, floor or roof spec and we'll calc the right PIR thickness against your target U-value within 24 hours.",
    years_in_trade: 16,
    start_year: 2010,
    priced_services: [
      { name: "Kingspan Kooltherm K112 100mm framing board (per sqm)", price: 32, unit: "per sqm", description: "Kingspan Kooltherm K112 phenolic insulation, 100mm. Per sqm ex VAT — premium thermal performance." },
      { name: "Celotex GA4000 100mm PIR board (per sqm)", price: 22, unit: "per sqm", description: "Celotex GA4000 PIR board, 100mm. Per sqm ex VAT — general-purpose PIR." },
      { name: "Celotex TB4000 75mm PIR board (per sqm)", price: 16, unit: "per sqm", description: "Celotex TB4000 thin PIR board, 75mm. Per sqm ex VAT — partial-fill cavity favourite." },
      { name: "Rockwool RWA45 100mm slab (per pack)", price: 38, unit: "per item", description: "Rockwool RWA45 mineral wool slab, 100mm. Per 3.6sqm pack ex VAT — partition + acoustic separation." },
      { name: "Knauf Earthwool Loft Roll 44 200mm (per roll, 5.93sqm)", price: 28, unit: "per item", description: "Knauf Earthwool Loft Roll 44, 200mm thick, 5.93sqm coverage. Per roll ex VAT — Building Regs compliant attic upgrade." },
      { name: "Actis Hybris multifoil 105mm (per sqm)", price: 26, unit: "per sqm", description: "Actis Hybris 105mm honeycomb multifoil insulation. Per sqm ex VAT — slim-line solution for warm roofs." },
      { name: "Free U-value calculation (per project)", price: 0, unit: "fixed", description: "Free in-house U-value calc service — submit your wall, floor or roof spec and target U-value, we'll calc the right PIR/mineral wool thickness within 24 hours." },
      { name: "Trade account + 10% trade discount", price: 0, unit: "fixed", description: "Trade account opened within 24 hours for VAT-registered traders. 10% auto-discount on trade list. 30-day terms after credit check." }
    ],
    faq_items: [
      { q: "Which PIR is best — Kingspan, Celotex or Quinn?", a: "Kingspan Kooltherm (phenolic) has the best thermal performance per mm — 0.018 W/mK. Celotex and Quinn PIR sit at 0.022 W/mK — they're 20% thicker for the same U-value but typically 30-40% cheaper. Pick on space vs budget." },
      { q: "Do you do U-value calcs?", a: "Yes — free service for trade customers. Send your wall/floor/roof build-up spec and target U-value to the email and we'll calc the right insulation thickness within 24 hours. Includes Part L 2026 compliance check." },
      { q: "What's the lead time on Kingspan?", a: "Kooltherm 100mm stocked in volume — same/next-day on full pallet quantities. Thinner gauges (25mm, 40mm) usually 24-48 hours. Bespoke thicknesses 5-7 days from Kingspan direct." },
      { q: "Can you Hiab onto a roof?", a: "Yes — articulated trailer with crane-arm reach up to 12m. PIR pallets onto scaffold lifts, first-floor balconies or directly onto warm-roof builds where access allows. Quote on order." },
      { q: "Do you stock vapour control layers and tapes?", a: "Yes — full Pro Clima Intello and DB+ membranes, Tescon Vana tape, Soudal vapour-tight foam. Air-tightness package supplied alongside insulation orders." }
    ],
    is_insured: true,
    insurance_cover_gbp: 5000000,
    qualifications: ["Kingspan Authorised Distributor", "Celotex Trade Partner", "BBA-certified products only"],
    trade_memberships: ["British Board of Agrément (BBA) supplier register", "Builders Merchants Federation (BMF)"],
    dbs_checked: false,
    has_own_transport: true,
    has_own_tools: false,
    minimum_job_gbp: 60,
    free_site_visits: false,
    quote_availability: "U-value calcs returned within 24 hours",
    quote_turnaround_hours: 24,
    current_status_note: "Counter open Mon-Fri 7am-5pm. Kingspan and Celotex stock holding well. Loft roll plentiful.",
    availability: "now",
    reviews: [
      { customer_name: "Andrew P.", rating: 5, title: "U-value calc back in 4 hours", body: "Sent over a warm-roof spec at 9am asking for the right Kingspan thickness to hit 0.13 W/m²K. Frank came back by 1pm with the calc, a Part L 2026 compliance note and the trade price for 84sqm. That's a specialist supplier.", service_name: "Free U-value calculation (per project)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/20.jpg" },
      { customer_name: "Marcus J.", rating: 5, title: "Hiab placed PIR onto the scaffold", body: "Three pallets of Celotex GA4000 100mm lifted straight onto the second-storey scaffold lift by the Hiab driver. Saved us a full day of carrying. Trade discount applied without me asking.", service_name: "Celotex GA4000 100mm PIR board (per sqm)", project_type: "renovation", avatar_url: "https://randomuser.me/api/portraits/men/21.jpg" },
      { customer_name: "Liam B.", rating: 5, title: "Had Kingspan when nowhere else did", body: "Phoned around four merchants for 100mm Kooltherm — all on backorder. Novosel had a full pallet on the shelf and another two on the next delivery. Cleared a major bottleneck on the build.", service_name: "Kingspan Kooltherm K112 100mm framing board (per sqm)", project_type: "new_build", avatar_url: "https://randomuser.me/api/portraits/men/22.jpg" }
    ]
  }
];
