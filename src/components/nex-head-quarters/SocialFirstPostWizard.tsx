"use client";

// NEX Comms Centre · Social · First-Post Wizard.
//
// A merchant-friendly guided flow that takes a signed-in Nex user from
// zero to a live social post in a few clicks. This is Phase 10 · session-
// based · no UUIDs · no account_ids · no template selection · popup OAuth.
//
// All operations go through session-resolved endpoints (`/me`,
// `/provision`, `/oauth-for-me/*`, `/generate-for-me`, `/publish-now`)
// so nothing sensitive is passed through the UI. Adapters, providers
// and Predictive are never imported here.

import { useCallback, useEffect, useRef, useState } from "react";

const T = {
  bg: "#0b0f14", panel: "#12161c", panelHi: "#1a2028", border: "#232b36",
  text: "#e5e9ef", textDim: "#8892a0", textFade: "#5c6572",
  accent: "#4dd0a0", warning: "#f0b45a", danger: "#f0665a", info: "#5aa6f0",
};

type PlatformKey = "simulator" | "facebook" | "instagram" | "linkedin" | "tiktok" | "google_business";

const PLATFORM_LABELS: Record<PlatformKey, string> = {
  simulator:       "Test simulator",
  facebook:        "Facebook Page",
  instagram:       "Instagram Business",
  linkedin:        "LinkedIn Page",
  tiktok:          "TikTok",
  google_business: "Google Business Profile",
};

const PLATFORM_TAGLINES: Record<PlatformKey, string> = {
  simulator:       "Safe practice mode · no real post",
  facebook:        "Reach your Facebook Page followers",
  instagram:       "Post to your Business Instagram",
  linkedin:        "Share to your LinkedIn Page",
  tiktok:          "Upload short-form video content",
  google_business: "Fresh updates on your Google listing",
};

type Step = 0 | 1 | 2 | 3 | 4 | 5;

type MeResponse = {
  ok: boolean;
  user?: { display_name: string; email: string };
  tenant?: {
    display_name: string;
    status: string;
    connected_accounts: Array<{
      account_id: string; platform: string; display_name: string | null; status: string;
    }>;
    has_active_template: boolean;
    merchant_slug?: string | null;
  } | null;
  tier?: string;
  has_social_access?: boolean;
  next_step?: string;
  error?: string;
};

export function SocialFirstPostWizard({ onOpenWorkbench, onDone }: {
  onOpenWorkbench?: () => void;
  onDone?: () => void;
}) {
  const [step, setStep] = useState<Step>(0);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadingMe, setLoadingMe] = useState<boolean>(true);
  const [fatalError, setFatalError] = useState<string>("");

  const [businessName, setBusinessName] = useState<string>("");
  const [provisioning, setProvisioning] = useState<boolean>(false);

  const [platform, setPlatform] = useState<PlatformKey>("simulator");
  const [connecting, setConnecting] = useState<boolean>(false);
  const [connectError, setConnectError] = useState<string>("");
  const [connectedPlatforms, setConnectedPlatforms] = useState<Set<string>>(new Set());

  const [businessLine, setBusinessLine] = useState<string>("");
  const [generating, setGenerating] = useState<boolean>(false);
  const [draftId, setDraftId] = useState<string>("");
  const [draftCaption, setDraftCaption] = useState<string>("");
  const [draftHashtags, setDraftHashtags] = useState<string[]>([]);
  const [generateError, setGenerateError] = useState<string>("");

  const [publishing, setPublishing] = useState<boolean>(false);
  const [publishedAt, setPublishedAt] = useState<string>("");
  const [publishError, setPublishError] = useState<string>("");

  const popupRef = useRef<Window | null>(null);
  const originRef = useRef<string>("");

  const loadMe = useCallback(async () => {
    setLoadingMe(true); setFatalError("");
    try {
      const r = await fetch("/api/nex/comms-social/me", { cache: "no-store" });
      const d = await r.json() as MeResponse;
      setMe(d);
      if (!d.ok && d.next_step === "sign_in") {
        setFatalError("You need to sign in first.");
      } else if (d.tenant?.connected_accounts) {
        setConnectedPlatforms(new Set(
          d.tenant.connected_accounts
            .filter((a) => a.status === "connected")
            .map((a) => a.platform),
        ));
      }
      // Route to the right first step.
      if (d.ok && !d.tenant) {
        setBusinessName(d.user?.display_name ?? "");
        setStep(0); // provision needed
      } else if (d.ok && d.tenant) {
        setStep(1); // straight to platform picker
      }
    } catch (e) {
      setFatalError(`Could not load your Social setup. ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingMe(false);
    }
  }, []);

  useEffect(() => { void loadMe(); }, [loadMe]);

  // Popup postMessage listener for the OAuth return.
  useEffect(() => {
    originRef.current = typeof window !== "undefined" ? window.location.origin : "";
    function onMessage(ev: MessageEvent) {
      if (!ev.data || typeof ev.data !== "object") return;
      const d = ev.data as { source?: string; ok?: boolean; platform?: string; error?: string; account?: { display_name?: string } };
      if (d.source !== "nex-comms-social") return;
      if (ev.origin !== originRef.current) return;
      setConnecting(false);
      if (d.ok && d.platform) {
        setConnectedPlatforms((prev) => new Set(prev).add(d.platform!));
        setConnectError("");
        void loadMe(); // refresh accounts
      } else {
        setConnectError(humaniseConnectError(d.error));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [loadMe]);

  const provision = useCallback(async () => {
    if (businessName.trim().length < 2) return;
    setProvisioning(true);
    try {
      const r = await fetch("/api/nex/comms-social/provision", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ display_name: businessName.trim() }),
      });
      const d = await r.json() as { ok: boolean; error?: string };
      if (!d.ok) {
        setFatalError(humaniseProvisionError(d.error));
        return;
      }
      await loadMe();
      setStep(1);
    } catch (e) {
      setFatalError(`Setup failed. ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProvisioning(false);
    }
  }, [businessName, loadMe]);

  const connect = useCallback(async () => {
    setConnecting(true); setConnectError("");
    if (platform === "simulator") {
      // No real OAuth for simulator · treat as instantly connected.
      // But the wizard's publish path still needs a real connected
      // account. For simulator, tell the user to skip via the wizard.
      setConnecting(false);
      setConnectError("Simulator platform doesn't create real accounts. To try the full flow, pick a real platform.");
      return;
    }
    try {
      const redirect_uri = `${window.location.origin}/api/nex/comms-social/oauth-for-me/${platform}/callback`;
      const r = await fetch(`/api/nex/comms-social/oauth-for-me/${platform}/start`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ redirect_uri }),
      });
      const d = await r.json() as { ok: boolean; authorize_url?: string; error?: string };
      if (!d.ok || !d.authorize_url) {
        setConnecting(false);
        setConnectError(humaniseConnectError(d.error));
        return;
      }
      const w = window.open(d.authorize_url, "nex-social-oauth", "width=560,height=720,noopener=no,noreferrer=no");
      if (!w) {
        setConnecting(false);
        setConnectError("Your browser blocked the sign-in window. Allow pop-ups for this site and try again.");
        return;
      }
      popupRef.current = w;
    } catch (e) {
      setConnecting(false);
      setConnectError(`Could not start the sign-in. ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [platform]);

  const generate = useCallback(async () => {
    setGenerating(true); setGenerateError(""); setDraftId(""); setDraftCaption("");
    try {
      const r = await fetch(`/api/nex/comms-social/generate-for-me`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform:             platform === "simulator" ? "facebook" : platform,
          business_description: businessLine.trim(),
        }),
      });
      const d = await r.json() as {
        ok: boolean;
        draft?: { draft_id: string; caption: string; hashtags?: string[]; grounding_state: string; rejection_reasons?: Array<{ detail: string }> };
        error?: string;
      };
      if (!d.ok || !d.draft) {
        setGenerateError(humaniseGenerateError(d.error));
        return;
      }
      if (d.draft.grounding_state === "rejected") {
        const reasons = (d.draft.rejection_reasons ?? []).map((r) => r.detail).join(" · ");
        setGenerateError(`Nex could not safely publish that draft: ${reasons || "unspecified"}. Try describing your business with plain factual details — services, area, phone or website.`);
        return;
      }
      setDraftId(d.draft.draft_id);
      setDraftCaption(d.draft.caption);
      setDraftHashtags(d.draft.hashtags ?? []);
      setStep(4);
    } catch (e) {
      setGenerateError(`Draft failed. ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGenerating(false);
    }
  }, [platform, businessLine]);

  const publish = useCallback(async () => {
    if (!draftId) return;
    setPublishing(true); setPublishError("");
    try {
      const r = await fetch(`/api/nex/comms-social/publish-now`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draft_id: draftId,
          platform: platform === "simulator" ? "facebook" : platform,
        }),
      });
      const d = await r.json() as { ok: boolean; error?: string; detail?: string };
      if (!d.ok) {
        setPublishError(humanisePublishError(d.error));
        return;
      }
      setPublishedAt(new Date().toLocaleTimeString());
      setStep(5);
    } catch (e) {
      setPublishError(`Publish failed. ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPublishing(false);
    }
  }, [draftId, platform]);

  const canProceedDescribe = businessLine.trim().length >= 20;

  if (fatalError && !me?.ok) {
    return (
      <div className="rounded-lg border p-6" style={{ background: T.panel, borderColor: T.border, color: T.text }}>
        <div className="text-[15px] font-bold" style={{ color: T.warning }}>Sign in first</div>
        <div className="mt-2 text-[13px]" style={{ color: T.textDim }}>{fatalError}</div>
        <a href="/sign-in" className="mt-4 inline-block rounded-md px-4 py-2 text-[13px] font-bold" style={{ background: T.accent, color: T.bg }}>
          Sign in to continue
        </a>
      </div>
    );
  }

  if (loadingMe) {
    return (
      <div className="rounded-lg border p-6" style={{ background: T.panel, borderColor: T.border, color: T.textDim }}>
        Getting your Social setup ready…
      </div>
    );
  }

  // Tier gate · block the wizard for merchants who don't yet have the
  // Professional plan (or higher). Provisioning + accounts remain visible
  // so they can see what they're upgrading to.
  if (me?.ok && me.has_social_access === false) {
    return (
      <div className="rounded-lg border p-6 space-y-4" style={{ background: T.panel, borderColor: T.border }}>
        <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: T.warning }}>
          Upgrade required
        </div>
        <h2 className="text-[22px] font-black leading-tight" style={{ color: T.text }}>
          Nex Marketing is on the Professional plan.
        </h2>
        <p className="text-[13.5px] leading-relaxed" style={{ color: T.textDim }}>
          Upgrade to Professional and Nex will write, safety-check and publish social posts to your Facebook, Instagram, LinkedIn, TikTok and Google Business Profile — from one place, in about a minute per post.
        </p>
        <a href="/trade-off/pricing"
          className="inline-flex items-center rounded-md px-5 py-3 text-[14px] font-bold"
          style={{ background: T.accent, color: T.bg }}>
          See Professional pricing
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-lg border" style={{ background: T.panel, borderColor: T.border }}>
      <div className="border-b p-4" style={{ borderColor: T.border }}>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: T.accent }}>
            Get my first post live
          </span>
          <span className="text-[11px]" style={{ color: T.textFade }}>
            {step === 5 ? "Queued" : `Step ${step === 0 ? 1 : step}${step === 0 ? " of 5" : " of 4"}`}
          </span>
        </div>
        <div className="mt-3 flex gap-1">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-1 flex-1 rounded-full" style={{
              background: n <= (step === 5 ? 4 : Math.max(1, step)) ? T.accent : T.border,
            }} />
          ))}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Step 0 · one-time provisioning */}
        {step === 0 && me?.ok && !me.tenant && (
          <>
            <StepTitle n={1} title="What's your business called?" />
            <p className="text-[13px]" style={{ color: T.textDim }}>
              We'll use this name across the Nex platform. You can change it later in Settings.
            </p>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Oak Stairs Ltd"
              className="w-full rounded-md border px-3 py-2 text-[13px]"
              style={{ background: T.panelHi, borderColor: T.border, color: T.text }}
            />
            <div className="flex justify-end">
              <button type="button" onClick={provision} disabled={provisioning || businessName.trim().length < 2}
                className="rounded-md px-5 py-2 text-[13px] font-bold"
                style={{ background: T.accent, color: T.bg, opacity: provisioning || businessName.trim().length < 2 ? 0.5 : 1 }}>
                {provisioning ? "Setting up…" : "Continue"}
              </button>
            </div>
            {fatalError && (
              <div className="rounded-md border p-3 text-[11.5px]"
                style={{ background: "rgba(240,102,90,0.06)", borderColor: T.danger, color: T.danger }}>
                {fatalError}
              </div>
            )}
          </>
        )}

        {/* Step 1 · platform picker */}
        {step === 1 && (
          <>
            <StepTitle n={1} title="Where do you want to post?" />
            <p className="text-[13px]" style={{ color: T.textDim }}>
              Pick one to start. You can connect more platforms after your first post.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PLATFORM_LABELS) as PlatformKey[]).map((p) => {
                const connected = connectedPlatforms.has(p);
                const active = platform === p;
                return (
                  <button key={p} type="button" onClick={() => setPlatform(p)}
                    className="rounded-md border px-3 py-3 text-left"
                    style={{
                      background:  active ? T.info : T.panelHi,
                      borderColor: active ? T.info : T.border,
                      color:       active ? T.panel : T.text,
                    }}>
                    <div className="flex items-center gap-2">
                      <div className="text-[13px] font-semibold flex-1">{PLATFORM_LABELS[p]}</div>
                      {connected && (
                        <span className="text-[9px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5"
                          style={{ background: active ? T.panel : T.accent, color: active ? T.accent : T.bg }}>
                          Connected
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: active ? T.panel : T.textFade }}>
                      {PLATFORM_TAGLINES[p]}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => setStep(2)}
                className="rounded-md px-5 py-2 text-[13px] font-bold" style={{ background: T.accent, color: T.bg }}>
                Next
              </button>
            </div>
          </>
        )}

        {/* Step 2 · connect account */}
        {step === 2 && (
          <>
            <StepTitle n={2} title="Connect your account" />
            <p className="text-[13px]" style={{ color: T.textDim }}>
              We use the official {PLATFORM_LABELS[platform]} sign-in. Nex never sees your password and you can revoke access any time.
            </p>
            {connectedPlatforms.has(platform) ? (
              <div className="rounded-md border p-3 flex items-center gap-3" style={{ background: T.panelHi, borderColor: T.accent, color: T.text }}>
                <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-black" style={{ background: T.accent, color: T.bg }}>✓</span>
                <div className="text-[12.5px]">Your {PLATFORM_LABELS[platform]} is connected.</div>
              </div>
            ) : (
              <button type="button" onClick={connect} disabled={connecting}
                className="rounded-md px-5 py-2 text-[13px] font-bold"
                style={{ background: T.info, color: T.bg, opacity: connecting ? 0.55 : 1 }}>
                {connecting ? "Opening sign-in…" : `Connect ${PLATFORM_LABELS[platform]}`}
              </button>
            )}
            {connectError && (
              <div className="rounded-md border p-3 text-[11.5px]" style={{ background: "rgba(240,102,90,0.06)", borderColor: T.danger, color: T.danger }}>
                {connectError}
              </div>
            )}
            <div className="flex justify-between pt-2">
              <button type="button" onClick={() => setStep(1)} className="text-[11.5px]" style={{ color: T.textFade }}>← Back</button>
              <button type="button" onClick={() => setStep(3)}
                disabled={!connectedPlatforms.has(platform)}
                className="rounded-md px-5 py-2 text-[13px] font-bold"
                style={{ background: T.accent, color: T.bg, opacity: connectedPlatforms.has(platform) ? 1 : 0.5 }}>
                Next
              </button>
            </div>
          </>
        )}

        {/* Step 3 · describe business */}
        {step === 3 && (
          <>
            <StepTitle n={3} title="What do you want customers to know?" />
            <p className="text-[13px]" style={{ color: T.textDim }}>
              One sentence about your business. Nex will turn it into a professional, safety-checked post.
            </p>
            <textarea
              value={businessLine} onChange={(e) => setBusinessLine(e.target.value)}
              placeholder="We do bathrooms and kitchens across Nottingham. We specialise in full renovations."
              className="w-full min-h-[110px] rounded-md border px-3 py-2 text-[13px]"
              style={{ background: T.panelHi, borderColor: T.border, color: T.text }}
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: T.textFade }}>
                {businessLine.trim().length} / at least 20 characters
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(2)} className="text-[11.5px]" style={{ color: T.textFade }}>← Back</button>
                <button type="button" onClick={generate} disabled={!canProceedDescribe || generating}
                  className="rounded-md px-5 py-2 text-[13px] font-bold"
                  style={{ background: T.accent, color: T.bg, opacity: canProceedDescribe && !generating ? 1 : 0.5 }}>
                  {generating ? "Writing your post…" : "Generate my first post"}
                </button>
              </div>
            </div>
            {generateError && (
              <div className="rounded-md border p-3 text-[11.5px]" style={{ background: "rgba(240,102,90,0.06)", borderColor: T.danger, color: T.danger }}>
                {generateError}
              </div>
            )}
          </>
        )}

        {/* Step 4 · review + publish */}
        {step === 4 && (
          <>
            <StepTitle n={4} title="Your first post is ready" />
            <p className="text-[13px]" style={{ color: T.textDim }}>
              Preview below. When you're happy, hit Publish and Nex will send it to your {PLATFORM_LABELS[platform]}.
            </p>
            <div className="rounded-md border p-4 space-y-2" style={{ background: T.panelHi, borderColor: T.border, color: T.text }}>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: T.textFade }}>
                Preview · {PLATFORM_LABELS[platform]}
              </div>
              <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{draftCaption}</div>
              {draftHashtags.length > 0 && (
                <div className="text-[11.5px]" style={{ color: T.info }}>
                  {draftHashtags.map((h) => `#${h.replace(/^#/, "")}`).join("  ")}
                </div>
              )}
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <button type="button" onClick={() => { setDraftId(""); setDraftCaption(""); setStep(3); }}
                className="text-[11.5px]" style={{ color: T.textFade }}>← Change wording</button>
              <button type="button" onClick={publish} disabled={publishing}
                className="rounded-md px-5 py-2 text-[13px] font-bold"
                style={{ background: T.accent, color: T.bg, opacity: publishing ? 0.55 : 1 }}>
                {publishing ? "Publishing…" : "Publish now"}
              </button>
            </div>
            {publishError && (
              <div className="rounded-md border p-3 text-[11.5px]" style={{ background: "rgba(240,102,90,0.06)", borderColor: T.danger, color: T.danger }}>
                {publishError}
              </div>
            )}
          </>
        )}

        {/* Step 5 · queued */}
        {step === 5 && (
          <>
            <StepTitle n={4} title="Your post is queued" done />
            <p className="text-[13px]" style={{ color: T.text }}>
              Nex will publish it to your {PLATFORM_LABELS[platform]} on the next worker tick — normally within about a minute.
              Queued at {publishedAt}.
            </p>
            <div className="rounded-md border p-3" style={{ background: "rgba(77,208,160,0.08)", borderColor: T.accent, color: T.text }}>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: T.accent }}>Delivered</div>
              <div className="mt-1 whitespace-pre-wrap text-[13px]">{draftCaption}</div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" onClick={() => { setDraftId(""); setDraftCaption(""); setBusinessLine(""); setStep(1); onDone?.(); }}
                className="rounded-md px-4 py-2 text-[13px] font-bold" style={{ background: T.accent, color: T.bg }}>
                Post another
              </button>
              {onOpenWorkbench && (
                <button type="button" onClick={onOpenWorkbench}
                  className="rounded-md border px-4 py-2 text-[13px] font-semibold" style={{ borderColor: T.border, color: T.text }}>
                  Open Social Centre
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StepTitle({ n, title, done }: { n: number; title: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold"
        style={{ background: done ? T.accent : T.info, color: T.bg }}>{done ? "✓" : n}</span>
      <span className="text-[16px] font-bold" style={{ color: T.text }}>{title}</span>
    </div>
  );
}

// ── Humanised error copy ─────────────────────────────────────
function humaniseProvisionError(err?: string): string {
  if (!err) return "Something went wrong setting up your Social account.";
  if (err.includes("display_name")) return "Please enter a business name of at least two characters.";
  if (err.includes("no_active_session")) return "You need to be signed in to set up Social Posting.";
  return "Something went wrong setting up your Social account. Please try again in a moment.";
}
function humaniseConnectError(err?: string): string {
  if (!err) return "Sign-in didn't complete. Please try again.";
  if (err.startsWith("provider_denied")) return "You cancelled the sign-in on the provider. Try again when you're ready.";
  if (err === "state_not_found" || err === "state_expired") return "That sign-in attempt expired. Please try again.";
  if (err === "sign_in_required") return "You need to sign in to your Nex account first.";
  if (err === "no_tenant") return "Your Social account isn't set up yet. Go back a step and set it up.";
  if (err === "tier_locked") return "Nex Marketing is on the Professional plan. Upgrade to publish posts.";
  if (err.includes("Missing OAuth") || err.includes("app_id") || err.includes("app_secret"))
    return `Nex doesn't yet have permission from that platform. Nex operations will finish the setup shortly.`;
  return "Sign-in didn't complete. Please try again.";
}
function humaniseGenerateError(err?: string): string {
  if (!err) return "Nex couldn't draft your post just now.";
  if (err === "no_tenant") return "Please finish setting up your Social account first.";
  if (err === "no_active_template_found") return "Nex is still preparing your starter template. Refresh and try again.";
  if (err === "tier_locked") return "Nex Marketing is on the Professional plan. Upgrade to draft posts.";
  if (err.includes("min_source_refs") || err.includes("source")) return "Add a bit more detail about your business (services, area, phone).";
  return "Nex couldn't draft your post just now. Please try again in a moment.";
}
function humanisePublishError(err?: string): string {
  if (!err) return "Publishing didn't go through.";
  if (err === "no_connected_account_for_platform")
    return "There's no connected account on that platform yet. Go back and connect one first.";
  if (err === "draft_not_grounded")
    return "That draft didn't pass the safety check. Try changing the wording.";
  if (err === "tier_locked")
    return "Nex Marketing is on the Professional plan. Upgrade to publish posts.";
  return "Publishing didn't go through. Please try again.";
}
