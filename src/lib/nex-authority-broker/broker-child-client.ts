// src/lib/nex-authority-broker/broker-child-client.ts
//
// Phase 8 T3 · parent-side client that spawns the Broker as a separate OS process.
// Provides the same async API as the in-process Broker but every call crosses a real OS process boundary.
//
// Verified security properties (T3):
//   · Broker Ed25519 key exists ONLY in child process memory (parent never sees it)
//   · handle inheritance blocked at spawn: stdio pipes only, no inherited fds
//   · environment inherited only if explicitly passed
//   · kill() closes child process → outstanding writable handles inside child are OS-closed

import { spawn, type ChildProcess } from "node:child_process";
import { resolve, join } from "node:path";
import { randomBytes } from "node:crypto";
import type { WorkOrder } from "@/lib/nex-controlled-hands/types";

interface PendingCall {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

export class BrokerChildClient {
  private child: ChildProcess | null = null;
  private pending = new Map<string, PendingCall>();
  private buffer = "";
  private public_key_der_hex: string | null = null;

  async spawn_broker(args: { work_order: WorkOrder; workspace_root: string; repo_root: string }): Promise<{ public_key_der_hex: string }> {
    // T3-A: spawn broker-child-process.ts DIRECTLY as its own OS process.
    // Node 24's built-in TypeScript type-stripping + a tiny local ESM resolver hook
    // (broker-child-loader.mjs) handles path aliases and extension-less relative imports.
    // Zero runtime deps beyond Node itself. No tsx, no ts-node, no bundler.
    const child_script = resolve(process.cwd(), "src/lib/nex-authority-broker/broker-child-process.ts");
    const loader_url = "file:///" + resolve(process.cwd(), "src/lib/nex-authority-broker/broker-child-loader.mjs").replace(/\\/g, "/");

    // Environment allowlist · child sees only what we explicitly grant.
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      PATH: process.env.PATH,          // needed for node's own resolution on Windows
      SystemRoot: process.env.SystemRoot,  // Windows requires this for basic OS calls
    };

    this.child = spawn(process.execPath, [
      "--experimental-loader", loader_url,
      "--experimental-transform-types",
      "--no-warnings",
      child_script,
    ], {
      stdio: ["pipe", "pipe", "pipe"],   // T3 · no inherited handles beyond these three
      env,
      windowsHide: true,
      // detached: false is the default · descendant processes stay under this parent
    });

    if (!this.child.stdout || !this.child.stdin) {
      throw new Error("broker child spawn failed · no stdio pipes");
    }

    this.child.stderr?.on("data", (buf: Buffer) => {
      // Emit stderr to parent debug channel · do not throw
      process.stderr.write("[broker-child stderr] " + buf.toString("utf8"));
    });

    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.on_child_data(chunk));

    return new Promise<{ public_key_der_hex: string }>((resolveOuter, rejectOuter) => {
      const spawn_id = "spawn-" + randomBytes(4).toString("hex");
      this.pending.set(spawn_id, {
        resolve: (v) => { const value = v as { broker_ready: boolean; public_key_der_hex: string }; this.public_key_der_hex = value.public_key_der_hex; resolveOuter({ public_key_der_hex: value.public_key_der_hex }); },
        reject: rejectOuter,
      });
      this.child!.stdin!.write(JSON.stringify({ kind: "spawn", id: spawn_id, work_order: args.work_order, workspace_root: args.workspace_root, repo_root: args.repo_root }) + "\n");
      // Timeout defensive
      setTimeout(() => {
        if (this.pending.has(spawn_id)) {
          this.pending.delete(spawn_id);
          rejectOuter(new Error("broker child spawn timeout · possibly ts-runtime unavailable"));
        }
      }, 15000);
    });
  }

  private on_child_data(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim().length === 0) continue;
      try {
        const msg = JSON.parse(line);
        const pending = this.pending.get(msg.id);
        if (!pending) continue;
        this.pending.delete(msg.id);
        if (msg.kind === "error") pending.reject(new Error(msg.error));
        else pending.resolve(msg.value);
      } catch (e) {
        process.stderr.write("[broker-client parse error] " + line + "\n");
      }
    }
  }

  async probe(probe_kind: "inherited_fds" | "process_info"): Promise<unknown> {
    if (!this.child || !this.child.stdin) throw new Error("broker child not spawned");
    return new Promise((resolveOuter, rejectOuter) => {
      const id = "probe-" + randomBytes(6).toString("hex");
      this.pending.set(id, { resolve: resolveOuter, reject: rejectOuter });
      this.child!.stdin!.write(JSON.stringify({ kind: "probe", id, probe_kind }) + "\n");
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); rejectOuter(new Error("probe timeout · " + probe_kind)); }
      }, 5000);
    });
  }

  async call(method: string, args: unknown[]): Promise<unknown> {
    if (!this.child || !this.child.stdin) throw new Error("broker child not spawned");
    return new Promise((resolveOuter, rejectOuter) => {
      const id = "call-" + randomBytes(6).toString("hex");
      this.pending.set(id, { resolve: resolveOuter, reject: rejectOuter });
      this.child!.stdin!.write(JSON.stringify({ kind: "call", id, method, args }) + "\n");
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); rejectOuter(new Error("broker call timeout · " + method)); }
      }, 10000);
    });
  }

  async shutdown(): Promise<void> {
    if (!this.child) return;
    return new Promise((resolveOuter) => {
      const id = "shutdown-" + randomBytes(4).toString("hex");
      this.pending.set(id, { resolve: () => resolveOuter(), reject: () => resolveOuter() });
      try { this.child!.stdin!.write(JSON.stringify({ kind: "shutdown", id }) + "\n"); } catch {}
      setTimeout(() => { try { this.child?.kill("SIGKILL"); } catch {}; resolveOuter(); }, 1000);
    });
  }

  is_alive(): boolean {
    return this.child !== null && !this.child.killed && this.child.exitCode === null;
  }

  kill_hard(): void {
    if (this.child) try { this.child.kill("SIGKILL"); } catch {}
  }
}
