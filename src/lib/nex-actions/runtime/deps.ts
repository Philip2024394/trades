// NEX Actions · runtime deps composition · F3 (2026-08-25).
//
// Assembles the concrete NexRuntimeDeps object that runNexAction() consumes.
// This is the ONE place that wires wallet + permissions + rate-limit + audit
// + handlers together. Nothing else in the app builds a deps object.

import { walletDeps } from "../wallet/deps";
import { resolveHandler } from "../handlers";
import { permissionsDeps } from "./permissions";
import { rateLimitDeps } from "./rate-limit";
import { auditDeps } from "./audit";
import type { NexRuntimeDeps } from "./run";

export const nexActionRuntimeDeps: NexRuntimeDeps = {
  permissions: permissionsDeps,
  rateLimit:   rateLimitDeps,
  wallet:      walletDeps,
  audit:       auditDeps,
  handlers:    { resolve: resolveHandler },
};
