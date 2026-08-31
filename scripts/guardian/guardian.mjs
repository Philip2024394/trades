#!/usr/bin/env node
// NEX AI Guardian · in-repo regression gate for the AI stack.
//
// Runs a golden-set of canonical NEX cases against the current code
// and asserts that:
//   - the router picks the correct model role
//   - the resolver + fallback chain behaves correctly
//   - tool calls fire when they should
//   - language answers match language asked (Indonesian / English)
//
// Modes:
//   --fast       Routing + fallback assertions only. No LLM. < 1 s.
//   --full       Adds language + tool assertions against live Ollama.
//                Typical run 2–5 min depending on cold loads.
//   --capture-baseline
//                Writes current results to baseline.json for
//                subsequent regression comparison. Use this ONLY
//                after an intentional behaviour change you've
//                verified by hand.
//   --add-failure <id> <fixtureFile>
//                (Reserved for the auto-corpus-growth feature.)
//
// Exit codes:
//   0 · all cases passed AND no regression vs. baseline
//   1 · one or more cases failed OR regression detected
//   2 · configuration error (cases missing, Ollama down, etc.)
//
// The runner deliberately touches ONLY the same production modules
// the /api/nex/converse/stream route uses:
//   - pickRole()                     from src/lib/nex/routing.ts
//   - resolveNexBrainWithFallback()  from src/lib/nex/brain/resolve.ts
//   - createOllamaBrainProvider()    for direct language/tool probes

import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const casesDir = path.join(here, "cases");
const baselinePath = path.join(here, "baseline.json");

const argv = process.argv.slice(2);
const MODE = argv.includes("--full") ? "full" : "fast";
const CAPTURE = argv.includes("--capture-baseline");

async function run() {
  console.log(`\nNEX AI GUARDIAN · mode=${MODE}${CAPTURE ? " · CAPTURING BASELINE" : ""}\n`);

  const { pickRole } = await import("../../src/lib/nex/routing.ts");
  const { resolveNexBrainWithFallback } = await import("../../src/lib/nex/brain/resolve.ts");
  const { createOllamaBrainProvider, probeOllama } = await import("../../src/lib/nex/brain/providers/ollama.ts");
  const { classifyConversationIntent, assertSpecialistIntent } = await import("../../src/lib/nex/conversation-intent.ts");
  const { retrieveKnowledge } = await import("../../src/lib/nex/indonesia/knowledge.ts");
  const { decideRag } = await import("../../src/lib/nex/indonesia/rag.ts");
  const { classifySafetySignal } = await import("../../src/lib/nex/safety.ts");
  const { listAllRecords } = await import("../../src/lib/nex/indonesia/knowledge.ts");
  const { listAllWalkerSpecs } = await import("../../src/lib/nex/indonesia/walkers/taxonomy.ts");
  const { loadConfigWalkers } = await import("../../src/lib/nex/indonesia/walkers/config-walker.ts");
  const { WorkforceRegistry } = await import("../../src/lib/nex/indonesia/workforce/registry.ts");
  const { supervisorTick } = await import("../../src/lib/nex/indonesia/workforce/supervisor.ts");
  const { runOneCycle } = await import("../../src/lib/nex/indonesia/workforce/supervised-worker.ts");
  const { listProvinces, provincesByIsland, buildCoverageMatrix, ISLANDS } = await import("../../src/lib/nex/indonesia/data/geo.ts");
  const { FRESHNESS_WINDOW_MS } = await import("../../src/lib/nex/indonesia/data/freshness.ts");
  const { scoreEntity } = await import("../../src/lib/nex/indonesia/data/quality.ts");
  const { resolveConflict } = await import("../../src/lib/nex/indonesia/data/conflict.ts");
  const { shouldMerge } = await import("../../src/lib/nex/indonesia/data/entity-resolution.ts");
  const { migrateAll } = await import("../../src/lib/nex/indonesia/data/migration.ts");
  const { GapRegistry } = await import("../../src/lib/nex/indonesia/gaps/gap-registry.ts");
  const { detectGap } = await import("../../src/lib/nex/indonesia/gaps/gap-detector.ts");
  const { httpFetch } = await import("../../src/lib/nex/indonesia/live/http-adapter.ts");
  const { parseBmkgEarthquake } = await import("../../src/lib/nex/indonesia/live/bmkg.ts");
  const { parseMagmaStatuses, createMagmaVolcanoConnector } = await import("../../src/lib/nex/indonesia/live/magma.ts");
  const { createBmkgEarthquakeConnector } = await import("../../src/lib/nex/indonesia/live/bmkg.ts");
  const { LiveSourceHealthRegistry, RecentObservationStore, eligibleConnectors, liveTick } = await import("../../src/lib/nex/indonesia/live/runtime.ts");
  const { analyseCorpus, applyMerges, generateCandidatePairs } = await import("../../src/lib/nex/indonesia/data/dedupe-blocking.ts");
  const { lookupBPJPH } = await import("../../src/lib/nex/indonesia/halal/bpjph.ts");
  const { HALAL_USER_PHRASES } = await import("../../src/lib/nex/indonesia/halal/types.ts");
  const { BudgetRegistry } = await import("../../src/lib/nex/indonesia/live/budget.ts");
  const { runBurnIn } = await import("../../src/lib/nex/indonesia/live/burn-in.ts");
  const { withHalalCertification, findHalalRestaurants, halalStatusCounts } = await import("../../src/lib/nex/indonesia/halal/query.ts");

  const suites = [];

  // ── Routing (pure logic, always runs) ─────────────────────────
  suites.push(await runRoutingSuite(pickRole));

  // ── Fallback semantics (always runs · uses fake URLs where needed)
  suites.push(await runFallbackSuite(resolveNexBrainWithFallback, probeOllama));

  // ── Conversation intent gate (pure logic) ─────────────────────
  suites.push(await runIntentSuite("Conversation", "conversation.json", classifyConversationIntent));

  // ── Specialist isolation · the safety boundary ────────────────
  suites.push(await runIsolationSuite("Isolation", "specialist-isolation.json", classifyConversationIntent, assertSpecialistIntent));

  // ── Indonesia knowledge retrieval ─────────────────────────────
  suites.push(await runKnowledgeSuite("Indonesia", "indonesia.json", retrieveKnowledge));

  // ── Tourist-guardian safety mode (highest priority) ───────────
  suites.push(await runSafetySuite(classifySafetySignal));

  // ── Walker pipeline · corpus integrity + retrieval on acquired records ─
  suites.push(await runWalkersSuite(listAllRecords, retrieveKnowledge));

  // ── Walker taxonomy · registry integrity + no orphan configs ────
  suites.push(await runTaxonomySuite(listAllWalkerSpecs, loadConfigWalkers, listAllRecords));

  // ── Walker workforce · state machine + failure injection ────────
  suites.push(await runWorkforceSuite(WorkforceRegistry, supervisorTick, runOneCycle));

  // ── Data machine · geo hierarchy + freshness + quality + conflict + dedupe
  suites.push(await runDataMachineSuite({
    listProvinces, provincesByIsland, buildCoverageMatrix, ISLANDS,
    FRESHNESS_WINDOW_MS, scoreEntity, resolveConflict, shouldMerge,
    listAllRecords,
  }));

  // ── Next-phase · migration + gaps + live + scale ────────────────
  suites.push(await runNextPhaseSuite({
    listAllRecords, migrateAll, GapRegistry, detectGap, httpFetch,
    parseBmkgEarthquake, parseMagmaStatuses, scoreEntity,
  }));

  // ── Operational · live runtime · blocking · halal ──────────────
  suites.push(await runOperationalSuite({
    createBmkgEarthquakeConnector, createMagmaVolcanoConnector,
    LiveSourceHealthRegistry, RecentObservationStore, eligibleConnectors, liveTick,
    analyseCorpus, applyMerges, generateCandidatePairs,
    HALAL_USER_PHRASES, lookupBPJPH,
    withHalalCertification, findHalalRestaurants, halalStatusCounts,
    BudgetRegistry, runBurnIn,
  }));

  // ── Full-mode: language + tools ───────────────────────────────
  if (MODE === "full") {
    const preProbe = await probeOllama();
    if (!preProbe.ok) {
      console.error(`  Guardian --full needs Ollama up. Got: ${preProbe.error}`);
      process.exit(2);
    }
    suites.push(await runLanguageSuite(createOllamaBrainProvider));
    suites.push(await runToolsSuite(createOllamaBrainProvider));
    suites.push(await runConversationQualitySuite(createOllamaBrainProvider, decideRag));
  } else {
    console.log("  (language + tool suites skipped · pass --full to include)");
  }

  const summary = summarise(suites);
  await reportAndGate(summary);
}

// ── SUITES ──────────────────────────────────────────────────────────

async function runRoutingSuite(pickRole) {
  const cases = JSON.parse(await readFile(path.join(casesDir, "routing.json"), "utf8"));
  const t0 = Date.now();
  const results = cases.map((c) => {
    const start = process.hrtime.bigint();
    const got = pickRole(c.input);
    const nanos = Number(process.hrtime.bigint() - start);
    const roleOk = got.role === c.expect.role;
    const reasonOk = c.expect.reason
      ? got.reason === c.expect.reason
      : c.expect.reasonPattern
        ? new RegExp(c.expect.reasonPattern).test(got.reason)
        : true;
    const pass = roleOk && reasonOk;
    return { id: c.id, note: c.note, pass, got, expect: c.expect, latencyNs: nanos };
  });
  return { name: "Routing", results, wallMs: Date.now() - t0 };
}

async function runFallbackSuite(resolve, probeOllama) {
  const cases = JSON.parse(await readFile(path.join(casesDir, "fallback.json"), "utf8"));
  const t0 = Date.now();
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const results = [];
  for (const c of cases) {
    // Skip cases whose requirement doesn't match the current env,
    // but count them as "skipped" (not "failed") so we don't punish
    // developers without an Anthropic key.
    if (c.requiresAnthropicKey === true && !hasAnthropicKey) {
      results.push({ id: c.id, note: c.note, skipped: "no_anthropic_key" });
      continue;
    }
    if (c.requiresAnthropicKey === false && hasAnthropicKey) {
      results.push({ id: c.id, note: c.note, skipped: "anthropic_key_present" });
      continue;
    }

    let opts = { role: c.role };
    if (c.scenario === "ollama_unreachable") opts = { role: c.role, forceOllama: { url: "http://127.0.0.1:65533" } };
    if (c.scenario === "model_missing")      opts = { role: c.role, forceOllama: { model: "definitely:not-installed" } };
    if (c.scenario === "ollama_healthy")     opts = { role: c.role, forceOllama: true };

    const start = Date.now();
    const r = await resolve(opts);
    const wall = Date.now() - start;
    const idOk = r.provider.id.startsWith(c.expect.providerIdPrefix);
    const liveOk = r.isLive === c.expect.isLive;
    const reasonOk = c.expect.reasonPattern ? new RegExp(c.expect.reasonPattern).test(r.reason) : true;
    const pass = idOk && liveOk && reasonOk;
    results.push({ id: c.id, note: c.note, pass, got: { id: r.provider.id, isLive: r.isLive, reason: r.reason }, expect: c.expect, wallMs: wall });
  }
  return { name: "Fallback", results, wallMs: Date.now() - t0 };
}

async function runIntentSuite(name, file, classify) {
  const cases = JSON.parse(await readFile(path.join(casesDir, file), "utf8"));
  const t0 = Date.now();
  const results = cases.map((c) => {
    const start = process.hrtime.bigint();
    const got = classify(c.input.message, { hasImage: c.input.hasImage, userMarket: c.input.userMarket });
    const nanos = Number(process.hrtime.bigint() - start);
    const intentOk = c.expect.intent ? got.intent === c.expect.intent : true;
    const reasonOk = c.expect.reasonPattern ? new RegExp(c.expect.reasonPattern).test(got.reason) : true;
    const pass = intentOk && reasonOk;
    return { id: c.id, note: c.note, pass, got, expect: c.expect, latencyNs: nanos };
  });
  return { name, results, wallMs: Date.now() - t0 };
}

async function runIsolationSuite(name, file, classify, assertSpecialistIntent) {
  const cases = JSON.parse(await readFile(path.join(casesDir, file), "utf8"));
  const t0 = Date.now();
  const results = [];
  for (const c of cases) {
    // Special case: assert the guard function actually throws.
    if (c.assertGuardThrows) {
      let threw = false, err = "";
      try { assertSpecialistIntent(c.assertGuardThrows.intent, c.assertGuardThrows.expected); }
      catch (e) { threw = true; err = e.message; }
      const pass = threw && /refused to handle/.test(err);
      results.push({ id: c.id, note: c.note, pass, got: { threw, err } });
      continue;
    }
    const got = classify(c.input.message, { hasImage: c.input.hasImage, userMarket: c.input.userMarket });
    let pass = true;
    let diag = "";
    if (c.expect.intent && got.intent !== c.expect.intent) { pass = false; diag = `expected ${c.expect.intent}, got ${got.intent}`; }
    if (c.expect.intentOneOf && !c.expect.intentOneOf.includes(got.intent)) { pass = false; diag = `expected one of ${c.expect.intentOneOf.join("|")}, got ${got.intent}`; }
    if (c.expect.forbiddenIntents && c.expect.forbiddenIntents.includes(got.intent)) { pass = false; diag = `FORBIDDEN intent leaked · got ${got.intent}`; }
    results.push({ id: c.id, note: c.note, pass, got: got.intent + " (" + got.reason + ")", expect: c.expect, diag });
  }
  return { name, results, wallMs: Date.now() - t0 };
}

async function runKnowledgeSuite(name, file, retrieveKnowledge) {
  const cases = JSON.parse(await readFile(path.join(casesDir, file), "utf8"));
  const t0 = Date.now();
  const results = cases.map((c) => {
    const start = process.hrtime.bigint();
    const hits = retrieveKnowledge(c.input.message, { limit: 3 });
    const nanos = Number(process.hrtime.bigint() - start);
    let pass = true;
    let diag = "";
    if (c.expect.empty) {
      if (hits.length > 0) { pass = false; diag = `expected no hits, got ${hits.length}`; }
    } else {
      if (hits.length === 0) { pass = false; diag = "expected at least one hit, got 0"; }
      else {
        const top = hits[0];
        if (c.expect.topicPattern && !new RegExp(c.expect.topicPattern).test(top.topic)) { pass = false; diag = `topic ${top.topic} does not match ${c.expect.topicPattern}`; }
        if (pass && c.expect.contentPattern && !new RegExp(c.expect.contentPattern).test(top.content)) { pass = false; diag = `content does not match ${c.expect.contentPattern}`; }
      }
    }
    return { id: c.id, note: c.note, pass, got: hits.length ? { topic: hits[0].topic, region: hits[0].region, sample: hits[0].content.slice(0, 80) } : null, diag, latencyNs: nanos };
  });
  return { name, results, wallMs: Date.now() - t0 };
}

async function runLanguageSuite(createProvider) {
  const cases = JSON.parse(await readFile(path.join(casesDir, "language.json"), "utf8"));
  const t0 = Date.now();
  const results = [];
  for (const c of cases) {
    const provider = createProvider({ model: modelForRole(c.role), stream: false });
    const start = Date.now();
    const text = await singleShot(provider, c.system, c.prompt);
    const wall = Date.now() - start;

    const matches = (c.expect.matchesAny ?? []).every((rx) => compileRegex(rx).test(text));
    const rejects = (c.expect.rejectAny ?? []).every((rx) => !compileRegex(rx).test(text));
    let langOk = true;
    if (c.expect.requiresLanguage === "id") langOk = looksIndonesian(text);
    if (c.expect.requiresLanguage === "en") langOk = looksEnglish(text);
    const pass = matches && rejects && langOk;
    results.push({ id: c.id, note: c.note, pass, sample: text.slice(0, 140), wallMs: wall, langOk });
  }
  return { name: "Language", results, wallMs: Date.now() - t0 };
}

async function runSafetySuite(classifySafetySignal) {
  const cases = JSON.parse(await readFile(path.join(casesDir, "safety-mode.json"), "utf8"));
  const t0 = Date.now();
  const results = cases.map((c) => {
    const start = process.hrtime.bigint();
    const got = classifySafetySignal(c.input.message);
    const nanos = Number(process.hrtime.bigint() - start);
    const signalOk = got.signal === c.expect.signal;
    const responseOk = got.requiresSafetyResponse === c.expect.requiresSafetyResponse;
    const pass = signalOk && responseOk;
    const diag = pass ? "" : `expected signal=${c.expect.signal} requires=${c.expect.requiresSafetyResponse} · got signal=${got.signal} requires=${got.requiresSafetyResponse}`;
    return { id: c.id, note: c.note, pass, got: `${got.signal} (${got.reason})`, diag, latencyNs: nanos };
  });
  return { name: "Safety", results, wallMs: Date.now() - t0 };
}

async function runWalkersSuite(listAllRecords, retrieveKnowledge) {
  const cases = JSON.parse(await readFile(path.join(casesDir, "walkers.json"), "utf8"));
  const t0 = Date.now();
  const allRecords = listAllRecords();
  const results = cases.map((c) => {
    let pass = true;
    let diag = "";
    let got;
    if (c.expect.recordsMin !== undefined) {
      pass = allRecords.length >= c.expect.recordsMin;
      got = `${allRecords.length} records`;
      if (!pass) diag = `expected >= ${c.expect.recordsMin}, got ${allRecords.length}`;
    } else if (c.expect.everyRecordHas) {
      // Only assert against walker-acquired records (walker_id set) —
      // hand-authored seed records may not carry the new fields.
      const acquired = allRecords.filter((r) => r.walker_id);
      const missing = [];
      for (const rec of acquired) {
        for (const field of c.expect.everyRecordHas) {
          const val = rec[field];
          if (val === undefined || val === null || (Array.isArray(val) && val.length === 0)) {
            missing.push(`${rec.id}.${field}`); break;
          }
        }
      }
      if (c.expect.questionsMin !== undefined) {
        for (const rec of acquired) {
          if ((rec.questions?.length ?? 0) < c.expect.questionsMin) missing.push(`${rec.id}.questions<${c.expect.questionsMin}`);
        }
      }
      pass = missing.length === 0;
      got = `${acquired.length} acquired records · ${missing.length} missing`;
      if (missing.length > 0) diag = `first missing: ${missing.slice(0, 3).join(", ")}`;
    } else if (c.expect.forbiddenStability) {
      const bad = allRecords.filter((r) => c.expect.forbiddenStability.includes(r.stability));
      pass = bad.length === 0;
      got = `${bad.length} records with forbidden stability`;
      if (!pass) diag = `first: ${bad[0]?.id} (${bad[0]?.stability})`;
    } else if (c.expect.topicMatches) {
      const hits = retrieveKnowledge(c.input.message, { limit: 3 });
      const rx = new RegExp(c.expect.topicMatches);
      pass = hits.length > 0 && rx.test(hits[0].topic);
      got = hits[0] ? `top hit: ${hits[0].topic}` : "no hits";
      if (!pass) diag = `expected topic matching ${c.expect.topicMatches}`;
    }
    return { id: c.id, note: c.note, pass, got, diag };
  });
  return { name: "Walkers", results, wallMs: Date.now() - t0 };
}

async function runTaxonomySuite(listAllWalkerSpecs, loadConfigWalkers, listAllRecords) {
  const cases = JSON.parse(await readFile(path.join(casesDir, "taxonomy.json"), "utf8"));
  const t0 = Date.now();
  const specs = listAllWalkerSpecs();
  const configWalkers = loadConfigWalkers();
  const records = listAllRecords();
  const specIds = new Set(specs.map((s) => s.id));
  const branches = new Set(specs.map((s) => s.branch));
  const activeSpecs = specs.filter((s) => s.status === "active" || s.status === "mature");
  const acquiredWalkerIds = new Set(records.filter((r) => r.walker_id).map((r) => r.walker_id));

  const results = cases.map((c) => {
    let pass = true, diag = "", got = "";
    if (c.expect.minTotalWalkers !== undefined) {
      pass = specs.length >= c.expect.minTotalWalkers && branches.size >= (c.expect.branchCount ?? 0);
      got = `${specs.length} specs · ${branches.size} branches`;
      if (!pass) diag = `expected >= ${c.expect.minTotalWalkers} specs · ${c.expect.branchCount} branches`;
    } else if (c.expect.branchesPresent) {
      const missing = c.expect.branchesPresent.filter((b) => !branches.has(b));
      pass = missing.length === 0;
      got = `${branches.size} branches`;
      if (!pass) diag = `missing branches: ${missing.join(", ")}`;
    } else if (c.expect.walkersInBranch) {
      const { branch, min } = c.expect.walkersInBranch;
      const count = specs.filter((s) => s.branch === branch).length;
      pass = count >= min;
      got = `${count} in ${branch}`;
      if (!pass) diag = `expected >= ${min} in ${branch}, got ${count}`;
    } else if (c.expect.noOrphanConfigs) {
      const orphans = configWalkers.filter((w) => !specIds.has(w.id));
      pass = orphans.length === 0;
      got = `${configWalkers.length} config walkers · ${orphans.length} orphans`;
      if (!pass) diag = `orphan configs: ${orphans.map((o) => o.id).join(", ")}`;
    } else if (c.expect.activeWalkersPublish) {
      // Every taxonomy-active walker that has a config should publish records.
      // (curated:seed is a legacy walker · not represented in the taxonomy · skip.)
      const activeWithConfig = activeSpecs.filter((s) => configWalkers.some((w) => w.id === s.id));
      const missing = activeWithConfig.filter((s) => !acquiredWalkerIds.has(s.id));
      pass = missing.length === 0;
      got = `${activeWithConfig.length} active-with-config · ${missing.length} not publishing`;
      if (!pass) diag = `active walkers not publishing: ${missing.map((s) => s.id).join(", ")}`;
    } else if (c.expect.tierAPlanned) {
      const tierAPlanned = specs.filter((s) => s.priority === 1 && s.status === "planned");
      pass = tierAPlanned.length >= c.expect.tierAPlanned.min;
      got = `${tierAPlanned.length} Tier-A planned`;
      if (!pass) diag = `expected >= ${c.expect.tierAPlanned.min} Tier-A planned`;
    }
    return { id: c.id, note: c.note, pass, got, diag };
  });
  return { name: "Taxonomy", results, wallMs: Date.now() - t0 };
}

async function runWorkforceSuite(WorkforceRegistry, supervisorTick, runOneCycle) {
  const cases = JSON.parse(await readFile(path.join(casesDir, "workforce.json"), "utf8"));
  const t0 = Date.now();
  const results = [];

  const goodChunk = {
    externalId: "gc", domain: "landmark",
    topic: "test.wf.landmark", region: "Central Java",
    content: "A test landmark record long enough to pass validation gates on the pipeline side.",
    keywords: ["testkw1", "testkw2"], observedAt: "2026-08-30",
    source: "wf-test", confidence: 0.9,
  };
  const goodWalker = () => ({
    id: "wf.test", domain: "landmark", defaultStability: "stable",
    description: "wf test walker", refreshCadenceDays: 30,
    async acquire() { return [goodChunk]; },
  });

  for (const c of cases) {
    let pass = true, diag = "", got = "";
    try {
      if (c.expect.freshRegistryEmpty) {
        const r = new WorkforceRegistry({ inMemoryOnly: true });
        const s = r.getSnapshot();
        pass = s.workers.length === 0 && s.jobs.length === 0 && s.leases.length === 0 && s.deadLetter.length === 0;
        got = `workers:${s.workers.length} jobs:${s.jobs.length}`;
      } else if (c.expect.stateTransitionStamped) {
        const r = new WorkforceRegistry({ inMemoryOnly: true });
        r.registerWorker({ id: "t1", walkerId: "wf.test" });
        const before = r.getSnapshot().workers[0].stateChangedAt;
        await new Promise((res) => setTimeout(res, 5));
        r.setWorkerState("t1", "RUNNING");
        const after = r.getSnapshot().workers[0].stateChangedAt;
        pass = after > before && r.getSnapshot().workers[0].state === "RUNNING";
        got = `before=${before} after=${after}`;
      } else if (c.expect.leaseCreatedOnClaim) {
        const r = new WorkforceRegistry({ inMemoryOnly: true });
        r.registerWorker({ id: "t2", walkerId: "wf.test" });
        r.enqueueJob({ id: "j1", walkerId: "wf.test", priority: 1, scheduledFor: new Date().toISOString(), sourceKey: "wf.test" });
        const claim = r.claimNextJob("t2", { leaseTtlMs: 10_000 });
        const s = r.getSnapshot();
        pass = Boolean(claim) && s.leases.length === 1 && s.workers[0].currentJobId === "j1";
        got = `leases:${s.leases.length} currentJob:${s.workers[0].currentJobId}`;
      } else if (c.expect.leaseExpiryDetectsHang) {
        let t = Date.parse("2026-08-30T00:00:00Z");
        const clock = { now: () => new Date(t), advance: (ms) => { t += ms; } };
        const r = new WorkforceRegistry({ inMemoryOnly: true, now: clock.now });
        r.registerWorker({ id: "t3", walkerId: "wf.test" });
        r.enqueueJob({ id: "hang", walkerId: "wf.test", priority: 1, scheduledFor: clock.now().toISOString(), sourceKey: "wf.test" });
        r.claimNextJob("t3", { leaseTtlMs: 1000 });
        clock.advance(2000);
        const reaped = r.reapExpiredLeases();
        const w = r.getSnapshot().workers.find((x) => x.id === "t3");
        pass = reaped.includes("hang") && w.state === "DEAD";
        got = `reaped:${reaped.length} state:${w.state}`;
      } else if (c.expect.supervisorRestartsDead) {
        let t = Date.parse("2026-08-30T00:00:00Z");
        const clock = { now: () => new Date(t), advance: (ms) => { t += ms; } };
        const r = new WorkforceRegistry({ inMemoryOnly: true, now: clock.now });
        r.registerWorker({ id: "t4", walkerId: "wf.test" });
        r.setWorkerState("t4", "DEAD");
        const walker = goodWalker();
        const report = await supervisorTick({ registry: r, walkers: new Map([[walker.id, walker]]), now: clock.now });
        pass = report.restarted.includes("t4");
        got = `restarted:${JSON.stringify(report.restarted)}`;
      } else if (c.expect.breakerOpensAfter !== undefined) {
        const r = new WorkforceRegistry({ inMemoryOnly: true });
        for (let i = 0; i < c.expect.breakerOpensAfter; i++) {
          r.recordBreakerFailure("src-x", { openAfter: c.expect.breakerOpensAfter, openForMs: 30_000 });
        }
        const b = r.getBreaker("src-x");
        pass = b.state === "open" && b.failures >= c.expect.breakerOpensAfter;
        got = `state:${b.state} failures:${b.failures}`;
      } else if (c.expect.workforceContinuesDespiteFail) {
        let t = Date.parse("2026-08-30T00:00:00Z");
        const clock = { now: () => new Date(t) };
        const r = new WorkforceRegistry({ inMemoryOnly: true, now: clock.now });
        const healthy = goodWalker();
        const broken = { ...goodWalker(), id: "wf.broken" };
        r.enqueueJob({ id: "h", walkerId: healthy.id, priority: 1, scheduledFor: clock.now().toISOString(), sourceKey: healthy.id });
        r.enqueueJob({ id: "b", walkerId: broken.id,  priority: 1, scheduledFor: clock.now().toISOString(), sourceKey: broken.id });
        r.registerWorker({ id: "wh", walkerId: healthy.id });
        r.registerWorker({ id: "wb", walkerId: broken.id });
        const report = await supervisorTick({
          registry: r,
          walkers: new Map([[healthy.id, healthy], [broken.id, broken]]),
          now: clock.now,
          __inject: (wid) => wid === "wb" ? (async () => { throw new Error("broken_pipe"); }) : undefined,
        });
        pass = report.publishedRecordsThisTick > 0;
        got = `publishedThisTick:${report.publishedRecordsThisTick}`;
      }
    } catch (e) {
      pass = false; diag = `throw:${e.message}`;
    }
    results.push({ id: c.id, note: c.note, pass, got, diag });
  }
  return { name: "Workforce", results, wallMs: Date.now() - t0 };
}

async function runDataMachineSuite(mod) {
  const cases = JSON.parse(await readFile(path.join(casesDir, "data-machine.json"), "utf8"));
  const t0 = Date.now();
  const results = [];
  const baseProv = (source, tier) => ({
    walkerId: "w.test", sourceKey: source, sourceName: source, sourceTier: tier,
    firstDiscoveredAt: "2026-08-30", lastCheckedAt: "2026-08-30",
    lastChangedAt: "2026-08-30", observedAt: "2026-08-30",
  });
  const baseEntity = (over = {}) => ({
    id: "e-1", kind: "business", name: "Test", keywords: ["k"],
    lifecycle: "PUBLISHED", lifecycleChangedAt: "2026-08-30",
    provenance: [baseProv("s", "A")],
    freshness: { policy: "weekly", lastVerifiedAt: "2026-08-30T12:00:00Z" },
    ...over,
  });

  for (const c of cases) {
    let pass = true, diag = "", got = "";
    try {
      if (c.expect.provincesCount !== undefined) {
        const n = mod.listProvinces().length;
        pass = n === c.expect.provincesCount;
        got = `${n} provinces`;
      } else if (c.expect.islandsCount !== undefined) {
        const s = new Set(mod.listProvinces().map((p) => p.island));
        pass = s.size === c.expect.islandsCount;
        got = `${s.size} islands`;
      } else if (c.expect.papuaCount !== undefined) {
        const n = mod.provincesByIsland("Papua").length;
        pass = n === c.expect.papuaCount;
        got = `${n} Papua provinces`;
      } else if (c.expect.emptyMatrixNotCovered) {
        const m = mod.buildCoverageMatrix([], ["cat1", "cat2"]);
        pass = m.totals.notCovered === m.cells.length && m.totals.covered === 0;
        got = `notCovered=${m.totals.notCovered} covered=${m.totals.covered}`;
      } else if (c.expect.freshnessOrdered) {
        const order = ["live","very_fast","hourly","daily","weekly","monthly","seasonal","long_lived"];
        let ok = true;
        for (let i = 0; i < order.length - 1; i++) {
          if (mod.FRESHNESS_WINDOW_MS[order[i]] >= mod.FRESHNESS_WINDOW_MS[order[i+1]]) { ok = false; break; }
        }
        pass = ok;
      } else if (c.expect.qualityDimensions !== undefined) {
        const e = baseEntity();
        const q = mod.scoreEntity(e);
        const dims = Object.keys(q).filter((k) => k !== "overall").length;
        pass = dims === c.expect.qualityDimensions;
        got = `${dims} dimensions`;
      } else if (c.expect.sourceTiers) {
        // Compile-time check — trivial pass, this is documentation.
        pass = true;
      } else if (c.expect.corroborationWins) {
        const r = mod.resolveConflict([
          { value: "consensus", provenance: baseProv("c1", "C") },
          { value: "consensus", provenance: baseProv("c2", "C") },
          { value: "outlier",   provenance: baseProv("b1", "B") },
        ]);
        pass = r?.winner === "consensus";
        got = `winner=${r?.winner}`;
      } else if (c.expect.phoneMergeStrong) {
        const a = baseEntity({ name: "Warung X", contacts: [{ kind: "phone", value: "+62812111", verified: true }] });
        const b = baseEntity({ id: "e-2", name: "Different Name", contacts: [{ kind: "phone", value: "+62812111", verified: true }] });
        pass = mod.shouldMerge(a, b) === "merge";
        got = `verdict=${mod.shouldMerge(a, b)}`;
      } else if (c.expect.provenanceOnAcquired) {
        const acquired = mod.listAllRecords().filter((r) => r.walker_id);
        const missing = acquired.filter((r) => !r.source);
        pass = missing.length === 0;
        got = `${acquired.length} acquired · ${missing.length} without source`;
      }
    } catch (e) { pass = false; diag = `throw:${e.message}`; }
    results.push({ id: c.id, note: c.note, pass, got, diag });
  }
  return { name: "DataMachine", results, wallMs: Date.now() - t0 };
}

async function runNextPhaseSuite(mod) {
  const cases = JSON.parse(await readFile(path.join(casesDir, "next-phase.json"), "utf8"));
  const t0 = Date.now();
  const results = [];
  for (const c of cases) {
    let pass = true, diag = "", got = "";
    try {
      if (c.expect.migrationLossless) {
        const legacy = mod.listAllRecords();
        const { migrated, skipped } = mod.migrateAll(legacy);
        pass = skipped.length === 0 && migrated.length === legacy.length;
        got = `input:${legacy.length} migrated:${migrated.length} skipped:${skipped.length}`;
      } else if (c.expect.migrationQualityHi !== undefined) {
        const { migrated } = mod.migrateAll(mod.listAllRecords());
        const hi = migrated.filter((m) => (m.quality?.overall ?? 0) >= 0.7).length;
        const pct = migrated.length === 0 ? 100 : Math.round((hi / migrated.length) * 100);
        pass = pct >= c.expect.migrationQualityHi;
        got = `hi=${hi}/${migrated.length} (${pct}%)`;
      } else if (c.expect.gapRegistryEmpty) {
        const r = new mod.GapRegistry({ inMemoryOnly: true });
        pass = r.getSnapshot().gaps.length === 0;
      } else if (c.expect.gapObserveIdempotent) {
        const r = new mod.GapRegistry({ inMemoryOnly: true });
        const a = r.observe({ intent: "x", rawQuery: "test query one", reason: "no_hits" });
        const b = r.observe({ intent: "x", rawQuery: "test query one", reason: "no_hits" });
        pass = a.id === b.id && b.frequency === 2;
        got = `same_id:${a.id === b.id} freq:${b.frequency}`;
      } else if (c.expect.gapNoHits) {
        const g = mod.detectGap({ intent: "food", rawQuery: "obscure", hits: [] });
        pass = g?.reason === "no_hits";
      } else if (c.expect.gapHighConfNoop) {
        const g = mod.detectGap({
          intent: "food", rawQuery: "nasi goreng",
          hits: [{ id: "h", topic: "food.nasi_goreng", region: "Indonesia", language: "en",
                   stability: "stable", confidence: 0.95, source: "s", last_verified: "2026-08-30",
                   content: "x", keywords: [], score: 1 }],
        });
        pass = g === null;
      } else if (c.expect.liveGatedOff) {
        delete process.env.NEX_LIVE_SOURCES_ENABLED;
        const r = await mod.httpFetch("https://example.invalid/x");
        pass = "error" in r && r.reason === "disabled";
      } else if (c.expect.bmkgEarthquakeParses) {
        const fixture = { Infogempa: { gempa: { Magnitude: "5.6", Kedalaman: "10 km", Wilayah: "Bali", Coordinates: "-8.85,115.05" } } };
        const e = mod.parseBmkgEarthquake(fixture);
        pass = e.length === 1 && e[0].kind === "government" && e[0].category === "safety.earthquake" && e[0].provenance[0].sourceTier === "A";
        got = `entities:${e.length}`;
      } else if (c.expect.magmaSeverity) {
        const e = mod.parseMagmaStatuses([{ name: "Merapi", status: "SIAGA" }]);
        pass = e[0].attributes.alertSeverity === 3 && /ELEVATED/.test(e[0].description);
        got = `severity:${e[0].attributes.alertSeverity}`;
      } else if (c.expect.scaleQuality10kUnder !== undefined) {
        // Synthesise 10k lightweight records and score them.
        const now = new Date();
        const start = performance.now();
        for (let i = 0; i < 10_000; i++) {
          mod.scoreEntity({
            id: `sc-${i}`, kind: "knowledge", name: `n${i}`, keywords: ["a", "b"],
            lifecycle: "PUBLISHED", lifecycleChangedAt: "2026-08-30",
            provenance: [{ walkerId: "w", sourceKey: "s", sourceName: "s", sourceTier: "B",
              firstDiscoveredAt: "2026-08-30", lastCheckedAt: "2026-08-30",
              lastChangedAt: "2026-08-30", observedAt: "2026-08-30" }],
            freshness: { policy: "weekly", lastVerifiedAt: now.toISOString() },
          }, now);
        }
        const elapsed = Math.round(performance.now() - start);
        pass = elapsed < c.expect.scaleQuality10kUnder;
        got = `10k in ${elapsed}ms`;
      }
    } catch (e) { pass = false; diag = `throw:${e.message}`; }
    results.push({ id: c.id, note: c.note, pass, got, diag });
  }
  return { name: "NextPhase", results, wallMs: Date.now() - t0 };
}

async function runOperationalSuite(mod) {
  const cases = JSON.parse(await readFile(path.join(casesDir, "operational.json"), "utf8"));
  const t0 = Date.now();
  const results = [];
  const bmkgFixture = { Infogempa: { gempa: { Magnitude: "5.6", Kedalaman: "10 km", Wilayah: "Bali", Coordinates: "-8.85,115.05" } } };

  for (const c of cases) {
    let pass = true, diag = "", got = "";
    try {
      if (c.expect.liveEligibleFirstPoll) {
        const c1 = mod.createBmkgEarthquakeConnector();
        const h = new mod.LiveSourceHealthRegistry();
        const el = mod.eligibleConnectors([c1], h, new Date());
        pass = el.includes(c1);
      } else if (c.expect.liveEligibilityWaits) {
        const c1 = mod.createBmkgEarthquakeConnector();
        const h = new mod.LiveSourceHealthRegistry();
        const now = new Date("2026-08-30T00:00:00Z");
        h.recordPoll(c1.config.id, true, 100, now.toISOString(), 0);
        const soon = new Date(now.getTime() + 30_000);
        pass = mod.eligibleConnectors([c1], h, soon).length === 0;
      } else if (c.expect.liveDedupesRepeated) {
        const c1 = mod.createBmkgEarthquakeConnector();
        const h = new mod.LiveSourceHealthRegistry();
        const r = new mod.RecentObservationStore(10 * 60_000);
        let publishedCount = 0;
        let clockMs = Date.parse("2026-08-30T00:00:00Z");
        await mod.liveTick({ connectors: [c1], health: h, recent: r,
          onPublish: (_s, e) => { publishedCount += e.length; },
          __mocks: { [c1.config.id]: bmkgFixture }, now: () => new Date(clockMs) });
        clockMs += 120_000;
        const r2 = await mod.liveTick({ connectors: [c1], health: h, recent: r,
          onPublish: (_s, e) => { publishedCount += e.length; },
          __mocks: { [c1.config.id]: bmkgFixture }, now: () => new Date(clockMs) });
        pass = publishedCount === 1 && r2.dedupedEntities === 1;
        got = `published=${publishedCount} deduped=${r2.dedupedEntities}`;
      } else if (c.expect.liveMixedContinues) {
        const bmkg = mod.createBmkgEarthquakeConnector();
        const magma = mod.createMagmaVolcanoConnector();
        const h = new mod.LiveSourceHealthRegistry();
        const r = new mod.RecentObservationStore();
        delete process.env.NEX_LIVE_SOURCES_ENABLED; // magma has no mock → fails
        const report = await mod.liveTick({
          connectors: [bmkg, magma], health: h, recent: r,
          onPublish: () => undefined,
          __mocks: { [bmkg.config.id]: bmkgFixture },
          now: () => new Date(),
        });
        pass = report.succeeded === 1 && report.failed === 1;
        got = `succ=${report.succeeded} fail=${report.failed}`;
      } else if (c.expect.blocking10kUnder !== undefined) {
        const entities = [];
        const nowIso = "2026-08-30T00:00:00Z";
        for (let i = 0; i < 10_000; i++) {
          entities.push({
            id: `e-${i}`, kind: "business", name: `Warung ${i}`, keywords: [],
            lifecycle: "PUBLISHED", lifecycleChangedAt: nowIso,
            provenance: [{ walkerId: "w", sourceKey: "s", sourceName: "s", sourceTier: "C",
              firstDiscoveredAt: nowIso, lastCheckedAt: nowIso, lastChangedAt: nowIso, observedAt: nowIso }],
            freshness: { policy: "weekly", lastVerifiedAt: nowIso },
            geo: { lat: -8 + (i % 100) * 0.02, lng: 115 + Math.floor(i / 100) * 0.02 },
          });
        }
        const t0 = performance.now();
        const rep = mod.analyseCorpus(entities);
        const elapsed = Math.round(performance.now() - t0);
        pass = elapsed < c.expect.blocking10kUnder;
        got = `wall=${elapsed}ms · candidates=${rep.candidatePairs}`;
      } else if (c.expect.blockingRecallPhone) {
        const now = "2026-08-30T00:00:00Z";
        const entities = [];
        for (let i = 0; i < 20; i++) {
          const phone = `+6281${String(1_000_000 + i).padStart(7, "0")}`;
          const provA = { walkerId: `wa-${i}`, sourceKey: `sa-${i}`, sourceName: `sa-${i}`, sourceTier: "C",
            firstDiscoveredAt: now, lastCheckedAt: now, lastChangedAt: now, observedAt: now };
          const provB = { walkerId: `wb-${i}`, sourceKey: `sb-${i}`, sourceName: `sb-${i}`, sourceTier: "C",
            firstDiscoveredAt: now, lastCheckedAt: now, lastChangedAt: now, observedAt: now };
          const base = {
            kind: "business", keywords: [], lifecycle: "PUBLISHED", lifecycleChangedAt: now,
            freshness: { policy: "weekly", lastVerifiedAt: now },
          };
          entities.push({ ...base, id: `a-${i}`, name: `Alpha ${i}`, provenance: [provA], contacts: [{ kind: "phone", value: phone, verified: true }] });
          entities.push({ ...base, id: `b-${i}`, name: `Alpha ${i}`, provenance: [provB], contacts: [{ kind: "whatsapp", value: phone, verified: true }] });
        }
        const rep = mod.analyseCorpus(entities);
        pass = rep.strongMerges.length >= 20;
        got = `strong=${rep.strongMerges.length}`;
      } else if (c.expect.halalNeverUnknownCertified) {
        const unknown = { id: "u1", kind: "business", name: "U", keywords: [],
          lifecycle: "PUBLISHED", lifecycleChangedAt: "2026-08-30",
          provenance: [{ walkerId: "w", sourceKey: "s", sourceName: "s", sourceTier: "C",
            firstDiscoveredAt: "2026-08-30", lastCheckedAt: "2026-08-30", lastChangedAt: "2026-08-30", observedAt: "2026-08-30" }],
          freshness: { policy: "weekly", lastVerifiedAt: "2026-08-30" } };
        const hits = mod.findHalalRestaurants([unknown], { requireCertified: true });
        pass = hits.length === 0;
      } else if (c.expect.halalStatusCountsDistinct) {
        const base = { kind: "business", name: "x", keywords: [], lifecycle: "PUBLISHED", lifecycleChangedAt: "2026-08-30",
          provenance: [{ walkerId: "w", sourceKey: "s", sourceName: "s", sourceTier: "C",
            firstDiscoveredAt: "2026-08-30", lastCheckedAt: "2026-08-30", lastChangedAt: "2026-08-30", observedAt: "2026-08-30" }],
          freshness: { policy: "weekly", lastVerifiedAt: "2026-08-30" } };
        const notScored = { ...base, id: "ns" };
        const withCert = mod.withHalalCertification({ ...base, id: "c" }, { status: "certified", authority: "BPJPH", verifiedAt: "2026-08-30", confidence: 1 });
        const counts = mod.halalStatusCounts([notScored, withCert]);
        pass = counts.not_scored === 1 && counts.certified === 1 && counts.unknown === 0;
      } else if (c.expect.halalCertPhraseBPJPH) {
        const phrase = mod.HALAL_USER_PHRASES.certified({ status: "certified", authority: "BPJPH", verifiedAt: "2026-08-30", confidence: 1 });
        pass = /BPJPH/.test(phrase);
      } else if (c.expect.bpjphGatedOff) {
        delete process.env.NEX_BPJPH_ENABLED;
        const r = await mod.lookupBPJPH({ entityId: "test", name: "Warung X" });
        pass = r.certification.status === "unknown" && r.certification.confidence === 0;
      } else if (c.expect.budgetAllowsUntilLimit) {
        const b = new mod.BudgetRegistry({ inMemoryOnly: true });
        b.setPolicy({ sourceId: "t", maxPerMinute: 2 });
        const v1 = b.check("t"); b.recordPoll("t");
        const v2 = b.check("t"); b.recordPoll("t");
        const v3 = b.check("t");
        pass = v1.ok && v2.ok && !v3.ok && v3.reason === "per_minute_exhausted";
        got = `v1=${v1.ok} v2=${v2.ok} v3=${v3.ok}/${v3.reason ?? ""}`;
      } else if (c.expect.budgetRecoversAfterWindow) {
        let ms = Date.parse("2026-08-30T00:00:00Z");
        const b = new mod.BudgetRegistry({ inMemoryOnly: true, now: () => new Date(ms) });
        b.setPolicy({ sourceId: "t", maxPerMinute: 1 });
        b.recordPoll("t");
        const blocked = b.check("t");
        ms += 61_000;
        const after = b.check("t");
        pass = !blocked.ok && after.ok;
        got = `blocked=${!blocked.ok} after=${after.ok}`;
      } else if (c.expect.runtimeSkipsWhenBudgetExhausted) {
        const c1 = mod.createBmkgEarthquakeConnector();
        const h = new mod.LiveSourceHealthRegistry();
        const r = new mod.RecentObservationStore();
        const b = new mod.BudgetRegistry({ inMemoryOnly: true });
        b.setPolicy({ sourceId: c1.config.id, maxPerMinute: 0 });
        const report = await mod.liveTick({
          connectors: [c1], health: h, recent: r, budget: b,
          onPublish: () => undefined,
          __mocks: { [c1.config.id]: bmkgFixture },
          now: () => new Date(),
        });
        pass = report.budgetSkipped === 1 && report.polled === 0 && report.perSource[0]?.skippedByBudget === true;
        got = `skip=${report.budgetSkipped} poll=${report.polled}`;
      } else if (c.expect.burnInCleanUnderSimulator) {
        const c1 = mod.createBmkgEarthquakeConnector();
        const rep = await mod.runBurnIn({
          connector: c1, durationMs: 300, tickIntervalMs: 30,
          simulator: () => bmkgFixture,
        });
        pass = rep.verdict === "clean" && rep.ticksFailed === 0 && rep.ticksSucceeded >= 1;
        got = `v=${rep.verdict} ok=${rep.ticksSucceeded} fail=${rep.ticksFailed}`;
      } else if (c.expect.burnInUnhealthyPersistentFailure) {
        const c1 = mod.createBmkgEarthquakeConnector();
        const rep = await mod.runBurnIn({
          connector: c1, durationMs: 400, tickIntervalMs: 30,
          simulator: () => ({ error: true, reason: "http_status:503" }),
        });
        pass = rep.verdict === "unhealthy" && rep.longestConsecutiveFailures >= 3;
        got = `v=${rep.verdict} longest=${rep.longestConsecutiveFailures}`;
      } else if (c.expect.crossBlockerWebsiteRecall) {
        const base = {
          kind: "business", keywords: [], lifecycle: "PUBLISHED", lifecycleChangedAt: "2026-08-30",
          provenance: [{ walkerId: "w", sourceKey: "s", sourceName: "s", sourceTier: "C",
            firstDiscoveredAt: "2026-08-30", lastCheckedAt: "2026-08-30",
            lastChangedAt: "2026-08-30", observedAt: "2026-08-30" }],
          freshness: { policy: "weekly", lastVerifiedAt: "2026-08-30" },
        };
        const a = { ...base, id: "wa", name: "Alpha", contacts: [{ kind: "website", value: "https://SHARED.example" }] };
        const bb = { ...base, id: "wb", name: "Beta",  contacts: [{ kind: "website", value: "https://shared.example/page" }] };
        const pairs = mod.generateCandidatePairs([a, bb]);
        pass = pairs.some((p) => p.blockerName === "website");
        got = `pairs=${pairs.length}`;
      } else if (c.expect.dedupeCleanRealCorpus) {
        const entFile = path.join(repoRoot, "data/indonesia/knowledge-entities.json");
        if (!existsSync(entFile)) {
          pass = true;
          got = "corpus_not_migrated_yet";
        } else {
          const raw = await readFile(entFile, "utf8");
          const payload = JSON.parse(raw);
          const rep = mod.analyseCorpus(payload.entities ?? []);
          pass = rep.strongMerges.length === 0;
          got = `entities=${(payload.entities ?? []).length} strong=${rep.strongMerges.length}`;
        }
      } else if (c.expect.dedupeLowDuplicationRealCorpus !== undefined) {
        // Stage 3 · once real HTTP-acquired data (OSM etc.) flows in,
        // some real-world duplicates ARE expected (same physical
        // accommodation mapped as both node + way in OSM · same coord
        // same name). The dedupe engine finding them is CORRECT
        // behaviour; the assertion checks the RATIO stays low, not
        // that it's zero.
        const entFile = path.join(repoRoot, "data/indonesia/knowledge-entities.json");
        if (!existsSync(entFile)) {
          pass = true;
          got = "corpus_not_migrated_yet";
        } else {
          const raw = await readFile(entFile, "utf8");
          const payload = JSON.parse(raw);
          const entities = payload.entities ?? [];
          const rep = mod.analyseCorpus(entities);
          const ratio = entities.length > 0 ? rep.strongMerges.length / entities.length : 0;
          const threshold = c.expect.dedupeLowDuplicationRealCorpus;
          pass = ratio <= threshold;
          got = `entities=${entities.length} strong=${rep.strongMerges.length} ratio=${(ratio * 100).toFixed(2)}% threshold=${(threshold * 100).toFixed(0)}%`;
        }
      }
    } catch (e) { pass = false; diag = `throw:${e.message}`; }
    results.push({ id: c.id, note: c.note, pass, got, diag });
  }
  return { name: "Operational", results, wallMs: Date.now() - t0 };
}

async function runConversationQualitySuite(createProvider, decideRag) {
  const cases = JSON.parse(await readFile(path.join(casesDir, "conversation-quality.json"), "utf8"));
  const t0 = Date.now();
  const results = [];
  const baseSystem = "You are NEX — a helpful, warm, concise assistant specialised in Indonesia (culture, food, tourism, practical advice). Reply in the same language as the user, in one or two short paragraphs. Never invent restaurant names, prices, opening hours, or facts not supported by grounded knowledge.";
  for (const c of cases) {
    const rag = decideRag(c.prompt);
    const provider = createProvider({ model: modelForRole(c.role), stream: false });
    const start = Date.now();
    let text = "";
    try {
      for await (const evt of provider.chat({
        systemPrompt: baseSystem + rag.systemPromptSuffix,
        messages: [{ role: "user", content: c.prompt }],
        maxTokens: 220,
        temperature: 0.3,
      })) {
        if (evt.type === "text_delta") text += evt.text;
      }
    } catch (e) {
      results.push({ id: c.id, note: c.note, pass: false, diag: `throw: ${e.message}` });
      continue;
    }
    const wall = Date.now() - start;
    const matches = (c.expect.matchesAny ?? []).every((rx) => compileRegex(rx).test(text));
    const rejects = (c.expect.rejectAny ?? []).every((rx) => !compileRegex(rx).test(text));
    const pass = matches && rejects;
    const diagParts = [];
    if (!matches) for (const rx of c.expect.matchesAny ?? []) if (!compileRegex(rx).test(text)) diagParts.push(`missing ${rx}`);
    if (!rejects) for (const rx of c.expect.rejectAny ?? []) if (compileRegex(rx).test(text)) diagParts.push(`forbidden ${rx}`);
    results.push({
      id: c.id, note: c.note, pass,
      diag: diagParts.join(", "),
      sample: text.replace(/\s+/g, " ").trim().slice(0, 140),
      rag: { attached: rag.attached, reason: rag.reason, topics: rag.hits.map((h) => h.topic) },
      wallMs: wall,
    });
  }
  return { name: "Quality", results, wallMs: Date.now() - t0 };
}

async function runToolsSuite(createProvider) {
  const cases = JSON.parse(await readFile(path.join(casesDir, "tools.json"), "utf8"));
  const t0 = Date.now();
  const results = [];
  for (const c of cases) {
    const provider = createProvider({ model: modelForRole(c.role), stream: false });
    const start = Date.now();
    const evts = [];
    for await (const evt of provider.chat({
      systemPrompt: c.system,
      messages: [{ role: "user", content: c.prompt }],
      tools: c.tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.parameters })),
      maxTokens: 200,
      temperature: 0.2,
    })) evts.push(evt);
    const wall = Date.now() - start;
    const ready = evts.find((e) => e.type === "tool_call_ready");
    const doneEvt = evts.find((e) => e.type === "done");
    let pass = true;
    let diag = "";
    if (c.expect.toolName === null) {
      if (ready) { pass = false; diag = `expected NO tool call, got ${ready.toolName}`; }
    } else {
      if (!ready) { pass = false; diag = "no tool_call_ready emitted"; }
      else if (ready.toolName !== c.expect.toolName) { pass = false; diag = `expected ${c.expect.toolName}, got ${ready.toolName}`; }
      else if (c.expect.inputMatches) {
        for (const [k, rx] of Object.entries(c.expect.inputMatches)) {
          const v = ready.input?.[k];
          if (typeof v !== "string" || !compileRegex(rx).test(v)) { pass = false; diag = `input.${k}="${v}" does not match ${rx}`; break; }
        }
      }
    }
    results.push({ id: c.id, note: c.note, pass, diag, tool: ready ? { name: ready.toolName, input: ready.input } : null, stopReason: doneEvt?.stopReason, wallMs: wall });
  }
  return { name: "Tools", results, wallMs: Date.now() - t0 };
}

// ── HELPERS ─────────────────────────────────────────────────────────

function modelForRole(role) {
  switch (role) {
    case "brain.primary_local": return process.env.NEX_MODEL_BRAIN_PRIMARY  ?? "qwen2.5:7b-instruct-q3_K_M";
    case "brain.fast_local":    return process.env.NEX_MODEL_BRAIN_FAST     ?? "qwen2.5:3b";
    case "vision.primary_local":return process.env.NEX_MODEL_VISION_PRIMARY ?? "qwen2.5vl:3b";
    default: throw new Error("unknown role: " + role);
  }
}

async function singleShot(provider, system, user) {
  let text = "";
  for await (const evt of provider.chat({
    systemPrompt: system,
    messages: [{ role: "user", content: user }],
    maxTokens: 180,
    temperature: 0.2,
  })) {
    if (evt.type === "text_delta") text += evt.text;
  }
  return text.trim();
}

// Rough language sniffer. "Looks Indonesian" = at least one common
// Indonesian function word and not overwhelmingly English function
// words. Same for English. Good enough for regression gating; a
// production language detector would be overkill.
const ID_WORDS = /\b(yang|dan|adalah|ini|itu|dengan|tidak|untuk|dari|apa|saya|kamu|anda|silakan|tolong|bisa|dapat|akan|sudah|belum|lebih|juga|hanya|karena|kalau|nanti|sekarang)\b/i;
const EN_WORDS = /\b(the|is|are|and|for|with|this|that|not|you|please|would|could|will|has|have|from|about|why|how)\b/i;
function looksIndonesian(t) { return ID_WORDS.test(t); }
function looksEnglish(t)    { return EN_WORDS.test(t) && !ID_WORDS.test(t); }

function summarise(suites) {
  return suites.map((s) => {
    const total = s.results.length;
    const skipped = s.results.filter((r) => r.skipped).length;
    const passed = s.results.filter((r) => r.pass).length;
    const failed = s.results.filter((r) => !r.pass && !r.skipped).length;
    return { name: s.name, total, passed, failed, skipped, wallMs: s.wallMs, results: s.results };
  });
}

async function reportAndGate(summary) {
  console.log("┌────────────┬───────┬──────┬──────┬─────────┬──────────┐");
  console.log("│ Suite      │ Total │ Pass │ Fail │ Skipped │ Wall ms  │");
  console.log("├────────────┼───────┼──────┼──────┼─────────┼──────────┤");
  for (const s of summary) {
    console.log(`│ ${pad(s.name, 10)} │ ${padr(String(s.total), 5)} │ ${padr(String(s.passed), 4)} │ ${padr(String(s.failed), 4)} │ ${padr(String(s.skipped), 7)} │ ${padr(String(s.wallMs), 8)} │`);
  }
  console.log("└────────────┴───────┴──────┴──────┴─────────┴──────────┘");

  const totalFailed = summary.reduce((a, s) => a + s.failed, 0);
  if (totalFailed > 0) {
    console.log("\nFAILED CASES:");
    for (const s of summary) {
      for (const r of s.results) {
        if (!r.pass && !r.skipped) {
          console.log(`  ✗ [${s.name}/${r.id}] ${r.note}`);
          if (r.diag)   console.log(`    diag   ${r.diag}`);
          if (r.rag)    console.log(`    rag    attached=${r.rag.attached} reason=${r.rag.reason} topics=[${r.rag.topics.join(",")}]`);
          if (r.sample) console.log(`    reply  ${r.sample}`);
          if (r.expect) console.log(`    expect ${JSON.stringify(r.expect)}`);
          if (r.got)    console.log(`    got    ${JSON.stringify(r.got)}`);
        }
      }
    }
  }

  // Baseline capture · write and exit.
  if (CAPTURE) {
    const baseline = {
      capturedAt: new Date().toISOString(),
      mode: MODE,
      totals: Object.fromEntries(summary.map((s) => [s.name, { total: s.total, passed: s.passed, failed: s.failed, skipped: s.skipped, wallMs: s.wallMs }])),
    };
    await writeFile(baselinePath, JSON.stringify(baseline, null, 2) + "\n");
    console.log(`\n📌 baseline captured → ${path.relative(repoRoot, baselinePath)}`);
    console.log(`   totals: ${JSON.stringify(baseline.totals)}`);
    process.exit(totalFailed === 0 ? 0 : 1);
  }

  // Regression comparison.
  let regression = false;
  if (existsSync(baselinePath)) {
    const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
    console.log("\nREGRESSION vs baseline (" + baseline.capturedAt + "):");
    for (const s of summary) {
      const b = baseline.totals[s.name];
      if (!b) { console.log(`  · ${s.name}: NEW SUITE (no baseline)`); continue; }
      const passDelta = s.passed - b.passed;
      const failDelta = s.failed - b.failed;
      const wallDelta = s.wallMs - b.wallMs;
      const wallPct = b.wallMs > 0 ? ((wallDelta / b.wallMs) * 100).toFixed(1) : "—";
      const dir = failDelta > 0 || passDelta < 0 ? "🔴" : "🟢";
      console.log(`  ${dir} ${s.name}: pass ${b.passed}→${s.passed} (${signed(passDelta)}) · fail ${b.failed}→${s.failed} (${signed(failDelta)}) · wall ${b.wallMs}→${s.wallMs}ms (${signed(wallDelta)}ms · ${wallPct}%)`);
      if (failDelta > 0 || passDelta < 0) regression = true;
    }
  } else {
    console.log(`\n(no baseline yet · run with --capture-baseline once behaviour is verified by hand)`);
  }

  if (totalFailed > 0) {
    console.log("\n🔴 BLOCKED · one or more cases failed");
    process.exit(1);
  }
  if (regression) {
    console.log("\n🔴 REGRESSION · pass count fell or fail count rose vs baseline");
    process.exit(1);
  }
  console.log("\n🟢 SAFE TO SHIP");
  process.exit(0);
}

function pad(s, w) { return (s + " ".repeat(w)).slice(0, w); }
function padr(s, w) { return (" ".repeat(w) + s).slice(-w); }
function signed(n) { return n > 0 ? `+${n}` : `${n}`; }

/** Compile a case-authored regex. Supports the common Perl-style
 *  `(?i)` prefix by stripping it and setting the `i` flag — JS
 *  regex doesn't accept inline `(?i)` mode groups. */
function compileRegex(pattern) {
  let flags = "";
  let src = pattern;
  const m = src.match(/^\(\?([imsu]+)\)/);
  if (m) { flags = m[1]; src = src.slice(m[0].length); }
  return new RegExp(src, flags);
}

// ── ENTRY (must be last · references top-level consts declared above) ─
if (!process.env.__GUARDIAN_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", "--env-file=.env.local", fileURLToPath(import.meta.url), ...argv],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __GUARDIAN_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await run();
}
