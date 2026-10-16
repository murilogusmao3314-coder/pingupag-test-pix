import { utmifyOrderContextSchema, type UtmifyOrderContext } from "./utmify-orders.server";

const encoder = new TextEncoder();
function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unbase64Url(value: string): Uint8Array {
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
}
async function encryptionKey(secret: string): Promise<CryptoKey> {
  const keyBytes = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode("monster-utmify-order-v1:" + secret),
  );
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Keeps customer and attribution details encrypted inside the existing signed Pix receipt.
 * The browser can store and return this opaque token, but cannot read or alter its contents.
 */
export async function sealUtmifyContext(context: UtmifyOrderContext, secret: string): Promise<string> {
  const validated = utmifyOrderContextSchema.parse(context);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(secret),
    encoder.encode(JSON.stringify(validated)),
  );
  return base64Url(iv) + "." + base64Url(new Uint8Array(encrypted));
}

export async function openUtmifyContext(
  envelope: string,
  secret: string,
): Promise<UtmifyOrderContext | null> {
  try {
    const [rawIv, rawData, extra] = envelope.split(".");
    if (!rawIv || !rawData || extra !== undefined || envelope.length > 6000) return null;
    const iv = unbase64Url(rawIv);
    if (iv.length !== 12) return null;
    const decoded = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await encryptionKey(secret),
      unbase64Url(rawData),
    );
    return utmifyOrderContextSchema.parse(JSON.parse(new TextDecoder().decode(decoded)));
  } catch {
    return null;
  }
}
