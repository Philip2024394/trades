// FIXTURE · string-valued outcome (expected gap · quote handling).
export interface Badge { readonly label: string; }
export function makeBadge(role: string): Badge {
  const label = "user";
  return { label };
}
