// Adapter registry.
//
// New domain = add one file under ./adapters/ and one line here. The
// engine iterates ADAPTERS in parallel, catches errors, and never lets
// one broken adapter kill the snapshot.

import type { BIAdapter } from "./types";
import { projectsAdapter } from "./adapters/projects";
import { quotationsAdapter } from "./adapters/quotations";
import { invoicesAdapter } from "./adapters/invoices";
import { leadsAdapter } from "./adapters/leads";
import { reviewsAdapter } from "./adapters/reviews";
import { socialAdapter } from "./adapters/social";

export const ADAPTERS: BIAdapter[] = [
  projectsAdapter,
  quotationsAdapter,
  invoicesAdapter,
  leadsAdapter,
  reviewsAdapter,
  socialAdapter
];

export function adapterByDomain(domain: string): BIAdapter | null {
  return ADAPTERS.find((a) => a.domain === domain) ?? null;
}
