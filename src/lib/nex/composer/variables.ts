// NEX Composer · variable interpolation + discovery
//
// {{name}}-style variables · replaced at RENDER time by the composer
// (for preview) OR at SEND time by the Email Runtime (for delivery).
// Composer output MUST leave `{{unsubscribe_link}}` intact so the
// Runtime can substitute the per-recipient URL.

import { VARIABLES, type VariableContext, type VariableName } from "./types";

const VAR_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Case-insensitive lookup of variable name → registered def. */
export function isKnownVariable(name: string): name is VariableName {
  return VARIABLES.some((v) => v.name === name);
}

/**
 * Replace known variables in text/html with values from ctx.
 * `unsubscribe_link` is INTENTIONALLY not replaced by default so the
 * Runtime can substitute per-recipient URLs at send time · pass
 * `resolveUnsubscribe: true` for preview.
 */
export function interpolate(input: string, ctx: VariableContext = {}, opts?: { resolveUnsubscribe?: boolean }): string {
  return input.replace(VAR_RE, (match, rawName: string) => {
    const name = rawName.toLowerCase();
    if (name === "unsubscribe_link" && !opts?.resolveUnsubscribe) return match;
    if (!isKnownVariable(name)) return match;                       // leave unknown variables as-is
    if (name === "current_year") return String(new Date().getFullYear());
    const v = ctx[name as VariableName];
    return v ?? "";
  });
}

/** Return the set of variable names found in the given string. */
export function findVariables(input: string | null | undefined): string[] {
  if (!input) return [];
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  VAR_RE.lastIndex = 0;
  while ((m = VAR_RE.exec(input)) !== null) found.add(m[1].toLowerCase());
  return Array.from(found);
}

/** Sample context suitable for preview when no contact is chosen. */
export function sampleContext(): VariableContext {
  const ctx: VariableContext = {};
  for (const v of VARIABLES) {
    if (v.name === "current_year") ctx.current_year = String(new Date().getFullYear());
    else ctx[v.name] = v.sample_value;
  }
  return ctx;
}

/**
 * Build a VariableContext from a canonical Contact row (subset of the
 * Contact Registry fields · matches what /api/nex/contacts/list returns).
 */
export function contextFromContact(contact: {
  name?: string | null; company?: string | null; email?: string | null;
  country?: string | null; trade_categories?: string[] | null;
}): VariableContext {
  const trade = Array.isArray(contact.trade_categories) && contact.trade_categories.length > 0
    ? contact.trade_categories[0] : undefined;
  return {
    name:         contact.name    ?? undefined,
    company:      contact.company ?? undefined,
    email:        contact.email   ?? undefined,
    country:      contact.country ?? undefined,
    trade,
    current_year: String(new Date().getFullYear()),
  };
}
