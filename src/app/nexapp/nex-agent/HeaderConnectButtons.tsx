"use client";

// src/app/nexapp/nex-agent/HeaderConnectButtons.tsx
//
// Compact icon buttons for the header · REPO (GitHub) · BACKEND (provider) ·
// HQ (back to HQ Workstation).
//
// Simplified from prior version to a single useState per button + a full-viewport
// invisible backdrop for outside-click close. Zero refs · zero effects · fewest
// possible hooks per component to eliminate hook-count crash surface.

import { useState } from "react";
import {
  PROVIDER_CATALOG,
  providersByCategory,
  type DatabaseProvider,
} from "@/lib/nex-agent/provider-catalog";

// ─── Shared: floating popover with backdrop-close ─────────────────────
function IconButtonWithPopover(props: {
  readonly icon: string;
  readonly label: string;
  readonly connected: boolean;
  readonly stateDot: "connected" | "disconnected" | "reachable-unknown";
  readonly title: string;
  readonly ariaLabel: string;
  readonly children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const dot =
    props.stateDot === "connected" ? "#22C55E" :
    props.stateDot === "reachable-unknown" ? "#F59E0B" : "#F97316";
  const dotGlow =
    props.stateDot === "connected" ? "0 0 6px rgba(34, 197, 94, 0.7)" :
    props.stateDot === "reachable-unknown" ? "0 0 6px rgba(245, 158, 11, 0.6)" :
    "0 0 5px rgba(249, 115, 22, 0.55)";

  const isConnected = props.connected;
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={props.title}
        aria-label={props.ariaLabel}
        aria-expanded={open}
        className="naw-header-icon-btn"
        style={{
          background: open ? "rgba(34, 211, 238, 0.16)"
            : isConnected ? "rgba(34, 197, 94, 0.10)"
            : "rgba(249, 115, 22, 0.12)",
          borderColor: open ? "rgba(34, 211, 238, 0.6)"
            : isConnected ? "rgba(34, 197, 94, 0.5)"
            : "rgba(249, 115, 22, 0.55)",
          boxShadow: isConnected
            ? "0 0 10px rgba(34, 197, 94, 0.2)"
            : "0 0 10px rgba(249, 115, 22, 0.22)",
        }}
      >
        <span style={{
          fontSize: 15, lineHeight: 1,
          filter: `drop-shadow(0 0 4px ${isConnected ? "rgba(34,197,94,0.5)" : "rgba(249,115,22,0.55)"})`,
        }}>{props.icon}</span>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
          color: isConnected ? "#22C55E" : "#F97316",
        }}>{props.label}</span>
        <span
          style={{
            width: 7, height: 7, borderRadius: 4,
            background: dot, boxShadow: dotGlow,
            display: "inline-block", flexShrink: 0,
          }}
          aria-hidden="true"
        />
      </button>
      {open && (
        <>
          {/* Full-viewport invisible backdrop · click anywhere outside closes */}
          <div
            onClick={close}
            style={{ position: "fixed", inset: 0, zIndex: 99, background: "transparent" }}
            aria-hidden="true"
          />
          <div
            className="naw-header-popover"
            role="dialog"
            aria-label={`${props.label} setup`}
            style={{ zIndex: 100 }}
          >
            {props.children(close)}
          </div>
        </>
      )}
    </div>
  );
}

// ─── HQ Back icon button ──────────────────────────────────────────────
export function HqBackButton() {
  return (
    <a
      href="/nex-head-quarters/workstation"
      title="Back to HQ Workstation"
      aria-label="Back to HQ"
      className="naw-header-icon-btn"
      style={{
        textDecoration: "none",
        background: "rgba(234, 179, 8, 0.12)",
        borderColor: "rgba(234, 179, 8, 0.5)",
        boxShadow: "0 0 10px rgba(234, 179, 8, 0.2)",
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1, filter: "drop-shadow(0 0 4px rgba(234, 179, 8, 0.6))" }}>⌂</span>
      <span style={{
        fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "#EAB308",
      }}>HQ</span>
      <span style={{ fontSize: 10, color: "#EAB308" }}>←</span>
    </a>
  );
}

// ─── GitHub / Repo icon button ────────────────────────────────────────

interface GhConnection {
  readonly repoUrl: string;
  readonly owner: string;
  readonly repo: string;
  readonly connectedAt: string;
  readonly reachable: boolean | null;
}

export interface GitHubConnectButtonProps {
  readonly gh: GhConnection | null;
  readonly onConnected: (conn: GhConnection) => void;
  readonly onDisconnected: () => void;
}

const GIT_PROVIDERS = [
  { id: "github",    label: "GitHub",    icon: "🐙", signupUrl: "https://github.com/signup",     newRepoUrl: "https://github.com/new" },
  { id: "gitlab",    label: "GitLab",    icon: "🦊", signupUrl: "https://gitlab.com/users/sign_up", newRepoUrl: "https://gitlab.com/projects/new" },
  { id: "bitbucket", label: "Bitbucket", icon: "🪣", signupUrl: "https://bitbucket.org/account/signup/", newRepoUrl: "https://bitbucket.org/repo/create" },
];

function openInNewTab(url: string): void {
  try { window.open(url, "_blank", "noopener,noreferrer"); }
  catch { /* popup blocked · silent · founder can navigate manually */ }
}

export function GitHubConnectButton({ gh, onConnected, onDisconnected }: GitHubConnectButtonProps) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const state: "connected" | "reachable-unknown" | "disconnected" =
    !gh ? "disconnected"
    : gh.reachable === true ? "connected"
    : "reachable-unknown";

  const title =
    !gh ? "Connect a Git repo · GitHub · GitLab · Bitbucket"
    : `${gh.owner}/${gh.repo} · ${gh.reachable === true ? "reachable" : gh.reachable === false ? "404 not found" : "unknown"}`;

  const connect = async (close: () => void) => {
    if (!input.trim() || busy) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/nex/agent/github", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repoUrl: input.trim(), connectedBy: "founder" }),
      });
      const j = await r.json();
      if (j.ok) { onConnected(j.connection); setInput(""); setMsg(null); close(); }
      else setMsg(j.detail ? `${j.error} · ${j.detail}` : j.error ?? "connect failed");
    } catch (e) { setMsg(e instanceof Error ? e.message : "connect failed"); }
    finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (!gh) return;
    if (!confirm(`Disconnect ${gh.owner}/${gh.repo}?`)) return;
    try { await fetch("/api/nex/agent/github", { method: "DELETE" }); onDisconnected(); }
    catch { /* ignore · Guardian will absorb */ }
  };

  return (
    <IconButtonWithPopover
      icon="🐙"
      label="Repo"
      connected={!!gh}
      stateDot={state}
      title={title}
      ariaLabel="Repository"
    >
      {(close) => (
        <div className="naw-popover-body">
          {gh ? (
            <>
              <div className="naw-popover-heading">Connected repo</div>
              <div className="naw-popover-panel-primary">
                <code style={{ color: "var(--naw-cyan, #22D3EE)", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                  {gh.owner}/{gh.repo}
                </code>
                <div style={{ fontSize: 10, color: "var(--naw-slate, #94A3B8)", marginTop: 4 }}>
                  {gh.reachable === true ? "✓ reachable" : gh.reachable === false ? "✗ 404 not found" : "reachability unknown"}
                </div>
              </div>
              <a
                href={gh.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="naw-btn-secondary"
                style={{ textAlign: "center", textDecoration: "none", display: "block", marginTop: 8 }}
              >Open on GitHub ↗</a>
              <button
                type="button"
                onClick={() => { void disconnect(); close(); }}
                className="naw-btn-secondary"
                style={{ width: "100%", color: "var(--naw-danger, #EF4444)", borderColor: "rgba(239, 68, 68, 0.4)", marginTop: 6 }}
              >Disconnect</button>
            </>
          ) : (
            <>
              <div className="naw-popover-heading">Paste an existing repo URL</div>
              <input
                autoFocus
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="https://github.com/owner/repo"
                spellCheck={false}
                className="naw-gh-repo-input"
                style={{ width: "100%", marginBottom: 6 }}
                onKeyDown={(e) => { if (e.key === "Enter") void connect(close); }}
              />
              <button
                type="button"
                className="naw-btn-primary"
                onClick={() => void connect(close)}
                disabled={busy || !input.trim()}
                style={{ width: "100%", opacity: (busy || !input.trim()) ? 0.5 : 1 }}
              >{busy ? "Checking…" : "Connect →"}</button>
              {msg && (
                <div style={{ marginTop: 6, fontSize: 10, color: "var(--naw-danger, #EF4444)", fontFamily: "'JetBrains Mono', monospace" }}>{msg}</div>
              )}

              <div className="naw-popover-heading" style={{ marginTop: 12 }}>Or create a new repo</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {GIT_PROVIDERS.map((p) => (
                  <div key={p.id} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontSize: 14, width: 22 }}>{p.icon}</span>
                    <span style={{ flex: 1, fontSize: 12, color: "var(--naw-soft-white, #F9FAFB)", fontWeight: 600 }}>{p.label}</span>
                    <button
                      type="button"
                      onClick={() => openInNewTab(p.newRepoUrl)}
                      className="naw-btn-secondary"
                      style={{ fontSize: 10, padding: "3px 6px" }}
                      title={`Create a new ${p.label} repo`}
                    >+ New</button>
                    <button
                      type="button"
                      onClick={() => openInNewTab(p.signupUrl)}
                      className="naw-btn-secondary"
                      style={{ fontSize: 10, padding: "3px 6px" }}
                      title={`Sign up for ${p.label}`}
                    >Sign up</button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 9, color: "var(--naw-slate, #94A3B8)", fontFamily: "'JetBrains Mono', monospace" }}>
                Once you have a repo URL · paste it above and press Connect
              </div>
            </>
          )}
        </div>
      )}
    </IconButtonWithPopover>
  );
}

// ─── Provider / Backend icon button ───────────────────────────────────

export interface ProviderConnectButtonProps {
  readonly onProviderPicked: (provider: DatabaseProvider) => void;
  readonly lastPickedId: string | null;
}

export function ProviderConnectButton({ onProviderPicked, lastPickedId }: ProviderConnectButtonProps) {
  const lastPicked = lastPickedId ? PROVIDER_CATALOG.find((p) => p.id === lastPickedId) : null;
  const groups = providersByCategory();

  return (
    <IconButtonWithPopover
      icon="🗄"
      label="Backend"
      connected={!!lastPicked}
      stateDot={lastPicked ? "connected" : "disconnected"}
      title={lastPicked ? `Last connected · ${lastPicked.brand} ${lastPicked.name}` : "Connect a backend · database · storage · realtime"}
      ariaLabel="Backend provider"
    >
      {(close) => (
        <div className="naw-popover-body" style={{ maxHeight: 460, overflowY: "auto" }}>
          <div className="naw-popover-heading">Pick a backend provider</div>
          <div style={{ fontSize: 10, color: "var(--naw-slate, #94A3B8)", marginBottom: 8 }}>
            Selecting one opens the provider signup in a new tab · NEX1 gets the file-scaffolding brief loaded.
          </div>
          {groups.map((g) => (
            <div key={g.category} style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em",
                color: "var(--naw-orange, #F97316)", fontWeight: 700, marginBottom: 4, padding: "0 2px",
              }}>{g.label}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                {g.providers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      openInNewTab(p.signupUrl);
                      try { onProviderPicked(p); }
                      catch { /* Guardian will absorb */ }
                      close();
                    }}
                    className="naw-provider-option"
                    title={p.tagline}
                  >
                    <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{p.icon}</span>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700,
                        color: "var(--naw-soft-white, #F9FAFB)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{p.brand}</div>
                      <div style={{
                        fontSize: 9, color: "var(--naw-slate, #94A3B8)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{p.name}</div>
                    </div>
                    {p.featured && <span style={{ color: "var(--naw-orange, #F97316)", fontSize: 11 }}>★</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </IconButtonWithPopover>
  );
}
