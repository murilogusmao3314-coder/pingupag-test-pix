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
    if (key) args.push({ eventID: options.persistent && name === "Purchase" ? options.key : options.persistent ? key : `${pageId}:${key}` });
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


/** GTM-style purchase event; queued even if Meta Pixel is unavailable or blocked. */
type TagWindow = Window & {
  dataLayer?: Record<string, unknown>[];
  TrackingParams?: {
    getParameters: () => URLSearchParams;
    getFirstTouch: () => Record<string, string | null>;
  };
};
const sentToTagManager = new Set<string>();
function attributionSnapshot(orderParameters?: [string, string][]) {
  const tracking = (window as TagWindow).TrackingParams;
  let params: URLSearchParams;
  try {
    params = orderParameters
      ? new URLSearchParams(orderParameters)
      : tracking?.getParameters() ?? new URLSearchParams(window.location.search);
  } catch {
    params = new URLSearchParams(window.location.search);
  }
  const values: Record<string, string | string[]> = Object.create(null);
  let count = 0;
  params.forEach((value, name) => {
    if (
      count >= 40 ||
      !/^[a-z0-9_.-]{1,80}$/i.test(name) ||
      /email|phone|telefone|celular|cpf|cnpj|document|name|nome|address|endereco|cep|zip|password|senha|secret|token|pix|key|auth|cartao|card|cvv/i.test(name) ||
      value.length > 500 ||
      /@/.test(value)
    ) return;
    const previous = values[name];
    if (previous === undefined) {
      values[name] = value;
      count++;
    } else if (Array.isArray(previous)) {
      previous.push(value);
    } else {
      values[name] = [previous, value];
    }
  });
  return {
    parameters: values,
    first_touch: tracking?.getFirstTouch?.() ?? null,
  };
}
function trackTagManagerPurchase(reference: string, amount: number, parameters?: [string, string][]) {
  if (sentToTagManager.has(reference)) return;
  const key = "purchase_datalayer:" + reference;
  try {
    if (window.localStorage.getItem(key)) return;
  } catch { /* In-memory fallback. */ }
  try {
    const win = window as TagWindow;
    if (!Array.isArray(win.dataLayer)) win.dataLayer = [];
    win.dataLayer.push({
      event: "purchase",
      event_id: reference,
      transaction_id: reference,
      ecommerce: { transaction_id: reference, value: amount / 100, currency: "BRL" },
      payment_method: "pix",
      attribution: attributionSnapshot(parameters),
    });
    sentToTagManager.add(reference);
    try { window.localStorage.setItem(key, "1"); }
    catch { /* In-memory fallback. */ }
  } catch {
    // Third-party analytics must never affect payment.
  }
}

export function trackPurchase(reference: string, amount: number, parameters?: [string, string][]) {
  trackMeta(
    "Purchase",
    { currency: "BRL", value: amount / 100, order_id: reference, payment_method: "pix" },
    { key: reference, persistent: true },
  );
  if (typeof window !== "undefined") trackTagManagerPurchase(reference, amount, parameters);
}
