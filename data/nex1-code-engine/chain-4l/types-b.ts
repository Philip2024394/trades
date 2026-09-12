// Level 2 · extends LevelA.
import type { LevelA } from "./types-a";
export interface LevelB extends LevelA {
  readonly bTag: string;
}
