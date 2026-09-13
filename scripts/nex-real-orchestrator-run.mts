// scripts/nex-real-orchestrator-run.mts
//
// Real end-to-end orchestrator + heartbeat exercise for the vertical slice.
// Founder-verifiable evidence: signs a test mandate + signs a crawler
// manifest + dispatches a real mission through the WO-INTEL-01/02 chain
// + runs one heartbeat tick + reports what HQ will show.

import { promises as fs } from "node:fs";
import path from "node:path";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { signMandate, persistMandate } from "@/lib/nex-intel-orchestrator/mandate";
import { runOrchestratorTick } from "@/lib/nex-intel-orchestrator/orchestrator";
import { runHeartbeatTick } from "@/lib/nex-hq-heartbeat/monitor";
import { signCrawlerManifest } from "@/lib/nex-intelligence/crawler-manifest";
import type { CrawlerManifest, CrawlerManifestEntry } from "@/lib/nex-intelligence/types";

const REPO = process.cwd();

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const pubHex = (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex");
const privHex = (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex");

// 1. Sign + persist the operating mandate
const mandate = signMandate(privHex, {
  mandate_id: `real-run-${randomUUID()}`,
  issued_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
  authorised_source_class_ids: ["academic_publication"],
  authorised_crawler_manifest_ids: ["arxiv-real-run"],
  authorised_work_classes: ["crawl_new_authorised_source", "revisit_stale_knowledge"] as const,
  authorised_domains: ["software-engineering"],
  max_concurrent_missions: 3,
  max_daily_missions: 20,
  max_experiment_budget_ms: 60_000,
  max_storage_bytes_per_mission: 10 * 1024 * 1024,
  prohibited_actions: ["POST", "authorise", "modify-substrate"],
  prohibited_hosts: [],
  promotion_thresholds_by_tier: { INTELLIGENCE: 0.80, SUPER_INTELLIGENCE: 0.95 },
  authorising_wo_id: "wo-intel-orch-01",
});
await persistMandate(mandate);
console.log("[real-run] mandate:", mandate.mandate_id);

// 2. Sign a crawler manifest for arXiv
const manifestEntry: CrawlerManifestEntry = {
  manifest_entry_id: "arxiv-real-run",
  authorised_hosts: ["export.arxiv.org"],
  authorised_paths: ["/api/query"],
  authorised_methods: ["GET"],
  rate_limit_requests_per_minute: 20,
  authorised_categories: ["cs.SE"],
  authorised_query_predicates: [],
  authorising_wo_id: "wo-intel-orch-01",
  expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
};
const manifest: CrawlerManifest = signCrawlerManifest(privHex, [manifestEntry]);

// 3. Prepare HTTP override using the fixture (arXiv rate-limits our IP)
const atomBody = await fs.readFile(path.join(REPO, "src/lib/nex-intelligence/__fixtures__/arxiv-test-corpus.atom"));
const httpOverride = async () => ({ status: 200 as number, headers: { "content-type": "application/atom+xml" } as Record<string, string>, body: atomBody });

// 4. Run one orchestrator tick — real mission dispatched, real records produced
const sandbox = path.join(REPO, "data", "nex-agent-workspaces", `real-orchestrator-${Date.now()}`);
await fs.mkdir(sandbox, { recursive: true });
console.log("[real-run] dispatching mission...");
const tickResult = await runOrchestratorTick({
  crawler_manifest: manifest,
  fetch_url: "https://export.arxiv.org/api/query?search_query=cs.SE",
  sandbox_root: sandbox,
  trusted_attestation_keys: [pubHex],
  _http_override: httpOverride,
});
console.log("[real-run] tick.kind:", tickResult.kind);
if (tickResult.kind === "DISPATCHED") {
  console.log("[real-run] mission.mission_id:", tickResult.mission.mission_id);
  console.log("[real-run] mission.kind:", tickResult.mission.kind);
  console.log("[real-run] outcome.kind:", tickResult.outcome.kind);
  console.log("[real-run] outputs:", JSON.stringify(tickResult.outcome.evidence_summary));
}

// 5. Run one heartbeat tick (scheduler_examined = true, since we just ran the scheduler)
console.log("[real-run] running heartbeat tick...");
const heartbeatResult = await runHeartbeatTick({ scheduler_examined_workload: true });
console.log("[real-run] heartbeat by_state:", JSON.stringify(heartbeatResult.by_state));
console.log("[real-run] recovery_actions:", heartbeatResult.recovery_actions.length);

// 6. Cleanup sandbox (keep persisted records)
await fs.rm(sandbox, { recursive: true, force: true }).catch(() => {});
console.log("[real-run] complete.");
