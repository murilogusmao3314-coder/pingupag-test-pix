/** Only a short-lived, read-only status capability is stored; never customer data or Pix codes. */
export interface PendingPix {
  reference: string;
  token: string;
  createdAt: number;
}

const KEY = "monster_pending_pix_v1";
const LIFETIME = 24 * 60 * 60 * 1000;
const MAX_PENDING = 10;
const isReference = (value: unknown): value is string =>
  typeof value === "string" && /^QUIZ-[0-9a-f-]{36}$/.test(value);

export function readPendingPix(now = Date.now()): PendingPix[] {
  if (typeof window === "undefined") return [];
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((entry): entry is PendingPix =>
      entry !== null &&
      typeof entry === "object" &&
      isReference(entry.reference) &&
      typeof entry.token === "string" &&
      entry.token.length > 10 &&
      entry.token.length <= 8192 &&
      typeof entry.createdAt === "number" &&
      Number.isFinite(entry.createdAt) &&
      entry.createdAt <= now &&
      entry.createdAt > now - LIFETIME,
    ).slice(-MAX_PENDING);
  } catch {
    return [];
  }
}

export function rememberPendingPix(token?: string, reference?: string) {
  if (!isReference(reference) || !token || token.length > 8192) return;
  try {
    const prior = readPendingPix().filter((entry) => entry.reference !== reference);
    window.localStorage.setItem(
      KEY,
      JSON.stringify([...prior, { token, reference, createdAt: Date.now() }].slice(-MAX_PENDING)),
    );
  } catch {
    // Storage blocking must never prevent checkout.
  }
}

export function forgetPendingPix(reference: string) {
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(readPendingPix().filter((entry) => entry.reference !== reference)),
    );
  } catch {
    // Best effort only.
  }
}
