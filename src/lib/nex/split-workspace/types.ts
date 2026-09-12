// src/lib/nex/split-workspace/types.ts
//
// Stage 9 · split-workspace types. LEFT preview · RIGHT code · both visible ·
// founder can talk to NEX1 while watching preview update.

export type PanelKind = "preview" | "code" | "changes" | "diff" | "console";

export interface PanelState {
  readonly kind: PanelKind;
  readonly widthFraction: number;          // 0..1 · sum of all visible panels = 1
  readonly visible: boolean;
  readonly focused: boolean;
}

export interface WorkspaceLayout {
  readonly panels: readonly PanelState[];
  readonly orientation: "horizontal" | "vertical";
}

export type WorkspaceValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly reason: string };
