// Negative proof · unresolvable reference must NOT invent a hotel.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHAT = "http://localhost:3008/api/nex-conv/chat";

async function post(convId, message) {
  const r = await fetch(CHAT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: convId, message, market: "ID" }),
  });
  return await r.json();
}

const results = [];

// Case 1 · fresh conversation · "tell me more about the first one" · no list ever presented
const cid1 = randomUUID();
console.log("\n─── Case 1 · Fresh conversation · reference has no antecedent ───");
const r1 = await post(cid1, "Tell me more about the first one.");
console.log(`intent=${r1.intent}`);
console.log(`current_reference: ${JSON.stringify(r1.current_reference)}`);
console.log(`k_count=${r1.composition_meta?.knowledge_count}  hydration_reason=${r1.composition_meta?.hydration_reason}`);
console.log(`comp_accepted=${r1.composition_meta?.accepted}  reason=${r1.composition_meta?.reason}`);
console.log(`reply: ${r1.reply?.slice(0, 300)}`);
results.push({ case: 1, question: "Tell me more about the first one.", ...r1 });

// Case 2 · pronoun "it" · no antecedent
const cid2 = randomUUID();
console.log("\n─── Case 2 · Fresh conversation · pronoun 'it' has no antecedent ───");
const r2 = await post(cid2, "What about it?");
console.log(`intent=${r2.intent}`);
console.log(`current_reference: ${JSON.stringify(r2.current_reference)}`);
console.log(`k_count=${r2.composition_meta?.knowledge_count}  hydration_reason=${r2.composition_meta?.hydration_reason}`);
console.log(`comp_accepted=${r2.composition_meta?.accepted}  reason=${r2.composition_meta?.reason}`);
console.log(`reply: ${r2.reply?.slice(0, 300)}`);
results.push({ case: 2, question: "What about it?", ...r2 });

// Assertion checks · report to console + json
const outPath = path.join(here, "_hotel_negative_proof.json");
writeFileSync(outPath, JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2) + "\n");

console.log("\n─── VERDICT ───");
const anyFabricated = results.some((r) => {
  const reply = (r.reply || "").toLowerCase();
  // Fabrication would be: naming a specific hotel by name (Gaotama, Selaras, etc.)
  return /gaotama|selaras|indonesia hotel|griya sentana|hotel dafam/i.test(reply);
});
if (anyFabricated) {
  console.log("🔴 FAIL · one or more negative-case replies invented a specific hotel");
  process.exit(1);
} else {
  console.log("🟢 PASS · no hotel invented for unresolved references");
}
console.log(`→ ${outPath}`);
