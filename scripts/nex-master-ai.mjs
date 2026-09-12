#!/usr/bin/env node
// scripts/nex-master-ai.mjs
//
// NEX Master AI Engineer · Founder-facing CLI
// Philip 2026-09-07 · AUTHORIZE (Wave 2 · continuous mission)
//
// Two-step tsx pattern proven from scripts/nex-agents.mjs. Subcommands:
//
//   status                · list registered agents + latest derived health
//   observe-tick          · run one observatory tick against real runtime
//   pending-promotions    · list AWAITING_APPROVAL promotion queue entries
//   pending-proposals     · list AWAITING_APPROVAL capability proposals
//   intel                 · print recent Philip intelligence claims
//   sources               · list registered research sources + latest health
//   quotas                · list quota policies + today's usage per source
//   daily                 · compose + print a Daily Intelligence briefing
//
// All operations READ-ONLY except observe-tick + daily (they append records
// to Master AI's own ledgers · they NEVER touch any observed agent's data).

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);

if (!process.env.NEX_MASTER_AI_CLI_INNER) {
  const envArgs = fs.existsSync(path.join(repoRoot, ".env.local"))
    ? ["--env-file=.env.local"]
    : [];
  const child = spawn(
    "npx",
    ["tsx", ...envArgs, entryFile, ...process.argv.slice(2)],
    { stdio: "inherit", cwd: repoRoot, shell: true,
      env: { ...process.env, NEX_MASTER_AI_CLI_INNER: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const [cmd] = process.argv.slice(2);
  if (!cmd) {
    console.error("Usage: node scripts/nex-master-ai.mjs <status|observe-tick|pending-promotions|pending-proposals|intel|sources|quotas|daily>");
    process.exit(2);
  }

  const registry = await import("../src/lib/nex/master-ai/agent-registry.ts");
  const observatory = await import("../src/lib/nex/master-ai/observatory.ts");
  const autonomous = await import("../src/lib/nex/master-ai/autonomous-evolution.ts");
  const teaching = await import("../src/lib/nex/master-ai/teaching.ts");
  const philip = await import("../src/lib/nex/master-ai/philip-intelligence.ts");
  const research = await import("../src/lib/nex/master-ai/research-engine.ts");
  const cost = await import("../src/lib/nex/master-ai/cost-intelligence.ts");
  const daily = await import("../src/lib/nex/master-ai/daily-intelligence.ts");

  // Idempotently seed the runtime agents (safe · additive).
  registry.ensureRuntimeAgentsRegistered({ registered_by: "cli" });

  switch (cmd) {
    case "status": {
      const agents = registry.listAgents();
      console.log(`\nNEX MASTER AI · agents (${agents.length})\n`);
      for (const a of agents) {
        const latest = observatory.latestReportForAgent(a.agent_id);
        console.log(`  ${a.agent_id.padEnd(20)} · lifecycle=${a.lifecycle_state.padEnd(10)} · auth=${a.authorization_state}`);
        if (latest) {
          console.log(`     derived_health=${latest.derived_health}  · running=${latest.running}  · heartbeat_stale_ms=${latest.heartbeat_stale_ms ?? "-"}`);
        } else {
          console.log(`     (no observatory report yet · run: observe-tick)`);
        }
      }
      console.log();
      break;
    }
    case "observe-tick": {
      const reports = observatory.observatoryTick();
      console.log(`\nOBSERVATORY TICK · ${new Date().toISOString()} · reports=${reports.length}\n`);
      for (const r of reports) {
        console.log(`  ${r.agent_id.padEnd(20)} · ${r.derived_health.padEnd(10)} · useful=${r.useful}`);
        console.log(`     running=${r.running}  · heartbeat_fresh=${r.heartbeat_fresh}  · stale_ms=${r.heartbeat_stale_ms ?? "-"}`);
        console.log(`     work_completed_5m=${r.work_completed_since_last_report}  · work_failed_5m=${r.work_failed_since_last_report}`);
        console.log(`     reasons=${r.reasons.join(" | ")}`);
      }
      console.log();
      break;
    }
    case "pending-promotions": {
      const list = autonomous.listPromotionApprovalEntries({ status: "AWAITING_APPROVAL" });
      console.log(`\nPENDING PROMOTIONS (${list.length})\n`);
      for (const e of list) console.log(`  ${e.entry_id} · target=${e.target_agent_id} · capability=${e.capability_id} · reason=${e.reason}`);
      console.log();
      break;
    }
    case "pending-proposals": {
      const list = teaching.listProposals({ authorization_state: "AWAITING_APPROVAL" });
      console.log(`\nPENDING CAPABILITY PROPOSALS (${list.length})\n`);
      for (const p of list) {
        console.log(`  ${p.proposal_id}`);
        console.log(`     source=${p.source_agent_id} → target=${p.target_agent_id}`);
        console.log(`     slug=${p.proposed_capability_slug} · hypothesis=${p.hypothesis.slice(0, 100)}`);
      }
      console.log();
      break;
    }
    case "intel": {
      const claims = philip.readAllClaims().slice(-20);
      console.log(`\nRECENT PHILIP INTEL CLAIMS (last ${claims.length})\n`);
      for (const c of claims) {
        console.log(`  [${c.classification}][${c.category}] ${c.statement}`);
        if (c.uncertainty_note) console.log(`     uncertainty: ${c.uncertainty_note}`);
      }
      console.log();
      break;
    }
    case "sources": {
      const sources = research.listSources();
      console.log(`\nREGISTERED SOURCES (${sources.length})\n`);
      for (const s of sources) console.log(`  ${s.source_slug.padEnd(24)} · ${s.kind.padEnd(20)} · tier=${s.authority_tier} · auth=${s.authorization_state}`);
      console.log();
      break;
    }
    case "quotas": {
      const policies = cost.readAllPolicies();
      const seen = new Set(policies.map((p) => `${p.source_slug}::${p.metric}`));
      console.log(`\nQUOTA POLICIES (${seen.size})\n`);
      for (const key of seen) {
        const [slug, metric] = key.split("::");
        const p = policies.filter((x) => x.source_slug === slug && x.metric === metric).slice(-1)[0];
        const usedToday = cost.usageTodaySoFar(slug, metric);
        console.log(`  ${slug.padEnd(24)} · ${metric.padEnd(8)} · used_today=${usedToday}`);
        console.log(`     free=${p.free_allowance_per_day ?? "-"}  · paid=${p.paid_allowance_per_day ?? "-"}  · hard=${p.hard_daily_limit ?? "-"}`);
      }
      console.log();
      break;
    }
    case "daily": {
      // Run an observatory tick first so agents_healthy counts reflect NOW.
      observatory.observatoryTick();
      const report = daily.composeDaily();
      console.log(`\nDAILY INTELLIGENCE · window ${report.window_start_iso} → ${report.window_end_iso}\n`);
      console.log(`  agents_monitored=${report.system_status.agents_monitored}`);
      console.log(`    healthy=${report.system_status.agents_healthy}  · idle=${report.system_status.agents_idle}  · degraded=${report.system_status.agents_degraded}  · stopped=${report.system_status.agents_stopped}`);
      console.log(`  new_knowledge=${report.new_knowledge_count}  · new_findings=${report.new_research_findings_count}  · experiments=${report.experiments_run}  · improvements_proposed=${report.improvements_proposed}`);
      console.log(`  offline_mode=${report.offline_intelligence.mode}`);
      console.log(`  cost: requests=${report.cost_intelligence.total_requests}  · est_cost_idr=${report.cost_intelligence.total_estimated_cost_idr}`);
      if (report.cost_intelligence.sources_over_50_pct_quota.length > 0) {
        console.log(`    sources_over_50pct_quota: ${report.cost_intelligence.sources_over_50_pct_quota.join(", ")}`);
      }
      console.log(`  opportunities:`); for (const o of report.future_opportunities) console.log(`    · ${o}`);
      console.log(`  risks:`);         for (const r of report.risks)                 console.log(`    · ${r}`);
      console.log(`  weaknesses:`);    for (const w of report.agent_weaknesses)      console.log(`    · ${w.agent_id}: ${w.reason}`);
      console.log(`  next research:`); for (const n of report.next_research_targets) console.log(`    · ${n}`);
      console.log();
      break;
    }
    default:
      console.error(`Unknown command: ${cmd}`);
      process.exit(2);
  }
}
