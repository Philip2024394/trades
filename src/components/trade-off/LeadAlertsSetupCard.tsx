"use client";

// LeadAlertsSetupCard
//
// Dashboard card for the Lead Alerts add-on. Renders three states:
//
//   1. iOS + NOT standalone  → install-to-home-screen instructions
//      (Notification.requestPermission() throws on iOS Safari tabs).
//   2. Notification.permission === 'denied' → re-enable instructions.
//   3. Everything else → Enable / Disable / Test buttons + per-device
//      list with vibration presets, mute toggles, and quiet hours.
//
// The card is always rendered; it gracefully describes the next step
// instead of erroring. Mobile-first; 13px text floor; 44px tap
// targets; no emojis.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  VIBRATION_PRESETS,
  canEnablePushHere,
  detectPlatform,
  disablePush,
  enablePush,
  fetchSubscriptions,
  isIosStandalone,
  matchVibrationPreset,
  sendTestPush,
  updateSubscriptionSettings,
  type CanEnableResult,
  type Platform
} from "@/lib/clientPush";

type SubscriptionView = {
  endpoint_hash: string;
  platform: Platform;
  device_label: string | null;
  vibration_pattern: number[];
  muted_events: string[];
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  enabled: boolean;
  last_used_at: string | null;
  failure_count?: number;
};

type Props = {
  slug: string;
  editToken: string;
  vapidPublicKey: string;
  isPaidTier: boolean;
  addonEnabled: boolean;
  upgradeHref: string;
};

const EVENT_LABELS: Record<string, string> = {
  whatsapp_click: "WhatsApp lead pings",
  commission: "Materials Network commissions",
  review: "New review pings",
  test: "Test pings"
};
const KNOWN_EVENTS = ["whatsapp_click", "commission", "review"];

export function LeadAlertsSetupCard(props: Props) {
  const { slug, editToken, vapidPublicKey, isPaidTier, addonEnabled, upgradeHref } = props;

  const [mounted, setMounted] = useState(false);
  const [gate, setGate] = useState<CanEnableResult>({ ok: false, reason: "unsupported" });
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [permission, setPermission] = useState<NotificationPermission | "unknown">("unknown");
  const [subs, setSubs] = useState<SubscriptionView[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [localEndpointHash, setLocalEndpointHash] = useState<string | null>(null);

  // Read browser capabilities only on the client to avoid hydration
  // mismatches (server-rendered HTML can't know permission state).
  useEffect(() => {
    setMounted(true);
    setPlatform(detectPlatform());
    setGate(canEnablePushHere());
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const refreshSubs = useCallback(async () => {
    setLoadingSubs(true);
    const res = await fetchSubscriptions({ slug, editToken });
    if (res.ok) {
      setSubs(res.subscriptions as SubscriptionView[]);
    } else if (res.error) {
      setError(res.error);
    }
    setLoadingSubs(false);
  }, [slug, editToken]);

  useEffect(() => {
    if (mounted) {
      void refreshSubs();
    }
  }, [mounted, refreshSubs]);

  const isStandaloneIos = mounted && platform === "ios" && isIosStandalone();
  const needsInstall = mounted && platform === "ios" && !isStandaloneIos;
  const denied = permission === "denied" || gate.reason === "denied";
  const unsupported = mounted && gate.reason === "unsupported";

  const onEnable = useCallback(async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    const res = await enablePush({ slug, editToken, vapidPublicKey });
    setBusy(false);
    if (res.ok) {
      setLocalEndpointHash(res.endpointHash);
      setInfo("Alerts on for this device.");
      if (typeof Notification !== "undefined") setPermission(Notification.permission);
      await refreshSubs();
    } else {
      setError(
        res.reason === "denied"
          ? "Notifications were blocked. Open your browser settings to allow them."
          : res.reason === "needs_install"
            ? "Install Xrated to your home screen first."
            : res.reason === "no_vapid"
              ? "Server is missing VAPID keys."
              : res.reason === "subscribe_failed"
                ? `Couldn't subscribe: ${res.message ?? "unknown error"}`
                : res.reason === "save_failed"
                  ? `Couldn't save: ${res.message ?? "unknown error"}`
                  : "Not supported on this device."
      );
      if (typeof Notification !== "undefined") setPermission(Notification.permission);
    }
  }, [slug, editToken, vapidPublicKey, refreshSubs]);

  const onDisable = useCallback(async (hash: string | null) => {
    setError(null);
    setInfo(null);
    setBusy(true);
    const res = await disablePush({ slug, editToken, endpointHash: hash });
    setBusy(false);
    if (res.ok) {
      setInfo("Alerts off for this device.");
      setLocalEndpointHash(null);
      await refreshSubs();
    } else {
      setError(res.message);
    }
  }, [slug, editToken, refreshSubs]);

  const onTest = useCallback(async (hash: string) => {
    setError(null);
    setInfo(null);
    setBusy(true);
    const res = await sendTestPush({ slug, editToken, endpointHash: hash });
    setBusy(false);
    if (res.ok) {
      setInfo("Test push sent. Check the device.");
    } else {
      setError(res.error ?? "Couldn't send test push.");
    }
  }, [slug, editToken]);

  const enabledSubs = subs.filter((s) => s.enabled);
  const currentDeviceSub = useMemo(() => {
    if (!localEndpointHash) return null;
    return enabledSubs.find((s) => s.endpoint_hash === localEndpointHash) ?? null;
  }, [enabledSubs, localEndpointHash]);

  return (
    <section className="mx-auto max-w-3xl px-4 pb-6">
      <div className="rounded-3xl border border-brand-line bg-brand-surface p-5 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-accent">
          Lead Alerts
        </p>
        <h2 className="mt-2 text-xl font-extrabold leading-tight sm:text-2xl">
          Get a push the second someone taps WhatsApp.
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-brand-muted">
          Real-time PWA notification + custom vibration on every device you
          install Xrated on. No SMS, no Twilio fees. Works on iPhone (iOS 16.4+)
          and Android.
        </p>

        {!isPaidTier && (
          <div className="mt-4 rounded-xl border border-brand-accent bg-brand-accent/10 p-4">
            <p className="text-xs font-bold text-brand-accent">
              Upgrade to enable Lead Alerts
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              Lead Alerts is part of the Xrated App tier. Start a free 30-day
              trial to switch it on for every device you own.
            </p>
            <a
              href={upgradeHref}
              className="mt-3 inline-flex h-11 items-center rounded-full bg-brand-accent px-4 text-xs font-bold text-black transition hover:opacity-90"
            >
              See upgrade options
            </a>
          </div>
        )}

        {isPaidTier && !addonEnabled && (
          <div className="mt-4 rounded-xl border border-brand-line bg-brand-bg p-4">
            <p className="text-xs font-bold text-brand-text">
              Lead Alerts is off in your add-ons hub.
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              Scroll down to the Add-ons panel and switch Lead Alerts on, then
              come back here to subscribe your devices.
            </p>
          </div>
        )}

        {!mounted && (
          <div className="mt-4 rounded-xl border border-brand-line bg-brand-bg p-4 text-xs text-brand-muted">
            Loading device status…
          </div>
        )}

        {mounted && isPaidTier && addonEnabled && (
          <>
            {needsInstall && <IosInstallInstructions />}
            {!needsInstall && unsupported && <UnsupportedNote />}
            {!needsInstall && !unsupported && denied && <BlockedNote />}
            {!needsInstall && !unsupported && !denied && (
              <ThisDeviceBlock
                hasCurrent={!!currentDeviceSub}
                onEnable={onEnable}
                onDisable={() => onDisable(currentDeviceSub?.endpoint_hash ?? null)}
                onTest={() =>
                  currentDeviceSub
                    ? onTest(currentDeviceSub.endpoint_hash)
                    : Promise.resolve()
                }
                busy={busy}
                platform={platform}
              />
            )}

            {error && (
              <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
                {error}
              </p>
            )}
            {info && (
              <p className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300">
                {info}
              </p>
            )}

            <div className="mt-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                Your devices
              </p>
              {loadingSubs ? (
                <p className="mt-2 text-xs text-brand-muted">Loading devices…</p>
              ) : enabledSubs.length === 0 ? (
                <p className="mt-2 rounded-lg border border-dashed border-brand-line bg-brand-bg px-3 py-3 text-xs text-brand-muted">
                  No devices subscribed yet. Enable on this device to get
                  started — repeat the steps on every phone or tablet you want
                  to ring.
                </p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {enabledSubs.map((sub) => (
                    <DeviceRow
                      key={sub.endpoint_hash}
                      sub={sub}
                      slug={slug}
                      editToken={editToken}
                      isThisDevice={sub.endpoint_hash === localEndpointHash}
                      onTest={() => onTest(sub.endpoint_hash)}
                      onDisable={() => onDisable(sub.endpoint_hash)}
                      onChanged={refreshSubs}
                      busy={busy}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function ThisDeviceBlock({
  hasCurrent,
  onEnable,
  onDisable,
  onTest,
  busy,
  platform
}: {
  hasCurrent: boolean;
  onEnable: () => Promise<void>;
  onDisable: () => Promise<void>;
  onTest: () => Promise<void>;
  busy: boolean;
  platform: Platform;
}) {
  if (hasCurrent) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
        <p className="text-xs font-bold text-emerald-300">
          Alerts on for this device
        </p>
        <p className="mt-1 text-xs text-emerald-200/80">
          {platform === "ios"
            ? "Keep Xrated on your home screen — that's what wakes the iPhone."
            : platform === "android"
              ? "Android push is live. Don't force-stop Xrated or alerts pause."
              : "Desktop push is live. Keep your browser open in the background."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onTest()}
            disabled={busy}
            className="inline-flex h-11 items-center rounded-full border border-brand-accent bg-brand-accent px-4 text-xs font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            Send test push
          </button>
          <button
            type="button"
            onClick={() => void onDisable()}
            disabled={busy}
            className="inline-flex h-11 items-center rounded-full border border-brand-line bg-brand-bg px-4 text-xs font-bold text-brand-text transition hover:border-red-500/60 hover:text-red-300 disabled:opacity-50"
          >
            Disable on this device
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-xl border border-brand-line bg-brand-bg p-4">
      <p className="text-xs font-bold text-brand-text">Enable alerts on this device</p>
      <p className="mt-1 text-xs text-brand-muted">
        Allow notifications when your browser asks. You can subscribe more
        devices later — every phone and tablet you install Xrated on will ring
        together.
      </p>
      <button
        type="button"
        onClick={() => void onEnable()}
        disabled={busy}
        className="mt-3 inline-flex h-11 items-center rounded-full bg-brand-accent px-4 text-xs font-bold text-black transition hover:opacity-90 disabled:opacity-50"
      >
        Enable alerts on this device
      </button>
    </div>
  );
}

function IosInstallInstructions() {
  return (
    <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <p className="text-xs font-bold text-amber-300">
        Install Xrated to your home screen first
      </p>
      <p className="mt-1 text-xs text-amber-200/80">
        iPhone push notifications only work when Xrated runs as an installed
        app, not as a Safari tab. Three steps in Safari:
      </p>
      <ol className="mt-3 space-y-2 text-xs leading-relaxed text-amber-100">
        <li className="flex gap-2">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-black">
            1
          </span>
          <span>Tap the Share button at the bottom of Safari (square with an up arrow).</span>
        </li>
        <li className="flex gap-2">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-black">
            2
          </span>
          <span>Scroll and tap &ldquo;Add to Home Screen&rdquo;.</span>
        </li>
        <li className="flex gap-2">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-black">
            3
          </span>
          <span>Open Xrated from your home screen, then come back to this page to enable alerts.</span>
        </li>
      </ol>
    </div>
  );
}

function BlockedNote() {
  return (
    <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <p className="text-xs font-bold text-amber-300">Notifications are blocked</p>
      <p className="mt-1 text-xs text-amber-200/80">
        Open your device&rsquo;s Settings → Notifications → Xrated and switch
        them back on. Then reload this page and tap Enable.
      </p>
    </div>
  );
}

function UnsupportedNote() {
  return (
    <div className="mt-4 rounded-xl border border-brand-line bg-brand-bg p-4">
      <p className="text-xs font-bold text-brand-text">
        This browser doesn&rsquo;t support web push
      </p>
      <p className="mt-1 text-xs text-brand-muted">
        Try a modern Chrome, Edge, Firefox or installed iOS PWA. Your other
        subscribed devices will still ring.
      </p>
    </div>
  );
}

function DeviceRow({
  sub,
  slug,
  editToken,
  isThisDevice,
  onTest,
  onDisable,
  onChanged,
  busy
}: {
  sub: SubscriptionView;
  slug: string;
  editToken: string;
  isThisDevice: boolean;
  onTest: () => Promise<void>;
  onDisable: () => Promise<void>;
  onChanged: () => Promise<void>;
  busy: boolean;
}) {
  const presetId = matchVibrationPreset(sub.vibration_pattern);
  const [savingPreset, setSavingPreset] = useState<string | null>(null);
  const [savingMute, setSavingMute] = useState<string | null>(null);
  const [savingQuiet, setSavingQuiet] = useState(false);
  const [qhStart, setQhStart] = useState<number | "">(sub.quiet_hours_start ?? "");
  const [qhEnd, setQhEnd] = useState<number | "">(sub.quiet_hours_end ?? "");
  const [rowError, setRowError] = useState<string | null>(null);

  const onPresetChange = async (id: string) => {
    const preset = VIBRATION_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setSavingPreset(id);
    setRowError(null);
    const res = await updateSubscriptionSettings({
      slug,
      editToken,
      endpointHash: sub.endpoint_hash,
      vibrationPattern: preset.pattern
    });
    setSavingPreset(null);
    if (!res.ok) setRowError(res.error ?? "Couldn't save preset.");
    await onChanged();
  };

  const onMuteToggle = async (eventType: string) => {
    const currentMuted = Array.isArray(sub.muted_events) ? [...sub.muted_events] : [];
    const idx = currentMuted.indexOf(eventType);
    if (idx >= 0) currentMuted.splice(idx, 1);
    else currentMuted.push(eventType);
    setSavingMute(eventType);
    setRowError(null);
    const res = await updateSubscriptionSettings({
      slug,
      editToken,
      endpointHash: sub.endpoint_hash,
      mutedEvents: currentMuted
    });
    setSavingMute(null);
    if (!res.ok) setRowError(res.error ?? "Couldn't save mute.");
    await onChanged();
  };

  const onSaveQuiet = async () => {
    setSavingQuiet(true);
    setRowError(null);
    const res = await updateSubscriptionSettings({
      slug,
      editToken,
      endpointHash: sub.endpoint_hash,
      quietHoursStart: qhStart === "" ? null : Number(qhStart),
      quietHoursEnd: qhEnd === "" ? null : Number(qhEnd)
    });
    setSavingQuiet(false);
    if (!res.ok) setRowError(res.error ?? "Couldn't save quiet hours.");
    await onChanged();
  };

  const platformLabel: Record<Platform, string> = {
    ios: "iPhone / iPad",
    android: "Android",
    desktop: "Desktop",
    unknown: "Other"
  };

  return (
    <li className="rounded-2xl border border-brand-line bg-brand-bg p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-tight text-brand-text">
            {sub.device_label ?? platformLabel[sub.platform]}
            {isThisDevice && (
              <span className="ml-2 inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                This device
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[13px] text-brand-muted">
            {platformLabel[sub.platform]}
            {sub.last_used_at
              ? ` · last ping ${new Date(sub.last_used_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}`
              : " · no pings yet"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onTest()}
            disabled={busy}
            className="inline-flex h-11 items-center rounded-full border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent disabled:opacity-50"
          >
            Test
          </button>
          <button
            type="button"
            onClick={() => void onDisable()}
            disabled={busy}
            className="inline-flex h-11 items-center rounded-full border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-text transition hover:border-red-500/60 hover:text-red-300 disabled:opacity-50"
          >
            Disable
          </button>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
          Vibration
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {VIBRATION_PRESETS.map((preset) => {
            const isActive = preset.id === presetId;
            const isSaving = savingPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => void onPresetChange(preset.id)}
                disabled={isSaving}
                className={`inline-flex h-11 items-center justify-center rounded-full border px-3 text-xs font-bold transition disabled:opacity-50 ${
                  isActive
                    ? "border-brand-accent bg-brand-accent text-black"
                    : "border-brand-line bg-brand-surface text-brand-text hover:border-brand-accent hover:text-brand-accent"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
          Mute event types
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {KNOWN_EVENTS.map((eventType) => {
            const isMuted = Array.isArray(sub.muted_events) && sub.muted_events.includes(eventType);
            const isSaving = savingMute === eventType;
            return (
              <button
                key={eventType}
                type="button"
                onClick={() => void onMuteToggle(eventType)}
                disabled={isSaving}
                aria-pressed={isMuted}
                className={`inline-flex h-11 items-center rounded-full border px-3 text-xs font-bold transition disabled:opacity-50 ${
                  isMuted
                    ? "border-amber-500/60 bg-amber-500/20 text-amber-200"
                    : "border-brand-line bg-brand-surface text-brand-text hover:border-brand-accent hover:text-brand-accent"
                }`}
              >
                {isMuted ? "Muted" : "On"} · {EVENT_LABELS[eventType] ?? eventType}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
          Quiet hours
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-xs text-brand-muted">From</label>
          <select
            value={qhStart === null ? "" : qhStart}
            onChange={(e) => setQhStart(e.target.value === "" ? "" : Number(e.target.value))}
            className="h-11 min-w-[88px] rounded-full border border-brand-line bg-brand-surface px-3 text-xs text-brand-text"
          >
            <option value="">Off</option>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
          <label className="text-xs text-brand-muted">to</label>
          <select
            value={qhEnd === null ? "" : qhEnd}
            onChange={(e) => setQhEnd(e.target.value === "" ? "" : Number(e.target.value))}
            className="h-11 min-w-[88px] rounded-full border border-brand-line bg-brand-surface px-3 text-xs text-brand-text"
          >
            <option value="">Off</option>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void onSaveQuiet()}
            disabled={savingQuiet}
            className="inline-flex h-11 items-center rounded-full border border-brand-accent bg-brand-accent px-3 text-xs font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      {rowError && (
        <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
          {rowError}
        </p>
      )}
    </li>
  );
}
