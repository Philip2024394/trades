// src/app/nex/settings/page.tsx
//
// Founder Phase 10 · P10-5 · User settings + memory transparency.
//
// The visible differentiator vs ChatGPT:
//   · Sign up anonymously (no email required)
//   · See EVERY memory NEX has about you
//   · Delete individual memories with one click
//   · Export all your data as JSON (right-to-know)
//   · Delete your account (right-to-delete)

"use client";

import { useCallback, useEffect, useState } from "react";

interface SessionResp { authenticated: boolean; user_id: string | null; account?: { display_name?: string | null; created_at?: string } }
interface Memory {
  memory_id: string;
  claim_text: string;
  category: string;
  tier?: string;
  confidence: number;
  created_at: string;
  expires_at?: string | null;
}
interface CustomInstructions {
  preferred_language?: string;
  bio?: string;
  goals?: string;
  style?: string;
  do_not?: string;
  updated_at?: string;
}
interface LangOption { code: string; name_native: string; }
interface OAuthProvider { id: string; display_name: string; configured: boolean; start_url: string | null; }

export default function SettingsPage() {
  const [session, setSession] = useState<SessionResp | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [instructions, setInstructions] = useState<CustomInstructions>({});
  const [languages, setLanguages] = useState<LangOption[]>([]);
  const [instrSavedMsg, setInstrSavedMsg] = useState<string | null>(null);
  const [oauthProviders, setOauthProviders] = useState<OAuthProvider[]>([]);

  const loadSession = useCallback(async () => {
    try {
      const r = await fetch("/api/nex/auth/session", { cache: "no-store" });
      if (r.ok) setSession(await r.json());
    } catch (e) { setError(e instanceof Error ? e.message : "load"); }
  }, []);
  const loadMemories = useCallback(async () => {
    try {
      const r = await fetch("/api/nex/user/memory/list", { cache: "no-store" });
      if (r.status === 401) { setMemories([]); return; }
      if (r.ok) setMemories((await r.json()).memories ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "load"); }
  }, []);
  const loadInstructions = useCallback(async () => {
    try {
      const r = await fetch("/api/nex/user/instructions", { cache: "no-store" });
      if (r.status === 401) { setInstructions({}); setLanguages([]); return; }
      if (r.ok) {
        const j = await r.json();
        setInstructions(j.instructions ?? {});
        setLanguages(j.languages ?? []);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "load_instructions"); }
  }, []);
  const loadProviders = useCallback(async () => {
    try {
      const r = await fetch("/api/nex/auth/providers", { cache: "no-store" });
      if (r.ok) setOauthProviders((await r.json()).providers ?? []);
    } catch { /* ignore · providers list is optional */ }
  }, []);
  useEffect(() => { void loadSession(); void loadMemories(); void loadInstructions(); void loadProviders(); }, [loadSession, loadMemories, loadInstructions, loadProviders]);

  const saveInstructions = async () => {
    setBusy(true); setInstrSavedMsg(null);
    try {
      const r = await fetch("/api/nex/user/instructions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(instructions),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setInstructions(j.instructions ?? {});
      const neut = j.sanitiser_neutralised ?? 0;
      setInstrSavedMsg(neut > 0 ? `Saved · ${neut} suspicious pattern${neut === 1 ? "" : "s"} neutralised` : "Saved.");
      setTimeout(() => setInstrSavedMsg(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "save_failed");
    } finally { setBusy(false); }
  };

  const signup = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/nex/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await loadSession(); await loadMemories();
    } catch (e) { setError(e instanceof Error ? e.message : "signup_failed"); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    setBusy(true);
    try { await fetch("/api/nex/auth/logout", { method: "POST" }); }
    finally { await loadSession(); await loadMemories(); setBusy(false); }
  };
  const deleteMemory = async (id: string) => {
    if (!confirm(`Delete this memory?\n\n${id}`)) return;
    setBusy(true);
    try {
      await fetch(`/api/nex/user/memory/${encodeURIComponent(id)}`, { method: "DELETE" });
      await loadMemories();
    } finally { setBusy(false); }
  };
  const exportData = () => window.open("/api/nex/user/export", "_blank");
  const deleteAccount = async () => {
    if (!confirm("Delete your account? This cascades to memories, sessions, custom instructions.\n\nThis is irreversible.")) return;
    setBusy(true);
    try { await fetch("/api/nex/user/delete", { method: "POST" }); }
    finally { await loadSession(); await loadMemories(); setBusy(false); }
  };

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>NEX Settings</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.7 }}>
            See what NEX remembers about you. Delete anything. Export everything.
            Right-to-know · right-to-delete · Doctrine #4 preserved.
          </p>
        </div>
      </header>

      {error && (
        <div style={{ ...cardStyle, borderColor: "#b91c1c", background: "#fef2f2" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Identity</h2>
        {session?.authenticated ? (
          <>
            <dl style={dlStyle}>
              <dt>user_id</dt><dd style={{ fontFamily: "monospace", fontSize: 12 }}>{session.user_id}</dd>
              <dt>Display name</dt><dd>{session.account?.display_name ?? "(none)"}</dd>
              <dt>Account created</dt><dd>{session.account?.created_at?.slice(0, 19).replace("T", " ") ?? "—"}</dd>
            </dl>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button onClick={exportData} style={buttonStyle} disabled={busy}>Export data (JSON)</button>
              <button onClick={logout} style={buttonStyle} disabled={busy}>Log out</button>
              <button onClick={deleteAccount} style={{ ...buttonStyle, background: "#fef2f2", borderColor: "#fecaca", color: "#b91c1c" }} disabled={busy}>Delete account</button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, opacity: 0.7 }}>Not signed in. Sign up anonymously (no email required) or use an OAuth provider.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              <button onClick={signup} style={{ ...buttonStyle, background: "#0f172a", color: "#fff", borderColor: "#0f172a" }} disabled={busy}>Sign up anonymously</button>
              {oauthProviders.filter((p) => p.configured && p.start_url).map((p) => (
                <a key={p.id} href={p.start_url ?? "#"} style={{ ...buttonStyle, textDecoration: "none", display: "inline-block", background: "#fff" }}>
                  Sign in with {p.display_name}
                </a>
              ))}
              {oauthProviders.some((p) => !p.configured) && (
                <span style={{ fontSize: 11, opacity: 0.55, alignSelf: "center" }}>
                  {oauthProviders.filter((p) => !p.configured).map((p) => p.display_name).join(", ")}: unconfigured
                </span>
              )}
            </div>
          </>
        )}
      </section>

      {session?.authenticated && (
        <section style={cardStyle} data-instructions-section="true">
          <h2 style={sectionTitleStyle}>Custom instructions + language</h2>
          <p style={{ margin: "6px 0", fontSize: 12, opacity: 0.65 }}>
            Shape how NEX responds. Context only · never establishes truth. Every field passes
            through the Doctrine #5 sanitiser before it saves.
          </p>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label style={{ fontSize: 13 }}>
              Preferred language
              <select
                value={instructions.preferred_language ?? ""}
                onChange={(e) => setInstructions({ ...instructions, preferred_language: e.target.value || undefined })}
                style={{ marginLeft: 10, padding: "4px 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13 }}
                disabled={busy}
              >
                <option value="">— default —</option>
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>{l.code} · {l.name_native}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 13 }}>
              About you (bio · 500 chars)
              <textarea
                value={instructions.bio ?? ""}
                onChange={(e) => setInstructions({ ...instructions, bio: e.target.value })}
                maxLength={500}
                rows={2}
                style={{ width: "100%", marginTop: 4, padding: 6, border: "1px solid #cbd5e1", borderRadius: 4, fontFamily: "system-ui", fontSize: 13, resize: "vertical" }}
                disabled={busy}
              />
            </label>
            <label style={{ fontSize: 13 }}>
              Your goals (1000 chars)
              <textarea
                value={instructions.goals ?? ""}
                onChange={(e) => setInstructions({ ...instructions, goals: e.target.value })}
                maxLength={1000}
                rows={3}
                style={{ width: "100%", marginTop: 4, padding: 6, border: "1px solid #cbd5e1", borderRadius: 4, fontFamily: "system-ui", fontSize: 13, resize: "vertical" }}
                disabled={busy}
              />
            </label>
            <label style={{ fontSize: 13 }}>
              Preferred response style (500 chars)
              <textarea
                value={instructions.style ?? ""}
                onChange={(e) => setInstructions({ ...instructions, style: e.target.value })}
                maxLength={500}
                rows={2}
                style={{ width: "100%", marginTop: 4, padding: 6, border: "1px solid #cbd5e1", borderRadius: 4, fontFamily: "system-ui", fontSize: 13, resize: "vertical" }}
                disabled={busy}
              />
            </label>
            <label style={{ fontSize: 13 }}>
              Do NOT do the following (500 chars)
              <textarea
                value={instructions.do_not ?? ""}
                onChange={(e) => setInstructions({ ...instructions, do_not: e.target.value })}
                maxLength={500}
                rows={2}
                style={{ width: "100%", marginTop: 4, padding: 6, border: "1px solid #cbd5e1", borderRadius: 4, fontFamily: "system-ui", fontSize: 13, resize: "vertical" }}
                disabled={busy}
              />
            </label>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={saveInstructions} style={buttonStyle} disabled={busy}>
                {busy ? "Saving…" : "Save instructions"}
              </button>
              {instrSavedMsg && <span style={{ fontSize: 12, color: "#166534" }}>{instrSavedMsg}</span>}
              {instructions.updated_at && (
                <span style={{ fontSize: 11, opacity: 0.6 }}>updated {instructions.updated_at.slice(0, 19).replace("T", " ")}</span>
              )}
            </div>
          </div>
        </section>
      )}

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Your memories ({memories.length})</h2>
        <p style={{ margin: "6px 0", fontSize: 12, opacity: 0.65 }}>
          Every claim below shapes NEX's replies. None of it is treated as truth (Doctrine #4).
        </p>
        {memories.length === 0 ? (
          <p style={{ opacity: 0.6, fontSize: 13 }}>No memories yet. NEX has learned nothing about you.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.65 }}>
                <th>Claim</th><th>Category</th><th>Tier</th><th>Confidence</th><th>Created</th><th></th>
              </tr>
            </thead>
            <tbody>
              {memories.map((m) => (
                <tr key={m.memory_id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "6px 8px 6px 0" }}>{m.claim_text}</td>
                  <td style={{ opacity: 0.7 }}>{m.category}</td>
                  <td style={{ opacity: 0.7 }}>{m.tier ?? "semantic"}</td>
                  <td>{m.confidence.toFixed(2)}</td>
                  <td style={{ opacity: 0.7 }}>{m.created_at.slice(0, 10)}</td>
                  <td>
                    <button onClick={() => void deleteMemory(m.memory_id)} style={miniButtonStyle} disabled={busy}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer style={{ marginTop: 24, fontSize: 11, opacity: 0.5 }}>
        data-settings-page = "true" · Doctrine #4 preserved · full transparency by design
      </footer>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  padding: "24px 28px 60px",
  maxWidth: 900,
  margin: "0 auto",
  color: "#0f172a",
};
const headerStyle: React.CSSProperties = { paddingBottom: 12, borderBottom: "1px solid #e5e7eb", marginBottom: 12 };
const cardStyle: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, background: "#fff", marginTop: 12 };
const sectionTitleStyle: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 600 };
const dlStyle: React.CSSProperties = { margin: "8px 0 0", fontSize: 13, display: "grid", gridTemplateColumns: "160px 1fr", rowGap: 6, columnGap: 8 };
const buttonStyle: React.CSSProperties = { padding: "6px 14px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: 13, cursor: "pointer" };
const miniButtonStyle: React.CSSProperties = { padding: "3px 10px", borderRadius: 4, border: "1px solid #fecaca", background: "#fef2f2", fontSize: 11, cursor: "pointer", color: "#b91c1c" };
