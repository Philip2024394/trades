"use client";

// src/app/nex-native/cart/_delivery-address-form.tsx
//
// Bridge 22c-2 · Structured delivery-address block on the /cart
// page. Persists in localStorage under NEX_DELIVERY_ADDRESS_STORAGE_KEY
// so buyers only type it once across shops + sessions. Attached into
// cart_payload on Send so the seller gets a clean copy-paste block
// they can drop into their courier's booking screen without hunting
// through free-text notes.

import { useEffect, useState } from "react";
import {
  NEX_DELIVERY_ADDRESS_EMPTY,
  NEX_DELIVERY_ADDRESS_STORAGE_KEY,
  isDeliveryAddressComplete,
  type NexDeliveryAddress,
} from "@/lib/nex-native/cart-types";

const NEX = {
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  orange: "#FF7200",
  green: "#16D66B",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function readAddress(): NexDeliveryAddress {
  if (typeof window === "undefined") return NEX_DELIVERY_ADDRESS_EMPTY;
  try {
    const raw = window.localStorage.getItem(NEX_DELIVERY_ADDRESS_STORAGE_KEY);
    if (!raw) return NEX_DELIVERY_ADDRESS_EMPTY;
    const parsed = JSON.parse(raw);
    return { ...NEX_DELIVERY_ADDRESS_EMPTY, ...parsed };
  } catch {
    return NEX_DELIVERY_ADDRESS_EMPTY;
  }
}

function writeAddress(a: NexDeliveryAddress) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    NEX_DELIVERY_ADDRESS_STORAGE_KEY,
    JSON.stringify(a),
  );
  window.dispatchEvent(new CustomEvent("nex-delivery-address-changed"));
}

export function useDeliveryAddress(): {
  address: NexDeliveryAddress;
  hydrated: boolean;
} {
  const [address, setAddress] = useState<NexDeliveryAddress>(
    NEX_DELIVERY_ADDRESS_EMPTY,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAddress(readAddress());
    setHydrated(true);
    const onChange = () => setAddress(readAddress());
    window.addEventListener("nex-delivery-address-changed", onChange);
    return () =>
      window.removeEventListener("nex-delivery-address-changed", onChange);
  }, []);

  return { address, hydrated };
}

export function DeliveryAddressForm() {
  const [address, setAddress] = useState<NexDeliveryAddress>(
    NEX_DELIVERY_ADDRESS_EMPTY,
  );
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const initial = readAddress();
    setAddress(initial);
    setHydrated(true);
    // Auto-open the form the first time a buyer hits the cart
    // without a saved address.
    if (!isDeliveryAddressComplete(initial)) setOpen(true);
  }, []);

  function update<K extends keyof NexDeliveryAddress>(
    key: K,
    value: NexDeliveryAddress[K],
  ) {
    setAddress((prev) => {
      const next = { ...prev, [key]: value };
      writeAddress(next);
      return next;
    });
  }

  const complete = isDeliveryAddressComplete(address);

  if (!hydrated) return null;

  return (
    <section
      data-nex-delivery-address
      style={{
        padding: "18px 20px",
        borderRadius: 18,
        background: NEX.panelSoft,
        border: `1px solid ${complete ? "rgba(22,214,107,0.35)" : NEX.borderStrong}`,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: complete ? NEX.green : NEX.cyan,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            📦 Delivery address {complete ? "· saved ✓" : "· needed"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.005em" }}>
            {complete
              ? `${address.recipient_name} · ${address.city}`
              : "Add where sellers should send your orders"}
          </div>
          {complete && !open && (
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                color: NEX.textDim,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {formatAddressBlock(address)}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            background: open
              ? "rgba(139,169,209,0.10)"
              : "rgba(0,175,255,0.10)",
            border: `1px solid ${open ? NEX.borderStrong : NEX.cyanSoft}`,
            color: open ? NEX.textDim : NEX.cyan,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: SANS,
            whiteSpace: "nowrap",
          }}
        >
          {open ? "Done" : complete ? "Edit" : "Fill in"}
        </button>
      </div>

      {open && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <FieldRow full label="Full name">
            <TextInput
              value={address.recipient_name}
              onChange={(v) => update("recipient_name", v)}
              placeholder="Recipient's name"
              autoComplete="name"
            />
          </FieldRow>
          <FieldRow label="Phone">
            <TextInput
              value={address.phone}
              onChange={(v) => update("phone", v)}
              placeholder="0812…"
              inputMode="tel"
              autoComplete="tel"
            />
          </FieldRow>
          <FieldRow label="Postal code">
            <TextInput
              value={address.postal_code}
              onChange={(v) => update("postal_code", v)}
              placeholder="55271"
              inputMode="numeric"
              autoComplete="postal-code"
            />
          </FieldRow>
          <FieldRow full label="Street address">
            <TextInput
              value={address.street}
              onChange={(v) => update("street", v)}
              placeholder="Jl. Malioboro No. 42"
              autoComplete="address-line1"
            />
          </FieldRow>
          <FieldRow full label="Apartment · unit · floor (optional)">
            <TextInput
              value={address.street_2}
              onChange={(v) => update("street_2", v)}
              placeholder="Unit 3B · behind the yellow gate"
              autoComplete="address-line2"
            />
          </FieldRow>
          <FieldRow label="City">
            <TextInput
              value={address.city}
              onChange={(v) => update("city", v)}
              placeholder="Yogyakarta"
              autoComplete="address-level2"
            />
          </FieldRow>
          <FieldRow label="Province · region">
            <TextInput
              value={address.region}
              onChange={(v) => update("region", v)}
              placeholder="DIY"
              autoComplete="address-level1"
            />
          </FieldRow>
          <FieldRow full label="Country">
            <TextInput
              value={address.country}
              onChange={(v) => update("country", v)}
              placeholder="Indonesia"
              autoComplete="country-name"
            />
          </FieldRow>
          <FieldRow full label="Delivery notes (optional)">
            <textarea
              value={address.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Leave with security · ring bell twice · avoid morning traffic"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(0,0,0,0.35)",
                border: `1px solid ${NEX.border}`,
                color: NEX.text,
                fontSize: 13,
                lineHeight: 1.5,
                fontFamily: SANS,
                resize: "vertical",
                outline: "none",
              }}
            />
          </FieldRow>
        </div>
      )}

      {open && (
        <div
          style={{
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.5,
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(0,175,255,0.05)",
            border: `1px solid ${NEX.border}`,
          }}
        >
          🔒 Your address stays on this device until you tap Send · then
          it&apos;s posted to that seller&apos;s chat only. NEX never
          shares it with other sellers, ad networks, or anyone else.
        </div>
      )}
    </section>
  );
}

export function formatAddressBlock(a: NexDeliveryAddress): string {
  const lines: string[] = [];
  if (a.recipient_name.trim()) lines.push(a.recipient_name.trim());
  if (a.phone.trim()) lines.push(`☎ ${a.phone.trim()}`);
  if (a.street.trim()) lines.push(a.street.trim());
  if (a.street_2.trim()) lines.push(a.street_2.trim());
  const cityLine = [a.city.trim(), a.region.trim(), a.postal_code.trim()]
    .filter(Boolean)
    .join(", ");
  if (cityLine) lines.push(cityLine);
  if (a.country.trim()) lines.push(a.country.trim());
  if (a.notes.trim()) lines.push(`Notes: ${a.notes.trim()}`);
  return lines.join("\n");
}

function FieldRow({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        gridColumn: full ? "1 / -1" : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 9,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: NEX.textMute,
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      inputMode={inputMode}
      maxLength={200}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(0,0,0,0.35)",
        border: `1px solid ${NEX.border}`,
        color: NEX.text,
        fontSize: 13,
        fontFamily: SANS,
        outline: "none",
      }}
    />
  );
}
