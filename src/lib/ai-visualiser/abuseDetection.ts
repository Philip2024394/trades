// Cross-merchant abuse detection.
//
// A homeowner farming N merchants' Visualisers for free renders is the
// abuse pattern that survives per-account rate limits. Because the
// homeowners table is per-merchant + salted-hashed, we can join by
// whatsapp_hash or fingerprint_id without exposing raw contact info
// across merchant boundaries.
//
// Returned rows list identities appearing on `minMerchants` or more
// merchants within the window. Populate the admin abuse dashboard
// from this; alert when a single identity crosses ~5 merchants in
// under 24h (rare in real life, common in scraping / farming).
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type CrossMerchantIdentity = {
  identityType: "whatsapp_hash" | "fingerprint_id";
  identityValue: string;
  merchantCount: number;
  merchantIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
};

export async function findCrossMerchantHomeowners(opts: {
  minMerchants?: number;
  sinceIso?: string;
} = {}): Promise<CrossMerchantIdentity[]> {
  const minMerchants = opts.minMerchants ?? 3;
  const sinceIso = opts.sinceIso ?? new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { data } = await supabaseAdmin
    .from("app_ai_visualiser_homeowners")
    .select("whatsapp_hash, fingerprint_id, merchant_id, created_at")
    .gte("created_at", sinceIso);

  const byWhatsapp = new Map<string, CrossMerchantIdentity>();
  const byFingerprint = new Map<string, CrossMerchantIdentity>();

  const add = (
    map: Map<string, CrossMerchantIdentity>,
    kind: "whatsapp_hash" | "fingerprint_id",
    value: string,
    merchantId: string,
    createdAt: string
  ) => {
    let row = map.get(value);
    if (!row) {
      row = {
        identityType: kind,
        identityValue: value,
        merchantCount: 0,
        merchantIds: [],
        firstSeenAt: createdAt,
        lastSeenAt: createdAt
      };
      map.set(value, row);
    }
    if (!row.merchantIds.includes(merchantId)) {
      row.merchantIds.push(merchantId);
      row.merchantCount = row.merchantIds.length;
    }
    if (createdAt < row.firstSeenAt) row.firstSeenAt = createdAt;
    if (createdAt > row.lastSeenAt) row.lastSeenAt = createdAt;
  };

  for (const row of data || []) {
    if (row.whatsapp_hash) {
      add(byWhatsapp, "whatsapp_hash", row.whatsapp_hash, row.merchant_id, row.created_at);
    }
    if (row.fingerprint_id) {
      add(byFingerprint, "fingerprint_id", row.fingerprint_id, row.merchant_id, row.created_at);
    }
  }

  const flagged: CrossMerchantIdentity[] = [];
  for (const row of byWhatsapp.values()) {
    if (row.merchantCount >= minMerchants) flagged.push(row);
  }
  for (const row of byFingerprint.values()) {
    if (row.merchantCount >= minMerchants) flagged.push(row);
  }
  flagged.sort((a, b) => b.merchantCount - a.merchantCount);
  return flagged;
}
