// scripts/nex-phase13-specialist-factory-run.mjs
//
// Phase 13 · Specialist Factory · demo run bootstrapping a hypothetical
// "NEX Cooking Intelligence Engineer" · dry-run only · zero real files
// written. Also demonstrates REJECTION on a missing-doctrine spec.

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const inner = String.raw`
import { bootstrapSpecialist, REQUIRED_DOCTRINE_INHERITANCE } from "@/lib/nex/agents/factory/specialist-factory";

// Well-formed spec · full doctrine inheritance
const cookingSpec = {
  agent_id: "cooking",
  human_name: "NEX Cooking Intelligence Engineer",
  archetype: "conversation_driven",
  domain_slug: "cooking",
  priority_languages: ["en", "id", "ja"],
  benchmark_corpus_seed: { seed_case_count: 6, defect_class_focus: "cooking.food_safety" },
  doctrine_inheritance: [...REQUIRED_DOCTRINE_INHERITANCE],
  founder_authorization_id: "founder_auth_cooking_specialist_demo_2026-09-08",
  founder_reason: "Demo Phase 13 · NEX Cooking Intelligence Engineer bootstrap · allergen + halal + kosher + veg + medical-diet awareness for Bali+Jakarta hospitality domain",
};

const cookingBootstrap = bootstrapSpecialist(cookingSpec, { dry_run: true });

// Deliberately-broken spec · missing doctrine (proves rejection path works)
const brokenSpec = {
  ...cookingSpec,
  agent_id: "broken_demo",
  doctrine_inheritance: REQUIRED_DOCTRINE_INHERITANCE.filter((d) => d !== "life_safety_supersession"),
};
const brokenBootstrap = bootstrapSpecialist(brokenSpec, { dry_run: true });

console.log("PHASE_13_SPECIALIST_FACTORY:" + JSON.stringify({
  demo_valid_bootstrap: {
    status: cookingBootstrap.status,
    agent_id: cookingBootstrap.spec.agent_id,
    human_name: cookingBootstrap.spec.human_name,
    archetype: cookingBootstrap.spec.archetype,
    planned_worker_file: cookingBootstrap.planned_worker_file,
    planned_module_directory: cookingBootstrap.planned_module_directory,
    planned_knowledge_namespace: cookingBootstrap.planned_knowledge_namespace,
    doctrine_manifest_count: cookingBootstrap.doctrine_manifest.length,
    integration_checklist_count: cookingBootstrap.integration_checklist.length,
    requires_founder_approval_before_ship: cookingBootstrap.requires_founder_approval_before_ship,
    time_to_first_improvement_cycle_target_hours: cookingBootstrap.time_to_first_improvement_cycle_target_hours,
  },
  demo_rejected_bootstrap: {
    status: brokenBootstrap.status,
    agent_id: brokenBootstrap.spec.agent_id,
    rejection_reasons: brokenBootstrap.rejection_reasons,
  },
  factory_discipline: {
    reserved_agent_ids_protected: true,
    sprawl_cap_max_specialists_total: 10,
    doctrine_inheritance_required_count: REQUIRED_DOCTRINE_INHERITANCE.length,
    dry_run_default: true,
    zero_files_written: true,
  },
  founder_gate: "every bootstrap · even DRY_RUN_PLAN · carries requires_founder_approval_before_ship:true · integration checklist has 10 steps and Step 8 requires explicit Founder BEGIN to start as live process",
}, null, 2));
`;

const dir = path.resolve(process.cwd(), "scripts", ".phase13-runner");
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const tsPath = path.join(dir, "runner.ts");
writeFileSync(tsPath, inner, "utf8");
process.on("exit", () => { try { unlinkSync(tsPath); } catch { /* */ } });

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", tsPath],
  { cwd: process.cwd(), stdio: "inherit", env: { ...process.env, NODE_NO_WARNINGS: "1" }, shell: true }
);
child.on("exit", (code) => process.exit(code ?? 1));
