// J2.1 fixture · source has a literal producer that the test contradicts.
// Test expects 2; this returns 1 → J.2 should propose the source repair.
export function getAnswer(): number {
  return 1;
}
