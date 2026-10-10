// FIXTURE · multi-file (expected gap · cross-module trace).
import { multiplier } from "./ts-multifile-b";
export interface TotalResult { readonly total: number; }
export function computeTotal(input: number): TotalResult {
  const total = multiplier(input);
  return { total };
}
