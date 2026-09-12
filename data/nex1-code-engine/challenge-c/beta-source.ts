// data/nex1-code-engine/challenge-c/beta-source.ts
// Capability C fixture · property name neutral · declared type string.
export interface Beta {
  readonly key: string;
  readonly num: number;
}
export function makeBeta(nums: readonly number[]): Beta[] {
  return nums.map((num, i) => ({ key: `b${i}`, num }));
}
