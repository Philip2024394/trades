// NEX HQ · Directory Factory · Candidate review surface (Phase 2 · 2026-08-23).
//
// Subordinate HQ page — one and only one operational/admin dashboard is
// /nex-head-quarters (per project_nex_dashboard_singularity_constitutional_rule_2026_08_22).
// This page adds NO new dashboard. It provides the human-review surface
// for CATEGORY_CANDIDATE rows written by the Walker candidate-writer
// (Phase 1) — nothing more.
//
// EXPLICITLY OUT OF SCOPE (Phase 2 boundary · locked by Philip 2026-08-23):
//   · No Registry activation. This page's decisions ONLY persist to
//     nex.category_candidate. Actually flipping active=true on a Registry
//     row + wiring routes + wheel + Brain + image resolver + tests is
//     Phase 3 (Factory activation engine).
//   · No new "operations centre" / "dashboard" / "control centre".
//   · No public directory creation.
//
// Reads:
//   nex.category_candidate  (via listCategoryCandidates)
//
// Writes (via DecisionButtons → /api/nex-head-quarters/directory-factory/decide):
//   nex.category_candidate  (admin_decision / admin_reviewed_at / admin_reviewed_by
//                            / admin_notes / duplicate_of_registry_id /
//                            superseded_by_candidate_id)
//
// Never writes to:
//   nex.category_registry · nex.food_business · nex.accommodation_business
//   · any Walker scheduler state · any route file · any component
//
// Doctrine anchors:
//   project_nex_directory_factory_doctrine_2026_08_22 (Decision #1 · route locked here)
//   project_nex_walker_stays_pure_acquisition_2026_08_22
//   project_nex_truth_invariant_2026_08_22

import Link from "next/link";
import { listCategoryCandidates, type CategoryCandidateRow } from "@/lib/nex/category-registry.db";
import { DecisionButtons } from "./DecisionButtons";
import "../../nex-app/nex-app.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "NEX HQ · Directory Factory · Candidates",
  robots: { index: false },
};

export default async function DirectoryFactoryPage() {
  const pending = await listCategoryCandidates("pending");
  // Also surface recent decided candidates so reviewers can audit their
  // own history without leaving the page. Cap the display to avoid a
  // very long list on a live system.
  const decided = (await listCategoryCandidates())?.filter(
    (c) => c.admin_decision !== "pending",
  ).slice(0, 20) ?? [];

  const dbUnavailable = pending === null;

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={h1Style}>Directory Factory · Candidate Review</h1>
          <p style={subtitleStyle}>
            Human approval gate for new customer-facing categories proposed by Walker.
            Decisions here persist to <code>nex.category_candidate</code> only —
            <strong> Registry activation is Phase 3 (not yet built)</strong>.
          </p>
        </div>
        <div style={healthChipStyle(!dbUnavailable)}>
          {dbUnavailable ? "DB unavailable" : `${pending?.length ?? 0} pending`}
        </div>
      </header>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Pending review</h2>
        {dbUnavailable && (
          <div style={emptyStyle}>
            NEX_POSTGRES_URL is not set. Set the environment variable and reload to
            see pending candidates.
          </div>
        )}
        {!dbUnavailable && pending!.length === 0 && (
          <div style={emptyStyle}>
            No pending candidates. Walker writes here when it observes ≥50 businesses
            across ≥2 cycles for a pattern that does not match an existing Registry id.
          </div>
        )}
        {!dbUnavailable && pending!.length > 0 && (
          <div style={cardListStyle}>
            {pending!.map((c) => (
              <CandidateCard key={c.id} candidate={c} showActions />
            ))}
          </div>
        )}
      </section>

      {!dbUnavailable && decided.length > 0 && (
        <section style={sectionStyle}>
          <h2 style={h2Style}>Recently decided ({decided.length})</h2>
          <div style={cardListStyle}>
            {decided.map((c) => (
              <CandidateCard key={c.id} candidate={c} showActions={false} />
            ))}
          </div>
        </section>
      )}

      <footer style={footerStyle}>
        <div>
          Phase 2 · Human decision surface. Approving a candidate persists <code>admin_decision='approved'</code>{" "}
          but does <strong>not</strong> create a Registry row, a route, or a live directory. That is Phase 3.
        </div>
        <div>
          <Link href="/nex-head-quarters">← Reception</Link>
        </div>
      </footer>
    </div>
  );
}

function CandidateCard({
  candidate,
  showActions,
}: {
  candidate: CategoryCandidateRow;
  showActions: boolean;
}) {
  const evidence = candidate.evidence ?? {};
  const businesses = Array.isArray(candidate.discovered_businesses)
    ? candidate.discovered_businesses.slice(0, 8)
    : [];
  const totalSample = Array.isArray(candidate.discovered_businesses)
    ? candidate.discovered_businesses.length
    : 0;

  return (
    <article style={cardStyle(candidate.admin_decision)}>
      <header style={cardHeaderStyle}>
        <div>
          <div style={cardTitleStyle}>
            {candidate.proposed_name}{" "}
            <span style={mutedStyle}>({candidate.proposed_category_id})</span>
          </div>
          <div style={cardMetaStyle}>
            vertical=<strong>{candidate.suggested_parent_vertical}</strong>{" "}
            · country={candidate.suggested_countries.join(",")}{" "}
            · business_count=<strong>{candidate.business_count}</strong>{" "}
            · cycle_count=<strong>{candidate.cycle_count}</strong>{" "}
            · confidence=<strong>{Number(candidate.confidence).toFixed(3)}</strong>
          </div>
        </div>
        <div style={decisionChipStyle(candidate.admin_decision)}>
          {candidate.admin_decision}
        </div>
      </header>

      <div style={rowStyle}>
        <div style={labelStyle}>Proposed by</div>
        <div style={valueStyle}>
          <code>{candidate.proposed_by}</code>
          {candidate.proposed_cycle_run_id && (
            <>
              {" "}· cycle <code>{candidate.proposed_cycle_run_id.slice(0, 8)}…</code>
            </>
          )}
        </div>
      </div>

      <div style={rowStyle}>
        <div style={labelStyle}>Brain keywords</div>
        <div style={valueStyle}>
          {(candidate.brain_keywords ?? []).map((k, i) => (
            <span key={i} style={pillStyle}>{k}</span>
          ))}
        </div>
      </div>

      <div style={rowStyle}>
        <div style={labelStyle}>Evidence</div>
        <div style={valueStyle}>
          <pre style={preStyle}>{JSON.stringify(evidence, null, 2)}</pre>
        </div>
      </div>

      {businesses.length > 0 && (
        <div style={rowStyle}>
          <div style={labelStyle}>
            Sample businesses ({businesses.length}/{totalSample})
          </div>
          <div style={valueStyle}>
            <ul style={sampleListStyle}>
              {businesses.map((b: any, i: number) => (
                <li key={i}>
                  <code>{b.business_ref ?? "?"}</code> {b.name ?? ""}
                  {b.city ? ` · ${b.city}` : ""}
                  {b.source_reference ? ` · ${b.source_reference}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {candidate.admin_decision !== "pending" && (
        <div style={rowStyle}>
          <div style={labelStyle}>Reviewed</div>
          <div style={valueStyle}>
            by <strong>{candidate.admin_reviewed_by ?? "(unknown)"}</strong>{" "}
            at {candidate.admin_reviewed_at
              ? new Date(candidate.admin_reviewed_at).toISOString()
              : "(unknown)"}
            {candidate.admin_notes && (
              <div style={{ marginTop: 6 }}>
                <em>notes:</em> {candidate.admin_notes}
              </div>
            )}
            {candidate.duplicate_of_registry_id && (
              <div>duplicate of Registry id: <code>{candidate.duplicate_of_registry_id}</code></div>
            )}
            {candidate.superseded_by_candidate_id && (
              <div>superseded by candidate: <code>{candidate.superseded_by_candidate_id}</code></div>
            )}
          </div>
        </div>
      )}

      {showActions && candidate.admin_decision === "pending" && (
        <DecisionButtons candidateId={candidate.id} />
      )}
    </article>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: 20,
  color: "var(--nex-neutral, #1a1a1a)",
  fontFamily:
    '-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
};
const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  paddingBottom: 12,
  marginBottom: 20,
  borderBottom: "1px solid rgba(0,0,0,0.08)",
};
const h1Style: React.CSSProperties = { fontSize: 22, fontWeight: 700, margin: 0 };
const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: "rgba(0,0,0,0.6)",
  margin: "6px 0 0",
  lineHeight: 1.5,
  maxWidth: 720,
};
const sectionStyle: React.CSSProperties = { marginTop: 24 };
const h2Style: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  margin: "0 0 12px",
  color: "rgba(0,0,0,0.7)",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};
const emptyStyle: React.CSSProperties = {
  padding: 20,
  border: "1px dashed rgba(0,0,0,0.15)",
  borderRadius: 12,
  color: "rgba(0,0,0,0.55)",
  fontSize: 13,
  lineHeight: 1.5,
};
const cardListStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
};
function cardStyle(decision: string): React.CSSProperties {
  const isPending = decision === "pending";
  return {
    background: "#fff",
    border: `1px solid ${isPending ? "rgba(249,115,22,0.35)" : "rgba(0,0,0,0.08)"}`,
    borderRadius: 14,
    padding: 16,
    boxShadow: isPending ? "0 2px 12px rgba(249,115,22,0.10)" : "0 1px 4px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
}
const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};
const cardTitleStyle: React.CSSProperties = { fontSize: 16, fontWeight: 600 };
const cardMetaStyle: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(0,0,0,0.6)",
  marginTop: 3,
};
const mutedStyle: React.CSSProperties = { color: "rgba(0,0,0,0.4)", fontWeight: 400 };
const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "140px 1fr",
  gap: 12,
  alignItems: "flex-start",
  fontSize: 12,
};
const labelStyle: React.CSSProperties = {
  color: "rgba(0,0,0,0.5)",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  fontSize: 10,
  paddingTop: 4,
};
const valueStyle: React.CSSProperties = { fontSize: 12, lineHeight: 1.5, minWidth: 0 };
const pillStyle: React.CSSProperties = {
  display: "inline-block",
  marginRight: 6,
  marginBottom: 4,
  padding: "2px 8px",
  borderRadius: 999,
  background: "rgba(0,0,0,0.05)",
  fontSize: 11,
};
const preStyle: React.CSSProperties = {
  margin: 0,
  padding: 10,
  background: "rgba(0,0,0,0.04)",
  borderRadius: 8,
  fontSize: 11,
  lineHeight: 1.4,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  maxHeight: 200,
  overflow: "auto",
};
const sampleListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  fontSize: 11,
  lineHeight: 1.5,
};
function decisionChipStyle(decision: string): React.CSSProperties {
  const colors: Record<string, { bg: string; fg: string }> = {
    pending:    { bg: "rgba(249,115,22,0.15)", fg: "#c2410c" },
    approved:   { bg: "rgba(34,197,94,0.15)",  fg: "#166534" },
    rejected:   { bg: "rgba(239,68,68,0.15)",  fg: "#b91c1c" },
    duplicate:  { bg: "rgba(168,85,247,0.15)", fg: "#7e22ce" },
    superseded: { bg: "rgba(100,116,139,0.15)",fg: "#475569" },
  };
  const c = colors[decision] ?? colors.pending;
  return {
    padding: "4px 10px",
    borderRadius: 999,
    background: c.bg,
    color: c.fg,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    whiteSpace: "nowrap",
  };
}
function healthChipStyle(ok: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    background: ok ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
    color: ok ? "#166534" : "#b91c1c",
    fontSize: 12,
    fontWeight: 600,
  };
}
const footerStyle: React.CSSProperties = {
  marginTop: 30,
  paddingTop: 16,
  borderTop: "1px solid rgba(0,0,0,0.08)",
  display: "flex",
  justifyContent: "space-between",
  fontSize: 11,
  color: "rgba(0,0,0,0.55)",
};
