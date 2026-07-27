#!/usr/bin/env node
// Batch 6 staircase seed — payments, deposits, contracts and
// snagging-vs-payment disputes. Genuinely new territory: nothing
// in the existing 325 entries covers this area.
//
// Voice: Nex workshop-warm, direct-you, contractions. Adviser tone,
// NOT lawyer — Nex refers to consumer rights and Citizens Advice /
// Trading Standards rather than quoting specific statute paragraphs.
// UK-specific throughout.
//
// Skips: how-much-deposit-exactly (varies by company, don't fabricate);
// specific % figures; anything that reads as legal advice.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("knowledge/staircase.json");
if (!fs.existsSync(FILE)) { console.error("missing knowledge/staircase.json"); process.exit(1); }

const NEW = [
  { q: "Why do staircase companies ask for a deposit before starting work?",
    a: "Because a bespoke staircase is a made-to-order product — the workshop commits money and time the moment they start on your order. The deposit lets them buy the specific timber for your job, book you into the production schedule, produce the CAD drawings and pay the joiner for the first stages of work. Without a deposit, the maker would be carrying that cost personally on every order, which no small business can do. It's standard practice across the UK bespoke joinery trade.",
    audience: 2, classification: "industry_good_practice" },

  { q: "Is it normal to be asked for a large deposit on a bespoke staircase?",
    a: "Yes — larger than you'd see on off-the-shelf products because the maker's tying up materials and workshop time on a piece that can only fit YOUR house. Exact deposit percentage varies significantly between companies (some ask for a third, some more, some structure it as material-cost + design fee), so don't compare quotes on price alone — compare what the deposit's actually covering. Reasonable, transparent deposit terms are a mark of an established maker.",
    audience: 2, classification: "expert_observation" },

  { q: "Should I pay the full price of my staircase before it's installed?",
    a: "Ideally no — most reputable staircase makers use a staged payment schedule that gives both sides some protection. Typical shape: a deposit at order (covers materials + design), a stage payment before delivery or install (covers manufacturing labour), and a final balance on satisfactory completion. Full payment upfront is unusual on a bespoke staircase and worth pushing back on unless there's a specific reason. It also protects you if there's a snagging item at final inspection.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Why can paying the full staircase cost upfront feel risky as a homeowner?",
    a: "Because you lose your practical leverage the moment the maker's been paid. If a snagging item appears at install (a small finish blemish, a component that needs adjusting, a delivery-damaged part), a supplier who's already got 100% of the money has less urgency to come back. A withheld final balance — even a modest one — keeps everyone motivated to close the job out properly. This isn't about mistrust; it's how the trade normally works.",
    audience: 2, classification: "professional_recommendation" },

  { q: "What's the safest payment structure for a staircase order?",
    a: "Staged, in writing, tied to milestones. A common structure: deposit on order (covers materials + design work), interim payment before delivery (covers manufacture), final balance on satisfactory installation. Each stage is a real milestone the maker's actually reached — not just a calendar date. Get the schedule written into the order confirmation before you sign, not verbally agreed 'we'll sort it as we go'.",
    audience: 3, classification: "professional_recommendation" },

  { q: "What should a proper staircase payment agreement include?",
    a: "In writing before you pay a deposit: the full staircase design (drawing reference), timber species and grade, finish specification, balustrade detail, installation scope (who's fitting), delivery arrangements, payment stages with amounts and triggers, expected timeline, and what happens if either side needs to change something later. If any of those aren't spelled out on the paperwork, ask for them before signing — after signing is much harder.",
    audience: 3, classification: "industry_good_practice" },

  { q: "Should I withhold the final payment if there's a snagging issue on my staircase?",
    a: "Reasonable snagging (a small mark, a component needing adjustment, a paint touch-up) — hold a proportionate amount back until it's resolved. Not the whole balance for a small issue, but enough to keep everyone motivated. Genuine defects (something structurally wrong, wrong timber species, incorrect dimensions) — you're within your rights to hold the final payment pending the fix. Communicate in writing, list what needs sorting, and pay promptly once it's done.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Should I accept money off instead of having damaged staircase parts properly fixed?",
    a: "Usually a bad trade. A discount solves the awkward moment today, but the damaged tread or scratched newel stays in your hallway for the next 30 years and every guest walking past sees it. A staircase is one of the most looked-at features in a house — the damage doesn't fade. Always push for the proper repair or a replacement component first; take the discount only if the fix genuinely isn't possible and the discount reflects the long-term cost of living with the imperfection.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Should my new staircase arrive in genuinely perfect condition?",
    a: "Free of damage, poor workmanship or wrong specification — yes, absolutely. Free of natural timber character (grain variation, small colour differences, an occasional tight knot on character-grade timber) — no, that's what real wood looks like and it's not a defect. The line matters: damage and workmanship failures are legitimate to raise; asking for a piece of natural oak to look like a machine-cut plastic tread is unreasonable. Know which is which before you complain.",
    audience: 2, classification: "expert_observation" },

  { q: "What are my consumer rights if my new staircase turns out to be faulty?",
    a: "As a UK consumer buying from a business, the Consumer Rights Act 2015 says goods must be of satisfactory quality, fit for purpose and as described — that applies to bespoke staircases too. If something's genuinely faulty (not just 'I've changed my mind'), you can ask for a repair, replacement or refund depending on the situation. Try direct communication with the maker first — that fixes 95% of issues. If it doesn't, Citizens Advice and Trading Standards can help. Serious disputes are ultimately a solicitor matter, not a Nex one.",
    audience: 2, classification: "professional_recommendation" },

  { q: "Does the cooling-off period apply to a bespoke staircase order?",
    a: "In most cases no — bespoke or custom-made goods are specifically excluded from the standard 14-day cancellation right under the Consumer Contracts Regulations. Once you've approved the drawing and the workshop starts making YOUR specific staircase, you generally can't cancel just because you've changed your mind. That's another reason to review the drawing carefully BEFORE approving — after that point, cancelling gets expensive fast. If in doubt about a specific situation, Citizens Advice can confirm.",
    audience: 3, classification: "professional_recommendation" },

  { q: "Is it worth paying the staircase deposit by credit card for extra protection?",
    a: "Yes, on any deposit over £100 (and up to £30,000). Under Section 75 of the Consumer Credit Act, when you pay any portion by credit card, the card provider is jointly liable with the supplier if things go seriously wrong (goods not delivered, company goes bust, major misrepresentation). It's genuine consumer protection you don't get with bank transfer or debit card. Doesn't mean the maker's untrustworthy — it just means an extra layer of safety net on a significant purchase.",
    audience: 3, classification: "professional_recommendation" }
];

// ─── Load + append with dedup ─────────────────────────────────
const doc = JSON.parse(fs.readFileSync(FILE, "utf8"));
if (!Array.isArray(doc.entries)) doc.entries = [];

const nextN = doc.entries.reduce((a, e) => {
  const m = String(e.id ?? "").match(/-(\d+)$/);
  return m ? Math.max(a, parseInt(m[1], 10)) : a;
}, 0) + 1;

const norm = (q) => String(q ?? "").toLowerCase().replace(/[?.!,;:'"]/g, "").replace(/\s+/g, " ").trim();
const existing = new Set(doc.entries.map((e) => norm(e.question)));

let added = 0, skipped = 0;
for (const item of NEW) {
  if (existing.has(norm(item.q))) { skipped += 1; continue; }
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
  existing.add(norm(item.q));
  added += 1;
}
doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`✅ Batch 6 (payments/deposits/contracts): Added ${added} new entries (${skipped} skipped). Total: ${doc.entries.length}`);
