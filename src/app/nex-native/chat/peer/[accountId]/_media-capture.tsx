"use client";

// src/app/nex-native/chat/peer/[accountId]/_media-capture.tsx
//
// Hidden file inputs for the Camera / Video / Voice options in the
// composer's Add-media modal. Each input carries the right accept +
// capture attributes so mobile OSes open the native camera / video
// recorder / voice memo tool, and desktop falls back to a normal
// file picker.
//
// On file selection, the input submits a hidden <form> bound to
// uploadPeerAttachmentAction · the server action uploads to storage,
// then redirects back to the peer chat surface with the resulting
// URL + kind on the query string. The composer picks that up as a
// pending attachment.
//
// This component exposes an imperative handle so the media modal can
// call `open("camera" | "video" | "voice")` without needing to know
// about the file inputs directly.

import * as React from "react";

export type CaptureKind = "camera" | "video" | "voice";

export interface MediaCaptureHandle {
  open(kind: CaptureKind): void;
}

interface Props {
  /** Server Action bound with peerAccountId · takes a FormData with
   *  a single "attachment_file" field. */
  uploadAction: (formData: FormData) => Promise<never> | void | Promise<void>;
}

export const MediaCapture = React.forwardRef<MediaCaptureHandle, Props>(
  function MediaCapture({ uploadAction }, ref) {
    const cameraFormRef = React.useRef<HTMLFormElement | null>(null);
    const videoFormRef = React.useRef<HTMLFormElement | null>(null);
    const voiceFormRef = React.useRef<HTMLFormElement | null>(null);
    const cameraInputRef = React.useRef<HTMLInputElement | null>(null);
    const videoInputRef = React.useRef<HTMLInputElement | null>(null);
    const voiceInputRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(
      ref,
      () => ({
        open(kind: CaptureKind) {
          const inputRef =
            kind === "camera"
              ? cameraInputRef
              : kind === "video"
                ? videoInputRef
                : voiceInputRef;
          inputRef.current?.click();
        },
      }),
      [],
    );

    const onFileChosen = (
      formRef: React.RefObject<HTMLFormElement | null>,
    ) => () => {
      formRef.current?.requestSubmit();
    };

    return (
      <div aria-hidden style={{ position: "absolute", width: 0, height: 0 }}>
        {/* Camera · rear camera on iOS/Android · file picker on desktop */}
        <form
          ref={cameraFormRef}
          action={uploadAction}
          encType="multipart/form-data"
        >
          <input
            ref={cameraInputRef}
            name="attachment_file"
            type="file"
            accept="image/*"
            // The `capture` attribute is a hint · Chrome/Safari on
            // Android/iOS open the camera; desktop shows the picker.
            capture="environment"
            onChange={onFileChosen(cameraFormRef)}
            style={{ display: "none" }}
          />
        </form>
        {/* Video · rear camera video recorder on mobile */}
        <form
          ref={videoFormRef}
          action={uploadAction}
          encType="multipart/form-data"
        >
          <input
            ref={videoInputRef}
            name="attachment_file"
            type="file"
            accept="video/*"
            capture="environment"
            onChange={onFileChosen(videoFormRef)}
            style={{ display: "none" }}
          />
        </form>
        {/* Voice · mic capture on mobile · falls back to audio file
            picker on desktop (users can drop a pre-recorded clip in). */}
        <form
          ref={voiceFormRef}
          action={uploadAction}
          encType="multipart/form-data"
        >
          <input
            ref={voiceInputRef}
            name="attachment_file"
            type="file"
            accept="audio/*"
            capture
            onChange={onFileChosen(voiceFormRef)}
            style={{ display: "none" }}
          />
        </form>
      </div>
    );
  },
);
