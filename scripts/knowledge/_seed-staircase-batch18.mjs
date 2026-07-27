#!/usr/bin/env node
// Batch 18 staircase seed — 9 focused gap-fills from Philip's paste
// (Q337-Q393). Skips ~48 duplicate Qs on materials/layouts already
// deeply covered by Batches 3-17. Focus areas:
//   - Staircase LIGHTING detail beyond what Batches 9/11/17 covered:
//     wall-light positioning, two-way switching, motion sensors,
//     smart-home integration, handrail LED, honest 'lighting won't
//     hide workmanship' warning, what lighting to avoid
//   - One layout angle: whether changing layout creates usable space
//     (understair storage, hallway flow, furniture access)

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  { q: "Where should wall lights be positioned on a staircase?",
    a: "Low enough to light the tread you're about to step on, high enough not to shine into your eyes as you climb, and offset from the tread itself so the fixture isn't something you'd bump. In practice: usually 250-450 mm above tread level, spaced every 3-4 treads, with the beam angled downward onto the step. Also stagger them so they don't create harsh direct lines — the aim is soft pools of light on the treads, not a runway. Avoid up-lights on a staircase; they light the ceiling but leave the treads themselves in shadow.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Should staircase lights have separate switches at the top and bottom?",
    a: "Yes — this is called two-way switching and it's standard practice on any staircase over four or five steps. You turn the light on as you start climbing, turn it off from the top; same in reverse. Anything else means walking down a dark flight to the bottom light switch, or leaving the light on all night. Ask your electrician to wire two-way switching in as part of first-fix; retrofitting it later means chasing cables through walls.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Are motion sensors a good idea for staircase lighting?",
    a: "Yes — one of the best low-cost upgrades to a staircase. A PIR sensor at the top and bottom of the flight (or built into the driver for the LED strips) turns the lights on automatically the moment anyone approaches and off again a couple of minutes later. Massive benefit for anyone getting up in the night (no fumbling for switches), young children who can't reach the switch, older users, and general safety. Usually installed alongside two-way manual switching rather than replacing it — belt and braces.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Can I connect my staircase lighting to a smart-home system?",
    a: "Yes — most modern LED drivers work with the standard smart-home platforms (Hue, Google Home, Alexa, Apple HomeKit, Loxone) either directly or via a smart switch or in-line controller. Useful automations: dim the staircase LEDs to 20% between midnight and 6am (soft night-light, no glare), turn them fully on when the front door opens after dark, sync brightness with the rest of the hall lighting. Plan the driver location and cable during first-fix so the smart control box has somewhere to live.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Can I install LED lighting inside a staircase handrail?",
    a: "Yes — LED strip integrated into a channel cut along the underside of the handrail is one of the most premium modern staircase details. The strip lights the treads directly beneath your hand as you climb, doubles as low-level ambient light, and looks like the handrail itself is glowing. Works especially well on glass balustrades where there's no timber above to hide the strip, and on floating cantilever staircases. Needs planning at manufacture — the channel has to be routed into the handrail before finishing, and cable routes need to feed back through a newel into the driver.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Can staircase lighting be used to hide imperfections in the finish?",
    a: "No — the opposite is true. Grazing light across a surface HIGHLIGHTS every uneven finish, bad joint, poorly-scribed cover slip and plaster imperfection instead of hiding them. The under-tread LED strip you were going to add to disguise a scratched nosing will actually make the scratch more visible, not less. If the staircase has finish or workmanship issues, address them first (touch up the finish, get the joiner back to re-do the cover slip) THEN add the lighting to a properly-finished flight. Lighting rewards good workmanship and punishes bad — plan accordingly.",
    audience: 3, classification: "expert_observation" },

  { q: "What kinds of staircase lighting should I avoid?",
    a: "A short list: DIRECT SPOTLIGHTS pointing straight down the flight (create harsh shadows on every tread edge), BRIGHT COLOUR-CHANGING RGB (reads as party lighting not home design), EXPOSED FLEXIBLE LED STRIP without a proper diffuser channel (individual LED dots are visible and cheap-looking), VERY BRIGHT COOL WHITE on a traditional oak staircase (bleaches the timber colour), and any lighting that creates GLARE at eye level as you climb. The goal is lighting that makes the staircase feel welcoming — not lighting that draws attention to itself.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Should staircase lighting cables be hidden or is exposed cable OK?",
    a: "Hidden — always, on a residential staircase. Exposed cable running along a nosing or down a stringer looks unfinished no matter how tidy the run. Cable channels should be routed into the stringer or the underside of the handrail during manufacture, driver boxes tucked into the under-stair void or a nearby cupboard, and any connection points designed to be accessible for future replacement without dismantling the staircase. Any electrician quoting for staircase lighting with visible surface-run cable is quoting the wrong job.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Can changing my staircase layout actually create usable space in the house?",
    a: "Sometimes, meaningfully. Swapping a straight flight for an L-shape or half-turn can free up a whole hallway rectangle for something else (utility, coats, boot room). A properly-designed under-stair area can add a WC, a bank of coat hooks, boot storage, a bookcase, or a full understair pantry off a kitchen. Even keeping the same layout but changing to open-riser can visually open up a narrow hall. Ask your staircase maker to sketch the layout options at drawing stage against the FULL floor plan — the best gains often come from spotting the change no-one had considered.",
    audience: 2, classification: "professional_recommendation" }
];

// Add new entries
const nextN = doc.entries.reduce((a, e) => {
  const m = String(e.id ?? "").match(/-(\d+)$/);
  return m ? Math.max(a, parseInt(m[1], 10)) : a;
}, 0) + 1;

const norm = (q) => String(q ?? "").toLowerCase().replace(/[?.!,;:'"]/g, "").replace(/\s+/g, " ").trim();
const existing = new Set(doc.entries.map((e) => norm(e.question)));

let added = 0, skipped = 0;
for (const item of NEW) {
  if (existing.has(norm(item.q))) { skipped += 1; continue; }
  const id = `staircase-faq-${String(nextN + added).padStart(3, "0")}`;
  doc.entries.push({
    id, kind: "faq",
    question: item.q,
    answer: item.a,
    category_tag: "staircase",
    audience_level: item.audience ?? null,
    classification: item.classification ?? "industry_good_practice",
    safety_note: item.safety ?? null,
    source_verified_at: null,
    fact_check_flag: null
  });
  existing.add(norm(item.q));
  added += 1;
}

doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");

console.log(`✅ Batch 18: Added ${added} new entries (${skipped} skipped). Total: ${doc.entries.length}`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
