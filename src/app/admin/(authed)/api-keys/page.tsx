// /admin/api-keys — API-key operations centre.
//
// Renders the declarative registry (src/lib/adminKeys/registry.ts) with:
//   • Green ✓ if the env var is present at runtime, red ✗ if missing
//   • Purpose · what the key does
//   • Affected areas · routes/features that consume it (so if a
//     feature is broken you can trace it back to a missing key)
//   • Fallback behaviour · what breaks if the key is absent
//   • Provider console link · dashboard for status / billing / logs
//   • Get-key link · direct URL to create or rotate the key
//
// NEVER displays the key value itself — presence check only.
//
// Add a new integration → add an entry in the registry, and it
// appears here automatically.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Key, ShieldCheck, ShieldAlert, ExternalLink, BookOpen, AlertTriangle } from "lucide-react";
import { assertAdminRole } from "@/lib/admin/rbac";
import {
  API_KEY_REGISTRY,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  groupByCategory,
  type ApiKeyEntry,
  type KeyRequirement
} from "@/lib/adminKeys/registry";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";
const BRAND_RED    = "#B91C1C";

/** Runs at request time — reads process.env for each registered key. */
function checkPresence(envName: string): boolean {
  const v = process.env[envName];
  return typeof v === "string" && v.trim().length > 0;
}

export default async function AdminApiKeysPage() {
  const auth = await assertAdminRole(["admin"]);
  if (!auth.ok) redirect("/admin/login?next=/admin/api-keys");

  const groups = groupByCategory();

  // Global tally
  const total       = API_KEY_REGISTRY.length;
  const present     = API_KEY_REGISTRY.filter(e => checkPresence(e.envName)).length;
  const requiredMissing = API_KEY_REGISTRY.filter(
    e => e.requirement === "required" && !checkPresence(e.envName)
  );

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft size={11}/> Network Health
        </Link>

        <header className="mt-3 mb-5">
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: BRAND_YELLOW }}>
            API Keys
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-[24px] font-black text-neutral-900">
            <Key size={22}/> Integrations + secrets
          </h1>
          <p className="mt-1 max-w-3xl text-[12.5px] text-neutral-600">
            Every third-party API key + internal secret the platform uses. Check presence here,
            follow the link to the provider dashboard to rotate or check billing. Key values
            are never displayed — only the env var name + runtime presence.
          </p>
        </header>

        {/* Global stats */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          <StatChip
            label="Total registered"
            value={total.toString()}
            colour="#0A0A0A"
            icon={<Key size={11}/>}
          />
          <StatChip
            label="Present at runtime"
            value={`${present} / ${total}`}
            colour={BRAND_GREEN}
            icon={<ShieldCheck size={11}/>}
          />
          <StatChip
            label="Required + missing"
            value={requiredMissing.length.toString()}
            colour={requiredMissing.length > 0 ? BRAND_RED : "#94908A"}
            icon={<ShieldAlert size={11}/>}
          />
        </div>

        {/* Critical-missing alert */}
        {requiredMissing.length > 0 && (
          <div
            className="mb-5 rounded-2xl border-2 p-4"
            style={{ borderColor: BRAND_RED, backgroundColor: "#FEF2F2" }}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-700"/>
              <div>
                <p className="text-[12.5px] font-black text-red-900">
                  {requiredMissing.length} required key{requiredMissing.length === 1 ? "" : "s"} missing
                </p>
                <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-red-800">
                  {requiredMissing.map(k => (
                    <li key={k.envName} className="font-mono">· {k.envName} <span className="not-italic font-sans text-red-700">({k.provider})</span></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Category groups */}
        <div className="space-y-6">
          {CATEGORY_ORDER.map(cat => {
            const entries = groups[cat];
            if (!entries || entries.length === 0) return null;
            return (
              <section key={cat}>
                <h2 className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-600">
                  {CATEGORY_LABELS[cat]} · {entries.length}
                </h2>
                <ul className="space-y-2">
                  {entries.map(entry => (
                    <KeyCard key={entry.envName} entry={entry} present={checkPresence(entry.envName)}/>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        {/* Add-a-key footer */}
        <div
          className="mt-6 rounded-2xl border-2 p-4"
          style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FFFDF6" }}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Adding a new integration?
          </p>
          <ol className="mt-2 list-decimal pl-5 text-[12px] leading-relaxed text-neutral-700">
            <li>Add the key to <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[11px]">.env.local</code> (dev) or Vercel env (prod).</li>
            <li>Add an entry to <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[11px]">src/lib/adminKeys/registry.ts</code> — this page auto-updates.</li>
            <li>Restart the dev server so the new env var loads.</li>
          </ol>
        </div>
      </div>
    </main>
  );
}

// ─── UI components ────────────────────────────────────────────────

function StatChip({ label, value, colour, icon }: {
  label: string; value: string; colour: string; icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border-2 bg-white p-2" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <p className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: colour }}>
        {icon} {label}
      </p>
      <p className="mt-0.5 text-[16px] font-black tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}

function RequirementPill({ requirement }: { requirement: KeyRequirement }) {
  const map: Record<KeyRequirement, { bg: string; text: string; label: string }> = {
    "required":  { bg: BRAND_RED,     text: "#FFFFFF", label: "Required" },
    "optional":  { bg: "#94908A",     text: "#FFFFFF", label: "Optional" },
    "dev-only":  { bg: "#0A0A0A",     text: BRAND_YELLOW, label: "Dev only" }
  };
  const s = map[requirement];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

function PresencePill({ present }: { present: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
      style={{ backgroundColor: present ? BRAND_GREEN : BRAND_RED }}
    >
      {present ? <ShieldCheck size={10} strokeWidth={2.6}/> : <ShieldAlert size={10} strokeWidth={2.6}/>}
      {present ? "Set" : "Missing"}
    </span>
  );
}

function KeyCard({ entry, present }: { entry: ApiKeyEntry; present: boolean }) {
  const borderColour = !present && entry.requirement === "required"
    ? BRAND_RED
    : "rgba(0,0,0,0.08)";

  const hasProviderLinks = entry.category !== "internal-secrets";

  return (
    <li
      className="rounded-2xl border-2 bg-white p-4 shadow-sm"
      style={{ borderColor: borderColour }}
    >
      {/* Header · env var name + status pills */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-neutral-100 px-2 py-1 font-mono text-[12px] font-black text-neutral-900">
              {entry.envName}
            </code>
            <PresencePill present={present}/>
            <RequirementPill requirement={entry.requirement}/>
          </div>
          <p className="mt-1.5 text-[11px] font-black uppercase tracking-wider text-neutral-500">
            {entry.provider}
          </p>
        </div>
      </div>

      {/* Purpose */}
      <p className="mt-3 text-[13px] leading-relaxed text-neutral-800">
        {entry.purpose}
      </p>

      {/* Areas + fallback */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[9.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Powers these areas
          </p>
          <ul className="mt-1 space-y-0.5 text-[11.5px] text-neutral-700">
            {entry.areas.map((a, i) => (
              <li key={i} className="flex gap-1"><span className="text-neutral-400">·</span><span>{a}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[9.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
            If missing
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-neutral-700">
            {entry.fallbackBehaviour}
          </p>
          {entry.notes && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[10.5px] italic text-amber-900">
              Note: {entry.notes}
            </p>
          )}
        </div>
      </div>

      {/* Provider links */}
      {hasProviderLinks && (
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          {entry.providerConsoleUrl && (
            <a
              href={entry.providerConsoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-md border-2 bg-white px-2.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-900 hover:-translate-y-0.5 transition"
              style={{ borderColor: "rgba(0,0,0,0.15)" }}
            >
              <ExternalLink size={10}/> Console
            </a>
          )}
          {entry.getKeyUrl && (
            <a
              href={entry.getKeyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm active:scale-[0.97]"
              style={{ backgroundColor: BRAND_YELLOW }}
            >
              <Key size={10}/> Get / rotate key <ArrowUpRight size={10}/>
            </a>
          )}
          {entry.docsUrl && (
            <a
              href={entry.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-md border-2 bg-white px-2.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-900 hover:-translate-y-0.5 transition"
              style={{ borderColor: "rgba(0,0,0,0.15)" }}
            >
              <BookOpen size={10}/> Docs
            </a>
          )}
        </div>
      )}
    </li>
  );
}
