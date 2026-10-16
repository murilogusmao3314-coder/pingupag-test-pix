import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  requestPixGateway,
  queryPixGateway,
  gatewayHttpFailure,
  gatewayNetworkFailure,
} from "./pix-gateway.server";
import { verifyPixReceipt, verifiedPixStatus, signPixReceipt } from "./pix-receipt.server";
import { openUtmifyContext, sealUtmifyContext } from "./utmify-envelope.server";
import { sendUtmifyOrder } from "./utmify-orders.server";

export const UPSELL_AMOUNT = 3990;
export const UPSELL_PRODUCT = {
  id: "kit-pulseiras-fones-tematicos",
  name: "Kit 4 pulseiras + fones Bluetooth com estojo temático",
} as const;

/** Re-verify the original paid Pix before creating a separate optional charge.
 * The browser sends only the original signed receipt, never buyer details or an amount.
 */
export const createUpsellPix = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ parentToken: z.string().min(10).max(8192) }).strict().parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env["PINGUPAG_API_KEY"]?.trim();
    if (!key || /[\r\n]/.test(key))
      return { ok: false as const, error: "Pagamento indisponível no momento." };

    const parent = await verifyPixReceipt(data.parentToken, key);
    if (!parent || parent.kind === "upsell" || !parent.utmifyEnvelope)
      return { ok: false as const, error: "Esta oferta requer uma compra anterior confirmada." };

    const context = await openUtmifyContext(parent.utmifyEnvelope, key);
    if (!context?.address)
      return {
        ok: false as const,
        error: "O endereço do pedido anterior não está disponível. Entre em contato com o suporte.",
      };

    try {
      const query = await queryPixGateway(parent.reference, key);
      const statusData: unknown = await query.json();
      if (gatewayHttpFailure(query, statusData) ||
          verifiedPixStatus(statusData, parent) !== "approved")
        return { ok: false as const, error: "A compra inicial ainda não foi confirmada." };

      const reference = `QUIZ-${crypto.randomUUID()}`;
      const upsellContext = { ...context, createdAt: new Date().toISOString() };
      // A tracking receipt must exist before sending the second charge.
      const envelope = await sealUtmifyContext(upsellContext, key);
      const trackingToken = await signPixReceipt(
        reference,
        UPSELL_AMOUNT,
        key,
        envelope,
        "upsell",
      );

      const response = await requestPixGateway(
        JSON.stringify({
          amount: UPSELL_AMOUNT,
          description: UPSELL_PRODUCT.name,
          reference,
          source: "api_externa",
          customer: context.customer,
          address: context.address,
        }),
        key,
      );
      const body: unknown = await response.json().catch(() => null);
      const failure = gatewayHttpFailure(response, body);
      if (failure) return { ok: false as const, error: failure.error };
      const payload = (body && typeof body === "object" ? body : {}) as Record<string, any>;
      const qrCode = [
        payload.qr_code,
        payload.qrCode,
        payload.pix?.copyPaste,
        payload.pix?.qr_code,
        payload.data?.qr_code,
        payload.data?.pix?.copyPaste,
        payload.data?.pix?.qr_code,
      ].find((value): value is string => typeof value === "string" && value.length > 0);
      const qrImage = [
        payload.qr_code_base64,
        payload.qrCodeBase64,
        payload.pix?.qrCodeImage,
        payload.data?.qr_code_base64,
        payload.data?.pix?.qrCodeImage,
      ].find((value): value is string => typeof value === "string" && value.length > 0) ?? "";
      if (!qrCode) return {
        ok: false as const,
        error: "O gateway não retornou um código Pix válido. Consulte a cobrança antes de tentar novamente.",
      };

      await sendUtmifyOrder(
        reference,
        UPSELL_AMOUNT,
        upsellContext,
        "waiting_payment",
        UPSELL_PRODUCT,
      );
      return {
        ok: true as const,
        qr_code: qrCode,
        qr_code_base64: qrImage,
        order_reference: reference,
        tracking_token: trackingToken,
      };
    } catch (error) {
      return { ok: false as const, error: gatewayNetworkFailure(error).error };
    }
  });
