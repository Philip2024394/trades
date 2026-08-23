// scripts/nex-diag/extract-reception-verdicts.mjs · Task #79 follow-up · 2026-08-22
//
// Read-only diagnostic. Parses a captured Reception HTML render and prints
// the verdict + reality string per HQ_SYSTEMS entry. Used to prove Reception
// is displaying the same truth the underlying nex.worker_heartbeat rows imply.
// No writes · no HTTP · no DB.

import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "C:/Users/Victus/AppData/Local/Temp/reception.html";
const html = readFileSync(path, "utf8");

const systems = [
  { key: "acquisition", displayName: "Acquisition · Universal Walker" },
  { key: "cle",         displayName: "Conversation Teacher · English + Indonesian" },
  { key: "brain",       displayName: "Brain workers" },
  { key: "intake",      displayName: "Image Intake" },
  { key: "social",      displayName: "Post Publishing · Comms Social" },
];

const verdictLabels = ["GREEN","STUCK","PARTIAL","BLOCKED","NOT_RUNNING","FAILED","UNKNOWN","STANDBY"];

console.log("=== Reception rendered state per HQ_SYSTEMS entry ===\n");

for (const s of systems) {
  const idx = html.indexOf(s.displayName);
  if (idx === -1) {
    console.log(`  ${s.key.padEnd(12)} | ${s.displayName} → NOT FOUND`);
    continue;
  }
  const chunk = html.slice(idx, idx + 6000);

  let verdict = "?";
  for (const label of verdictLabels) {
    const escaped = label.replace(/_/g, "\\\\?_");
    const re = new RegExp(`"${label}"|\\\\"${label}\\\\"`);
    if (re.test(chunk)) { verdict = label; break; }
  }

  const realityMatch = chunk.match(/(\d+ workers?[^"\\]*)/);
  const reality = realityMatch ? realityMatch[1].replace(/\s+/g, " ").trim() : "?";

  const idPattern = /(brain:[a-z-]+|acquisition:[a-z:A-Z_]+|cle:[a-z]+|intake:[a-z]+|social:[a-zA-Z0-9:_.-]+)/g;
  const ids = [...new Set([...chunk.matchAll(idPattern)].map(m => m[1]))].slice(0, 10);

  console.log(`  ${s.key.padEnd(12)} | ${s.displayName}`);
  console.log(`  ${" ".repeat(12)} | verdict: ${verdict}`);
  console.log(`  ${" ".repeat(12)} | reality: ${reality}`);
  if (ids.length) console.log(`  ${" ".repeat(12)} | ids:     ${ids.join(" · ")}`);
  console.log();
}
