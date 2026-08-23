"use client";

// Promote-to-Directory client button · cream theme · NEX HQ.
// POSTs to /api/nex-food/admin/promote-to-directory · refreshes on success.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function PromoteButton({ publicListingRef }: { publicListingRef: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (!confirm(`Promote ${publicListingRef} to the public Food Directory?\n\nAdmin action. Changes claim_status 'discovered' → 'listed'. NEVER touches owner_verified fields. Audit-logged.\n\nProceed?`)) return;
    setState("submitting");
    setError(null);
    try {
      const resp = await fetch("/api/nex-food/admin/promote-to-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicListingRef, actor: "admin:nex-hq-food-ops" }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error ?? `HTTP ${resp.status}`);
      setState("done");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  if (state === "done") return <span style={{ fontSize: 11, color: "#047857", fontWeight: 600 }}>✓ promoted</span>;
  if (state === "error") return (
    <div>
      <button onClick={onClick} style={buttonStyle}>Retry</button>
      <div style={{ fontSize: 10, color: "#b91c1c", marginTop: 4 }}>{error}</div>
    </div>
  );
  return (
    <button onClick={onClick} disabled={state === "submitting"} style={buttonStyle}>
      {state === "submitting" ? "Promoting…" : "Promote"}
    </button>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: 11,
  fontWeight: 700,
  background: "var(--nex-accent-500)",
  color: "var(--nex-neutral-0)",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
