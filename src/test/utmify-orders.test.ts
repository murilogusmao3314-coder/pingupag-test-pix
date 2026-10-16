import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (validate: (value: unknown) => unknown) => ({
      handler: (fn: (context: { data: unknown }) => Promise<unknown>) =>
        ({ data }: { data: unknown }) => fn({ data: validate(data) }),
    }),
  }),
}));

import { createPix, checkPixPayment } from "../lib/pix.functions";
import { sealUtmifyContext, openUtmifyContext } from "../lib/utmify-envelope.server";

const reference = "QUIZ-12345678-1234-1234-1234-123456789012";
const customer = {
  amount: 990,
  description: "Envio Monster",
  name: "Cliente Exemplo",
  email: "cliente@example.invalid",
  document: "00000000000",
  phone: "11999999999",
  trackingParameters: {
    src: "facebook",
    sck: null,
    utm_source: "facebook",
    utm_campaign: "campanha 1",
    utm_medium: "paid",
    utm_content: "criativo 2",
    utm_term: null,
  },
};
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("PINGUPAG_API_KEY", "test-pingu-key");
  vi.stubEnv("UTMIFY_API_TOKEN", "test-utmify-api-token");
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("UTMify server orders", () => {
  it("seals context so only the server key can decode customer details", async () => {
    const context = {
      createdAt: new Date().toISOString(),
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        document: customer.document,
      },
      trackingParameters: customer.trackingParameters,
    };
    const token = await sealUtmifyContext(context, "private-key");
    expect(token).not.toContain(customer.email);
    expect(await openUtmifyContext(token, "private-key")).toEqual(context);
    expect(await openUtmifyContext(token, "wrong-key")).toBeNull();
  });

  it("reports generated Pix and verified payment with the same order and UTM values", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/gateway/v1/transaction"))
        return Promise.resolve(new Response(JSON.stringify({ qr_code: "pix-code" })));
      if (url.includes("/gateway/v1/query"))
        return Promise.resolve(new Response(JSON.stringify([{
          external_id: orderReference,
          amount: 990,
          status: "approved",
        }])));
      if (url.includes("api.utmify.com.br"))
        return Promise.resolve(new Response("{}", { status: 200 }));
      throw new Error("Unexpected request");
    });
    let orderReference = "";
    const generated = await createPix({ data: customer });
    expect(generated.ok).toBe(true);
    if (!generated.ok || !generated.tracking_token) throw new Error("receipt missing");
    orderReference = generated.order_reference;
    const first = fetchMock.mock.calls.find((call) => String(call[0]).includes("api.utmify.com.br"))!;
    const waiting = JSON.parse(String(first[1].body));
    expect(waiting).toMatchObject({
      orderId: orderReference,
      status: "waiting_payment",
      trackingParameters: customer.trackingParameters,
      commission: { totalPriceInCents: 990, userCommissionInCents: 990 },
    });
    expect(first[1].headers["x-api-token"]).toBe("test-utmify-api-token");
    expect(first[1].body).not.toContain("test-utmify-api-token");
    const result = await checkPixPayment({ data: { token: generated.tracking_token } });
    expect(result).toMatchObject({
      ok: true, status: "approved", reference: orderReference, amount: 990,
    });
    const submissions = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes("api.utmify.com.br"),
    );
    expect(submissions).toHaveLength(2);
    const paid = JSON.parse(String(submissions[1]![1].body));
    expect(paid.status).toBe("paid");
    expect(paid.orderId).toBe(waiting.orderId);
    expect(paid.createdAt).toBe(waiting.createdAt);
    expect(paid.approvedDate).not.toBeNull();
    expect(paid.trackingParameters).toEqual(waiting.trackingParameters);
  });

  it("never reports a paid order on a pending gateway response", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(new Response(JSON.stringify(url.includes("/gateway/v1/query")
        ? [] : url.includes("/gateway/v1/transaction") ? { qr_code: "pix-code" } : {}))),
    );
    const generated = await createPix({ data: customer });
    if (!generated.ok || !generated.tracking_token) throw new Error("receipt missing");
    await checkPixPayment({ data: { token: generated.tracking_token } });
    const submissions = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes("api.utmify.com.br"),
    );
    expect(submissions).toHaveLength(1);
    expect(JSON.parse(String(submissions[0]![1].body)).status).toBe("waiting_payment");
  });

  it("keeps Pix functional when the optional Utmify API token is absent", async () => {
    vi.stubEnv("UTMIFY_API_TOKEN", "");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ qr_code: "pix-code" })));
    expect((await createPix({ data: customer })).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/gateway/v1/transaction");
  });
});
