// Platform SDK — App storage.
//
// Returns a Supabase query builder scoped to a table the App owns.
// Enforces three invariants that would otherwise be App-author
// discipline problems:
//
//   1. Prefix — every App-owned table is named `app_<slug>_<local>`.
//      The SDK computes the prefix from the manifest; the App only
//      names the local part. No way to accidentally reach into
//      another App's tables.
//
//   2. Declaration — the resolved table name must appear in
//      manifest.storage.tables. Catches typos and missing migrations
//      at the call site instead of hitting Supabase with a 42P01.
//
//   3. Naming — local names are lowercase alphanumeric + underscore.
//      Catches injection attempts and blocks SQL-unsafe names before
//      they reach the driver.
//
// The SDK does NOT wrap the returned query builder — App authors get
// the full Supabase API surface for their table. That's deliberate:
// wrapping would be an infinite maintenance surface, and the invariant
// this SDK enforces is which table you touch, not how you touch it.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertCapability } from "./permissions";
import type { AppContext } from "./context";

const LOCAL_NAME_RE = /^[a-z][a-z0-9_]*$/;

/** Resolve the full DB name from an App context + local table name.
 *  Exposed separately so callers who need the name (e.g. for a raw
 *  RPC call) can compute it without triggering the query builder. */
export function appTableName(ctx: AppContext, localName: string): string {
  if (!LOCAL_NAME_RE.test(localName)) {
    throw new Error(
      `appTableName: invalid local table name "${localName}" ` +
        `— must start with a lowercase letter and contain only ` +
        `lowercase letters, digits, or underscores.`
    );
  }
  const prefix = `app_${ctx.manifest.slug.replace(/-/g, "_")}_`;
  const full = `${prefix}${localName}`;
  const declared = ctx.manifest.storage?.tables ?? [];
  if (!declared.includes(full)) {
    throw new Error(
      `appTableName: table "${full}" not declared in App "${ctx.manifest.slug}" ` +
        `manifest.storage.tables. Add it (and its migration) before use.`
    );
  }
  return full;
}

/** Get a Supabase query builder for one of this App's owned tables.
 *  Requires the App to have declared the "storage" capability. */
export function appTable(ctx: AppContext, localName: string) {
  assertCapability(ctx, "storage");
  const full = appTableName(ctx, localName);
  return supabaseAdmin.from(full);
}
