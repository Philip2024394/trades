// AiVisualiserFlow — top-level orchestrator.
//
// Progression:
//   contact → upload → classify → design → render → done
//
// Persistence: state is mirrored into sessionStorage keyed by merchantId
// so a mid-flow refresh restores the customer to their last screen.
// Storage: {step, homeownerId, uploadGrant, sourcePhotoUrl, leafSlug, choices,
//           renderId, renderUrl, designSummary}.
// One key per merchant so a homeowner touching two merchants' tiles in
// the same tab doesn't cross-contaminate.

"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { SurfaceCard } from "@/platform/ui";
import { ContactCaptureForm } from "./flow/ContactCaptureForm";
import { PhotoUpload } from "./flow/PhotoUpload";
import { DesignTree, type DesignChoices, type LeafOptions } from "./flow/DesignTree";
import { RenderViewer } from "./flow/RenderViewer";

type Step = "contact" | "upload" | "classify" | "design" | "render" | "done";

type LeafDetail = {
  slug: string;
  display_name: string;
  render_style_options: LeafOptions["style"];
  render_material_options: LeafOptions["material"];
  render_colour_options: LeafOptions["colour"];
  render_hardware_options: LeafOptions["hardware"];
};

export type AiVisualiserFlowProps = {
  merchantId: string;
  merchantDisplayName?: string;
  /** Optional pre-selected leaf slug (e.g. from a "Kitchen" CTA on a
   *  kitchen-fitter's landing page). */
  primaryLeafSlug?: string;
  source?: "merchant-page" | "gold-path" | "marketplace";
  onClose?: () => void;
};

type PersistedFlowState = {
  step: Step;
  homeownerId: string | null;
  uploadGrant: string | null;
  sourcePhotoUrl: string | null;
  leafSlug: string | null;
  choices: DesignChoices;
  renderId: string | null;
  renderUrl: string | null;
  designSummary: string;
};

function storageKey(merchantId: string): string {
  return `xrt:av-flow:${merchantId}`;
}

function readPersistedState(merchantId: string): PersistedFlowState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(merchantId));
    if (!raw) return null;
    return JSON.parse(raw) as PersistedFlowState;
  } catch {
    return null;
  }
}

function writePersistedState(
  merchantId: string,
  state: PersistedFlowState
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(merchantId), JSON.stringify(state));
  } catch {
    /* quota — non-fatal */
  }
}

function clearPersistedState(merchantId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(merchantId));
  } catch {
    /* non-fatal */
  }
}

export function AiVisualiserFlow({
  merchantId,
  merchantDisplayName,
  primaryLeafSlug,
  source = "merchant-page",
  onClose
}: AiVisualiserFlowProps) {
  const restored = useRef<PersistedFlowState | null>(
    typeof window !== "undefined" ? readPersistedState(merchantId) : null
  );

  const [step, setStep] = useState<Step>(restored.current?.step ?? "contact");
  const [homeownerId, setHomeownerId] = useState<string | null>(
    restored.current?.homeownerId ?? null
  );
  const [uploadGrant, setUploadGrant] = useState<string | null>(
    restored.current?.uploadGrant ?? null
  );
  const [sourcePhotoUrl, setSourcePhotoUrl] = useState<string | null>(
    restored.current?.sourcePhotoUrl ?? null
  );
  const [leafSlug, setLeafSlug] = useState<string | null>(
    restored.current?.leafSlug ?? primaryLeafSlug ?? null
  );
  const [leaf, setLeaf] = useState<LeafDetail | null>(null);
  const [choices, setChoices] = useState<DesignChoices>(
    restored.current?.choices ?? { hardware: [] }
  );
  const [renderId, setRenderId] = useState<string | null>(
    restored.current?.renderId ?? null
  );
  const [renderUrl, setRenderUrl] = useState<string | null>(
    restored.current?.renderUrl ?? null
  );
  const [designSummary, setDesignSummary] = useState<string>(
    restored.current?.designSummary ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [routedLeafSlug, setRoutedLeafSlug] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Persist on every relevant change. Cheap (sessionStorage sync).
  useEffect(() => {
    writePersistedState(merchantId, {
      step,
      homeownerId,
      uploadGrant,
      sourcePhotoUrl,
      leafSlug,
      choices,
      renderId,
      renderUrl,
      designSummary
    });
  }, [
    merchantId,
    step,
    homeownerId,
    uploadGrant,
    sourcePhotoUrl,
    leafSlug,
    choices,
    renderId,
    renderUrl,
    designSummary
  ]);

  // Load leaf details when we know which one to design
  useEffect(() => {
    if (!leafSlug) return;
    (async () => {
      const res = await fetch(`/api/apps/ai-visualiser/leaf/${leafSlug}`);
      const data: { ok: boolean; leaf?: LeafDetail } = await res.json();
      if (data.ok && data.leaf) setLeaf(data.leaf);
    })();
  }, [leafSlug]);

  async function handleClassify(photoUrl: string) {
    setStep("classify");
    setError(null);
    setRoutedLeafSlug(null);
    try {
      const res = await fetch("/api/apps/ai-visualiser/classify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ merchantId, imageUrl: photoUrl })
      });
      const data: {
        ok: boolean;
        inScope?: boolean;
        leafSlug?: string;
        detectedLeafSlug?: string;
        reason?: string;
      } = await res.json();
      if (!data.ok) {
        setError("Could not analyse your photo. Try another one.");
        setStep("upload");
        return;
      }
      if (data.inScope && data.leafSlug) {
        setLeafSlug(data.leafSlug);
        setStep("design");
        return;
      }
      if (data.detectedLeafSlug) {
        setRoutedLeafSlug(data.detectedLeafSlug);
      }
      setStep("upload");
      setError(
        data.detectedLeafSlug
          ? `This looks like a ${data.detectedLeafSlug.replace(/_/g, " ")} — this merchant doesn't fit that. Upload a different photo, or ask us to find someone who does.`
          : "This photo doesn't match anything this merchant fits. Try a different photo."
      );
    } catch {
      setError("Network error. Please try again.");
      setStep("upload");
    }
  }

  async function handleGenerate() {
    if (!homeownerId || !sourcePhotoUrl || !leafSlug || !leaf) return;
    if (!choices.style || !choices.material || !choices.colour) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/apps/ai-visualiser/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          homeownerId,
          sourcePhotoUrl,
          leafSlug,
          choices
        })
      });
      const data: {
        ok: boolean;
        renderId?: string;
        renderUrl?: string;
        error?: string;
      } = await res.json();
      if (!data.ok || !data.renderId || !data.renderUrl) {
        setError(data.error || "Render failed. No credit consumed.");
        return;
      }
      const style = leaf.render_style_options.find((o) => o.key === choices.style);
      const material = leaf.render_material_options.find(
        (o) => o.key === choices.material
      );
      const colour = leaf.render_colour_options.find((o) => o.key === choices.colour);
      const hardware = choices.hardware
        .map((k) => leaf.render_hardware_options.find((o) => o.key === k))
        .filter((h): h is LeafOptions["hardware"][number] => Boolean(h));
      const summary = [
        style?.label,
        material?.label,
        colour?.label,
        hardware.map((h) => h.label).join(" + ") || null
      ]
        .filter(Boolean)
        .join(" · ");
      setDesignSummary(summary);
      setRenderId(data.renderId);
      setRenderUrl(data.renderUrl);
      setStep("render");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (step === "done") clearPersistedState(merchantId);
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 md:items-center md:p-4">
      <SurfaceCard
        variant="primary"
        padding="none"
        className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden md:h-auto md:max-h-[90vh]"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            AI Visualiser
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {step === "contact" ? (
            <ContactCaptureForm
              merchantId={merchantId}
              merchantDisplayName={merchantDisplayName}
              firstLeafSlug={primaryLeafSlug}
              source={source}
              onComplete={(id, grant) => {
                setHomeownerId(id);
                setUploadGrant(grant);
                setStep("upload");
              }}
              onCancel={handleClose}
            />
          ) : null}

          {step === "upload" && uploadGrant ? (
            <div className="flex flex-col gap-4">
              {error ? (
                <SurfaceCard variant="warning" padding="md">
                  <div className="text-[13px]">{error}</div>
                  {routedLeafSlug ? (
                    <button
                      type="button"
                      onClick={() => {
                        void fetch("/api/apps/ai-visualiser/route-lead", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            merchantId,
                            homeownerId,
                            detectedLeafSlug: routedLeafSlug,
                            sourcePhotoUrl
                          })
                        });
                        setStep("done");
                      }}
                      className="mt-2 inline-flex min-h-[36px] items-center rounded-lg bg-neutral-900 px-3 text-[13px] font-semibold text-white hover:bg-neutral-800"
                    >
                      Find me someone who does
                    </button>
                  ) : null}
                </SurfaceCard>
              ) : null}
              <PhotoUpload
                uploadGrant={uploadGrant}
                onUploaded={(url) => {
                  setSourcePhotoUrl(url);
                  void handleClassify(url);
                }}
              />
            </div>
          ) : null}

          {step === "classify" ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
                Checking your photo…
              </div>
              <div className="text-[15px] text-neutral-800">
                Making sure this merchant can help.
              </div>
            </div>
          ) : null}

          {step === "design" && leaf ? (
            <>
              {error ? (
                <p className="mb-3 text-[13px] text-red-600">{error}</p>
              ) : null}
              <DesignTree
                leafDisplayName={leaf.display_name}
                options={{
                  style: leaf.render_style_options,
                  material: leaf.render_material_options,
                  colour: leaf.render_colour_options,
                  hardware: leaf.render_hardware_options
                }}
                value={choices}
                onChange={setChoices}
                onSubmit={handleGenerate}
                submitting={submitting}
              />
            </>
          ) : null}

          {step === "render" && renderId && renderUrl && sourcePhotoUrl ? (
            <RenderViewer
              renderId={renderId}
              homeownerId={homeownerId ?? ""}
              sourcePhotoUrl={sourcePhotoUrl}
              renderUrl={renderUrl}
              designSummary={designSummary}
              merchantDisplayName={merchantDisplayName}
              onTryAnother={() => setStep("design")}
              onSendToMerchant={() => setStep("done")}
            />
          ) : null}

          {step === "done" ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="text-2xl font-semibold text-neutral-900">
                All set.
              </div>
              <div className="text-[14px] text-neutral-600">
                {merchantDisplayName || "Your merchant"} will be in touch on
                WhatsApp very soon.
              </div>
              {onClose ? (
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-neutral-900 px-4 text-[13px] font-semibold text-white hover:bg-neutral-800"
                >
                  Done
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </SurfaceCard>
    </div>
  );
}
