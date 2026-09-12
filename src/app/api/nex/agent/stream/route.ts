// src/app/api/nex/agent/stream/route.ts
//
// NEX Agent v1.1 · dual-mode stream endpoint.
//   · Accept: text/event-stream → Server-Sent Events (live feed)
//   · Accept: application/json (default) → single JSON snapshot (backward compat)
//
// SSE flow:
//   Client opens EventSource("/api/nex/agent/stream?task_id=X&sse=1")
//   Server polls Postgres every 800ms · emits each new step as an SSE event
//   Server closes after 5 min idle · client reconnects (native EventSource behaviour)

import { NextResponse } from "next/server";
import { Client } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}
async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  await c.connect();
  try { return await fn(c); } finally { try { await c.end(); } catch { /* ignore */ } }
}

interface TaskRowDb {
  task_id: string; submitted_at: Date; updated_at: Date; submitted_by: string; prompt: string;
  status: string; current_actor: string | null; plan: unknown; brief: string | null;
}
interface StepRowDb {
  step_id: string; task_id: string; created_at: Date; actor: string; step_kind: string; title: string; body: unknown;
}

function toTaskJson(t: TaskRowDb) {
  return {
    task_id: t.task_id, submitted_at: t.submitted_at.toISOString(), updated_at: t.updated_at.toISOString(),
    submitted_by: t.submitted_by, prompt: t.prompt, status: t.status, current_actor: t.current_actor,
    plan: t.plan, brief: t.brief,
  };
}
function toStepJson(s: StepRowDb) {
  return {
    step_id: s.step_id, task_id: s.task_id, created_at: s.created_at.toISOString(),
    actor: s.actor, step_kind: s.step_kind, title: s.title, body: s.body,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const taskId = url.searchParams.get("task_id");
  const sinceStepIso = url.searchParams.get("since_step_iso") ?? null;
  const wantsSse = url.searchParams.get("sse") === "1" || (req.headers.get("accept") ?? "").includes("text/event-stream");

  // ── SSE mode ────────────────────────────────────────────────
  if (wantsSse && taskId) {
    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (event: string, data: unknown) => {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };
        // Initial snapshot
        try {
          const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
          await c.connect();
          const t = (await c.query(`SELECT * FROM nex_agent.tasks WHERE task_id = $1`, [taskId])).rows[0] as TaskRowDb | undefined;
          if (!t) { send("error", { error: "task_not_found" }); controller.close(); await c.end(); return; }
          send("task", toTaskJson(t));
          const seed = await c.query(
            `SELECT step_id, task_id, created_at, actor, step_kind, title, body
             FROM nex_agent.task_steps WHERE task_id=$1 ${sinceStepIso ? "AND created_at > $2" : ""}
             ORDER BY created_at ASC`,
            sinceStepIso ? [taskId, sinceStepIso] : [taskId],
          );
          for (const row of seed.rows as StepRowDb[]) send("step", toStepJson(row));
          await c.end();
        } catch (err) {
          send("error", { error: (err as Error).message });
          controller.close();
          return;
        }

        // Poll loop · 800ms cadence · 5 min idle timeout
        let lastCursor = new Date().toISOString();
        let lastStatus = "";
        let idleTicks = 0;
        const MAX_IDLE_TICKS = 375; // 375 * 800ms = 5 min
        const timer = setInterval(async () => {
          try {
            const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 3000 });
            await c.connect();
            try {
              const t = (await c.query(`SELECT * FROM nex_agent.tasks WHERE task_id=$1`, [taskId])).rows[0] as TaskRowDb | undefined;
              if (t) {
                if (t.status !== lastStatus) { send("task", toTaskJson(t)); lastStatus = t.status; idleTicks = 0; }
              }
              const rows = await c.query(
                `SELECT step_id, task_id, created_at, actor, step_kind, title, body
                 FROM nex_agent.task_steps WHERE task_id=$1 AND created_at > $2
                 ORDER BY created_at ASC LIMIT 50`,
                [taskId, lastCursor],
              );
              if (rows.rows.length > 0) {
                for (const row of rows.rows as StepRowDb[]) {
                  send("step", toStepJson(row));
                  lastCursor = row.created_at.toISOString();
                }
                idleTicks = 0;
              } else {
                idleTicks++;
                if (idleTicks % 30 === 0) send("ping", { at: new Date().toISOString() });
                if (idleTicks >= MAX_IDLE_TICKS) {
                  send("close", { reason: "idle_timeout" });
                  clearInterval(timer);
                  controller.close();
                }
              }
            } finally { try { await c.end(); } catch { /* ignore */ } }
          } catch (err) {
            send("error", { error: (err as Error).message.slice(0, 120) });
          }
        }, 800);

        // Abort cleanup
        req.signal.addEventListener("abort", () => { clearInterval(timer); try { controller.close(); } catch { /* ignore */ } });
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-store, no-transform",
        "connection": "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  }

  // ── JSON snapshot mode (backward compat) ────────────────────
  return withClient(async (c) => {
    if (taskId) {
      const t = (await c.query(`SELECT * FROM nex_agent.tasks WHERE task_id=$1`, [taskId])).rows[0] as TaskRowDb | undefined;
      if (!t) return NextResponse.json({ ok: false, error: "task_not_found" }, { status: 404 });
      const rows = await c.query(
        `SELECT step_id, task_id, created_at, actor, step_kind, title, body
         FROM nex_agent.task_steps WHERE task_id=$1 ${sinceStepIso ? "AND created_at > $2" : ""}
         ORDER BY created_at ASC`,
        sinceStepIso ? [taskId, sinceStepIso] : [taskId],
      );
      return NextResponse.json({
        ok: true, task: toTaskJson(t),
        steps: (rows.rows as StepRowDb[]).map(toStepJson),
      }, { headers: { "cache-control": "no-store" } });
    } else {
      const rows = await c.query(
        `SELECT task_id, submitted_at, updated_at, submitted_by, prompt, status, current_actor
         FROM nex_agent.tasks ORDER BY submitted_at DESC LIMIT 50`,
      );
      const tasks = rows.rows.map((r: TaskRowDb) => ({
        task_id: r.task_id, submitted_at: r.submitted_at.toISOString(), updated_at: r.updated_at.toISOString(),
        submitted_by: r.submitted_by, prompt: r.prompt, status: r.status, current_actor: r.current_actor,
      }));
      return NextResponse.json({ ok: true, tasks }, { headers: { "cache-control": "no-store" } });
    }
  }).catch((err: Error) => NextResponse.json({ ok: false, error: err.message.slice(0, 200) }, { status: 500 }));
}
