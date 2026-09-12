// src/app/nex/pwa/page.tsx
//
// Founder PWA-1 · client-side service-worker installer page.
// Visit /nex/pwa once from the phone browser to register the SW.
// Subsequent visits to /nex/observatory · /nex/gaps · /api/nex/attributions
// benefit from offline-first cache-then-network behaviour.

"use client";

import { useEffect, useState } from "react";

export default function NexPwaPage() {
  const [status, setStatus] = useState<string>("checking…");
  const [detail, setDetail] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
        setStatus("unsupported");
        setDetail("This browser does not support Service Workers.");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/nex-sw.js", { scope: "/" });
        setStatus("registered");
        setDetail(`scope=${reg.scope}  ·  ready to cache verified NEX answers for offline use.`);
      } catch (e) {
        setStatus("failed");
        setDetail(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "40px auto", padding: 20 }}>
      <h1 style={{ fontSize: 20, marginBottom: 6 }}>NEX · Offline Cache</h1>
      <p style={{ opacity: 0.7, fontSize: 13, marginTop: 0 }}>
        Registering the offline service worker so NEX answers survive Wi-Fi drops.
      </p>
      <div style={{
        marginTop: 16, padding: 12, border: "1px solid #e5e7eb", borderRadius: 8,
        background: status === "registered" ? "#ecfdf5" : status === "failed" ? "#fef2f2" : "#f8fafc",
        borderColor: status === "registered" ? "#10b981" : status === "failed" ? "#b91c1c" : "#e5e7eb",
      }}>
        <div style={{ fontWeight: 600 }}>Status: {status}</div>
        <div style={{ opacity: 0.75, fontSize: 13, marginTop: 4 }}>{detail}</div>
      </div>
      <p style={{ opacity: 0.6, fontSize: 12, marginTop: 20 }}>
        Cached routes: /nex/observatory · /nex/gaps · /api/nex/attributions ·
        /api/nex/observatory/snapshot.
        Cache is served only when the network fails. Verified NEX answers still traverse the Fabrication Gate v2
        + Truth Engine at the time they were originally cached.
      </p>
    </div>
  );
}
