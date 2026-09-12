// data/nex1-code-engine/novel-f/services/audit-writer/batch.ts
import type { AuditEntry } from "../../lib/models/audit-entry";
export function batchEntries(actors: readonly string[]): AuditEntry[] {
  return actors.map((actor, i) => ({ entryId: `b${i}`, actor }));
}
