// Brain Health · admin dashboard
// Reads knowledge_health.json (auto-regenerated on every
// knowledge:build) and renders an at-a-glance report so we can
// watch the Brain grow from hundreds to tens of thousands of Q&As.
// If the file is missing (build never run), we show a friendly
// bootstrap message instead of crashing.

import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

type PerCategory = {
  count:               number;
  avg_answer_length:   number;
  missing_voice:       number;
  fact_check_flags:    number;
  banned_phrase_hits:  number;
  us_spelling_hits:    number;
  duplicate_questions: number;
  voice_pass_rate:     number;
};

type HealthReport = {
  version:         string;
  generated_at:    string;
  last_build_at:   string | null;
  master_checksum: string | null;
  health_score:    number;
  health_band:     "excellent" | "good" | "fair" | "needs_work" | "critical";
  totals: {
    categories:        number;
    entries:           number;
    avg_answer_length: number;
  };
  quality: {
    errors:                  number;
    warnings:                number;
    duplicate_ids:           number;
    duplicate_questions:     number;
    banned_phrase_hits:      number;
    us_spelling_hits:        number;
    missing_voice:           number;
    fact_check_flags:        number;
    missing_required_fields: number;
  };
  banned_phrase_breakdown: Record<string, number>;
  per_category:            Record<string, PerCategory>;
};

function loadHealth(): HealthReport | null {
  const p = path.resolve(process.cwd(), "knowledge_health.json");
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as HealthReport;
  } catch {
    return null;
  }
}

const BAND_COLOUR: Record<HealthReport["health_band"], { bg: string; fg: string; dot: string; label: string }> = {
  excellent:  { bg: "#DCFCE7", fg: "#166534", dot: "#22C55E", label: "Excellent" },
  good:       { bg: "#DCFCE7", fg: "#166534", dot: "#22C55E", label: "Good" },
  fair:       { bg: "#FEF3C7", fg: "#92400E", dot: "#F59E0B", label: "Fair" },
  needs_work: { bg: "#FED7AA", fg: "#9A3412", dot: "#EA580C", label: "Needs work" },
  critical:   { bg: "#FEE2E2", fg: "#991B1B", dot: "#DC2626", label: "Critical" }
};

export default function BrainHealthPage() {
  const health = loadHealth();

  if (!health) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <h1 className="text-[24px] font-black tracking-tight" style={{ color: "#111827" }}>
          Brain Health
        </h1>
        <div
          className="mt-6 rounded-2xl border p-6"
          style={{ background: "#FEF3C7", borderColor: "#FDE68A" }}
        >
          <div className="text-[14px] font-bold" style={{ color: "#92400E" }}>
            No health metrics found yet.
          </div>
          <div className="mt-1 text-[12.5px]" style={{ color: "#92400E" }}>
            Run <code className="rounded px-1 py-0.5" style={{ background: "#FDE68A" }}>npm run knowledge:build</code> to
            generate <code>knowledge_health.json</code>, then refresh this page.
          </div>
        </div>
      </div>
    );
  }

  const band = BAND_COLOUR[health.health_band];
  const perCat = Object.entries(health.per_category).sort();
  const buildDate = health.last_build_at ? new Date(health.last_build_at) : null;
  const healthDate = new Date(health.generated_at);

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <div className="text-[10.5px] font-black uppercase tracking-[0.28em]" style={{ color: "#F59E0B" }}>
            NEX Brain
          </div>
          <h1 className="mt-1 text-[26px] font-black tracking-tight" style={{ color: "#111827" }}>
            Brain Health
          </h1>
        </div>
        <div className="text-right text-[11px]" style={{ color: "#6B7280" }}>
          <div>Health computed {fmtRelative(healthDate)}</div>
          {buildDate && <div>Last build {fmtRelative(buildDate)}</div>}
          {health.master_checksum && (
            <div className="mt-1 font-mono text-[10px]" style={{ color: "#9CA3AF" }}>
              master · {health.master_checksum}
            </div>
          )}
        </div>
      </header>

      {/* Big score card */}
      <section
        className="mb-5 flex items-center gap-5 rounded-3xl border p-6"
        style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "0 4px 16px -8px rgba(0,0,0,0.06)" }}
      >
        <div
          className="grid h-24 w-24 flex-shrink-0 place-items-center rounded-full"
          style={{ background: band.bg }}
        >
          <div className="text-[32px] font-black leading-none" style={{ color: band.fg }}>
            {health.health_score}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: band.dot, boxShadow: `0 0 0 3px ${band.dot}33` }}
            />
            <span className="text-[14px] font-black" style={{ color: band.fg }}>
              {band.label}
            </span>
          </div>
          <div className="mt-1 text-[13px]" style={{ color: "#6B7280" }}>
            {health.quality.errors === 0
              ? `Zero errors. ${health.quality.warnings.toLocaleString("en-GB")} warnings across ${health.totals.entries.toLocaleString("en-GB")} entries.`
              : `${health.quality.errors} errors — these block publish. Fix before shipping.`}
          </div>
        </div>
      </section>

      {/* Top-level stats */}
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Categories"     value={health.totals.categories.toLocaleString("en-GB")} />
        <StatCard label="Total entries"  value={health.totals.entries.toLocaleString("en-GB")} accent />
        <StatCard label="Avg answer"     value={`${health.totals.avg_answer_length} chars`} />
        <StatCard label="Errors"         value={health.quality.errors.toLocaleString("en-GB")} negative={health.quality.errors > 0} />
      </section>

      {/* Quality breakdown */}
      <section
        className="mb-5 rounded-2xl border p-5"
        style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "0 4px 16px -8px rgba(0,0,0,0.06)" }}
      >
        <h2 className="mb-4 text-[13px] font-black uppercase tracking-[0.22em]" style={{ color: "#6B7280" }}>
          Quality breakdown
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px]">
          <QualityRow label="Missing NEX voice"       value={health.quality.missing_voice}       hint="No contractions, em-dash or direct 'you'" />
          <QualityRow label="Fact-check flags"        value={health.quality.fact_check_flags}    hint="Needs Author review before publish" />
          <QualityRow label="Duplicate questions"     value={health.quality.duplicate_questions} hint="Same question in multiple entries" />
          <QualityRow label="US spellings"            value={health.quality.us_spelling_hits}    hint="color / center / tire / etc." />
          <QualityRow label="Banned phrases"          value={health.quality.banned_phrase_hits}  hint="'cheap', 'world-class', 'as an AI'…" isError />
          <QualityRow label="Duplicate IDs"           value={health.quality.duplicate_ids}       hint="Same id in multiple entries"           isError />
          <QualityRow label="Missing required fields" value={health.quality.missing_required_fields} hint="id / question / answer / kind / category_tag missing" isError />
        </div>
      </section>

      {/* Per-category table */}
      <section
        className="mb-5 overflow-hidden rounded-2xl border"
        style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "0 4px 16px -8px rgba(0,0,0,0.06)" }}
      >
        <div className="border-b p-5" style={{ borderColor: "#E5E7EB" }}>
          <h2 className="text-[13px] font-black uppercase tracking-[0.22em]" style={{ color: "#6B7280" }}>
            Per-category
          </h2>
        </div>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b" style={{ background: "#F9FAFB", borderColor: "#E5E7EB", color: "#6B7280" }}>
              <th className="px-5 py-2.5 text-left  font-bold uppercase tracking-wider">Category</th>
              <th className="px-3 py-2.5 text-right font-bold uppercase tracking-wider">Entries</th>
              <th className="px-3 py-2.5 text-right font-bold uppercase tracking-wider">Voice %</th>
              <th className="px-3 py-2.5 text-right font-bold uppercase tracking-wider">Avg len</th>
              <th className="px-3 py-2.5 text-right font-bold uppercase tracking-wider">Flags</th>
              <th className="px-5 py-2.5 text-right font-bold uppercase tracking-wider">Missing voice</th>
            </tr>
          </thead>
          <tbody>
            {perCat.map(([cat, s]) => (
              <tr key={cat} className="border-b" style={{ borderColor: "#F3F4F6" }}>
                <td className="px-5 py-2.5 font-bold"                                  style={{ color: "#111827" }}>{cat}</td>
                <td className="px-3 py-2.5 text-right tabular-nums"                    style={{ color: "#111827" }}>{s.count.toLocaleString("en-GB")}</td>
                <td className="px-3 py-2.5 text-right tabular-nums"                    style={{ color: voiceColor(s.voice_pass_rate) }}>{s.voice_pass_rate}%</td>
                <td className="px-3 py-2.5 text-right tabular-nums"                    style={{ color: "#6B7280" }}>{s.avg_answer_length}</td>
                <td className="px-3 py-2.5 text-right tabular-nums"                    style={{ color: s.fact_check_flags > 0 ? "#EA580C" : "#6B7280" }}>{s.fact_check_flags}</td>
                <td className="px-5 py-2.5 text-right tabular-nums"                    style={{ color: s.missing_voice > 0 ? "#EA580C" : "#22C55E" }}>{s.missing_voice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Banned phrase breakdown (only if any) */}
      {Object.keys(health.banned_phrase_breakdown).length > 0 && (
        <section
          className="mb-5 rounded-2xl border p-5"
          style={{ background: "#FEE2E2", borderColor: "#FCA5A5" }}
        >
          <h2 className="mb-3 text-[13px] font-black uppercase tracking-[0.22em]" style={{ color: "#991B1B" }}>
            Banned phrase hits
          </h2>
          <ul className="space-y-1 text-[12.5px]" style={{ color: "#7F1D1D" }}>
            {Object.entries(health.banned_phrase_breakdown).map(([rule, count]) => (
              <li key={rule}>
                <span className="font-black">{count}</span> · {rule}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Actionable next-up */}
      <NextActions health={health} />

      <footer className="mt-8 text-center text-[11px]" style={{ color: "#9CA3AF" }}>
        Refresh with <code style={{ color: "#6B7280" }}>npm run knowledge:build</code>
        {" "}or{" "}
        <code style={{ color: "#6B7280" }}>npm run knowledge:health</code>
      </footer>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function StatCard({ label, value, accent = false, negative = false }: {
  label: string; value: string; accent?: boolean; negative?: boolean;
}) {
  const colour = negative ? "#DC2626" : accent ? "#F59E0B" : "#111827";
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: "#FFFFFF",
        borderColor: negative ? "#FCA5A5" : "#E5E7EB",
        boxShadow: "0 4px 16px -8px rgba(0,0,0,0.06)"
      }}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: "#6B7280" }}>
        {label}
      </div>
      <div className="mt-1 text-[22px] font-black tracking-tight" style={{ color: colour }}>
        {value}
      </div>
    </div>
  );
}

function QualityRow({ label, value, hint, isError = false }: {
  label: string; value: number; hint: string; isError?: boolean;
}) {
  const dim = value === 0;
  const emphasis = value > 0 && isError ? "#DC2626" : value > 0 ? "#EA580C" : "#22C55E";
  return (
    <div className="flex items-baseline gap-2">
      <span
        className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ background: dim ? "#D1D5DB" : emphasis }}
        aria-hidden
      />
      <span className="min-w-0 flex-1" style={{ color: dim ? "#9CA3AF" : "#374151" }}>
        <span className="font-black" style={{ color: emphasis }}>{value.toLocaleString("en-GB")}</span>
        {" · "}
        <span className="font-bold">{label}</span>
        {" — "}
        <span style={{ color: "#9CA3AF" }}>{hint}</span>
      </span>
    </div>
  );
}

function NextActions({ health }: { health: HealthReport }) {
  const actions: string[] = [];
  if (health.quality.errors > 0) {
    actions.push(`Fix ${health.quality.errors} error(s) — they block publish.`);
  }
  const missingVoiceCats = Object.entries(health.per_category)
    .filter(([, s]) => s.missing_voice > 0)
    .sort((a, b) => b[1].missing_voice - a[1].missing_voice)
    .slice(0, 3);
  for (const [cat, s] of missingVoiceCats) {
    actions.push(`Voice-polish ${cat} — ${s.missing_voice} entries still in spec voice (${s.voice_pass_rate}% pass rate).`);
  }
  if (health.quality.fact_check_flags > 0) {
    actions.push(`Author review ${health.quality.fact_check_flags} entries with fact-check flags set.`);
  }
  if (actions.length === 0) {
    return (
      <section
        className="rounded-2xl border p-5"
        style={{ background: "#DCFCE7", borderColor: "#BBF7D0" }}
      >
        <h2 className="text-[13px] font-black uppercase tracking-[0.22em]" style={{ color: "#166534" }}>
          Nothing to fix
        </h2>
        <p className="mt-2 text-[12.5px]" style={{ color: "#166534" }}>
          Brain is clean — no errors, no warnings, no orphan flags. Add more categories to grow coverage.
        </p>
      </section>
    );
  }
  return (
    <section
      className="rounded-2xl border p-5"
      style={{ background: "#FFF7ED", borderColor: "#FED7AA" }}
    >
      <h2 className="text-[13px] font-black uppercase tracking-[0.22em]" style={{ color: "#9A3412" }}>
        Suggested next actions
      </h2>
      <ul className="mt-2 space-y-1.5 text-[12.5px]" style={{ color: "#7C2D12" }}>
        {actions.map((a, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden style={{ color: "#EA580C" }}>→</span>
            <span>{a}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Helpers ─────────────────────────────────────────────────

function voiceColor(pct: number): string {
  if (pct >= 80) return "#22C55E";
  if (pct >= 50) return "#F59E0B";
  return "#DC2626";
}
function fmtRelative(d: Date): string {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60)     return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)     return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)       return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30)        return `${days}d ago`;
  return d.toISOString().slice(0, 10);
}
