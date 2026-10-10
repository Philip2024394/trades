// NEX Migration Engine · public entry point
// One-call convenience wrapper that composes parser + generator + ledger.
// Used by the /api/nex-migration/plan route and by the pipeline's migration
// reviewer when it wants to validate a proposed change deterministically.

import { parseInterfaceToSchema } from "./schema-parser";
import type { ParseOptions } from "./schema-parser";
import { generateDdlPlan } from "./ddl-generator";
import { getTableSchema, saveTableSchema, forgetTableSchema, loadLedger } from "./schema-ledger";
import type { DdlPlan } from "./types";

export type { SqlDialect, ColumnDefinition, TableSchema, DdlStatement, DdlPlan, PolicyRejection, LedgerFile } from "./types";
export { parseInterfaceToSchema } from "./schema-parser";
export { generateDdlPlan, isSafeDdlStatement } from "./ddl-generator";
export { loadLedger, getTableSchema, saveTableSchema, forgetTableSchema, LEDGER_REL_PATH } from "./schema-ledger";
export { scanForDestructive, isSafeIdentifier } from "./policy";

export interface PlanFromInterfaceOptions extends ParseOptions {
  readonly source_path: string;
  readonly founder_prompt?: string;
  readonly persist?: boolean;
}

/**
 * End-to-end helper: parse a TS interface, diff against the ledger, produce
 * an additive DDL plan, and (optionally) persist the new schema on success.
 */
export function planFromInterface(opts: PlanFromInterfaceOptions): DdlPlan {
  const parsed = parseInterfaceToSchema(opts.source_path, {
    interface_name: opts.interface_name,
    table_name: opts.table_name,
    dialect: opts.dialect,
  });
  if (!parsed.schema) {
    return {
      dialect: opts.dialect,
      target: {
        table_name: opts.table_name,
        columns: [],
        source_path: opts.source_path,
        interface_name: opts.interface_name,
      },
      current: null,
      statements: [],
      rejected: parsed.rejections,
      ok: false,
      planned_at: new Date().toISOString(),
    };
  }
  const current = getTableSchema(opts.table_name);
  const plan = generateDdlPlan({
    dialect: opts.dialect,
    current,
    target: parsed.schema,
    founder_prompt: opts.founder_prompt,
  });
  if (plan.ok && opts.persist) {
    saveTableSchema(parsed.schema);
  }
  return plan;
}
