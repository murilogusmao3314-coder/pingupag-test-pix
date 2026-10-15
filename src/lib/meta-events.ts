/** All event payloads are assembled explicitly; never pass form values or Pix codes. */
type MetaValue =
  string | number | boolean | string[] | { id: string; quantity: number; item_price: number }[];
type MetaParams = Record<string, MetaValue>;
type MetaWindow = Window & { fbq?: (...args: unknown[]) => void };
const sent = new Set<string>();
const pageId =
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const PRODUCT = "monster-cup-1150";

export function trackMeta(
  name: string,
  params: MetaParams = {},
  options: { custom?: boolean; key?: string; persistent?: boolean } = {},
) {
  if (typeof window === "undefined") return;
  const fbq = (window as MetaWindow).fbq;
  if (typeof fbq !== "function") return;
  const key = options.key ? `${name}:${options.key}` : null;
  if (key && sent.has(key)) return;
  if (key && options.persistent) {
    try {
      if (window.localStorage.getItem(`meta_event:${key}`)) return;
    } catch {
      /* In-memory fallback. */
    }
  }
  try {
    const args: unknown[] = [options.custom ? "trackCustom" : "track", name, params];
    if (key) args.push({ eventID: options.persistent ? key : `${pageId}:${key}` });
    fbq(...args);
    if (key) sent.add(key);
    if (key && options.persistent) {
      try {
        window.localStorage.setItem(`meta_event:${key}`, "1");
      } catch {
        /* Never block checkout. */
      }
    }
  } catch {
    /* Analytics must never interrupt the funnel. */
  }
}

export function orderMeta(amount: number, cup = false, pack = false): MetaParams {
  const contents = [{ id: PRODUCT, quantity: 1, item_price: 0 }];
  if (cup) contents.push({ id: "monster-extra-cup", quantity: 1, item_price: 19.9 });
  if (pack) contents.push({ id: "monster-pack-6", quantity: 1, item_price: 9.9 });
  return {
    currency: "BRL",
    value: amount / 100,
    content_type: "product",
    content_ids: contents.map((item) => item.id),
    contents,
    num_items: contents.reduce((sum, item) => sum + item.quantity, 0),
    content_name: "Copo Monster 1,15L",
  };
}

export function trackPurchase(reference: string, amount: number) {
  trackMeta(
    "Purchase",
    { currency: "BRL", value: amount / 100, order_id: reference, payment_method: "pix" },
    { key: reference, persistent: true },
  );
}
