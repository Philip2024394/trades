// Caller constructs LevelD[] · which transitively extends A→B→C.
import type { LevelD } from "./types-d";
export function buildLevelD(notes: readonly string[]): LevelD[] {
  return notes.map((dNote, i) => ({
    aId: `d${i}`,
    bTag: `b${i}`,
    cLabel: `c${i}`,
    dNote,
  }));
}
