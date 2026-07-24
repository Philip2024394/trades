#!/usr/bin/env node
// Strip all £ price figures from Brain facts, replace with percentage comparisons
// + append the "prices only after full spec" caveat. Manufacturers are Nex's customers.

import { promises as fs } from "node:fs";
import path from "node:path";

const draftPath = path.join(process.cwd(), ".author-studio-drafts", "staircase", "craft.json");
const draft = JSON.parse(await fs.readFile(draftPath, "utf8"));

const rewrites = {
  // Grants — reword to point at official DFG cap rather than quote £ figures
  "direct.fact.mrxqmmm5.6uzg":
    "Grant amounts under the Disabled Facilities Grant vary across the UK — England, Wales, Scotland and Northern Ireland each publish their own current caps and eligibility tests. Rather than quote numbers that go out of date, always point clients to the current published DFG maximum for their local authority (the local council housing team is the definitive source). What matters more than the cap is that a stairlift or replacement stair for an ageing or disabled resident often qualifies for DFG assistance in whole or in part, and it's worth applying early because processing takes months.",

  // Elderly falls — reword to convey scale without the £ statistic
  "direct.fact.mrxri3hk.qgx8":
    "Stair falls in older adults' homes are one of the biggest sources of serious injury in the UK — hundreds of deaths and hundreds of thousands of injuries every year, at very significant cost to the NHS. Research also found that in one study, 40% of the staircases in elderly participants' homes didn't meet current government guidelines for pitch, rise and going — even though those participants thought their stairs were fine. Worth mentioning to any client refitting a stair for an ageing relative.",

  // Bad quote signs — remove £3,000 example, use generic language
  "direct.fact.mrxri3hk.0hxh":
    "Quick reads on whether a stair quote is honest. Round-number pricing (a suspiciously flat total for a bespoke stair) usually means a guess, not a costed job. No breakdown — timber, manufacture, delivery, fit as separate lines. No lead-time confirmation. No warranty terms. No site visit before quoting. Any of those and the number is fiction. The client will end up paying variations later — or getting a stair that doesn't fit. Honest quotes are itemised and reference the actual measured site. The exact number for any bespoke stair depends on final design, timber species, balustrade type, finish choice, delivery and fit — always confirm with the specific manufacturer you're using.",

  // Spray job — strip £1500-3500, replace with percentage of stair cost + caveat
  "direct.fact.mry4iuns.ruk0":
    "A specialist on-site staircase spraying job runs like this. Day 0: site survey, quote, colour matching. Day 1: sheet up the whole area — plastic to the ceiling, plastic on the floor, plastic taped over every door frame, all sockets and switches masked. Sand the stair on-site with vacuum extraction. Vacuum. Tack cloth. Day 2: two coats of 2K primer, sanded between. Day 3: two coats of 2K topcoat. Day 4: cure. Day 5: unwrap, clean, hand over. On a single flight with a balustrade, expect the spray finish to add roughly 30-60% on top of the raw stair fabrication cost, depending on complexity and access — exact number always depends on final design, balustrade type, timber and access constraints, so confirm with the sprayer for the specific project.",

  // Starting steps — strip full price list, convert to percentage bands
  "direct.fact.mry4nnqb.1y3c":
    "Rough cost gradient on starting steps, cheapest to most expensive. A bullnose riser retrofit sits at the bottom of the range — the cheapest option because you're adding to an existing standard tread. A single bullnose whole-step is the next step up in cost, roughly 3-5x the retrofit riser. A double bullnose whole-step is around 1.5-2x a single bullnose (both ends curved means more fabrication). Single curtail step is significantly more than double bullnose because the curved timber has to be wrapped around the newel — expect roughly 2x a single bullnose. Double curtail step, the top of the range, sits at roughly 3-4x a single bullnose. Add matching newel post, volute or turnout handrail, and finishing scotia — the starting-step assembly can easily be 15-25% of the total staircase budget on a bespoke build. Exact prices always depend on timber species, joinery style, fit-out complexity and finish — confirm every number with the specific stair maker.",

  // Cut vs closed price comparison — strip £, keep "double" multiplier + caveat
  "direct.fact.mry5e54f.vbup":
    "Honest cost comparison on a straight domestic staircase. A cut-string stair from a UK maker sits at roughly double a closed-string equivalent — same size, same timber, same everything else, just the string style changed. On an existing quote, upgrading the visible outer string from closed to cut typically adds about 15-25% to the total staircase price (plus VAT). That premium isn't material cost (the timber is similar) — it's labour. Cut string needs 3-4 times more workshop hours because every tread profile is machined into the string and every joint is mitred by hand. Exact numbers depend on final timber species, string dimensions, spindle type and finish — always confirm with the specific stair maker.",

  // Choosing string — strip £1500 benchmark, keep 5 questions
  "direct.fact.mry5e54f.s6w5":
    "Before picking a string style, walk through five questions with the client. One: budget — closed string is the trade-default baseline, cut string sits at roughly double, mitred cut string and open floating stairs sit higher again. Two: era of the house — modern minimalist wants open or plain closed, Victorian wants cut or bracketed cut. Three: how much is the stair on show — hallway stair everyone sees or back-of-house utility stair. Four: what timber and finish — painted stairs suit closed string because the visible face reads as one clean surface, natural-finish oak or walnut suits cut string because the tread grain is on view. Five: will they add a volute or scroll handrail — if yes, cut string with curtail step matches; if no, closed string with straight handrail matches. Answer those five and the string style picks itself. Exact prices always depend on final design, timber species and balustrade specification — always confirm with the manufacturer.",

  // Market segmentation — strip all £ bands, use tier language + caveat
  "direct.fact.mry5e54f.evxv":
    "Honest breakdown of UK stair-string reality by market tier. Volume housebuilding — 100% closed string, painted or carpeted, pine. Standard bespoke domestic renovation — 90% closed string, timber matched to house, natural or painted finish. Mid-market bespoke — closed string in oak or ash, well finished. Premium bespoke — cut string, or mitred cut string with volute handrail, in oak or walnut or sapele. Ultra-luxury — open floating string with glass balustrade, or curved cut string with bracketed detailing. Each tier is a different order of magnitude on cost from the last, but exact prices always depend on final design, timber species, balustrade type, finish, delivery and fit — knowing where the client sits in tier saves everyone time, and the actual number always comes from the specific manufacturer after full spec is locked."
};

let updated = 0;
const notFound = [];
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
