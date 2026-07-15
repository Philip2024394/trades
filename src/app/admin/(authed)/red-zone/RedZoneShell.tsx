"use client";

// Operational command centre. Every category the admin needs to
// triage in one place. Mock data first so the layout + section
// vocabulary are stable; real feeds slot in as the producers ship.

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  CreditCard,
  MessageSquare,
  Wrench,
  ShieldAlert,
  ThumbsUp,
  ThumbsDown,
  Bug,
  Globe,
  Database,
  Zap
} from "lucide-react";

type Severity = "critical" | "high" | "medium" | "low";

type ServiceStatus = "operational" | "degraded" | "down";

type ServiceTile = {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  status: ServiceStatus;
  detail: string;
  checkedAt: string;
};

// Initial state — instantly rendered on first paint. The client
// effect below re-polls every 30s from the live /api/health/*
// endpoints and replaces detail + status + checkedAt in place.
// Tiles that don't yet have a real endpoint (ImageKit CDN, WhatsApp
// wa.me deep-link reachability) stay hard-coded until we ship them.
const INITIAL_SERVICES: ServiceTile[] = [
  { id: "site",     label: "Site uptime",        icon: Globe,         status: "operational", detail: "Checking…",                       checkedAt: "just now" },
  { id: "stripe",   label: "Stripe · payments",  icon: CreditCard,    status: "operational", detail: "Checking…",                       checkedAt: "just now" },
  { id: "db",       label: "Supabase · DB",      icon: Database,      status: "operational", detail: "Checking…",                       checkedAt: "just now" },
  { id: "washers",  label: "Washer deduct API",  icon: Zap,           status: "operational", detail: "Checking…",                       checkedAt: "just now" },
  { id: "images",   label: "ImageKit · CDN",     icon: Globe,         status: "operational", detail: "No health endpoint yet — assumed OK", checkedAt: "n/a" },
  { id: "wa",       label: "WhatsApp handoff",   icon: MessageSquare, status: "operational", detail: "No health endpoint yet — assumed OK", checkedAt: "n/a" }
];

// Which service ID polls which route. Tiles not listed here stay
// static (as-of-now: ImageKit + WhatsApp — the /health endpoints for
// those ship in a later phase alongside their integrations).
const SERVICE_HEALTH_ROUTES: Record<string, string> = {
  site:    "/api/health/site",
  stripe:  "/api/health/stripe",
  db:      "/api/health/db",
  washers: "/api/health/washers"
};

function timeAgoShort(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

type Issue = {
  id: string;
  severity: Severity;
  category: "blocking" | "payment" | "washer" | "content" | "user";
  title: string;
  description: string;
  source: string;          // "Merchant · demo-mike-watson" / "Anonymous form" / etc.
  createdAt: string;
  actionLabel?: string;    // primary action button label
  actionHref?: string;     // deep link to the surface (or null for inline actions)
  detail?: string;         // optional extra body (e.g. spam reason from merchant)
};

// TODO(backend): each list is queried from a distinct producer:
//   - washer: hammerex_washer_spam_flags where status='pending'
//   - payment: stripe events with type in {charge.failed, dispute.created,
//     invoice.payment_failed} in the last 24h
//   - content: hammerex_content_reports where status='pending'
//   - user: hammerex_bug_reports where status='open'
//   - blocking: derived — any Sentry alert with tag=blocking, or the
//     site-health tiles above flipping to 'down'
const MOCK_ISSUES: Issue[] = [
  // ─── BLOCKING ──────────────────────────────────────
  {
    id: "b1",
    severity: "critical",
    category: "blocking",
    title: "ImageKit transforms serving stale variants",
    description: "3 merchant hero images returning cached crops rather than the latest edit. Reported by 2 merchants in the last hour.",
    source: "Merchant support tickets + CDN health tile",
    createdAt: "18m ago",
    actionLabel: "View affected merchants",
    actionHref: "/admin/support?filter=imagekit"
  },
  // ─── PAYMENT ───────────────────────────────────────
  {
    id: "p1",
    severity: "high",
    category: "payment",
    title: "Stripe webhook retried 4 times for invoice inv_1PQx…",
    description: "Merchant demo-nick-brown · Marketplace tier renewal payment failed. Retrying on standard Stripe schedule. Merchant will lose paid tier if final retry fails in 3d.",
    source: "Stripe webhook · payments-log",
    createdAt: "42m ago",
    actionLabel: "Open in Stripe",
    actionHref: "https://dashboard.stripe.com"
  },
  {
    id: "p2",
    severity: "medium",
    category: "payment",
    title: "Dispute opened on customer charge ch_1PXy…",
    description: "Customer disputed a Site bag washer pack purchase (£14.99). Merchant is demo-mike-watson.",
    source: "Stripe dispute webhook",
    createdAt: "3h ago",
    actionLabel: "Open in Stripe",
    actionHref: "https://dashboard.stripe.com"
  },
  // ─── WASHER REFUND FLAGS ───────────────────────────
  {
    id: "w1",
    severity: "high",
    category: "washer",
    title: "Refund request — Mike Watson · spam-flagged lead",
    description: "Guest name: 'Test Test' · WhatsApp: +447700000000. Merchant flag reason: contact form filled with dummy data; no follow-up on WhatsApp.",
    source: "Merchant · demo-mike-watson-drywall-manchester",
    detail: "Original comment: \"Test test test, just seeing if this works.\"",
    createdAt: "1h ago",
    actionLabel: "Review lead"
  },
  {
    id: "w2",
    severity: "medium",
    category: "washer",
    title: "Refund request — Rachel Simms · spam-flagged lead",
    description: "Guest name: 'Kitchens R Us' · WhatsApp: +447700900999. Merchant flag reason: competitor pretending to be customer, phishing for supplier list.",
    source: "Merchant · demo-rachel-simms-kitchen-fitter-liverpool",
    detail: "Original comment: \"Hi, can you send me a full breakdown of who supplies your quartz worktops?\"",
    createdAt: "5h ago",
    actionLabel: "Review lead"
  },
  // ─── CONTENT REPORTS ───────────────────────────────
  {
    id: "c1",
    severity: "high",
    category: "content",
    title: "Under-18 safety report — canteen post",
    description: "Anonymous report via legal notice route. Reporter flagged a Yard post with imagery they consider unsuitable for under-18 viewers.",
    source: "Legal notice contact · thenetworkers.app@gmail.com",
    detail: "Post ID: yp_1PWm3q · Merchant: demo-jason-hardy-scaffolder-glasgow",
    createdAt: "2h ago",
    actionLabel: "View post"
  },
  // ─── USER SUBMITTED ────────────────────────────────
  {
    id: "u1",
    severity: "medium",
    category: "user",
    title: "Bug report · WhatsApp button not opening on iOS 17.4",
    description: "3 merchants report visitors saying the verified contact modal Send button doesn't launch WhatsApp on iOS 17.4 Safari. Investigate `window.open` target.",
    source: "Support form · 3 tickets",
    createdAt: "6h ago",
    actionLabel: "View tickets"
  },
  {
    id: "u2",
    severity: "low",
    category: "user",
    title: "Broken link · /trade-off/edit/[slug]/materials-network 404",
    description: "Merchant tried to reach materials-network from the dashboard drawer. Route exists but the file returns not-found for demo slugs.",
    source: "Merchant · Tom Fisher",
    createdAt: "8h ago",
    actionLabel: "Open in code"
  }
];

const SEVERITY_META: Record<Severity, {
  label: string;
  color: string;
  bg: string;
  border: string;
}> = {
  critical: { label: "Critical", color: "#7F1D1D", bg: "#FEE2E2", border: "#DC2626" },
  high:     { label: "High",     color: "#7C2D12", bg: "#FEF3C7", border: "#D97706" },
  medium:   { label: "Medium",   color: "#374151", bg: "#F3F4F6", border: "#9CA3AF" },
  low:      { label: "Low",      color: "#4B5563", bg: "#F9FAFB", border: "#D1D5DB" }
};

const CATEGORY_META: Record<Issue["category"], {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}> = {
  blocking: { label: "Blocking",         icon: AlertTriangle },
  payment:  { label: "Payments",         icon: CreditCard },
  washer:   { label: "Washer refunds",   icon: RefreshCw },
  content:  { label: "Content reports",  icon: ShieldAlert },
  user:     { label: "User reports",     icon: Bug }
};

const SERVICE_STATUS_META: Record<ServiceStatus, {
  color: string;
  bg: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}> = {
  operational: { color: "#065F46", bg: "#D1FAE5", label: "Operational", icon: CheckCircle2 },
  degraded:    { color: "#7C2D12", bg: "#FEF3C7", label: "Degraded",    icon: AlertCircle },
  down:        { color: "#7F1D1D", bg: "#FEE2E2", label: "Down",        icon: AlertTriangle }
};

export function RedZoneShell() {
  const [issues, setIssues] = useState<Issue[]>(MOCK_ISSUES);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [services, setServices] = useState<ServiceTile[]>(INITIAL_SERVICES);
  const [refreshing, setRefreshing] = useState(false);

  const pollIssues = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/red-zone", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data.issues)) return;
      const liveIssues = (data.issues as Issue[]).filter(
        (i) => i && typeof i.id === "string" && typeof i.category === "string"
      );
      setIssues((prev) => {
        // Merge: drop any prior live rows (identified by prefix), keep
        // the mocked scaffolding for categories that have no producer
        // yet, then append the fresh live rows.
        const scaffolding = prev.filter((i) => !i.id.startsWith("live-"));
        const stamped = liveIssues.map((i) => ({ ...i, id: `live-${i.id}` }));
        return [...scaffolding, ...stamped];
      });
    } catch {
      // Endpoint down or not yet wired — leave prev state as-is.
    }
  }, []);

  const pollHealth = useCallback(async () => {
    setRefreshing(true);
    const routes = Object.entries(SERVICE_HEALTH_ROUTES);
    const results = await Promise.all(
      routes.map(async ([id, url]) => {
        try {
          const res = await fetch(url, { cache: "no-store" });
          const data = await res.json();
          return {
            id,
            status: (data.status as ServiceStatus) ?? (res.ok ? "operational" : "down"),
            detail: typeof data.detail === "string" ? data.detail : "OK",
            checkedAt: typeof data.checkedAt === "string" ? data.checkedAt : new Date().toISOString()
          };
        } catch (e) {
          return {
            id,
            status: "down" as ServiceStatus,
            detail: `Fetch failed: ${e instanceof Error ? e.message : "unknown"}`,
            checkedAt: new Date().toISOString()
          };
        }
      })
    );
    setServices((prev) =>
      prev.map((tile) => {
        const hit = results.find((r) => r.id === tile.id);
        if (!hit) return tile;
        return {
          ...tile,
          status: hit.status,
          detail: hit.detail,
          checkedAt: timeAgoShort(hit.checkedAt)
        };
      })
    );
    setRefreshing(false);
  }, []);

  useEffect(() => {
    pollHealth();
    pollIssues();
    const t1 = window.setInterval(pollHealth, 30_000);
    const t2 = window.setInterval(pollIssues, 60_000);
    return () => {
      window.clearInterval(t1);
      window.clearInterval(t2);
    };
  }, [pollHealth, pollIssues]);

  function markResolved(id: string) {
    // TODO(backend): PATCH the underlying producer (spam-flag row,
    // support ticket row, content report row) to status='resolved'.
    setResolvedIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setIssues((prev) => prev.filter((i) => i.id !== id));
    }, 400);
  }

  function approveWasherRefund(id: string) {
    // TODO(backend): POST /api/washers/refund/approve — credits merchant
    // bag and marks the spam-flag row as approved.
    markResolved(id);
  }

  function denyWasherRefund(id: string) {
    // TODO(backend): POST /api/washers/refund/deny — leaves the
    // deduction, marks the spam-flag row as denied.
    markResolved(id);
  }

  const openCount = issues.length;
  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const highCount = issues.filter((i) => i.severity === "high").length;
  const degradedServices = services.filter((s) => s.status !== "operational");
  const orderedIssues = [...issues].sort((a, b) => {
    const rank = (s: Severity) => (s === "critical" ? 0 : s === "high" ? 1 : s === "medium" ? 2 : 3);
    return rank(a.severity) - rank(b.severity);
  });

  const grouped: Record<Issue["category"], Issue[]> = {
    blocking: orderedIssues.filter((i) => i.category === "blocking"),
    payment:  orderedIssues.filter((i) => i.category === "payment"),
    washer:   orderedIssues.filter((i) => i.category === "washer"),
    content:  orderedIssues.filter((i) => i.category === "content"),
    user:     orderedIssues.filter((i) => i.category === "user")
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* ─── HEADLINE ───────────────────────────────────── */}
      <header className="mb-6">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-700">
          Operational command centre
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-3">
          <h1 className="text-[28px] font-black leading-tight text-neutral-900 md:text-[34px]">
            🔴 Red Zone
          </h1>
          <span className="text-[13px] font-black uppercase tracking-wider text-neutral-500">
            {openCount} open · {criticalCount} critical · {highCount} high
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-neutral-600">
          Every issue that could stop the platform being fully operational — site health, payments, washer refund flags, content reports, and user bug reports — surfaces here. Check hourly.
        </p>
      </header>

      {/* ─── SITE HEALTH STRIP ──────────────────────────── */}
      <section className="mb-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[16px] font-black text-neutral-900">System health</h2>
          {degradedServices.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-900">
              {degradedServices.length} degraded
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => {
            const meta = SERVICE_STATUS_META[s.status];
            const Icon = s.icon;
            const StatusIcon = meta.icon;
            return (
              <div
                key={s.id}
                className="flex items-start gap-3 rounded-xl border bg-white p-3 shadow-sm"
                style={{ borderColor: s.status === "operational" ? "rgba(139,69,19,0.15)" : meta.color }}
              >
                <Icon size={16} strokeWidth={2.2} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12.5px] font-black text-neutral-900">
                      {s.label}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                      style={{ backgroundColor: meta.bg, color: meta.color }}
                    >
                      <StatusIcon size={9} strokeWidth={3}/>
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-neutral-600">
                    {s.detail}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
                    <Clock size={9} strokeWidth={2.4}/>
                    Checked {s.checkedAt}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── ISSUES BY CATEGORY ─────────────────────────── */}
      <section className="flex flex-col gap-8">
        {(Object.keys(grouped) as Issue["category"][]).map((cat) => {
          const list = grouped[cat];
          if (list.length === 0) return null;
          const meta = CATEGORY_META[cat];
          const Icon = meta.icon;
          return (
            <div key={cat}>
              <div className="mb-2 flex items-baseline gap-2">
                <Icon size={16} strokeWidth={2.5} className="text-neutral-800"/>
                <h2 className="text-[16px] font-black text-neutral-900">
                  {meta.label}
                </h2>
                <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-neutral-700">
                  {list.length}
                </span>
              </div>
              <ul className="flex flex-col gap-3">
                {list.map((issue) => {
                  const sev = SEVERITY_META[issue.severity];
                  const resolved = resolvedIds.has(issue.id);
                  return (
                    <li
                      key={issue.id}
                      className="rounded-xl border bg-white p-4 shadow-sm transition"
                      style={{
                        borderColor: sev.border,
                        borderLeftWidth: 4,
                        opacity: resolved ? 0.4 : 1
                      }}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]"
                          style={{ backgroundColor: sev.bg, color: sev.color }}
                        >
                          {sev.label}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
                          {issue.source}
                        </span>
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
                          <Clock size={9} strokeWidth={2.4}/>
                          {issue.createdAt}
                        </span>
                      </div>
                      <div className="text-[14px] font-black text-neutral-900">
                        {issue.title}
                      </div>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-700">
                        {issue.description}
                      </p>
                      {issue.detail && (
                        <div
                          className="mt-2 rounded-md border-l-2 border-neutral-400 bg-neutral-50 p-2 text-[11.5px] leading-snug text-neutral-700"
                        >
                          {issue.detail}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {cat === "washer" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => approveWasherRefund(issue.id)}
                              disabled={resolved}
                              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm disabled:opacity-50"
                              style={{ backgroundColor: "#166534" }}
                            >
                              <ThumbsUp size={11} strokeWidth={2.6}/>
                              Approve refund
                            </button>
                            <button
                              type="button"
                              onClick={() => denyWasherRefund(issue.id)}
                              disabled={resolved}
                              className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700 disabled:opacity-50"
                              style={{ borderColor: "rgba(139,69,19,0.15)" }}
                            >
                              <ThumbsDown size={11} strokeWidth={2.6}/>
                              Deny
                            </button>
                          </>
                        ) : (
                          <>
                            {issue.actionHref && (
                              <a
                                href={issue.actionHref}
                                target={issue.actionHref.startsWith("http") ? "_blank" : undefined}
                                rel={issue.actionHref.startsWith("http") ? "noreferrer noopener" : undefined}
                                className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm"
                                style={{ backgroundColor: "#0A0A0A" }}
                              >
                                {issue.actionLabel ?? "Open"}
                                {issue.actionHref.startsWith("http") && (
                                  <ExternalLink size={10} strokeWidth={2.5}/>
                                )}
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => markResolved(issue.id)}
                              disabled={resolved}
                              className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700 disabled:opacity-50"
                              style={{ borderColor: "rgba(139,69,19,0.15)" }}
                            >
                              <CheckCircle2 size={11} strokeWidth={2.5}/>
                              Mark resolved
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      {/* ─── ALL CLEAR ──────────────────────────────────── */}
      {openCount === 0 && (
        <section
          className="mt-8 rounded-xl border-2 border-dashed p-8 text-center"
          style={{ borderColor: "rgba(6,95,70,0.35)" }}
        >
          <ShieldCheck size={32} strokeWidth={2} className="mx-auto text-green-700"/>
          <div className="mt-2 text-[18px] font-black text-green-900">
            All clear.
          </div>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-neutral-600">
            No open blocking issues, no pending washer refunds, no content reports, no bug tickets. Systems operational.
          </p>
        </section>
      )}

      {/* Footer note explaining sources — reassures the admin that
          nothing is falling through cracks that shouldn't. */}
      <footer className="mt-10 border-t pt-4 text-[10.5px] leading-relaxed text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em]">
          <Circle size={9} strokeWidth={2.5}/>
          Source of truth (once wired)
        </div>
        <ul className="flex flex-col gap-0.5 pl-4" style={{ listStyleType: "disc" }}>
          <li><strong>Blocking</strong> · Sentry alerts tagged blocking + health-tile transitions to Down.</li>
          <li><strong>Payments</strong> · Stripe webhook events (charge.failed / dispute.created / invoice.payment_failed) in the last 24h.</li>
          <li><strong>Washer refunds</strong> · <code>hammerex_washer_spam_flags</code> where status = pending.</li>
          <li><strong>Content reports</strong> · <code>hammerex_content_reports</code> where status = pending (fed from the legal-notice email + in-app report links).</li>
          <li><strong>User reports</strong> · <code>hammerex_bug_reports</code> where status = open (submitted via the site-wide "Report an issue" form).</li>
          <li><strong>System health tiles</strong> · <code>/api/health/*</code> endpoints polled every 60s.</li>
        </ul>
      </footer>
    </div>
  );
}
