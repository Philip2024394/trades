"use client";

// src/app/nex-native/vault/home/_migration-runner-client.tsx
//
// Vault Phase A · Commit A.6 · migration runner UI.
//
// Mounts near the top of Vault home. Polls the migration queue when
// Vault is unlocked. Shows the honest banner per §N.1:
//   N files from earlier are not yet secured on this device.
//   They'll be secured automatically while Vault is unlocked.
//                                                 [Secure now]
//
// Does NOT block the Vault UI · migration runs sequentially in the
// background while the user does other things.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchMigrationQueue,
  type QueueFile,
  runMigrationQueue,
} from "@/lib/nex-native/vault/client/legacy-migration";
import { useVaultSession } from "@/lib/nex-native/vault/client/vault-session";
import { useT } from "@/lib/nex/i18n/I18nProvider";

type RunnerState =
  | { kind: "idle"; files: QueueFile[] }
  | { kind: "securing"; files: QueueFile[]; currentId: string | null }
  | { kind: "done"; migrated: number; failed: number };

export function MigrationRunner() {
  const t = useT();
  const vault = useVaultSession();
  const [state, setState] = useState<RunnerState>({
    kind: "idle",
    files: [],
  });
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  const refreshQueue = useCallback(async () => {
    if (!vault.unlocked) return;
    const files = await fetchMigrationQueue();
    setState((s) =>
      s.kind === "done" ? s : { kind: "idle", files },
    );
  }, [vault.unlocked]);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  const run = useCallback(async () => {
    if (inFlightRef.current) return;
    if (!vault.unlocked) return;
    const files = await fetchMigrationQueue();
    if (files.length === 0) {
      setState({ kind: "idle", files: [] });
      return;
    }
    inFlightRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ kind: "securing", files, currentId: files[0]!.id });
    try {
      const stats = await runMigrationQueue({
        signal: controller.signal,
        onFileStart: (id) => {
          setState((s) =>
            s.kind === "securing" ? { ...s, currentId: id } : s,
          );
        },
      });
      setState({
        kind: "done",
        migrated: stats.migrated + stats.alreadyEncrypted,
        failed: stats.failed,
      });
    } finally {
      inFlightRef.current = false;
      abortRef.current = null;
    }
  }, [vault.unlocked]);

  // Lock state transitions · abort any in-flight run.
  useEffect(() => {
    if (!vault.unlocked && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      inFlightRef.current = false;
      setState((s) =>
        s.kind === "securing" ? { kind: "idle", files: s.files } : s,
      );
    }
  }, [vault.unlocked]);

  if (!vault.unlocked) return null;

  if (state.kind === "done") {
    if (state.migrated === 0 && state.failed === 0) return null;
    return (
      <section
        data-nex-vault-migration-done
        style={bannerStyle("success")}
      >
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
            {state.failed === 0
              ? state.migrated === 1
                ? t("vault.migration.doneOne")
                : t("vault.migration.doneManyTemplate").replace(
                    "{count}",
                    String(state.migrated),
                  )
              : t("vault.migration.doneMixedTemplate")
                  .replace("{migrated}", String(state.migrated))
                  .replace("{failed}", String(state.failed))}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setState({ kind: "idle", files: [] })}
          style={bannerBtnStyle("ghost")}
        >
          {t("vault.migration.dismissBtn")}
        </button>
      </section>
    );
  }

  if (state.kind === "securing") {
    return (
      <section
        data-nex-vault-migration-securing
        style={bannerStyle("info")}
      >
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
            {t("vault.migration.runnerBanner")}
          </p>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 11.5,
              opacity: 0.8,
            }}
          >
            {t("vault.migration.runnerSubtitle")}
          </p>
        </div>
      </section>
    );
  }

  if (state.files.length === 0) return null;
  return (
    <section
      data-nex-vault-migration-banner
      data-nex-vault-migration-count={state.files.length}
      style={bannerStyle("warn")}
    >
      <div>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
          {state.files.length === 1
            ? t("vault.migration.pendingOne")
            : t("vault.migration.pendingManyTemplate").replace(
                "{count}",
                String(state.files.length),
              )}
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 11.5,
            opacity: 0.8,
          }}
        >
          {t("vault.migration.pendingAutoNote")}
        </p>
      </div>
      <button
        type="button"
        data-nex-vault-migration-run
        onClick={run}
        style={bannerBtnStyle("primary")}
      >
        {t("vault.migration.secureNowBtn")}
      </button>
    </section>
  );
}

// Master-pass 2026-10-07 · banner tones now use NEX visual tokens:
//   · warn    · brand orange (needs user attention · "Secure now")
//   · info    · cyan secure accent (background work · "Securing…")
//   · success · gentle green (migration done)
function bannerStyle(tone: "info" | "warn" | "success"): React.CSSProperties {
  const toneColor =
    tone === "warn"
      ? "rgba(255, 114, 0, 0.5)"
      : tone === "success"
        ? "rgba(100, 200, 120, 0.5)"
        : "rgba(0, 175, 255, 0.5)";
  const bg =
    tone === "warn"
      ? "rgba(255, 114, 0, 0.08)"
      : tone === "success"
        ? "rgba(100, 200, 120, 0.08)"
        : "rgba(0, 175, 255, 0.08)";
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 12,
    border: `1px solid ${toneColor}`,
    background: bg,
    color: "#F2F5F8",
    marginBottom: 12,
  };
}

function bannerBtnStyle(
  kind: "primary" | "ghost",
): React.CSSProperties {
  if (kind === "primary") {
    return {
      padding: "8px 14px",
      borderRadius: 999,
      background: "#FF7200",
      color: "#1A1300",
      fontSize: 12.5,
      fontWeight: 700,
      border: "none",
      cursor: "pointer",
      flexShrink: 0,
      fontFamily: "inherit",
    };
  }
  return {
    padding: "6px 10px",
    borderRadius: 999,
    background: "transparent",
    border: "1px solid rgba(125, 155, 192, 0.26)",
    color: "#F2F5F8",
    fontSize: 12,
    cursor: "pointer",
    flexShrink: 0,
    fontFamily: "inherit",
  };
}
