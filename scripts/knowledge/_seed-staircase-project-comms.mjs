#!/usr/bin/env node
// Third staircase seed — project, communication, delivery, warranty,
// building-regs and installation-relations topics from Philip's own
// authored paste (2026-07-25). All entries rewritten from spec-manual
// voice into Nex workshop-warm voice: direct-you, contractions, em
// dashes, UK-specific facts (Building Control, Approved Doc K).
//
// Also merges two Author-approved amendments into pre-existing entries
// where the paste added genuinely-new info to an existing topic.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
if (!fs.existsSync(FILE)) { console.error("missing knowledge/staircase.json"); process.exit(1); }

// ── NEW entries — 31 rewrites in Nex voice ────────────────────
const NEW = [
  { q: "Can I change the staircase design after Building Control has signed it off?",
    a: "Possibly — but the earlier you flag it, the easier the fix. Once Building Control has approved a drawing, changing the rise, going, headroom, handrail height or guarding could put you back outside Approved Doc K, and the approval may need revising. Talk to your builder or building control officer BEFORE the change goes anywhere near the workshop — five minutes on the phone can save you a re-inspection fee and a delayed staircase.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Should I ask who will actually manufacture my staircase?",
    a: "Yes — it's a fair question and any good supplier will answer it plainly. Some companies build in their own workshop; others act as retailers and sub-contract to a specialist manufacturer. Neither is wrong, but knowing who's cutting the timber tells you where to go if there's a query later, and what quality checks happen before it leaves the workshop. Ask what timber grade you're getting, what finish is included, and whether the staircase is inspected pre-delivery.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Why does good after-sales support matter on a staircase?",
    a: "Because a staircase lives in your home for decades, and questions come up years after installation — matching timber for a repair, a touch-up product for a scratch, a replacement baluster after an accident. A manufacturer who still picks up the phone five years on is worth more than a slightly lower quote from someone who disappears the day the invoice's paid. Ask about after-sales BEFORE you order, not after.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Why do experienced joiners warn against making assumptions during a staircase project?",
    a: "Because assumption is the mother of the re-manufacture. If you're not sure about a measurement, a drawing, a timber species, a finish or a delivery date — ask. A five-minute conversation prevents a five-day problem. The homeowners who have the smoothest projects are the ones who ask the most questions, not the fewest.",
    audience: 2, classification: "expert_observation" },

  { q: "What's the single best piece of advice before ordering a staircase?",
    a: "Take your time. Choose experienced people. Measure twice. Get everything in writing — the timber, the finish, the delivery date, who's fitting it. Approve the drawing carefully before it goes into production. A staircase is manufactured once but lives in your home for generations, so the hour you spend on the drawing review is the best hour you'll invest in the whole project.",
    audience: 1, classification: "professional_recommendation" },

  { q: "Can I measure my own staircase opening?",
    a: "Yes, but only if you know exactly what you're measuring. A proper staircase measure captures floor-to-floor height, finished floor levels top and bottom, the structural opening in the joists, stair width, landing dimensions, headroom clearance and any wall thickness that affects the string position. Miss one and the whole thing can end up wrong. If you're unsure, ask the supplier for a site survey — most offer one for a modest fee and it removes the risk from your shoulders.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Why does my staircase quote ask whether measurements are 'builder's dimensions' or 'manufacturer confirmed'?",
    a: "Because it decides who's on the hook if a dimension's wrong. 'Builder's dimensions' means you or your builder measured, and the supplier makes to your numbers — if the staircase doesn't fit, the cost of putting it right sits with you. 'Manufacturer confirmed' means the supplier came out (or worked from a verified survey) and takes responsibility for the fit. Read that section carefully before you sign — it's usually the biggest hidden risk in a staircase order.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Should I tell the staircase manufacturer if my property is listed or historic?",
    a: "Yes — flag it before you even get a quote. Listed buildings often need bespoke joinery detail to match original features, and any change may need listed building consent as well as Building Control sign-off. Historic properties also throw up walls that are anything but square, floors that slope and openings that have been modified over 200 years. An experienced staircase maker will factor that in from the design stage.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Does an old house make installing a new staircase harder?",
    a: "Usually yes, but not in a way an experienced fitter can't handle. Older properties are rarely square — floors settle, walls bow, openings shift over decades. The staircase itself can still be built perfectly, but the fitter will spend more time scribing to uneven walls, packing under strings and setting cover slips than they would in a new build. Budget a bit more time and a bit more finish work; the result's usually worth it.",
    audience: 2, classification: "expert_observation" },

  { q: "Why is it a bad idea to change measurements after production has started?",
    a: "Because by that point the timber's already being cut. A late change means new material, re-machining, revised drawings and a fresh production slot — and you'll usually pay for all of it. If you're going to change something, do it before the drawing is signed off. Once the workshop starts, the design's locked.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Should I keep my staircase manufacturer's contact details after installation?",
    a: "Yes — save them somewhere you'll actually find in five years. You may want matching spindles after an accident, a touch-up finish, refinishing advice, or replacement components. The original manufacturer knows exactly what timber and finish went in, and can usually help long after the job's done. Trying to source a match without them is much harder.",
    audience: 1, classification: "professional_recommendation" },

  { q: "What's the biggest secret to a successful staircase project?",
    a: "Communication. The homeowner, staircase maker, carpenter and main builder all need to be working from the same drawing, the same dimensions and the same programme. Most staircase problems aren't manufacturing faults or fitting faults — they're what happens when three people each assumed someone else was handling something. Nail down who's doing what in writing, and 90% of the usual issues never appear.",
    audience: 2, classification: "expert_observation" },

  { q: "Do I have to use the staircase company's own fitters, or can my carpenter install it?",
    a: "Either can work — the deciding factor is experience, not badge. The staircase company's team knows their own product, but an experienced site carpenter who's fitted plenty of staircases before will do a fine job too. What you don't want is a general builder taking on their first staircase install and learning on your job. Ask how many staircases they've fitted, and if it's your carpenter, ask them to speak directly with the manufacturer before install day.",
    audience: 2, classification: "professional_recommendation" },

  { q: "My installer's hit a problem during install — should work stop?",
    a: "Often yes, briefly. Better to pause, check the drawing, retake the key measurements and ring the manufacturer than to keep cutting and turn a small question into a permanent mistake. Most issues are resolved in one phone call between installer and staircase maker before any timber is altered.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Why does the manufacturer keep asking for measurements to be re-taken?",
    a: "Because rechecking a number is the fastest way to eliminate a cause. Half the time an installation query turns out to be a recording error, a drawing misread, a change on site nobody logged, or a stair positioned slightly off the datum. Double-checking isn't the manufacturer doubting the installer — it's them working the problem systematically.",
    audience: 3, classification: "expert_observation" },

  { q: "What information should I send if I need technical help from the staircase manufacturer?",
    a: "As much as you can — good photos save days. Take clear pictures from several angles, a short video showing any movement, the approved drawings, the measurements they've asked for, and a note of when the issue first appeared. The more accurate the information going in, the more accurate the advice coming back.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What's the most important thing to remember during a staircase installation?",
    a: "Three things have to line up: accurate manufacturing, a correctly prepared opening, and skilled fitting. If any one of those is off, the install gets harder. The fix isn't blaming one trade — it's getting the three parties talking so the actual cause gets found and put right.",
    audience: 3, classification: "industry_good_practice" },

  { q: "My staircase doesn't look exactly like the one I saw in the showroom — is something wrong?",
    a: "Probably not. Showroom staircases sit in perfect lighting, against perfectly finished walls, on level floors. Your staircase is being installed into a real house where the plaster, floor levels, decorating and light change everything. Judge the finished result AFTER decorating and lighting are complete, not the day it's fitted.",
    audience: 1, classification: "expert_observation" },

  { q: "Should the carpenter and staircase manufacturer be talking to each other directly?",
    a: "Yes — and the sooner the better. They both speak the same language (packers, cover slips, scribing, string positions, wall tolerances) and can resolve a question in a two-minute call that would take three emails through you. Encourage the direct conversation; don't feel you have to sit in the middle.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Why is it worth keeping written records of a staircase project?",
    a: "Because memories fade fast when something goes wrong. Keep the approved drawings, the measurement emails, the delivery note, any site photos and any technical advice from the manufacturer. If there's ever a question — warranty claim, insurance claim, resale enquiry, future refurbishment — the paperwork answers it immediately. If you don't have it, everything becomes a debate.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Is every staircase installation genuinely different, or do they all fit the same?",
    a: "Every one is different. Even two identical new-build houses next door to each other will have small variations in plaster thickness, floor level or opening squareness. Any experienced staircase maker expects to adjust on site — the skill is doing it neatly and without compromising strength or looks.",
    audience: 3, classification: "expert_observation" },

  { q: "What do I do if the installer and manufacturer disagree about what to do?",
    a: "Stay calm and ask each to explain their reasoning. Most disagreements sound bigger than they are and disappear once both parties look at the drawing together and share photos. The right question isn't 'who's right?' — it's 'what's actually happening and what fixes it?'. Avoid making any changes to the staircase until both sides have had a proper look.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Why does the staircase manufacturer sometimes ask me to be patient when there's an issue?",
    a: "Because a proper diagnosis takes a moment. A good manufacturer wants to understand what happened, when it happened, how the install was done, and whether anything's changed since. That patient investigation almost always produces a better result than a rushed guess.",
    audience: 2, classification: "expert_observation" },

  { q: "Should I involve my installer when I speak to the staircase company about a problem?",
    a: "Yes — they've got first-hand information the manufacturer needs. The installer knows the site conditions, what adjustments they made, what measurements they took. A three-way conversation (or at minimum, the installer copied on the email chain) resolves things faster than the message being relayed through you.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Why should I be honest if something on the staircase has already been modified?",
    a: "Because it changes the diagnosis completely. If a component's been trimmed, glued, unscrewed or filled since installation, the manufacturer needs to know before they suggest a fix — otherwise they're troubleshooting a staircase that no longer matches what they built. Owning up early is far better than the truth surfacing halfway through a repair.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Should I expect the staircase manufacturer to know what my property is like without seeing it?",
    a: "No — even the most experienced maker relies on what you tell them. Clear photos, honest video, accurate measurements and the original drawings all help. Vague descriptions produce vague advice, so the more real information you give them, the more useful the answer.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Do mistakes happen on building projects even when everyone's careful?",
    a: "Yes — builders, carpenters, staircase makers, surveyors and homeowners are all human, and the occasional mistake happens on almost every project. What matters is how it's handled: professional communication, willingness to look at the facts, and a shared aim of getting a good result rather than winning an argument.",
    audience: 1, classification: "expert_observation" },

  { q: "Should I expect a staircase and building to be perfect?",
    a: "Every trade aims for the highest standard, but buildings are built within accepted construction tolerances — they're never laboratory-perfect. A bespoke staircase is designed to work within those tolerances, and small on-site adjustments (scribing, packing, cover slips) are part of achieving a professional finish. Perfect is unrealistic; well-fitted and honest is what to aim for.",
    audience: 2, classification: "industry_good_practice" },

  { q: "How can I as a homeowner help my staircase project run more smoothly?",
    a: "More than you might think. Give accurate information, confirm measurements in writing, review the drawings carefully before you approve them, protect the staircase after installation, report any concerns promptly, and encourage the installer and manufacturer to speak directly. Those simple habits head off most of the usual misunderstandings before they start.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Should all the staircase parts be unpacked before installation starts?",
    a: "Yes. A good installer opens everything before lifting a component so they can confirm nothing's missing, check nothing's damaged, plan the fitting sequence and flag any queries early. Starting an install and then discovering a missing bracket half-way up the stringer is the worst way to find out.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Will a well-made timber staircase really last for decades?",
    a: "Yes — a quality staircase that's manufactured properly, fitted by someone who knows what they're doing and looked after sensibly can serve you for many decades. Plenty of timber staircases in older UK homes are still in daily use after 100 years or more with nothing but routine cleaning and the occasional refinish. Treat it well and it outlasts most other things in your home.",
    audience: 1, classification: "expert_observation" }
];

// ── MERGE amendments — extend existing entries with new info ─
const MERGES = [
  {
    id: "staircase-faq-028",
    replace_answer: "Yes — some contain bleach, ammonia, strong solvents, harsh degreasers or abrasive powders that gradually attack the finish. Wire brushes and industrial cleaners will strip it in one go. Stick to products recommended for finished timber floors or staircases. If you're unsure, check with the varnish manufacturer before using anything aggressive.",
    reason: "Merge: paste added abrasive powders, wire brushes, harsh degreasers as specific examples."
  },
  {
    id: "staircase-faq-058",
    replace_answer: "Quality staircase finishes should last years. Premature wear usually means: wrong varnish for staircases, heavy household traffic, grit in footwear, pets, unsuitable cleaning products, water left sitting on the surface, too few coats originally, poor prep before finishing, or a worn finish that was left unattended for too long. A pro can usually spot the cause from the wear pattern alone.",
    reason: "Merge: paste added water-left-on-surface and neglect-of-worn-finish as causes."
  }
];

// ── Load + apply ──────────────────────────────────────────────
const doc = JSON.parse(fs.readFileSync(FILE, "utf8"));
if (!Array.isArray(doc.entries)) doc.entries = [];

// Apply merges first
let merged = 0;
for (const m of MERGES) {
  const e = doc.entries.find((x) => x.id === m.id);
  if (!e) { console.warn(`⚠ merge target ${m.id} not found — skipped`); continue; }
  e.answer = m.replace_answer;
  merged += 1;
}

// Compute next id
const nextN = doc.entries.reduce((a, e) => {
  const mm = String(e.id ?? "").match(/-(\d+)$/);
  return mm ? Math.max(a, parseInt(mm[1], 10)) : a;
}, 0) + 1;

// Dedup guard against existing questions (case + punctuation insensitive)
const norm = (q) => String(q ?? "").toLowerCase().replace(/[?.!,;:'"]/g, "").replace(/\s+/g, " ").trim();
const existingQs = new Set(doc.entries.map((e) => norm(e.question)));

let added = 0, skipped = 0;
for (const item of NEW) {
  if (existingQs.has(norm(item.q))) { skipped += 1; continue; }
  const entry = {
    id: `staircase-faq-${String(nextN + added).padStart(3, "0")}`,
    kind: "faq",
    question: item.q,
    answer: item.a,
    category_tag: "staircase",
    audience_level: item.audience ?? null,
    classification: item.classification ?? "industry_good_practice",
    safety_note: item.safety ?? null,
    source_verified_at: null,
    fact_check_flag: null
  };
  doc.entries.push(entry);
  existingQs.add(norm(item.q));
  added += 1;
}
doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`✅ Merged ${merged} existing entries with new info.`);
console.log(`✅ Added ${added} new entries (${skipped} skipped as dupes). Total entries: ${doc.entries.length}`);
