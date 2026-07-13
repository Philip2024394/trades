// BlockedFeatureToast — reads `?blocked=<path>` from the URL and shows
// a friendly dismissible banner explaining why a DIY viewer was
// redirected off a trade-only route.
//
// Renders inline on the /tc/trade-center landing. Silent (returns null)
// when no `blocked` param is present. Auto-clears the query param on
// dismiss so a refresh doesn't re-fire the toast.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { X, Lock } from "lucide-react";

// Human-friendly names for each trade-only prefix. Falls back to the
// path itself if no mapping exists.
const FEATURE_LABELS: Array<{ prefix: string; label: string }> = [
  { prefix: "/tc/hub",            label: "The Trade Hub"        },
  { prefix: "/tc/trade-counter",  label: "Trade Counter"        },
  { prefix: "/tc/merchant-admin", label: "Studio"               },
  { prefix: "/tc/identity",       label: "Trade Identity"       },
  { prefix: "/tc/apply",          label: "Trade application"    },
  { prefix: "/tc/confidence",     label: "Confidence score"     },
  { prefix: "/tc/deals",          label: "Trade Deals"          },
  { prefix: "/tc/job-board",      label: "Trade Job Board"      },
  { prefix: "/tc/jobs",           label: "Site Projects"        },
  { prefix: "/tc/post-job",       label: "Post a job"           },
  { prefix: "/tc/rates",          label: "Trade Rate Card"      },
  { prefix: "/tc/routes",         label: "Trade Routes"         },
  { prefix: "/trade-off/yard",    label: "The Yard"             }
];

function labelForPath(path: string): string {
  const match = FEATURE_LABELS.find((f) => path.startsWith(f.prefix));
  return match?.label ?? "That feature";
}

export function BlockedFeatureToast() {
  const params = useSearchParams();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const blocked = params?.get("blocked");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (blocked) setVisible(true);
  }, [blocked]);

  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => setVisible(false), 10_000);
    return () => window.clearTimeout(t);
  }, [visible]);

  function dismiss() {
    setVisible(false);
    // Clear the ?blocked= param so a hard refresh doesn't re-fire.
    const q = new URLSearchParams(params?.toString() ?? "");
    q.delete("blocked");
    const next = q.toString();
    router.replace(pathname + (next ? `?${next}` : ""), { scroll: false });
  }

  if (!blocked || !visible) return null;
  const feature = labelForPath(blocked);

  return (
    <div
      className="mx-4 mt-4 flex items-start gap-3 rounded-xl border p-3 shadow-sm md:mx-6"
      style={{
        backgroundColor: "#FEF3C7",
        borderColor: "rgba(180,83,9,0.35)"
      }}
      role="status"
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
      >
        <Lock size={14} strokeWidth={2.2}/>
      </div>
      <div className="min-w-0 flex-1 text-[12px] leading-snug text-neutral-800">
        <div className="font-black">
          {feature} is a trade-only feature.
        </div>
        <div className="mt-0.5 text-neutral-700">
          Only verified trades can access it. You can still browse products, request
          quotes, and place orders as a home / DIY buyer.
        </div>
        <Link
          href="/tc/help#trade-features"
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-900 hover:underline"
        >
          Learn more
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-black/5"
      >
        <X size={14}/>
      </button>
    </div>
  );
}
