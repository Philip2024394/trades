// Nex Booker — the customer-facing bookkeeping/business-admin module.
//
// Route: /nex-app/nex-booker
//
// STATUS: v0 stub. Phase 0 foundations (immutable event log, deterministic
// double-entry ledger, versioned compliance engine, locked-period enforcement,
// accountant-role permissions) are under construction in the backend layer
// and are not yet user-visible. This page exists so navigation from the ops
// dashboard button lands somewhere honest rather than 404-ing.
//
// When Phase 0 backend lands, this page becomes the shell for:
//   · Add expense (photo · voice · manual)
//   · Send invoice
//   · See my money (P&L glance)
//   · Ready for accountant (period lock + review handoff)
//   · Business Health Score tile
//
// Naming doctrine: `project_nex_booker_product_name_2026_08_06.md` in memory.
// Never expose accounting vocabulary in this UI — verbs the user thinks in.

import Link from "next/link";
import "../nex-app.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Nex Booker · Business Admin",
  robots: { index: false },
};

const TOKEN = {
  bg:          "var(--nex-cream)",
  card:        "var(--nex-neutral-0)",
  border:      "var(--nex-neutral-200)",
  divider:     "var(--nex-neutral-100)",
  text:        "var(--nex-neutral-900)",
  textSoft:    "var(--nex-neutral-500)",
  textMid:     "var(--nex-neutral-700)",
  accent:      "var(--nex-accent-500)",
  accentDark:  "var(--nex-accent-600)",
  accentSoft:  "var(--nex-accent-50)",
  shadowSm:    "var(--nex-shadow-sm)",
};

export default function NexBookerPage() {
  return (
    <div className="nex-app-root" style={{ background: TOKEN.bg, color: TOKEN.text, minHeight: "100vh" }}>
      <div className="mx-auto max-w-[880px] px-5 pb-24 pt-10 md:px-8 md:pt-16">
        {/* Hero */}
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
             style={{ background: TOKEN.accentSoft, borderColor: TOKEN.accentDark, color: TOKEN.accentDark }}>
          Nex Booker · v0
        </div>
        <h1 className="text-[36px] font-black leading-tight tracking-tight md:text-[44px]">
          Your business admin, quietly organised.
        </h1>
        <p className="mt-3 max-w-[620px] text-[15px] leading-relaxed" style={{ color: TOKEN.textMid }}>
          Foundations are under construction. Nex Booker prepares your books to a professional standard —
          receipts, invoices, cash flow, VAT — and hands them to your accountant for final review and filing.
          You keep working. Nex Booker keeps the paperwork organised. Your accountant signs off.
        </p>

        {/* Status card */}
        <section
          className="mt-8 rounded-2xl border p-5"
          style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>
            Build status
          </div>
          <h2 className="mt-1 text-[18px] font-bold" style={{ color: TOKEN.text }}>
            Phase 0 · foundations
          </h2>
          <ul className="mt-4 space-y-2 text-[13px]" style={{ color: TOKEN.textMid }}>
            <li>◻ Immutable event log</li>
            <li>◻ Deterministic double-entry ledger</li>
            <li>◻ Versioned compliance engine (UK first)</li>
            <li>◻ Locked-period enforcement</li>
            <li>◻ Accountant-role permissions</li>
            <li>◻ Posting engine (pure functions, unit-tested)</li>
          </ul>
          <p className="mt-4 text-[12px]" style={{ color: TOKEN.textSoft }}>
            All architectural — no user-facing capability shipped until foundations are complete and verified.
            Doctrine: <span style={{ fontFamily: "monospace" }}>project_nex_bookkeeping_membership_opportunity_2026_08_06.md</span>.
          </p>
        </section>

        {/* Promise */}
        <section
          className="mt-6 rounded-2xl border p-5"
          style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>
            The promise
          </div>
          <p className="mt-2 text-[15px] font-medium leading-relaxed" style={{ color: TOKEN.text }}>
            &ldquo;Nex Booker prepares your accounts. Your accountant reviews and files them.&rdquo;
          </p>
          <p className="mt-3 text-[13px] leading-relaxed" style={{ color: TOKEN.textMid }}>
            Nex Booker never files with a tax authority directly. Every period ships through a three-layer
            double-check (per-transaction · batch · accountant workspace) before your human accountant
            signs it off. Trust is built by keeping the human professional in the loop, not replaced by AI.
          </p>
        </section>

        {/* Back nav */}
        <div className="mt-8">
          <Link
            href="/nex-app/nex-brain"
            className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12px] font-semibold"
            style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.textMid }}
          >
            ← Back to Nex Brain ops
          </Link>
        </div>
      </div>
    </div>
  );
}
