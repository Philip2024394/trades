"use client";

// useStudioAnalytics — wires the customer-side beacon into a rendered
// studio page.
//
//   • Starts the beacon (idempotent, safe to re-mount).
//   • Emits a `view` event once per section-instance-per-pageload, using
//     IntersectionObserver to detect entry into viewport ≥ 40%.
//   • Emits `click` events for clicks that fall inside a section, with
//     the nearest link/button text captured as `payload.label`.
//   • Emits `scroll` milestones (25 / 50 / 75 / 100) once each per
//     pageload.
//
// Runs only when `mode === "preview"` — editor mode is muted so the
// merchant doesn't pollute their own analytics.

import { useEffect, useRef } from "react";
import { startBeacon, track } from "./beacon";
import type { StudioLayoutJson } from "../schema";

type Params = {
  enabled: boolean;
  brandId: string | null;
  pageId: string | null;
  layout: StudioLayoutJson;
};

export function useStudioAnalytics({ enabled, brandId, pageId, layout }: Params) {
  const viewedRef = useRef<Set<string>>(new Set());
  const scrollMilestonesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    startBeacon({ brand_id: brandId, page_id: pageId });
  }, [enabled, brandId, pageId]);

  // ─── Section view tracking (IntersectionObserver) ────────────
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (typeof IntersectionObserver === "undefined") return;

    const observed = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const instanceId = el.getAttribute("data-tree-id") ?? "";
          if (!instanceId) continue;
          if (viewedRef.current.has(instanceId)) continue;
          viewedRef.current.add(instanceId);

          const sectionKey = el.getAttribute("data-studio-section") ?? null;
          // A/B decoration lives on the RowRenderer wrapper (parent of
          // the section root) — walk up to find it.
          const expWrapper = el.closest<HTMLElement>("[data-experiment-id]");
          const bucket = (expWrapper?.getAttribute("data-variant-bucket") ??
            undefined) as "A" | "B" | undefined;
          const experimentId =
            expWrapper?.getAttribute("data-experiment-id") ?? null;

          // instance_id in the tree DOM is prefixed "sec:<id>" — the
          // beacon column is the raw instance id, so strip that.
          const rawInstance = instanceId.startsWith("sec:")
            ? instanceId.slice(4)
            : instanceId;

          track("view", {
            section_key: sectionKey,
            instance_id: rawInstance,
            variant_bucket: bucket ?? null,
            experiment_id: experimentId
          });
        }
      },
      { threshold: 0.4 }
    );

    const attach = () => {
      const nodes = document.querySelectorAll<HTMLElement>(
        "[data-tree-id]:not([data-tree-id='page'])"
      );
      nodes.forEach((n) => {
        if (observed.has(n)) return;
        observed.add(n);
        io.observe(n);
      });
    };

    attach();
    // Layout can add sections after mount — watch the tree root for
    // new nodes.
    const mo = new MutationObserver(() => attach());
    const root =
      document.querySelector<HTMLElement>('[data-tree-id="page"]') ??
      document.body;
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [enabled, layout]);

  // ─── Click tracking (delegated) ──────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    if (typeof document === "undefined") return;

    const onClick = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      // Walk up to find the enclosing section instance.
      const section = target.closest<HTMLElement>(
        "[data-tree-id]:not([data-tree-id='page'])"
      );
      if (!section) return;
      // Only fire for meaningful click targets: anchors, buttons,
      // role=button. Reduces noise from body-taps.
      const clickable = target.closest<HTMLElement>(
        "a, button, [role='button']"
      );
      if (!clickable) return;

      const label =
        (clickable.getAttribute("aria-label") ?? "").trim() ||
        (clickable.textContent ?? "").trim().slice(0, 80);
      const href = clickable.getAttribute("href") ?? undefined;

      const rawTreeId = section.getAttribute("data-tree-id") ?? "";
      const rawInstance = rawTreeId.startsWith("sec:")
        ? rawTreeId.slice(4)
        : rawTreeId;
      const expWrapper = section.closest<HTMLElement>("[data-experiment-id]");
      const bucket = (expWrapper?.getAttribute("data-variant-bucket") ??
        undefined) as "A" | "B" | undefined;
      const experimentId =
        expWrapper?.getAttribute("data-experiment-id") ?? null;

      track("click", {
        section_key: section.getAttribute("data-studio-section") ?? null,
        instance_id: rawInstance || null,
        variant_bucket: bucket ?? null,
        experiment_id: experimentId,
        payload: {
          label: label || undefined,
          href,
          tag: clickable.tagName.toLowerCase()
        }
      });

      // Convert-heuristic: anchors that jump to whatsapp / tel / mailto
      // are treated as conversion signals.
      if (
        href &&
        (href.startsWith("https://wa.me/") ||
          href.startsWith("whatsapp:") ||
          href.startsWith("tel:") ||
          href.startsWith("mailto:"))
      ) {
        track("convert", {
          section_key: section.getAttribute("data-studio-section") ?? null,
          instance_id: rawInstance || null,
          variant_bucket: bucket ?? null,
          experiment_id: experimentId,
          payload: { channel: href.split(":")[0] }
        });
      }
    };

    document.addEventListener("click", onClick, { capture: true });
    return () =>
      document.removeEventListener("click", onClick, { capture: true });
  }, [enabled]);

  // ─── Scroll depth milestones ────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const onScroll = () => {
      const doc = document.documentElement;
      const scrolled = window.scrollY + window.innerHeight;
      const total = doc.scrollHeight;
      if (total <= window.innerHeight) return; // nothing to scroll
      const pct = Math.floor((scrolled / total) * 100);
      for (const mark of [25, 50, 75, 100]) {
        if (pct >= mark && !scrollMilestonesRef.current.has(mark)) {
          scrollMilestonesRef.current.add(mark);
          track("view", {
            section_key: "page",
            instance_id: "page",
            payload: { scroll_depth: mark }
          });
        }
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled]);
}
