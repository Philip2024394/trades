// data/nex1-code-engine/novel-f/services/audit-writer/writer.ts
import type { AuditEntry } from "../../lib/models/audit-entry";
export function writeEntries(actors: readonly string[]): AuditEntry[] {
  return actors.map((actor, i) => ({ entryId: `e${i}`, actor }));
}
