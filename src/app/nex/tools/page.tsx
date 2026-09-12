// src/app/nex/tools/page.tsx
//
// Founder Phase 17 · P17-3 · Public tools playground.
// One page that exercises voice + file + chat + share in one flow.
// No frameworks · one client component · pure fetch.

"use client";

import { useRef, useState } from "react";

type Provenance = {
  kind: "voice" | "file";
  ref_id: string;
  provider: string;
  doctrine_note: string;
  text_length: number;
  completed: boolean;
  error?: string;
};

type Turn = {
  role: "user" | "assistant";
  content: string;
  provenance?: Provenance[];
};

export default function ToolsPlaygroundPage() {
  const [message, setMessage] = useState("");
  const [voiceB64, setVoiceB64] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const [fileB64, setFileB64] = useState<string | null>(null);
  const [fileMime, setFileMime] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [conversationId] = useState(() => crypto.randomUUID());
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const voiceInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function fileToBase64(f: File): Promise<string> {
    const buf = await f.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  async function pickVoice(f: File) {
    setVoiceB64(await fileToBase64(f));
    setVoiceName(f.name);
  }

  async function pickFile(f: File) {
    setFileB64(await fileToBase64(f));
    setFileMime(f.type || "application/octet-stream");
    setFileName(f.name);
  }

  async function send() {
    if (!message.trim() && !voiceB64 && !fileB64) return;
    setBusy(true);
    const userTurn: Turn = { role: "user", content: message || "(attachment-only turn)" };
    setTurns((t) => [...t, userTurn]);
    try {
      const res = await fetch("/api/nex-conv/chat-with-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversation_id: conversationId,
          voice_audio_base64: voiceB64 ?? undefined,
          voice_mime: voiceName?.endsWith(".mp3") ? "audio/mpeg" : "audio/wav",
          file_content_base64: fileB64 ?? undefined,
          file_mime: fileMime ?? undefined,
          file_name: fileName ?? undefined,
        }),
      });
      const j = await res.json();
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          content: j.reply ?? j.error ?? "(no reply)",
          provenance: j.provenance,
        },
      ]);
      setMessage("");
      setVoiceB64(null); setVoiceName(null);
      setFileB64(null); setFileMime(null); setFileName(null);
      if (voiceInput.current) voiceInput.current.value = "";
      if (fileInput.current) fileInput.current.value = "";
    } catch (e) {
      setTurns((t) => [...t, { role: "assistant", content: `Error: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const r = await fetch(`/api/nex/conversations/${conversationId}/share`, { method: "POST" });
    const j = await r.json();
    if (j.view_url) setShareUrl(j.view_url);
  }

  const s = {
    main: { maxWidth: 820, margin: "2rem auto", padding: "1rem", fontFamily: "system-ui" } as const,
    row: { display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 8 },
    box: { border: "1px solid #e4e4e7", borderRadius: 8, padding: "0.6rem 0.75rem", flex: 1, minWidth: 200 } as const,
    label: { fontSize: "0.7rem", color: "#71717a", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
    ta: { width: "100%", minHeight: 90, padding: "0.5rem", border: "1px solid #d4d4d8", borderRadius: 6, fontFamily: "system-ui", fontSize: "0.95rem" } as const,
    btn: { padding: "0.5rem 1rem", background: "#166534", color: "#fff", border: 0, borderRadius: 6, cursor: "pointer", fontSize: "0.9rem" } as const,
    btnAlt: { padding: "0.4rem 0.8rem", background: "#f4f4f5", color: "#18181b", border: "1px solid #d4d4d8", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" } as const,
    turn: (role: "user" | "assistant") => ({
      padding: "0.75rem 1rem",
      margin: "0.5rem 0",
      background: role === "user" ? "#f4f4f5" : "#ffffff",
      border: "1px solid #e4e4e7",
      borderRadius: 8,
    }),
    prov: { marginTop: "0.4rem", padding: "0.4rem 0.6rem", background: "#fafafa", border: "1px dashed #e4e4e7", borderRadius: 6, fontSize: "0.75rem", color: "#52525b" } as const,
    doctrine: { marginTop: "1.5rem", padding: "0.75rem 1rem", background: "#fafafa", border: "1px solid #e4e4e7", borderRadius: 8, fontSize: "0.8rem", color: "#52525b" } as const,
  };

  return (
    <main style={s.main}>
      <header>
        <div style={{ fontSize: "0.75rem", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          NEX · Tools Playground
        </div>
        <h1 style={{ margin: "0.25rem 0", fontSize: "1.5rem" }}>Chat with voice + file attachments</h1>
        <p style={{ color: "#71717a", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
          Every attachment routes through the doctrine-preserving pipeline. Voice and file text are
          spliced under explicit banners — they never establish truth on their own.
        </p>
      </header>

      <section aria-label="turns">
        {turns.map((t, i) => (
          <article key={i} style={s.turn(t.role)}>
            <div style={{ ...s.label, marginBottom: "0.3rem" }}>{t.role}</div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: "0.95rem", lineHeight: 1.5 }}>{t.content}</div>
            {t.provenance && t.provenance.length > 0 && (
              <div style={s.prov}>
                {t.provenance.map((p, j) => (
                  <div key={j}>
                    · {p.kind} · <code>{p.ref_id}</code> · {p.provider} · len={p.text_length}
                    {p.error ? ` · error=${p.error}` : ""} · {p.doctrine_note}
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>

      <section aria-label="composer" style={{ marginTop: "1rem" }}>
        <textarea
          style={s.ta}
          placeholder="Type your question…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={busy}
        />
        <div style={s.row}>
          <div style={s.box}>
            <div style={s.label}>Voice</div>
            <input
              ref={voiceInput}
              type="file"
              accept="audio/wav,audio/mpeg,audio/webm,audio/ogg,audio/flac,audio/mp3"
              disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickVoice(f); }}
            />
            {voiceName && <div style={{ fontSize: "0.75rem", color: "#166534" }}>✓ {voiceName}</div>}
          </div>
          <div style={s.box}>
            <div style={s.label}>File</div>
            <input
              ref={fileInput}
              type="file"
              accept=".txt,.md,.json,.pdf,.docx"
              disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickFile(f); }}
            />
            {fileName && <div style={{ fontSize: "0.75rem", color: "#166534" }}>✓ {fileName} ({fileMime})</div>}
          </div>
        </div>
        <div style={s.row}>
          <button style={s.btn} disabled={busy} onClick={send}>
            {busy ? "Working…" : "Send"}
          </button>
          <button style={s.btnAlt} disabled={busy || turns.length === 0} onClick={share}>
            Share this conversation
          </button>
          {shareUrl && (
            <a style={{ ...s.btnAlt, textDecoration: "none", display: "inline-block" }} href={shareUrl} target="_blank" rel="noopener">
              Open share link
            </a>
          )}
        </div>
      </section>

      <div style={s.doctrine}>
        <strong>Doctrines active on this page:</strong>
        <ul style={{ margin: "0.3rem 0 0 1rem", padding: 0 }}>
          <li>Voice input → transcript → never establishes truth</li>
          <li>File upload → extracted text → never establishes truth</li>
          <li>Doctrine #5 sanitiser applied to every attachment before splice</li>
          <li>Fabrication Gate v2 remains authoritative on every assistant claim</li>
          <li>Every turn auto-persisted to nex.conversation · searchable · branchable · shareable</li>
        </ul>
      </div>
    </main>
  );
}
