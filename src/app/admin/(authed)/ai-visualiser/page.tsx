// /admin/ai-visualiser — provider config + lead firehose.
//
// The admin picks which provider is enabled (OpenAI Images, Flux 1.1
// Pro, Nano Banana, ...), pastes their API key, and hits Test. The
// key is stored in the credentials JSONB column and masked on read.

import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findCrossMerchantHomeowners } from "@/lib/ai-visualiser/abuseDetection";
import { ProviderConfigPanel } from "./ProviderConfigPanel";
import { AdminLeadsTable } from "./AdminLeadsTable";
import { AbuseWatchTable } from "./AbuseWatchTable";

export const dynamic = "force-dynamic";

type ProviderRow = {
  id: string;
  provider_id: string;
  display_name: string;
  model_id: string | null;
  enabled: boolean;
  cost_per_render_pence: number;
  last_tested_at: string | null;
  last_test_ok: boolean | null;
  last_test_error: string | null;
  has_key: boolean;
};

export default async function AdminAiVisualiserPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin/login?next=/admin/ai-visualiser");
  }

  const { data: providerRows } = await supabaseAdmin
    .from("ai_visualiser_provider_config")
    .select(
      "id, provider_id, display_name, model_id, enabled, cost_per_render_pence, last_tested_at, last_test_ok, last_test_error, credentials"
    )
    .order("provider_id");

  const providers: ProviderRow[] = (providerRows || []).map((r) => ({
    id: r.id,
    provider_id: r.provider_id,
    display_name: r.display_name,
    model_id: r.model_id,
    enabled: r.enabled,
    cost_per_render_pence: r.cost_per_render_pence,
    last_tested_at: r.last_tested_at,
    last_test_ok: r.last_test_ok,
    last_test_error: r.last_test_error,
    has_key: Boolean((r.credentials as { api_key?: string })?.api_key)
  }));

  const knownProviders = [
    { id: "openai-images", label: "OpenAI (gpt-image-1)", defaultModel: "gpt-image-1" },
    { id: "flux-1.1-pro", label: "Flux 1.1 Pro (Replicate)", defaultModel: "flux-1.1-pro" },
    { id: "nano-banana", label: "Nano Banana", defaultModel: "nano-banana" }
  ];

  const [{ data: recentLeads }, flaggedIdentities] = await Promise.all([
    supabaseAdmin
      .from("ai_visualiser_admin_leads")
      .select(
        "id, full_name, email, whatsapp_e164, home_phone, postcode, first_leaf_slug, render_count, source, merchant_id, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50),
    findCrossMerchantHomeowners({ minMerchants: 3 })
  ]);

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <header className="mb-6">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Admin
        </p>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">AI Visualiser</h1>
        <p className="mt-1 text-[14px] text-neutral-600">
          Configure the image-generation provider and monitor the full
          lead stream across every merchant on the platform.
        </p>
      </header>

      <ProviderConfigPanel
        providers={providers}
        knownProviders={knownProviders}
      />

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Cross-merchant abuse watch</h2>
        <p className="mt-1 text-[13px] text-neutral-600">
          One WhatsApp / fingerprint appearing on 3+ merchants in the
          last 30 days — a strong signal for farming.
        </p>
        <div className="mt-4">
          <AbuseWatchTable identities={flaggedIdentities} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Recent leads (all merchants)</h2>
        <p className="mt-1 text-[13px] text-neutral-600">
          Every homeowner who registered on any merchant's Visualiser.
          Shown newest first (last 50).
        </p>
        <div className="mt-4">
          <AdminLeadsTable leads={recentLeads || []} />
        </div>
      </section>
    </div>
  );
}
