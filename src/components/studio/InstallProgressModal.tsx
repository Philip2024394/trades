"use client";

// InstallProgressModal — shows the install pipeline running.
//
// Also serves as the "Manage" modal for already-installed Apps, so the
// merchant can Uninstall (soft) or Purge without leaving the store card.
// Detects the current install state from the fresh API response so it
// works from any entry point.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { FrozenAppManifest } from "@/platform/manifest/types";
import type {
  InstallError,
  InstalledAppRow,
  UninstallError
} from "@/platform/runtime";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const GREEN = "#10B981";
const RED = "#DC2626";
const NEUTRAL = "#404040";

type StepState =
  | { kind: "idle" }
  | { kind: "installing" }
  | { kind: "installed"; row: InstalledAppRow; createdPages: string[] }
  | { kind: "install-error"; error: InstallError }
  | { kind: "uninstalling" }
  | { kind: "uninstalled" }
  | { kind: "uninstall-error"; error: UninstallError };

export function InstallProgressModal({
  manifest,
  onClose,
  onOptimistic
}: {
  manifest: FrozenAppManifest;
  onClose: (mutated: boolean) => void;
  /** Fires the instant the server confirms a mutation. Parents use
   *  this to flip UI state immediately, before the modal closes and
   *  before a fresh /apps/list fetch resolves. Optional — legacy call
   *  sites still work without it. */
  onOptimistic?: (kind: "installed" | "uninstalled") => void;
}) {
  const [state, setState] = useState<StepState>({ kind: "idle" });
  const [currentInstall, setCurrentInstall] = useState<InstalledAppRow | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/platform/apps/${manifest.slug}`);
        const json = (await res.json()) as
          | { ok: true; install: InstalledAppRow | null }
          | { ok: false; error: string };
        if (!cancelled && json.ok) {
          setCurrentInstall(json.install ?? null);
        }
      } catch {
        // ignore — the modal still works, just without "current state"
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [manifest.slug]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose(mutated(state));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  async function install() {
    setState({ kind: "installing" });
    try {
      // fetchWithRetry gives us exponential backoff on transient
      // 5xx / network errors + waits for reconnect if offline. Install
      // is a headline action — must not silently fail on a flake.
      const res = await fetchWithRetry("/api/platform/apps/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: manifest.slug })
      });
      const json = (await res.json()) as
        | {
            ok: true;
            installedApp: InstalledAppRow;
            createdPages: string[];
          }
        | { ok: false; error: InstallError };
      if (!json.ok) {
        setState({ kind: "install-error", error: json.error });
        return;
      }
      setState({
        kind: "installed",
        row: json.installedApp,
        createdPages: json.createdPages
      });
      onOptimistic?.("installed");
    } catch (err) {
      setState({
        kind: "install-error",
        error: {
          code: "db-error",
          slug: manifest.slug,
          reason: (err as Error).message ?? "network"
        }
      });
    }
  }

  async function uninstall(purge: boolean) {
    setState({ kind: "uninstalling" });
    try {
      const res = await fetchWithRetry("/api/platform/apps/uninstall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: manifest.slug, purgeData: purge })
      });
      const json = (await res.json()) as
        | { ok: true }
        | { ok: false; error: UninstallError };
      if (!json.ok) {
        setState({ kind: "uninstall-error", error: json.error });
        return;
      }
      setState({ kind: "uninstalled" });
      onOptimistic?.("uninstalled");
    } catch (err) {
      setState({
        kind: "uninstall-error",
        error: {
          code: "db-error",
          slug: manifest.slug,
          reason: (err as Error).message ?? "network"
        }
      });
    }
  }

  const activelyInstalled =
    currentInstall && !currentInstall.uninstalled_at;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Manage ${manifest.name}`}
      onClick={() => onClose(mutated(state))}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-neutral-200 p-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            {activelyInstalled ? "Manage" : "Install"}
          </p>
          <h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">
            {manifest.name}
          </h2>
          <p className="mt-1 text-[11px] text-neutral-500">
            v{manifest.version} · {manifest.publisher.name}
          </p>
        </header>

        <div className="p-5">
          {state.kind === "idle" && activelyInstalled && (
            <ManageIdle
              manifest={manifest}
              install={currentInstall}
              onUninstall={() => uninstall(false)}
              onPurge={() => uninstall(true)}
            />
          )}

          {state.kind === "idle" && !activelyInstalled && (
            <InstallIdle manifest={manifest} onInstall={install} />
          )}

          {state.kind === "installing" && <BusyLine label="Installing…" />}
          {state.kind === "uninstalling" && (
            <BusyLine label="Uninstalling…" />
          )}

          {state.kind === "installed" && (
            <InstalledSuccess row={state.row} createdPages={state.createdPages} />
          )}
          {state.kind === "uninstalled" && <UninstalledSuccess />}

          {state.kind === "install-error" && (
            <ErrorLine msg={formatInstallError(state.error)} />
          )}
          {state.kind === "uninstall-error" && (
            <ErrorLine msg={formatUninstallError(state.error)} />
          )}
        </div>

        <footer className="flex items-center justify-end border-t border-neutral-200 p-4">
          <button
            type="button"
            onClick={() => onClose(mutated(state))}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-100"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Panels ─────────────────────────────────────────

function InstallIdle({
  manifest,
  onInstall
}: {
  manifest: FrozenAppManifest;
  onInstall: () => void;
}) {
  const willCreatePages = manifest.compatibility.createsPages.length > 0;
  const deps = manifest.requirements.dependencies;
  const caps = manifest.requirements.capabilities;
  const perms = manifest.requirements.permissions;

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-neutral-700">
        {manifest.description}
      </p>

      {willCreatePages && (
        <InfoRow
          label="Creates pages"
          value={manifest.compatibility.createsPages
            .map((p) => p.title)
            .join(", ")}
        />
      )}

      {deps.length > 0 && (
        <InfoRow label="Requires" value={deps.join(", ")} />
      )}
      {caps.length > 0 && (
        <InfoRow label="Uses capabilities" value={caps.join(", ")} />
      )}
      {perms.length > 0 && (
        <InfoRow label="Permissions" value={perms.join(", ")} />
      )}

      <button
        type="button"
        onClick={onInstall}
        className="w-full rounded-lg py-3 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
        style={{ background: YELLOW }}
      >
        Install {manifest.name}
      </button>
    </div>
  );
}

function ManageIdle({
  manifest,
  install,
  onUninstall,
  onPurge
}: {
  manifest: FrozenAppManifest;
  install: InstalledAppRow | null;
  onUninstall: () => void;
  onPurge: () => void;
}) {
  const [confirmPurge, setConfirmPurge] = useState(false);
  return (
    <div className="space-y-4">
      {install && (
        <InfoRow
          label="Installed"
          value={`v${install.version} · ${new Date(install.installed_at).toLocaleDateString()}`}
        />
      )}
      {install && install.created_pages.length > 0 && (
        <InfoRow
          label="App pages"
          value={install.created_pages.join(", ")}
        />
      )}
      <div className="flex items-center gap-2">
        {manifest.studio.contentEditor?.route && (
          <Link
            href={manifest.studio.contentEditor.route}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-neutral-300 px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-800 transition hover:bg-neutral-50"
          >
            {manifest.studio.contentEditor.title}
          </Link>
        )}
        <button
          type="button"
          onClick={onUninstall}
          className="inline-flex h-10 flex-1 items-center justify-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
          style={{ background: NEUTRAL }}
        >
          Uninstall
        </button>
      </div>
      {confirmPurge ? (
        <div
          className="rounded-lg border p-3"
          style={{ borderColor: RED, background: "rgba(220,38,38,0.06)" }}
        >
          <p className="text-[11px] font-bold" style={{ color: RED }}>
            Purge destroys the ledger row, hides pages, and drops the
            App&rsquo;s config permanently. This can&rsquo;t be undone.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onPurge}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-white"
              style={{ background: RED }}
            >
              Confirm purge
            </button>
            <button
              type="button"
              onClick={() => setConfirmPurge(false)}
              className="inline-flex h-9 items-center rounded-lg border border-neutral-300 px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmPurge(true)}
          className="text-[11px] font-bold underline"
          style={{ color: RED }}
        >
          Purge data instead
        </button>
      )}
    </div>
  );
}

function InstalledSuccess({
  row,
  createdPages
}: {
  row: InstalledAppRow;
  createdPages: string[];
}) {
  return (
    <div className="space-y-3">
      <p
        className="rounded-lg px-3 py-2 text-[13px] font-bold"
        style={{ background: "rgba(16,185,129,0.10)", color: GREEN }}
      >
        Installed v{row.version} ✓
      </p>
      {createdPages.length > 0 && (
        <p className="text-[12px] text-neutral-600">
          Created {createdPages.length} page{createdPages.length === 1 ? "" : "s"}:{" "}
          <span className="font-mono text-[11px]">
            {createdPages.join(", ")}
          </span>
        </p>
      )}
      <Link
        href="/studio/pages"
        className="inline-flex h-10 w-full items-center justify-center rounded-lg text-[11px] font-extrabold uppercase tracking-widest text-neutral-900"
        style={{ background: YELLOW }}
      >
        Open pages →
      </Link>
    </div>
  );
}

function UninstalledSuccess() {
  return (
    <p
      className="rounded-lg px-3 py-2 text-[13px] font-bold"
      style={{ background: "rgba(64,64,64,0.08)", color: BLACK }}
    >
      Uninstalled. Your content is preserved — reinstall any time to bring it back.
    </p>
  );
}

function BusyLine({ label }: { label: string }) {
  return (
    <p className="text-[13px] font-bold text-neutral-600">{label}</p>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return (
    <p
      role="alert"
      className="rounded-lg px-3 py-2 text-[13px] font-bold"
      style={{ background: "rgba(220,38,38,0.08)", color: RED }}
    >
      {msg}
    </p>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      <p className="mt-0.5 text-[12px] text-neutral-800">{value}</p>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────

function formatInstallError(err: InstallError): string {
  switch (err.code) {
    case "unknown-app":
      return `Unknown App "${err.slug}".`;
    case "already-installed":
      return `${err.slug} is already installed.`;
    case "missing-dependency":
      return `Requires "${err.missing}" — install it first.`;
    case "conflicting-app":
      return `Conflicts with "${err.conflictsWith}" — uninstall it first.`;
    case "insufficient-plan":
      return `Requires ${err.required} plan.`;
    case "lifecycle-hook-failed":
      return `${err.hook} hook failed: ${err.reason}`;
    case "no-default-brand":
      return `No default brand configured for this merchant.`;
    case "db-error":
      return `Database error: ${err.reason}`;
  }
}

function formatUninstallError(err: UninstallError): string {
  switch (err.code) {
    case "not-installed":
      return `${err.slug} is not installed.`;
    case "required-by-other":
      return `Cannot uninstall — required by: ${err.requiredBy.join(", ")}. Uninstall those first.`;
    case "lifecycle-hook-failed":
      return `${err.hook} hook failed: ${err.reason}`;
    case "db-error":
      return `Database error: ${err.reason}`;
  }
}

function mutated(state: StepState): boolean {
  return (
    state.kind === "installed" ||
    state.kind === "uninstalled"
  );
}
