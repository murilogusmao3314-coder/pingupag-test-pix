/** Store only the public, per-order tracking code; never store addresses or gateway keys. */
const KEY = "monster_tracking_codes_v1";
const PATTERN = /^MST-[0-9A-F]{32}-[0-9A-F]{24}$/;
export function recentTrackingCodes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((s): s is string =>
      typeof s === "string" && PATTERN.test(s)).slice(0, 20) : [];
  } catch { return []; }
}
export function rememberTrackingCode(code: string) {
  if (!PATTERN.test(code) || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify([code, ...recentTrackingCodes().filter((c) => c !== code)].slice(0, 20)));
  } catch { /* A blocked storage setting must not affect payment status. */ }
}
