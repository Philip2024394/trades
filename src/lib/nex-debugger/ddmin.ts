// src/lib/nex-debugger/ddmin.ts
//
// NEX Debugger · Delta Debugging (Zeller 2002 ddmin).
// Pure TypeScript · deterministic · no external state.
//
// ddmin(c, test) → 1-minimal counterexample where removing any single element
// no longer causes the failure.

export type TestOracle<T> = (candidate: readonly T[]) => "FAIL" | "PASS" | "UNRESOLVED";

export interface DdminResult<T> {
  readonly minimised: readonly T[];
  readonly iterations: number;
  readonly reduction_ratio: number;
  readonly deterministic: boolean;
}

export function ddmin<T>(circumstances: readonly T[], oracle: TestOracle<T>): DdminResult<T> {
  const original = circumstances.slice();
  let current = original.slice();
  let n = 2;
  let iterations = 0;
  let deterministic = true;

  while (current.length >= 2) {
    iterations++;
    const chunkSize = Math.max(1, Math.floor(current.length / n));
    let reducedInThisPass = false;

    // Try each chunk of size chunkSize (test if failure preserved without it)
    for (let i = 0; i < current.length; i += chunkSize) {
      const complement = current.slice(0, i).concat(current.slice(i + chunkSize));
      if (complement.length === 0) continue;
      const verdict = oracle(complement);
      if (verdict === "UNRESOLVED") { deterministic = false; continue; }
      if (verdict === "FAIL") {
        current = complement;
        n = Math.max(2, n - 1);
        reducedInThisPass = true;
        break;
      }
    }

    if (!reducedInThisPass) {
      if (n >= current.length) break;
      n = Math.min(current.length, n * 2);
    }
  }

  const reduction_ratio = original.length === 0 ? 0 : (original.length - current.length) / original.length;
  return { minimised: current, iterations, reduction_ratio, deterministic };
}
