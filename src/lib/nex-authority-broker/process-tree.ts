// src/lib/nex-authority-broker/process-tree.ts
//
// Phase 8 T3-C · Windows process-tree tracking + cascade kill for the orchestrator.
// Zero third-party runtime deps · uses only Windows built-in tools:
//   · PowerShell (Get-CimInstance Win32_Process) for descendant enumeration
//   · taskkill /T /F for tree termination
//
// HONEST DECLARATION (T3-C v0.1.0):
//   Full Windows Job Object properties (JOB_OBJECT_LIMIT_BREAKAWAY_OK=0 · silent breakaway prevention ·
//   JOB_OBJECT_LIMIT_ACTIVE_PROCESS = N · JOB_OBJECT_LIMIT_JOB_MEMORY etc.) require FFI (koffi/ffi-napi)
//   or a native C++ addon. Those are deferred. This module provides best-effort process-tree
//   tracking that works for cooperative descendants but a truly hostile process could:
//     · delay a kill by ignoring the initial signal (taskkill retries with /F which is SIGKILL-equivalent)
//     · spawn faster than the tree walk can enumerate (mitigated by kill-first-then-walk pattern)
//     · use CREATE_BREAKAWAY_FROM_JOB (mitigated only by Job Object binding · not by this module)

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/** Enumerate descendant pids of `root_pid` (recursive · Windows only via PowerShell) */
export async function enumerate_descendants(root_pid: number): Promise<{ pids: number[]; error?: string }> {
  try {
    // Fetch full process list (ProcessId, ParentProcessId) in one shot · build map · walk from root
    const cmd = `powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress"`;
    const { stdout } = await execAsync(cmd, { maxBuffer: 8 * 1024 * 1024 });
    const parsed = JSON.parse(stdout.trim());
    const rows: { ProcessId: number; ParentProcessId: number }[] = Array.isArray(parsed) ? parsed : [parsed];

    // Build parent→children index
    const children_of = new Map<number, number[]>();
    for (const r of rows) {
      if (typeof r.ParentProcessId !== "number" || typeof r.ProcessId !== "number") continue;
      const list = children_of.get(r.ParentProcessId) ?? [];
      list.push(r.ProcessId);
      children_of.set(r.ParentProcessId, list);
    }

    // BFS from root_pid
    const descendants: number[] = [];
    const queue: number[] = [root_pid];
    const seen = new Set<number>([root_pid]);
    while (queue.length > 0) {
      const cur = queue.shift() as number;
      const kids = children_of.get(cur) ?? [];
      for (const k of kids) {
        if (seen.has(k)) continue;
        seen.add(k);
        descendants.push(k);
        queue.push(k);
      }
    }
    return { pids: descendants };
  } catch (e) {
    return { pids: [], error: (e as Error).message };
  }
}

/** taskkill /T /F on a single pid · reports outcome */
export async function taskkill_tree(pid: number): Promise<{ pid: number; ok: boolean; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execAsync(`taskkill /T /F /PID ${pid}`, { maxBuffer: 1024 * 1024 });
    return { pid, ok: true, stdout, stderr };
  } catch (e: any) {
    return { pid, ok: false, stdout: e.stdout ?? "", stderr: e.stderr ?? String(e) };
  }
}

/** Check whether a specific pid is currently alive on Windows */
export async function is_pid_alive(pid: number): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id"`, { maxBuffer: 1024 * 1024 });
    return String(stdout).trim() === String(pid);
  } catch { return false; }
}
