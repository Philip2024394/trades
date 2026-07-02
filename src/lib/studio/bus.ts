// Studio postMessage bus — client library.
//
// One-stop imports for both sides:
//
//   Editor (parent):
//     sendToIframe(iframeRef, message)
//     useBusFromIframe(iframeRef, handler)
//
//   Iframe (child):
//     sendToParent(message)
//     useBusFromParent(handler)
//
// Both hooks:
//   • Filter by protocol version — anything not v1 is dropped silently.
//   • Filter by window identity — only accept from the expected source.
//   • Use a ref for the handler so components never re-subscribe when
//     the handler closure changes on each render.

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import {
  BUS_TARGET_ORIGIN,
  STUDIO_PROTOCOL_VERSION,
  type BusInboundMessage,
  type BusOutboundMessage
} from "./busTypes";

// ─── Sending ──────────────────────────────────────────────────────

export function sendToIframe(
  iframe: HTMLIFrameElement | null,
  message: BusInboundMessage
): void {
  const target = iframe?.contentWindow ?? null;
  if (!target) return;
  target.postMessage(message, BUS_TARGET_ORIGIN);
}

export function sendToParent(message: BusOutboundMessage): void {
  if (typeof window === "undefined") return;
  const parent = window.parent;
  if (!parent || parent === window) return; // not iframed — drop
  parent.postMessage(message, BUS_TARGET_ORIGIN);
}

// ─── Parsing / guards ─────────────────────────────────────────────

/** Type-narrow an arbitrary MessageEvent.data into one of the two
 *  direction-scoped unions. Returns null if the payload isn't ours. */
export function parseBusMessage<
  T extends BusInboundMessage | BusOutboundMessage
>(raw: unknown): T | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as { v?: unknown; type?: unknown; payload?: unknown };
  if (m.v !== STUDIO_PROTOCOL_VERSION) return null;
  if (typeof m.type !== "string") return null;
  if (m.payload === undefined || m.payload === null) return null;
  return m as T;
}

// ─── React hooks ──────────────────────────────────────────────────

/** Iframe-side listener. Fires only for messages coming from the
 *  parent window. `handler` is stored in a ref so consumers can pass a
 *  fresh closure every render without re-binding the event. */
export function useBusFromParent(
  handler: (msg: BusInboundMessage) => void
): void {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (typeof window === "undefined") return;
      // Only from the parent that iframed us.
      if (e.source !== window.parent) return;
      const msg = parseBusMessage<BusInboundMessage>(e.data);
      if (msg) ref.current(msg);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
}

/** Parent-side listener. Fires only for messages coming from the
 *  iframe pointed at by `iframeRef`. */
export function useBusFromIframe(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  handler: (msg: BusOutboundMessage) => void
): void {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      if (e.source !== iframe.contentWindow) return;
      const msg = parseBusMessage<BusOutboundMessage>(e.data);
      if (msg) ref.current(msg);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [iframeRef]);
}

// ─── Convenience emitters ─────────────────────────────────────────
//
// One-line callers for the messages most consumers fire. Fully typed
// via BusOutboundMessage / BusInboundMessage so type errors surface at
// the call site, not inside the emit.

export const iframeEmit = {
  ready(capabilities: string[] = []) {
    sendToParent({
      v: STUDIO_PROTOCOL_VERSION,
      type: "ready",
      payload: {
        protocolVersion: STUDIO_PROTOCOL_VERSION,
        capabilities
      }
    });
  },
  select(treeId: string | null) {
    sendToParent({
      v: STUDIO_PROTOCOL_VERSION,
      type: "select",
      payload: { treeId }
    });
  },
  hover(treeId: string | null) {
    sendToParent({
      v: STUDIO_PROTOCOL_VERSION,
      type: "hover",
      payload: { treeId }
    });
  },
  move(
    instanceId: string,
    direction: "up" | "down" | "left" | "right"
  ) {
    sendToParent({
      v: STUDIO_PROTOCOL_VERSION,
      type: "move",
      payload: { instanceId, direction }
    });
  },
  remove(instanceId: string) {
    sendToParent({
      v: STUDIO_PROTOCOL_VERSION,
      type: "remove",
      payload: { instanceId }
    });
  },
  textEdit(instanceId: string, elementKey: string, value: string) {
    sendToParent({
      v: STUDIO_PROTOCOL_VERSION,
      type: "text-edit",
      payload: { instanceId, elementKey, value }
    });
  },
  telemetry(event: string, metadata?: Record<string, unknown>, tags?: string[]) {
    sendToParent({
      v: STUDIO_PROTOCOL_VERSION,
      type: "telemetry",
      payload: { event, metadata, tags }
    });
  },
  requestToolbar(treeId: string, source: "keyboard" | "double-click" | "explicit") {
    sendToParent({
      v: STUDIO_PROTOCOL_VERSION,
      type: "request-toolbar",
      payload: { treeId, source }
    });
  },
  toolAction(
    treeId: string,
    tool: string,
    kind: "section" | "element" | "page",
    priority?: "text" | "image" | "button" | "card" | "container"
  ) {
    sendToParent({
      v: STUDIO_PROTOCOL_VERSION,
      type: "tool-action",
      payload: { treeId, tool, kind, priority }
    });
  },
  undo() {
    sendToParent({
      v: STUDIO_PROTOCOL_VERSION,
      type: "undo",
      payload: {}
    });
  },
  redo() {
    sendToParent({
      v: STUDIO_PROTOCOL_VERSION,
      type: "redo",
      payload: {}
    });
  },
  tree(snapshot: import("./treeTypes").TreeSnapshot) {
    sendToParent({
      v: STUDIO_PROTOCOL_VERSION,
      type: "tree",
      payload: { snapshot }
    });
  },
  treeChanged(
    snapshot: import("./treeTypes").TreeSnapshot,
    reason: import("./treeTypes").TreeChangeReason
  ) {
    sendToParent({
      v: STUDIO_PROTOCOL_VERSION,
      type: "tree-changed",
      payload: { snapshot, reason }
    });
  }
};

export const editorEmit = {
  applyLayout(
    iframe: HTMLIFrameElement | null,
    layout: import("./schema").StudioLayoutJson
  ) {
    sendToIframe(iframe, {
      v: STUDIO_PROTOCOL_VERSION,
      type: "apply-layout",
      payload: { layout }
    });
  },
  setSelected(iframe: HTMLIFrameElement | null, treeId: string | null) {
    sendToIframe(iframe, {
      v: STUDIO_PROTOCOL_VERSION,
      type: "set-selected",
      payload: { treeId }
    });
  },
  setHover(iframe: HTMLIFrameElement | null, treeId: string | null) {
    sendToIframe(iframe, {
      v: STUDIO_PROTOCOL_VERSION,
      type: "set-hover",
      payload: { treeId }
    });
  },
  setMode(
    iframe: HTMLIFrameElement | null,
    mode: import("./sectionTypes").SectionRenderMode
  ) {
    sendToIframe(iframe, {
      v: STUDIO_PROTOCOL_VERSION,
      type: "set-mode",
      payload: { mode }
    });
  },
  setTokens(
    iframe: HTMLIFrameElement | null,
    tokens: import("./sectionTypes").BrandTokens
  ) {
    sendToIframe(iframe, {
      v: STUDIO_PROTOCOL_VERSION,
      type: "set-tokens",
      payload: { tokens }
    });
  },
  setBreakpoint(
    iframe: HTMLIFrameElement | null,
    breakpoint: "mobile" | "tablet" | "desktop"
  ) {
    sendToIframe(iframe, {
      v: STUDIO_PROTOCOL_VERSION,
      type: "set-breakpoint",
      payload: { breakpoint }
    });
  },
  scrollTo(
    iframe: HTMLIFrameElement | null,
    treeId: string,
    behavior: "smooth" | "auto" = "smooth"
  ) {
    sendToIframe(iframe, {
      v: STUDIO_PROTOCOL_VERSION,
      type: "scroll-to",
      payload: { treeId, behavior }
    });
  },
  requestTree(iframe: HTMLIFrameElement | null) {
    sendToIframe(iframe, {
      v: STUDIO_PROTOCOL_VERSION,
      type: "request-tree",
      payload: {}
    });
  }
};
