"use client";

// StudioLiveMirror — editor-side iframe embed.
//
// Owns the master draft layout, drives the preview iframe via the
// postMessage bus (Module 0.6), and reacts to select / hover / move /
// remove / text-edit / telemetry events coming back from the iframe.
// Device toggle changes iframe width without a reload — layout stays
// mounted, only the frame resizes.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StudioLayoutJson } from "@/lib/studio/schema";
import type { TreeSnapshot } from "@/lib/studio/treeTypes";
import { encodeDraftParam } from "@/lib/studio/draftEncoding";
import { editorEmit, useBusFromIframe } from "@/lib/studio/bus";
import { sendTelemetry, trackEvent } from "@/lib/studio/telemetry";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";
import { StudioTreeNavigator } from "./StudioTreeNavigator";
import { StudioSectionOutline } from "./StudioSectionOutline";
import { StudioReplaceModal } from "./StudioReplaceModal";
import { SmartSwapModal } from "./SmartSwapModal";
import { StudioTypographyModal } from "./StudioTypographyModal";
import { StudioImagePickerModal } from "./StudioImagePickerModal";
import { StudioLinkModal } from "./StudioLinkModal";
import { StudioColourModal } from "./StudioColourModal";
import { StudioSaveComponentModal } from "./StudioSaveComponentModal";
import { StudioVisibilityModal } from "./StudioVisibilityModal";
import { StudioCommandPalette } from "./StudioCommandPalette";
import { StudioAiModal, type AiPromptableField } from "./StudioAiModal";
import { StudioPromptBar } from "./StudioPromptBar";
import { StudioScoreModal } from "./StudioScoreModal";
import { StudioAnalyticsModal } from "./StudioAnalyticsModal";
import { StudioExperimentModal } from "./StudioExperimentModal";
import { StudioFindReplaceModal } from "./StudioFindReplaceModal";
import { StudioVersionHistoryModal } from "./StudioVersionHistoryModal";
import { matchShortcut, type Command } from "@/lib/studio/commandTypes";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import "@/lib/studio/sections"; // populate registry client-side

type Device = "mobile" | "tablet" | "desktop";

const DEVICE_WIDTH: Record<Device, number> = {
  mobile: 420,
  tablet: 820,
  desktop: 1280
};

type Props = {
  merchantSlug: string;
  brandSlug: string;
  pageId: string;
  token: string;
  initialLayout: StudioLayoutJson;
  pages?: StudioPage[];
};

// Duplicated shape (pagesLoader is server-only); the mirror is a client
// component so we can't import that type directly.
export type StudioPage = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_home: boolean;
};

/** Modal state — nothing open (null) or the treeId + instanceId +
 *  current registration key of the section being replaced. */
type ReplaceModalState =
  | null
  | {
      treeId: string;
      instanceId: string;
      currentSectionId: string;
    };

/** Smart Swap modal — content-preserving section swap (Universal Smart
 *  Section Engine). Different from ReplaceModalState because we need
 *  the FULL source config to run the swap engine, and we route the
 *  commit through commitSmartSwap (which carries content across, not
 *  just the key). */
type SmartSwapModalState =
  | null
  | {
      instanceId: string;
      sourceSectionId: string;
      sourceConfig: Record<string, unknown>;
    };

type TypographyModalState =
  | null
  | {
      instanceId: string;
      currentOverrides: Record<string, unknown>;
    };

type ImagePickerState =
  | null
  | {
      instanceId: string;
      elementKey: string;
      currentUrl: string;
    };

type LinkModalState =
  | null
  | {
      instanceId: string;
      labelKey: string;
      hrefKey: string;
      currentValue: string;
    };

type ColourModalState =
  | null
  | {
      instanceId: string;
      tokenKey: string;
      currentValue: string;
    };

type SaveComponentState =
  | null
  | {
      instanceId: string;
      kind: string;
      sourceRegistrationId: string;
      config: Record<string, unknown>;
      tokenOverrides: Record<string, unknown>;
      suggestedName: string;
    };

type VisibilityModalState =
  | null
  | {
      instanceId: string;
      initialHidden: boolean;
      initialHiddenOn: ("mobile" | "tablet" | "desktop")[];
    };

type AiModalState =
  | null
  | {
      instanceId: string;
      sectionId: string;
      sectionName: string;
      promptTemplate: string;
      currentConfig: Record<string, unknown>;
      aiPromptable: AiPromptableField[];
    };

// History cap: keeps memory bounded even in marathon editing sessions.
// 50 undo entries covers the "oh no, undo everything I did in the last
// 5 minutes" reflex without ballooning past a few hundred KB.
const HISTORY_CAP = 50;
const AUTOSAVE_DEBOUNCE_MS = 500;

type History = {
  past: StudioLayoutJson[];
  present: StudioLayoutJson;
  future: StudioLayoutJson[];
};

type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

type PublishState =
  | { kind: "idle" }
  | { kind: "publishing" }
  | { kind: "published"; at: number }
  | { kind: "error"; message: string };

export function StudioLiveMirror({
  merchantSlug,
  brandSlug,
  pageId,
  token,
  initialLayout,
  pages = []
}: Props) {
  const [device, setDevice] = useState<Device>("mobile");
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: initialLayout,
    future: []
  }));
  const layout = history.present;
  const [selected, setSelected] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<TreeSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [publishState, setPublishState] = useState<PublishState>({
    kind: "idle"
  });
  const [replaceModal, setReplaceModal] = useState<ReplaceModalState>(null);
  const [smartSwapModal, setSmartSwapModal] = useState<SmartSwapModalState>(null);
  const [typographyModal, setTypographyModal] =
    useState<TypographyModalState>(null);
  const [imagePicker, setImagePicker] = useState<ImagePickerState>(null);
  const [linkModal, setLinkModal] = useState<LinkModalState>(null);
  const [colourModal, setColourModal] = useState<ColourModalState>(null);
  const [saveComponent, setSaveComponent] = useState<SaveComponentState>(null);
  const [visibilityModal, setVisibilityModal] =
    useState<VisibilityModalState>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aiModal, setAiModal] = useState<AiModalState>(null);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [experimentInstance, setExperimentInstance] = useState<string | null>(null);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const router = useRouter();
  // Baseline for "have we mutated since mount?" — first render must
  // NOT fire autosave (initial layout came from the server already).
  const initialLayoutRef = useRef(initialLayout);

  // Base iframe src — draft passed on initial load so first paint has
  // the merchant's current draft. Subsequent updates go via postMessage
  // (no reload).
  const initialSrc = (() => {
    const params = new URLSearchParams({
      token,
      edit: "1",
      _draft: encodeDraftParam(initialLayout)
    });
    return `/studio/preview/${encodeURIComponent(
      merchantSlug
    )}/${encodeURIComponent(brandSlug)}/${encodeURIComponent(pageId)}?${params.toString()}`;
  })();

  // ─── Iframe → editor bus ────────────────────────────────────
  useBusFromIframe(iframeRef, (msg) => {
    switch (msg.type) {
      case "ready":
        setReady(true);
        break;
      case "select":
        setSelected(msg.payload.treeId);
        break;
      case "hover":
        // Live Component Intelligence panel picks this up in Module 5.
        break;
      case "move":
        applyMove(msg.payload.instanceId, msg.payload.direction);
        break;
      case "remove":
        applyRemove(msg.payload.instanceId);
        break;
      case "text-edit":
        applyTextEdit(
          msg.payload.instanceId,
          msg.payload.elementKey,
          msg.payload.value
        );
        break;
      case "telemetry":
        // Iframe-emitted events (e.g. `view`) — enrich with pageId and
        // ship. Non-canonical events get dropped at the API layer.
        void sendTelemetry([
          {
            event: msg.payload.event as never,
            pageId,
            metadata: msg.payload.metadata,
            tags: msg.payload.tags
          }
        ]);
        break;
      case "tree":
      case "tree-changed":
        setSnapshot(msg.payload.snapshot);
        break;
      case "request-toolbar":
        // Toolbar is rendered inside the iframe by PageChromeClient —
        // the editor doesn't need to do anything on request-toolbar
        // itself. Keeping the case so old handlers don't fall through
        // to `default` and to leave a hook for later modules that may
        // want to react (e.g. focus a companion panel).
        break;
      case "tool-action":
        // Module 5 wires `replace-layout` for sections. Other tools
        // still fall through to telemetry-only stubs until Modules 6-9.
        if (
          msg.payload.tool === "replace-layout" &&
          msg.payload.kind === "section"
        ) {
          const iid = instanceIdFromTreeId(msg.payload.treeId);
          const instance = iid
            ? layout.sections.find((s) => s.instanceId === iid)
            : null;
          if (iid && instance) {
            setReplaceModal({
              treeId: msg.payload.treeId,
              instanceId: iid,
              currentSectionId: instance.key
            });
            break;
          }
        }
        // Universal Smart Section Engine — content-preserving swap.
        // Opens SmartSwapModal, which diffs source vs candidates by
        // semantic role and commits via commitSmartSwap.
        if (
          msg.payload.tool === "smart-swap" &&
          msg.payload.kind === "section"
        ) {
          const iid = instanceIdFromTreeId(msg.payload.treeId);
          const instance = iid
            ? layout.sections.find((s) => s.instanceId === iid)
            : null;
          if (iid && instance) {
            setSmartSwapModal({
              instanceId: iid,
              sourceSectionId: instance.key,
              sourceConfig: instance.config
            });
            break;
          }
        }
        // Module 6: text-priority "Style" tool → typography modal.
        if (msg.payload.tool === "typography") {
          const iid = instanceIdFromTreeId(msg.payload.treeId);
          const instance = iid
            ? layout.sections.find((s) => s.instanceId === iid)
            : null;
          if (iid && instance) {
            setTypographyModal({
              instanceId: iid,
              currentOverrides: instance.tokenOverrides ?? {}
            });
            break;
          }
        }
        // Module 7: image-priority "Replace" tool → image picker
        // modal. Element treeId shape `sec:<instanceId>.<elementKey>`
        // — the elementKey identifies which config field carries the
        // URL. Same wiring for "crop" and "ai-generate" placeholder
        // opens (real crop UI + AI Gateway wiring land in Module 14).
        if (
          msg.payload.tool === "replace" &&
          msg.payload.priority === "image"
        ) {
          const iid = instanceIdFromTreeId(msg.payload.treeId);
          const elementKey = elementKeyFromTreeId(msg.payload.treeId);
          const instance = iid
            ? layout.sections.find((s) => s.instanceId === iid)
            : null;
          if (iid && elementKey && instance) {
            const currentUrl =
              (instance.config[elementKey] as string | undefined) ?? "";
            setImagePicker({ instanceId: iid, elementKey, currentUrl });
            break;
          }
        }
        // Module 8: button Link tool → sibling href field via convention.
        if (
          msg.payload.tool === "link" &&
          msg.payload.priority === "button"
        ) {
          const iid = instanceIdFromTreeId(msg.payload.treeId);
          const labelKey = elementKeyFromTreeId(msg.payload.treeId);
          const instance = iid
            ? layout.sections.find((s) => s.instanceId === iid)
            : null;
          if (iid && labelKey && instance) {
            const hrefKey = hrefKeyFromLabelKey(labelKey);
            const currentValue =
              (instance.config[hrefKey] as string | undefined) ?? "";
            setLinkModal({
              instanceId: iid,
              labelKey,
              hrefKey,
              currentValue
            });
            break;
          }
        }
        // Module 8: Colour tool → per-instance token override.
        // Button targets color.accent (primary CTA background); text
        // priority targets color.text. Both write to the same
        // tokenOverrides map — StudioPageClient merges before render.
        if (msg.payload.tool === "colour") {
          const iid = instanceIdFromTreeId(msg.payload.treeId);
          const instance = iid
            ? layout.sections.find((s) => s.instanceId === iid)
            : null;
          if (iid && instance) {
            const tokenKey =
              msg.payload.priority === "button"
                ? "color.accent"
                : "color.text";
            const overrides = instance.tokenOverrides ?? {};
            const currentValue = (overrides[tokenKey] as string) ?? "";
            setColourModal({ instanceId: iid, tokenKey, currentValue });
            break;
          }
        }
        // Module 9: section-scope container tools.
        if (msg.payload.kind === "section") {
          const iid = instanceIdFromTreeId(msg.payload.treeId);
          const instance = iid
            ? layout.sections.find((s) => s.instanceId === iid)
            : null;
          if (iid && instance) {
            // BG tool — surface colour override.
            if (msg.payload.tool === "background") {
              const overrides = instance.tokenOverrides ?? {};
              const currentValue =
                (overrides["color.surface"] as string) ?? "";
              setColourModal({
                instanceId: iid,
                tokenKey: "color.surface",
                currentValue
              });
              break;
            }
            // Duplicate — clone the instance immediately after the
            // current row, no modal.
            if (msg.payload.tool === "duplicate") {
              duplicateSection(iid);
              break;
            }
            // Hide — Module 12 turns this into a Visibility modal with
            // per-breakpoint toggles + a "hide everywhere" master.
            if (msg.payload.tool === "hide") {
              setVisibilityModal({
                instanceId: iid,
                initialHidden: Boolean(instance.hidden),
                initialHiddenOn: instance.hiddenOn ?? []
              });
              break;
            }
            // Module 14 AI Improve — build the client payload (registration
            // template + aiPromptable field list + current config) and open
            // the modal. Server route stays provider-neutral: the payload
            // is what the router forwards to whichever provider it picks.
            if (msg.payload.tool === "ai-improve") {
              const reg = sectionRegistry.get(instance.key);
              if (reg) {
                const aiPromptable: AiPromptableField[] = reg.editableFields
                  .filter((f) => f.aiPromptable)
                  .map((f) => {
                    const raw =
                      "maxLength" in f.type
                        ? (f.type as { maxLength?: number }).maxLength
                        : undefined;
                    return {
                      key: f.key,
                      label: f.label,
                      type: f.type.kind,
                      ...(typeof raw === "number" ? { maxLength: raw } : {})
                    };
                  });
                setAiModal({
                  instanceId: iid,
                  sectionId: reg.id,
                  sectionName: reg.name,
                  promptTemplate: reg.aiPrompts.improve,
                  currentConfig: instance.config,
                  aiPromptable
                });
                break;
              }
            }
            // Save as component — modal writes to
            // studio_saved_components via /api/studio/saved-components.
            if (msg.payload.tool === "save-component") {
              const reg = instance.key;
              const library = reg.split(".")[0] ?? "hero";
              setSaveComponent({
                instanceId: iid,
                kind: library,
                sourceRegistrationId: reg,
                config: instance.config,
                tokenOverrides: instance.tokenOverrides ?? {},
                suggestedName:
                  (instance.config["heading"] as string | undefined)?.slice(0, 40) ??
                  `${library} · ${new Date().toLocaleDateString("en-GB")}`
              });
              break;
            }
          }
        }
        void sendTelemetry([
          {
            event: "edit",
            pageId,
            layoutVariant: undefined,
            metadata: {
              tool: msg.payload.tool,
              treeId: msg.payload.treeId,
              kind: msg.payload.kind,
              priority: msg.payload.priority,
              _stub: "module-2"
            }
          }
        ]);
        break;
      case "undo":
        undo();
        break;
      case "redo":
        redo();
        break;
      default:
        break;
    }
  });

  // Fire a single `view` event when the editor mounts a page — feeds
  // Live Component Intelligence "which pages get edited most" queries.
  useEffect(() => {
    trackEvent({
      event: "view",
      pageId,
      tags: ["editor-mount"]
    });
  }, [pageId]);

  // ─── Editor → iframe: push layout + selection on change ─────
  useEffect(() => {
    if (!ready) return;
    editorEmit.applyLayout(iframeRef.current, layout);
  }, [layout, ready]);

  useEffect(() => {
    if (!ready) return;
    editorEmit.setSelected(iframeRef.current, selected);
  }, [selected, ready]);

  // Module 12: keep iframe informed of the merchant's simulated device
  // so preview-mode hiddenOn filtering works.
  useEffect(() => {
    if (!ready) return;
    editorEmit.setBreakpoint(iframeRef.current, device);
  }, [device, ready]);

  // First tree fetch after the iframe reports ready. Subsequent trees
  // arrive proactively via `tree-changed` messages when the iframe's
  // layout state mutates (StudioPageClient useEffect).
  useEffect(() => {
    if (!ready) return;
    editorEmit.requestTree(iframeRef.current);
  }, [ready]);

  // Navigator handler — clicking a tree row scrolls the iframe there
  // AND updates selection, so the chrome rim moves too.
  const handleNavigate = useCallback((treeId: string) => {
    editorEmit.scrollTo(iframeRef.current, treeId, "smooth");
    setSelected(treeId);
  }, []);

  // ─── History primitive ─────────────────────────────────────
  // Every mutation goes through mutate(). Past capped at HISTORY_CAP;
  // any mutation clears the redo stack (branching history).
  const mutate = useCallback(
    (next: (prev: StudioLayoutJson) => StudioLayoutJson) => {
      setHistory((h) => {
        const nextPresent = next(h.present);
        if (nextPresent === h.present) return h; // no-op
        return {
          past: [...h.past, h.present].slice(-HISTORY_CAP),
          present: nextPresent,
          future: []
        };
      });
    },
    []
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h;
      const previous = h.past[h.past.length - 1];
      return {
        past: h.past.slice(0, -1),
        present: previous,
        future: [h.present, ...h.future].slice(0, HISTORY_CAP)
      };
    });
    setSelected(null);
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h;
      return {
        past: [...h.past, h.present].slice(-HISTORY_CAP),
        present: h.future[0],
        future: h.future.slice(1)
      };
    });
    setSelected(null);
  }, []);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  // ─── Layout mutation helpers ────────────────────────────────
  const applyMove = useCallback(
    (instanceId: string, direction: "up" | "down" | "left" | "right") => {
      mutate((prev) => {
        const variant = prev.sections.find((s) => s.instanceId === instanceId)?.key;
        trackEvent({
          event: "move",
          pageId,
          layoutVariant: variant,
          metadata: { instanceId, direction }
        });
        return moveInstance(prev, instanceId, direction);
      });
    },
    [pageId, mutate]
  );

  // Drag-drop reorder — many-step move from one row id to another.
  const applyReorderRow = useCallback(
    (fromRowId: string, toRowId: string) => {
      if (fromRowId === toRowId) return;
      mutate((prev) => {
        trackEvent({
          event: "move",
          pageId,
          metadata: { fromRowId, toRowId, source: "drag" }
        });
        return reorderRow(prev, fromRowId, toRowId);
      });
    },
    [pageId, mutate]
  );

  const applyRemove = useCallback(
    (instanceId: string) => {
      mutate((prev) => {
        const variant = prev.sections.find((s) => s.instanceId === instanceId)?.key;
        trackEvent({
          event: "remove",
          pageId,
          layoutVariant: variant,
          metadata: { instanceId }
        });
        return removeInstance(prev, instanceId);
      });
      setSelected(null);
    },
    [pageId, mutate]
  );

  const duplicateSection = useCallback(
    (instanceId: string) => {
      mutate((prev) => {
        const orig = prev.sections.find((s) => s.instanceId === instanceId);
        if (!orig) return prev;
        const newInstanceId = `sec_${Math.random().toString(36).slice(2, 10)}`;
        const clone = {
          ...orig,
          instanceId: newInstanceId,
          // Deep-clone config + tokenOverrides so future edits don't
          // reach back into the source.
          config: JSON.parse(JSON.stringify(orig.config)),
          tokenOverrides: orig.tokenOverrides
            ? JSON.parse(JSON.stringify(orig.tokenOverrides))
            : undefined
        };
        // Find the row containing the source; append a NEW row after it
        // holding the clone. Keeps the visual expectation that
        // Duplicate stacks the copy right below.
        const rowIdx = prev.rows.findIndex((r) =>
          r.columns.includes(instanceId)
        );
        if (rowIdx === -1) return prev;
        const newRow = {
          id: `row_${Math.random().toString(36).slice(2, 8)}`,
          columns: [newInstanceId]
        };
        const nextRows = prev.rows.slice();
        nextRows.splice(rowIdx + 1, 0, newRow);
        trackEvent({
          event: "pick",
          pageId,
          layoutVariant: orig.key,
          sectionKey: orig.key,
          metadata: { source: "duplicate", from: instanceId }
        });
        return {
          sections: [...prev.sections, clone],
          rows: nextRows
        };
      });
    },
    [mutate, pageId]
  );

  const toggleHide = useCallback(
    (instanceId: string) => {
      mutate((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.instanceId === instanceId ? { ...s, hidden: !s.hidden } : s
        )
      }));
      trackEvent({
        event: "edit",
        pageId,
        metadata: { tool: "hide", instanceId }
      });
    },
    [mutate, pageId]
  );

  const saveVisibility = useCallback(
    (
      instanceId: string,
      state: {
        hidden: boolean;
        hiddenOn: ("mobile" | "tablet" | "desktop")[];
      }
    ) => {
      mutate((prev) => ({
        ...prev,
        sections: prev.sections.map((s) => {
          if (s.instanceId !== instanceId) return s;
          const next = { ...s };
          if (state.hidden) next.hidden = true;
          else delete next.hidden;
          if (state.hiddenOn.length > 0) next.hiddenOn = state.hiddenOn;
          else delete next.hiddenOn;
          return next;
        })
      }));
      trackEvent({
        event: "edit",
        pageId,
        metadata: {
          tool: "visibility",
          instanceId,
          hidden: state.hidden,
          hiddenOn: state.hiddenOn
        }
      });
    },
    [mutate, pageId]
  );

  const applyAiPatch = useCallback(
    (instanceId: string, patch: Record<string, unknown>) => {
      mutate((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.instanceId === instanceId
            ? { ...s, config: { ...s.config, ...patch } }
            : s
        )
      }));
      trackEvent({
        event: "edit",
        pageId,
        metadata: {
          tool: "ai-improve",
          instanceId,
          patchedFields: Object.keys(patch)
        }
      });
    },
    [mutate, pageId]
  );

  const saveImageUrl = useCallback(
    (instanceId: string, elementKey: string, url: string) => {
      mutate((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.instanceId === instanceId
            ? { ...s, config: { ...s.config, [elementKey]: url } }
            : s
        )
      }));
      trackEvent({
        event: "edit",
        pageId,
        metadata: {
          tool: "image-replace",
          instanceId,
          elementKey,
          hasUrl: url !== ""
        }
      });
    },
    [mutate, pageId]
  );

  /** Generic config-field write used by the Link modal (and any future
   *  small field editor that targets a single config key). */
  const saveConfigField = useCallback(
    (
      instanceId: string,
      elementKey: string,
      value: unknown,
      telemetryTool: string
    ) => {
      mutate((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.instanceId === instanceId
            ? { ...s, config: { ...s.config, [elementKey]: value } }
            : s
        )
      }));
      trackEvent({
        event: "edit",
        pageId,
        metadata: { tool: telemetryTool, instanceId, elementKey }
      });
    },
    [mutate, pageId]
  );

  const saveTokenOverrides = useCallback(
    (instanceId: string, overrides: Record<string, unknown>) => {
      mutate((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.instanceId === instanceId
            ? {
                ...s,
                tokenOverrides: { ...(s.tokenOverrides ?? {}), ...overrides }
              }
            : s
        )
      }));
      trackEvent({
        event: "edit",
        pageId,
        metadata: {
          tool: "typography",
          instanceId,
          overrideKeys: Object.keys(overrides)
        }
      });
    },
    [mutate, pageId]
  );

  const swapSection = useCallback(
    (instanceId: string, nextRegistrationId: string) => {
      mutate((prev) => {
        const previousKey = prev.sections.find(
          (s) => s.instanceId === instanceId
        )?.key;
        trackEvent({
          event: "pick",
          pageId,
          layoutVariant: nextRegistrationId,
          sectionKey: nextRegistrationId,
          metadata: { instanceId, previousKey, source: "replace-modal" }
        });
        return {
          ...prev,
          sections: prev.sections.map((s) =>
            s.instanceId === instanceId
              ? { ...s, key: nextRegistrationId }
              : s
          )
        };
      });
      setReplaceModal(null);
    },
    [mutate, pageId]
  );

  // Universal Smart Section Engine — commit path.
  // Rewrites both `key` and `config` in one mutation so preview never
  // renders the new section with the old config or vice versa. Orphaned
  // fields go under `_orphaned` so a subsequent swap-back can restore
  // them via the same modal.
  const commitSmartSwap = useCallback(
    (
      instanceId: string,
      nextRegistrationId: string,
      nextConfig: Record<string, unknown>,
      orphaned: { sourceKey: string; role?: string; value: unknown }[]
    ) => {
      mutate((prev) => {
        const previous = prev.sections.find(
          (s) => s.instanceId === instanceId
        );
        trackEvent({
          event: "pick",
          pageId,
          layoutVariant: nextRegistrationId,
          sectionKey: nextRegistrationId,
          metadata: {
            instanceId,
            previousKey: previous?.key,
            source: "smart-swap",
            orphanedCount: orphaned.length
          }
        });
        return {
          ...prev,
          sections: prev.sections.map((s) => {
            if (s.instanceId !== instanceId) return s;
            const nextOrphans =
              orphaned.length > 0
                ? {
                    _orphaned: {
                      ...(s.config._orphaned as Record<string, unknown> | undefined),
                      ...Object.fromEntries(
                        orphaned.map((o) => [o.sourceKey, o.value])
                      )
                    }
                  }
                : {};
            return {
              ...s,
              key: nextRegistrationId,
              config: { ...nextConfig, ...nextOrphans }
            };
          })
        };
      });
      setSmartSwapModal(null);
    },
    [mutate, pageId]
  );

  const applyTextEdit = useCallback(
    (instanceId: string, elementKey: string, value: string) => {
      mutate((prev) => {
        const variant = prev.sections.find((s) => s.instanceId === instanceId)?.key;
        trackEvent({
          event: "edit",
          pageId,
          layoutVariant: variant,
          sectionKey: variant,
          metadata: {
            instanceId,
            elementKey,
            valueLength: value.length
          }
        });
        return {
          ...prev,
          sections: prev.sections.map((s) =>
            s.instanceId === instanceId
              ? { ...s, config: { ...s.config, [elementKey]: value } }
              : s
          )
        };
      });
    },
    [pageId, mutate]
  );

  // Editor-side Cmd+Z / Cmd+Shift+Z shortcuts are wired via the
  // Module 13 command palette registry below — one keydown handler for
  // every editor-side shortcut, no double-fires.

  // ─── Autosave ──────────────────────────────────────────────
  useEffect(() => {
    // Skip the very first render — initialLayout came from the server
    // and doesn't need to be re-saved.
    if (layout === initialLayoutRef.current) return;

    setSaveState({ kind: "dirty" });
    const timer = setTimeout(async () => {
      setSaveState({ kind: "saving" });
      try {
        // fetchWithRetry handles offline waits + exponential backoff on
        // transient 5xx / network drops, so a flaky connection during
        // autosave self-heals without the merchant noticing.
        const res = await fetchWithRetry("/api/studio/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId, layoutJson: layout }),
          keepalive: true,
          onRetry: (attempt, delayMs) => {
            setSaveState({
              kind: "error",
              message: `Retrying save (attempt ${attempt + 1}) in ${Math.round(delayMs / 100) / 10}s…`
            });
          }
        });
        const json = (await res.json()) as
          | { ok: true; savedAt: string }
          | { ok: false; error: string };
        if (!res.ok || !json.ok) {
          setSaveState({
            kind: "error",
            message: "error" in json ? json.error : "save failed"
          });
        } else {
          setSaveState({ kind: "saved", at: Date.now() });
        }
      } catch (err) {
        setSaveState({
          kind: "error",
          message: (err as Error)?.message ?? "network"
        });
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [layout, pageId]);

  // ─── Publish ───────────────────────────────────────────────
  const publish = useCallback(async () => {
    setPublishState({ kind: "publishing" });
    try {
      // Publish is high-stakes — retry on transient 5xx / network so
      // "Publish" never silently fails when the network hiccups.
      const res = await fetchWithRetry("/api/studio/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId })
      });
      const json = (await res.json()) as
        | { ok: true; publishedAt: string }
        | { ok: false; error: string };
      if (!res.ok || !json.ok) {
        setPublishState({
          kind: "error",
          message: "error" in json ? json.error : "publish failed"
        });
        return;
      }
      setPublishState({ kind: "published", at: Date.now() });
      trackEvent({
        event: "publish",
        pageId,
        metadata: { publishedAt: json.publishedAt }
      });
    } catch (err) {
      setPublishState({
        kind: "error",
        message: (err as Error)?.message ?? "network"
      });
    }
  }, [pageId]);

  // ─── Command palette registry ────────────────────────────────
  //
  // Every action a merchant can trigger from Cmd+K lives here.
  // Requires-selection commands set `disabled` when nothing is picked;
  // the palette still shows them dimmed so merchants learn what's
  // available when they DO have something selected.
  const commands = useMemo<Command[]>(() => {
    const selectedInstanceId = selected
      ? instanceIdFromTreeId(selected)
      : null;
    const selectedInstance = selectedInstanceId
      ? layout.sections.find((s) => s.instanceId === selectedInstanceId)
      : null;
    const hasSection = Boolean(selectedInstance);

    return [
      // ─── Actions ─────────────────────────────────────────────
      {
        id: "duplicate",
        title: "Duplicate section",
        description: "Clone the selected section directly below.",
        category: "action",
        icon: "⧉",
        keywords: ["copy", "clone"],
        shortcut: { key: "d", cmd: true },
        disabled: !hasSection,
        run: () => {
          if (selectedInstanceId) duplicateSection(selectedInstanceId);
        }
      },
      {
        id: "visibility",
        title: "Change section visibility",
        description: "Show or hide the section per device.",
        category: "action",
        icon: "◐",
        keywords: ["hide", "show", "responsive"],
        shortcut: { key: "h", cmd: true },
        disabled: !hasSection,
        run: () => {
          if (!selectedInstanceId || !selectedInstance) return;
          setVisibilityModal({
            instanceId: selectedInstanceId,
            initialHidden: Boolean(selectedInstance.hidden),
            initialHiddenOn: selectedInstance.hiddenOn ?? []
          });
        }
      },
      {
        id: "save-component",
        title: "Save section as component",
        description: "Add to My Library for reuse across pages.",
        category: "action",
        icon: "☆",
        keywords: ["library", "template", "reuse"],
        shortcut: { key: "s", cmd: true, shift: true },
        disabled: !hasSection,
        run: () => {
          if (!selectedInstanceId || !selectedInstance) return;
          const library = selectedInstance.key.split(".")[0] ?? "hero";
          setSaveComponent({
            instanceId: selectedInstanceId,
            kind: library,
            sourceRegistrationId: selectedInstance.key,
            config: selectedInstance.config,
            tokenOverrides: selectedInstance.tokenOverrides ?? {},
            suggestedName:
              (selectedInstance.config["heading"] as string | undefined)?.slice(0, 40) ??
              `${library} · ${new Date().toLocaleDateString("en-GB")}`
          });
        }
      },
      {
        id: "remove",
        title: "Delete section",
        description: "Remove the selected section from the page.",
        category: "action",
        icon: "✕",
        keywords: ["remove", "trash"],
        shortcut: { key: "Backspace", cmd: true },
        disabled: !hasSection,
        run: () => {
          if (selectedInstanceId) applyRemove(selectedInstanceId);
        }
      },
      {
        id: "publish",
        title: "Publish page",
        description: "Promote current draft to the live site.",
        category: "action",
        icon: "→",
        keywords: ["deploy", "go live", "ship", "release"],
        run: publish
      },
      {
        id: "score-page",
        title: "Score page design",
        description: "Analyse the page across 6 dimensions.",
        category: "action",
        icon: "◇",
        keywords: ["quality", "check", "analyse", "analyze", "audit", "accessibility", "seo"],
        run: () => setScoreOpen(true)
      },
      {
        id: "open-analytics",
        title: "Open analytics",
        description: "Per-section views, clicks, CTR and conversions.",
        category: "action",
        icon: "📊",
        keywords: ["analytics", "metrics", "traffic", "views", "clicks", "ctr", "performance"],
        run: () => setAnalyticsOpen(true)
      },
      {
        id: "start-ab-test",
        title: "Start / manage A/B test",
        description: "Run two variants of the selected section against each other.",
        category: "action",
        icon: "◈",
        keywords: ["ab", "a/b", "test", "experiment", "split", "variant", "compare"],
        disabled: !hasSection,
        run: () => {
          if (selectedInstanceId) setExperimentInstance(selectedInstanceId);
        }
      },
      {
        id: "find-replace",
        title: "Find and replace across pages",
        description: "Rename brand terms, prices or CTAs everywhere at once.",
        category: "action",
        icon: "⌕",
        shortcut: { key: "f", cmd: true, shift: true },
        keywords: ["find", "replace", "search", "rename", "global", "text"],
        run: () => setFindReplaceOpen(true)
      },
      {
        id: "version-history",
        title: "Open version history",
        description: "Every publish is a restorable snapshot.",
        category: "action",
        icon: "⟲",
        shortcut: { key: "h", cmd: true, shift: true },
        keywords: ["history", "versions", "rollback", "restore", "publish", "snapshot"],
        run: () => setVersionHistoryOpen(true)
      },
      {
        id: "undo",
        title: "Undo",
        category: "action",
        icon: "↶",
        shortcut: { key: "z", cmd: true },
        disabled: !canUndo,
        run: undo
      },
      {
        id: "redo",
        title: "Redo",
        category: "action",
        icon: "↷",
        shortcut: { key: "z", cmd: true, shift: true },
        disabled: !canRedo,
        run: redo
      },

      // ─── Device switcher ─────────────────────────────────────
      {
        id: "device-mobile",
        title: "Switch preview to Mobile",
        category: "device",
        icon: "📱",
        keywords: ["phone", "small", "420"],
        shortcut: { key: "1", cmd: true },
        run: () => setDevice("mobile")
      },
      {
        id: "device-tablet",
        title: "Switch preview to Tablet",
        category: "device",
        icon: "📔",
        keywords: ["ipad", "820"],
        shortcut: { key: "2", cmd: true },
        run: () => setDevice("tablet")
      },
      {
        id: "device-desktop",
        title: "Switch preview to Desktop",
        category: "device",
        icon: "🖥️",
        keywords: ["laptop", "monitor", "1280"],
        shortcut: { key: "3", cmd: true },
        run: () => setDevice("desktop")
      },

      // ─── Navigate ────────────────────────────────────────────
      {
        id: "nav-home",
        title: "Open Studio home",
        category: "navigate",
        icon: "🏠",
        keywords: ["dashboard"],
        run: () => router.push("/studio/home")
      },
      {
        id: "nav-pages",
        title: "Open Pages list",
        category: "navigate",
        icon: "📄",
        keywords: ["list"],
        run: () => router.push("/studio/pages")
      },
      {
        id: "nav-templates",
        title: "Open Section Templates",
        category: "navigate",
        icon: "▦",
        keywords: ["library", "catalog"],
        run: () => router.push("/studio/templates")
      },
      {
        id: "nav-components",
        title: "Open My Components",
        category: "navigate",
        icon: "☆",
        keywords: ["saved", "library"],
        run: () => router.push("/studio/components")
      },
      {
        id: "nav-media",
        title: "Open Media Library",
        category: "navigate",
        icon: "🖼",
        keywords: ["images", "uploads"],
        run: () => router.push("/studio/media")
      },
      {
        id: "nav-brands",
        title: "Open Brand Tokens",
        category: "navigate",
        icon: "◉",
        keywords: ["colours", "design", "tokens", "global"],
        shortcut: { key: "b", cmd: true, shift: true },
        run: () => router.push("/studio/brands")
      },

      // ─── System ──────────────────────────────────────────────
      {
        id: "sign-out",
        title: "Sign out of Studio",
        description: "Clear session and return to sign-in.",
        category: "system",
        icon: "🚪",
        keywords: ["exit", "logout"],
        run: () => {
          void fetch("/api/studio/exit", { method: "POST" }).then(() =>
            router.push("/studio")
          );
        }
      }
    ];
  }, [
    selected,
    layout.sections,
    canUndo,
    canRedo,
    duplicateSection,
    applyRemove,
    publish,
    undo,
    redo,
    router
  ]);

  // ─── Global keyboard: Cmd+K opens palette, other shortcuts fire
  //     their command directly. Text-input focus is respected — no
  //     shortcut fires while typing in an editor field. ──────────
  useEffect(() => {
    function isTypingContext(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return true;
      if (el.isContentEditable) return true;
      return false;
    }
    function onKey(e: KeyboardEvent) {
      // Cmd+K → toggle palette. Priority over everything else.
      if (
        e.key.toLowerCase() === "k" &&
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      // Don't fire shortcuts while typing into a field.
      if (isTypingContext(e.target)) return;
      // Palette open — let it handle its own keys.
      if (paletteOpen) return;
      // Route through the command registry.
      for (const cmd of commands) {
        if (!cmd.shortcut || cmd.disabled) continue;
        if (matchShortcut(cmd.shortcut, e)) {
          e.preventDefault();
          cmd.run();
          return;
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commands, paletteOpen]);

  const width = DEVICE_WIDTH[device];

  return (
    <div className="flex min-h-[80vh] flex-col gap-4 bg-neutral-100 p-4 sm:p-6">
      {/* Device toolbar */}
      <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-3">
        {pages.length > 0 && (
          <PageSwitcher pages={pages} currentPageId={pageId} />
        )}

        <div className="inline-flex overflow-hidden rounded-xl border-2 border-neutral-300 bg-white">
          {(["mobile", "tablet", "desktop"] as Device[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDevice(d)}
              aria-pressed={device === d}
              className="inline-flex h-10 items-center gap-1.5 px-3 text-[11px] font-extrabold uppercase tracking-widest transition"
              style={{
                background: device === d ? "#0A0A0A" : "transparent",
                color: device === d ? "#FFFFFF" : "#404040"
              }}
            >
              {d === "mobile" ? "📱" : d === "tablet" ? "📔" : "🖥️"} {d}
            </button>
          ))}
        </div>

        {/* Undo / Redo */}
        <div className="inline-flex overflow-hidden rounded-xl border-2 border-neutral-300 bg-white">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo (Cmd/Ctrl+Z)"
            title="Undo (Cmd/Ctrl+Z)"
            className="inline-flex h-10 items-center px-3 text-[13px] font-extrabold text-neutral-700 transition disabled:cursor-not-allowed disabled:opacity-30 hover:enabled:bg-neutral-50"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo (Cmd/Ctrl+Shift+Z)"
            title="Redo (Cmd/Ctrl+Shift+Z)"
            className="inline-flex h-10 items-center border-l-2 border-neutral-300 px-3 text-[13px] font-extrabold text-neutral-700 transition disabled:cursor-not-allowed disabled:opacity-30 hover:enabled:bg-neutral-50"
          >
            ↷
          </button>
        </div>

        <SaveIndicator state={saveState} />

        <div className="flex-1" />

        <PublishButton state={publishState} onPublish={publish} />
      </div>

      {/* Editing stage — Navigator on the left, iframe on the right. */}
      <div className="mx-auto flex w-full max-w-[1400px] gap-4">
        <aside className="hidden h-[78vh] w-72 shrink-0 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm lg:flex">
          <div className="max-h-[40%] shrink-0 overflow-y-auto border-b border-neutral-200">
            <StudioSectionOutline
              layout={layout}
              selectedInstanceId={selected}
              onSelect={handleNavigate}
              onReorder={applyReorderRow}
            />
          </div>
          <div className="min-h-0 flex-1">
            <StudioTreeNavigator
              snapshot={snapshot}
              selected={selected}
              onNavigate={handleNavigate}
            />
          </div>
        </aside>

        <div className="flex flex-1 justify-center">
          <div
            className="overflow-hidden rounded-2xl border-4 border-neutral-800 bg-white shadow-2xl transition-[width] duration-200"
            style={{ width: Math.min(width, 1400) }}
          >
            <iframe
              ref={iframeRef}
              src={initialSrc}
              title="Live page preview"
              className="block h-[78vh] w-full border-0"
            />
          </div>
        </div>
      </div>

      {replaceModal && (
        <StudioReplaceModal
          currentSectionId={replaceModal.currentSectionId}
          currentInstanceId={replaceModal.instanceId}
          merchantSlug={merchantSlug}
          onSwap={(nextRegistrationId) =>
            swapSection(replaceModal.instanceId, nextRegistrationId)
          }
          onClose={() => setReplaceModal(null)}
        />
      )}

      {smartSwapModal && (() => {
        const sourceReg = sectionRegistry.get(smartSwapModal.sourceSectionId);
        if (!sourceReg) return null;
        // Candidates: every registered section EXCEPT the current one.
        // Filtering to `library === sourceReg.library` restricts to
        // sibling variants (Hero → Hero); dropping the filter would
        // widen this to cross-library swap (Hero → FAQ), which the
        // engine already supports but merchants shouldn't discover
        // until we scope the picker properly.
        const candidates = sectionRegistry
          .list()
          .filter(
            (r) =>
              r.id !== smartSwapModal.sourceSectionId &&
              r.library === sourceReg.library
          )
          .map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            editableFields: r.editableFields,
            defaultConfig: r.defaultConfig
          }));
        return (
          <SmartSwapModal
            sourceInstanceId={smartSwapModal.instanceId}
            source={{
              registration: {
                id: sourceReg.id,
                name: sourceReg.name,
                editableFields: sourceReg.editableFields
              },
              config: smartSwapModal.sourceConfig
            }}
            candidates={candidates}
            onCancel={() => setSmartSwapModal(null)}
            onCommit={(commit) =>
              commitSmartSwap(
                smartSwapModal.instanceId,
                commit.targetSectionId,
                commit.targetConfig,
                commit.orphanedFields
              )
            }
          />
        );
      })()}

      {typographyModal && (
        <StudioTypographyModal
          instanceId={typographyModal.instanceId}
          currentOverrides={typographyModal.currentOverrides}
          onSave={(overrides) => {
            saveTokenOverrides(typographyModal.instanceId, overrides);
            setTypographyModal(null);
          }}
          onClose={() => setTypographyModal(null)}
        />
      )}

      {imagePicker && (
        <StudioImagePickerModal
          instanceId={imagePicker.instanceId}
          elementKey={imagePicker.elementKey}
          currentUrl={imagePicker.currentUrl}
          onPick={(url) => {
            saveImageUrl(
              imagePicker.instanceId,
              imagePicker.elementKey,
              url
            );
            setImagePicker(null);
          }}
          onClose={() => setImagePicker(null)}
        />
      )}

      {linkModal && (
        <StudioLinkModal
          instanceId={linkModal.instanceId}
          labelKey={linkModal.labelKey}
          hrefKey={linkModal.hrefKey}
          currentValue={linkModal.currentValue}
          onSave={(value) => {
            saveConfigField(
              linkModal.instanceId,
              linkModal.hrefKey,
              value,
              "link"
            );
            setLinkModal(null);
          }}
          onClose={() => setLinkModal(null)}
        />
      )}

      {colourModal && (
        <StudioColourModal
          instanceId={colourModal.instanceId}
          tokenKey={colourModal.tokenKey}
          currentValue={colourModal.currentValue}
          onSave={(value) => {
            saveTokenOverrides(colourModal.instanceId, {
              [colourModal.tokenKey]: value
            });
            setColourModal(null);
          }}
          onClose={() => setColourModal(null)}
        />
      )}

      {saveComponent && (
        <StudioSaveComponentModal
          instanceId={saveComponent.instanceId}
          kind={saveComponent.kind}
          sourceRegistrationId={saveComponent.sourceRegistrationId}
          config={saveComponent.config}
          tokenOverrides={saveComponent.tokenOverrides}
          suggestedName={saveComponent.suggestedName}
          onSaved={() => setSaveComponent(null)}
          onClose={() => setSaveComponent(null)}
        />
      )}

      {visibilityModal && (
        <StudioVisibilityModal
          instanceId={visibilityModal.instanceId}
          initialHidden={visibilityModal.initialHidden}
          initialHiddenOn={visibilityModal.initialHiddenOn}
          onSave={(state) => {
            saveVisibility(visibilityModal.instanceId, state);
            setVisibilityModal(null);
          }}
          onClose={() => setVisibilityModal(null)}
        />
      )}

      {paletteOpen && (
        <StudioCommandPalette
          commands={commands}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      {(() => {
        // Persistent AI prompt bar — always mounted, selection-aware.
        // Derives currentConfig + section registration on the fly so it
        // stays in sync with history/undo.
        const instanceId = selected ? instanceIdFromTreeId(selected) : null;
        const instance = instanceId
          ? layout.sections.find((s) => s.instanceId === instanceId)
          : null;
        const reg = instance ? sectionRegistry.get(instance.key) : null;
        const promptBarSelected =
          instanceId && instance
            ? {
                instanceId,
                sectionId: instance.key,
                sectionName: reg?.name ?? instance.key,
                currentConfig: instance.config as Record<string, unknown>
              }
            : null;
        return (
          <StudioPromptBar
            merchantSlug={merchantSlug}
            token={token}
            selected={promptBarSelected}
            onApply={applyAiPatch}
          />
        );
      })()}

      {aiModal && (
        <StudioAiModal
          instanceId={aiModal.instanceId}
          sectionId={aiModal.sectionId}
          sectionName={aiModal.sectionName}
          promptTemplate={aiModal.promptTemplate}
          currentConfig={aiModal.currentConfig}
          aiPromptable={aiModal.aiPromptable}
          onApply={(patch) => applyAiPatch(aiModal.instanceId, patch)}
          onClose={() => setAiModal(null)}
        />
      )}

      {scoreOpen && (
        <StudioScoreModal
          layout={layout}
          onJumpToSection={(instanceId) => {
            const treeId = `sec:${instanceId}`;
            setSelected(treeId);
            editorEmit.scrollTo(iframeRef.current, treeId, "smooth");
          }}
          onClose={() => setScoreOpen(false)}
        />
      )}

      {analyticsOpen && (
        <StudioAnalyticsModal
          pageId={pageId}
          onJumpToSection={(instanceId) => {
            const treeId = `sec:${instanceId}`;
            setSelected(treeId);
            editorEmit.scrollTo(iframeRef.current, treeId, "smooth");
          }}
          onClose={() => setAnalyticsOpen(false)}
        />
      )}

      {experimentInstance && (
        <StudioExperimentModal
          pageId={pageId}
          instanceId={experimentInstance}
          baselineConfig={
            layout.sections.find((s) => s.instanceId === experimentInstance)
              ?.config ?? {}
          }
          onClose={() => setExperimentInstance(null)}
          onRollout={() => {
            // Server patched the live layout — refresh from server so
            // the editor mirrors the merchant's new baseline.
            router.refresh();
          }}
        />
      )}

      {findReplaceOpen && (
        <StudioFindReplaceModal
          onClose={() => setFindReplaceOpen(false)}
          onApplied={() => {
            // Server mutated every draft layout. Reload so the editor's
            // in-memory copy doesn't drift from the DB.
            router.refresh();
          }}
        />
      )}

      {versionHistoryOpen && (
        <StudioVersionHistoryModal
          pageId={pageId}
          onClose={() => setVersionHistoryOpen(false)}
          onRestored={() => {
            // Restore wrote the target version's layout back into the
            // current draft. Reload so the editor picks up the fresh
            // draft rather than continuing to render the pre-restore
            // in-memory copy.
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** Convention: primaryCtaLabel → primaryCtaHref, secondaryCtaLabel →
 *  secondaryCtaHref, ctaText → ctaHref. Section registrations that name
 *  their fields consistently get free Link editing. */
function hrefKeyFromLabelKey(labelKey: string): string {
  if (labelKey.endsWith("Label")) return labelKey.slice(0, -"Label".length) + "Href";
  if (labelKey.endsWith("Text")) return labelKey.slice(0, -"Text".length) + "Href";
  return labelKey + "Href";
}

/** Tree-ids for section roots are shaped `sec:<instanceId>`. Extract
 *  the instanceId — same helper used by PageChromeClient. */
function instanceIdFromTreeId(treeId: string): string | null {
  if (!treeId.startsWith("sec:")) return null;
  const rest = treeId.slice(4);
  const dot = rest.indexOf(".");
  return dot === -1 ? rest : rest.slice(0, dot);
}

/** Element tree-ids: `sec:<instanceId>.<elementKey>` — return the
 *  elementKey portion. Section-root ids return null. */
function elementKeyFromTreeId(treeId: string): string | null {
  if (!treeId.startsWith("sec:")) return null;
  const rest = treeId.slice(4);
  const dot = rest.indexOf(".");
  if (dot === -1) return null;
  return rest.slice(dot + 1);
}

// ─── Save + publish widgets ─────────────────────────────────────

function SaveIndicator({ state }: { state: SaveState }) {
  const { label, dot } = describeSave(state);
  return (
    <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-neutral-500">
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: dot }}
      />
      {label}
    </p>
  );
}

function describeSave(state: SaveState): { label: string; dot: string } {
  switch (state.kind) {
    case "idle":
      return { label: "Ready", dot: "#A3A3A3" };
    case "dirty":
      return { label: "Unsaved changes", dot: "#F59E0B" };
    case "saving":
      return { label: "Saving…", dot: "#3B82F6" };
    case "saved":
      return { label: "Saved", dot: "#10B981" };
    case "error":
      return { label: `Save failed · ${state.message}`, dot: "#DC2626" };
  }
}

function PublishButton({
  state,
  onPublish
}: {
  state: PublishState;
  onPublish: () => void;
}) {
  const label =
    state.kind === "publishing"
      ? "Publishing…"
      : state.kind === "published"
        ? "✓ Published"
        : state.kind === "error"
          ? `Publish failed · ${state.message}`
          : "Publish →";
  const disabled = state.kind === "publishing";
  const bg =
    state.kind === "error"
      ? "#DC2626"
      : state.kind === "published"
        ? "#10B981"
        : "#0A0A0A";
  return (
    <button
      type="button"
      onClick={onPublish}
      disabled={disabled}
      className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:brightness-110"
      style={{ background: bg }}
    >
      {label}
    </button>
  );
}

// ─── Page switcher ──────────────────────────────────────────
// Native <select> for maximum trust + zero JS chrome. Falls back to a
// simple label when the merchant only has one page (nothing to switch
// to). Renders the "Manage" link so they can jump to the pages list.
function PageSwitcher({
  pages,
  currentPageId
}: {
  pages: StudioPage[];
  currentPageId: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-xl border-2 border-neutral-300 bg-white px-2">
      <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
        Page
      </span>
      <select
        value={currentPageId}
        onChange={(e) => {
          if (e.target.value && e.target.value !== currentPageId) {
            window.location.href = `/studio/pages/${e.target.value}`;
          }
        }}
        className="h-10 min-w-[8rem] cursor-pointer border-0 bg-transparent px-1 text-[12px] font-extrabold text-neutral-900 focus:outline-none"
      >
        {pages.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.name}
            {p.is_home ? " · Home" : ""}
          </option>
        ))}
      </select>
      <a
        href="/studio/pages"
        className="rounded-md px-2 py-1 text-[9px] font-extrabold uppercase tracking-widest text-neutral-500 hover:bg-neutral-100"
      >
        Manage
      </a>
    </div>
  );
}

// ─── Layout mutation primitives ─────────────────────────────────
// Pure functions — reusable by AI Improve (Module 14), Command Palette
// (Module 13), and unit tests. Nothing here reaches for React state.

function moveInstance(
  layout: StudioLayoutJson,
  instanceId: string,
  direction: "up" | "down" | "left" | "right"
): StudioLayoutJson {
  const rowIdx = layout.rows.findIndex((r) => r.columns.includes(instanceId));
  if (rowIdx === -1) return layout;
  const row = layout.rows[rowIdx];
  const colIdx = row.columns.indexOf(instanceId);

  if (direction === "left" || direction === "right") {
    const target = direction === "left" ? colIdx - 1 : colIdx + 1;
    if (target < 0 || target >= row.columns.length) return layout;
    const nextCols = row.columns.slice();
    [nextCols[colIdx], nextCols[target]] = [nextCols[target], nextCols[colIdx]];
    return {
      ...layout,
      rows: layout.rows.map((r, i) =>
        i === rowIdx ? { ...r, columns: nextCols } : r
      )
    };
  }

  // Up/Down. If in a multi-col row, pop into its own row above/below.
  if (row.columns.length > 1) {
    const remaining = row.columns.filter((_, i) => i !== colIdx);
    const popped = {
      id: `row_${Math.random().toString(36).slice(2, 8)}`,
      columns: [instanceId]
    };
    const nextRows = [...layout.rows];
    nextRows.splice(rowIdx, 1, { ...row, columns: remaining });
    const insertAt = direction === "up" ? rowIdx : rowIdx + 1;
    nextRows.splice(insertAt, 0, popped);
    return { ...layout, rows: nextRows };
  }

  const target = direction === "up" ? rowIdx - 1 : rowIdx + 1;
  if (target < 0 || target >= layout.rows.length) return layout;
  const nextRows = layout.rows.slice();
  [nextRows[rowIdx], nextRows[target]] = [nextRows[target], nextRows[rowIdx]];
  return { ...layout, rows: nextRows };
}

function removeInstance(
  layout: StudioLayoutJson,
  instanceId: string
): StudioLayoutJson {
  const nextRows = layout.rows
    .map((r) => ({ ...r, columns: r.columns.filter((c) => c !== instanceId) }))
    .filter((r) => r.columns.length > 0);
  const nextSections = layout.sections.filter(
    (s) => s.instanceId !== instanceId
  );
  return { sections: nextSections, rows: nextRows };
}

// Many-step row reorder. Drag-drop drops a row on a different row's
// position — this splices it into the new index. Unlike moveInstance
// (which only steps ±1), this handles arbitrary from → to jumps.
export function reorderRow(
  layout: StudioLayoutJson,
  fromRowId: string,
  toRowId: string
): StudioLayoutJson {
  if (fromRowId === toRowId) return layout;
  const from = layout.rows.findIndex((r) => r.id === fromRowId);
  const to = layout.rows.findIndex((r) => r.id === toRowId);
  if (from === -1 || to === -1) return layout;
  const next = layout.rows.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return { ...layout, rows: next };
}
