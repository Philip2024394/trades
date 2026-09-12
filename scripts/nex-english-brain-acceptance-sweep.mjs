#!/usr/bin/env node
// scripts/nex-english-brain-acceptance-sweep.mjs
//
// Founder BEGIN 2026-09-11 · rock-solid acceptance sweep for NEX speaking.
//
// Runs a battery of realistic founder prompts against BOTH surfaces:
//   · /api/nex-conv/chat  (NEX Chat role)
//   · /api/nex/agent/submit  (NEX1 software-engineering role)
//
// Reports:
//   · What the domain classifier chose
//   · What intent slug the code adapter / orchestrator picked
//   · What concept + sense_id was resolved (if any)
//   · The final user-visible reply text (chat only · agent has a plan)
//   · Cross-surface consistency check: same sense_id from both when a concept
//     is present in the prompt.

const BASE = process.env.NEX_BASE_URL ?? "http://localhost:3008";

const PROMPTS = [
  // ── Meta / small talk / capabilities ──────────────────────
  { kind: "meta", prompt: "hey" },
  { kind: "meta", prompt: "hi mate" },
  { kind: "meta", prompt: "what can you do" },
  { kind: "meta", prompt: "hey what code can you programe mate" },
  { kind: "meta", prompt: "what are you capable of?" },
  { kind: "meta", prompt: "how can you help me today" },

  // ── Definition questions (should hit resolveConcept) ─────
  { kind: "explain", prompt: "what does database migration mean?", cross_check_key: "migration.database_schema_change" },
  { kind: "explain", prompt: "what is a route in this codebase?", cross_check_key: "route.http_url_path" },
  { kind: "explain", prompt: "what does endpoint mean?", cross_check_key: "endpoint.http_api_endpoint" },
  { kind: "explain", prompt: "walk me through what refactor means", cross_check_key: "refactor.code_restructure_no_behaviour_change" },
  { kind: "explain", prompt: "what is a test in vitest?", cross_check_key: "test.automated_software_test" },
  { kind: "explain", prompt: "what does bug mean?", cross_check_key: "bug.software_defect" },
  { kind: "explain", prompt: "define postgres", cross_check_key: "postgres.database_engine" },
  { kind: "explain", prompt: "what is a git worktree?", cross_check_key: "worktree.git_worktree_isolated_checkout" },
  { kind: "explain", prompt: "explain what typescript is", cross_check_key: "typescript.typed_javascript_language" },
  { kind: "explain", prompt: "meaning of API", cross_check_key: "api.application_programming_interface" },

  // ── Slangy definition questions ──────────────────────────
  { kind: "explain_slang", prompt: "what's a route thingy in this app?", cross_check_key: "route.http_url_path" },
  { kind: "explain_slang", prompt: "what does a bug mean here mate", cross_check_key: "bug.software_defect" },

  // ── Operational (should trigger nex-agent plan, not chat resolveConcept) ─
  { kind: "operational", prompt: "chuck in a new endpoint at /api/nex/health that returns ok" },
  { kind: "operational", prompt: "sort out the broken login route", cross_check_key: "route.http_url_path" },
  { kind: "operational", prompt: "add a migration for a new user_preferences table", cross_check_key: "migration.database_schema_change" },
  { kind: "operational", prompt: "refactor the tierCatalog module to be smaller", cross_check_key: "refactor.code_restructure_no_behaviour_change" },
  { kind: "operational", prompt: "write tests for the auth helpers", cross_check_key: "test.automated_software_test" },

  // ── Ambiguous (should return clarify) ────────────────────
  { kind: "ambiguous", prompt: "what does migration mean" },  // no domain signal
];

async function testChat(prompt) {
  const r = await fetch(`${BASE}/api/nex-conv/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: prompt, conversation_id: `sweep-${Math.random().toString(36).slice(2, 10)}` }),
  });
  const j = await r.json();
  const adapter = j._debug_timings?.lcc_adapter_reply ?? {};
  const domain = j._debug_timings?.lcc_domain;
  const senseMatches = (adapter.reasoning ?? []).find(x => x.includes("sense_id="));
  const senseId = senseMatches?.match(/sense_id=([a-f0-9-]{36})/)?.[1] ?? null;
  const senseKey = senseMatches?.match(/sense=([a-z0-9_]+)/)?.[1] ?? null;
  const concept = senseMatches?.match(/concept=([a-z0-9_]+)/)?.[1] ?? null;
  return {
    domain,
    intent_slug: adapter.intent_slug ?? null,
    reply_kind: adapter.reply_kind ?? null,
    trust: adapter.trust ?? null,
    concept, sense_key: senseKey, sense_id: senseId,
    entity_ref: adapter.entity_ref ?? null,
    reply: (j.reply ?? "").slice(0, 220),
  };
}

async function testAgent(prompt) {
  const r = await fetch(`${BASE}/api/nex/agent/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const j = await r.json();
  return {
    ok: j.ok,
    status: j.status,
    intent_kind: j.plan?.intent?.kind ?? null,
    task_id: j.task_id,
    brief_head: (j.brief ?? "").slice(0, 200),
  };
}

async function readResolvedSenseFromTask(task_id) {
  if (!task_id) return null;
  const pg = await import("pg");
  const c = new pg.default.Client({ connectionString: "postgresql://postgres:Admin1phil@localhost:5433/nex_dev" });
  await c.connect();
  try {
    const r = await c.query(`SELECT body FROM nex_agent.task_steps WHERE task_id=$1 AND title LIKE 'resolved%'`, [task_id]);
    const senses = [];
    for (const row of r.rows) {
      try {
        const body = typeof row.body === "string" ? JSON.parse(row.body) : row.body;
        for (const s of body?.resolved ?? []) senses.push(s);
      } catch { /* ignore */ }
    }
    return senses;
  } finally { await c.end(); }
}

async function main() {
  console.log("=== NEX Speaking · rock-solid acceptance sweep ===\n");
  const results = [];
  for (const p of PROMPTS) {
    const chat = await testChat(p.prompt);
    const agent = p.kind === "operational" || p.kind === "meta" || p.kind === "explain" || p.kind === "explain_slang" || p.kind === "ambiguous"
      ? await testAgent(p.prompt)
      : null;
    const agentSenses = agent ? await readResolvedSenseFromTask(agent.task_id) : null;

    // Cross-check: if a cross_check_key was provided, is the same sense_id
    // visible from BOTH surfaces?
    let cross_match = null;
    if (p.cross_check_key && chat.sense_id) {
      const [wantConcept, wantSenseKey] = p.cross_check_key.split(".");
      const agentSense = agentSenses?.find(s => s.concept === wantConcept && s.sense_key === wantSenseKey);
      cross_match = { chat_sense_id: chat.sense_id, agent_sense_id: agentSense?.sense_id ?? null, same: chat.sense_id === agentSense?.sense_id };
    }

    results.push({ prompt: p.prompt, kind: p.kind, chat, agent, cross_match });
  }

  // Summary
  console.log(`\n${"═".repeat(80)}`);
  console.log("RESULTS");
  console.log("═".repeat(80));
  for (const r of results) {
    console.log(`\n[${r.kind}] ${JSON.stringify(r.prompt)}`);
    console.log(`  chat  · domain=${r.chat.domain} intent=${r.chat.intent_slug} kind=${r.chat.reply_kind} sense=${r.chat.concept}.${r.chat.sense_key ?? "-"} `);
    if (r.chat.reply) console.log(`         reply: ${r.chat.reply}`);
    if (r.agent) {
      console.log(`  agent · status=${r.agent.status} intent=${r.agent.intent_kind}`);
      if (r.agent.brief_head) console.log(`         brief: ${r.agent.brief_head.split("\n")[0]}`);
    }
    if (r.cross_match) {
      const symbol = r.cross_match.same ? "✓" : (r.cross_match.agent_sense_id ? "≠" : "?");
      console.log(`  ${symbol} cross-surface sense_id match: ${r.cross_match.same} · chat=${r.cross_match.chat_sense_id?.slice(0,8)}… agent=${r.cross_match.agent_sense_id?.slice(0,8) ?? "null"}…`);
    }
  }

  // Score
  const explainWithConcept = results.filter(r => (r.kind === "explain" || r.kind === "explain_slang") && r.chat.sense_id);
  const explainTotal = results.filter(r => r.kind === "explain" || r.kind === "explain_slang").length;
  const crossMatches = results.filter(r => r.cross_match?.same).length;
  const crossAttempts = results.filter(r => r.cross_match).length;

  console.log("\n" + "═".repeat(80));
  console.log("SCORE");
  console.log("═".repeat(80));
  console.log(`Explain queries resolving to a concept: ${explainWithConcept.length}/${explainTotal}`);
  console.log(`Cross-surface sense_id matches:         ${crossMatches}/${crossAttempts}`);
}

main().catch(e => { console.error(e); process.exit(1); });
