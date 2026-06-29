// Affiliate dashboard — API tokens.
//
// Tokens are write-once: shown in full at creation, then permanently
// masked. The list view shows label, prefix, last-used date, and a
// Revoke button.
import { readAffiliateSessionServer } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ApiTokensClient } from "./ApiTokensClient";
import { PageExplainer } from "@/components/xrated/affiliate/PageExplainer";

export const dynamic = "force-dynamic";

type Token = {
  id: string;
  token: string;
  label: string | null;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

export default async function ApiTokensPage() {
  const session = await readAffiliateSessionServer();
  if (!session) return null;
  const id = session.affiliate_id;

  const { data } = await supabaseAdmin
    .from("hammerex_affiliate_api_tokens")
    .select("id, token, label, last_used_at, created_at, revoked_at")
    .eq("affiliate_id", id)
    .order("created_at", { ascending: false });
  const tokens = ((data ?? []) as Token[]).map((t) => ({
    id: t.id,
    label: t.label,
    prefix: t.token.slice(0, 8),
    last_used_at: t.last_used_at,
    created_at: t.created_at,
    revoked_at: t.revoked_at
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold sm:text-3xl">API tokens</h1>
        <p className="mt-1 text-[13px] text-brand-muted">
          Generate a token to pull your stats programmatically. Call{" "}
          <code className="text-brand-accent">/api/v1/affiliates/me</code> with
          the header{" "}
          <code className="text-brand-accent">Authorization: Bearer &lt;token&gt;</code>.
          Tokens are shown in full only once — copy on create.
        </p>
      </header>

      <PageExplainer
        title="Programmatic access to your stats"
        description="If you run a website, you can pull your live stats with code. Click Generate to create a token. Save it somewhere safe — we only show it once."
        steps={[
          "Click 'Generate new token'",
          "Label it (e.g. 'My website widget')",
          "Copy the token — it's only shown once",
          <>Use it with: <code className="font-mono">GET /api/v1/affiliates/me + Authorization: Bearer &lbrace;token&rbrace;</code></>
        ]}
      />

      <section className="rounded-xl border border-brand-line bg-brand-surface p-4">
        <p className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">
          Example request
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-brand-bg p-3 text-[13px] leading-relaxed text-brand-text">
          <code>{`curl https://xratedtrade.com/api/v1/affiliates/me \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE"`}</code>
        </pre>
        <p className="mt-2 text-[12px] text-neutral-500">
          The response returns your lifetime stats, current level and the
          last 30 days of click activity as JSON.
        </p>
      </section>

      <ApiTokensClient initial={tokens} />
    </div>
  );
}
