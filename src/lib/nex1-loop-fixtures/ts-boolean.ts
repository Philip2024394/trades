// FIXTURE · boolean-valued outcome.
export interface Flag { readonly enabled: boolean; }
export function computeFlag(active: boolean): Flag {
  const enabled = true;
  return { enabled };
}
