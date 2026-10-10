// §36-E-3B · WAVE-E3B · 2026-09-14 · first-real-skills
// NEX bounded infrastructure · skills library index · 2026-09-14
// Provenance recorded on each exported skill as bounded NEX infrastructure. NOT NEX1-authored capability.
//
// Locked skill library. Every entry references the E3a locked predicate
// catalogue only · no arbitrary code · no LLM. Real invocable engineering
// knowledge against candidate changes.

import type { Skill } from "../skill-schema-types";
import { NEX_AGENT_RUNTIME_BOUNDARY_SKILL } from "./nex-agent-runtime-boundary.skill";
import { TYPESCRIPT_REFUSAL_FIRST_SKILL } from "./typescript-refusal-first.skill";
import { REACT_HOOKS_BOUNDARY_SKILL } from "./react-hooks-boundary.skill";
import { SQL_MIGRATION_SAFETY_SKILL } from "./sql-migration-safety.skill";
import { NEXT_APP_ROUTER_CONVENTIONS_SKILL } from "./next-app-router-conventions.skill";

export const FIRST_SKILLS_LIBRARY: readonly Skill[] = Object.freeze([
  NEX_AGENT_RUNTIME_BOUNDARY_SKILL,
  TYPESCRIPT_REFUSAL_FIRST_SKILL,
  REACT_HOOKS_BOUNDARY_SKILL,
  SQL_MIGRATION_SAFETY_SKILL,
  NEXT_APP_ROUTER_CONVENTIONS_SKILL,
]);

export {
  NEX_AGENT_RUNTIME_BOUNDARY_SKILL,
  TYPESCRIPT_REFUSAL_FIRST_SKILL,
  REACT_HOOKS_BOUNDARY_SKILL,
  SQL_MIGRATION_SAFETY_SKILL,
  NEXT_APP_ROUTER_CONVENTIONS_SKILL,
};
