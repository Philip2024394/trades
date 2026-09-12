// J3.3 regression fixture · one function whose literal is consumed by two
// tests with contradictory expectations. Fixing one breaks the other.
export function getVal(): number {
  return 1;
}
