// Client component — the "Download bundle" CTA on the project record page.
// Queues bundle generation via /api/os/vault/bundle/queue.
"use client";

import { useState } from "react";
import { Download, Loader2, CheckCircle2, Lock } from "lucide-react";
import { SurfaceCard, Button } from "@/platform/ui";

type QueueState =
  | { status: "idle" }
  | { status: "queuing" }
  | { status: "queued"; bundleId: string }
  | { status: "error"; message: string; upgradeHref?: string };

export function BundleDownloadPanel({
  projectId,
  bundleEnabled
}: {
  projectId: string;
  bundleEnabled: boolean;
}) {
  const [state, setState] = useState<QueueState>({ status: "idle" });

  async function handleQueue() {
    setState({ status: "queuing" });
    try {
      const res = await fetch("/api/os/vault/bundle/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          exportType: "homeowner_manual"
        })
      });
      const data = (await res.json()) as {
        ok: boolean;
        bundleId?: string;
        error?: string;
        upgradeHref?: string;
      };
      if (!res.ok || !data.ok) {
        setState({
          status: "error",
          message: data.error ?? "Could not queue bundle.",
          upgradeHref: data.upgradeHref
        });
        return;
      }
      setState({ status: "queued", bundleId: data.bundleId ?? "" });
    } catch {
      setState({
        status: "error",
        message: "Network error — please try again."
      });
    }
  }

  if (!bundleEnabled) {
    return (
      <SurfaceCard variant="primary" padding="md">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100"
            aria-hidden
          >
            <Lock className="h-5 w-5 text-neutral-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-neutral-900">
              Bundle download requires a Vault plan
            </div>
            <div className="mt-1 text-[13px] text-neutral-600">
              Upgrade to Property Vault and download every quote, receipt,
              warranty and photo in a single archive.
            </div>
            <div className="mt-3">
              <Button
                href="/home/vault/upgrade"
                intent="primary"
                size="sm"
              >
                See plans
              </Button>
            </div>
          </div>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard variant="primary" padding="md">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100"
          aria-hidden
        >
          <Download className="h-5 w-5 text-amber-800" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-neutral-900">
            Download the full project record
          </div>
          <div className="mt-1 text-[13px] text-neutral-600">
            One archive containing every quote, receipt, warranty, photo and
            document from this project.
          </div>
          <div className="mt-3">
            {state.status === "idle" ? (
              <Button
                onClick={handleQueue}
                intent="primary"
                size="sm"
                icon={Download}
              >
                Prepare download
              </Button>
            ) : null}
            {state.status === "queuing" ? (
              <Button
                intent="primary"
                size="sm"
                disabled
                icon={Loader2}
              >
                Preparing…
              </Button>
            ) : null}
            {state.status === "queued" ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-[13px] font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Preparing your archive — we'll notify you when it's ready
              </div>
            ) : null}
            {state.status === "error" ? (
              <div className="text-[13px]">
                <div className="text-red-700">{state.message}</div>
                {state.upgradeHref ? (
                  <div className="mt-2">
                    <Button
                      href={state.upgradeHref}
                      intent="primary"
                      size="sm"
                    >
                      Upgrade
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
