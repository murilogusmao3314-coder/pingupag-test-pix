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

/** A bounded copy of URL click parameters, including arbitrary keys and duplicates.
 * Excludes values likely to contain personal data or credentials before analytics use.
 * All seven official UTMify fields remain separate, because its API has a fixed schema.
 */
export type TrackingPair = [string, string];

export function getCheckoutAttribution(): {
  trackingParameters: UtmifyTracking;
  parameters: TrackingPair[];
} {
  const trackingParameters = Object.fromEntries(
    utmifyKeys.map((key) => [key, null]),
  ) as UtmifyTracking;
  if (typeof window === "undefined") return { trackingParameters, parameters: [] };
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
    trackingParameters[key] = value !== null && value.length <= 500 ? value : null;
  }
  const parameters: TrackingPair[] = [];
  let totalSize = 0;
  for (const [name, value] of params) {
    if (
      parameters.length >= 64 ||
      !/^[a-z0-9_.-]{1,80}$/i.test(name) ||
      /email|phone|telefone|celular|cpf|cnpj|document|name|nome|address|endereco|cep|zip|password|senha|secret|token|pix|key|auth|cartao|card|cvv/i.test(name) ||
      value.length > 500 ||
      /@/.test(value)
    ) continue;
    if (totalSize + name.length + value.length > 2600) continue;
    parameters.push([name, value]);
    totalSize += name.length + value.length;
  }
  return { trackingParameters, parameters };
}

export function getCheckoutTracking(): UtmifyTracking {
  return getCheckoutAttribution().trackingParameters;
}
