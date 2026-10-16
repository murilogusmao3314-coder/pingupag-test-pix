/** Only opaque, short-lived receipts are stored; no plaintext customer details. */
const OFFER_KEY = "monster_upsell_offer_v1";
const DISMISSED_KEY = "monster_upsell_dismissed_v1";
const UPSELL_PAYMENT_KEY = "monster_upsell_pix_v1";
const TTL = 24 * 60 * 60 * 1000;
const PAYMENT_TTL = 30 * 60 * 1000;
const referencePattern = /^QUIZ-[0-9a-f-]{36}$/;

export interface UpsellOffer {
  parentReference: string;
  parentToken: string;
  createdAt: number;
}
export interface UpsellPayment {
  qr_code: string;
  qr_code_base64: string;
  tracking_token: string;
  order_reference: string;
  createdAt: number;
}
function readJson<T>(storage: Storage, key: string): T | null {
  try { return JSON.parse(storage.getItem(key) || "null") as T; }
  catch { return null; }
}
export function readUpsellOffer(): UpsellOffer | null {
  if (typeof window === "undefined") return null;
  try {
    const offer = readJson<UpsellOffer>(localStorage, OFFER_KEY);
    if (
      !offer ||
      !referencePattern.test(offer.parentReference) ||
      typeof offer.parentToken !== "string" ||
      offer.parentToken.length < 10 ||
      offer.parentToken.length > 8192 ||
      !Number.isFinite(offer.createdAt) ||
      Date.now() - offer.createdAt > TTL ||
      offer.createdAt > Date.now() ||
      localStorage.getItem(DISMISSED_KEY) === offer.parentReference
    ) return null;
    return offer;
  } catch { return null; }
}
export function rememberUpsellOffer(parentToken: string, parentReference: string) {
  if (
    !referencePattern.test(parentReference) ||
    parentToken.length < 10 ||
    parentToken.length > 8192
  ) return false;
  try {
    if (localStorage.getItem(DISMISSED_KEY) === parentReference) return false;
    localStorage.setItem(OFFER_KEY, JSON.stringify({
      parentToken,
      parentReference,
      createdAt: Date.now(),
    } satisfies UpsellOffer));
    return true;
  } catch { return false; }
}
export function dismissUpsellOffer(reference: string) {
  if (!referencePattern.test(reference)) return;
  try {
    localStorage.setItem(DISMISSED_KEY, reference);
    localStorage.removeItem(OFFER_KEY);
  } catch { /* Storage unavailable. */ }
}
export function readUpsellPayment(): UpsellPayment | null {
  if (typeof window === "undefined") return null;
  try {
    const payment = readJson<UpsellPayment>(sessionStorage, UPSELL_PAYMENT_KEY);
    if (!payment ||
      !referencePattern.test(payment.order_reference) ||
      typeof payment.tracking_token !== "string" ||
      payment.tracking_token.length < 10 ||
      payment.tracking_token.length > 8192 ||
      typeof payment.qr_code !== "string" ||
      payment.qr_code.length > 2000 ||
      typeof payment.qr_code_base64 !== "string" ||
      payment.qr_code_base64.length > 100000 ||
      !Number.isFinite(payment.createdAt) ||
      Date.now() - payment.createdAt > PAYMENT_TTL
    ) return null;
    return payment;
  } catch { return null; }
}
export function rememberUpsellPayment(payment: Omit<UpsellPayment, "createdAt">) {
  try {
    sessionStorage.setItem(UPSELL_PAYMENT_KEY, JSON.stringify({
      ...payment,
      createdAt: Date.now(),
    }));
  } catch { /* The Pix on screen remains usable without storage. */ }
}
export function forgetUpsellPayment() {
  try { sessionStorage.removeItem(UPSELL_PAYMENT_KEY); }
  catch { /* Best effort. */ }
}
