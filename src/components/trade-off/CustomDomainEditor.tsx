"use client";

// Custom Domain editor — single-page state machine driven off the
// listing's custom_domain_status. Four visible states:
//
//   A. empty       → "Connect your own domain" form.
//   B. pending     → DNS instructions + per-registrar tabs, plus the
//                    "I've added the records — check now" CTA.
//                    Auto-polls /status every 30s for up to 30 min.
//   C. live        → Green success card + Disconnect CTA.
//   D. failure     → Amber / red banner with the specific error +
//                    "Recheck" / "Show DNS records again" actions.
//
// Mobile-first. 375px-usable. 13px text floor. 44px tap targets.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  REGISTRAR_GUIDES,
  SUGGESTED_REGISTRARS,
  type RegistrarGuide
} from "@/lib/registrarGuides";

type Verification = {
  type: string;
  domain: string;
  value: string;
  reason?: string;
};

type Status =
  | "pending"
  | "dns_pending"
  | "verifying"
  | "live"
  | "ssl_failed"
  | "dns_lost"
  | "expired"
  | "disconnected"
  | "blocked"
  | null;

const POLL_INTERVAL_MS = 30_000;
const POLL_MAX_MS = 30 * 60_000;

const VERCEL_APEX_A_RECORD = "76.76.21.21";
const VERCEL_WWW_CNAME = "cname.vercel-dns.com";

export function CustomDomainEditor({
  slug,
  editToken,
  initialDomain,
  initialStatus,
  initialVerification,
  initialLastError,
  isPaidTier,
  upgradeHref,
  vercelConfigured
}: {
  slug: string;
  editToken: string;
  initialDomain: string | null;
  initialStatus: Status;
  initialVerification: Verification[];
  initialLastError: string | null;
  isPaidTier: boolean;
  upgradeHref: string;
  vercelConfigured: boolean;
}) {
  const [domain, setDomain] = useState<string | null>(initialDomain);
  const [status, setStatus] = useState<Status>(initialStatus);
  const [verification, setVerification] = useState<Verification[]>(
    initialVerification
  );
  const [lastError, setLastError] = useState<string | null>(initialLastError);
  const [submitting, setSubmitting] = useState(false);
  const [input, setInput] = useState("");
  const [activeGuide, setActiveGuide] = useState<string>(
    REGISTRAR_GUIDES[0]?.id ?? "123-reg"
  );
  const [pollStartedAt, setPollStartedAt] = useState<number | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPending = status === "dns_pending" || status === "verifying";
  const isLive = status === "live";
  const isFailure =
    status === "ssl_failed" ||
    status === "dns_lost" ||
    status === "expired" ||
    status === "blocked";
  const isEmpty = !domain || status === "disconnected" || status === null;

  // Background polling while DNS verification is in-flight.
  useEffect(() => {
    if (!isPending) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }
    if (pollStartedAt === null) setPollStartedAt(Date.now());
    pollTimerRef.current = setInterval(() => {
      void pollStatus();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending]);

  async function pollStatus() {
    try {
      const res = await fetch(
        `/api/trade-off/custom-domain/status?slug=${encodeURIComponent(
          slug
        )}&token=${encodeURIComponent(editToken)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (json.ok) {
        setStatus(json.status as Status);
        setDomain(json.domain ?? null);
        setVerification(Array.isArray(json.verification) ? json.verification : []);
        setLastError(json.last_error ?? null);
      }
    } catch {
      // Network hiccups during the 30-min poll are common on mobile;
      // we silently retry next tick.
    }
  }

  async function handleAttach(e: React.FormEvent) {
    e.preventDefault();
    setLastError(null);
    if (!input.trim()) {
      setLastError("Type a domain first.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/trade-off/custom-domain/attach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          domain: input.trim()
        })
      });
      const json = await res.json();
      if (!json.ok) {
        setLastError(json.error ?? "Couldn't connect that domain.");
      } else {
        setDomain(json.domain);
        setStatus(json.status);
        setVerification(json.verification ?? []);
        setInput("");
      }
    } catch {
      setLastError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify() {
    setSubmitting(true);
    setLastError(null);
    try {
      const res = await fetch("/api/trade-off/custom-domain/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, edit_token: editToken })
      });
      const json = await res.json();
      if (!json.ok) {
        setLastError(json.error ?? "Couldn't verify yet.");
      } else {
        setStatus(json.status as Status);
        setVerification(Array.isArray(json.verification) ? json.verification : []);
      }
    } catch {
      setLastError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisconnect() {
    if (
      !window.confirm(
        `Disconnect ${domain}? Your profile will go back to xratedtrade.com/${slug}.`
      )
    ) {
      return;
    }
    setSubmitting(true);
    setLastError(null);
    try {
      const res = await fetch("/api/trade-off/custom-domain/disconnect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, edit_token: editToken })
      });
      const json = await res.json();
      if (!json.ok) {
        setLastError(json.error ?? "Couldn't disconnect.");
      } else {
        setDomain(null);
        setStatus("disconnected");
        setVerification([]);
      }
    } catch {
      setLastError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Show paywall + disabled UI for non-paid tiers.
  if (!isPaidTier) {
    return (
      <section className="mx-auto max-w-3xl px-4 pb-12">
        <Card>
          <H>Custom Domain</H>
          <P>
            Point your own domain (e.g. <code>yourtrade.co.uk</code>) at your
            Xrated profile so the URL on your van and business cards stays
            yours. Free SSL — we handle the certificate.
          </P>
          <P className="mt-3 text-brand-muted">
            First 30 days free, then £5/mo. Available on paid tiers.
          </P>
          <Link
            href={upgradeHref}
            className="mt-4 inline-flex h-11 items-center rounded-full bg-brand-accent px-4 text-[13px] font-bold text-black transition hover:opacity-90"
          >
            Upgrade to unlock →
          </Link>
        </Card>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 pb-12">
      {!vercelConfigured && (
        <Card className="mb-4 border-amber-500/40 bg-amber-500/10">
          <p className="text-[13px] font-bold text-amber-200">
            Custom Domain isn&rsquo;t fully wired in this environment.
          </p>
          <p className="mt-2 text-[13px] text-amber-100/80">
            VERCEL_API_TOKEN is missing — you can preview the form but
            connecting a domain will fail. Ask Hammerex admin to add the env
            var.
          </p>
        </Card>
      )}

      {/* ── A. Empty state ───────────────────────────────────────────── */}
      {isEmpty && (
        <Card>
          <H>Connect your own domain</H>
          <P>
            Type the domain you already own. We&rsquo;ll show you the two DNS
            records to add at your registrar — usually live in 5-30 minutes.
          </P>
          <form onSubmit={handleAttach} className="mt-4 space-y-3">
            <label className="block">
              <span className="text-[13px] font-bold text-brand-muted">
                Your domain
              </span>
              <input
                type="text"
                inputMode="url"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="joeplumberleeds.co.uk"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="mt-1 block h-11 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-[15px] text-brand-text outline-none transition focus:border-brand-accent"
                required
              />
            </label>
            {lastError && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-300">
                {lastError}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center rounded-full bg-brand-accent px-5 text-[13px] font-bold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Connecting…" : "Connect domain"}
            </button>
          </form>
          <div className="mt-6 rounded-2xl border border-brand-line bg-brand-bg p-4">
            <p className="text-[13px] font-bold text-brand-text">
              Don&rsquo;t own a domain yet?
            </p>
            <p className="mt-1 text-[13px] text-brand-muted">
              We don&rsquo;t sell domains — buy one direct from a trusted
              registrar.
            </p>
            <ul className="mt-3 grid gap-2">
              {SUGGESTED_REGISTRARS.map((r) => (
                <li key={r.name}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-surface px-3 text-[13px] font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
                  >
                    {r.name}
                    <span className="ml-2 text-brand-muted">— {r.note}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {/* ── B. Pending state ─────────────────────────────────────────── */}
      {isPending && domain && (
        <Card>
          <H>
            Add these records to {domain}
          </H>
          <P>
            Open your domain registrar&rsquo;s DNS panel and add the two
            records below. Usually live in 5-30 minutes — we&rsquo;ll re-check
            every 30 seconds.
          </P>

          <DnsRecordsTable
            apex={domain}
            verification={verification}
          />

          <div className="mt-6">
            <p className="text-[13px] font-bold text-brand-muted">
              Step-by-step for your registrar
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {REGISTRAR_GUIDES.map((g) => (
                <button
                  type="button"
                  key={g.id}
                  onClick={() => setActiveGuide(g.id)}
                  className={`inline-flex h-11 items-center rounded-full border px-3 text-[13px] font-bold transition ${
                    activeGuide === g.id
                      ? "border-brand-accent bg-brand-accent text-black"
                      : "border-brand-line bg-brand-surface text-brand-text hover:border-brand-accent"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
            <GuideSteps
              guide={
                REGISTRAR_GUIDES.find((g) => g.id === activeGuide) ??
                REGISTRAR_GUIDES[0]
              }
            />
          </div>

          {lastError && (
            <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[13px] font-semibold text-amber-200">
              Last check: {lastError}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleVerify}
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center rounded-full bg-brand-accent px-5 text-[13px] font-bold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Checking…" : "I've added the records — check now"}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={submitting}
              className="inline-flex h-11 items-center rounded-full border border-brand-line bg-brand-surface px-4 text-[13px] font-bold text-brand-text transition hover:border-red-500 hover:text-red-300 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>

          {pollStartedAt && (
            <p className="mt-4 text-[13px] text-brand-muted">
              Auto-checking every 30 seconds. We&rsquo;ll email you when
              it&rsquo;s live (up to 30 minutes).
            </p>
          )}
        </Card>
      )}

      {/* ── C. Live state ────────────────────────────────────────────── */}
      {isLive && domain && (
        <Card className="border-emerald-500/40 bg-emerald-500/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
            Live
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-brand-text">
            {domain}
          </h2>
          <p className="mt-2 text-[13px] text-brand-muted">
            Your domain points at your Xrated profile. Customers visiting{" "}
            <code>{domain}</code> or <code>www.{domain}</code> land straight on
            your page.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>SSL active (Let&rsquo;s Encrypt)</Badge>
            <Badge>www → apex redirect on</Badge>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center rounded-full bg-brand-accent px-4 text-[13px] font-bold text-black transition hover:opacity-90"
            >
              Open {domain} →
            </a>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={submitting}
              className="inline-flex h-11 items-center rounded-full border border-brand-line bg-brand-surface px-4 text-[13px] font-bold text-brand-text transition hover:border-red-500 hover:text-red-300 disabled:opacity-50"
            >
              {submitting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        </Card>
      )}

      {/* ── D. Failure state ─────────────────────────────────────────── */}
      {isFailure && domain && (
        <Card className="border-red-500/40 bg-red-500/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-300">
            {labelForFailure(status)}
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-brand-text">
            {domain}
          </h2>
          <p className="mt-3 text-[13px] text-brand-muted">
            {messageForFailure(status, lastError)}
          </p>
          <div className="mt-4">
            <DnsRecordsTable apex={domain} verification={verification} />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleVerify}
              disabled={submitting}
              className="inline-flex h-11 items-center rounded-full bg-brand-accent px-4 text-[13px] font-bold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Re-checking…" : "Re-check now"}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={submitting}
              className="inline-flex h-11 items-center rounded-full border border-brand-line bg-brand-surface px-4 text-[13px] font-bold text-brand-text transition hover:border-red-500 hover:text-red-300 disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </Card>
      )}
    </section>
  );
}

function Card({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-brand-line bg-brand-surface p-5 sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-extrabold leading-tight text-brand-text sm:text-2xl">
      {children}
    </h2>
  );
}

function P({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`mt-3 text-[13px] text-brand-muted ${className}`}>{children}</p>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[13px] font-bold text-emerald-300">
      {children}
    </span>
  );
}

function DnsRecordsTable({
  apex,
  verification
}: {
  apex: string;
  verification: Verification[];
}) {
  // We always show the two canonical Vercel records. Any extra TXT
  // challenges Vercel asked for (rare but possible during SSL renewal)
  // append below.
  const extras = verification.filter(
    (v) =>
      v.type !== "A" &&
      v.type !== "CNAME" &&
      !(v.type === "A" && v.value === VERCEL_APEX_A_RECORD)
  );
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-brand-line">
      <table className="w-full text-left text-[13px]">
        <thead className="bg-brand-bg text-brand-muted">
          <tr>
            <th className="px-3 py-2 font-bold">Type</th>
            <th className="px-3 py-2 font-bold">Host</th>
            <th className="px-3 py-2 font-bold">Value</th>
          </tr>
        </thead>
        <tbody className="bg-brand-surface text-brand-text">
          <tr className="border-t border-brand-line">
            <td className="px-3 py-2 font-bold">A</td>
            <td className="px-3 py-2">@</td>
            <td className="px-3 py-2">
              <code>{VERCEL_APEX_A_RECORD}</code>
            </td>
          </tr>
          <tr className="border-t border-brand-line">
            <td className="px-3 py-2 font-bold">CNAME</td>
            <td className="px-3 py-2">www</td>
            <td className="px-3 py-2">
              <code>{VERCEL_WWW_CNAME}</code>
            </td>
          </tr>
          {extras.map((v, i) => (
            <tr key={`${v.type}-${i}`} className="border-t border-brand-line">
              <td className="px-3 py-2 font-bold">{v.type}</td>
              <td className="px-3 py-2">
                <code>{v.domain || apex}</code>
              </td>
              <td className="px-3 py-2">
                <code>{v.value}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GuideSteps({ guide }: { guide: RegistrarGuide | undefined }) {
  if (!guide) return null;
  return (
    <div className="mt-4 rounded-2xl border border-brand-line bg-brand-bg p-4">
      <ol className="list-decimal space-y-2 pl-5 text-[13px] text-brand-text">
        {guide.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <a
        href={guide.dnsPanelUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex h-11 items-center rounded-full border border-brand-line bg-brand-surface px-4 text-[13px] font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
      >
        Open {guide.name} →
      </a>
    </div>
  );
}

function labelForFailure(s: Status): string {
  switch (s) {
    case "ssl_failed":
      return "SSL failed";
    case "dns_lost":
      return "DNS lost";
    case "expired":
      return "Domain expired";
    case "blocked":
      return "Blocked";
    default:
      return "Problem";
  }
}

function messageForFailure(s: Status, lastError: string | null): string {
  switch (s) {
    case "ssl_failed":
      return (
        "We couldn't issue an SSL certificate. Make sure CAA records (if any) " +
        "allow Let's Encrypt and try again. " +
        (lastError ? `Last error: ${lastError}` : "")
      );
    case "dns_lost":
      return (
        "Your DNS records were correct but have changed. Add them back at " +
        "your registrar and press Re-check. " +
        (lastError ? `Last error: ${lastError}` : "")
      );
    case "expired":
      return "Your domain has expired at the registrar — renew it first.";
    case "blocked":
      return "This domain has been blocked. Contact Hammerex admin.";
    default:
      return lastError ?? "Re-check now to retry.";
  }
}
