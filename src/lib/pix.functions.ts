import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  requestPixGateway,
  queryPixGateway,
  gatewayNetworkFailure,
  gatewayHttpFailure,
} from "./pix-gateway.server";

import { signPixReceipt, verifyPixReceipt, verifiedPixStatus } from "./pix-receipt.server";

const schema = z.object({
  amount: z.number().int().min(100).max(10000000),
  description: z.string().min(1).max(200),
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  document: z.string().regex(/^\d{11,14}$/),
  phone: z.string().regex(/^\d{10,11}$/),
  address: z
    .object({
      street: z.string().trim().min(1).max(150),
      number: z.string().trim().min(1).max(20),
      complement: z.string().trim().max(100).optional(),
      neighborhood: z.string().trim().min(1).max(100),
      city: z.string().trim().min(1).max(100),
      state: z.string().regex(/^[A-Z]{2}$/),
      zipcode: z.string().regex(/^\d{8}$/),
    })
    .optional(),
});

/**
 * The API key is used only in this server function.
 * The gateway URL is the fixed endpoint explicitly selected for this project.
 * Redirects are limited to the documented HTTPS gateway; no automatic POST retries.
 */

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
    const key = process.env["PINGUPAG_API_KEY"]?.trim();
    if (!key) return { ok: false as const, error: "PINGUPAG_API_KEY não configurada no servidor." };
    if (/[\r\n]/.test(key))
      return {
        ok: false as const,
        error: "PINGUPAG_API_KEY contém uma quebra de linha inválida. Confira o valor no servidor.",
      };

    try {
      const reference = `QUIZ-${crypto.randomUUID()}`;
      // Analytics availability must not prevent a customer from generating a Pix.
      const trackingToken = await signPixReceipt(reference, data.amount, key).catch(() => null);
      const response = await requestPixGateway(
        JSON.stringify({
          amount: data.amount,
          description: data.description,
          reference,
          source: "api_externa",
          customer: {
            name: data.name,
            email: data.email,
            document: data.document,
            phone: data.phone,
          },
          ...(data.address ? { address: data.address } : {}),
        }),
        key,
      );

      const text = await response.text();
      let payload: unknown = null;
      try {
        payload = JSON.parse(text);
      } catch {
        /* HTML/non-JSON error */
      }

      const failure = gatewayHttpFailure(response, payload);
      if (failure) {
        console.error("[pix-gateway]", { code: failure.code, status: response.status });
        return { ok: false as const, ...failure };
      }

      const qrCode = getString(
        payload,
        ["qr_code"],
        ["qrCode"],
        ["pix", "copyPaste"],
        ["pix", "qr_code"],
        ["data", "qr_code"],
        ["data", "pix", "copyPaste"],
        ["data", "pix", "qr_code"],
      );
      const qrImage = getString(
        payload,
        ["qr_code_base64"],
        ["qrCodeBase64"],
        ["pix", "qrCodeImage"],
        ["data", "qr_code_base64"],
        ["data", "pix", "qrCodeImage"],
      );

      if (!qrCode) {
        return {
          ok: false as const,
          error:
            "A API respondeu, mas não retornou um código Pix válido. Confira o formato de resposta do gateway.",
        };
      }
      return {
        ok: true as const,
        qr_code: qrCode,
        qr_code_base64: qrImage,
        ...(trackingToken ? { tracking_token: trackingToken } : {}),
        order_reference: reference,
      };
    } catch (error) {
      const failure = gatewayNetworkFailure(error);
      console.error("[pix-gateway]", { code: failure.code });
      return { ok: false as const, ...failure };
    }
  });

/** Never trusts a browser-supplied paid flag, amount, or arbitrary order ID. */
export const checkPixPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(1).max(2000) }).parse(input))
  .handler(async ({ data }) => {
    const key = process.env["PINGUPAG_API_KEY"]?.trim();
    if (!key || /[\r\n]/.test(key)) return { ok: false as const, code: "STATUS_UNAVAILABLE" };
    const receipt = await verifyPixReceipt(data.token, key);
    if (!receipt) return { ok: false as const, code: "RECEIPT_EXPIRED" };
    try {
      const response = await queryPixGateway(receipt.reference, key);
      const payload: unknown = await response.json();
      if (gatewayHttpFailure(response, payload))
        return { ok: false as const, code: "STATUS_UNAVAILABLE" };
      return {
        ok: true as const,
        status: verifiedPixStatus(payload, receipt),
        reference: receipt.reference,
        amount: receipt.amount,
      };
    } catch {
      return { ok: false as const, code: "STATUS_UNAVAILABLE" };
    }
  });
