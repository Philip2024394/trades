// Products event subscriptions.
//
// spec.updated → flag any merchant offer whose canonical was cited in
// the specification. The Products app doesn't have a "flag" table yet
// (v1); for now we cascade to a light-touch update on the affected
// canonical products so downstream apps re-read fresh data.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { register } from "../registry";

register({
  subscriberSlug: "products.on_spec_updated",
  eventType: "spec.updated",
  handler: async (event) => {
    const skus = (event.payload.product_skus as string[] | undefined) ?? [];
    if (skus.length === 0) return { ok: true };
    // Touch canonical rows referenced in the spec — bumps updated_at so
    // hydrators (AI Visualiser scope, Quote Workspace draft) re-fetch.
    await supabaseAdmin
      .from("os_products_canonical")
      .update({ updated_at: new Date().toISOString() })
      .in("id", skus);
    return { ok: true };
  }
});
