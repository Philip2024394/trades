// VaultVideoUploader — client-side flow that:
//   1. requests a signed upload URL from /api/os/vault/videos/upload-url
//   2. PUTs the file directly to Supabase Storage
//   3. registers metadata via /api/os/vault/videos/register
//
// Quota check + entitlement gate happens server-side on step 1 so we
// never start an upload we can't complete.

"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { SurfaceCard, Button } from "@/platform/ui";

type UploadState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "uploading"; progress: number }
  | { status: "registering" }
  | { status: "success"; videoId: string }
  | {
      status: "error";
      message: string;
      upgradeHref?: string;
      retryable: boolean;
    };

const CATEGORIES = [
  { value: "walkthrough", label: "Walkthrough" },
  { value: "work_in_progress", label: "Work in progress" },
  { value: "quote_supporting", label: "Quote supporting" },
  { value: "signoff_evidence", label: "Signoff evidence" },
  { value: "defect_report", label: "Defect report" },
  { value: "general", label: "General" }
];

export function VaultVideoUploader({
  projectId,
  videoEnabled
}: {
  projectId: string;
  videoEnabled: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setSelectedFile(f);
    if (!title) {
      setTitle(f.name.replace(/\.[^.]+$/, ""));
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      setState({
        status: "error",
        message: "Choose a video file first.",
        retryable: true
      });
      return;
    }
    if (!title.trim()) {
      setState({
        status: "error",
        message: "Give the video a title.",
        retryable: true
      });
      return;
    }

    // 1. Request signed upload URL
    setState({ status: "requesting" });
    let signedRes: {
      ok: boolean;
      uploadUrl?: string;
      uploadToken?: string;
      storagePath?: string;
      bucket?: string;
      error?: string;
      message?: string;
      upgradeHref?: string;
    };
    try {
      const res = await fetch("/api/os/vault/videos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          sizeBytes: selectedFile.size
        })
      });
      signedRes = await res.json();
      if (!res.ok || !signedRes.ok || !signedRes.uploadUrl) {
        setState({
          status: "error",
          message:
            signedRes.message ?? signedRes.error ?? "Could not prepare upload.",
          upgradeHref: signedRes.upgradeHref,
          retryable: false
        });
        return;
      }
    } catch {
      setState({
        status: "error",
        message: "Network error preparing upload.",
        retryable: true
      });
      return;
    }

    // 2. PUT the file to Supabase Storage
    setState({ status: "uploading", progress: 0 });
    try {
      const uploadOk = await new Promise<boolean>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signedRes.uploadUrl as string);
        xhr.setRequestHeader(
          "Content-Type",
          selectedFile.type || "application/octet-stream"
        );
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const pct = Math.round((evt.loaded / evt.total) * 100);
            setState({ status: "uploading", progress: pct });
          }
        };
        xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
        xhr.onerror = () => reject(new Error("network"));
        xhr.send(selectedFile);
      });
      if (!uploadOk) {
        setState({
          status: "error",
          message: "Upload failed — try again.",
          retryable: true
        });
        return;
      }
    } catch {
      setState({
        status: "error",
        message: "Upload failed — check your connection and try again.",
        retryable: true
      });
      return;
    }

    // 3. Register metadata
    setState({ status: "registering" });
    try {
      const res = await fetch("/api/os/vault/videos/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          storagePath: signedRes.storagePath,
          title,
          mimeType: selectedFile.type,
          sizeBytes: selectedFile.size,
          category
        })
      });
      const data = (await res.json()) as {
        ok: boolean;
        videoId?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.videoId) {
        setState({
          status: "error",
          message:
            data.message ?? data.error ?? "Upload done but registration failed.",
          retryable: true
        });
        return;
      }
      setState({ status: "success", videoId: data.videoId });
      setSelectedFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch {
      setState({
        status: "error",
        message: "Network error registering the upload.",
        retryable: true
      });
    }
  }

  if (!videoEnabled) {
    return (
      <SurfaceCard variant="primary" padding="md">
        <div className="text-[13px] text-neutral-700">
          <p className="font-semibold text-neutral-900">Add video storage</p>
          <p className="mt-1">
            Video storage is a Vault add-on. Upgrade to record walkthroughs and
            share progress videos with your trades.
          </p>
          <div className="mt-3">
            <Button href="/home/vault/upgrade" intent="primary" size="sm">
              See add-ons
            </Button>
          </div>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard variant="primary" padding="md">
      <div className="space-y-3">
        <div>
          <label
            htmlFor="video-file"
            className="block text-[13px] font-semibold text-neutral-900"
          >
            Video file
          </label>
          <input
            id="video-file"
            ref={fileInput}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo"
            onChange={handleFilePick}
            className="mt-1 block w-full text-[13px]"
          />
          {selectedFile ? (
            <p className="mt-1 text-[13px] text-neutral-500">
              {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB ·{" "}
              {selectedFile.type || "video"}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="video-title"
            className="block text-[13px] font-semibold text-neutral-900"
          >
            Title
          </label>
          <input
            id="video-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-[14px]"
            placeholder="Kitchen leak — walkthrough"
          />
        </div>

        <div>
          <label
            htmlFor="video-category"
            className="block text-[13px] font-semibold text-neutral-900"
          >
            Category
          </label>
          <select
            id="video-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-[14px]"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleUpload}
            disabled={
              !selectedFile ||
              state.status === "requesting" ||
              state.status === "uploading" ||
              state.status === "registering"
            }
            intent="primary"
            size="md"
            icon={
              state.status === "requesting" ||
              state.status === "registering" ||
              state.status === "uploading"
                ? Loader2
                : Upload
            }
          >
            {state.status === "requesting"
              ? "Preparing…"
              : state.status === "uploading"
                ? `Uploading… ${state.progress}%`
                : state.status === "registering"
                  ? "Finishing…"
                  : "Upload video"}
          </Button>
          {state.status === "success" ? (
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Uploaded — refresh to see it in the record
            </span>
          ) : null}
        </div>

        {state.status === "error" ? (
          <div className="rounded-lg bg-red-50 p-3 text-[13px] text-red-700">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="flex-1">
                <p>{state.message}</p>
                {state.upgradeHref ? (
                  <div className="mt-2">
                    <Button
                      href={state.upgradeHref}
                      intent="primary"
                      size="sm"
                    >
                      See plans
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
