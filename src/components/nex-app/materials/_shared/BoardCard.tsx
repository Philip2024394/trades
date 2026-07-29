// BoardCard — one physical board rendered as a workshop-ready card.
// Content driven by the board's status (Available · Reserved ·
// Measuring · Machining · Used · Scrapped). Actions vary per status.

"use client";

import { useRouter } from "next/navigation";
import {
  Box, Droplet, Award, QrCode, MoreHorizontal,
  Ruler, Lock, Eye, Unlock, History as HistoryIcon,
} from "lucide-react";
import { MT } from "../_tokens";
import { StatusBadge, boardStatusToKind } from "./StatusBadge";
import { TimberIllustration } from "../_TimberIllustration";
import type { BoardWithCurrentMeasurement } from "@/apps/materials/_schema/types";

export type BoardCardProps = {
  board:              BoardWithCurrentMeasurement;
  packSlug:           string;         // pack_ref e.g. "PACK-2026-042"
  packSpeciesShort:   string;         // "OAK", "ASH" — used for the display ref
  packGrade:          string | null;
  onMeasure?:         () => void;
  onAllocate?:        () => void;
  onView?:            () => void;
  onRelease?:         () => void;
  onHistory?:         () => void;
  onQr?:              () => void;
  onOverflow?:        () => void;
};

export function BoardCard(props: BoardCardProps) {
  const { board } = props;
  const kind = boardStatusToKind(board.status);
  const router = useRouter();

  const displayRef = buildDisplayRef(props.packSpeciesShort, board.board_ref);
  const dims       = formatDimensions(board);
  const volume     = formatVolume(board);
  const moisture   = formatMoisture(board);
  const grade      = props.packGrade ?? "Select";

  const openDetail = () => {
    // Detail page ships in a later phase — for now open the pack detail on itself.
    router.push(`#board-${board.id}`);
  };

  return (
    <article
      onClick={openDetail}
      className="relative flex overflow-hidden transition-transform active:scale-[0.995]"
      style={{
        background: MT.card,
        border: `1px solid ${MT.borderLight}`,
        borderRadius: MT.radiusLg,
        boxShadow: MT.shadowSoft,
        cursor: "pointer",
      }}
    >
      {/* Left — photo area */}
      <div className="relative w-[36%] shrink-0" style={{ minWidth: 130 }}>
        <TimberIllustration variant="board" className="absolute inset-0" />
        <span
          aria-hidden
          className="absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold text-white"
          style={{ background: "rgba(30, 32, 38, 0.85)", letterSpacing: 0.3 }}
        >
          {padPosition(board.position_in_pack)}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); props.onQr?.(); }}
          aria-label="Scan board QR"
          className="absolute bottom-2 left-2 grid h-8 w-8 place-items-center rounded-md transition-transform active:scale-90"
          style={{ background: "#FFFFFF", border: `1px solid ${MT.borderLight}`, color: MT.darkGrey, boxShadow: MT.shadowSoft }}
        >
          <QrCode size={16} strokeWidth={1.9} />
        </button>
      </div>

      {/* Right — info */}
      <div className="relative flex min-w-0 flex-1 flex-col gap-2 px-3.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[16px] font-extrabold leading-tight tracking-tight" style={{ color: MT.darkGrey }}>
              {displayRef}
            </div>
            <div className="mt-1 text-[12.5px] font-medium" style={{ color: MT.secondaryGrey }}>
              {dims}
            </div>
          </div>
          <StatusBadge kind={kind} size="sm" />
        </div>

        <MetricsRow volume={volume} moisture={moisture} grade={grade} kind={kind} />

        <MetaLine board={board} />

        <ActionRow
          kind={kind}
          onMeasure={props.onMeasure}
          onAllocate={props.onAllocate}
          onView={props.onView}
          onRelease={props.onRelease}
          onHistory={props.onHistory}
          onOverflow={props.onOverflow}
        />
      </div>
    </article>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function MetricsRow({
  volume, moisture, grade, kind,
}: {
  volume: string; moisture: string; grade: string; kind: ReturnType<typeof boardStatusToKind>;
}) {
  const iconColor = kind === "measuring" || kind === "awaiting" ? "#1E5FBF"
                  : kind === "machining"                       ? "#6B3EC7"
                  : MT.primary;
  return (
    <div className="grid grid-cols-3 gap-3 pt-1">
      <Metric icon={<Box     size={16} strokeWidth={1.9} style={{ color: iconColor }} />} value={volume}   label="Volume" />
      <Metric icon={<Droplet size={16} strokeWidth={1.9} style={{ color: iconColor }} />} value={moisture} label="Moisture" />
      <Metric icon={<Award   size={16} strokeWidth={1.9} style={{ color: iconColor }} />} value={grade}    label="Grade" />
    </div>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] font-bold" style={{ color: MT.darkGrey }}>{value}</div>
        <div className="text-[10.5px] font-semibold" style={{ color: MT.secondaryGrey }}>{label}</div>
      </div>
    </div>
  );
}

function MetaLine({ board }: { board: BoardWithCurrentMeasurement }) {
  const m = board.current_measurement;
  if (!m) {
    return (
      <div className="text-[11.5px]" style={{ color: MT.secondaryGrey }}>
        Not yet measured
      </div>
    );
  }
  const dateStr = formatShortDate(m.measured_at);
  const who = m.measured_by_kind === "worker_link" ? "Worker Link" : shortenEmail(m.measured_by_ref);
  return (
    <div className="flex items-center justify-between gap-2 text-[11.5px]" style={{ color: MT.secondaryGrey }}>
      <span>Measured: <span style={{ color: MT.darkGrey, fontWeight: 600 }}>{dateStr}</span></span>
      <span>By: <span style={{ color: MT.darkGrey, fontWeight: 600 }}>{who}</span></span>
    </div>
  );
}

// ── Actions per status ───────────────────────────────────────────

function ActionRow({
  kind, onMeasure, onAllocate, onView, onRelease, onHistory, onOverflow,
}: {
  kind: ReturnType<typeof boardStatusToKind>;
  onMeasure?: () => void; onAllocate?: () => void;
  onView?: () => void; onRelease?: () => void; onHistory?: () => void;
  onOverflow?: () => void;
}) {
  // Colour palette per kind — buttons use tinted borders + fg
  const palette = {
    available: { fg: MT.primary, border: MT.primaryBorder },
    reserved:  { fg: MT.primary, border: MT.primaryBorder },
    measuring: { fg: "#1E5FBF",  border: "#C3D8F5" },
    awaiting:  { fg: "#1E5FBF",  border: "#C3D8F5" },
    machining: { fg: "#6B3EC7",  border: "#D8C6F1" },
    used:      { fg: "#6B6E76",  border: MT.border },
    offcut:    { fg: "#6B6E76",  border: MT.border },
    scrapped:  { fg: "#B91C1C",  border: "#F5C6C6" },
    active:    { fg: MT.primary, border: MT.primaryBorder },
  }[kind];

  const stopBubble = (fn?: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn?.();
  };

  let left: { icon: React.ReactNode; label: string; onClick?: () => void };
  let right: { icon: React.ReactNode; label: string; onClick?: () => void };

  if (kind === "reserved") {
    left  = { icon: <Eye     size={15} strokeWidth={2} />, label: "View",    onClick: onView };
    right = { icon: <Unlock  size={15} strokeWidth={2} />, label: "Release", onClick: onRelease };
  } else if (kind === "measuring" || kind === "awaiting") {
    left  = { icon: <Ruler        size={15} strokeWidth={2} />, label: "Measure", onClick: onMeasure };
    right = { icon: <HistoryIcon  size={15} strokeWidth={2} />, label: "History", onClick: onHistory };
  } else if (kind === "machining" || kind === "used" || kind === "scrapped" || kind === "offcut") {
    left  = { icon: <Eye         size={15} strokeWidth={2} />, label: "View",    onClick: onView };
    right = { icon: <HistoryIcon size={15} strokeWidth={2} />, label: "History", onClick: onHistory };
  } else {
    // Available / Active
    left  = { icon: <Ruler size={15} strokeWidth={2} />, label: "Measure",  onClick: onMeasure };
    right = { icon: <Lock  size={15} strokeWidth={2} />, label: "Allocate", onClick: onAllocate };
  }

  return (
    <div className="mt-1 flex items-center gap-2">
      <ActionButton icon={left.icon}  label={left.label}  fg={palette.fg} border={palette.border} onClick={stopBubble(left.onClick)} />
      <ActionButton icon={right.icon} label={right.label} fg={palette.fg} border={palette.border} onClick={stopBubble(right.onClick)} />
      <button
        type="button"
        onClick={stopBubble(onOverflow)}
        aria-label="More actions"
        className="grid h-10 w-10 place-items-center transition-transform active:scale-95"
        style={{ background: MT.card, border: `1px solid ${MT.borderLight}`, color: MT.secondaryGrey, borderRadius: MT.radiusSm }}
      >
        <MoreHorizontal size={18} strokeWidth={2} />
      </button>
    </div>
  );
}

function ActionButton({
  icon, label, fg, border, onClick,
}: {
  icon: React.ReactNode; label: string; fg: string; border: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 text-[13px] font-bold transition-transform active:scale-95"
      style={{ background: MT.card, color: fg, border: `1px solid ${border}`, borderRadius: MT.radiusSm }}
    >
      <span style={{ color: fg }}>{icon}</span>
      {label}
    </button>
  );
}

// ── Formatting helpers ───────────────────────────────────────────

function padPosition(n: number): string {
  return n.toString().padStart(3, "0");
}

function buildDisplayRef(speciesShort: string, boardRef: string): string {
  return `${speciesShort}-${boardRef.padStart(3, "0")}`;
}

function formatDimensions(b: BoardWithCurrentMeasurement): string {
  const m = b.current_measurement;
  if (!m) return "Dimensions pending";
  return `${m.length_mm} × ${m.width_centre_mm} × ${m.thickness_centre_mm} mm`;
}

function formatVolume(b: BoardWithCurrentMeasurement): string {
  const m = b.current_measurement;
  if (!m) return "—";
  const avgW = (m.width_end_a_mm + m.width_centre_mm + m.width_end_b_mm) / 3;
  const avgT = (m.thickness_end_a_mm + m.thickness_centre_mm + m.thickness_end_b_mm) / 3;
  const vol_m3 = (m.length_mm * avgW * avgT) / 1_000_000_000;
  return `${vol_m3.toFixed(3)} m³`;
}

function formatMoisture(b: BoardWithCurrentMeasurement): string {
  const m = b.current_measurement;
  if (!m || m.moisture_content_pct == null) return "—";
  return `${m.moisture_content_pct.toFixed(0)}%`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function shortenEmail(ref: string): string {
  if (!ref.includes("@")) return ref;
  const local = ref.split("@")[0];
  const first = local.split(/[._-]/)[0];
  const last = local.split(/[._-]/).slice(1).join(" ");
  const shortLast = last ? last[0].toUpperCase() + "." : "";
  return [capitalise(first), shortLast].filter(Boolean).join(" ");
}
function capitalise(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
