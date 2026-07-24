"use client";

// Backup & Restore dashboard.
// Left: latest-backup card + create buttons. Right: restore uploader.
// Bottom: history table + restore attempts.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, Loader2, CheckCircle2, AlertCircle, Shield, HardDrive, History, PlayCircle } from "lucide-react";
import type { BackupRun, RestoreAttempt, RestorePreview } from "@/lib/nex/backup";

export function BackupDashboard({ lastComplete, totalBackups, backups, restores }: {
  lastComplete: BackupRun | null;
  totalBackups: number;
  backups:      BackupRun[];
  restores:     RestoreAttempt[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LatestBackupCard lastComplete={lastComplete} totalBackups={totalBackups}/>
          <CreateBackupCard/>
        </div>
        <RestoreCard/>
      </div>

      <HistoryTable backups={backups}/>
      {restores.length > 0 && <RestoreAttempts attempts={restores}/>}
    </div>
  );
}

// ─── Latest backup + counts ─────────────────────────────────────

function LatestBackupCard({ lastComplete, totalBackups }: { lastComplete: BackupRun | null; totalBackups: number }) {
  if (!lastComplete) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-amber-900">
          <AlertCircle size={14}/> No backup yet
        </div>
        <p className="text-[13px] text-amber-900">
          Nex has never been backed up. Run a full backup below.
        </p>
      </div>
    );
  }
  const totalRecords =
    lastComplete.entries_count + lastComplete.versions_count + lastComplete.edges_count +
    lastComplete.reviews_count + lastComplete.uploads_count + lastComplete.research_count;
  return (
    <div className="rounded-2xl border border-neutral-900 bg-white p-5">
      <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-neutral-500">
        <Shield size={14}/> Latest backup
      </div>
      <p className="text-[24px] font-black leading-none">{new Date(lastComplete.created_at).toLocaleString("en-GB")}</p>
      <p className="mt-1 text-[12px] text-neutral-600">
        {lastComplete.kind} · {(lastComplete.size_bytes / 1024).toFixed(1)} KB · {totalRecords} records total
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
        <MiniStat label="Entries"  value={lastComplete.entries_count}/>
        <MiniStat label="Versions" value={lastComplete.versions_count}/>
        <MiniStat label="Edges"    value={lastComplete.edges_count}/>
        <MiniStat label="Reviews"  value={lastComplete.reviews_count}/>
        <MiniStat label="Uploads"  value={lastComplete.uploads_count}/>
        <MiniStat label="Research" value={lastComplete.research_count}/>
      </div>
      <p className="mt-3 text-[11px] text-neutral-500">Lifetime completed backups: {totalBackups}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-neutral-50 p-2 text-center">
      <p className="text-[9px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="text-[15px] font-black">{value}</p>
    </div>
  );
}

// ─── Create backup ──────────────────────────────────────────────

function CreateBackupCard() {
  const router = useRouter();
  const [busy, setBusy] = useState<"full" | "incremental" | null>(null);
  const [msg, setMsg]   = useState<{ ok: boolean; text: string } | null>(null);

  async function run(kind: "full" | "incremental") {
    setBusy(kind); setMsg(null);
    try {
      const res = await fetch("/api/admin/nex/backup/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind })
      });
      const json = await res.json();
      if (json.ok) {
        setMsg({ ok: true, text: `${kind} backup complete. ${(json.run.size_bytes / 1024).toFixed(1)} KB.` });
        router.refresh();
      } else {
        setMsg({ ok: false, text: json.error ?? "backup_failed" });
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "network_error" });
    } finally { setBusy(null); }
  }

  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-neutral-500">
        <HardDrive size={14}/> Create backup
      </div>
      <p className="text-[12px] text-neutral-600">
        Full = everything. Incremental = only changes since the last backup.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => run("full")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-[12px] font-black text-white disabled:opacity-40"
        >
          {busy === "full" ? <Loader2 size={12} className="animate-spin"/> : <PlayCircle size={12}/>} Full backup
        </button>
        <button
          onClick={() => run("incremental")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-4 py-2 text-[12px] font-black text-neutral-900 disabled:opacity-40"
        >
          {busy === "incremental" ? <Loader2 size={12} className="animate-spin"/> : <PlayCircle size={12}/>} Incremental backup
        </button>
        {msg && (
          <span className={"ml-2 inline-flex items-center gap-1 text-[11px] font-black " + (msg.ok ? "text-green-700" : "text-red-700")}>
            {msg.ok ? <CheckCircle2 size={12}/> : <AlertCircle size={12}/>} {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Restore ────────────────────────────────────────────────────

function RestoreCard() {
  const router = useRouter();
  const [busy, setBusy] = useState<"upload" | "execute" | null>(null);
  const [attempt, setAttempt] = useState<RestoreAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File | null;
    if (!file || file.size === 0) { setError("Pick a backup ZIP first"); return; }
    setBusy("upload"); setError(null); setAttempt(null);
    try {
      const res = await fetch("/api/admin/nex/backup/restore/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (json.ok) setAttempt(json.attempt);
      else setError(json.error ?? "upload_failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "network_error");
    } finally { setBusy(null); }
  }

  async function execute() {
    if (!attempt) return;
    if (!confirm("This restores the uploaded backup into Nex. A pre-restore snapshot is taken first. Continue?")) return;
    setBusy("execute"); setError(null);
    try {
      const res = await fetch("/api/admin/nex/backup/restore/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt_id: attempt.id, confirm: true })
      });
      const json = await res.json();
      if (json.ok) {
        setAttempt(json.attempt);
        router.refresh();
      } else {
        setError(json.error ?? "execute_failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "network_error");
    } finally { setBusy(null); }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-neutral-500">
        <Upload size={14}/> Restore
      </div>
      <form onSubmit={upload}>
        <label className="block text-[11px] font-black text-neutral-700">Upload a backup ZIP</label>
        <input type="file" name="file" accept=".zip" required className="mt-1 w-full text-[12px]"/>
        <button
          type="submit"
          disabled={busy !== null}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-[12px] font-black text-white disabled:opacity-40"
        >
          {busy === "upload" ? <Loader2 size={12} className="animate-spin"/> : <Upload size={12}/>} Validate + preview
        </button>
      </form>
      {error && <p className="mt-2 text-[11px] font-black text-red-700">{error}</p>}

      {attempt && attempt.status === "previewed" && attempt.preview_json && (
        <PreviewBlock preview={attempt.preview_json} onConfirm={execute} busy={busy === "execute"}/>
      )}

      {attempt && attempt.status === "restored" && (
        <div className="mt-3 rounded-lg bg-green-50 p-2 text-[11px] font-black text-green-900">
          <CheckCircle2 size={12} className="inline"/> Restore complete. Pre-restore snapshot saved.
        </div>
      )}
    </div>
  );
}

function PreviewBlock({ preview, onConfirm, busy }: { preview: RestorePreview; onConfirm: () => void; busy: boolean }) {
  const tables = Object.keys(preview.will_insert);
  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px]">
      <p className="font-black text-amber-900">Preview</p>
      <table className="mt-2 w-full text-[11px]">
        <thead className="text-neutral-600">
          <tr>
            <th className="text-left">Table</th>
            <th className="text-right">Insert</th>
            <th className="text-right">Update</th>
            <th className="text-right">Skip</th>
          </tr>
        </thead>
        <tbody>
          {tables.map((t) => (
            <tr key={t}>
              <td className="capitalize">{t}</td>
              <td className="text-right font-black text-green-800">{preview.will_insert[t]}</td>
              <td className="text-right font-black text-amber-800">{preview.will_update[t]}</td>
              <td className="text-right text-neutral-500">{preview.will_skip[t]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-amber-900">
        A pre-restore snapshot is taken automatically before anything is written. Additive only — nothing deleted.
      </p>
      <button
        onClick={onConfirm}
        disabled={busy}
        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-amber-600 px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-40"
      >
        {busy ? <Loader2 size={11} className="animate-spin"/> : null} Execute restore
      </button>
    </div>
  );
}

// ─── History + audit ────────────────────────────────────────────

function HistoryTable({ backups }: { backups: BackupRun[] }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 p-3">
        <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-neutral-500">
          <History size={12}/> Backup history
        </div>
      </div>
      <table className="w-full text-[12px]">
        <thead className="bg-neutral-50 text-left text-[10px] font-black uppercase tracking-wider text-neutral-500">
          <tr>
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Kind</th>
            <th className="px-3 py-2">Records</th>
            <th className="px-3 py-2">Size</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">By</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {backups.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-neutral-500">No backups yet.</td></tr>}
          {backups.map((b) => {
            const records = b.entries_count + b.versions_count + b.edges_count + b.reviews_count + b.uploads_count + b.research_count;
            const statusCls =
              b.status === "complete" ? "bg-green-100 text-green-800" :
              b.status === "running"  ? "bg-amber-100 text-amber-800" :
                                         "bg-red-100 text-red-800";
            return (
              <tr key={b.id} className="border-t border-neutral-100">
                <td className="px-3 py-2">{new Date(b.created_at).toLocaleString("en-GB")}</td>
                <td className="px-3 py-2 capitalize">{b.kind.replace(/_/g, " ")}</td>
                <td className="px-3 py-2">{records}</td>
                <td className="px-3 py-2">{(b.size_bytes / 1024).toFixed(1)} KB</td>
                <td className="px-3 py-2">
                  <span className={"rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider " + statusCls}>{b.status}</span>
                </td>
                <td className="px-3 py-2 text-neutral-600">{b.created_by}</td>
                <td className="px-3 py-2">
                  {b.status === "complete" && <DownloadButton id={b.id}/>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DownloadButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  async function grab() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/nex/backup/${id}/download`);
      const json = await res.json();
      if (json.ok) window.location.href = json.signed_url as string;
      else alert(json.error ?? "download failed");
    } finally { setBusy(false); }
  }
  return (
    <button onClick={grab} disabled={busy} className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-black text-neutral-700 hover:border-neutral-900 disabled:opacity-40">
      {busy ? <Loader2 size={11} className="animate-spin"/> : <Download size={11}/>} Download
    </button>
  );
}

function RestoreAttempts({ attempts }: { attempts: RestoreAttempt[] }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 p-3">
        <p className="text-[11px] font-black uppercase tracking-wider text-neutral-500">Restore attempts</p>
      </div>
      <table className="w-full text-[12px]">
        <thead className="bg-neutral-50 text-left text-[10px] font-black uppercase tracking-wider text-neutral-500">
          <tr>
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Pre-snapshot</th>
            <th className="px-3 py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => (
            <tr key={a.id} className="border-t border-neutral-100">
              <td className="px-3 py-2">{new Date(a.attempted_at).toLocaleString("en-GB")}</td>
              <td className="px-3 py-2 uppercase text-[10px] font-black">{a.status}</td>
              <td className="px-3 py-2 text-neutral-500">{a.pre_restore_snapshot_id ? a.pre_restore_snapshot_id.slice(0, 8) : "—"}</td>
              <td className="px-3 py-2 text-neutral-600">
                {a.error_message
                  ? <span className="text-red-700">{a.error_message}</span>
                  : a.restored_counts_json
                    ? Object.entries(a.restored_counts_json).map(([k, v]) => `${k}: +${v.inserted}/${v.updated}`).join(" · ")
                    : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
