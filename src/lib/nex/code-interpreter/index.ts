// src/lib/nex/code-interpreter/index.ts
//
// Founder Phase 20 · Code interpreter aggregator + fire-and-forget provenance.

import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";
import type { CodeExecuteResult } from "./contract";

export * from "./contract";
export { executeSandboxed } from "./executor";

export function persistExecution(
  result: CodeExecuteResult,
  ctx: { conversation_id: string | null; user_id: string | null; sanitiser_neutralised: number },
): void {
  void (async () => {
    try {
      const pool = getKnowledgeFactoryDbPool();
      await pool.query(
        `INSERT INTO nex.code_execution
           (execution_id, conversation_id, user_id, language, code_hash, code_length,
            stdout_length, stderr_length, return_kind, request_ms, timed_out, ok,
            error_class, sanitiser_neutralised)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (execution_id) DO NOTHING`,
        [result.execution_id, ctx.conversation_id, ctx.user_id, result.language,
         result.code_hash, result.code_length, result.stdout.length, result.stderr.length,
         result.return_kind, result.request_ms, result.timed_out, result.ok,
         result.error_class, ctx.sanitiser_neutralised],
      );
    } catch { /* provenance is best-effort */ }
  })();
}
