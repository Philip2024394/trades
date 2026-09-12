// src/lib/nex1-master-engineer/nex1-child-client.ts
//
// Phase 8 T3-A · NEX1-as-child sub-step · parent-side client.
// Spawns NEX1 (Trust Domain A) as a separate OS process and provides an async API for the parent orchestrator.
// Mirrors BrokerChildClient's shape · same isolation posture · uses the same local ESM loader.

import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import type { WorkOrder } from "@/lib/nex-controlled-hands/types";

interface PendingCall {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

export class Nex1ChildClient {
  private child: ChildProcess | null = null;
  private pending = new Map<string, PendingCall>();
  private buffer = "";
  private stderr_log: string[] = [];

  get pid(): number | null { return this.child?.pid ?? null; }
  get exit_code(): number | null { return this.child?.exitCode ?? null; }
  is_alive(): boolean { return this.child !== null && !this.child.killed && this.child.exitCode === null; }

  async spawn_nex1(args: { work_order: WorkOrder; workspace_root: string; repo_root: string }): Promise<{ nex1_pid: number; nex1_ppid: number; workspace_root: string; work_order_id: string }> {
    const child_script = resolve(process.cwd(), "src/lib/nex1-master-engineer/nex1-child-process.ts");
    const loader_url = "file:///" + resolve(process.cwd(), "src/lib/nex-authority-broker/broker-child-loader.mjs").replace(/\\/g, "/");

    // NEX1's environment is minimal · explicit allowlist · not full parent env
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
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
      detached: false,
    });

    if (!this.child.stdout || !this.child.stdin) {
      throw new Error("nex1 child spawn failed · no stdio pipes");
    }

    this.child.stderr?.on("data", (buf: Buffer) => {
      const s = buf.toString("utf8");
      this.stderr_log.push(s);
      process.stderr.write("[nex1-child stderr] " + s);
    });

    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.on_child_data(chunk));

    return new Promise((resolveOuter, rejectOuter) => {
      const spawn_id = "spawn-" + randomBytes(4).toString("hex");
      this.pending.set(spawn_id, {
        resolve: (v) => { resolveOuter(v as { nex1_pid: number; nex1_ppid: number; workspace_root: string; work_order_id: string }); },
        reject: rejectOuter,
      });
      this.child!.stdin!.write(JSON.stringify({ kind: "spawn", id: spawn_id, work_order: args.work_order, workspace_root: args.workspace_root, repo_root: args.repo_root }) + "\n");
      setTimeout(() => {
        if (this.pending.has(spawn_id)) { this.pending.delete(spawn_id); rejectOuter(new Error("nex1 child spawn timeout")); }
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
        process.stderr.write("[nex1-client parse error] " + line + "\n");
      }
    }
  }

  async attack(attack_method: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.child || !this.child.stdin) throw new Error("nex1 child not spawned");
    return new Promise((resolveOuter, rejectOuter) => {
      const id = "attack-" + randomBytes(6).toString("hex");
      this.pending.set(id, { resolve: resolveOuter, reject: rejectOuter });
      try {
        this.child!.stdin!.write(JSON.stringify({ kind: "attack", id, attack_method, args }) + "\n");
      } catch (e) {
        this.pending.delete(id);
        rejectOuter(new Error("write to nex1 stdin failed: " + (e as Error).message));
        return;
      }
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); rejectOuter(new Error("nex1 attack timeout · " + attack_method)); }
      }, 5000);
    });
  }

  async probe(probe_kind: "inherited_fds" | "process_info" | "attack_registry"): Promise<unknown> {
    if (!this.child || !this.child.stdin) throw new Error("nex1 child not spawned");
    return new Promise((resolveOuter, rejectOuter) => {
      const id = "probe-" + randomBytes(6).toString("hex");
      this.pending.set(id, { resolve: resolveOuter, reject: rejectOuter });
      try { this.child!.stdin!.write(JSON.stringify({ kind: "probe", id, probe_kind }) + "\n"); }
      catch (e) { this.pending.delete(id); rejectOuter(new Error("write to nex1 stdin failed: " + (e as Error).message)); return; }
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); rejectOuter(new Error("nex1 probe timeout · " + probe_kind)); }
      }, 5000);
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

  // Orchestrator-authorised termination (invoked when Broker reports HANDOVER_REQUESTED)
  // This is the OS-level enforcement moment for case 47.
  kill_hard(): { killed: boolean; exit_code: number | null; ts: string } {
    const ts = new Date().toISOString();
    if (!this.child) return { killed: false, exit_code: null, ts };
    try {
      const ok = this.child.kill("SIGKILL");
      return { killed: ok, exit_code: this.child.exitCode, ts };
    } catch {
      return { killed: false, exit_code: this.child.exitCode ?? null, ts };
    }
  }

  async wait_for_exit(timeout_ms: number): Promise<{ exited: boolean; exit_code: number | null; signal: NodeJS.Signals | null; ts: string }> {
    if (!this.child) return { exited: true, exit_code: null, signal: null, ts: new Date().toISOString() };
    return new Promise((resolveOuter) => {
      let settled = false;
      const settle = (exited: boolean) => {
        if (settled) return; settled = true;
        resolveOuter({ exited, exit_code: this.child?.exitCode ?? null, signal: (this.child?.signalCode as NodeJS.Signals | null) ?? null, ts: new Date().toISOString() });
      };
      if (this.child?.exitCode !== null && this.child?.exitCode !== undefined) return settle(true);
      this.child!.once("exit", () => settle(true));
      setTimeout(() => settle(false), timeout_ms);
    });
  }
}
