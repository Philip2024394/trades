// Seed the coming-soon Brain manifests. Idempotent — only writes
// brain.json where one doesn't already exist. Run once after the
// brains/ folder scaffold.

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const STUBS = [
  { path: "brains/construction/electrical/brain.json",   slug: "electrical",   title: "Nex Electrical",   category: "construction", icon: "⚡",  keywords: ["electrical", "electrician", "wiring", "consumer unit", "18th edition", "part p", "socket", "circuit"] },
  { path: "brains/construction/plumbing/brain.json",     slug: "plumbing",     title: "Nex Plumbing",     category: "construction", icon: "🚰", keywords: ["plumbing", "plumber", "boiler", "leak", "tap", "faucet", "pipe", "drain", "gas safe", "combi", "radiator"] },
  { path: "brains/construction/roofing/brain.json",      slug: "roofing",      title: "Nex Roofing",      category: "construction", icon: "🏠", keywords: ["roof", "roofer", "roofing", "tile", "slate", "gutter", "fascia", "soffit", "flashing", "ridge"] },
  { path: "brains/construction/joinery/brain.json",      slug: "joinery",      title: "Nex Joinery",      category: "construction", icon: "🪵", keywords: ["joinery", "joiner", "door", "window", "skirting", "architrave", "mortice", "tenon"] },
  { path: "brains/construction/flooring/brain.json",     slug: "flooring",     title: "Nex Flooring",     category: "construction", icon: "🧱", keywords: ["flooring", "floor", "laminate", "engineered wood", "vinyl", "lvt", "carpet", "tile", "underlay"] },
  { path: "brains/construction/painting/brain.json",     slug: "painting",     title: "Nex Painting",     category: "construction", icon: "🎨", keywords: ["painting", "painter", "decorator", "paint", "primer", "emulsion", "gloss", "eggshell", "wallpaper"] },
  { path: "brains/construction/garden/brain.json",       slug: "garden",       title: "Nex Garden",       category: "construction", icon: "🌿", keywords: ["garden", "landscaping", "landscaper", "patio", "decking", "lawn", "hedge", "planting", "fence"] },
  { path: "brains/medical/brain.json",                   slug: "medical",      title: "Nex Medical",      category: "medical",      icon: "🩺", keywords: ["medical", "health", "symptom", "doctor", "gp", "nhs", "prescription", "diagnosis"] },
  { path: "brains/legal/brain.json",                     slug: "legal",        title: "Nex Legal",        category: "legal",        icon: "⚖️",  keywords: ["legal", "law", "lawyer", "solicitor", "contract", "conveyancing", "will", "landlord", "tenant"] },
  { path: "brains/finance/brain.json",                   slug: "finance",      title: "Nex Finance",      category: "finance",      icon: "💷", keywords: ["finance", "mortgage", "loan", "interest rate", "isa", "tax", "vat", "budget", "savings"] },
  { path: "brains/travel/brain.json",                    slug: "travel",       title: "Nex Travel",       category: "travel",       icon: "✈️", keywords: ["travel", "flight", "hotel", "holiday", "visa", "passport", "destination", "airline"] },
  { path: "brains/education/brain.json",                 slug: "education",    title: "Nex Education",    category: "education",    icon: "📚", keywords: ["education", "school", "university", "college", "course", "student", "revision", "exam"] },
  { path: "brains/pets/brain.json",                      slug: "pets",         title: "Nex Pets",         category: "pets",         icon: "🐾", keywords: ["pet", "dog", "cat", "puppy", "kitten", "vet", "grooming", "training"] },
  { path: "brains/beauty/brain.json",                    slug: "beauty",       title: "Nex Beauty",       category: "beauty",       icon: "💄", keywords: ["beauty", "skincare", "haircare", "makeup", "salon", "spa", "manicure", "pedicure"] }
];

let written = 0, skipped = 0;
for (const s of STUBS) {
  const abs = `C:/Users/Victus/trades/${s.path}`;
  if (existsSync(abs)) { skipped++; continue; }
  mkdirSync(dirname(abs), { recursive: true });
  const manifest = {
    slug:                s.slug,
    title:               s.title,
    description:         `${s.title} — coming soon.`,
    version:             "0.1.0",
    category:            s.category,
    icon:                s.icon,
    keywords:            s.keywords,
    supported_languages: ["en-GB"],
    prompt_file:         "./prompt.md",
    knowledge_paths:     ["./knowledge/*.json"],
    plugins:             {},
    enabled:             false,
    priority:            50,
    status:              "coming_soon"
  };
  writeFileSync(abs, JSON.stringify(manifest, null, 2) + "\n");
  written++;
}

console.log(`✓ ${written} stubs written · ${skipped} already existed`);
