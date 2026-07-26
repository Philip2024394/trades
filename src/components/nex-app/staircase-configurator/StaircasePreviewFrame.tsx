"use client";

// StaircasePreviewFrame — React wrapper around the vanilla-JS Three.js preview
// at /staircase-preview/mat-002-flight-3d.html. Embeds the HTML via <iframe> so
// the existing renderer + governance stay intact, and forwards config changes
// as postMessage events (no reload — the preview updates in place).
//
// Waits for the iframe to emit {type:"nex-preview-ready"} before pushing config.
// Re-sends the full config on every change so late-mounted controls stay in sync.
//
// Only the subset of options the current HTML supports is forwarded (balusters,
// sheeting, lighting, roundStep, varnish, sheetingTone). Additional categories
// go silently ignored on the HTML side until the geometry engine grows to cover
// them — that's the intended "quiet forward-compat" pattern.

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

const PREVIEW_URL = "/staircase-preview/mat-002-flight-3d.html";

export type StaircasePreviewHandle = {
  /** Ask the iframe to render + snapshot its WebGL canvas. Resolves with a
   *  data URL (image/jpeg), or null if capture failed / timed out. */
  captureThumbnail: (timeoutMs?: number) => Promise<string | null>;
};

export type PreviewPayload = {
  balusters?:     string;   // categoryId "balusters" optionId
  sheeting?:      string;   // "unfinished" = off, anything else = on
  lighting?:      string;   // "off" = off, anything else = on
  roundStep?:     boolean;
  varnish?:       boolean;
  sheetingTone?:  number;   // [-0.30, 0.30]
  steps?:         string;   // "oak-40" | "oak-32" | "walnut-40" | "ash-40"
  risers?:        string;   // "matching" | "white-paint" | "open"
  finish?:        string;   // "varnish-clear" | "oil-matte" | "stain-walnut" | "stain-black" | "white-painted"
};

export const StaircasePreviewFrame = forwardRef<
  StaircasePreviewHandle,
  {
    /** Map of categoryId → optionId (the same shape used by the drawer). */
    config: Record<string, string>;
    className?: string;
    /** CSS aspect-ratio value for the iframe container. */
    aspectRatio?: string;
  }
>(function StaircasePreviewFrame({ config, className = "", aspectRatio = "16 / 10" }, ref) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);

  // Convert the flat configurator state into the payload the preview expects.
  const payload: PreviewPayload = {
    balusters: config.balusters,
    sheeting:  config.sheeting,
    lighting:  config.lighting,
    // No dedicated "roundStep" category yet; preview stays with whatever the
    // user last set. Once the drawer adds one, wire it here.
    varnish:   config.finish === "varnish-clear" || config.finish === "oil-matte",
    steps:     config.steps,
    risers:    config.risers,
    finish:    config.finish,
  };

  // Listen for the ready signal from the iframe.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;
      if ((e.data as { type?: string }).type === "nex-preview-ready") setReady(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Expose a captureThumbnail() method to the parent. Uses a per-request id so
  // multiple concurrent captures don't cross-talk. Resolves null on timeout.
  useImperativeHandle(
    ref,
    () => ({
      captureThumbnail: (timeoutMs = 2500) =>
        new Promise<string | null>((resolve) => {
          const win = iframeRef.current?.contentWindow;
          if (!win || !ready) {
            resolve(null);
            return;
          }
          const requestId = `thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const onMsg = (e: MessageEvent) => {
            const d = e.data as { type?: string; requestId?: string; dataUrl?: string } | null;
            if (!d || d.type !== "nex-thumbnail" || d.requestId !== requestId) return;
            window.removeEventListener("message", onMsg);
            clearTimeout(timer);
            resolve(typeof d.dataUrl === "string" ? d.dataUrl : null);
          };
          const timer = setTimeout(() => {
            window.removeEventListener("message", onMsg);
            resolve(null);
          }, timeoutMs);
          window.addEventListener("message", onMsg);
          win.postMessage({ type: "nex-capture-thumbnail", requestId }, "*");
        }),
    }),
    [ready]
  );

  // Push config on every payload change, once the iframe is ready.
  useEffect(() => {
    if (!ready) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ type: "nex-config", payload }, "*");
    // Payload object identity changes every render but content-equality is
    // what matters — the iframe ignores no-op toggles, so a redundant post is
    // cheap. Depend on JSON to avoid infinite render loops from new object refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, JSON.stringify(payload)]);

  return (
    <div
      className={[
        "relative w-full overflow-hidden rounded-lg border border-border bg-muted",
        className,
      ].join(" ")}
      style={{ aspectRatio }}
    >
      <iframe
        ref={iframeRef}
        src={PREVIEW_URL}
        title="3D staircase preview"
        className="absolute inset-0 w-full h-full"
        // No sandbox — same-origin static file served from /public. Enabling
        // sandbox would strip Three.js's need for scripts + WebGL contexts.
      />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-muted/80 backdrop-blur-sm">
          <p className="text-body-sm text-muted-foreground">Loading 3D preview…</p>
        </div>
      )}
    </div>
  );
});
