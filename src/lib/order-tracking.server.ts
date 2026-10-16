import { queryPixGateway, gatewayHttpFailure } from "./pix-gateway.server";

const REFERENCE = /^QUIZ-([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/;
const CODE = /^MST-([0-9A-F]{32})-([0-9A-F]{24})$/;
const encoder = new TextEncoder();

async function mac(reference: string, secret: string): Promise<string> {
  const raw = await crypto.subtle.digest("SHA-256", encoder.encode("monster-order-tracking-v1:" + secret));
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(reference)));
  return Array.from(bytes.slice(0, 12), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Stateless, deterministic and unguessable bearer code. Never generated from client flags. */
export async function codeForPaidReference(reference: string, secret: string): Promise<string> {
  const match = REFERENCE.exec(reference);
  if (!match) throw new Error("Invalid gateway reference");
  return "MST-" + match.slice(1).join("").toUpperCase() + "-" + await mac(reference, secret);
}

export async function referenceFromCode(code: string, secret: string): Promise<string | null> {
  const match = CODE.exec(code);
  if (!match) return null;
  const encoded = match[1];
  const signed = match[2];
  if (!encoded || !signed) return null;
  const hex = encoded.toLowerCase();
  const reference = "QUIZ-" + [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
  const signature = await mac(reference, secret);
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) mismatch |= signature.charCodeAt(i) ^ signed.charCodeAt(i);
  return mismatch === 0 ? reference : null;
}

export function stageForApprovedAt(approvedAt: string | null, now: number = Date.now()): number {
  if (!approvedAt) return 1;
  const date = Date.parse(approvedAt);
  if (!Number.isFinite(date) || date > now) return 1;
  return Math.min(6, Math.floor((now - date) / 86400000) + 1);
}

type Transaction = Record<string, unknown>;
function str(value: unknown, max = 160): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}
function record(value: unknown): Transaction {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Transaction : {};
}
function safeAddress(tx: Transaction) {
  const customer = record(tx["customer"]);
  const shipping = record(tx["shipping"]);
  const address = [tx["address"], tx["delivery_address"], tx["shipping_address"], customer["address"], shipping["address"]]
    .map(record).find((item) => Object.keys(item).length) ?? {};
  const zip = str(address["zipcode"] ?? address["zip_code"] ?? address["cep"], 16);
  const result = {
    street: str(address["street"] ?? address["logradouro"]),
    number: str(address["number"] ?? address["numero"], 25),
    complement: str(address["complement"] ?? address["complemento"]),
    neighborhood: str(address["neighborhood"] ?? address["bairro"]),
    city: str(address["city"] ?? address["cidade"]),
    state: str(address["state"] ?? address["uf"], 30),
    zipcode: zip && /^\d{5}-?\d{3}$/.test(zip) ? zip.replace(/\D/g, "") : undefined,
  };
  return Object.values(result).some(Boolean) ? result : null;
}

function paidTimestamp(tx: Transaction): string | null {
  const payment = record(tx["payment"]);
  // Only timestamps explicitly referring to payment approval are acceptable.
  const candidates = [
    tx["approved_at"], tx["approvedAt"], tx["paid_at"], tx["paidAt"],
    tx["payment_date"], tx["date_approved"], tx["approvedDate"],
    payment["approved_at"], payment["paid_at"],
  ];
  for (const raw of candidates) {
    if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}[T ]/.test(raw)) continue;
    const value = raw.includes(" ") ? raw.replace(" ", "T") : raw;
    // Gateway timestamps without timezone are ambiguous: do not guess the timezone.
    if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) continue;
    const date = Date.parse(value);
    if (Number.isFinite(date) && date <= Date.now()) return new Date(date).toISOString();
  }
  return null;
}

export type TrackingResult =
  | { ok: false; code: "INVALID_CODE" | "NOT_FOUND" | "UNAVAILABLE" }
  | { ok: true; status: "pending" | "approved" | "ended"; trackingCode: string;
      product: string; address: ReturnType<typeof safeAddress>; stage: number;
      timelineAvailable: boolean; };

export async function lookupOrderTracking(code: string, secret: string): Promise<TrackingResult> {
  const reference = await referenceFromCode(code, secret);
  if (!reference) return { ok: false, code: "INVALID_CODE" };
  try {
    const response = await queryPixGateway(reference, secret);
    const payload: unknown = await response.json();
    if (gatewayHttpFailure(response, payload)) return { ok: false, code: "UNAVAILABLE" };
    if (!Array.isArray(payload)) return { ok: false, code: "UNAVAILABLE" };
    const tx = payload.find((value: unknown) => {
      const item = record(value);
      return item["external_id"] === reference &&
        typeof item["amount"] === "number" && Number.isInteger(item["amount"]) && item["amount"] >= 100;
    });
    if (!tx) return { ok: false, code: "NOT_FOUND" };
    const item = record(tx);
    const status = item["status"] === "approved" ? "approved"
      : item["status"] === "failed" || item["status"] === "refunded" || item["status"] === "chargeback" ? "ended"
      : "pending";
    const timestamp = status === "approved" ? paidTimestamp(item) : null;
    return {
      ok: true,
      status,
      trackingCode: code,
      product: str(item["description"] ?? item["product_name"], 180) ?? "Pedido Monster",
      address: safeAddress(item),
      stage: status === "approved" ? stageForApprovedAt(timestamp) : 1,
      timelineAvailable: timestamp !== null,
    };
  } catch {
    return { ok: false, code: "UNAVAILABLE" };
  }
}
