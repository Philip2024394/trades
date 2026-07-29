// MaterialsSubPage — shared template for every sub-page under
// /nex-app/materials/*.
//
// Server Component. Composes: breadcrumb · page title + subtitle ·
// primary action link · optional data list · empty state.
//
// Deliberately NOT "use client" — that would force every consumer to
// avoid passing Lucide icon references (which are component functions
// and can't cross the RSC → CC boundary).

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Plus, PackageOpen, type LucideIcon } from "lucide-react";
import { MT } from "./_tokens";
import { MaterialsAppShell } from "./MaterialsAppShell";

export type Crumb = { label: string; href?: string };

export type SubPageProps = {
  crumbs: Crumb[];
  title: string;
  subtitle: string;
  /** Primary action must be an href — the shared template is a Server
   *  Component and cannot attach onClick handlers. */
  primaryAction: { label: string; href: string };
  itemsCount: number;
  itemsRender?: ReactNode;
  emptyState: {
    icon?: LucideIcon;
    headline: string;
    body: string;
  };
};

export function MaterialsSubPage({
  crumbs, title, subtitle, primaryAction, itemsCount, itemsRender, emptyState,
}: SubPageProps) {
  const EmptyIcon = emptyState.icon ?? PackageOpen;

  return (
    <MaterialsAppShell backHref="/nex-app/materials">
      <div className="pt-6">
        <Breadcrumb crumbs={crumbs} />

        <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight" style={{ color: MT.darkGrey, letterSpacing: -0.5 }}>
              {title}
            </h1>
            <p className="mt-1.5 text-[13.5px] leading-snug" style={{ color: MT.secondaryGrey }}>
              {subtitle}
            </p>
          </div>
          <PrimaryButton action={primaryAction} />
        </div>

        {itemsCount > 0 ? (
          <div className="mt-6">{itemsRender}</div>
        ) : (
          <EmptyState
            icon={EmptyIcon}
            headline={emptyState.headline}
            body={emptyState.body}
            action={primaryAction}
          />
        )}
      </div>
    </MaterialsAppShell>
  );
}

// ── Breadcrumb ───────────────────────────────────────────────────

function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12.5px]">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {c.href && !isLast ? (
              <Link
                href={c.href}
                className="rounded-md px-1 py-0.5 transition-colors hover:text-[color:var(--nex-mat-primary)]"
                style={{ color: MT.secondaryGrey }}
              >
                {c.label}
              </Link>
            ) : (
              <span className="px-1 py-0.5 font-semibold" style={{ color: isLast ? MT.darkGrey : MT.secondaryGrey }}>
                {c.label}
              </span>
            )}
            {!isLast && <ChevronRight size={14} strokeWidth={2} style={{ color: MT.secondaryGrey }} />}
          </span>
        );
      })}
    </nav>
  );
}

// ── Primary action button ────────────────────────────────────────

function PrimaryButton({ action }: { action: SubPageProps["primaryAction"] }) {
  const styles: React.CSSProperties = {
    background: MT.primary,
    color: "#FFFFFF",
    borderRadius: MT.radiusMd,
    padding: "12px 20px",
    fontSize: 13.5,
    fontWeight: 700,
    boxShadow: "0 6px 16px -6px rgba(245,130,32,0.55), 0 1px 2px rgba(0,0,0,0.05)",
    transition: `transform ${MT.fast} ${MT.ease}, box-shadow ${MT.medium} ${MT.ease}`,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };

  return (
    <Link
      href={action.href}
      style={styles}
      className="active:scale-95 hover:brightness-110"
    >
      <Plus size={16} strokeWidth={2.5} />
      {action.label}
    </Link>
  );
}

// ── Empty state ──────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  headline,
  body,
  action,
}: {
  icon: LucideIcon;
  headline: string;
  body: string;
  action: SubPageProps["primaryAction"];
}) {
  return (
    <div
      className="mt-8 flex flex-col items-center px-6 py-12 text-center sm:py-16"
      style={{
        background: MT.card,
        border: `1px dashed ${MT.border}`,
        borderRadius: MT.radiusLg,
      }}
    >
      <div
        className="grid h-16 w-16 place-items-center rounded-2xl"
        style={{ background: MT.primarySoft, color: MT.primary, border: `1px solid ${MT.primaryBorder}` }}
      >
        <Icon size={28} strokeWidth={1.8} />
      </div>
      <h2 className="mt-5 text-[18px] font-extrabold" style={{ color: MT.darkGrey }}>{headline}</h2>
      <p className="mt-2 max-w-md text-[13.5px] leading-relaxed" style={{ color: MT.secondaryGrey }}>{body}</p>
      <div className="mt-6">
        <PrimaryButton action={action} />
      </div>
    </div>
  );
}
