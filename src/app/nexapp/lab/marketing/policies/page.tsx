"use client";

import { useCallback, useEffect, useState } from "react";
import { FounderShell } from "@/components/nex-app/founder-shell/FounderShell";

type Policy = {
  policy_id: string; slug: string; subsystem: string; agent_class: string;
  action_kind: string; action_level: number; conditions: Record<string, unknown>;
  max_actions_per_hour: number | null; max_actions_per_day: number | null; max_actions_total: number | null;
  active: boolean; expires_at: string | null; revoked_at: string | null;
  action_count: string | number; last_action_at: string | null;
};

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Form state
  const [slug, setSlug] = useState("marketing-indonesia-hotels-invite");
  const [displayName, setDisplayName] = useState("Indonesia hotels · invite policy");
  const [description, setDescription] = useState("NEX may send accommodation-invite emails to Indonesian hotels discovered via Lab crawl.");
  const [country, setCountry] = useState("ID");
  const [category, setCategory] = useState("accommodation");
  const [qualityMin, setQualityMin] = useState("0.5");
  const [perHour, setPerHour] = useState("50");
  const [perDay, setPerDay] = useState("200");
  const [total, setTotal] = useState("2000");
  const [businessHoursOnly, setBusinessHoursOnly] = useState(true);
  const [expiresDays, setExpiresDays] = useState("90");

  const load = useCallback(async () => {
    const r = await fetch("/api/nex/marketing/policies", { cache: "no-store" }).then((x) => x.json());
    if (Array.isArray(r.policies)) setPolicies(r.policies);
  }, []);
  useEffect(() => { load(); }, [load]);

  const authorize = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const conditions: Record<string, unknown> = {
        segment_filter: { country, category_group: category },
        quality_score_min: Number(qualityMin),
        consent_required: "discovered_or_stronger",
        country_whitelist: [country],
      };
      if (businessHoursOnly) conditions.business_hours_only = true;

      const signBody = {
        slug, subsystem: "marketing_email", agent_class: "marketing_sender",
        action_kind: "send_email", action_level: 3, conditions,
        authorized_by_user_id: "founder",
      };
      const signR = await fetch("/api/nex/marketing/policies/sign", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(signBody),
      }).then((x) => x.json());
      if (!signR.signature_hmac) throw new Error(signR.error ?? "sign_failed");

      const expires = expiresDays ? new Date(Date.now() + Number(expiresDays) * 24 * 3600_000).toISOString() : null;
      const r = await fetch("/api/nex/marketing/policies", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...signBody, display_name: displayName, description,
          max_actions_per_hour: Number(perHour), max_actions_per_day: Number(perDay), max_actions_total: Number(total),
          expires_at: expires,
          authorized_at: signR.authorized_at, signature_hmac: signR.signature_hmac,
        }),
      }).then((x) => x.json());
      if (!r.ok) throw new Error(r.error ?? "authorize_failed");
      setMsg(`Authorized · policy_id ${String(r.policy_id).slice(0, 8)}`);
      await load();
    } catch (e) { setErr(String(e).slice(0, 200)); }
    finally { setBusy(false); }
  };

  const revoke = async (slug: string) => {
    if (!confirm(`Revoke policy "${slug}"? All autonomous actions under it stop immediately.`)) return;
    const r = await fetch(`/api/nex/marketing/policies/${encodeURIComponent(slug)}/revoke`, { method: "POST" }).then((x) => x.json());
    if (r.ok) { setMsg(`Revoked ${slug}`); await load(); }
    else setErr(r.error ?? "revoke_failed");
  };

  return (
    <FounderShell title="Authorization Policies"
      subtitle="Founder signs a POLICY once. NEX operates autonomously under it until rate caps are reached, it expires, or you revoke. Not per-record signing.">
      <div className="max-w-[1100px]">

        {/* Active policies */}
        <section className="mt-6">
          <h2 className="mb-3 text-sm uppercase tracking-wider text-neutral-400">Active policies</h2>
          <div className="rounded-lg border border-neutral-800">
            {policies.length === 0 && (
              <div className="p-6 text-center text-sm text-neutral-500">
                No active policies. NEX cannot send email until you authorize one below.
              </div>
            )}
            {policies.map((p) => (
              <div key={p.policy_id} className="border-b border-neutral-900 p-4 last:border-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-sm text-neutral-200">{p.slug}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {p.subsystem} · {p.agent_class} · {p.action_kind} · L{p.action_level}
                    </div>
                    <div className="mt-2 text-xs text-neutral-400">
                      Rate: {p.max_actions_per_hour ?? "∞"}/hr · {p.max_actions_per_day ?? "∞"}/day · {p.max_actions_total ?? "∞"} total
                      · used {String(p.action_count)}
                    </div>
                    {p.last_action_at && (
                      <div className="text-xs text-neutral-500">Last action: {new Date(p.last_action_at).toLocaleString()}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${p.active && !p.revoked_at ? "bg-emerald-500/20 text-emerald-300" : "bg-neutral-800 text-neutral-500"}`}>
                      {p.active && !p.revoked_at ? "ACTIVE" : "REVOKED"}
                    </span>
                    {p.active && !p.revoked_at && (
                      <button onClick={() => revoke(p.slug)} className="rounded border border-rose-500/40 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10">Revoke</button>
                    )}
                  </div>
                </div>
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-neutral-500">Conditions</summary>
                  <pre className="mt-2 rounded bg-neutral-900 p-2 text-neutral-300">{JSON.stringify(p.conditions, null, 2)}</pre>
                </details>
              </div>
            ))}
          </div>
        </section>

        {/* Authorize form */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm uppercase tracking-wider text-neutral-400">Authorize a new policy</h2>
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
            <Field label="Slug" value={slug} set={setSlug} />
            <Field label="Display name" value={displayName} set={setDisplayName} />
            <Field label="Country" value={country} set={setCountry} />
            <Field label="Category group" value={category} set={setCategory} />
            <Field label="Min quality score (0-1)" value={qualityMin} set={setQualityMin} />
            <Field label="Max per hour" value={perHour} set={setPerHour} />
            <Field label="Max per day" value={perDay} set={setPerDay} />
            <Field label="Lifetime cap" value={total} set={setTotal} />
            <Field label="Expires in (days)" value={expiresDays} set={setExpiresDays} />
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input type="checkbox" checked={businessHoursOnly} onChange={(e) => setBusinessHoursOnly(e.target.checked)} />
              Business hours only (08:00-20:00)
            </label>
            <div className="col-span-2">
              <label className="text-xs text-neutral-500">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-800 bg-neutral-950 p-2 text-sm text-neutral-200" rows={2} />
            </div>
            <div className="col-span-2 flex items-center justify-between">
              <div className="text-xs text-neutral-500">
                Signature is generated server-side using <code>NEX_LAB_PROMOTION_SECRET</code>. Founder auth via admin cookie / localhost.
              </div>
              <button onClick={authorize} disabled={busy}
                className="rounded bg-emerald-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                {busy ? "Authorizing…" : "Authorize policy · HMAC sign"}
              </button>
            </div>
            {err && <div className="col-span-2 text-xs text-rose-400">Error: {err}</div>}
            {msg && <div className="col-span-2 text-xs text-emerald-400">{msg}</div>}
          </div>
        </section>
      </div>
    </FounderShell>
  );
}

function Field({ label, value, set }: { label: string; value: string; set: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-neutral-500">{label}</label>
      <input value={value} onChange={(e) => set(e.target.value)}
        className="mt-1 w-full rounded border border-neutral-800 bg-neutral-950 p-2 text-sm text-neutral-200" />
    </div>
  );
}
