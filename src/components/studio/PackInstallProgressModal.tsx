"use client";

// PackInstallProgressModal — install / manage a Pack.
//
// Uses the same visual language as InstallProgressModal but surfaces
// pack-specific outcomes (N apps installed, brand tokens seeded,
// home layout seeded, apps preserved-through-uninstall).

import { useEffect, useState } from "react";
import Link from "next/link";
import type { FrozenPackManifest } from "@/platform/packs/types";
import type {
  InstalledPackRow,
  PackInstallError,
  PackUninstallError
} from "@/platform/runtime";
import type { HomeLayoutSeedResult } from "@/platform/runtime/homeLayoutSeeder";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const GREEN = "#10B981";
const RED = "#DC2626";
const NEUTRAL = "#404040";

type State =
  | { kind: "idle" }
  | { kind: "installing" }
  | {
      kind: "installed";
      pack: InstalledPackRow;
      installedApps: string[];
      brandTokens: { inserted: number; skipped: number } | null;
      homeLayout: HomeLayoutSeedResult | null;
    }
  | { kind: "install-error"; error: PackInstallError }
  | { kind: "uninstalling" }
  | {
      kind: "uninstalled";
      uninstalledApps: string[];
      failedApps: { slug: string; reason: string }[];
    }
  | { kind: "uninstall-error"; error: PackUninstallError };

export function PackInstallProgressModal({
  manifest,
  onClose
}: {
  manifest: FrozenPackManifest;
  onClose: (mutated: boolean) => void;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [currentInstall, setCurrentInstall] =
    useState<InstalledPackRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/platform/packs/${manifest.slug}`);
        const json = (await res.json()) as
          | { ok: true; install: InstalledPackRow | null }
          | { ok: false; error: string };
        if (!cancelled && json.ok) {
          setCurrentInstall(json.install ?? null);
        }
      } catch {
        // ignore
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
      const res = await fetch("/api/platform/packs/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: manifest.slug })
      });
      const json = (await res.json()) as
        | {
            ok: true;
            pack: InstalledPackRow;
            installedApps: string[];
            brandTokens: { inserted: number; skipped: number } | null;
            homeLayout: HomeLayoutSeedResult | null;
          }
        | { ok: false; error: PackInstallError };
      if (!json.ok) {
        setState({ kind: "install-error", error: json.error });
        return;
      }
      setState({
        kind: "installed",
        pack: json.pack,
        installedApps: json.installedApps,
        brandTokens: json.brandTokens,
        homeLayout: json.homeLayout
      });
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
      const res = await fetch("/api/platform/packs/uninstall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: manifest.slug, purgeData: purge })
      });
      const json = (await res.json()) as
        | {
            ok: true;
            uninstalledApps: string[];
            failedApps: { slug: string; reason: string }[];
          }
        | { ok: false; error: PackUninstallError };
      if (!json.ok) {
        setState({ kind: "uninstall-error", error: json.error });
        return;
      }
      setState({
        kind: "uninstalled",
        uninstalledApps: json.uninstalledApps,
        failedApps: json.failedApps
      });
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
      onClick={() => onClose(mutated(state))}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-neutral-200 p-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            {activelyInstalled ? "Manage pack" : "Install pack"}
          </p>
          <h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">
            {manifest.name}
          </h2>
          <p className="mt-1 text-[11px] text-neutral-500">
            v{manifest.version} · {manifest.publisher.name}
          </p>
        </header>

        <div className="p-5">
          {state.kind === "idle" && !activelyInstalled && (
            <InstallIdle manifest={manifest} onInstall={install} />
          )}
          {state.kind === "idle" && activelyInstalled && (
            <ManageIdle
              install={currentInstall}
              onUninstall={() => uninstall(false)}
              onPurge={() => uninstall(true)}
            />
          )}
          {state.kind === "installing" && (
            <Busy label={`Installing ${manifest.apps.length} apps + seeding theme…`} />
          )}
          {state.kind === "uninstalling" && (
            <Busy label="Uninstalling apps…" />
          )}
          {state.kind === "installed" && (
            <InstalledSuccess
              installedApps={state.installedApps}
              brandTokens={state.brandTokens}
              homeLayout={state.homeLayout}
            />
          )}
          {state.kind === "uninstalled" && (
            <UninstalledSuccess
              uninstalledApps={state.uninstalledApps}
              failedApps={state.failedApps}
            />
          )}
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
  manifest: FrozenPackManifest;
  onInstall: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-neutral-700">
        {manifest.description}
      </p>
      <InfoRow
        label="Installs"
        value={manifest.apps.map((a) => a.slug).join(", ")}
      />
      {manifest.theme && (
        <InfoRow
          label="Brand tokens"
          value={`${manifest.theme.tokens.length} tokens (only added if you don't have them)`}
        />
      )}
      {manifest.homeLayout && (
        <InfoRow
          label="Home page"
          value={`${manifest.homeLayout.sections.length} starter sections (only if you haven't started editing)`}
        />
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
  install,
  onUninstall,
  onPurge
}: {
  install: InstalledPackRow | null;
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
      {install && install.installed_apps.length > 0 && (
        <InfoRow
          label="Apps in this pack"
          value={install.installed_apps.join(", ")}
        />
      )}
      <button
        type="button"
        onClick={onUninstall}
        className="w-full rounded-lg py-3 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
        style={{ background: NEUTRAL }}
      >
        Uninstall pack
      </button>
      <p className="text-[11px] text-neutral-500">
        Brand tokens and layout edits are preserved. Apps installed by
        this pack are soft-uninstalled — their content stays for a
        future reinstall.
      </p>
      {confirmPurge ? (
        <div
          className="rounded-lg border p-3"
          style={{ borderColor: RED, background: "rgba(220,38,38,0.06)" }}
        >
          <p className="text-[11px] font-bold" style={{ color: RED }}>
            Purge destroys every App&rsquo;s data along with the pack ledger.
            Brand tokens + layouts still stay yours.
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
  installedApps,
  brandTokens,
  homeLayout
}: {
  installedApps: string[];
  brandTokens: { inserted: number; skipped: number } | null;
  homeLayout: HomeLayoutSeedResult | null;
}) {
  return (
    <div className="space-y-3">
      <p
        className="rounded-lg px-3 py-2 text-[13px] font-bold"
        style={{ background: "rgba(16,185,129,0.10)", color: GREEN }}
      >
        Pack installed ✓
      </p>
      <p className="text-[12px] text-neutral-700">
        <span className="font-bold">{installedApps.length}</span>{" "}
        {installedApps.length === 1 ? "App" : "Apps"} installed
        {installedApps.length > 0 && (
          <>
            :{" "}
            <span className="font-mono text-[11px] text-neutral-500">
              {installedApps.join(", ")}
            </span>
          </>
        )}
        .
      </p>
      {brandTokens && (
        <p className="text-[12px] text-neutral-700">
          Brand tokens: {brandTokens.inserted} added, {brandTokens.skipped}{" "}
          preserved.
        </p>
      )}
      {homeLayout && homeLayout.kind === "seeded" && (
        <p className="text-[12px] text-neutral-700">
          Home page: {homeLayout.sections} starter sections seeded.
        </p>
      )}
      {homeLayout && homeLayout.kind === "skipped-existing" && (
        <p className="text-[12px] text-neutral-700">
          Home page: your existing layout was preserved.
        </p>
      )}
      <Link
        href="/studio/home"
        className="inline-flex h-10 w-full items-center justify-center rounded-lg text-[11px] font-extrabold uppercase tracking-widest text-neutral-900"
        style={{ background: YELLOW }}
      >
        Open Studio →
      </Link>
    </div>
  );
}

function UninstalledSuccess({
  uninstalledApps,
  failedApps
}: {
  uninstalledApps: string[];
  failedApps: { slug: string; reason: string }[];
}) {
  return (
    <div className="space-y-3">
      <p
        className="rounded-lg px-3 py-2 text-[13px] font-bold"
        style={{ background: "rgba(64,64,64,0.08)", color: BLACK }}
      >
        Pack uninstalled.
      </p>
      {uninstalledApps.length > 0 && (
        <p className="text-[12px] text-neutral-700">
          {uninstalledApps.length}{" "}
          {uninstalledApps.length === 1 ? "App" : "Apps"} soft-uninstalled.
          Reinstall the pack any time to bring them back.
        </p>
      )}
      {failedApps.length > 0 && (
        <p className="text-[12px]" style={{ color: RED }}>
          {failedApps.length} App{failedApps.length === 1 ? "" : "s"}{" "}
          couldn&rsquo;t be removed:{" "}
          {failedApps.map((a) => `${a.slug} (${a.reason})`).join(", ")}
        </p>
      )}
    </div>
  );
}

function Busy({ label }: { label: string }) {
  return <p className="text-[13px] font-bold text-neutral-600">{label}</p>;
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

function formatInstallError(err: PackInstallError): string {
  switch (err.code) {
    case "unknown-pack":
      return `Unknown pack "${err.slug}".`;
    case "already-installed":
      return `${err.slug} is already installed.`;
    case "no-default-brand":
      return `No default brand configured for this merchant.`;
    case "app-install-failed":
      return `App "${err.failedApp}" failed to install: ${err.reason}. Rolled back ${err.rolledBack.length} app${err.rolledBack.length === 1 ? "" : "s"}.`;
    case "db-error":
      return `Database error: ${err.reason}`;
  }
}

function formatUninstallError(err: PackUninstallError): string {
  switch (err.code) {
    case "not-installed":
      return `${err.slug} is not installed.`;
    case "db-error":
      return `Database error: ${err.reason}`;
  }
}

function mutated(state: State): boolean {
  return state.kind === "installed" || state.kind === "uninstalled";
}
