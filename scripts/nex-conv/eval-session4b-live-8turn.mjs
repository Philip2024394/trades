// scripts/nex-conv/eval-session4b-live-8turn.mjs
//
// Live 8-turn conversation replay after Session 4b fixes (Philip 2026-08-20).
// Exercises the fixed pipeline in a realistic continuous flow rather than
// isolated 2-turn regression bursts. Must include the oak→walnut correction
// and the glass balustrade request from the Session 4b bug reports.
//
// USAGE
//   npx tsx scripts/nex-conv/eval-session4b-live-8turn.mjs
//
// GUARDRAILS
//   · Uses the same infer.processTurn path as /api/nex-conv/chat.
//   · JsonlStore only (no Postgres · no dev server).
//   · Fresh conversation_id · doesn't pollute prior data.
//   · Requires Ollama + qwen2.5:3b for prose. If down, prose checks
//     degrade to warnings and the transcript reports "(no prose)".

import { createStore } from "./lib/store-factory.mjs";
import { STAIRCASE_ENTITIES, STAIRCASE_INTENTS } from "./lib/entities.mjs";
import * as infer from "./lib/infer.mjs";
import { randomUUID } from "node:crypto";

async function boot() {
  const store = await createStore({ backend: "jsonl" });
  for (const intent of STAIRCASE_INTENTS) await store.upsertIntent(intent);
  for (const ent of STAIRCASE_ENTITIES) await store.upsertEntity({ ...ent, brain: "staircase_brain" });
  return store;
}

async function turn(store, state, text, opts = {}) {
  const out = await infer.processTurn({
    store,
    state,
    brain: "staircase_brain",
    text,
    speaker: "customer",
    withProse: opts.withProse ?? true,
  });
  try { await store.upsertState(state); } catch { /* non-fatal */ }
  return out;
}

function assert(condition, kind, description, evidence) {
  return { kind, description, passed: !!condition, evidence, level: condition ? "pass" : "fail" };
}
function warn(kind, description, evidence) {
  return { kind, description, passed: true, evidence, level: "warn" };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("SESSION 4b · Live 8-turn conversation (post-fix replay)");
  console.log("═══════════════════════════════════════════════════════════");
  const t0 = Date.now();
  const store = await boot();
  console.log(`[boot] store ready · knowledge_items=${store.mem.knowledge_items.size} · entities=${store.mem.entities.size} · intents=${store.mem.intents.size}`);

  const conversationId = randomUUID();
  const state = infer.newState({
    conversation_id: conversationId,
    brain: "staircase_brain",
    business_id: "session4b-live-8turn",
  });

  // 8-turn script. Turns 3 (oak→walnut correction) and 4 (glass balustrade)
  // are the required Session 4b bug re-exercises. The rest wraps them in a
  // realistic homeowner flow so the fixes are tested in context, not isolation.
  const script = [
    { text: "I want an oak staircase.",                        note: "seed material_primary=oak" },
    { text: "What sort of shape would suit a small hallway?",  note: "browse / recommend follow-up" },
    { text: "Actually, change the oak to walnut.",             note: "Bug 1 · correction oak→walnut" },
    { text: "Add glass balustrades to the design.",            note: "Bug 2 · glass balustrade (plural)" },
    { text: "What about the handrail?",                        note: "open-ended follow-up" },
    { text: "Make the handrail walnut too.",                   note: "additional writer" },
    { text: "Roughly how much would this cost?",               note: "silence-over-fabrication probe" },
    { text: "Perfect, that's what I want.",                    note: "close" },
  ];

  const transcript = [];
  const perTurn = [];
  let proseAvailable = true;

  for (let i = 0; i < script.length; i++) {
    const s = script[i];
    const turnT0 = Date.now();
    const out = await turn(store, state, s.text);
    const dt = Date.now() - turnT0;

    const proseErr = out.prose?.error;
    const replyText = out.prose?.text ?? "";
    if (proseErr) proseAvailable = false;

    transcript.push({
      n: i + 1,
      note: s.note,
      customer: s.text,
      nex: proseErr ? `(no prose · ${String(proseErr).slice(0, 120)})` : replyText,
      intent: out.understood_intent?.slug ?? "(none)",
      entities: (out.understood_entities ?? []).map((e) => e.slug ?? e),
      latency_ms: dt,
    });

    perTurn.push({ i: i + 1, out, replyText, proseErr });
  }

  // ─── Print transcript ────────────────────────────────────────────
  console.log("");
  console.log("─── TRANSCRIPT ──────────────────────────────────────────────");
  for (const t of transcript) {
    console.log("");
    console.log(`[Turn ${t.n}] (${t.note}) · intent=${t.intent} · entities=[${t.entities.join(",")}] · ${t.latency_ms}ms`);
    console.log(`  Customer : ${t.customer}`);
    console.log(`  NEX      : ${t.nex}`);
  }

  // ─── Final state ─────────────────────────────────────────────────
  console.log("");
  console.log("─── FINAL ESTABLISHED STATE ─────────────────────────────────");
  console.log(JSON.stringify(state.established_facts, null, 2));
  console.log("");
  console.log("─── CORRECTIONS LOG ─────────────────────────────────────────");
  console.log(JSON.stringify(state.corrections_log, null, 2));

  // ─── Assertions ──────────────────────────────────────────────────
  const assertions = [];

  const finalMaterial = state.established_facts.material_primary?.value;
  assertions.push(assert(
    finalMaterial === "walnut",
    "state",
    `final material_primary should be 'walnut' after oak→walnut correction · got '${finalMaterial}'`,
    { material_primary: state.established_facts.material_primary },
  ));

  const finalBalustrade = state.established_facts.balustrade?.value;
  assertions.push(assert(
    finalBalustrade === "glass",
    "state",
    `final balustrade should be 'glass' · got '${finalBalustrade ?? "(undefined)"}'`,
    { balustrade: state.established_facts.balustrade },
  ));

  const correction = state.corrections_log.find(
    (c) => c.field === "material_primary" && c.previous === "oak" && c.new === "walnut",
  );
  assertions.push(assert(
    !!correction,
    "audit",
    "corrections_log must record oak→walnut correction",
    { corrections_log: state.corrections_log },
  ));

  // Cross-turn state stability: after glass balustrade (turn 4),
  // material_primary must NOT revert (must stay walnut, not oak or glass).
  const materialAfterBalustrade = perTurn[3]?.out?.state_snapshot?.material_primary?.value
    ?? state.established_facts.material_primary?.value;
  assertions.push(assert(
    materialAfterBalustrade === "walnut",
    "state",
    `material_primary should stay 'walnut' after balustrade turn · got '${materialAfterBalustrade}'`,
    { material_after_balustrade: materialAfterBalustrade },
  ));

  // Reply-vs-state agreement on the two required turns.
  if (proseAvailable) {
    const t3Reply = perTurn[2]?.replyText ?? "";
    assertions.push(assert(
      /\bwalnut\b/i.test(t3Reply),
      "reply",
      "Turn 3 reply must mention 'walnut' (correction agreement)",
      { reply: t3Reply.slice(0, 300) },
    ));

    const t4Reply = perTurn[3]?.replyText ?? "";
    assertions.push(assert(
      /\bglass\b/i.test(t4Reply) || /\bbalustr/i.test(t4Reply),
      "reply",
      "Turn 4 reply must mention 'glass' or 'balustrade' (glass balustrade agreement)",
      { reply: t4Reply.slice(0, 300) },
    ));

    // Silence-over-fabrication probe. If turn 7 invents a price
    // (currency symbol followed by digits, or digits followed by currency),
    // flag as WARN — this is a doctrine check, not a code assertion.
    const t7Reply = perTurn[6]?.replyText ?? "";
    const fabricatedPrice = /(?:£|\$|€)\s?\d|\d[\d,]*\s?(?:GBP|USD|EUR|pounds|dollars)/i.test(t7Reply);
    if (fabricatedPrice) {
      assertions.push(warn(
        "doctrine",
        "Turn 7 reply appears to contain a fabricated price · NEX must defer to specialist (silence-over-fabrication)",
        { reply: t7Reply.slice(0, 300) },
      ));
    } else {
      assertions.push(assert(true, "doctrine", "Turn 7 reply did NOT invent a price (silence-over-fabrication holds)", null));
    }
  } else {
    assertions.push(warn("reply", "prose unavailable · reply-vs-state checks skipped", null));
  }

  // Every turn produced SOMETHING (either prose or a documented prose error).
  for (const p of perTurn) {
    const ok = (p.replyText && p.replyText.length > 0) || !!p.proseErr;
    assertions.push(assert(
      ok,
      "pipeline",
      `Turn ${p.i} produced a reply or a prose-error record`,
      { hasReply: !!p.replyText, hasErr: !!p.proseErr },
    ));
  }

  // ─── Print assertions ────────────────────────────────────────────
  console.log("");
  console.log("─── ASSERTIONS ──────────────────────────────────────────────");
  let passed = 0, failed = 0, warned = 0;
  for (const a of assertions) {
    const marker = a.level === "fail" ? "✗" : a.level === "warn" ? "⚠" : "✓";
    console.log(`  ${marker} [${a.kind}] ${a.description}`);
    if (a.evidence && (a.level === "fail" || a.level === "warn")) {
      console.log(`      evidence: ${JSON.stringify(a.evidence).slice(0, 400)}`);
    }
    if (a.level === "fail") failed++;
    else if (a.level === "warn") warned++;
    else passed++;
  }

  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("SUMMARY");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`turns:    ${script.length}`);
  console.log(`passed:   ${passed}`);
  console.log(`failed:   ${failed}`);
  console.log(`warnings: ${warned}`);
  console.log(`elapsed:  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`prose:    ${proseAvailable ? "available" : "UNAVAILABLE (Ollama down or errored)"}`);

  process.exit(failed === 0 ? 0 : 2);
}

main().catch((e) => {
  console.error("UNHANDLED:", e instanceof Error ? e.stack ?? e.message : String(e));
  process.exit(1);
});
