// Studio postMessage bus — protocol spec.
//
// Every message that flows between the editor (parent) and the preview
// iframe (child) is defined here. One vocabulary, one version, two
// direction-scoped unions. Every future Studio module reads and writes
// through THIS type surface — no ad-hoc `postMessage` payloads.
//
// Protocol versioning
// ───────────────────
// The envelope carries `v: 1`. When a breaking change lands (renamed
// message, restructured payload) the version bumps to 2. Both sides
// filter on version at receive time, so a v1 iframe embedded in a v2
// editor (or vice-versa) sees only messages it understands and ignores
// the rest — safe rollout without hard-coordinated deploys.
//
// Origin
// ──────
// Same-origin for now (editor and iframe share thenetworkers.app). Both
// sides also validate `event.source` against the expected window, which
// is the stronger guarantee. When we split origins (studio.* vs
// preview.*) the origin string check activates via BUS_TARGET_ORIGIN
// below.

import type { StudioLayoutJson } from "./schema";
import type {
  BrandTokens,
  SectionRenderMode
} from "./sectionTypes";
import type { TreeChangeReason, TreeSnapshot } from "./treeTypes";

// ─── Version + origin ─────────────────────────────────────────────

export const STUDIO_PROTOCOL_VERSION = 1;
export type StudioProtocolVersion = typeof STUDIO_PROTOCOL_VERSION;

/** `"*"` today, real origin once studio and preview split. Kept in
 *  one place so both sides pin the same value. */
export const BUS_TARGET_ORIGIN = "*";

// ─── Envelope ─────────────────────────────────────────────────────

type Envelope<TType extends string, TPayload> = {
  v: StudioProtocolVersion;
  type: TType;
  payload: TPayload;
};

// ─── Editor → iframe (parent → child) ─────────────────────────────

export type BusInboundMessage =
  // Layout + selection state
  | Envelope<"apply-layout", { layout: StudioLayoutJson }>
  | Envelope<"set-selected", { treeId: string | null }>
  | Envelope<"set-hover", { treeId: string | null }>
  | Envelope<"set-mode", { mode: SectionRenderMode }>
  // Design tokens (Module 4 lands the writer; the message shape lives
  // here so section renderers can already listen).
  | Envelope<"set-tokens", { tokens: BrandTokens }>
  // Section-level operations
  | Envelope<
      "swap-registration",
      { instanceId: string; nextRegistrationId: string }
    >
  // Tree operations
  | Envelope<"request-tree", Record<string, never>>
  | Envelope<
      "scroll-to",
      {
        treeId: string;
        behavior?: "smooth" | "auto";
        block?: "start" | "center" | "end" | "nearest";
      }
    >
  // Undo/redo (Module 3 wires the state store; shape is defined here so
  // Command Palette / keyboard shortcuts can fire the message).
  | Envelope<"undo", Record<string, never>>
  | Envelope<"redo", Record<string, never>>
  // Merchant switched the device toggle — iframe uses this to filter
  // hiddenOn sections in preview mode (Module 12).
  | Envelope<
      "set-breakpoint",
      { breakpoint: "mobile" | "tablet" | "desktop" }
    >;

// ─── Iframe → editor (child → parent) ─────────────────────────────

export type BusOutboundMessage =
  // Lifecycle
  | Envelope<
      "ready",
      { protocolVersion: StudioProtocolVersion; capabilities: string[] }
    >
  // Selection + hover — user pointed at something
  | Envelope<"select", { treeId: string | null }>
  | Envelope<"hover", { treeId: string | null }>
  // Section-level mutations from arrow chips / remove
  | Envelope<
      "move",
      {
        instanceId: string;
        direction: "up" | "down" | "left" | "right";
      }
    >
  | Envelope<"remove", { instanceId: string }>
  // Inline text edit (Module 5 will emit)
  | Envelope<
      "text-edit",
      { instanceId: string; elementKey: string; value: string }
    >
  // Merchant asked to open the contextual toolbar for a specific
  // element (Enter key, double-click, or explicit request). Module 2
  // wires the toolbar; until then editor stubs the case as no-op.
  | Envelope<
      "request-toolbar",
      { treeId: string; source: "keyboard" | "double-click" | "explicit" }
    >
  // Toolbar button fired — every tool (Edit / Style / Colour /
  // Replace / Crop / AI / Duplicate / Delete / …) routes through here.
  // Modules 5-9 subscribe based on the `tool` string. Kind + priority
  // are included so the editor can dispatch without a registry lookup.
  | Envelope<
      "tool-action",
      {
        treeId: string;
        tool: string;
        kind: "section" | "element" | "page";
        priority?: "text" | "image" | "button" | "card" | "container";
      }
    >
  // Tree responses + change notifications
  | Envelope<"tree", { snapshot: TreeSnapshot }>
  | Envelope<
      "tree-changed",
      { snapshot: TreeSnapshot; reason: TreeChangeReason }
    >
  // Analytics — writes into studio_layout_events via /api/studio/telemetry
  | Envelope<
      "telemetry",
      {
        event: string;
        tags?: string[];
        metadata?: Record<string, unknown>;
      }
    >
  // Merchant hit Cmd/Ctrl+Z (or Cmd/Ctrl+Shift+Z) inside the iframe.
  // History lives editor-side (Module 3), so we bubble the request
  // through the bus. Same envelope shape appears in the inbound union
  // above so future modules can also send undo/redo iframe-ward.
  | Envelope<"undo", Record<string, never>>
  | Envelope<"redo", Record<string, never>>;

// ─── Discriminant helpers ─────────────────────────────────────────
//
// TypeScript can narrow via `type` field — these helpers exist for
// runtime code that receives raw messages without static typing (e.g.
// telemetry pipeline routing).

export type BusMessage = BusInboundMessage | BusOutboundMessage;
export type BusMessageType = BusMessage["type"];

/** Extract the payload shape for a given type string. Use like:
 *  `Extract<BusInboundMessage, { type: "apply-layout" }>["payload"]` */
export type PayloadOf<
  TMsg extends BusMessage,
  TType extends TMsg["type"]
> = Extract<TMsg, { type: TType }>["payload"];
