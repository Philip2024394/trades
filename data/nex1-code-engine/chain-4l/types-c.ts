// Level 3 · extends LevelB.
import type { LevelB } from "./types-b";
export interface LevelC extends LevelB {
  readonly cLabel: string;
}
