// FIXTURE · Fix 24 · single-arg call · adjacent failing test.
export interface AnswerResult { readonly value: number; }
export function computeAnswer(_n: number): AnswerResult {
  const value = 42;
  return { value };
}
