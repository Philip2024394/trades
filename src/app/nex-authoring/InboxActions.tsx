"use client";

// Small client wrapper for the review-inbox action buttons.
// Buttons live in the server-rendered page · onClick handled here.

import { useCallback, useEffect } from "react";

async function fireAction(action: string, fileSlug: string, sectionId: string): Promise<void> {
  try {
    const res = await fetch("/api/admin/nex/authoring/section", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, file_slug: fileSlug, section_id: sectionId }),
    });
    const j = await res.json();
    if (!res.ok || !j.ok) {
      alert(j.error || "Action failed");
      return;
    }
    if (typeof window !== "undefined") window.location.reload();
  } catch (e) {
    alert(e instanceof Error ? e.message : "Action failed");
  }
}

export function InboxActionsWirer() {
  const handler = useCallback((ev: MouseEvent) => {
    const target = ev.target as HTMLElement | null;
    if (!target) return;

    // Review inbox action buttons (approve · flag · reject)
    const actionBtn = target.closest("[data-authoring-action]") as HTMLElement | null;
    if (actionBtn) {
      const action = actionBtn.getAttribute("data-authoring-action");
      const fileSlug = actionBtn.getAttribute("data-file-slug");
      const sectionId = actionBtn.getAttribute("data-section-id");
      if (!action || !fileSlug || !sectionId) return;
      ev.preventDefault();
      fireAction(action, fileSlug, sectionId);
      return;
    }

    // "Author for this" buttons on gap rows · dispatch seed event
    const gapBtn = target.closest("[data-gap-author]") as HTMLElement | null;
    if (gapBtn) {
      const topic = gapBtn.getAttribute("data-gap-topic") || "";
      const heading = gapBtn.getAttribute("data-gap-heading") || "";
      if (!topic) return;
      ev.preventDefault();
      window.dispatchEvent(new CustomEvent("nex-authoring-seed", { detail: { topic, seedHeading: heading } }));
      return;
    }
  }, []);

  useEffect(() => {
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [handler]);

  return null;
}
