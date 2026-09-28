"use client";

// src/app/nex-native/cart/_cart-client.tsx
//
// Bridge 22 · Client-side cart · reads localStorage on mount,
// groups items by shop, renders per-shop cards with per-item qty +
// note + a shop-level comment box, and a "Send order to <shop>"
// button that serialises the shop's lines into cart_payload +
// submits to sendCartOrderAction.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  NEX_CART_STORAGE_KEY,
  NEX_DELIVERY_ADDRESS_STORAGE_KEY,
  NEX_DELIVERY_ADDRESS_EMPTY,
  isDeliveryAddressComplete,
  type NexCartItem,
  type NexCartSendPayload,
  type NexDeliveryAddress,
} from "@/lib/nex-native/cart-types";
import {
  DeliveryAddressForm,
  useDeliveryAddress,
} from "./_delivery-address-form";

const NEX = {
  bg: "#020914",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  orange: "#FF7200",
  orangeSoft: "rgba(255,114,0,0.6)",
  green: "#16D66B",
  red: "#FF3355",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function readCart(): NexCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NEX_CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is NexCartItem =>
        x && typeof x === "object" && typeof x.key === "string",
    );
  } catch {
    return [];
  }
}

function writeCart(items: NexCartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NEX_CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("nex-cart-changed"));
}

function formatPrice(pence: number, currency: string): string {
  const majors = Math.round(pence / 100);
  const withCommas = majors.toLocaleString();
  if (currency === "IDR") return `Rp ${withCommas}`;
  if (currency === "GBP") return `£${(pence / 100).toFixed(2)}`;
  if (currency === "USD") return `$${(pence / 100).toFixed(2)}`;
  return `${currency} ${withCommas}`;
}

export interface CartClientServerHydration {
  items: NexCartItem[];
  delivery_address: NexDeliveryAddress;
  updated_at: string;
}

export function CartClient({
  sendAction,
  saveAction,
  serverCart,
}: {
  sendAction: (formData: FormData) => Promise<never> | void;
  /** Bridge 22c-3 · debounced sync of {items, address} → nex_cart. */
  saveAction?: (
    formData: FormData,
  ) => Promise<
    { ok: true; updated_at: string } | { ok: false; error: string }
  >;
  /** Bridge 22c-3 · server-side snapshot passed from the page loader. */
  serverCart?: CartClientServerHydration;
}) {
  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState<NexCartItem[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { address: deliveryAddress } = useDeliveryAddress();
  const addressComplete = isDeliveryAddressComplete(deliveryAddress);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSync = useRef(true); // don't sync on hydration write

  // Debounced server sync · fires 500ms after the last local change.
  const scheduleSync = useCallback(
    (itemsToSync: NexCartItem[], addressToSync: NexDeliveryAddress) => {
      if (!saveAction) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const fd = new FormData();
        fd.set("items", JSON.stringify(itemsToSync));
        fd.set("delivery_address", JSON.stringify(addressToSync));
        void saveAction(fd).catch(() => {
          // Silent failure · client stays optimistic · next mutation
          // retries. The server is a mirror, not a source of truth
          // during a session.
        });
      }, 500);
    },
    [saveAction],
  );

  useEffect(() => {
    const localItems = readCart();
    const localAddressRaw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(NEX_DELIVERY_ADDRESS_STORAGE_KEY)
        : null;

    // Bridge 22c-3 · Merge server vs local on first mount.
    // Rule: if server has items and local doesn't, hydrate from server.
    // If both have items, prefer local (this device edited more recently).
    // For the address, use whichever side is populated · local wins ties.
    let seedItems = localItems;
    let seedAddress: NexDeliveryAddress | null = null;
    if (localAddressRaw) {
      try {
        seedAddress = {
          ...NEX_DELIVERY_ADDRESS_EMPTY,
          ...JSON.parse(localAddressRaw),
        };
      } catch {
        seedAddress = null;
      }
    }
    if (serverCart) {
      if (localItems.length === 0 && serverCart.items.length > 0) {
        seedItems = serverCart.items;
        writeCart(serverCart.items);
      }
      if (
        (!seedAddress || !isDeliveryAddressComplete(seedAddress)) &&
        isDeliveryAddressComplete(serverCart.delivery_address)
      ) {
        seedAddress = serverCart.delivery_address;
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            NEX_DELIVERY_ADDRESS_STORAGE_KEY,
            JSON.stringify(seedAddress),
          );
          window.dispatchEvent(new CustomEvent("nex-delivery-address-changed"));
        }
      }
    }
    setItems(seedItems);
    setHydrated(true);
    // Allow syncs from this point forward.
    skipNextSync.current = false;

    const onChange = () => setItems(readCart());
    window.addEventListener("nex-cart-changed", onChange);
    return () => window.removeEventListener("nex-cart-changed", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync items + address to server whenever they change post-hydration.
  useEffect(() => {
    if (!hydrated || skipNextSync.current) return;
    scheduleSync(items, deliveryAddress);
  }, [items, deliveryAddress, hydrated, scheduleSync]);

  const byShop = useMemo(() => {
    const map = new Map<string, NexCartItem[]>();
    for (const it of items) {
      const arr = map.get(it.shop_id) ?? [];
      arr.push(it);
      map.set(it.shop_id, arr);
    }
    return Array.from(map.entries());
  }, [items]);

  function setQty(key: string, delta: number) {
    setItems((prev) => {
      const next = prev
        .map((it) =>
          it.key === key
            ? { ...it, quantity: Math.max(0, it.quantity + delta) }
            : it,
        )
        .filter((it) => it.quantity > 0);
      writeCart(next);
      return next;
    });
  }

  function setItemNote(key: string, note: string) {
    setItems((prev) => {
      const next = prev.map((it) =>
        it.key === key ? { ...it, note } : it,
      );
      writeCart(next);
      return next;
    });
  }

  function removeItem(key: string) {
    setItems((prev) => {
      const next = prev.filter((it) => it.key !== key);
      writeCart(next);
      return next;
    });
  }

  function clearShop(shopId: string) {
    setItems((prev) => {
      const next = prev.filter((it) => it.shop_id !== shopId);
      writeCart(next);
      return next;
    });
  }

  if (!hydrated) return <CartSkeleton />;
  if (items.length === 0) return <CartEmpty />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DeliveryAddressForm />
      {byShop.map(([shopId, list]) => {
        const first = list[0]!;
        const subtotal = list.reduce(
          (n, it) => n + it.price_pence * it.quantity,
          0,
        );
        const itemCount = list.reduce((n, it) => n + it.quantity, 0);
        const currency = first.currency;
        const noteText = notes[shopId] ?? "";
        const payload: NexCartSendPayload = {
          peer_account_id: first.shop_owner_account_id,
          shop_id: shopId,
          shop_slug: first.shop_slug || null,
          shop_display_name: first.shop_display_name,
          currency,
          buyer_notes: noteText.trim() || null,
          delivery_address: addressComplete ? deliveryAddress : null,
          items: list.map((it) => ({
            kind: it.kind,
            id: it.id,
            name: it.name,
            price_pence: it.price_pence,
            currency: it.currency,
            quantity: it.quantity,
            variants: it.variants ?? [],
            perks: it.perks ?? [],
            perks_note: it.perks_note ?? null,
            note: it.note?.trim() || null,
            image_url: it.image_url,
          })),
        };

        return (
          <section
            key={shopId}
            style={{
              padding: "20px 20px",
              borderRadius: 18,
              background: NEX.panelSoft,
              border: `1px solid ${NEX.borderStrong}`,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {/* Shop header */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
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
                    color: NEX.cyan,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  <Link
                    href={`/nex-native/${first.shop_slug}`}
                    style={{ color: NEX.cyan, textDecoration: "none" }}
                  >
                    {first.shop_slug}.nex
                  </Link>
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {first.shop_display_name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => clearShop(shopId)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  background: "rgba(255,51,85,0.08)",
                  border: "1px solid rgba(255,51,85,0.30)",
                  color: NEX.red,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: SANS,
                }}
              >
                Clear
              </button>
            </div>

            {/* Items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {list.map((it) => (
                <CartRow
                  key={it.key}
                  item={it}
                  onInc={() => setQty(it.key, +1)}
                  onDec={() => setQty(it.key, -1)}
                  onRemove={() => removeItem(it.key)}
                  onNote={(n) => setItemNote(it.key, n)}
                />
              ))}
            </div>

            {/* Buyer note */}
            <div>
              <label
                style={{
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: NEX.textMute,
                  fontWeight: 700,
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Extra details for {first.shop_display_name} (optional)
              </label>
              <textarea
                value={noteText}
                onChange={(e) =>
                  setNotes((prev) => ({ ...prev, [shopId]: e.target.value }))
                }
                rows={3}
                maxLength={2000}
                placeholder="Delivery time · dietary requests · gift wrap · pickup vs delivery · anything the seller should know"
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
            </div>

            {/* Totals + Send */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(0,175,255,0.06)",
                border: `1px solid ${NEX.cyanSoft}`,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: NEX.cyan,
                    fontWeight: 700,
                  }}
                >
                  Subtotal · {itemCount} item{itemCount === 1 ? "" : "s"}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: NEX.orange,
                  }}
                >
                  {formatPrice(subtotal, currency)}
                </div>
              </div>
              <form
                action={sendAction}
                onSubmit={(e) => {
                  if (!addressComplete) {
                    e.preventDefault();
                    document
                      .querySelector<HTMLElement>("[data-nex-delivery-address]")
                      ?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                    return;
                  }
                  // Optimistically clear this shop's items so the
                  // buyer isn't shown the same cart twice · the peer
                  // chat already has the order.
                  setTimeout(() => clearShop(shopId), 200);
                }}
              >
                <input
                  type="hidden"
                  name="cart_payload"
                  value={JSON.stringify(payload)}
                />
                <button
                  type="submit"
                  disabled={!addressComplete}
                  style={{
                    padding: "12px 18px",
                    borderRadius: 12,
                    background: addressComplete
                      ? "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)"
                      : "rgba(139,169,209,0.12)",
                    border: `1px solid ${addressComplete ? NEX.orangeSoft : NEX.borderStrong}`,
                    color: addressComplete ? "#0B0F1A" : NEX.textMute,
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    cursor: addressComplete ? "pointer" : "not-allowed",
                    fontFamily: SANS,
                    boxShadow: addressComplete
                      ? "0 10px 24px rgba(255,114,0,0.35), inset 0 1px 0 rgba(255,255,255,0.28)"
                      : "none",
                  }}
                >
                  {addressComplete ? "Send order →" : "Add address first"}
                </button>
              </form>
            </div>
          </section>
        );
      })}

      {/* Safe-trade nudge */}
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 14,
          background: "rgba(22,214,107,0.08)",
          border: "1px solid rgba(22,214,107,0.35)",
          color: "#B8F1CC",
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        🛡 <b>Safe Trade reminder:</b> your order posts as a message
        in the seller&apos;s chat · they reply with a quote and
        payment method · you never pay before you receive unless
        it&apos;s COD or escrow. See{" "}
        <Link
          href="/nex-native/safe-trade"
          style={{ color: NEX.cyan, textDecoration: "none" }}
        >
          /safe-trade
        </Link>
        .
      </div>
    </div>
  );
}

function CartRow({
  item,
  onInc,
  onDec,
  onRemove,
  onNote,
}: {
  item: NexCartItem;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
  onNote: (n: string) => void;
}) {
  const lineTotal = item.price_pence * item.quantity;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "56px 1fr auto",
        gap: 12,
        alignItems: "flex-start",
        padding: "12px 14px",
        borderRadius: 12,
        background: "rgba(0,0,0,0.32)",
        border: `1px solid ${NEX.border}`,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 8,
          background: item.image_url
            ? `url(${item.image_url}) center/cover`
            : "rgba(139,169,209,0.08)",
          border: `1px solid ${NEX.border}`,
        }}
      />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "-0.003em",
            marginBottom: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={item.name}
        >
          {item.name}
        </div>
        {item.variants.length > 0 && (
          <div
            style={{
              fontSize: 11,
              color: NEX.textDim,
              marginBottom: 4,
            }}
          >
            {item.variants.join(" · ")}
          </div>
        )}
        {(item.perks ?? []).length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              marginBottom: 6,
            }}
          >
            {(item.perks ?? []).map((perk) => {
              const isFreeDelivery = perk === "free_delivery";
              const labelMap: Record<string, string> = {
                bogo: "🎁 BOGO",
                free_drink: "🥤 Free Drink",
                free_rice: "🍚 Free Rice",
                free_fries: "🍟 Free Fries",
                free_delivery: "🚚 Free Delivery",
                other: "✨ Perk",
              };
              const label =
                perk === "other" && item.perks_note
                  ? `✨ ${item.perks_note}`
                  : labelMap[perk] ?? perk;
              return (
                <span
                  key={perk}
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: isFreeDelivery
                      ? "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)"
                      : "rgba(22,214,107,0.12)",
                    color: isFreeDelivery ? "#08170D" : "#B8F1CC",
                    fontWeight: isFreeDelivery ? 800 : 700,
                    letterSpacing: "0.03em",
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        )}
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: NEX.orange,
            marginBottom: 6,
          }}
        >
          {formatPrice(lineTotal, item.currency)}
          {item.quantity > 1 && (
            <span
              style={{
                fontSize: 11,
                color: NEX.textMute,
                fontWeight: 600,
                marginLeft: 6,
              }}
            >
              · {item.quantity}× {formatPrice(item.price_pence, item.currency)}
            </span>
          )}
        </div>
        <input
          type="text"
          value={item.note ?? ""}
          onChange={(e) => onNote(e.target.value)}
          maxLength={400}
          placeholder="Note for this item (e.g. no onions · gift wrap · size 42)"
          style={{
            width: "100%",
            padding: "6px 10px",
            borderRadius: 8,
            background: "rgba(0,0,0,0.35)",
            border: `1px solid ${NEX.border}`,
            color: NEX.text,
            fontSize: 12,
            fontFamily: SANS,
            outline: "none",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 6,
        }}
      >
        <QtyStepper qty={item.quantity} onInc={onInc} onDec={onDec} />
        <button
          type="button"
          onClick={onRemove}
          style={{
            padding: "3px 8px",
            borderRadius: 999,
            background: "transparent",
            border: "1px solid rgba(255,51,85,0.25)",
            color: NEX.red,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: SANS,
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function QtyStepper({
  qty,
  onInc,
  onDec,
}: {
  qty: number;
  onInc: () => void;
  onDec: () => void;
}) {
  const btn: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 999,
    background: "rgba(0,0,0,0.35)",
    border: `1px solid ${NEX.borderStrong}`,
    color: NEX.text,
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1,
    cursor: "pointer",
    fontFamily: SANS,
  };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button type="button" onClick={onDec} style={btn} aria-label="Decrease">
        −
      </button>
      <span
        style={{
          minWidth: 20,
          textAlign: "center",
          fontSize: 13,
          fontWeight: 800,
        }}
      >
        {qty}
      </span>
      <button type="button" onClick={onInc} style={btn} aria-label="Increase">
        +
      </button>
    </div>
  );
}

function CartEmpty() {
  return (
    <div
      style={{
        padding: "36px 22px",
        borderRadius: 16,
        background: NEX.panelSoft,
        border: `1px dashed ${NEX.borderStrong}`,
        textAlign: "center",
        color: NEX.textDim,
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 8 }} aria-hidden>
        🛒
      </div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: NEX.textMute,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        Your cart is empty
      </div>
      <p style={{ margin: "0 0 18px" }}>
        Browse a NEX shop or a restaurant menu · tap Add to add items
        here.
      </p>
      <Link
        href="/nex-native/search"
        style={{
          display: "inline-block",
          padding: "10px 16px",
          borderRadius: 12,
          background: "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
          border: `1px solid ${NEX.orangeSoft}`,
          color: "#0B0F1A",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textDecoration: "none",
          boxShadow: "0 8px 20px rgba(255,114,0,0.35)",
          fontFamily: SANS,
        }}
      >
        Browse shops →
      </Link>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div
      style={{
        padding: "36px 22px",
        borderRadius: 16,
        background: NEX.panelSoft,
        border: `1px dashed ${NEX.border}`,
        color: NEX.textMute,
        fontSize: 13,
        textAlign: "center",
      }}
    >
      Loading your cart…
    </div>
  );
}
