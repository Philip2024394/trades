#!/usr/bin/env node
// Batch 19 staircase seed — ADVERSARIAL ROBUSTNESS.
// 15 entries formatted as "A maker told me X — is that true?" or
// "Some companies claim Y — what's actually the case?" designed to
// give Nex the authority to catch out common misdirection from
// staircase makers and installers. Every answer cites the real UK
// source so Nex answers with fact, not opinion.
//
// Covers: regulatory tricks (Doc K, Building Control, CE marking),
// material tricks (toughened glass cutting, silicone as fix),
// payment/contract tricks (non-refundable deposits, warranty
// exclusions), design tricks (wider-going assumption, LED retrofit),
// installer tricks (site-cutting major components).
//
// Voice: adviser tone, direct-you, honest and specific about the
// misdirection. Never lawyer tone — refers people to Citizens
// Advice / Trading Standards / a qualified surveyor for serious
// disputes.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${FILE}.bak.${stamp}`, raw, "utf8");

const doc = JSON.parse(raw);

const NEW = [
  // ─── Regulatory misdirection ─────────────────────────────
  { q: "A staircase company told me I don't need Building Control for a replacement staircase. Is that true?",
    a: "Usually NOT true. In England and Wales, replacing a staircase in a HABITABLE part of a home is Building Work under the Building Regulations 2010 and requires Building Control approval — the replacement has to comply with Approved Doc K (rise, going, headroom, handrail height, guarding, balustrade spacing). Scotland uses the Technical Handbook and Northern Ireland uses Technical Booklet H — same principle. The main exceptions are like-for-like repairs (replacing an individual damaged tread) rather than replacing the whole flight. If a maker is telling you no notification's needed for a whole-staircase replacement, ask them to point to the specific exemption in writing — and if they can't, contact your local Building Control before ordering.",
    audience: 3, classification: "safety_advice" },

  { q: "A staircase company said their staircase is 'CE-marked' or 'UKCA-marked' so it automatically meets Building Regulations. Is that right?",
    a: "No — those markings and Approved Doc K compliance are different things. CE/UKCA marks confirm certain product-level requirements (structural properties, reaction to fire in some cases) at the point of manufacture. They do NOT confirm the staircase has been designed for the specific dimensions, layout, headroom and guarding requirements of YOUR building under Doc K. A CE-marked staircase can still fail a Building Control inspection if the rise, going, handrail height or balustrade spacing is wrong for your property. Ask the maker to confirm in writing that the design meets Approved Doc K (or your regional equivalent) for your specific project.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Can I have a space-saver / paddle staircase as the only staircase to my first floor?",
    a: "Usually NO under Approved Doc K in England. Space-saver stairs (alternating-tread paddle stairs) are permitted only in tightly-defined situations — typically as access to a single loft-conversion room, and NOT as the main staircase to a habitable floor. If a maker is proposing a paddle staircase as the primary route to your first floor, that's very likely not going to pass Building Control. Get the specific compliance route confirmed in writing before ordering, and if in doubt speak to your local Building Control before signing.",
    audience: 3, classification: "safety_advice" },

  { q: "An installer said there's no legal maximum rise for a domestic staircase — is that true?",
    a: "No — Approved Doc K (England) sets a maximum rise of 220 mm for a private (single-dwelling) staircase, and a minimum going of 220 mm. The pitch is capped at 42 degrees. Every rise across the flight must also be the same to within a few millimetres. If an installer is telling you 'the rise doesn't matter as long as it feels OK' or proposing a 240 mm+ rise on a domestic flight, that will fail Building Control on inspection. Ask for the specific rise dimension in writing before manufacture, and check it against Doc K yourself if in doubt.",
    audience: 3, classification: "safety_advice" },

  { q: "A maker said I don't need a handrail if the balustrade is glass. Is that right?",
    a: "No — Approved Doc K requires a GRASPABLE handrail continuous along the length of a domestic staircase flight, and the polished top edge of a glass balustrade panel is NOT classed as graspable. A compliant glass-balustrade staircase needs a proper handrail — either bonded/bracketed on top of the glass, or run alongside on the wall or newel. The 'no handrail, just naked glass' look that appears in photos is either non-compliant, on an unoccupied show home, or has a handrail hidden at an angle the photographer didn't capture. Don't sign off a glass balustrade design without a handrail spelled out on the drawing.",
    audience: 3, classification: "safety_advice" },

  // ─── Material misdirection ───────────────────────────────
  { q: "A glass supplier said they can cut and trim toughened staircase glass on site if it doesn't quite fit. Is that possible?",
    a: "No — this is one of the most dangerous misdirections in the trade. Toughened safety glass under any cutting, drilling or edge-grinding will EXPLODE into thousands of small cubes across the room — that's not just a broken panel, it's a genuine injury risk. All cutting, drilling and shaping of toughened glass has to happen BEFORE the toughening furnace, not after. If a supplier is telling you they'll 'trim to fit on site', they either don't understand toughened glass or they're planning to use ordinary annealed glass instead (also unsafe on a balustrade). Ask specifically: 'is this glass toughened before or after cutting?' — the honest answer is always 'before'.",
    audience: 3, classification: "safety_advice" },

  { q: "My builder said silicone is the professional fix for the gap between the staircase and the wall. Is that true?",
    a: "No — silicone is the DIY reflex fix; the professional solution is a wall slip (also called a cover slip). Silicone bonded between a moving staircase and a static wall fatigues, pulls away and looks worse within a couple of years — it's the wrong material for a joint that has to accommodate movement. A proper wall slip is a thin timber moulding (usually matching the staircase species) fitted down the wall side of the string, overlapping the plaster to hide any gap. Any experienced staircase joiner should specify this as standard. If the quote assumes silicone, ask for a cover slip alternative.",
    audience: 2, classification: "professional_recommendation" },

  { q: "A staircase maker told me quality timber doesn't move indoors. Is that accurate?",
    a: "No — all timber moves with humidity, always. UK indoor humidity typically swings between 40-60% relative humidity through the year (and more if you have central heating hitting hard in winter and windows open in summer), and every timber component in your house — including your staircase — expands and contracts with it. What GOOD manufacturing does is: dry the timber to the right moisture content before machining, allow the finished staircase to acclimatise before install, and design joints to accommodate the small residual movement. A maker claiming their staircase 'won't move' either doesn't understand timber or is setting up an argument-free excuse for future 'we told you so' when small gaps appear.",
    audience: 3, classification: "expert_observation" },

  { q: "My decorator said wood filler will be invisible on the damaged oak tread — is that true?",
    a: "Almost never on natural-finished oak. Filler comes in a limited range of stock colours and never matches the specific grain and tone of your actual timber — it looks like filler, especially in raked light or after the oak's aged another few years. Proper repair on a damaged oak tread is a TIMBER PATCH: cut out the damaged area, machine a matching piece of oak from the same batch (or an offcut) with matching grain direction, glue and finish it in. It's more work than filler, but the result actually is nearly invisible. Filler's fine on painted timber where the paint hides everything; on natural oak, insist on a timber patch.",
    audience: 3, classification: "professional_recommendation" },

  // ─── Payment / contract misdirection ─────────────────────
  { q: "A staircase company insists I pay 100% before delivery. Is that normal?",
    a: "Unusual and worth pushing back on. Standard trade practice on a bespoke staircase is STAGED payment: deposit at order (materials + design), interim before delivery (manufacture), final balance on satisfactory install. Full payment before delivery removes your practical leverage if there's a snagging item at install, a delivery-damaged component, or a fit issue. Unless there's a specific stated reason (very small order below their staged-payment threshold, unusual project) ask why they're not offering staged terms. If the answer isn't satisfying, that's a signal.",
    audience: 2, classification: "professional_recommendation" },

  { q: "The staircase company said my deposit is 100% non-refundable no matter what happens. Is that legally correct?",
    a: "'Non-refundable if you change your mind' is standard on bespoke goods (the Consumer Contracts Regulations exempt bespoke items from the 14-day cancellation right). But 'non-refundable no matter what' is not the whole picture — if the company can't fulfil the order, goes into insolvency, or delivers something significantly different from what was agreed, the Consumer Rights Act 2015 protects your position and you may be entitled to a refund. Ask for the deposit terms IN WRITING and understand what specifically triggers non-refundability. If the situation gets serious, Citizens Advice or a solicitor can give you position-specific guidance — a Nex answer isn't legal advice.",
    audience: 3, classification: "professional_recommendation" },

  { q: "The staircase company said there's no warranty because the staircase is bespoke. Is that right?",
    a: "No — the Consumer Rights Act 2015 applies to bespoke goods just as it applies to off-the-shelf goods. Goods (bespoke or not) sold by a business to a consumer have to be of satisfactory quality, fit for purpose and as described. A staircase that fails structurally within a reasonable period, or that turns out to be genuinely defective (wrong timber, wrong dimensions, poor workmanship rendering it unsafe or unusable), is covered — 'bespoke' doesn't remove those rights. What CAN legitimately be excluded is aesthetic dissatisfaction ('I've decided I don't like the colour after all') or damage caused by the homeowner. Get the warranty terms in writing; check them against your consumer rights if unsure.",
    audience: 3, classification: "professional_recommendation" },

  // ─── Design misdirection ─────────────────────────────────
  { q: "Someone told me a wider tread going always makes a staircase safer. Is that right?",
    a: "Up to a point, then no. Comfort and safety on a staircase peak roughly where each tread's going is 250-280 mm — enough for a normal shoe to land comfortably. Going much wider than 300 mm actually creates a NEW problem: you start needing awkward two-step-per-tread walking (the 'is this a stair or a landing?' feeling) that people trip on. Approved Doc K sets the minimum at 220 mm for a private staircase; there's no maximum but there IS a practical limit. Wider isn't automatically safer — the right dimension is a designed answer that fits the rise, the pitch and normal walking rhythm.",
    audience: 3, classification: "expert_observation" },

  { q: "An electrician said adding LED under-tread lighting is a quick retrofit job after the staircase is installed. Is that accurate?",
    a: "Technically possible, in practice much worse than planning it at manufacture. Retrofit LED usually means either surface-mounted strips visible along the tread underside (looks unfinished, cable runs on show), or cutting channels into fitted timber (invasive, risks damaging the finish, can void the maker's warranty). LED cable routes designed into the stringer at manufacture time are invisible, protected, and can carry proper drivers and switching. If a maker or electrician says 'we'll retrofit it later, no problem', ask to see photos of a previous retrofit before you accept the argument — the visible cable run usually settles it.",
    audience: 3, classification: "professional_recommendation" },

  // ─── Installer misdirection ──────────────────────────────
  { q: "The installer said they'll 'adjust the staircase on site' if it doesn't quite fit. What kind of adjustment is actually OK?",
    a: "SMALL scribing to bowed walls, packing under strings to level them, cutting the wall slip / cover slip to fit the plaster line, small trimming of skirting or return details — all normal, expected on almost every install. What's NOT OK: cutting the strings to fix a wrong rise, notching a tread to work around a mis-measured opening, shortening the flight by removing steps to fit floor-to-floor, altering the balustrade spacing to fit around a misplaced newel. Those are structural or compliance changes that turn a properly-made staircase into a bodged one. If the installer's suggesting anything beyond neat finishing adjustments, stop and phone the manufacturer before any timber is cut.",
    audience: 3, classification: "safety_advice" }
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

console.log(`✅ Batch 19 (adversarial-robustness / trick-question resistance): Added ${added} new entries (${skipped} skipped).`);
console.log(`   Total: ${doc.entries.length} entries`);
console.log(`   backup: knowledge/staircase.json.bak.${stamp}`);
