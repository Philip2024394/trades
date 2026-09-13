// scripts/nex-continuous-runner.mts
//
// Continuous runner for the intelligence orchestrator + heartbeat.
// Fires an orchestrator tick every ORCH_INTERVAL_MS and a heartbeat tick
// every HEARTBEAT_INTERVAL_MS. Runs until Ctrl-C.
//
// Founder's golden rule: agents never stop working. This runner keeps
// the mandate active and continuously produces missions while operating
// entirely inside the founder-signed envelope.

import { promises as fs } from "node:fs";
import path from "node:path";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { signMandate, persistMandate, loadLatestMandate } from "@/lib/nex-intel-orchestrator/mandate";
import { runOrchestratorTick } from "@/lib/nex-intel-orchestrator/orchestrator";
import { runHeartbeatTick } from "@/lib/nex-hq-heartbeat/monitor";
import { signCrawlerManifest } from "@/lib/nex-intelligence/crawler-manifest";
import type { CrawlerManifest, CrawlerManifestEntry } from "@/lib/nex-intelligence/types";

const REPO = process.cwd();
const ORCH_INTERVAL_MS = 15_000;         // orchestrator tick every 15s
const HEARTBEAT_INTERVAL_MS = 45_000;    // heartbeat tick every 45s (slice-1 uses shorter than 3min for demo)
const DEFAULT_DURATION_MS = 2 * 60_000;  // 2 minutes total by default; override with --duration

const args = process.argv.slice(2);
const durationArg = args.find((a) => a.startsWith("--duration="));
const durationMs = durationArg ? Number(durationArg.slice("--duration=".length)) : DEFAULT_DURATION_MS;

async function main() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pubHex = (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex");
  const privHex = (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex");

  // Sign + persist mandate (24h lifetime)
  const mandate = signMandate(privHex, {
    mandate_id: `continuous-run-${randomUUID()}`,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
    authorised_source_class_ids: ["academic_publication"],
    authorised_crawler_manifest_ids: ["arxiv-continuous"],
    authorised_work_classes: ["crawl_new_authorised_source", "revisit_stale_knowledge"] as const,
    authorised_domains: ["software-engineering"],
    max_concurrent_missions: 5,
    max_daily_missions: 1000,
    max_experiment_budget_ms: 60_000,
    max_storage_bytes_per_mission: 10 * 1024 * 1024,
    prohibited_actions: ["POST", "authorise", "modify-substrate"],
    prohibited_hosts: [],
    promotion_thresholds_by_tier: { INTELLIGENCE: 0.80, SUPER_INTELLIGENCE: 0.95 },
    authorising_wo_id: "wo-intel-orch-01",
  });
  await persistMandate(mandate);
  console.log(`[runner] mandate signed: ${mandate.mandate_id}`);

  // Sign crawler manifest
  const entry: CrawlerManifestEntry = {
    manifest_entry_id: "arxiv-continuous",
    authorised_hosts: ["export.arxiv.org"],
    authorised_paths: ["/api/query"],
    authorised_methods: ["GET"],
    rate_limit_requests_per_minute: 20,
    authorised_categories: ["cs.SE"],
    authorised_query_predicates: [],
    authorising_wo_id: "wo-intel-orch-01",
    expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
  };
  const manifest: CrawlerManifest = signCrawlerManifest(privHex, [entry]);

  const atomBody = await fs.readFile(path.join(REPO, "src/lib/nex-intelligence/__fixtures__/arxiv-test-corpus.atom"));
  const httpOverride = async () => ({ status: 200 as number, headers: { "content-type": "application/atom+xml" } as Record<string, string>, body: atomBody });

  const started = Date.now();
  const stopAt = started + durationMs;
  let orchTicks = 0;
  let heartbeatTicks = 0;
  let dispatched = 0;
  let noMission = 0;

  const orchTimer = setInterval(async () => {
    if (Date.now() >= stopAt) return;
    try {
      const sandbox = path.join(REPO, "data", "nex-agent-workspaces", `runner-orch-${Date.now()}`);
      await fs.mkdir(sandbox, { recursive: true });
      const r = await runOrchestratorTick({
        crawler_manifest: manifest,
        fetch_url: "https://export.arxiv.org/api/query?search_query=cs.SE",
        sandbox_root: sandbox,
        trusted_attestation_keys: [pubHex],
        _http_override: httpOverride,
      });
      orchTicks++;
      if (r.kind === "DISPATCHED") { dispatched++; console.log(`[runner] orch ${orchTicks}: DISPATCHED · ${r.outcome.kind} · ${r.outcome.evidence_summary.fragments_extracted} fragments`); }
      else if (r.kind === "NO_MISSION") { noMission++; console.log(`[runner] orch ${orchTicks}: NO_MISSION · ${r.reason}`); }
      else { console.log(`[runner] orch ${orchTicks}: ${r.kind} · ${r.reason}`); }
      await fs.rm(sandbox, { recursive: true, force: true }).catch(() => {});
    } catch (e) {
      console.error(`[runner] orch tick error:`, (e as Error).message);
    }
  }, ORCH_INTERVAL_MS);

  const heartbeatTimer = setInterval(async () => {
    if (Date.now() >= stopAt) return;
    try {
      const r = await runHeartbeatTick({ scheduler_examined_workload: true });
      heartbeatTicks++;
      console.log(`[runner] hb ${heartbeatTicks}: ${JSON.stringify(r.by_state)}`);
    } catch (e) {
      console.error(`[runner] hb tick error:`, (e as Error).message);
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Fire one immediate orchestrator tick + one heartbeat so the state is visible right away
  {
    const sandbox = path.join(REPO, "data", "nex-agent-workspaces", `runner-orch-${Date.now()}`);
    await fs.mkdir(sandbox, { recursive: true });
    const r = await runOrchestratorTick({
      crawler_manifest: manifest,
      fetch_url: "https://export.arxiv.org/api/query?search_query=cs.SE",
      sandbox_root: sandbox,
      trusted_attestation_keys: [pubHex],
      _http_override: httpOverride,
    });
    orchTicks++;
    if (r.kind === "DISPATCHED") { dispatched++; console.log(`[runner] orch 1 (immediate): DISPATCHED · ${r.outcome.kind}`); }
    await fs.rm(sandbox, { recursive: true, force: true }).catch(() => {});
    const hb = await runHeartbeatTick({ scheduler_examined_workload: true });
    heartbeatTicks++;
    console.log(`[runner] hb 1 (immediate): ${JSON.stringify(hb.by_state)}`);
  }

  // Sleep until duration expires
  await new Promise<void>((resolve) => setTimeout(resolve, durationMs));
  clearInterval(orchTimer);
  clearInterval(heartbeatTimer);
  console.log(`\n[runner] complete. orch_ticks=${orchTicks} · heartbeat_ticks=${heartbeatTicks} · missions_dispatched=${dispatched} · no_mission=${noMission}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
