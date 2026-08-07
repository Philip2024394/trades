// NEX Data Import Wizard · multi-step modal component
//
// Four screens: Upload → Mapping → Dry-run → Report. Every screen renders
// data returned by the Wizard Runtime · no client-side parsing or dedup.
// Compliance ratchet is displayed but never bypass-able (server enforces).
//
// Doctrine: constitution_nex_data_import_wizard_2026_08_07.md

"use client";

import { useCallback, useMemo, useState } from "react";

// ── API shapes (mirror server types) ─────────────────────────────────
type FileFormat = "csv" | "tsv" | "xlsx" | "json" | "unknown";
type CanonicalField = "email" | "phone" | "name" | "company" | "country" | "region" | "lifecycle_stage" | "tags" | "trade_categories";
type MappingTarget = CanonicalField | "attribute" | "ignore";
type ColumnMapping = Record<string, MappingTarget>;

type ImportSession = {
  session_id: string;
  file_name: string | null;
  format: FileFormat;
  header: string[];
  header_signature: string;
  row_count: number;
  mapping: ColumnMapping;
  mapping_source: "auto" | "manual" | { profile_id: string };
  state: "uploaded" | "mapped" | "dry_ran" | "committing" | "committed" | "failed";
  error: string | null;
};

type ValidationIssue = { row_index: number; field: string | null; code: string; detail: string };
type DuplicatePrediction = { row_index: number; email: string | null; phone: string | null; existing_contact_id: string; match_kind: string };
type ComplianceWarning = { row_index: number; code: string; existing_state: unknown; incoming_state: unknown; ratchet_will_preserve_safer_state: true };

type DryRunSummary = {
  records_processed: number;
  would_create: number;
  would_update: number;
  duplicate_predictions: DuplicatePrediction[];
  invalid_rows: ValidationIssue[];
  in_file_duplicates: number;
  empty_rows: number;
  compliance_warnings: ComplianceWarning[];
  unknown_columns: string[];
  estimated_duration_ms: number;
  preview_rows: Record<string, string>[];
};

type ImportReport = {
  import_id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  file_name: string | null;
  format: FileFormat;
  records_processed: number;
  created: number;
  updated: number;
  skipped_no_identifier: number;
  errors: number;
  error_samples: string[];
  mapping_used: ColumnMapping;
  mapping_profile_id: string | null;
};

type MappingProfile = {
  profile_id: string;
  label: string;
  description: string | null;
  header_signature: string;
  mapping: ColumnMapping;
  used_count: number;
};

// ── Theme (match panel · dark) ───────────────────────────────────────
const T = {
  overlay:  "rgba(0,0,0,0.72)",
  bg:       "#0b0d10",
  panel:    "#12161c",
  panelHi:  "#1a2028",
  border:   "#232b36",
  text:     "#e5e9ef",
  textDim:  "#8892a0",
  textFade: "#5c6572",
  accent:   "#4dd0a0",
  warning:  "#f0b45a",
  danger:   "#f0665a",
  info:     "#5aa6f0",
  purple:   "#b48cf0",
};

const CANONICAL_FIELDS: CanonicalField[] = [
  "email", "phone", "name", "company", "country", "region",
  "lifecycle_stage", "tags", "trade_categories",
];

type Step = "upload" | "mapping" | "dry_run" | "report";

export function ImportWizard({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [session, setSession] = useState<ImportSession | null>(null);
  const [dryRun, setDryRun] = useState<DryRunSummary | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [suggestedProfile, setSuggestedProfile] = useState<MappingProfile | null>(null);
  const [busy, setBusy] = useState<null | "upload" | "mapping" | "dry_run" | "commit">(null);
  const [error, setError] = useState<string | null>(null);

  // Save-as-profile state (used at commit time)
  const [saveAsProfile, setSaveAsProfile] = useState<boolean>(false);
  const [profileLabel, setProfileLabel] = useState<string>("");

  const reset = useCallback(() => {
    setStep("upload");
    setSession(null); setDryRun(null); setReport(null); setSuggestedProfile(null);
    setBusy(null); setError(null);
    setSaveAsProfile(false); setProfileLabel("");
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
    if (report) onImported();          // refresh parent's Import History if we committed
  }, [reset, onClose, onImported, report]);

  const uploadFile = useCallback(async (file: File) => {
    setBusy("upload"); setError(null);
    try {
      const content = await file.text();
      const res = await fetch("/api/nex/imports/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, file_name: file.name }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.session?.error || json.error || "upload failed");
      setSession(json.session);
      setSuggestedProfile(json.suggested_profile ?? null);
      setStep("mapping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "upload_failed");
    } finally {
      setBusy(null);
    }
  }, []);

  const applyMappingChange = useCallback((column: string, target: MappingTarget) => {
    if (!session) return;
    setSession({ ...session, mapping: { ...session.mapping, [column]: target } });
  }, [session]);

  const saveMappingAndRunDryRun = useCallback(async () => {
    if (!session) return;
    setBusy("mapping"); setError(null);
    try {
      // Push mapping overrides to server
      const putRes = await fetch(`/api/nex/imports/session/${session.session_id}/mapping`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ overrides: session.mapping }),
      });
      const putJson = await putRes.json();
      if (!putJson.ok) throw new Error(putJson.error || "mapping update failed");

      // Run dry-run
      setBusy("dry_run");
      const drRes = await fetch(`/api/nex/imports/session/${session.session_id}/dry-run`, { method: "POST" });
      const drJson = await drRes.json();
      if (!drJson.ok) throw new Error(drJson.error || "dry-run failed");
      setSession(drJson.session);
      setDryRun(drJson.dry_run);
      setStep("dry_run");
    } catch (err) {
      setError(err instanceof Error ? err.message : "dry_run_failed");
    } finally {
      setBusy(null);
    }
  }, [session]);

  const commitImport = useCallback(async () => {
    if (!session) return;
    setBusy("commit"); setError(null);
    try {
      const body: { save_as_profile?: { label: string; description?: string } } = {};
      if (saveAsProfile && profileLabel.trim()) {
        body.save_as_profile = { label: profileLabel.trim() };
      }
      const res = await fetch(`/api/nex/imports/session/${session.session_id}/commit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.report) throw new Error(json.error || "commit failed");
      setReport(json.report);
      setStep("report");
    } catch (err) {
      setError(err instanceof Error ? err.message : "commit_failed");
    } finally {
      setBusy(null);
    }
  }, [session, saveAsProfile, profileLabel]);

  // ── UI helpers ───────────────────────────────────────────────────
  const stepIndex = { upload: 1, mapping: 2, dry_run: 3, report: 4 }[step];
  const canProceedFromMapping = useMemo(() => {
    if (!session) return false;
    return Object.values(session.mapping).includes("email");
  }, [session]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-6"
      style={{ background: T.overlay, fontFamily: "system-ui,-apple-system,Segoe UI,sans-serif" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="w-full max-w-4xl rounded-xl border" style={{ background: T.bg, borderColor: T.border, color: T.text }}>
        {/* Header · step indicator */}
        <div className="flex items-center gap-3 border-b p-4" style={{ borderColor: T.border }}>
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.accent }}>NEX Data Import Wizard · v1</div>
            <div className="mt-0.5 text-[16px] font-black">Step {stepIndex} of 4 · {step === "upload" ? "Upload" : step === "mapping" ? "Preview + Mapping" : step === "dry_run" ? "Dry-run Summary" : "Import Report"}</div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {(["upload", "mapping", "dry_run", "report"] as Step[]).map((s, i) => (
              <div
                key={s}
                className="h-1.5 w-8 rounded-full"
                style={{
                  background: (stepIndex - 1) >= i ? T.accent : T.border,
                }}
              />
            ))}
            <button
              type="button"
              onClick={handleClose}
              className="ml-3 rounded border px-3 py-1 text-[11px] font-semibold"
              style={{ background: T.panel, borderColor: T.border, color: T.textDim }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          {error ? (
            <div className="mb-3 rounded border p-2 text-[11px]" style={{ background: T.panel, borderColor: T.danger, color: T.danger }}>
              Error: {error}
            </div>
          ) : null}

          {step === "upload" ? (
            <StepUpload busy={busy === "upload"} onFile={uploadFile} />
          ) : step === "mapping" && session ? (
            <StepMapping
              session={session}
              suggestedProfile={suggestedProfile}
              onChange={applyMappingChange}
              onNext={saveMappingAndRunDryRun}
              onBack={reset}
              busy={busy === "mapping" || busy === "dry_run"}
              canProceed={canProceedFromMapping}
            />
          ) : step === "dry_run" && session && dryRun ? (
            <StepDryRun
              session={session}
              dryRun={dryRun}
              onBack={() => setStep("mapping")}
              onCommit={commitImport}
              busy={busy === "commit"}
              saveAsProfile={saveAsProfile}
              setSaveAsProfile={setSaveAsProfile}
              profileLabel={profileLabel}
              setProfileLabel={setProfileLabel}
            />
          ) : step === "report" && report ? (
            <StepReport report={report} onClose={handleClose} />
          ) : (
            <div className="text-[11px]" style={{ color: T.textFade }}>Loading…</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Screen 1 · Upload
// ═════════════════════════════════════════════════════════════════════
function StepUpload({ busy, onFile }: { busy: boolean; onFile: (f: File) => void }) {
  return (
    <div>
      <div className="mb-3 text-[11px]" style={{ color: T.textDim }}>
        Upload a CSV or TSV file. The wizard detects the format, parses the header, auto-maps columns to canonical registry fields, and then previews the import before any write.
      </div>
      <label
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center"
        style={{ background: T.panel, borderColor: T.accent, color: T.accent, opacity: busy ? 0.5 : 1 }}
      >
        <input
          type="file"
          accept=".csv,.tsv,.tab,text/csv,text/tab-separated-values"
          disabled={busy}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        <div className="text-[15px] font-black">{busy ? "Uploading…" : "Choose CSV or TSV file"}</div>
        <div className="mt-1 text-[10.5px]" style={{ color: T.textDim }}>
          UTF-8 · header row required · email column required · unknown columns land in attributes
        </div>
      </label>
      <div className="mt-3 text-[9.5px] italic" style={{ color: T.textFade }}>
        Excel (.xlsx) · JSON · Google Sheets · third-party APIs arrive in Wizard v2 (Phase 3b.6c)
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Screen 2 · Mapping
// ═════════════════════════════════════════════════════════════════════
function StepMapping({
  session, suggestedProfile, onChange, onNext, onBack, busy, canProceed,
}: {
  session: ImportSession;
  suggestedProfile: MappingProfile | null;
  onChange: (col: string, target: MappingTarget) => void;
  onNext: () => void;
  onBack: () => void;
  busy: boolean;
  canProceed: boolean;
}) {
  return (
    <div>
      <div className="mb-3 grid gap-2 text-[11px]" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <Info label="File" value={session.file_name ?? "(untitled)"} />
        <Info label="Format" value={session.format.toUpperCase()} tone="good" />
        <Info label="Data rows" value={session.row_count.toString()} />
      </div>

      {suggestedProfile ? (
        <div className="mb-3 rounded border p-3 text-[11px]" style={{ background: T.panel, borderColor: T.purple }}>
          <div className="font-black" style={{ color: T.purple }}>Suggested mapping profile: {suggestedProfile.label}</div>
          <div className="mt-1" style={{ color: T.textDim }}>
            A saved profile matches this file&apos;s header signature. Used {suggestedProfile.used_count}× before.
          </div>
        </div>
      ) : null}

      <div className="mb-2 text-[10.5px]" style={{ color: T.textDim }}>
        Every column maps to a canonical field, lands in <code>attributes[column_name]</code>, or is ignored. The <span style={{ color: T.accent }}>email</span> column is required.
      </div>

      <div className="rounded border" style={{ background: T.panel, borderColor: T.border }}>
        <div className="grid gap-2 border-b p-2 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade, gridTemplateColumns: "1fr 200px", borderColor: T.border }}>
          <div>Source column</div>
          <div>Maps to</div>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {session.header.map((col) => (
            <div key={col} className="grid items-center gap-2 border-b p-2 text-[11px]" style={{ gridTemplateColumns: "1fr 200px", borderColor: T.border }}>
              <code style={{ color: T.text }}>{col}</code>
              <select
                value={session.mapping[col] ?? "attribute"}
                onChange={(e) => onChange(col, e.target.value as MappingTarget)}
                disabled={busy}
                className="rounded border px-2 py-1 text-[11px]"
                style={{ background: T.panelHi, borderColor: T.border, color: T.text }}
              >
                {CANONICAL_FIELDS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
                <option value="attribute">attribute (JSON store)</option>
                <option value="ignore">— ignore —</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="rounded border px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
          style={{ background: T.panel, borderColor: T.border, color: T.textDim }}
        >
          Back to upload
        </button>
        {!canProceed ? (
          <div className="ml-auto text-[10.5px]" style={{ color: T.warning }}>
            At least one column must map to <code>email</code> before you can continue.
          </div>
        ) : null}
        <button
          type="button"
          onClick={onNext}
          disabled={busy || !canProceed}
          className="ml-auto rounded border px-4 py-1.5 text-[11px] font-black disabled:opacity-50"
          style={{ background: T.panel, borderColor: T.accent, color: T.accent }}
        >
          {busy ? "Running…" : "Run dry-run →"}
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Screen 3 · Dry-run
// ═════════════════════════════════════════════════════════════════════
function StepDryRun({
  session, dryRun, onBack, onCommit, busy,
  saveAsProfile, setSaveAsProfile, profileLabel, setProfileLabel,
}: {
  session: ImportSession;
  dryRun: DryRunSummary;
  onBack: () => void;
  onCommit: () => void;
  busy: boolean;
  saveAsProfile: boolean;
  setSaveAsProfile: (v: boolean) => void;
  profileLabel: string;
  setProfileLabel: (v: string) => void;
}) {
  const groupedIssues = useMemo(() => {
    const groups: Record<string, ValidationIssue[]> = {};
    for (const issue of dryRun.invalid_rows) {
      groups[issue.code] = groups[issue.code] ?? [];
      groups[issue.code].push(issue);
    }
    return groups;
  }, [dryRun]);

  const hasBlockingErrors = dryRun.records_processed === 0 || (dryRun.would_create + dryRun.would_update === 0);

  return (
    <div className="space-y-3">
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <Info label="Records processed" value={dryRun.records_processed.toString()} />
        <Info label="Would create" value={dryRun.would_create.toString()} tone="good" />
        <Info label="Would update" value={dryRun.would_update.toString()} tone="info" />
        <Info label="Duplicates found" value={dryRun.duplicate_predictions.length.toString()} tone="warn" />
        <Info label="Invalid rows" value={dryRun.invalid_rows.length.toString()} tone={dryRun.invalid_rows.length > 0 ? "warn" : "neutral"} />
        <Info label="Empty rows" value={dryRun.empty_rows.toString()} />
        <Info label="Compliance warnings" value={dryRun.compliance_warnings.length.toString()} tone={dryRun.compliance_warnings.length > 0 ? "warn" : "neutral"} />
        <Info label="Est. duration" value={`${dryRun.estimated_duration_ms}ms`} />
      </div>

      {/* Preview */}
      <div className="rounded border p-2" style={{ background: T.panel, borderColor: T.border }}>
        <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Preview · first 5 mapped rows</div>
        <div className="overflow-x-auto text-[10.5px]">
          <table className="w-full">
            <thead>
              <tr>
                {Array.from(new Set(dryRun.preview_rows.flatMap((r) => Object.keys(r)))).map((k) => (
                  <th key={k} className="border-b p-1 text-left font-black" style={{ borderColor: T.border, color: T.textDim }}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dryRun.preview_rows.map((r, i) => (
                <tr key={i}>
                  {Array.from(new Set(dryRun.preview_rows.flatMap((rr) => Object.keys(rr)))).map((k) => (
                    <td key={k} className="border-b p-1 font-mono" style={{ borderColor: T.border, color: T.text }}>{r[k] ?? "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Validation issues */}
      {Object.keys(groupedIssues).length > 0 ? (
        <div className="rounded border p-2" style={{ background: T.panel, borderColor: T.warning }}>
          <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.warning }}>Validation issues</div>
          {Object.entries(groupedIssues).map(([code, issues]) => (
            <div key={code} className="mb-2">
              <div className="text-[11px] font-black" style={{ color: T.warning }}>{code} ({issues.length})</div>
              <div className="mt-1 space-y-0.5 text-[10px]" style={{ color: T.textDim }}>
                {issues.slice(0, 5).map((iss, idx) => (
                  <div key={idx} className="font-mono">row {iss.row_index}{iss.field ? ` · ${iss.field}` : ""}: {iss.detail}</div>
                ))}
                {issues.length > 5 ? <div className="italic">…and {issues.length - 5} more</div> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Duplicate predictions */}
      {dryRun.duplicate_predictions.length > 0 ? (
        <div className="rounded border p-2" style={{ background: T.panel, borderColor: T.info }}>
          <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.info }}>Duplicate predictions · {dryRun.duplicate_predictions.length}</div>
          <div className="space-y-0.5 text-[10px]">
            {dryRun.duplicate_predictions.slice(0, 8).map((d, i) => (
              <div key={i} className="font-mono" style={{ color: T.textDim }}>
                row {d.row_index} · {d.match_kind} · {d.email ?? d.phone} → existing {d.existing_contact_id.slice(0, 12)}…
              </div>
            ))}
            {dryRun.duplicate_predictions.length > 8 ? <div className="italic text-[10px]" style={{ color: T.textFade }}>…and {dryRun.duplicate_predictions.length - 8} more</div> : null}
          </div>
        </div>
      ) : null}

      {/* Compliance warnings */}
      {dryRun.compliance_warnings.length > 0 ? (
        <div className="rounded border p-2" style={{ background: T.panel, borderColor: T.danger }}>
          <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.danger }}>Compliance warnings · {dryRun.compliance_warnings.length}</div>
          <div className="mb-1 text-[10px] italic" style={{ color: T.textDim }}>
            The registry compliance ratchet ALWAYS preserves the safer state. These rows show where the incoming file DISAGREES with existing consent · nothing gets weaker.
          </div>
          <div className="space-y-0.5 text-[10px]">
            {dryRun.compliance_warnings.slice(0, 8).map((w, i) => (
              <div key={i} className="font-mono" style={{ color: T.textDim }}>
                row {w.row_index} · {w.code}
              </div>
            ))}
            {dryRun.compliance_warnings.length > 8 ? <div className="italic" style={{ color: T.textFade }}>…and {dryRun.compliance_warnings.length - 8} more</div> : null}
          </div>
        </div>
      ) : null}

      {/* Save as profile */}
      <div className="rounded border p-2" style={{ background: T.panel, borderColor: T.border }}>
        <label className="flex items-center gap-2 text-[11px]" style={{ color: T.textDim }}>
          <input
            type="checkbox"
            checked={saveAsProfile}
            onChange={(e) => setSaveAsProfile(e.target.checked)}
            disabled={busy}
          />
          Save this mapping as a reusable profile
        </label>
        {saveAsProfile ? (
          <input
            type="text"
            value={profileLabel}
            onChange={(e) => setProfileLabel(e.target.value)}
            placeholder="e.g. Mailchimp Export · HubSpot Weekly · Trades CSV"
            disabled={busy}
            className="mt-2 w-full rounded border px-2 py-1 text-[11px]"
            style={{ background: T.panelHi, borderColor: T.border, color: T.text }}
          />
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="rounded border px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
          style={{ background: T.panel, borderColor: T.border, color: T.textDim }}
        >
          ← Back to mapping
        </button>
        {hasBlockingErrors ? (
          <div className="ml-auto text-[10.5px]" style={{ color: T.danger }}>
            Nothing would be imported · fix mapping or upload a valid file.
          </div>
        ) : null}
        <button
          type="button"
          onClick={onCommit}
          disabled={busy || hasBlockingErrors || (saveAsProfile && !profileLabel.trim())}
          className="ml-auto rounded border px-4 py-1.5 text-[11px] font-black disabled:opacity-50"
          style={{ background: T.panel, borderColor: T.accent, color: T.accent }}
        >
          {busy ? "Importing…" : `Confirm import (${dryRun.would_create + dryRun.would_update} contacts) →`}
        </button>
      </div>
      <div className="text-[9.5px] italic" style={{ color: T.textFade }}>
        Session: {session.session_id.slice(0, 8)}… · Header signature: {session.header_signature}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Screen 4 · Report
// ═════════════════════════════════════════════════════════════════════
function StepReport({ report, onClose }: { report: ImportReport; onClose: () => void }) {
  const successRate = report.records_processed > 0
    ? Math.round(((report.created + report.updated) / report.records_processed) * 100)
    : 0;
  return (
    <div className="space-y-3">
      <div className="rounded border p-3" style={{ background: T.panel, borderColor: report.errors === 0 ? T.accent : T.warning }}>
        <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: report.errors === 0 ? T.accent : T.warning }}>
          {report.errors === 0 ? "Import complete" : "Import complete with errors"}
        </div>
        <div className="mt-1 text-[18px] font-black">{report.created + report.updated} contacts · {successRate}% success</div>
        <div className="mt-1 text-[10.5px]" style={{ color: T.textDim }}>
          {report.file_name} · {report.format.toUpperCase()} · {report.duration_ms}ms · Import ID: <code>{report.import_id.slice(0, 12)}…</code>
        </div>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <Info label="Records processed" value={report.records_processed.toString()} />
        <Info label="Created" value={report.created.toString()} tone="good" />
        <Info label="Updated" value={report.updated.toString()} tone="info" />
        <Info label="Skipped (no id)" value={report.skipped_no_identifier.toString()} tone="warn" />
        <Info label="Errors" value={report.errors.toString()} tone={report.errors > 0 ? "bad" : "neutral"} />
        <Info label="Duration" value={`${report.duration_ms}ms`} />
      </div>

      {report.error_samples.length > 0 ? (
        <div className="rounded border p-2" style={{ background: T.panel, borderColor: T.danger }}>
          <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.danger }}>Error samples</div>
          <div className="space-y-0.5 text-[10px] font-mono" style={{ color: T.textDim }}>
            {report.error_samples.map((e, i) => (<div key={i}>{e}</div>))}
          </div>
        </div>
      ) : null}

      {report.mapping_profile_id ? (
        <div className="rounded border p-2 text-[10.5px]" style={{ background: T.panel, borderColor: T.purple, color: T.purple }}>
          Mapping profile saved · id: <code>{report.mapping_profile_id.slice(0, 12)}…</code> · Future uploads with the same header will auto-suggest this mapping.
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded border px-4 py-1.5 text-[11px] font-black"
          style={{ background: T.panel, borderColor: T.accent, color: T.accent }}
        >
          Close and refresh
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Shared little UI
// ═════════════════════════════════════════════════════════════════════
function Info({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "warn" | "bad" | "info" }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warning : tone === "bad" ? T.danger : tone === "info" ? T.info : T.text;
  return (
    <div className="rounded border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-1 font-mono text-[14px] font-black leading-none" style={{ color }}>{value}</div>
    </div>
  );
}
