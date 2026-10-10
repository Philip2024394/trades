// FIXTURE · conditional expression · starts mis-aligned.
export interface ThresholdResult { readonly max: number; }
export function computeThreshold(mode: number): ThresholdResult {
  const isPremium = mode === 1;
  const max = isPremium ? 5 : 100;
  return { max };
}
