/** Whitelisted UTMify API fields; the generic TrackingParams helper retains other URL keys. */
export const utmifyKeys = [
  "src",
  "sck",
  "utm_source",
  "utm_campaign",
  "utm_medium",
  "utm_content",
  "utm_term",
] as const;

export type UtmifyTracking = Record<(typeof utmifyKeys)[number], string | null>;

type TrackingWindow = Window & {
  TrackingParams?: { getParameters: () => URLSearchParams };
};

export function getCheckoutTracking(): UtmifyTracking {
  const empty = Object.fromEntries(utmifyKeys.map((key) => [key, null])) as UtmifyTracking;
  if (typeof window === "undefined") return empty;
  let params: URLSearchParams;
  try {
    params =
      (window as TrackingWindow).TrackingParams?.getParameters() ??
      new URLSearchParams(window.location.search);
  } catch {
    params = new URLSearchParams(window.location.search);
  }
  for (const key of utmifyKeys) {
    const value = params.get(key);
    empty[key] = value !== null && value.length <= 500 ? value : null;
  }
  return empty;
}
