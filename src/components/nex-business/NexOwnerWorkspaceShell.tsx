// NEX Business Context · OWNER NEX WORKSPACE SHELL (Philip 2026-08-14).
//
// The owner sees the FULL NEX workspace · side drawer · module navigation.
// The business identity is present in a small header pill (so the owner
// knows which business they're operating), but the primary chrome is NEX.
//
// Reusable · module list is declarative.

"use client";

import Link from "next/link";
import type { OwnerBusinessIdentity } from "@/lib/nex/business-context/types";
import type { ReactNode } from "react";
import { NexAssistChat } from "./NexAssistChat";

// Canonical NEX workspace modules — extend per app.
const NEX_MODULES: Array<{ id: string; label: string; group: string }> = [
  { id: "conversations", label: "Conversations", group: "Customer" },
  { id: "customers",     label: "Customers",     group: "Customer" },
  { id: "enquiries",     label: "Enquiries",     group: "Customer" },
  { id: "projects",      label: "Projects",      group: "Work" },
  { id: "quotes",        label: "Quotes",        group: "Work" },
  { id: "follow-ups",    label: "Follow-ups",    group: "Work" },
  { id: "images",        label: "Images",        group: "Content" },
  { id: "knowledge",     label: "Knowledge",     group: "Content" },
  { id: "products",      label: "Products",      group: "Catalogue" },
  { id: "materials",     label: "Materials",     group: "Catalogue" },
  { id: "builder",       label: "Builder",       group: "NEX" },
  { id: "preview-qa",    label: "Preview / QA",  group: "NEX" },
  { id: "nex-assist",    label: "NEX Assist",    group: "NEX" },
  { id: "activity",      label: "Activity",      group: "NEX" },
  { id: "company",       label: "Company info",  group: "Settings" },
  { id: "settings",      label: "Settings",      group: "Settings" }
];

export function NexOwnerWorkspaceShell({
  business,
  activeModule,
  children
}: {
  business: OwnerBusinessIdentity;
  activeModule?: string;
  children?: ReactNode;
}) {
  const groups = groupBy(NEX_MODULES, (m) => m.group);
  const groupOrder = ["Customer", "Work", "Content", "Catalogue", "NEX", "Settings"];

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "260px 1fr",
      fontFamily: "Inter, system-ui, sans-serif",
      color: "#1a1a1a",
      background: "#fafafa"
    }}>
      {/* NEX SIDE DRAWER — this is the owner's chrome */}
      <aside style={{
        background: "#111827",
        color: "#e5e7eb",
        padding: "16px 0",
        display: "flex",
        flexDirection: "column"
      }}>
        {/* NEX branding + business pill */}
        <div style={{ padding: "0 16px 16px", borderBottom: "1px solid #1f2937" }}>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", opacity: 0.6, marginBottom: 4 }}>
            NEX Workspace
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "6px 10px", background: "#1f2937", borderRadius: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: business.brand.primary, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: business.brand.onPrimary }}>
              {business.displayName.charAt(0)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {business.displayName}
            </div>
          </div>
        </div>

        {/* Module list · grouped */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
          {groupOrder.map((group) => (
            <div key={group} style={{ marginBottom: 14 }}>
              <div style={{ padding: "0 16px 6px", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.4 }}>
                {group}
              </div>
              {(groups.get(group) ?? []).map((m) => (
                <Link
                  key={m.id}
                  href={`/b/${business.slug}/workspace/${moduleHref(m.id)}`}
                  data-testid={`nex-nav-${m.id}`}
                  style={{
                    display: "block",
                    padding: "8px 16px",
                    fontSize: 14,
                    color: activeModule === m.id ? "#fff" : "#cbd5e1",
                    background: activeModule === m.id ? "#F97316" : "transparent",
                    textDecoration: "none"
                  }}
                >
                  {m.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* NEX signature at the bottom */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid #1f2937", fontSize: 11, opacity: 0.5 }}>
          NEX™ · Blueprint rev {business.blueprintRevision}
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ padding: "24px 32px" }}>
        {children ?? (
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", opacity: 0.55, marginBottom: 6 }}>
              NEX Workspace
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>{business.displayName}</h1>
            <p style={{ margin: "0 0 20px", color: "#4b5563" }}>
              Talk to NEX to change your live business data · every change is proposed, confirmed and audited.
            </p>

            {/* NEX Assist takes primary real estate — Philip 2026-08-14 · Phase 15 */}
            <NexAssistChat businessSlug={business.slug} businessDisplayName={business.displayName} />

            {/* Secondary · module tile grid below */}
            <div style={{ marginTop: 32 }}>
              <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", opacity: 0.55, marginBottom: 10 }}>
                All modules
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {NEX_MODULES.map((m) => (
                  <Link
                    key={m.id}
                    href={`/b/${business.slug}/workspace/${moduleHref(m.id)}`}
                    data-testid={`nex-module-tile-${m.id}`}
                    style={{ padding: "12px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, textDecoration: "none", color: "#1a1a1a" }}
                  >
                    <div style={{ fontSize: 10, letterSpacing: 1, opacity: 0.55, textTransform: "uppercase", marginBottom: 3 }}>
                      {m.group}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{m.label}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  return map;
}

function moduleHref(id: string): string {
  if (id === "conversations") return "conversations";
  if (id === "nex-assist") return "nex-assist";
  if (id === "activity") return "change-history";
  if (id === "builder") return "builder";
  return "";
}
