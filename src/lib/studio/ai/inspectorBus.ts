// inspectorBus — cross-iframe postMessage protocol for the Inspector.
//
// The preview iframe hosts editable elements; the shell hosts the
// Inspector rail. This bus formalises the messages they exchange so
// both sides typecheck against the same shapes.
//
// Direction:
//   • parent → iframe: inspector mode toggle
//   • iframe → parent: selection events, hover events
//
// Origin check omitted — the iframe is same-origin (/studio/build/preview).

export type InspectorElementKind =
  | "button"
  | "hero"
  | "text"
  | "image"
  | "section"
  | "unknown";

export type InspectorSelection = {
  kind: InspectorElementKind;
  /** Optional Studio section instance id when the click landed inside
   *  an assembled section. */
  instanceId?: string;
  /** Optional section registry key. */
  sectionKey?: string;
  /** Human label used in the inspector title. */
  label: string;
  /** Snapshot of the current element config for the inspector to edit. */
  config?: Record<string, unknown>;
};

export type InspectorMessage =
  | { type: "inspector:mode"; active: boolean }
  | { type: "inspector:select"; selection: InspectorSelection }
  | { type: "inspector:clear" }
  | { type: "inspector:apply"; patch: Record<string, unknown> };

/** Send from the parent shell to the iframe. */
export function postToPreview(
  iframe: HTMLIFrameElement | null,
  msg: InspectorMessage
): void {
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage(msg, "*");
}

/** Send from the iframe to the parent shell. */
export function postToParent(msg: InspectorMessage): void {
  if (typeof window === "undefined") return;
  window.parent?.postMessage(msg, "*");
}

export function isInspectorMessage(x: unknown): x is InspectorMessage {
  return (
    !!x &&
    typeof x === "object" &&
    typeof (x as { type?: unknown }).type === "string" &&
    (x as { type: string }).type.startsWith("inspector:")
  );
}
