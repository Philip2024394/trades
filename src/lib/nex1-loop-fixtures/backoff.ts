// FIXTURE · arithmetic clamp.
export interface BackoffResult { readonly factor: number; }
export function computeBackoff(attempt: number): BackoffResult {
  const factor = Math.max(1, attempt);
  return { factor };
}
