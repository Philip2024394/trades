// PackHeader — sticky top area of the pack-detail screen.
// Composes: back button · pack title · species + status · meta line ·
// notification bell · overflow menu.

"use client";

import Link from "next/link";
import { ArrowLeft, Bell, MoreVertical } from "lucide-react";
import { MT } from "../_tokens";
import { StatusBadge, packStatusToKind } from "./StatusBadge";
import type { PackStatus } from "@/apps/materials/_schema/types";

export type PackHeaderProps = {
  backHref: string;
  packRef: string;
  speciesName: string;
  packStatus: PackStatus;
  supplierName?: string | null;
  purchaseDate?: string | null;
  boardCount: number;
  onOverflow?: () => void;
};

export function PackHeader({
  backHref,
  packRef,
  speciesName,
  packStatus,
  supplierName,
  purchaseDate,
  boardCount,
  onOverflow,
}: PackHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 px-4 pt-4 pb-3"
      style={{ background: MT.bg, borderBottom: `1px solid ${MT.borderLight}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Link
            href={backHref}
            aria-label="Back"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full transition-transform active:scale-95"
            style={{ background: MT.card, border: `1px solid ${MT.borderLight}`, boxShadow: MT.shadowSoft }}
          >
            <ArrowLeft size={20} strokeWidth={2.25} style={{ color: MT.primary }} />
          </Link>
          <div className="min-w-0 pt-0.5">
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight" style={{ color: MT.darkGrey, letterSpacing: -0.5 }}>
              {packRef}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-[13.5px] font-semibold" style={{ color: MT.darkGrey }}>{speciesName}</span>
              <StatusBadge kind={packStatusToKind(packStatus)} size="sm" />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
          <button
            aria-label="Notifications"
            className="relative grid h-11 w-11 place-items-center rounded-full transition-transform active:scale-95"
            style={{ background: MT.card, border: `1px solid ${MT.borderLight}`, color: MT.darkGrey, boxShadow: MT.shadowSoft }}
          >
            <Bell size={19} strokeWidth={1.9} />
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-bold text-white"
              style={{ background: MT.primary, lineHeight: 1 }}
            >
              3
            </span>
          </button>
          <button
            aria-label="More"
            onClick={onOverflow}
            className="grid h-11 w-11 place-items-center rounded-full transition-transform active:scale-95"
            style={{ background: MT.card, border: `1px solid ${MT.borderLight}`, color: MT.darkGrey, boxShadow: MT.shadowSoft }}
          >
            <MoreVertical size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      <MetaLine supplierName={supplierName} purchaseDate={purchaseDate} boardCount={boardCount} />
    </header>
  );
}

function MetaLine({
  supplierName,
  purchaseDate,
  boardCount,
}: {
  supplierName?: string | null;
  purchaseDate?: string | null;
  boardCount: number;
}) {
  const bits: string[] = [];
  if (supplierName) bits.push(supplierName);
  if (purchaseDate) bits.push(formatDate(purchaseDate));
  bits.push(`${boardCount} Board${boardCount === 1 ? "" : "s"}`);
  return (
    <div className="mt-2 text-[12.5px] font-medium" style={{ color: MT.secondaryGrey }}>
      {bits.map((b, i) => (
        <span key={i}>
          {b}
          {i < bits.length - 1 && <span className="mx-2" aria-hidden>•</span>}
        </span>
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
