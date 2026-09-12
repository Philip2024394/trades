// src/lib/nex/security-agent/inspect-file-registry.ts
//
// Check every touched file against the file-capability-map.
// Missing = REJECT (sec.file_outside_registry).
// ROGUE-flagged path = REJECT (sec.rogue_path_modified).
// CAP-UNASSIGNED (low-precedence fallback) = REJECT (sec.file_outside_registry).

import type { ProposedFileChange, SecurityRejection } from "./types";
import { resolveCapabilityForPath, type LoadedRegistries } from "./registries";

export function inspectFileRegistry(
  files: readonly ProposedFileChange[],
  registries: LoadedRegistries,
): readonly SecurityRejection[] {
  const rejections: SecurityRejection[] = [];
  for (const f of files) {
    const owner = resolveCapabilityForPath(f.path, registries.fileMap);
    if (owner === null) {
      rejections.push({
        code: "sec.file_outside_registry",
        message: `File ${f.path} does not match any pattern in docs/nex-file-capability-map.json. Every touched file must map to an owning CAP-XXX before code changes are inspected.`,
        filePath: f.path,
      });
      continue;
    }
    if (owner.capability === "ROGUE") {
      rejections.push({
        code: "sec.rogue_path_modified",
        message: `File ${f.path} is under a ROGUE-flagged path (mapping ${owner.mappingId}). Modifying it is forbidden until founder-authorised removal (per ADR-0316 sub-phase D.5).`,
        filePath: f.path,
      });
      continue;
    }
    if (owner.capability === "CAP-UNASSIGNED") {
      rejections.push({
        code: "sec.file_outside_registry",
        message: `File ${f.path} matches only the CAP-UNASSIGNED fallback pattern (mapping ${owner.mappingId}). A capability-specific mapping is required before code changes are permitted here.`,
        filePath: f.path,
      });
    }
  }
  return rejections;
}
