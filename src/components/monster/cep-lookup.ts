import { addressSchema, digits } from "./checkout-schema";
export interface CepAddress {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}
export class CepLookupError extends Error {
  constructor(public code: "NOT_FOUND" | "UNAVAILABLE") {
    super(code);
  }
}
/** Public address lookup: only the eight CEP digits leave the browser. */
export async function lookupCep(cep: string, signal: AbortSignal): Promise<CepAddress> {
  if (!/^\d{8}$/.test(cep)) throw new CepLookupError("UNAVAILABLE");
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new CepLookupError("UNAVAILABLE");
  const raw: unknown = await response.json();
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new CepLookupError("UNAVAILABLE");
  const data = raw as Record<string, unknown>;
  if (data["erro"] === true || data["erro"] === "true") throw new CepLookupError("NOT_FOUND");
  if (typeof data["cep"] !== "string" || digits(data["cep"]) !== cep)
    throw new CepLookupError("UNAVAILABLE");
  const place = addressSchema
    .pick({ city: true, state: true })
    .safeParse({ city: data["localidade"], state: data["uf"] });
  const street = typeof data["logradouro"] === "string" ? data["logradouro"].trim() : "";
  const neighborhood = typeof data["bairro"] === "string" ? data["bairro"].trim() : "";
  if (!place.success || street.length > 150 || neighborhood.length > 100)
    throw new CepLookupError("UNAVAILABLE");
  return { street, neighborhood, city: place.data.city, state: place.data.state };
}
