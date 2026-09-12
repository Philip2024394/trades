// Cycle test · X extends Y · deliberately paired with Y extends X.
// NEX1's heritage traversal must fail SAFE (bounded) on this input,
// not hang. Note: TypeScript itself will emit a diagnostic; that is
// separate from what we are measuring — we measure NEX1's own
// bounded-termination behaviour.
import type { CycleY } from "./types-y";
export interface CycleX extends CycleY {
  readonly xTag: string;
}
