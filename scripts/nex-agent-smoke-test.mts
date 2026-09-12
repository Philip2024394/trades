// scripts/nex-agent-smoke-test.mts
//
// Smoke-test the NEX Agent v1.0 orchestrator with three prompts covering:
//   1. add_feature (should classify high + compose plan + pass reviewers)
//   2. add_migration (should mention db/migrations/ + trigger protected-dir finding)
//   3. vague prompt (should clarify · low confidence path)

import { Client } from "pg";
import { classifyPrompt, processTask } from "../src/lib/nex-agent/core/orchestrator.js";

const url = process.env.NEX_TAXONOMY_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

async function createTask(prompt: string): Promise<string> {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const r = await c.query(`INSERT INTO nex_agent.tasks (submitted_by, prompt) VALUES ('smoke_test', $1) RETURNING task_id`, [prompt]);
    return r.rows[0].task_id;
  } finally { await c.end(); }
}

async function main() {
  const cases = [
    "Add a new API route at /api/nex/health that returns { ok: true, ts_iso }.",
    "Add a migration to db/migrations/ that creates a nex.founder_kudos table with columns (id uuid, note text, created_at).",
    "make it better",
  ];
  for (const prompt of cases) {
    console.log("\n============================================================");
    console.log("PROMPT:", prompt);
    console.log("INTENT (classifier):", JSON.stringify(classifyPrompt(prompt)));
    const taskId = await createTask(prompt);
    console.log("task_id:", taskId);
    const result = await processTask(taskId);
    console.log("status:", result.status);
    if (result.questions) console.log("questions:", result.questions);
    if (result.plan) {
      console.log("plan.files_to_create:", result.plan.files_to_create);
      console.log("plan.steps:", result.plan.steps.length);
      console.log("plan.acceptance_test:", result.plan.acceptance_test);
    }
    if (result.brief) console.log("brief length:", result.brief.length, "chars");
  }
}
main().catch(err => { console.error("FATAL:", err); process.exit(1); });
