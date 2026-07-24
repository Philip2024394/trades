#!/usr/bin/env node
// Bulk fix "cheap"/"cheaper" and any genuine US spellings in the
// staircase Brain content. Per user rule 2026-07-24 — Nex must never
// use "cheap" (respectful language: "less expensive" / "more affordable")
// and must always use UK English throughout.

import { promises as fs } from "node:fs";
import path from "node:path";

const draftPaths = {
  craft:       ".author-studio-drafts/staircase/craft.json",
  materials:   ".author-studio-drafts/staircase/materials.json",
  regulations: ".author-studio-drafts/staircase/regulations.json"
};

// Ordered replacements — longer patterns first so they win.
const REPLACEMENTS = [
  // "cheap" family — respect the sentence context
  [/\bmuch cheaper than\b/g,                 "significantly less expensive than"],
  [/\bfar cheaper than\b/g,                  "significantly less expensive than"],
  [/\ba lot cheaper than\b/g,                "significantly less expensive than"],
  [/\bcheaper than\b/g,                      "less expensive than"],
  [/\bcheaper on\b/g,                        "more economical on"],
  [/\bcheaper because\b/g,                   "more affordable because"],
  [/\bcheaper option\b/g,                    "more affordable option"],
  [/\bthe cheaper option\b/g,                "the more affordable option"],
  [/\bcheaper alternative\b/g,               "more affordable alternative"],
  [/\bcheaper to (build|make|manufacture|produce|fit|install|source|order|buy)\b/g,
                                              "less expensive to $1"],
  [/\bcheaper per (cube|board|piece|metre|linear metre|square metre|m³|m²)\b/g,
                                              "less expensive per $1"],
  [/\bcheaper up front\b/g,                  "less expensive up front"],
  [/\bcheaper upfront\b/g,                   "less expensive upfront"],
  [/\bcheaper at\b/g,                        "at a lower price at"],
  [/\bcheaper stair\b/g,                     "more affordable stair"],
  [/\bcheaper builds\b/g,                    "more budget-conscious builds"],
  [/\bcheaper build\b/g,                     "more budget-conscious build"],
  [/\bcheaper stock\b/g,                     "more affordable stock"],
  [/\bcheaper quotes\b/g,                    "lower-priced quotes"],
  [/\bcheaper quote\b/g,                     "lower-priced quote"],
  [/\bslightly cheaper\b/g,                  "slightly less expensive"],
  [/\bconsiderably cheaper\b/g,              "considerably more affordable"],
  [/\bcheaper\b/g,                           "less expensive"],
  [/\bCheaper /g,                            "Less expensive "],
  [/\bthe cheapest\b/g,                      "the most affordable"],
  [/\bcheapest\b/g,                          "most affordable"],
  [/\bfastest and cheapest\b/g,              "fastest and most affordable"],
  [/\ba cheap tool\b/g,                      "a poorly-made tool"],
  [/\ba cheap chisel\b/g,                    "a poorly-made chisel"],
  [/\ba cheap block plane\b/g,               "a poorly-made block plane"],
  [/\ba cheap router\b/g,                    "a poorly-made router"],
  [/\bcheap tool\b/g,                        "budget tool"],
  [/\bcheap and quick\b/g,                   "quick and low-cost"],
  [/\bcheap enough\b/g,                      "affordable enough"],
  [/\bfixed cheap\b/g,                       "fixed at a modest cost"],
  [/\bcheap price\b/g,                       "low price"],
  [/\bcheap materials\b/g,                   "lower-cost materials"],
  [/\bare cheap\b/g,                         "are affordable"],
  [/\bwas cheap\b/g,                         "was inexpensive"],
  [/\bis cheap\b/g,                          "is affordable"],
  [/\bcheap\b/g,                             "affordable"],
  [/\bCheap /g,                              "Affordable "],
  [/\bCheap\.$/g,                            "Affordable."],

  // US spellings — proper matches only (avoid the "colour-" false alarm)
  [/\bcolor(s|ed|ing|ful)?\b/g, (_m, s) => "colour" + (s ? (s === "ful" ? "ful" : s) : "")],
  [/\bColor(s|ed|ing|ful)?\b/g, (_m, s) => "Colour" + (s ? (s === "ful" ? "ful" : s) : "")],
  [/\bfavor(s|ed|ing|able|ite)?\b/g, (_m, s) => "favour" + (s ?? "")],
  [/\bFavor(s|ed|ing|able|ite)?\b/g, (_m, s) => "Favour" + (s ?? "")],
  [/\bbehavior(s|al)?\b/g, (_m, s) => "behaviour" + (s ?? "")],
  [/\bBehavior(s|al)?\b/g, (_m, s) => "Behaviour" + (s ?? "")],
  [/\brealize(d|s)?\b/g, (_m, s) => "realise" + (s ?? "")],
  [/\bRealize(d|s)?\b/g, (_m, s) => "Realise" + (s ?? "")],
  [/\brealizing\b/g, "realising"],
  [/\bRealizing\b/g, "Realising"],
  [/\borganize(d|s)?\b/g, (_m, s) => "organise" + (s ?? "")],
  [/\borganizing\b/g, "organising"],
  [/\borganization(s|al)?\b/g, (_m, s) => "organisation" + (s ?? "")],
  [/\bspecialize(d|s)?\b/g, (_m, s) => "specialise" + (s ?? "")],
  [/\bspecializing\b/g, "specialising"],
  [/\banalyze(d|s)?\b/g, (_m, s) => "analyse" + (s ?? "")],
  [/\banalyzing\b/g, "analysing"],
  [/\bminimize(d|s)?\b/g, (_m, s) => "minimise" + (s ?? "")],
  [/\bmaximize(d|s)?\b/g, (_m, s) => "maximise" + (s ?? "")],
  [/\bstandardize(d|s)?\b/g, (_m, s) => "standardise" + (s ?? "")],
  [/\brecognize(d|s)?\b/g, (_m, s) => "recognise" + (s ?? "")],
  [/\bcatalog(s)?\b(?!ue)/g, (_m, s) => "catalogue" + (s ?? "")],
  [/\bdefense\b/g, "defence"],
  [/\boffense\b/g, "offence"],
  [/\baluminum\b/g, "aluminium"],
  [/\bAluminum\b/g, "Aluminium"],
  [/\bgray\b/g, "grey"],
  [/\bGray\b/g, "Grey"],
  [/\bmold\b/g, "mould"],
  [/\bMold\b/g, "Mould"],
  [/\btraveling\b/g, "travelling"],
  [/\btraveled\b/g, "travelled"],
  [/\btraveler\b/g, "traveller"],
  [/\bmodeled\b/g, "modelled"],
  [/\bmodeling\b/g, "modelling"],
  [/\blabeled\b/g, "labelled"],
  [/\blabeling\b/g, "labelling"],
  [/\bcanceled\b/g, "cancelled"],
  [/\bcanceling\b/g, "cancelling"],
  [/\bfueled\b/g, "fuelled"]
];

function fixString(text) {
  let out = text;
  for (const [pattern, replacement] of REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

let totalReplacements = 0;

for (const [module, filepath] of Object.entries(draftPaths)) {
  const p = path.join(process.cwd(), filepath);
  const draft = JSON.parse(await fs.readFile(p, "utf8"));

  if (module === "craft") {
    for (const fact of draft.payload.facts) {
      const before = fact.statement;
      const after = fixString(before);
      if (before !== after) {
        fact.statement = after;
        totalReplacements++;
      }
    }
    for (const term of draft.payload.glossary ?? []) {
      const before = term.definition;
      const after = fixString(before);
      if (before !== after) {
        term.definition = after;
        totalReplacements++;
      }
    }
  } else if (module === "materials") {
    for (const mat of draft.payload.materials) {
      for (const ev of mat.evidence ?? []) {
        if (typeof ev.note === "string") {
          const before = ev.note;
          const after = fixString(before);
          if (before !== after) {
            ev.note = after;
            totalReplacements++;
          }
        }
      }
      if (typeof mat.name === "string") {
        const after = fixString(mat.name);
        if (mat.name !== after) { mat.name = after; totalReplacements++; }
      }
    }
  } else if (module === "regulations") {
    for (const reg of draft.payload.regulations) {
      if (typeof reg.requirement === "string") {
        const before = reg.requirement;
        const after = fixString(before);
        if (before !== after) { reg.requirement = after; totalReplacements++; }
      }
      if (typeof reg.title === "string") {
        const before = reg.title;
        const after = fixString(before);
        if (before !== after) { reg.title = after; totalReplacements++; }
      }
    }
  }

  draft.updated_at = new Date().toISOString();
  await fs.writeFile(p, JSON.stringify(draft, null, 2), "utf8");
}

console.log(JSON.stringify({ ok: true, total_replacements: totalReplacements }));
