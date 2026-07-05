// shadcn/ui / Radix cn() utility.
//
// Combines conditional Tailwind class strings and dedupes / resolves
// conflicting utilities via tailwind-merge. Every shadcn primitive and
// every rebuilt platform section imports this — one call site so the
// merge order is deterministic.

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
