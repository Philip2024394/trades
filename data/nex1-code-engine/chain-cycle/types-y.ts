// Cycle test · Y extends X.
import type { CycleX } from "./types-x";
export interface CycleY extends CycleX {
  readonly yTag: string;
}
