/** Opaque signed access capabilities only; never store addresses or personal data. */
const KEY = "monster_tracking_codes_v2";
const LEGACY_KEY = "monster_tracking_codes_v1";
const FULL = /^MST-[0-9A-F]{32}-[0-9A-F]{24}$/;
const SHORT = /^CR[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/;
interface SavedCode { access: string; short?: string }
function readCodes(): SavedCode[] {
  if (typeof window === "undefined") return [];
  try {
    const current: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    const legacy: unknown = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "[]");
    const entries: unknown[] = [...(Array.isArray(current) ? current : []),
      ...(Array.isArray(legacy) ? legacy.map((code) => ({ access: code })) : [])];
    const seen = new Set<string>();
    return entries.filter((entry): entry is SavedCode =>
      typeof entry === "object" && entry !== null &&
      "access" in entry && typeof entry.access === "string" &&
      FULL.test(entry.access) && (!("short" in entry) || entry.short === undefined ||
        (typeof entry.short === "string" && SHORT.test(entry.short))))
      .filter((entry) => { if (seen.has(entry.access)) return false; seen.add(entry.access); return true; })
      .slice(0, 20);
  } catch { return []; }
}
export function recentTrackingCodes(): string[] { return readCodes().map(({ access }) => access); }
export function resolveSavedTrackingCode(code: string): string {
  return readCodes().find((entry) => entry.short === code)?.access ?? code;
}
export function rememberTrackingCode(access: string, short?: string) {
  if (!FULL.test(access) || (short !== undefined && !SHORT.test(short)) || typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify([{ access, ...(short ? { short } : {}) },
      ...readCodes().filter((c) => c.access !== access)].slice(0, 20)));
  } catch { /* Persisting a capability is best-effort, never a payment condition. */ }
}
