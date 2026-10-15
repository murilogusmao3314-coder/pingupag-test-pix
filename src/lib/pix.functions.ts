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

export const createPix = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env["PINGUPAG_API_KEY"];
    if (!key) return { ok: false as const, error: "PINGUPAG_API_KEY não configurada" };
    try {
      const res = await fetch("https://app.pingupag.com/api/v1/transactions", {
        method: "POST",
        headers: { "X-API-Key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: data.amount,
          description: data.description,
          reference: `TESTE-${Date.now()}`,
          source: "api_externa",
          customer: { name: data.name, email: data.email, document: data.document, phone: data.phone },
        }),
      });
      const text = await res.text();
      let json: Record<string, unknown> = {};
      try { json = JSON.parse(text); } catch { /* non-JSON */ }
      if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
      return {
        ok: true as const,
        qr_code: String(json["qr_code"] ?? ""),
        qr_code_base64: String(json["qr_code_base64"] ?? ""),
        raw: text.slice(0, 2000),
      };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Erro de rede" };
    }
  });
