// StatusBadge — reusable coloured pill for board / pack status.
// Six semantic states per Philip's spec:
//   Available  → green
//   Reserved   → orange
//   Measuring  → blue
//   Machining  → purple
//   Used       → grey
//   Scrapped   → red
// Additional 'Active' / 'Awaiting' aliases render as available/blue.

import type { BoardStatus, PackStatus } from "@/apps/materials/_schema/types";

type Kind =
  | "available" | "reserved" | "measuring" | "machining" | "used" | "scrapped"
  | "active"    | "awaiting" | "offcut";

type Palette = { bg: string; fg: string; border: string };

const PALETTES: Record<Kind, Palette> = {
  available: { bg: "#E6F5EA", fg: "#2E7D3D", border: "#C6E5CE" },
  active:    { bg: "#E6F5EA", fg: "#2E7D3D", border: "#C6E5CE" },
  reserved:  { bg: "#FDECD9", fg: "#B85A0C", border: "#F9C89A" },
  measuring: { bg: "#E4EEFB", fg: "#1E5FBF", border: "#C3D8F5" },
  awaiting:  { bg: "#E4EEFB", fg: "#1E5FBF", border: "#C3D8F5" },
  machining: { bg: "#EFE7FA", fg: "#6B3EC7", border: "#D8C6F1" },
  used:      { bg: "#EEEEEE", fg: "#6B6E76", border: "#D8D8D8" },
  offcut:    { bg: "#EEEEEE", fg: "#6B6E76", border: "#D8D8D8" },
  scrapped:  { bg: "#FBE3E3", fg: "#B91C1C", border: "#F5C6C6" },
};

/** Map a board status from the schema to a UI kind. */
export function boardStatusToKind(status: BoardStatus): Kind {
  switch (status) {
    case "awaiting_measurement": return "awaiting";
    case "measured":             return "available";
    case "allocated":            return "reserved";
    case "machined":             return "machining";
    case "installed":            return "used";
    case "offcut":               return "offcut";
    case "disposed":             return "scrapped";
  }
}

/** Map a pack status from the schema to a UI kind. */
export function packStatusToKind(status: PackStatus): Kind {
  switch (status) {
    case "pending":   return "awaiting";
    case "measuring": return "measuring";
    case "complete":  return "active";
    case "allocated": return "reserved";
    case "consumed":  return "used";
    case "retired":   return "scrapped";
  }
}

/** Human label for a UI kind. */
export function kindLabel(kind: Kind): string {
  return kind[0].toUpperCase() + kind.slice(1);
}

export function StatusBadge({
  kind,
  size = "md",
  className = "",
}: {
  kind: Kind;
  size?: "sm" | "md";
  className?: string;
}) {
  const p = PALETTES[kind];
  const paddingY = size === "sm" ? 2 : 3.5;
  const paddingX = size === "sm" ? 8 : 10;
  const fontSize = size === "sm" ? 10.5 : 11.5;
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ${className}`}
      style={{
        background: p.bg,
        color: p.fg,
        border: `1px solid ${p.border}`,
        padding: `${paddingY}px ${paddingX}px`,
        fontSize,
        lineHeight: 1,
        letterSpacing: 0.1,
        whiteSpace: "nowrap",
      }}
    >
      {kindLabel(kind)}
    </span>
  );
}
