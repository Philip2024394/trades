// src/lib/nex1-master-engineer/nex1-child-process.ts
//
// Phase 8 T3-A · NEX1-as-child sub-step.
// Trust Domain A · NEX1 Master Engineer running as a SEPARATE OS PROCESS from the parent orchestrator and from Domain B (Broker).
//
// Isolation model at T3-A:
//   · spawned via child_process.spawn with stdio:['pipe','pipe','pipe'] (no inherited handles beyond stdio)
//   · explicit environment allowlist (no full parent env)
//   · Node 24 native TS type stripping (zero third-party runtime deps)
//   · this process has NO access to Broker internals · no Ed25519 keys · no event log · no snapshot storage
//   · every Broker-mediated operation must travel IPC → parent orchestrator → Broker child IPC
//
// This file also carries the case 47 re-attack instrumentation: methods that let the parent orchestrator
// direct THIS process (not the parent process) to open raw fs handles, so we prove the OS-level enforcement
// works when the untrusted actor holding the pre-existing handle is a real separate restricted process.

import { promises as fs, openSync, writeSync, readSync, closeSync, fstatSync } from "node:fs";
import { resolve as pathResolve } from "node:path";
import { spawn as spawnProcess, type ChildProcess } from "node:child_process";
import type { WorkOrder } from "../nex-controlled-hands/types";

interface IPCMessage {
  readonly kind: "spawn" | "probe" | "attack" | "shutdown";
  readonly id: string;
  readonly attack_method?: "open_raw_write_handle" | "write_via_raw_handle" | "close_raw_handle" | "fstat_raw_handle" | "read_raw_handle"
                          | "spawn_descendant_node" | "spawn_descendant_cmd" | "spawn_descendant_detached" | "get_descendant_pids";
  readonly probe_kind?: "inherited_fds" | "process_info" | "attack_registry";
  readonly args?: Record<string, unknown>;
  readonly work_order?: WorkOrder;
  readonly workspace_root?: string;
  readonly repo_root?: string;
}

interface IPCResponse {
  readonly kind: "spawned" | "result" | "error" | "shutdown_ack";
  readonly id: string;
  readonly value?: unknown;
  readonly error?: string;
}

interface RegisteredRawHandle {
  readonly attack_id: string;
  readonly canonical_path: string;
  readonly fd: number;
  readonly opened_at: string;
  closed: boolean;
}

interface SpawnedDescendant { pid: number; kind: string; started_at: string; }

export function run_as_child(): void {
  let workspace_root: string | null = null;
  let repo_root: string | null = null;
  let work_order: WorkOrder | null = null;
  const raw_handles = new Map<string, RegisteredRawHandle>();
  const descendants: SpawnedDescendant[] = [];
  const descendant_handles: ChildProcess[] = [];

  const send = (msg: IPCResponse) => {
    process.stdout.write(JSON.stringify(msg) + "\n");
  };

  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim().length === 0) continue;
      try {
        const msg = JSON.parse(line) as IPCMessage;
        void handle_message(msg);
      } catch (e) {
        send({ kind: "error", id: "unknown", error: "invalid message: " + (e as Error).message });
      }
    }
  });

  const handle_message = async (msg: IPCMessage): Promise<void> => {
    try {
      if (msg.kind === "spawn") {
        if (!msg.work_order || !msg.workspace_root || !msg.repo_root) {
          send({ kind: "error", id: msg.id, error: "spawn requires work_order + workspace_root + repo_root" });
          return;
        }
        work_order = msg.work_order;
        workspace_root = msg.workspace_root;
        repo_root = msg.repo_root;
        send({ kind: "spawned", id: msg.id, value: { nex1_ready: true, nex1_pid: process.pid, nex1_ppid: process.ppid, workspace_root, work_order_id: msg.work_order.work_order_id } });
        return;
      }

      if (msg.kind === "probe") {
        if (msg.probe_kind === "inherited_fds") {
          const open_fds: number[] = [];
          const closed_fds: number[] = [];
          const errors: Record<number, string> = {};
          for (let fd = 3; fd <= 20; fd++) {
            try { fstatSync(fd); open_fds.push(fd); }
            catch (e) {
              const code = (e as NodeJS.ErrnoException).code ?? "UNKNOWN";
              if (code === "EBADF") closed_fds.push(fd);
              else errors[fd] = code;
            }
          }
          send({ kind: "result", id: msg.id, value: { open_fds, closed_fds_sample: closed_fds.slice(0, 5), errors } });
          return;
        }
        if (msg.probe_kind === "process_info") {
          send({ kind: "result", id: msg.id, value: { pid: process.pid, ppid: process.ppid, execPath: process.execPath, cwd: process.cwd(), argv: process.argv, env_keys: Object.keys(process.env).sort() } });
          return;
        }
        if (msg.probe_kind === "attack_registry") {
          const rows = Array.from(raw_handles.values()).map((r) => ({ attack_id: r.attack_id, path: r.canonical_path, fd: r.fd, closed: r.closed }));
          send({ kind: "result", id: msg.id, value: { count: rows.length, entries: rows } });
          return;
        }
        send({ kind: "error", id: msg.id, error: "unknown probe_kind: " + msg.probe_kind });
        return;
      }

      if (msg.kind === "attack") {
        if (!workspace_root) { send({ kind: "error", id: msg.id, error: "spawn required before attack" }); return; }
        const args = msg.args ?? {};

        if (msg.attack_method === "open_raw_write_handle") {
          // NEX1 opens a raw fd via direct OS syscall · bypassing Broker.
          // This is the "pre-existing writable handle" of case 47.
          const path = String(args.path ?? "");
          const attack_id = String(args.attack_id ?? ("A-" + Date.now()));
          const canonical_path = pathResolve(workspace_root, path);
          // Ensure the target file exists (attack precondition · not part of the attack itself)
          try { await fs.access(canonical_path); }
          catch { await fs.writeFile(canonical_path, "// initial content authored inside NEX1 child before attack\n"); }
          const fd = openSync(canonical_path, "r+");
          const entry: RegisteredRawHandle = { attack_id, canonical_path, fd, opened_at: new Date().toISOString(), closed: false };
          raw_handles.set(attack_id, entry);
          send({ kind: "result", id: msg.id, value: { attack_id, canonical_path, fd, nex1_pid: process.pid } });
          return;
        }

        if (msg.attack_method === "write_via_raw_handle") {
          // NEX1 attempts to write via the previously stored raw fd · bypasses Broker entirely.
          const attack_id = String(args.attack_id ?? "");
          const bytes_utf8 = String(args.bytes_utf8 ?? "");
          const offset = Number(args.offset ?? 0);
          const entry = raw_handles.get(attack_id);
          if (!entry || entry.closed) {
            send({ kind: "result", id: msg.id, value: { write_ok: false, reason: entry ? "handle already closed" : "attack_id not registered" } });
            return;
          }
          try {
            const buf = Buffer.from(bytes_utf8, "utf8");
            const written = writeSync(entry.fd, buf, 0, buf.length, offset);
            send({ kind: "result", id: msg.id, value: { write_ok: true, bytes_written: written, offset, nex1_pid: process.pid } });
          } catch (e) {
            const code = (e as NodeJS.ErrnoException).code ?? "UNKNOWN";
            send({ kind: "result", id: msg.id, value: { write_ok: false, error: (e as Error).message, code } });
          }
          return;
        }

        if (msg.attack_method === "close_raw_handle") {
          const attack_id = String(args.attack_id ?? "");
          const entry = raw_handles.get(attack_id);
          if (!entry) { send({ kind: "result", id: msg.id, value: { closed: false, reason: "not registered" } }); return; }
          try { closeSync(entry.fd); entry.closed = true; send({ kind: "result", id: msg.id, value: { closed: true } }); }
          catch (e) { send({ kind: "result", id: msg.id, value: { closed: false, error: (e as Error).message } }); }
          return;
        }

        if (msg.attack_method === "fstat_raw_handle") {
          const attack_id = String(args.attack_id ?? "");
          const entry = raw_handles.get(attack_id);
          if (!entry) { send({ kind: "result", id: msg.id, value: { fstat_ok: false, reason: "not registered" } }); return; }
          try { const st = fstatSync(entry.fd); send({ kind: "result", id: msg.id, value: { fstat_ok: true, size: st.size, ino: String(st.ino), mode: st.mode } }); }
          catch (e) {
            const code = (e as NodeJS.ErrnoException).code ?? "UNKNOWN";
            send({ kind: "result", id: msg.id, value: { fstat_ok: false, error: (e as Error).message, code } });
          }
          return;
        }

        // ─── Case T3-C · descendant process spawning attacks ─────────────
        if (msg.attack_method === "spawn_descendant_node") {
          // NEX1 spawns another node process using child_process (bypasses Broker entirely)
          // Descendant is a long-running node that just idles reading stdin
          const child = spawnProcess(process.execPath, ["-e", "process.stdin.resume(); setInterval(()=>{}, 100000);"], {
            stdio: ["pipe", "pipe", "pipe"],
            env: { PATH: process.env.PATH ?? "" },
            windowsHide: true,
            detached: false,
          });
          descendant_handles.push(child);
          descendants.push({ pid: child.pid ?? -1, kind: "node-idle", started_at: new Date().toISOString() });
          send({ kind: "result", id: msg.id, value: { descendant_pid: child.pid, kind: "node-idle", nex1_pid: process.pid } });
          return;
        }

        if (msg.attack_method === "spawn_descendant_cmd") {
          // NEX1 spawns cmd.exe · this is the primary case 50 attack surface
          const child = spawnProcess("cmd.exe", ["/c", "for /L %i in (1,1,10000000) do @echo idle > nul"], {
            stdio: ["pipe", "pipe", "pipe"],
            env: { PATH: process.env.PATH ?? "" },
            windowsHide: true,
            detached: false,
          });
          descendant_handles.push(child);
          descendants.push({ pid: child.pid ?? -1, kind: "cmd.exe", started_at: new Date().toISOString() });
          send({ kind: "result", id: msg.id, value: { descendant_pid: child.pid, kind: "cmd.exe", nex1_pid: process.pid } });
          return;
        }

        if (msg.attack_method === "spawn_descendant_detached") {
          // NEX1 spawns detached · attempts to survive parent's death
          const child = spawnProcess(process.execPath, ["-e", "process.stdin.resume(); setInterval(()=>{}, 100000);"], {
            stdio: "ignore",
            env: { PATH: process.env.PATH ?? "" },
            windowsHide: true,
            detached: true,
          });
          // Unref so the parent doesn't wait for it
          try { child.unref(); } catch {}
          descendants.push({ pid: child.pid ?? -1, kind: "node-detached", started_at: new Date().toISOString() });
          send({ kind: "result", id: msg.id, value: { descendant_pid: child.pid, kind: "node-detached", nex1_pid: process.pid, detached: true } });
          return;
        }

        if (msg.attack_method === "get_descendant_pids") {
          send({ kind: "result", id: msg.id, value: { count: descendants.length, descendants } });
          return;
        }

        if (msg.attack_method === "read_raw_handle") {
          const attack_id = String(args.attack_id ?? "");
          const entry = raw_handles.get(attack_id);
          if (!entry) { send({ kind: "result", id: msg.id, value: { read_ok: false, reason: "not registered" } }); return; }
          try {
            const buf = Buffer.alloc(4096);
            const bytesRead = readSync(entry.fd, buf, 0, buf.length, 0);
            send({ kind: "result", id: msg.id, value: { read_ok: true, bytes: buf.slice(0, bytesRead).toString("utf8") } });
          } catch (e) {
            const code = (e as NodeJS.ErrnoException).code ?? "UNKNOWN";
            send({ kind: "result", id: msg.id, value: { read_ok: false, error: (e as Error).message, code } });
          }
          return;
        }

        send({ kind: "error", id: msg.id, error: "unknown attack_method: " + msg.attack_method });
        return;
      }

      if (msg.kind === "shutdown") {
        send({ kind: "shutdown_ack", id: msg.id });
        setTimeout(() => process.exit(0), 50);
        return;
      }

      send({ kind: "error", id: msg.id, error: "unknown kind: " + (msg as any).kind });
    } catch (e) {
      send({ kind: "error", id: msg.id, error: (e as Error).message });
    }
  };

  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGINT", () => process.exit(0));
}

// Direct-invocation guard · works under both CJS and ESM under Node's TS type stripping.
{
  const entry = String(process.argv[1] ?? "").replace(/\\/g, "/");
  const here = new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  if (entry && (entry === here || entry.endsWith("nex1-child-process.ts") || entry.endsWith("nex1-child-process.js") || entry.endsWith("nex1-child-process.mjs") || entry.endsWith("nex1-child-process.cjs"))) {
    run_as_child();
  }
}
