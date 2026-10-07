// src/app/nex-native/vault/_doorway-skin.ts
//
// NEX Vault · doorway skin registry.
//
// Each visual theme owns its own Vault doorway page (rule sealed
// 2026-10-03 · vault-research.md §10.0.1). This file is the shared
// skin contract — a theme's doorway page selects a VaultDoorwaySkin
// and hands it to <DoorwayShell>. The PIN-entry mechanics (6 cells,
// mock reject, auto-focus, cleared-on-reject) are identical across
// skins. Only the visual world changes.
//
// Adding a new theme = (1) add a Skin preset here, (2) create its
// route file at /nex-native/vault/<slug>/page.tsx. The simplicity
// principle (§10.0 · one-line prompt, no technical clutter) applies
// unconditionally regardless of skin.

export interface VaultDoorwaySkin {
  slug: "nex" | "joker" | "haunted-hotel" | "pink-dream";
  label: string;
  font: string;
  // "center" (default) keeps the content block vertically centred.
  // "bottom" anchors it to the lower third — use this when the
  // background image has a hero element (e.g. a vault door) in the
  // middle that the content should sit *below*, not *over*.
  contentAnchor?: "center" | "bottom";
  bg: {
    base: string;
    radialOverlay?: string;
    imageUrl?: string;
    imageBlend?: "soft-light" | "overlay" | "normal";
    imageOpacity?: number;
  };
  text: {
    primary: string;
    secondary: string;
    brandChip: string;
  };
  cells: {
    bg: string;
    border: string;
    borderMuted: string;
    activeGlow: string;
    filled: string;
  };
  feedback: {
    orange: string;
    muted: string;
  };
}

// Master-pass follow-up 2026-10-07 · NEX doorway skin is now colour-
// aligned with the NEX palette (navy base + NEX orange brand + NEX
// cyan protection accents). The orange hue is the NEX wordmark
// orange (#FF7200), not the warmer Vault-only #FF8A2A. PIN cells
// use the cyan secure accent so the locked doorway reads as a
// protection surface. The doorway background PNG stays untouched.
export const SKIN_NEX: VaultDoorwaySkin = {
  slug: "nex",
  label: "NEX Vault",
  font:
    "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  contentAnchor: "bottom",
  bg: {
    base: "#020914",
    radialOverlay: undefined,
    imageUrl: "/nex-native/vault/nex-doorway.png",
    imageBlend: "normal",
    imageOpacity: 1,
  },
  text: {
    primary: "#F2F5F8",
    secondary: "#7D9BC0",
    brandChip: "#FF7200",
  },
  cells: {
    bg: "rgba(3, 16, 29, 0.72)",
    border: "rgba(0, 175, 255, 0.55)",
    borderMuted: "rgba(0, 175, 255, 0.22)",
    activeGlow: "rgba(0, 175, 255, 0.18)",
    filled: "#C9E6FF",
  },
  feedback: {
    orange: "#FF7200",
    muted: "#7D9BC0",
  },
};

export const SKIN_JOKER: VaultDoorwaySkin = {
  slug: "joker",
  label: "Joker Vault",
  font:
    "'Bebas Neue', 'Impact', ui-sans-serif, system-ui, -apple-system, sans-serif",
  contentAnchor: "bottom",
  bg: {
    base: "#0a0804",
    radialOverlay: undefined,
    imageUrl: "/nex-native/vault/joker-doorway.png",
    imageBlend: "normal",
    imageOpacity: 1,
  },
  text: {
    primary: "#F2E8D4",
    secondary: "#B8A77E",
    brandChip: "#8FFF6E",
  },
  cells: {
    bg: "rgba(8, 6, 3, 0.72)",
    border: "rgba(143, 255, 110, 0.55)",
    borderMuted: "rgba(143, 255, 110, 0.22)",
    activeGlow: "rgba(143, 255, 110, 0.18)",
    filled: "#E0F7D0",
  },
  feedback: {
    orange: "#F8C878",
    muted: "#B8A77E",
  },
};

export const SKIN_HAUNTED_HOTEL: VaultDoorwaySkin = {
  slug: "haunted-hotel",
  label: "Haunted Hotel Vault",
  font:
    "'Playfair Display', 'Georgia', 'Times New Roman', ui-serif, serif",
  contentAnchor: "bottom",
  bg: {
    base: "#0a0604",
    radialOverlay: undefined,
    imageUrl: "/nex-native/vault/haunted-hotel-doorway.png",
    imageBlend: "normal",
    imageOpacity: 1,
  },
  text: {
    primary: "#F4F0E6",
    secondary: "#C9BFAE",
    brandChip: "#f0c87a",
  },
  cells: {
    bg: "rgba(26, 16, 8, 0.72)",
    border: "rgba(240, 200, 122, 0.55)",
    borderMuted: "rgba(240, 200, 122, 0.22)",
    activeGlow: "rgba(240, 200, 122, 0.18)",
    filled: "#f8d87a",
  },
  feedback: {
    orange: "#f0c87a",
    muted: "#C9BFAE",
  },
};

export const SKIN_PINK_DREAM: VaultDoorwaySkin = {
  slug: "pink-dream",
  label: "Pink Dream Vault",
  font:
    "'Manrope', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  contentAnchor: "bottom",
  bg: {
    base: "#2A1824",
    radialOverlay: undefined,
    imageUrl: "/nex-native/vault/pink-dream-doorway.png",
    imageBlend: "normal",
    imageOpacity: 1,
  },
  text: {
    primary: "#FFF5FA",
    secondary: "#E8C6D3",
    brandChip: "#F6A8C0",
  },
  cells: {
    bg: "rgba(60, 30, 48, 0.72)",
    border: "rgba(246, 168, 192, 0.60)",
    borderMuted: "rgba(246, 168, 192, 0.25)",
    activeGlow: "rgba(246, 168, 192, 0.20)",
    filled: "#FDE4EC",
  },
  feedback: {
    orange: "#F6A8C0",
    muted: "#E8C6D3",
  },
};

export const SKIN_BY_SLUG: Record<VaultDoorwaySkin["slug"], VaultDoorwaySkin> = {
  nex: SKIN_NEX,
  joker: SKIN_JOKER,
  "haunted-hotel": SKIN_HAUNTED_HOTEL,
  "pink-dream": SKIN_PINK_DREAM,
};
