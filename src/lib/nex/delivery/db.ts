// NEX Delivery · pg pool · thin re-export.
// The canonical implementation lives at `src/lib/nex/db.ts` (moved so
// subsystems bound by doctrine tripwires — Predictive Engine invariant
// #15 — can reach the pool without importing a domain module). Kept
// here as a re-export so existing delivery / queue / expansion / worker
// imports continue to compile unchanged.

export { withClient } from "@/lib/nex/db";
export type { PgClientLike } from "@/lib/nex/db";
