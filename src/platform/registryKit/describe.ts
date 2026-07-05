// registryKit · AI-consumable describe().
//
// Generalised from designSystemRegistry.describe(). Produces a compact
// one-line description of a registration that AI callers can iterate
// over. Domain-specific registries can extend this via `extraFacts` —
// for example, a section registry describes its `library` and
// `bestForVerticals`, an app registry describes its dependencies.

import type { Frozen, RegistrationBase } from "./types";

/** Structured facts an AI can reason over — no HTML, no styling —
 *  pure text. */
export function describeRegistration<T extends RegistrationBase>(
  reg: Frozen<T> | undefined,
  extraFacts?: (reg: Frozen<T>) => string[]
): string {
  if (!reg) return "not-registered";
  const parts: string[] = [
    `${reg.name} (${reg.id}) v${reg.version} — ${reg.description}`,
    `Category: ${reg.category}.`
  ];
  if (reg.searchKeywords && reg.searchKeywords.length > 0) {
    parts.push(`Keywords: ${reg.searchKeywords.join(", ")}.`);
  }
  if (reg.aliases && reg.aliases.length > 0) {
    parts.push(`Aliases: ${reg.aliases.join(", ")}.`);
  }
  if (reg.deprecation) {
    const { deprecatedSince, replacedBy, reason } = reg.deprecation;
    const replace = replacedBy ? ` Use "${replacedBy}" instead.` : "";
    const why = reason ? ` ${reason}` : "";
    parts.push(`Deprecated since v${deprecatedSince}.${replace}${why}`);
  }
  if (extraFacts) {
    const extra = extraFacts(reg);
    for (const f of extra) if (f) parts.push(f);
  }
  return parts.join(" ");
}
