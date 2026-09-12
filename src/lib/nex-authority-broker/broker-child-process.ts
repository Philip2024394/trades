// src/lib/nex-authority-broker/broker-child-process.ts
//
// Phase 8 T3 · Authority Broker as a SEPARATE OS PROCESS.
// The parent harness spawns this file as a child · communicates via stdin/stdout JSON lines.
// The child's memory is inaccessible to the parent · Ed25519 keys stay in child memory.
//
// This is invoked when Node.js runs this file directly (require.main === module semantics).
// Otherwise it exports the parent-side client.

import { AuthorityBroker } from "./broker";
import type { WorkOrder } from "../nex-controlled-hands/types";

interface IPCMessage {
  readonly kind: "spawn" | "call" | "shutdown" | "probe";
  readonly id: string;
  readonly method?: string;
  readonly args?: unknown[];
  readonly work_order?: WorkOrder;
  readonly workspace_root?: string;
  readonly repo_root?: string;
  readonly probe_kind?: "inherited_fds" | "process_info";
}

interface IPCResponse {
  readonly kind: "spawned" | "result" | "error" | "shutdown_ack";
  readonly id: string;
  readonly value?: unknown;
  readonly error?: string;
}

// Only runs when this module is invoked as a child process
export function run_as_child(): void {
  let broker: AuthorityBroker | null = null;

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
        broker = new AuthorityBroker({ work_order: msg.work_order, workspace_root: msg.workspace_root, repo_root: msg.repo_root });
        send({ kind: "spawned", id: msg.id, value: { broker_ready: true, public_key_der_hex: broker.signing_key.public_der_hex } });
        return;
      }
      if (msg.kind === "call") {
        if (!broker) { send({ kind: "error", id: msg.id, error: "broker not spawned" }); return; }
        const method = msg.method as keyof AuthorityBroker;
        const target: any = (broker as any)[method];
        if (typeof target !== "function") { send({ kind: "error", id: msg.id, error: "unknown method " + method }); return; }
        const result = await target.apply(broker, msg.args ?? []);
        send({ kind: "result", id: msg.id, value: result });
        return;
      }
      if (msg.kind === "probe") {
        // T3-A probe: child reports its OWN observable OS-level state.
        // Used by the T3-A adversarial harness to test case 49 (inherited fds).
        if (msg.probe_kind === "inherited_fds") {
          // Probe fds 3..20 · report which are open.
          const fs_sync = await import("node:fs");
          const open_fds: number[] = [];
          const closed_fds: number[] = [];
          const errors: Record<number, string> = {};
          for (let fd = 3; fd <= 20; fd++) {
            try {
              fs_sync.fstatSync(fd);
              open_fds.push(fd);
            } catch (e) {
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
        send({ kind: "error", id: msg.id, error: "unknown probe_kind: " + msg.probe_kind });
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
// When Node runs this file as the entry (`node broker-child-process.ts`), process.argv[1] resolves to this file.
// When imported by another module, argv[1] resolves to that other file, so run_as_child() is skipped.
{
  const entry = String(process.argv[1] ?? "").replace(/\\/g, "/");
  const here = new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  if (entry && (entry === here || entry.endsWith("broker-child-process.ts") || entry.endsWith("broker-child-process.js") || entry.endsWith("broker-child-process.mjs") || entry.endsWith("broker-child-process.cjs"))) {
    run_as_child();
  }
}
