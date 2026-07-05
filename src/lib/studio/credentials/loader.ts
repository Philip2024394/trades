// Server-side loader for a brand's public credentials.
//
// Called at site-render time. Returns ONLY credentials that should
// appear on a public page — verified + self-declared. Expired /
// suspended / not-found / error are silently filtered.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CredentialScheme } from "@/lib/studio/blueprints";

export type PublicCredential = {
  scheme: CredentialScheme;
  status: "verified" | "self-declared";
  number: string;
  displayLabel: string | null;
  verifiedAt: string | null;
};

export async function loadPublicCredentialsForBrand(
  brandId: string
): Promise<PublicCredential[]> {
  const res = await supabaseAdmin
    .from("studio_brand_credentials")
    .select("scheme, status, number, display_label, verified_at, expires_at")
    .eq("brand_id", brandId)
    .in("status", ["verified", "self-declared"]);
  if (res.error || !res.data) return [];

  const now = Date.now();
  const out: PublicCredential[] = [];
  for (const row of res.data as {
    scheme: string;
    status: string;
    number: string;
    display_label: string | null;
    verified_at: string | null;
    expires_at: string | null;
  }[]) {
    // Silently hide anything whose merchant-declared expiry has passed.
    // Auto-verified rows populate expires_at from the register (nullable
    // when the register doesn't publish one).
    if (row.expires_at && new Date(row.expires_at).getTime() < now) {
      continue;
    }
    if (row.status !== "verified" && row.status !== "self-declared") {
      continue;
    }
    out.push({
      scheme: row.scheme as CredentialScheme,
      status: row.status,
      number: row.number,
      displayLabel: row.display_label,
      verifiedAt: row.verified_at
    });
  }
  return out;
}
