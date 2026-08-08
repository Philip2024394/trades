"use client";

// NEX Comms Centre · Social · merchant landing page.
//
// This page is what a normal tradesperson sees when they open the
// "Social Posting" entry from the Nex side drawer. It communicates
// what Social Posting does in about ten seconds, offers an obvious
// "Get my first post live" action, and hides every engineering
// concept from the merchant.
//
// The existing SocialCentrePanel is still available for advanced
// users via "Open Social Centre" — but only after the merchant has
// provisioned a Social tenant (so it never demands a UUID).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Rocket, ShieldCheck, Sparkles, Clock, Layers, Wrench } from "lucide-react";
import { SocialCentrePanel } from "@/components/nex-app/nex-brain/SocialCentrePanel";
import { SocialFirstPostWizard } from "@/components/nex-app/nex-brain/SocialFirstPostWizard";

type View = "landing" | "wizard" | "workbench";

type MeResponse = {
  ok: boolean;
  user?: { display_name: string; email: string };
  tenant?: { tenant_id: string; display_name: string; status: string } | null;
  next_step?: string;
  error?: string;
};

const T = {
  bg: "#0b0f14", panel: "#12161c", panelHi: "#1a2028", border: "#232b36",
  text: "#e5e9ef", textDim: "#8892a0", textFade: "#5c6572",
  accent: "#4dd0a0", info: "#5aa6f0",
};

const VALUE_BULLETS: Array<{ icon: React.ComponentType<{ className?: string }>; title: string; body: string }> = [
  { icon: Sparkles,     title: "Posts written for your trade",     body: "Tell Nex one line about your business. Nex writes a professional post you can publish in seconds." },
  { icon: ShieldCheck,  title: "Safety-checked before it goes out", body: "Every post is validated for factual claims, tone, forbidden terms and platform rules before it leaves your account." },
  { icon: Clock,        title: "Live in about a minute",             body: "From click to queued post is a few taps. Nex handles the writing, checking, formatting and publishing." },
  { icon: Layers,       title: "One place for every platform",       body: "Facebook · Instagram · LinkedIn · TikTok · Google Business Profile. Connect once, post everywhere." },
];

export default function CommsSocialPage() {
  const [view, setView] = useState<View>("landing");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadingMe, setLoadingMe] = useState<boolean>(true);
  const [resolvedTenantId, setResolvedTenantId] = useState<string>("");

  const loadMe = useCallback(async () => {
    setLoadingMe(true);
    try {
      const r = await fetch("/api/nex/comms-social/me", { cache: "no-store" });
      const d = await r.json() as MeResponse;
      setMe(d);
      if (d.ok && d.tenant?.tenant_id) setResolvedTenantId(d.tenant.tenant_id);
    } finally {
      setLoadingMe(false);
    }
  }, []);

  useEffect(() => { void loadMe(); }, [loadMe]);

  return (
    <div className="min-h-screen p-4 pt-16 sm:p-8 sm:pt-16" style={{ background: T.bg }}>
      <div className="mx-auto max-w-[1100px]">
        {view === "landing" && (
          <Landing
            loadingMe={loadingMe}
            me={me}
            onStart={() => setView("wizard")}
            onOpenWorkbench={() => setView("workbench")}
          />
        )}

        {view === "wizard" && (
          <div className="space-y-4">
            <Breadcrumb onBack={() => setView("landing")} label="Back to Social Posting" />
            <SocialFirstPostWizard
              onOpenWorkbench={me?.tenant ? () => setView("workbench") : undefined}
              onDone={() => void loadMe()}
            />
          </div>
        )}

        {view === "workbench" && (
          <div className="space-y-4">
            <Breadcrumb onBack={() => setView("landing")} label="Back to Social Posting" />
            <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
              <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Advanced · Social Centre</div>
              <div className="text-[12px] mt-1" style={{ color: T.textDim }}>
                Full operator surface. Only visit if you want fine-grained control over sources, templates, schedules, categories, analytics and pause.
              </div>
            </div>
            {resolvedTenantId ? (
              <SocialCentrePanel tenantId={resolvedTenantId} actor="merchant" />
            ) : (
              <div className="rounded-md border p-4 text-[12.5px]" style={{ background: T.panel, borderColor: T.border, color: T.textDim }}>
                Set up Social Posting first — the workbench is only available once your tenant is provisioned.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Landing({
  loadingMe, me, onStart, onOpenWorkbench,
}: {
  loadingMe: boolean;
  me: MeResponse | null;
  onStart: () => void;
  onOpenWorkbench: () => void;
}) {
  const signedIn      = !!me?.ok;
  const hasTenant     = !!me?.tenant;
  const authNeeded    = !signedIn && me?.next_step === "sign_in";
  const primaryLabel  = hasTenant ? "Create your next post" : "Get my first post live";

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border p-8 sm:p-12" style={{ background: T.panel, borderColor: T.border }}>
        <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: T.accent }}>
          Social Posting · powered by Nex
        </div>
        <h1 className="mt-3 text-[36px] sm:text-[44px] font-black leading-[1.05]" style={{ color: T.text }}>
          Get your business seen.
        </h1>
        <p className="mt-4 max-w-[720px] text-[16px] leading-relaxed" style={{ color: T.textDim }}>
          Create professional social posts for your trade in minutes. Nex writes them, safety-checks them and publishes them to your Facebook, Instagram, LinkedIn, TikTok or Google Business Profile.
        </p>
        <p className="mt-2 text-[14px] italic" style={{ color: T.textFade }}>
          Your first post can be live in about a minute.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {loadingMe ? (
            <div className="text-[12px]" style={{ color: T.textFade }}>Loading…</div>
          ) : authNeeded ? (
            <a href="/sign-in" className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-[14px] font-bold"
              style={{ background: T.accent, color: T.bg }}>
              <Rocket className="h-4 w-4" />
              Sign in to get started
            </a>
          ) : (
            <button type="button" onClick={onStart}
              className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-[14px] font-bold"
              style={{ background: T.accent, color: T.bg }}>
              <Rocket className="h-4 w-4" />
              {primaryLabel}
            </button>
          )}
          <Link href="/trade-off/pricing" className="inline-flex items-center rounded-md border px-5 py-3 text-[14px] font-semibold"
            style={{ borderColor: T.border, color: T.text }}>
            See pricing / Upgrade
          </Link>
        </div>
        <div className="mt-4 text-[11px]" style={{ color: T.textFade }}>
          Safety-checked · Rights-gated · You remain in control · Revoke access any time
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {VALUE_BULLETS.map((v) => (
          <div key={v.title} className="rounded-lg border p-5" style={{ background: T.panel, borderColor: T.border }}>
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full" style={{ background: T.panelHi, color: T.accent }}>
                <v.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[15px] font-bold" style={{ color: T.text }}>{v.title}</div>
                <div className="mt-1 text-[13px] leading-relaxed" style={{ color: T.textDim }}>{v.body}</div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border p-6" style={{ background: T.panel, borderColor: T.border }}>
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full" style={{ background: T.panelHi, color: T.info }}>
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-bold" style={{ color: T.text }}>How it works</div>
            <ol className="mt-2 text-[13px] leading-relaxed space-y-1" style={{ color: T.textDim }}>
              <li>1 · Choose where to post — Facebook, Instagram, LinkedIn, TikTok or Google Business Profile.</li>
              <li>2 · Connect your account — official platform sign-in, revocable any time.</li>
              <li>3 · Tell Nex about your business in one sentence.</li>
              <li>4 · Approve the post Nex writes for you — then hit publish.</li>
            </ol>
          </div>
        </div>
      </section>

      {hasTenant && (
        <section className="rounded-lg border p-5" style={{ background: T.panel, borderColor: T.border }}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full" style={{ background: T.panelHi, color: T.textDim }}>
              <Wrench className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-bold" style={{ color: T.text }}>Advanced controls</div>
              <div className="text-[12px]" style={{ color: T.textFade }}>Scheduling · categories · brand voice · templates · analytics · pause.</div>
            </div>
            <button type="button" onClick={onOpenWorkbench}
              className="rounded-md border px-4 py-2 text-[12.5px] font-semibold" style={{ borderColor: T.border, color: T.text }}>
              Open Social Centre
            </button>
          </div>
        </section>
      )}

      <footer className="pt-2 pb-6 text-[11px]" style={{ color: T.textFade }}>
        Every post you publish through Nex is safety-checked, rights-verified and audited.
        Nex never sees your platform passwords — you sign in with the platform's own login and can revoke Nex any time.
      </footer>
    </div>
  );
}

function Breadcrumb({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button type="button" onClick={onBack}
      className="inline-flex items-center gap-1 text-[12px]" style={{ color: T.textDim }}>
      ← {label}
    </button>
  );
}
