import { z } from "zod";

const receiptSchema = z.object({
  reference: z.string().regex(/^QUIZ-[0-9a-f-]{36}$/),
  amount: z.number().int().min(100).max(10000000),
  expiresAt: z.number().int().positive(),
  utmifyEnvelope: z.string().max(6000).optional(),
});
export type PixReceipt = z.infer<typeof receiptSchema>;
const encoder = new TextEncoder();
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const decode = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function signingKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Signed capability: allows reading only this new order, with no customer data. */
export async function signPixReceipt(reference: string, amount: number, secret: string, utmifyEnvelope?: string) {
  const receipt = receiptSchema.parse({
    reference,
    amount,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    ...(utmifyEnvelope ? { utmifyEnvelope } : {}),
  });
  const data = encode(encoder.encode(JSON.stringify(receipt)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    encoder.encode(data),
  );
  return `${data}.${encode(new Uint8Array(signature))}`;
}
export async function verifyPixReceipt(token: string, secret: string): Promise<PixReceipt | null> {
  try {
    const [data, signature, extra] = token.split(".");
    if (!data || !signature || extra !== undefined) return null;
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        await signingKey(secret),
        decode(signature),
        encoder.encode(data),
      ))
    )
      return null;
    const receipt = receiptSchema.parse(JSON.parse(new TextDecoder().decode(decode(data))));
    return receipt.expiresAt > Date.now() ? receipt : null;
  } catch {
    return null;
  }
}

export function verifiedPixStatus(
  payload: unknown,
  receipt: PixReceipt,
): "approved" | "pending" | "failed" | "refunded" | "chargeback" {
  if (!Array.isArray(payload)) return "pending";
  const transaction = payload.find(
    (entry: unknown) =>
      entry &&
      typeof entry === "object" &&
      (entry as Record<string, unknown>)["external_id"] === receipt.reference &&
      (entry as Record<string, unknown>)["amount"] === receipt.amount,
  );
  if (!transaction) return "pending";
  const status: unknown = transaction.status;
  return status === "approved" ||
    status === "failed" ||
    status === "refunded" ||
    status === "chargeback"
    ? status
    : "pending";
}
