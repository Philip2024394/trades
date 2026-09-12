// J2.2 fixture · source declares a literal type contract.
// Test asserts a value that violates the contract → J.2 must refuse.
export function getKind(): "widget" {
  return "widget";
}
