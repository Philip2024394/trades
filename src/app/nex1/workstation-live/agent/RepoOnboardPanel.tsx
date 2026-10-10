"use client";

// src/app/nex1/workstation-live/agent/RepoOnboardPanel.tsx
//
// NEX1 · Primary Workstation · Repo Onboarding Panel · 2026-09-17.
// Founder-authorised: this workstation is the ONLY coding workstation.
// The onboarding capability lives here as a tab · not a separate route.
//
// STRUCTURE
//   Top    · repo picker (live from GET /api/nex1/workstation/onboard)
//   Middle · file tree + selected-file preview (image/video/audio/pdf/html/code)
//   Bottom · workstation chat feed (POST /api/nex1/workstation/chat)
//
// DISCIPLINE
//   · Zero LLM · zero external network · zero code execution from target repo.
//   · Every file is READ-ONLY via /api/nex1/workstation/repo-file.
//   · HTML preview uses `srcdoc` with `sandbox=""` (all iframe permissions
//     stripped). Uploaded HTML cannot escape to attack the workstation origin.
//   · Media served via `?raw=1` mode with `X-Content-Type-Options: nosniff`.
//   · The chat feed is populated by real SSE + workstation chat responses.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface RepoSummary { repo_id: string; file_count: number; total_bytes: number }
interface OnboardEvent { kind: string; at_ms: number; data: Record<string, unknown> }
interface DirEntry { name: string; kind: "dir" | "file"; size?: number }
interface FileResponse {
  ok: true;
  kind: "file" | "dir" | "binary";
  path: string;
  size?: number;
  language?: string | null;
  content?: string;
  entries?: DirEntry[];
  mime?: string;
  truncated?: boolean;
  preview_kind?: "image" | "video" | "audio" | "pdf" | "binary_other";
  raw_url?: string;
}

const KIND_COLOR: Record<string, string> = {
  started: "#64748b", path_resolved: "#64748b",
  size_computed: "#0891b2", code_types: "#0891b2",
  framework_detected: "#059669", package_details: "#059669",
  scan_error: "#dc2626", scan_summary: "#0284c7",
  restructure_suggestion: "#d97706",
  readme_summary: "#7c3aed",
  notable_signal: "#0284c7",
  ready_for_prompt: "#16a34a",
  onboarding_denied: "#dc2626",
};

function humanBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function eventLine(e: OnboardEvent): string {
  const d = e.data as Record<string, unknown>;
  switch (e.kind) {
    case "started":            return `Onboarding started · repo=${String(d.repo_id ?? "")}`;
    case "path_resolved":      return `Resolved: ${String(d.abs ?? "")}`;
    case "size_computed":      return `${String(d.file_count ?? "?")} files · ${humanBytes(Number(d.total_bytes ?? 0))}`;
    case "code_types":         {
      const dist = (d.distribution as Array<{ ext: string; count: number }> | undefined) ?? [];
      return `Code types: ${dist.slice(0, 6).map((x) => `${x.ext}:${x.count}`).join(" · ") || "n/a"}`;
    }
    case "framework_detected": {
      const parts: string[] = [];
      const fw = d.frameworks as string[] | undefined;
      const ds = d.data as string[] | undefined;
      if (fw?.length) parts.push(`framework: ${fw.join(" + ")}`);
      if (ds?.length) parts.push(`data: ${ds.join(", ")}`);
      return parts.join(" · ") || "no top-level framework detected";
    }
    case "package_details":    return `package.json · name=${String(d.name ?? "n/a")} · deps=${String(d.dependencies_count ?? 0)} · scripts=${String(d.scripts_count ?? 0)}`;
    case "scan_error":         return `⚠ ${String(d.kind ?? "scan")} · ${String(d.file ?? "")}`;
    case "scan_summary":       return `Scan: HIGH=${String(d.HIGH ?? 0)} · MEDIUM=${String(d.MEDIUM ?? 0)} · LOW=${String(d.LOW ?? 0)}`;
    case "restructure_suggestion": return `[${String(d.severity ?? "").toUpperCase()}] ${String(d.kind ?? "")} · ${String(d.rationale ?? "")}`;
    case "readme_summary":     return `README · ${String(d.file ?? "")} · ${String(d.length ?? 0)} bytes`;
    case "notable_signal":     return `ℹ ${String(d.text ?? "")}`;
    case "ready_for_prompt":   return `✓ Ready · ${String(d.file_count ?? "?")} files · ${String(d.frameworks_detected ?? 0)} framework(s) · ${String(d.restructure_suggestions_count ?? 0)} suggestion(s)`;
    case "onboarding_denied":  return `✗ Denied · ${String(d.reason ?? "")}`;
    default:                   return JSON.stringify(d);
  }
}

export interface RepoOnboardPanelProps {
  /**
   * Optional callback fired when the user clicks "▶ Show in phone" for a
   * repo file. The primary workstation passes `setPreviewUrl` here so the
   * selected file renders inside the LEFT app-phone iframe. If omitted the
   * "Show in phone" buttons still work by opening the preview page in a new
   * tab · nothing renders anywhere in the current workstation.
   */
  readonly onShowInPhone?: (previewUrl: string, meta: { repo_id: string; path: string; kind: "html" | "image" | "video" | "audio" | "pdf" }) => void;
}

export function RepoOnboardPanel({ onShowInPhone }: RepoOnboardPanelProps = {}) {
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [reposState, setReposState] = useState<"loading" | "ok" | "error" | "empty">("loading");
  const [reposError, setReposError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [events, setEvents] = useState<OnboardEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamError, setStreamError] = useState("");
  const [treeCwd, setTreeCwd] = useState("");
  const [treeEntries, setTreeEntries] = useState<DirEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileResponse | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "nex1"; text: string; state?: string }>>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [conversationId] = useState(() => `workstation-onboard-${Date.now()}`);
  const abortRef = useRef<AbortController | null>(null);
  const chatFeedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReposState("loading");
    setReposError("");
    (async () => {
      try {
        const res = await fetch("/api/nex1/workstation/onboard");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        if (cancelled) return;
        const list: RepoSummary[] = d.repos ?? [];
        setRepos(list);
        setReposState(list.length === 0 ? "empty" : "ok");
      } catch (e) {
        if (cancelled) return;
        setReposState("error");
        setReposError(String((e as Error)?.message ?? e));
      }
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  const loadDir = useCallback(async (repoId: string, dirPath: string) => {
    const u = new URL("/api/nex1/workstation/repo-file", window.location.origin);
    u.searchParams.set("repo_id", repoId);
    if (dirPath) u.searchParams.set("path", dirPath);
    const res = await fetch(u.toString());
    const data = (await res.json()) as FileResponse;
    if (data.ok && data.kind === "dir") {
      setTreeCwd(dirPath);
      setTreeEntries(data.entries ?? []);
    }
  }, []);

  const loadFile = useCallback(async (repoId: string, filePath: string) => {
    const u = new URL("/api/nex1/workstation/repo-file", window.location.origin);
    u.searchParams.set("repo_id", repoId);
    u.searchParams.set("path", filePath);
    const res = await fetch(u.toString());
    const data = (await res.json()) as FileResponse;
    if (data.ok) setSelectedFile(data);
  }, []);

  const onboard = useCallback(async (repoId: string) => {
    setSelectedRepo(repoId);
    setEvents([]);
    setSelectedFile(null);
    setStreamError("");
    setStreaming(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/nex1/workstation/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify({ repo_id: repoId }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`onboard HTTP ${res.status}`);
      if (!res.body) throw new Error("no response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      const start = Date.now();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/\n\n/);
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          let ev = "message";
          let data = "";
          for (const line of frame.split(/\n/)) {
            if (line.startsWith("event:")) ev = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            setEvents((prev) => [...prev, { kind: ev, at_ms: Date.now() - start, data: parsed }]);
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") {
        setStreamError(String((err as Error)?.message ?? err));
      }
    } finally {
      setStreaming(false);
      loadDir(repoId, "").catch(() => {});
    }
  }, [loadDir]);

  useEffect(() => {
    const el = chatFeedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatBusy || !selectedRepo) return;
    const text = chatInput;
    setChatMessages((p) => [...p, { role: "user", text }]);
    setChatInput("");
    setChatBusy(true);
    try {
      const sizeEv = events.find((e) => e.kind === "size_computed");
      const fwEv = events.find((e) => e.kind === "framework_detected");
      const suggCount = events.filter((e) => e.kind === "restructure_suggestion").length;
      const errCount = events.filter((e) => e.kind === "scan_error").length;
      const readyEv = events.find((e) => e.kind === "ready_for_prompt");
      const context = {
        repo_id: selectedRepo,
        file_count: sizeEv?.data?.file_count as number | undefined,
        total_bytes: sizeEv?.data?.total_bytes as number | undefined,
        frameworks: (fwEv?.data?.frameworks as string[] | undefined) ?? [],
        restructure_suggestions_count: suggCount,
        scan_errors_count: errCount,
        ready_for_prompt: Boolean(readyEv),
        selected_file_path: selectedFile?.path ?? null,
      };
      const res = await fetch("/api/nex1/workstation/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, message: text, repo_id: selectedRepo, context }),
      });
      const data = await res.json();
      let replyText = "(no text)";
      if (typeof data.text === "string" && data.text.length > 0) replyText = data.text;
      else if (data.upstream && typeof (data.upstream as { text?: string }).text === "string") replyText = (data.upstream as { text: string }).text;
      const stateLabel: string = data.state === "forwarded"
        ? `forwarded → ${data.forwarded_to} · upstream ${data.upstream_status}`
        : (data.state ?? "answered");
      setChatMessages((p) => [...p, { role: "nex1", text: replyText, state: stateLabel }]);
    } catch (e) {
      setChatMessages((p) => [...p, { role: "nex1", text: "(network error)", state: "error" }]);
    } finally {
      setChatBusy(false);
    }
  }, [chatInput, chatBusy, conversationId, selectedRepo, events, selectedFile]);

  // Build the URL the LEFT phone iframe should load for the currently
  // selected file. HTML routes through the sandboxed preview page · media
  // files use the raw endpoint directly (mime is honoured, no scripts).
  const phonePreviewFor = useCallback((repoId: string, filePath: string, previewKind: FileResponse["preview_kind"], language: string | null | undefined): { url: string; kind: "html" | "image" | "video" | "audio" | "pdf" } | null => {
    if (language === "html") {
      return { url: `/nex1/workstation-live/repo-preview?repo_id=${encodeURIComponent(repoId)}&path=${encodeURIComponent(filePath)}`, kind: "html" };
    }
    if (previewKind === "image" || previewKind === "video" || previewKind === "audio" || previewKind === "pdf") {
      return { url: `/nex1/workstation-live/repo-preview?repo_id=${encodeURIComponent(repoId)}&path=${encodeURIComponent(filePath)}`, kind: previewKind };
    }
    return null;
  }, []);

  const showInPhone = useCallback((filePath: string, previewKind: FileResponse["preview_kind"], language: string | null | undefined) => {
    if (!selectedRepo) return;
    const meta = phonePreviewFor(selectedRepo, filePath, previewKind, language);
    if (!meta) return;
    if (onShowInPhone) {
      onShowInPhone(meta.url, { repo_id: selectedRepo, path: filePath, kind: meta.kind });
    } else {
      // Fallback · open in a new tab so the founder still sees it.
      try { window.open(meta.url, "_blank", "noopener,noreferrer"); } catch { /* popup blocked */ }
    }
  }, [selectedRepo, phonePreviewFor, onShowInPhone]);

  const readyEv = useMemo(() => events.find((e) => e.kind === "ready_for_prompt"), [events]);
  const sizeEv = useMemo(() => events.find((e) => e.kind === "size_computed"), [events]);
  const fwEv = useMemo(() => events.find((e) => e.kind === "framework_detected"), [events]);
  const suggestions = useMemo(() => events.filter((e) => e.kind === "restructure_suggestion"), [events]);
  const errors = useMemo(() => events.filter((e) => e.kind === "scan_error"), [events]);

  // .naw-panel is `display: flex; flex-direction: column; overflow-y: auto`.
  // We are a flex CHILD · use `flex: 1` (not height: 100%) to fill the space
  // the panel gives us. `minHeight: 0` prevents flex-shrink lock.
  const wrap: React.CSSProperties = { display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 6, fontSize: 12 };
  const box: React.CSSProperties = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, padding: 8 };

  return (
    <div style={wrap} data-nex-repo-onboard-panel="true">
      {/* Repo picker */}
      <div style={{ ...box, flex: "0 0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600, letterSpacing: 0.4 }}>REPO ONBOARDING · NEX1_NATIVE · zero LLM</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span
              data-nex-repos-state={reposState}
              style={{
                fontSize: 10, padding: "2px 6px", borderRadius: 4,
                background: reposState === "ok" ? "#065f46" : reposState === "loading" ? "#0369a1" : reposState === "empty" ? "#78350f" : "#7f1d1d",
                color: "#e2e8f0",
              }}
            >
              {reposState === "loading" ? "loading…"
                : reposState === "ok" ? `${repos.length} repo${repos.length === 1 ? "" : "s"}`
                : reposState === "empty" ? "no repos"
                : "error"}
            </span>
            <button
              onClick={() => setReloadTick((t) => t + 1)}
              style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, border: "1px solid #334155", background: "#1e293b", color: "#93c5fd", cursor: "pointer" }}
            >↻</button>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {reposState === "empty" && (
            <span style={{ fontSize: 11, opacity: 0.7 }}>corpus is empty · drop a repo into <code>data/nex-training-corpus/</code></span>
          )}
          {reposState === "error" && (
            <span style={{ fontSize: 11, color: "#fca5a5" }}>fetch failed · {reposError} · hit ↻</span>
          )}
          {reposState === "loading" && repos.length === 0 && (
            <span style={{ fontSize: 11, opacity: 0.6 }}>fetching…</span>
          )}
          {repos.map((r) => (
            <button
              key={r.repo_id}
              onClick={() => onboard(r.repo_id)}
              data-nex-onboard-repo={r.repo_id}
              style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 6,
                border: selectedRepo === r.repo_id ? "1px solid #22d3ee" : "1px solid #334155",
                background: selectedRepo === r.repo_id ? "#0e7490" : "#1e293b",
                color: "#e2e8f0", cursor: "pointer",
              }}
            >
              {r.repo_id} · {r.file_count} files · {humanBytes(r.total_bytes)}
            </button>
          ))}
        </div>
        {selectedRepo && (
          <div style={{ marginTop: 8, fontSize: 11, opacity: 0.85, display: "flex", flexWrap: "wrap", gap: 10 }}>
            <span>{streaming ? "onboarding…" : (readyEv ? "✓ ready" : "idle")}</span>
            {sizeEv && <span>📊 {String(sizeEv.data.file_count)} files · {humanBytes(Number(sizeEv.data.total_bytes ?? 0))}</span>}
            {fwEv && Array.isArray(fwEv.data.frameworks) && (fwEv.data.frameworks as string[]).length > 0 && (
              <span>🛠 {(fwEv.data.frameworks as string[]).join(" + ")}</span>
            )}
            {errors.length > 0 && <span style={{ color: "#f87171" }}>{errors.length} scan-error(s)</span>}
            {suggestions.length > 0 && <span style={{ color: "#fbbf24" }}>{suggestions.length} suggestion(s)</span>}
          </div>
        )}
        {streamError && (
          <div style={{ marginTop: 6, fontSize: 11, color: "#fca5a5" }}>onboard stream error · {streamError}</div>
        )}
      </div>

      {/* Tree + preview · when a repo is picked */}
      {selectedRepo && (
        <div style={{ ...box, flex: "1 1 40%", display: "flex", padding: 0, minHeight: 200 }}>
          {/* Tree */}
          <div style={{ flex: "0 0 200px", borderRight: "1px solid #1e293b", overflow: "auto" }}>
            <div style={{ padding: "6px 8px", fontSize: 10, opacity: 0.65, borderBottom: "1px solid #1e293b", background: "#0b1220" }}>
              {treeCwd || "/ (root)"}
              {treeCwd && (
                <button
                  onClick={() => loadDir(selectedRepo, treeCwd.split("/").slice(0, -1).join("/"))}
                  style={{ marginLeft: 6, fontSize: 10, background: "transparent", color: "#93c5fd", border: "none", cursor: "pointer" }}
                >← up</button>
              )}
            </div>
            {treeEntries.map((e) => (
              <div
                key={e.name}
                onClick={() => {
                  const child = treeCwd ? `${treeCwd}/${e.name}` : e.name;
                  if (e.kind === "dir") loadDir(selectedRepo, child);
                  else loadFile(selectedRepo, child);
                }}
                data-nex-tree-entry={e.kind}
                style={{
                  padding: "3px 8px", fontSize: 11, cursor: "pointer",
                  color: e.kind === "dir" ? "#93c5fd" : "#e2e8f0",
                  display: "flex", justifyContent: "space-between",
                }}
              >
                <span>{e.kind === "dir" ? "📁 " : "📄 "}{e.name}</span>
                {e.kind === "file" && e.size !== undefined && (
                  <span style={{ opacity: 0.4, fontSize: 10 }}>{humanBytes(e.size)}</span>
                )}
              </div>
            ))}
            {treeEntries.length === 0 && !streaming && (
              <div style={{ padding: 8, fontSize: 11, opacity: 0.5 }}>Tree loads after onboarding completes…</div>
            )}
          </div>
          {/* Preview */}
          <div style={{ flex: 1, overflow: "auto", padding: 8, background: "#0b1220" }}>
            {!selectedFile && (
              <div style={{ color: "#64748b", fontSize: 11 }}>
                Click a file to preview it.<br />
                · HTML → sandboxed iframe (scripts disabled)<br />
                · Image / GIF / SVG / ICO → inline<br />
                · Video / Audio → controls bar<br />
                · PDF → embedded viewer<br />
                · Code → syntax-hinted read-only
              </div>
            )}
            {selectedFile?.kind === "file" && selectedFile.language === "html" && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontSize: 10, opacity: 0.55 }}>{selectedFile.path} · {humanBytes(selectedFile.size ?? 0)} · sandboxed · scripts DISABLED</div>
                  <button
                    onClick={() => showInPhone(selectedFile.path, undefined, "html")}
                    data-nex-show-in-phone="html"
                    title="Load this file into the LEFT app-phone preview"
                    style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid #22d3ee", background: "#164e63", color: "#22d3ee", cursor: "pointer" }}
                  >▶ Show in phone</button>
                </div>
                <iframe srcDoc={selectedFile.content ?? ""} sandbox="" style={{ width: "100%", minHeight: 320, background: "#fff", border: "1px solid #334155", borderRadius: 4 }} />
              </>
            )}
            {selectedFile?.kind === "file" && selectedFile.language !== "html" && (
              <>
                <div style={{ fontSize: 10, opacity: 0.55, marginBottom: 4 }}>{selectedFile.path} · {humanBytes(selectedFile.size ?? 0)} · {selectedFile.language ?? "text"}{selectedFile.truncated && <span style={{ color: "#f59e0b" }}> · truncated 512 KB</span>}</div>
                <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 8, borderRadius: 4, overflow: "auto", fontSize: 11, lineHeight: 1.4, whiteSpace: "pre", fontFamily: "Menlo, Consolas, monospace", maxHeight: 400 }}>{selectedFile.content ?? ""}</pre>
              </>
            )}
            {selectedFile?.kind === "binary" && selectedFile.preview_kind === "image" && selectedFile.raw_url && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontSize: 10, opacity: 0.55 }}>{selectedFile.path} · {humanBytes(selectedFile.size ?? 0)} · {selectedFile.mime}</div>
                  <button
                    onClick={() => showInPhone(selectedFile.path, "image", selectedFile.language)}
                    data-nex-show-in-phone="image"
                    title="Load this image into the LEFT app-phone preview"
                    style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid #22d3ee", background: "#164e63", color: "#22d3ee", cursor: "pointer" }}
                  >▶ Show in phone</button>
                </div>
                <div style={{ background: "#0f172a", padding: 6, borderRadius: 4, border: "1px solid #334155", display: "flex", justifyContent: "center", minHeight: 180 }}>
                  <img src={selectedFile.raw_url} alt={selectedFile.path} data-nex-preview-kind="image" style={{ maxWidth: "100%", maxHeight: 380, objectFit: "contain" }} />
                </div>
              </>
            )}
            {selectedFile?.kind === "binary" && selectedFile.preview_kind === "video" && selectedFile.raw_url && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontSize: 10, opacity: 0.55 }}>{selectedFile.path} · {humanBytes(selectedFile.size ?? 0)} · {selectedFile.mime}</div>
                  <button
                    onClick={() => showInPhone(selectedFile.path, "video", selectedFile.language)}
                    data-nex-show-in-phone="video"
                    title="Load this video into the LEFT app-phone preview"
                    style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid #22d3ee", background: "#164e63", color: "#22d3ee", cursor: "pointer" }}
                  >▶ Show in phone</button>
                </div>
                <video src={selectedFile.raw_url} controls data-nex-preview-kind="video" style={{ width: "100%", maxHeight: 380, background: "#000", borderRadius: 4 }} />
              </>
            )}
            {selectedFile?.kind === "binary" && selectedFile.preview_kind === "audio" && selectedFile.raw_url && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontSize: 10, opacity: 0.55 }}>{selectedFile.path} · {humanBytes(selectedFile.size ?? 0)} · {selectedFile.mime}</div>
                  <button
                    onClick={() => showInPhone(selectedFile.path, "audio", selectedFile.language)}
                    data-nex-show-in-phone="audio"
                    title="Load this audio into the LEFT app-phone preview"
                    style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid #22d3ee", background: "#164e63", color: "#22d3ee", cursor: "pointer" }}
                  >▶ Show in phone</button>
                </div>
                <audio src={selectedFile.raw_url} controls data-nex-preview-kind="audio" style={{ width: "100%" }} />
              </>
            )}
            {selectedFile?.kind === "binary" && selectedFile.preview_kind === "pdf" && selectedFile.raw_url && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontSize: 10, opacity: 0.55 }}>{selectedFile.path} · {humanBytes(selectedFile.size ?? 0)} · {selectedFile.mime}</div>
                  <button
                    onClick={() => showInPhone(selectedFile.path, "pdf", selectedFile.language)}
                    data-nex-show-in-phone="pdf"
                    title="Load this pdf into the LEFT app-phone preview"
                    style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid #22d3ee", background: "#164e63", color: "#22d3ee", cursor: "pointer" }}
                  >▶ Show in phone</button>
                </div>
                <embed src={selectedFile.raw_url} type="application/pdf" data-nex-preview-kind="pdf" style={{ width: "100%", height: 400, background: "#fff", border: "1px solid #334155", borderRadius: 4 }} />
              </>
            )}
            {selectedFile?.kind === "binary" && (!selectedFile.preview_kind || selectedFile.preview_kind === "binary_other") && (
              <div style={{ color: "#64748b", fontSize: 11 }}>
                {selectedFile.path} · binary · {selectedFile.mime} · {humanBytes(selectedFile.size ?? 0)}
                {selectedFile.raw_url && <> · <a href={selectedFile.raw_url} target="_blank" rel="noreferrer" style={{ color: "#38bdf8" }}>open raw</a></>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Event feed */}
      {selectedRepo && events.length > 0 && (
        <div style={{ ...box, flex: "0 1 auto", maxHeight: 140, overflow: "auto" }}>
          <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>ONBOARDING FEED · {events.length} events</div>
          {events.map((e, i) => (
            <div key={i} data-nex-event-kind={e.kind} style={{
              padding: "3px 6px", margin: "2px 0",
              borderLeft: `3px solid ${KIND_COLOR[e.kind] ?? "#475569"}`,
              fontSize: 11, background: "#0b1220", borderRadius: 3,
            }}>
              <span style={{ color: KIND_COLOR[e.kind] ?? "#94a3b8", fontFamily: "Menlo, Consolas, monospace" }}>{e.kind}</span>
              <span style={{ opacity: 0.5, marginLeft: 6, fontSize: 10 }}>+{e.at_ms}ms</span>
              <div style={{ marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{eventLine(e)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Chat */}
      {selectedRepo && (
        <div style={{ ...box, flex: "1 1 30%", display: "flex", flexDirection: "column", minHeight: 140, padding: 0 }}>
          <div style={{ padding: "6px 8px", fontSize: 10, opacity: 0.6, borderBottom: "1px solid #1e293b" }}>
            WORKSTATION CHAT · deterministic · zero LLM
          </div>
          <div ref={chatFeedRef} style={{ flex: 1, overflow: "auto", padding: 6 }}>
            {chatMessages.length === 0 && (
              <div style={{ fontSize: 11, opacity: 0.5, padding: 4 }}>
                Ask: &quot;can i see preview&quot; · &quot;how big is this repo&quot; · &quot;what framework is it&quot; · &quot;why the restructure suggestion&quot;. State a coding goal to hand off to NEX1.
              </div>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} style={{
                padding: "6px 8px", margin: "4px 0",
                background: m.role === "user" ? "#1e293b" : "#134e4a",
                borderRadius: 4, fontSize: 12,
              }}>
                <div style={{ fontSize: 9, opacity: 0.6, marginBottom: 2 }}>
                  {m.role === "user" ? "YOU" : "NEX1"}{m.state ? ` · ${m.state}` : ""}
                </div>
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: 6, borderTop: "1px solid #1e293b", display: "flex", gap: 6 }}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              placeholder={readyEv ? "Ready · ask or state a coding goal…" : "Ask a navigation question…"}
              disabled={chatBusy}
              data-nex-prompt-input="true"
              style={{ flex: 1, background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 4, padding: "6px 8px", fontSize: 12, outline: "none", opacity: chatBusy ? 0.5 : 1 }}
            />
            <button
              onClick={sendChat}
              disabled={chatBusy || !chatInput.trim()}
              style={{ padding: "6px 12px", background: "#0e7490", color: "#fff", border: "none", borderRadius: 4, fontSize: 12, cursor: chatBusy || !chatInput.trim() ? "not-allowed" : "pointer", opacity: chatBusy || !chatInput.trim() ? 0.5 : 1 }}
            >{chatBusy ? "…" : "Send"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
