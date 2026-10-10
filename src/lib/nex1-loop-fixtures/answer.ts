// FIXTURE · answer literal.
export interface AnswerResult { readonly value: number; }
export function computeAnswer(n: number): AnswerResult {
  const value = 41;
  return { value };
}
