import { z } from "zod";
import { utmifyKeys } from "./utmify-tracking";

export const utmifyTrackingSchema = z.object(
  Object.fromEntries(utmifyKeys.map((key) => [key, z.string().max(500).nullable()])) as
    Record<(typeof utmifyKeys)[number], z.ZodNullable<z.ZodString>>,
).strict();

/** Additional click parameters are kept in the signed order receipt; UTMify's
 * order API receives only its seven documented tracking fields.
 */
export const trackingPairsSchema = z.array(z.tuple([
  z.string().regex(/^[a-z0-9_.-]{1,80}$/i).refine(
    (name) => !/email|phone|telefone|celular|cpf|cnpj|document|name|nome|address|endereco|cep|zip|password|senha|secret|token|pix|key|auth|cartao|card|cvv/i.test(name),
  ),
  z.string().max(500).refine((value) => !/@/.test(value)),
])).max(64).refine(
  (pairs) => pairs.reduce((total, [name, value]) => total + name.length + value.length, 0) <= 2600,
);

export const utmifyOrderContextSchema = z.object({
  createdAt: z.string().datetime(),
  customer: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().max(200),
    phone: z.string().regex(/^\d{10,11}$/),
    document: z.string().regex(/^\d{11,14}$/),
  }).strict(),
  trackingParameters: utmifyTrackingSchema,
  parameters: trackingPairsSchema.optional(),
  address: z.object({
    street: z.string().min(1).max(150),
    number: z.string().min(1).max(20),
    complement: z.string().max(100).optional(),
    neighborhood: z.string().min(1).max(100),
    city: z.string().min(1).max(100),
    state: z.string().regex(/^[A-Z]{2}$/),
    zipcode: z.string().regex(/^\d{8}$/),
  }).strict().optional(),
}).strict();

export type UtmifyOrderContext = z.infer<typeof utmifyOrderContextSchema>;

export function utcDateTime(date: string) {
  return new Date(date).toISOString().slice(0, 19).replace("T", " ");
}

/** Dedupe repeated gateway status polling in this server instance. The same order ID
 * must be reused for pending and approved updates. Cross-instance retries still rely on
 * Utmify's orderId upsert contract; this cache is deliberately not a database.
 */
const delivered = new Map<string, { until: number; result: Promise<boolean> }>();
const DELIVERY_TTL = 24 * 60 * 60 * 1000;
function pruneDeliveries(now: number) {
  for (const [key, entry] of delivered) {
    if (entry.until <= now) delivered.delete(key);
  }
  while (delivered.size > 512) {
    const oldest = delivered.keys().next().value;
    if (oldest === undefined) break;
    delivered.delete(oldest);
  }
}

/** Send full order status from the server only; no API credential is exposed to the browser. */
export async function sendUtmifyOrder(
  reference: string,
  amount: number,
  context: UtmifyOrderContext,
  status: "waiting_payment" | "paid" | "refused" | "refunded" | "chargedback",
  product: { id: string; name: string } = {
    id: "monster-cup-1150-order",
    name: "Pedido Monster 1,15L (envio e adicionais)",
  },
): Promise<boolean> {
  const token = process.env["UTMIFY_API_TOKEN"]?.trim();
  if (!token || /[\r\n]/.test(token)) return false;
  const now = new Date().toISOString();
  const body = {
    orderId: reference,
    platform: "PinguPag",
    paymentMethod: "pix",
    status,
    createdAt: utcDateTime(context.createdAt),
    approvedDate: status === "paid" ? utcDateTime(now) : null,
    refundedAt: status === "refunded" ? utcDateTime(now) : null,
    customer: { ...context.customer, country: "BR" },
    products: [{
      id: product.id,
      name: product.name,
      planId: null,
      planName: null,
      quantity: 1,
      priceInCents: amount,
    }],
    trackingParameters: context.trackingParameters,
    commission: {
      totalPriceInCents: amount,
      gatewayFeeInCents: 0,
      userCommissionInCents: amount,
      currency: "BRL",
    },
  };
  const cacheKey = reference + ":" + status;
  const nowMs = Date.now();
  pruneDeliveries(nowMs);
  const cached = delivered.get(cacheKey);
  if (cached && cached.until > nowMs) return cached.result;
  const result = (async () => {
    try {
      const response = await fetch("https://api.utmify.com.br/api-credentials/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-token": token },
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) console.warn("[utmify] Order status not accepted:", response.status);
      return response.ok;
    } catch {
      console.warn("[utmify] Order status could not be delivered");
      return false;
    }
  })();
  delivered.set(cacheKey, { until: nowMs + DELIVERY_TTL, result });
  if (!(await result) && delivered.get(cacheKey)?.result === result) delivered.delete(cacheKey);
  return result;
}
