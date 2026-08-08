// NEX Comms Centre · Social · ROI reader.
//
// Charter §S-XI: Business ROI via the EXISTING Attribution
// (nex.attributions + nex.conversion_events) · no parallel attribution.
// Merchant-facing ROI language MUST include the attribution model
// and window explicitly · never "Social generated £X".

import { withClient } from "@/lib/nex/db";

export interface SocialRoiSummary {
  model:              "first_touch" | "last_touch" | "linear";
  window_days:        number;
  attributed_currency: string;
  attributed_value:   number;
  conversions:        number;                    // # conversions touched by social
  contacts:           number;                    // # distinct contacts
  by_platform:        Array<{ platform: string; conversions: number; attributed_value: number }>;
  language_hint:      string;                    // the phrase the UI should render
  computed_at:        string;
}

export interface SocialRoiInput {
  tenant_id:   string;                            // reserved · attributions currently uses conversion_events.contact_id · Phase 8.1 will scope by tenant
  model?:      "first_touch" | "last_touch" | "linear";
  window_days?: number;                           // default 30 · 90 for long-cycle trades (kitchens/staircases/etc.)
}

export async function computeSocialRoi(input: SocialRoiInput): Promise<SocialRoiSummary> {
  const model = input.model ?? "last_touch";
  const window_days = input.window_days ?? 30;

  const rows = await withClient(async (c) => {
    // Join attributions with the source analytics_event that generated
    // the touchpoint. Only pick attributions whose source event's
    // provider begins with 'social:'. Sum attributed_value + count
    // conversions.
    //
    // Note · tenant scoping deferred to Phase 8.1 when analytics_events
    // gains a tenant_id column · charter S-I RLS is currently email/comms-scoped.
    const r = await c.query(
      `SELECT a.currency,
              a.attributed_value,
              a.conversion_id,
              a.contact_id,
              ae.provider
         FROM nex.attributions a
         LEFT JOIN nex.analytics_events ae ON ae.event_id = a.source_event_id
        WHERE a.model = $1
          AND ae.provider LIKE 'social:%'
          AND a.computed_at >= NOW() - ($2 || ' days')::interval`,
      [model, String(window_days)]);
    return r.rows;
  });

  const list = rows ?? [];
  const conversions = new Set<string>();
  const contacts    = new Set<string>();
  let total = 0;
  let currency = "GBP";
  const byPlat: Map<string, { conversions: Set<string>; value: number }> = new Map();

  for (const r of list) {
    total += Number(r.attributed_value ?? 0);
    if (r.currency) currency = String(r.currency);
    if (r.conversion_id) conversions.add(String(r.conversion_id));
    if (r.contact_id) contacts.add(String(r.contact_id));
    const p = String(r.provider ?? "social:unknown").replace(/^social:/, "");
    if (!byPlat.has(p)) byPlat.set(p, { conversions: new Set(), value: 0 });
    const b = byPlat.get(p)!;
    if (r.conversion_id) b.conversions.add(String(r.conversion_id));
    b.value += Number(r.attributed_value ?? 0);
  }

  const by_platform = Array.from(byPlat.entries())
    .map(([platform, b]) => ({ platform, conversions: b.conversions.size, attributed_value: b.value }))
    .sort((a, b) => b.attributed_value - a.attributed_value);

  return {
    model,
    window_days,
    attributed_currency: currency,
    attributed_value: total,
    conversions: conversions.size,
    contacts: contacts.size,
    by_platform,
    // Charter S-XI language discipline · never "Social generated £X".
    language_hint: `£${total.toLocaleString()} of conversions had a Social touchpoint in the attribution window (${model} · ${window_days}d)`,
    computed_at: new Date().toISOString(),
  };
}
