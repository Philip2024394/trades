#!/usr/bin/env node
// Batch 37 — UK stringer dimensions + overall staircase width + softwood bounce warning (Philip 2026-07-25).
import fs from "node:fs";
import path from "node:path";
const FILE = path.resolve("knowledge/staircase.json");
const raw = fs.readFileSync(FILE, "utf8");
fs.writeFileSync(`${FILE}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`, raw, "utf8");
const doc = JSON.parse(raw);

const NEW = [
  { q: "What is the standard overall width of a UK domestic staircase?",
    a: "Measured over the strings (outside-to-outside of both stringers) — typically 800mm to 860mm, averaging around 865mm. Anything narrower than 800mm gets tight for two-person passing. Anything wider than 900mm starts to feel commercial. If you're picking a new build width, 850mm is a safe UK domestic sweet spot.",
    audience: 2, classification: "expert_observation" },

  { q: "What thickness should a UK staircase stringer be?",
    a: "Depends on the construction type. 32mm is the UK standard for cladding / housed strings — most common by far. 38mm is used for mid-weight structural work. 50mm for structural cut strings (heavy-duty, longer flights). Some makers offer 40mm and 44mm for specific projects — always ask the maker directly, not everyone stocks these. Rule of thumb: closed housed string = 32mm; cut/open string = 38mm minimum; long or wide flights = 50mm.",
    audience: 3, classification: "manufacturer_guidance" },

  { q: "How deep is a standard raw stringer stock?",
    a: "Around 275mm — sized to accommodate the rise + going of the treads plus the housing rebates cut into the interior face. That's the raw stock most UK suppliers hold. Cut strings can be deeper depending on the pitch and tread depth. If your design calls for anything deeper than 300mm, expect a longer lead time — not standard stock.",
    audience: 3, classification: "manufacturer_guidance" },

  { q: "Why would a staircase feel bouncy when two people pass on it?",
    a: "Most likely the strings are softwood at 32mm thickness. Softwood strings at that thickness can flex slightly under two-person live load — the amount of bounce depends on the country the timber was grown in (different densities and stiffness). Fixes: specify 38mm strings minimum, switch to hardwood (oak, ash, beech), or add a metal-reinforced backing behind the string. For any staircase where regular two-person passing is expected (busy family home, HMO, commercial), don't specify 32mm softwood strings.",
    audience: 2, classification: "safety_advice", safety: "For staircases expected to carry regular two-person live load, always specify 38mm+ strings or hardwood. Recurring bounce indicates undersized structure and should be assessed by a qualified staircase professional." },

  { q: "Does the country the timber comes from affect the staircase strength?",
    a: "Yes — noticeably for softwood strings at the thinner end (32mm). Timber grown in colder, slower-growth climates tends to be denser and stiffer than fast-grown warmer-climate softwood. Two strings labelled 'pine 32mm' from different countries can behave differently under load. Reputable UK staircase makers will tell you the country of origin if you ask. For any critical application, ask for the density spec or specify hardwood where climate variation is less impactful.",
    audience: 3, classification: "professional_recommendation" }
];

const nextN = doc.entries.reduce((a, e) => {
  const m = String(e.id ?? "").match(/-(\d+)$/);
  return m ? Math.max(a, parseInt(m[1], 10)) : a;
}, 0) + 1;
const norm = (q) => String(q ?? "").toLowerCase().replace(/[?.!,;:'"]/g, "").replace(/\s+/g, " ").trim();
const existing = new Set(doc.entries.map((e) => norm(e.question)));

let added = 0;
for (const item of NEW) {
  if (existing.has(norm(item.q))) continue;
  const id = `staircase-faq-${String(nextN + added).padStart(3, "0")}`;
  doc.entries.push({
    id, kind: "faq", question: item.q, answer: item.a, category_tag: "staircase",
    audience_level: item.audience ?? null, classification: item.classification ?? "industry_good_practice",
    safety_note: item.safety ?? null, source_verified_at: null, fact_check_flag: null
  });
  existing.add(norm(item.q));
  added += 1;
}
doc.count = doc.entries.length;
doc.generated_at = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`✅ Batch 37 (UK stringer dimensions + bounce warning): Added ${added} new entries. Total: ${doc.entries.length}`);
