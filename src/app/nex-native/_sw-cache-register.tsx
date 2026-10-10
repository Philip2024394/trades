"use client";

// src/app/nex-native/_sw-cache-register.tsx
//
// Service-worker registration for CACHING · 2026-10-02.
// ---------------------------------------------------------------------
// Mounts on every /nex-native/* page. Its only job is to register the
// NEX service worker so the fetch-cache strategies take effect from
// the very first page load.
//
// Deliberately separate from PushSubscribeHub (which handles push
// subscription on a signed-in / VAPID-configured basis) · caching is
// valuable for signed-out visitors too and must not be gated on
// permission state or env vars.
//
// register() is idempotent — PushSubscribeHub calling register() later
// on the same path returns the existing registration, no conflict.

import * as React from "react";

export function SwCacheRegister(): null {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Dev-mode guard · Turbopack serves /_next/static/* at non-hashed
    // paths that update via HMR. The SW's cache-first strategy would
    // pin stale JS modules and HMR would silently fail. In dev we
    // UNREGISTER any previously-installed SW and skip registration so
    // every reload is a fresh compile.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => {
          if (reg.scope.includes("/nex-native/")) {
            reg.unregister().catch(() => { /* ignore */ });
          }
        });
        // Also purge the caches so no stale assets linger.
        if ("caches" in window) {
          caches.keys().then((names) => {
            names.forEach((name) => {
              if (name.startsWith("nex-native-")) {
                caches.delete(name).catch(() => { /* ignore */ });
              }
            });
          }).catch(() => { /* ignore */ });
        }
      }).catch(() => { /* ignore */ });
      return;
    }

    // Respect user intent: if the page is served over HTTP (local dev
    // on 127.0.0.1 is fine; prod HTTP is a misconfiguration), skip.
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return;
    }
    navigator.serviceWorker
      .register("/nex-native-sw.js", { scope: "/nex-native/" })
      .catch(() => {
        /* Registration failures (e.g. SW disabled by browser policy)
           are non-fatal · the page still works, just without the
           cache acceleration. */
      });
  }, []);
  return null;
}
