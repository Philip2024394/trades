#!/usr/bin/env node
// One-off · retroactively rewrite recent facts in Nex workshop voice.
// After user approval 2026-07-23.

import { promises as fs } from "node:fs";
import path from "node:path";

const draftPath = path.join(process.cwd(), ".author-studio-drafts", "staircase", "craft.json");
const draft = JSON.parse(await fs.readFile(draftPath, "utf8"));

const rewrites = {
  // Monkey Volute definition
  "direct.fact.mrxoqk5s.ulzt":
    "A Monkey Volute is that spiral scroll at the very start of a traditional staircase handrail — the bit that curls round on the first step and then rises up. You'll also hear it called a Starting Volute, a Starting Scroll, or just Monkey's Tail (joiners love that name — it's the shape of the curl). The word 'volute' itself is old, from Greek and Roman columns, and staircase makers borrowed it because the same spiral works beautifully as the starting point of a handrail. It sits above a curtail or bullnose starting step, where the tread pokes out past the side of the staircase to give the scroll room to sit. It looks good, but it's practical too — you naturally grab hold of it as you start climbing, and it flows straight into the main handrail without a break. One thing to know: volutes come in left-hand and right-hand versions depending on which side your handrail starts, so you have to get that right at the design stage. Here's what we notice over the years — the volute is usually the first thing visitors clock when they walk in. Not the staircase itself. The volute. Get it matched right with the newel post, balusters and starting step, and the whole staircase carries that traditional feel.",

  // Eras / styles
  "direct.fact.mrxp0dm0.ke0p":
    "Monkey Volutes turn up on Georgian, Victorian, and Edwardian staircases, on traditional timber staircases in general, and on pretty much any luxury bespoke build. Modern staircases usually skip the scroll — straight handrails, simple newel posts, cleaner look. Both are fine, they just say different things about the house. If you're going for a grand entrance in a traditional home, a well-designed starting volute does a lot of the work for you. Homeowners often focus on the kitchen or flooring and forget the staircase can carry that same character without touching the structure. Producing a quality volute takes real skill — carefully selected timber, laminating, machining, then hand-finishing to get that smooth flowing spiral.",

  // Manufacturing time factors
  "direct.fact.mrxp7noc.z88g":
    "Manufacturing time varies a lot from one staircase maker to another, and that's not really a reflection on skill — every staircase is different. What actually drives the timeline is the design you've chosen, the materials it's being made from, how complex the construction is, how busy the workshop already is, and whether all the specialist parts you need are available or need ordering in. Any one of those can add days or weeks.",

  // Stock materials
  "direct.fact.mrxp7ntd.xcii":
    "Plenty of staircases get made from standard stock materials that manufacturers keep on hand — mainly redwood (often called red deal) and whitewood (which you'll hear called white deal or pine). When your staircase is being built from stock timber, production can usually get going pretty much straight after you place the order.",

  // Specialist materials lead time
  "direct.fact.mrxp7nx7.hl16":
    "If you're after specialist hardwoods, imported timbers, glass components or decorative stair parts, those often need ordering in from suppliers before manufacturing can even start. Material lead times vary depending on what you've picked and how quickly the supplier can get it to the workshop — worth building that into your overall timeline from the beginning.",

  // Production queue
  "direct.fact.mrxp7o1s.1w1n":
    "Even when all your materials are ready, your staircase still has to join the workshop's production queue. Every maker has other customer orders ahead of yours. So the overall time you'll wait depends on two things at once — how busy the workshop is and how complex your specific project turns out to be.",

  // Standard straight staircase timing
  "direct.fact.mrxp7o65.m0bl":
    "A standard straight staircase made from stock timber usually comes together within a few working days once production actually starts. That's the fastest turnaround you'll get on a staircase.",

  // Detailed staircase timing
  "direct.fact.mrxp7o9j.f2xg":
    "More detailed staircases — ones with additional features, decorative components, or custom joinery — need longer on the workshop bench. Depending on how busy the maker is, you're commonly looking at one to two weeks once manufacturing kicks off.",

  // Curved staircase timing
  "direct.fact.mrxp7odp.o9s9":
    "Curved staircases are the biggest time investment. They usually need specialist bending techniques, laminating, glue that has to cure properly, and a lot of hand craftsmanship on top. Depending on complexity and the methods used, several weeks in the workshop is normal for a curved.",

  // Cut-string vs closed-string
  "direct.fact.mrxp7oi6.hfj7":
    "Closed-string staircases tend to move through production more efficiently because a lot of the process happens on dedicated machinery and clamping jigs. Cut-string staircases need more hands-on work — more assembly, more shaping, more finishing by hand — which naturally takes longer.",

  // Bespoke planning guideline
  "direct.fact.mrxp7omh.roqr":
    "If you're ordering a bespoke staircase, give it time. Two to four weeks for manufacture is a sensible planning guideline for many bespoke projects — and yes, always confirm the actual lead time with the specific staircase maker you're using. Rushing a bespoke build never pays off.",

  // Communication with manufacturer
  "direct.fact.mrxp7oq5.vx9m":
    "Keep in regular touch with your staircase maker throughout the production process. It helps you understand where things are, when to expect completion, and gives them a chance to flag any changes caused by material availability or design tweaks. Silence on a bespoke project is rarely a good sign.",

  // Timber expansion → squeak
  "direct.fact.mrxp7ou4.po42":
    "Timber naturally expands and contracts as moisture, heating, and humidity move around your house. On a staircase, the tread is held tight on each side by the strings, so any movement pushes into the centre — a slight lift, a bit of flex, and suddenly you've got friction where the riser meets the tread groove. That friction is what you're hearing when a stair squeaks. A squeaking staircase doesn't mean it was made badly. Timber does this. It's normal.",

  // Materials list
  "direct.fact.mrxpda7k.t70r":
    "Monkey Volutes get made in a wide range of timbers across the UK. Most of the time you'll pick the material to match the rest of your staircase, handrail, and interior — and most makers can produce a bespoke volute in pretty much any hardwood if you ask. Here's the common list you'll see: Pine (European Redwood) — cheapest, ideal for painted staircases, standard on new builds. Hemlock — nearly knot-free softwood, cleaner look than pine, works painted, stained, or clear-finished. Oak (European or American White Oak) — the UK's go-to premium hardwood; strong, durable, beautiful grain. Ash — very strong, light colour, bold grain, popular on modern and contemporary builds. Sapele (often just called Mahogany) — rich reddish-brown, chosen when you want a darker traditional finish. American Black Walnut — luxury hardwood, deep chocolate colour, common on high-end bespoke. Tulipwood (Poplar) — smooth grain, excellent for paint finishes. Southern Yellow Pine — dense softwood, sometimes used on larger bespoke or commercial builds. White Primed — factory-primed timber ready for final decorating, popular on painted staircases.",

  // Which is best
  "direct.fact.mrxpdabl.o7tl":
    "There's no single best material for a Monkey Volute — it comes down to the finish you want. Painting the staircase? Pine, hemlock, or white-primed components are usually the most economical route. Want the timber itself on show? Oak is the UK favourite for a reason — strength, durability, and a grain that carries the eye. Going for a luxury feel? American Black Walnut or Sapele give you that striking, high-end presence at the entrance. Match the material to the finish first, and everything else falls into place.",

  // Any timber possible
  "direct.fact.mrxpdaf7.1c26":
    "Pretty much, yes. Any decent staircase maker can produce a Monkey Volute in whatever timber you want — as long as the wood is stable enough to machine cleanly and the sizes you need are available. Some of the more exotic hardwoods will need special ordering and cost more, but bespoke workshops handle this every day. If you've seen a volute you like on another staircase, chances are your maker can match it in the timber you want.",

  // Why oak popular
  "direct.fact.mrxpdajg.9inp":
    "Oak has been earning its spot for centuries. It's tough, it machines cleanly, it takes stain and lacquer beautifully, and that grain gives a traditional staircase real character. The other thing about oak — it wears well. Handrails get touched thousands of times over the life of a staircase, and oak just takes it. There's something quietly satisfying about the way it looks better as it ages, not worse. That's why it's the UK's go-to premium hardwood and why staircase makers keep coming back to it.",

  // Ready-made
  "direct.fact.mrxpdan4.3eeu":
    "Yes — most UK staircase suppliers keep standard left-hand and right-hand Monkey Volutes on the shelf in popular timbers like pine, oak, and hemlock, matched to the common handrail profiles. If your staircase has a bespoke handrail profile, an unusual timber species, or a custom design, the volute normally has to be made specifically for your staircase by the maker.",

  // Price by timber
  "direct.fact.mrxpdasa.p85s":
    "Yes, the timber has a real effect on the price. Rough guide: pine is usually the cheapest, hemlock costs a bit more but gives you a cleaner look, oak sits in premium territory, ash is around oak depending on what's available, and sapele and walnut push higher because of the raw timber cost. Worth remembering — you're not just paying for the wood, you're paying for the craft. Sometimes the timber's the cheapest part of the whole thing. Getting that flowing spiral right is where the real skill kicks in.",

  // Mixed timbers
  "direct.fact.mrxpdaw6.7eut":
    "Yes, and done right it looks stunning. Plenty of homeowners run oak handrails and Monkey Volutes against painted white newel posts and balusters — modern classic look, works every time. Others go for walnut handrails on an oak staircase for a striking contrast. The key: it has to look intentional. A well-planned combination reads as luxurious. Random timber choices just look mismatched. Or as the makers put it — if you're going to make the Monkey Volute the star of the show, make sure the rest of the staircase knows it's part of the same performance."
};

let updated = 0;
let notFound = [];
for (const [id, statement] of Object.entries(rewrites)) {
  const fact = draft.payload.facts.find((f) => f.id === id);
  if (fact) {
    fact.statement = statement;
    updated++;
  } else {
    notFound.push(id);
  }
}

draft.updated_at = new Date().toISOString();
await fs.writeFile(draftPath, JSON.stringify(draft, null, 2), "utf8");

console.log(JSON.stringify({
  ok: true,
  updated,
  total_facts: draft.payload.facts.length,
  not_found: notFound
}));
