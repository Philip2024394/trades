// Extend Universal Q&A with the customer-facing wording anchors from
// Philip's Nex Vision Rule "a staircase remains a staircase even when the
// image is incomplete" (Q201-Q224, 2026-08-02).
//
// The RULE itself lives in memory. What lives here are the 6 customer-facing
// Q&A pairs that should fire at runtime when a customer asks "is this still
// a staircase if part is cropped" style questions. All answers verbatim.

import { readFileSync, writeFileSync } from "node:fs";

const PATH = "data/nex-universal-qa.json";
const d = JSON.parse(readFileSync(PATH, "utf8"));

const VISION_QA = [
  {
    q: "Is this image still a staircase if part of it is cropped?",
    a: "Yes. A staircase remains a staircase whether or not the full image is visible. Nex identifies the staircase from the visible construction — the treads, risers, structure, handrail and balustrade — not from whether the camera captured every part of it. Cropped or partial images are still staircases when the visible elements clearly identify the design.",
  },
  {
    q: "Does a staircase need a balcony to be complete?",
    a: "No. A staircase without a balcony is still a complete staircase. A balcony is an optional continuation of the staircase around an open landing or gallery edge. A staircase enclosed between walls or finishing into a closed corridor may have no balcony — it is still a full staircase.",
  },
  {
    q: "Why can't Nex identify the whole staircase from the photo?",
    a: "Because the photo captures only part of the installation. Nex analyses the visible elements first — style, materials, construction details — and then explains what may continue beyond the frame. A wider view would confirm the complete layout, but the visible section is still a valid staircase.",
  },
  {
    q: "Can Nex analyse a single newel post or handrail image?",
    a: "Yes. A newel post, handrail connection, or isolated balustrade section is a strong staircase-component indicator. Nex recognises it as a likely staircase component and asks for a wider view only if the complete configuration matters for the customer's question.",
  },
  {
    q: "Is a staircase under construction still a staircase?",
    a: "Yes. Unfinished staircases — plywood steps, exposed shells, structural timber before finishing — are staircases. Nex identifies them as staircases under construction rather than rejecting them because the final materials are not yet visible.",
  },
  {
    q: "Why does Nex not say 'this is not the full staircase'?",
    a: "Because that phrasing suggests the staircase does not exist. A cropped image is not a rejection — it is a partial view. Nex prefers to describe the visible staircase elements and, where useful, note that the complete installation may continue beyond the frame. Analysing visible evidence first is more helpful than emphasising missing areas.",
  },
];

const existingByQ = new Map(d.qa.map((x, i) => [x.q.toLowerCase().trim(), i]));
let added = 0, updated = 0;

for (const item of VISION_QA) {
  const key = item.q.toLowerCase().trim();
  if (existingByQ.has(key)) { d.qa[existingByQ.get(key)] = item; updated++; }
  else                      { d.qa.push(item); added++; }
}

d.updated_at = new Date().toISOString();
writeFileSync(PATH, JSON.stringify(d, null, 2), "utf8");

const authored = d.qa.filter((x) => x.a && x.a.trim().length > 0).length;
console.log("Universal Q&A · vision-partial-image batch");
console.log("  added:   ", added);
console.log("  updated: ", updated);
console.log("  total Qs:", d.qa.length);
console.log("  authored:", authored);
