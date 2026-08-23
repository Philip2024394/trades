// NEX HQ · CLE Candidate Review · admin promotion gate
//
// Route: /nex-head-quarters/cle-review
//
// Task #76 Bundle B (2026-08-22): the ONLY human surface where CLE
// candidates transition from pending_review to promoted (knowledge_records
// UNDER_REVIEW) or rejected. Constitutional boundary enforced:
//   observe → compare → candidate → evidence → admin promotion → knowledge
// NEVER conversation → automatically modify NEX knowledge.
//
// EN + ID candidates listed identically · no language-differential gates.
// Server component fetches pending queue · client component drives actions.

import { getFoodDbPool } from "@/lib/nex-food/db";
import CleCandidateActions from "./CleCandidateActions";
import "../../nex-app/nex-app.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface CandidateRow {
  candidate_id: string;
  cycle_run_id: string;
  from_turn_ids: string[];
  language: string;
  brain: string;
  candidate_kind: string;
  candidate_payload: Record<string, unknown>;
  score: string; // NUMERIC(4,3) returns as string
  status: string;
  created_at: string;
}

async function loadData() {
  const pool = getFoodDbPool();
  const pending = await pool.query<CandidateRow>(`
    SELECT candidate_id, cycle_run_id, from_turn_ids, language, brain, candidate_kind,
           candidate_payload, score::text AS score, status, created_at
      FROM nex.conv_learning_candidate
     WHERE status = 'pending_review'
     ORDER BY created_at DESC
  `);
  const counts = await pool.query(`
    SELECT status, COUNT(*)::int AS n FROM nex.conv_learning_candidate GROUP BY status
  `);
  const byStatus: Record<string, number> = { pending_review: 0, promoted: 0, rejected: 0 };
  for (const r of counts.rows) byStatus[String(r.status)] = Number(r.n);
  return { pending: pending.rows, counts: byStatus };
}

export default async function CleReviewPage() {
  const d = await loadData();

  return (
    <div style={pageStyle}>
      <div style={titleBlockStyle}>
        <div style={eyebrowStyle}>NEX HQ · CONVERSATION LEARNING · CANDIDATE REVIEW</div>
        <h1 style={h1Style}>CLE Candidates · Admin Promotion Gate</h1>
        <div style={subtitleStyle}>
          Every candidate is proposed by the CLE worker from real conversation evidence. English and Indonesian go through
          IDENTICAL gates. Promotion creates a <code style={codeStyle}>knowledge_records</code> row at status=UNDER_REVIEW ·
          a second reviewer must approve it via /nex-head-quarters/review to reach AUTHORITATIVE. Never auto-promoted.
        </div>
      </div>

      <div style={tilesRowStyle}>
        {(["pending_review", "promoted", "rejected"] as const).map((s) => (
          <div key={s} style={tileStyle(s)}>
            <div style={tileCountStyle}>{d.counts[s] ?? 0}</div>
            <div style={tileLabelStyle}>{s.replace("_", " ")}</div>
          </div>
        ))}
      </div>

      <div style={sectionLabelStyle}>Pending candidates · promote or reject</div>
      {d.pending.length === 0 ? (
        <div style={mutedCardStyle}>
          No pending candidates. Run <code style={codeStyle}>NEX_DEV_WORKERS=1 npm run dev:workers</code> and wait for the
          CLE cycle to produce new candidates, or trigger one manually with{" "}
          <code style={codeStyle}>node --env-file=.env.local scripts/nex-conv/cle/run-cle-cycle.mjs --config=staircase --apply</code>.
        </div>
      ) : (
        <div style={panelStyle}>
          {d.pending.map((c) => (
            <div key={c.candidate_id} style={candidateCardStyle}>
              <div style={cardHeaderStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={langBadgeStyle(c.language)}>{c.language.toUpperCase()}</span>
                  <span style={{ fontSize: 12, color: "var(--nex-neutral-500)", fontFamily: "monospace" }}>
                    {c.candidate_id.slice(0, 8)}…
                  </span>
                  <span style={{ fontSize: 12, color: "var(--nex-neutral-700)", fontWeight: 600 }}>
                    {c.candidate_kind}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--nex-neutral-500)" }}>
                    score {Number(c.score).toFixed(3)} · brain {c.brain}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--nex-neutral-500)" }}>
                  {new Date(c.created_at).toLocaleString("en-GB")}
                </div>
              </div>

              <div style={{ fontSize: 12, color: "var(--nex-neutral-700)", marginTop: 4 }}>
                Evidence turns: <span style={{ fontFamily: "monospace" }}>{c.from_turn_ids.length}</span>
                {" · "}Cycle: <span style={{ fontFamily: "monospace" }}>{c.cycle_run_id.slice(0, 8)}…</span>
              </div>

              <pre style={payloadStyle}>
                {JSON.stringify(c.candidate_payload, null, 2)}
              </pre>

              <CleCandidateActions candidateId={c.candidate_id} />
            </div>
          ))}
        </div>
      )}

      <div style={sectionLabelStyle}>Constitutional gates enforced</div>
      <ul style={docListStyle}>
        <li>Every promotion produces <code style={codeStyle}>knowledge_records</code> at status=UNDER_REVIEW · not AUTHORITATIVE</li>
        <li>Second-reviewer approval required via <code style={codeStyle}>/nex-head-quarters/review</code></li>
        <li>Rejected candidates preserved (never deleted) · audit trail via <code style={codeStyle}>reviewed_at + reviewed_by + rejection_reason</code></li>
        <li>Every candidate carries <code style={codeStyle}>cycle_run_id</code> FK · direct-provenance from CLE cycle</li>
        <li>EN and ID identical gates · language is metadata only</li>
      </ul>
    </div>
  );
}

// ── Styles · cream theme ──────────────────────────────────

const pageStyle: React.CSSProperties = { padding: "24px 32px 60px" };
const titleBlockStyle: React.CSSProperties = { marginBottom: 24 };
const eyebrowStyle: React.CSSProperties = { fontSize: 10, letterSpacing: 3, color: "var(--nex-accent-600)", fontWeight: 700, marginBottom: 8 };
const h1Style: React.CSSProperties = { fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: -0.4, color: "var(--nex-neutral-900)" };
const subtitleStyle: React.CSSProperties = { fontSize: 13, color: "var(--nex-neutral-700)", marginTop: 6, maxWidth: 820, lineHeight: 1.5 };
const codeStyle: React.CSSProperties = { padding: "1px 5px", background: "var(--nex-neutral-100)", borderRadius: 3, fontSize: 11, fontFamily: "monospace" };
const sectionLabelStyle: React.CSSProperties = { fontSize: 11, letterSpacing: 2, color: "var(--nex-accent-600)", fontWeight: 700, textTransform: "uppercase", marginTop: 28, marginBottom: 12 };
const tilesRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 };
function tileStyle(state: string): React.CSSProperties {
  const accents: Record<string, { border: string; bg: string; text: string }> = {
    pending_review: { border: "rgba(250, 204, 21, 0.55)", bg: "rgba(250, 204, 21, 0.06)", text: "#a16207" },
    promoted:       { border: "rgba(16, 185, 129, 0.55)", bg: "rgba(16, 185, 129, 0.06)", text: "#047857" },
    rejected:       { border: "var(--nex-neutral-300)",   bg: "var(--nex-neutral-100)",   text: "var(--nex-neutral-700)" },
  };
  const a = accents[state] ?? accents.rejected;
  return { background: a.bg, border: `1px solid ${a.border}`, borderRadius: 12, padding: "16px 14px", display: "flex", flexDirection: "column", gap: 4, color: a.text };
}
const tileCountStyle: React.CSSProperties = { fontSize: 28, fontWeight: 800, lineHeight: 1 };
const tileLabelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, textTransform: "capitalize" };
const panelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };
const candidateCardStyle: React.CSSProperties = { background: "var(--nex-neutral-0)", border: "1px solid var(--nex-neutral-200)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 };
const cardHeaderStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 };
function langBadgeStyle(lang: string): React.CSSProperties {
  const bg = lang === "en" ? "rgba(59, 130, 246, 0.12)" : lang === "id" ? "rgba(220, 38, 38, 0.10)" : "var(--nex-neutral-100)";
  const fg = lang === "en" ? "#1e40af" : lang === "id" ? "#b91c1c" : "var(--nex-neutral-700)";
  return { padding: "3px 10px", borderRadius: 999, background: bg, color: fg, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 };
}
const payloadStyle: React.CSSProperties = { margin: 0, padding: "10px 12px", background: "var(--nex-neutral-100)", borderRadius: 8, fontSize: 11, fontFamily: "monospace", color: "var(--nex-neutral-800)", overflowX: "auto", maxHeight: 240 };
const mutedCardStyle: React.CSSProperties = { background: "var(--nex-neutral-0)", border: "1px dashed var(--nex-neutral-200)", borderRadius: 12, padding: "16px 18px", fontSize: 13, color: "var(--nex-neutral-700)", lineHeight: 1.55 };
const docListStyle: React.CSSProperties = { margin: 0, paddingLeft: 20, fontSize: 12, color: "var(--nex-neutral-700)", lineHeight: 1.8 };
