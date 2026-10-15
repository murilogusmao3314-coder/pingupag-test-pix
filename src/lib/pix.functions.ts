import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  amount: z.number().int().min(100).max(10000000),
  description: z.string().min(1).max(200),
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  document: z.string().regex(/^\d{11,14}$/),
  phone: z.string().regex(/^\d{10,11}$/),
});

/**
 * The API key is used only in this server function.
 * The payment endpoint matches the PinguPag endpoint specified in the project README;
 * never forward credentials or personal data to an unrelated processor domain.
 */
const PINGUPAG_ENDPOINT = "https://app.pingupag.com/api/v1/transactions";

function getString(data: unknown, ...paths: string[][]): string {
  for (const path of paths) {
    let value: unknown = data;
    for (const part of path) {
      if (value && typeof value === "object" && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        value = undefined;
        break;
      }
    }
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

export const createPix = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["PINGUPAG_API_KEY"];
    if (!key) return { ok: false as const, error: "PINGUPAG_API_KEY não configurada no servidor." };

    try {
      const response = await fetch(PINGUPAG_ENDPOINT, {
        method: "POST",
        headers: {
          "X-API-Key": key,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(18000),
        body: JSON.stringify({
          amount: data.amount,
          description: data.description,
          reference: `QUIZ-${crypto.randomUUID()}`,
          source: "api_externa",
          customer: {
            name: data.name,
            email: data.email,
            document: data.document,
            phone: data.phone,
          },
        }),
      });

      const text = await response.text();
      let payload: unknown = null;
      try { payload = JSON.parse(text); } catch { /* HTML/non-JSON error */ }

      if (!response.ok) {
        // Avoid returning the provider's raw response or sensitive request details to clients.
        return { ok: false as const, error: `A API de pagamento retornou HTTP ${response.status}. Confira a configuração do gateway.` };
      }

      const qrCode = getString(payload,
        ["qr_code"], ["qrCode"], ["pix", "copyPaste"], ["pix", "qr_code"],
        ["data", "qr_code"], ["data", "pix", "copyPaste"], ["data", "pix", "qr_code"]);
      const qrImage = getString(payload,
        ["qr_code_base64"], ["qrCodeBase64"], ["pix", "qrCodeImage"],
        ["data", "qr_code_base64"], ["data", "pix", "qrCodeImage"]);

      if (!qrCode) {
        return { ok: false as const, error: "A API respondeu, mas não retornou um código Pix válido. Confira o formato de resposta da PinguPag." };
      }
      return { ok: true as const, qr_code: qrCode, qr_code_base64: qrImage };
    } catch (error) {
      const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      return { ok: false as const, error: timeout ? "A conexão com a PinguPag demorou demais. Tente novamente." : "Não foi possível conectar ao serviço de pagamento." };
    }
  });
