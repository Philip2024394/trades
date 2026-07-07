// Dashboard notice strip — renders the highest-priority active notice
// for the current homeowner. Copy comes from the DB (os_dashboard_notices).
// Handles dismissal via /api/os/vault/notices/dismiss.
//
// Fully client-side after initial SSR — the notice payload is passed
// as a prop from the server component that resolved it.

"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Video,
  Download,
  KeyRound,
  Sparkles,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SurfaceCard, Button } from "@/platform/ui";
import type { ResolvedNotice } from "@/lib/os/vault/notices";

const ICON_MAP: Record<string, LucideIcon> = {
  ShieldCheck,
  Video,
  Download,
  KeyRound,
  Sparkles
};

const VARIANT_TINT: Record<
  ResolvedNotice["variant"],
  { border: string; iconBg: string; iconFg: string }
> = {
  primary: {
    border: "border-amber-200",
    iconBg: "bg-amber-100",
    iconFg: "text-amber-800"
  },
  success: {
    border: "border-emerald-200",
    iconBg: "bg-emerald-100",
    iconFg: "text-emerald-800"
  },
  warning: {
    border: "border-amber-200",
    iconBg: "bg-amber-100",
    iconFg: "text-amber-800"
  },
  danger: {
    border: "border-red-200",
    iconBg: "bg-red-100",
    iconFg: "text-red-800"
  },
  info: {
    border: "border-blue-200",
    iconBg: "bg-blue-100",
    iconFg: "text-blue-800"
  }
};

export function DashboardNoticeStrip({
  notice
}: {
  notice: ResolvedNotice | null;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  if (!notice || dismissed) return null;

  const Icon = notice.iconHint ? ICON_MAP[notice.iconHint] ?? Sparkles : Sparkles;
  const tint = VARIANT_TINT[notice.variant];

  async function handleDismiss() {
    if (!notice || dismissing) return;
    setDismissing(true);
    try {
      await fetch("/api/os/vault/notices/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noticeKey: notice.noticeKey,
          channel: "x_button"
        })
      });
    } finally {
      setDismissed(true);
    }
  }

  return (
    <SurfaceCard variant="primary" padding="md" className={`border ${tint.border}`}>
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tint.iconBg}`}
          aria-hidden
        >
          <Icon className={`h-5 w-5 ${tint.iconFg}`} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold leading-tight text-neutral-900">
            {notice.headline}
          </h3>
          <p className="mt-1 text-[13px] leading-snug text-neutral-700">
            {notice.body}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {notice.primaryCtaLabel && notice.primaryCtaHref ? (
              <Button
                href={notice.primaryCtaHref}
                intent="primary"
                size="sm"
              >
                {notice.primaryCtaLabel}
              </Button>
            ) : null}
            {notice.secondaryCtaLabel && notice.secondaryCtaHref ? (
              <Button
                href={notice.secondaryCtaHref}
                intent="ghost"
                size="sm"
              >
                {notice.secondaryCtaLabel}
              </Button>
            ) : null}
          </div>
        </div>
        {notice.dismissible ? (
          <button
            type="button"
            onClick={handleDismiss}
            disabled={dismissing}
            aria-label="Dismiss notice"
            className="ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-40"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
