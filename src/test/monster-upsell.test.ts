import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (validate: (input: unknown) => unknown) => ({
      handler: (fn: (args: { data: unknown }) => Promise<unknown>) =>
        ({ data }: { data: unknown }) => fn({ data: validate(data) }),
    }),
  }),
}));

import { sealUtmifyContext } from "../lib/utmify-envelope.server";
import { signPixReceipt, verifyPixReceipt } from "../lib/pix-receipt.server";
import { createUpsellPix, UPSELL_AMOUNT, UPSELL_PRODUCT } from "../lib/upsell.functions";
import { checkPixPayment } from "../lib/pix.functions";

const secret = "upsell-unit-test-gateway-key";
const parentRef = "QUIZ-12345678-1234-1234-1234-123456789012";
const context = {
  createdAt: "2026-10-15T22:00:00.000Z",
  customer: {
    name: "Cliente Teste",
    email: "cliente@example.invalid",
    phone: "11999999999",
    document: "00000000000",
  },
  address: {
    street: "Rua Teste",
    number: "100",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
    zipcode: "01001000",
  },
  trackingParameters: {
    src: null,
    sck: null,
    utm_source: "facebook",
    utm_campaign: "campanha",
    utm_medium: "paid",
    utm_content: "criativo1",
    utm_term: null,
  },
  parameters: [["fbclid", "test-click"], ["utm_source", "facebook"]] as [string, string][],
};

const fetchMock = vi.fn();
let parentToken = "";
let currentParentStatus = "pending";
let latestReference = "";

beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("PINGUPAG_API_KEY", secret);
  vi.stubEnv("UTMIFY_API_TOKEN", "");
  currentParentStatus = "pending";
  latestReference = "";
  fetchMock.mockReset();
  const envelope = await sealUtmifyContext(context, secret);
  parentToken = await signPixReceipt(parentRef, 990, secret, envelope);
  fetchMock.mockImplementation(async (url: string, options: RequestInit) => {
    if (url.includes("/gateway/v1/query")) {
      const reference = new URL(url).searchParams.get("external_id");
      return new Response(JSON.stringify([{
        external_id: reference,
        amount: reference === parentRef ? 990 : UPSELL_AMOUNT,
        status: reference === parentRef ? currentParentStatus : "approved",
      }]));
    }
    if (url.includes("/gateway/v1/transaction")) {
      const request = JSON.parse(String(options.body));
      latestReference = request.reference;
      return new Response(JSON.stringify({ qr_code: "upsell-mock-pix" }));
    }
    throw Error("Unexpected outbound request: " + url);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Verified optional Upsell 1", () => {
  it("never creates a new Pix before the original is approved", async () => {
    const response = await createUpsellPix({ data: { parentToken } });
    expect(response).toMatchObject({ ok: false });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/transaction"))).toHaveLength(0);
  });

  it("charges precisely R$ 39,90 with a separate reference and reuses encrypted delivery", async () => {
    currentParentStatus = "approved";
    const result = await createUpsellPix({ data: { parentToken } });
    expect(result).toMatchObject({ ok: true, qr_code: "upsell-mock-pix" });
    if (!result.ok) throw Error("Upsell Pix not created");
    const transaction = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/gateway/v1/transaction"),
    );
    expect(transaction).toBeDefined();
    const body = JSON.parse(String(transaction![1].body));
    expect(body).toMatchObject({
      amount: UPSELL_AMOUNT,
      description: UPSELL_PRODUCT.name,
      reference: latestReference,
      customer: context.customer,
      address: context.address,
    });
    expect(body.reference).not.toBe(parentRef);
    expect(body).not.toHaveProperty("trackingParameters");
    expect(result.order_reference).toBe(body.reference);
    expect(await verifyPixReceipt(result.tracking_token, secret)).toMatchObject({
      kind: "upsell",
      reference: result.order_reference,
      amount: 3990,
    });
    const confirmed = await checkPixPayment({ data: { token: result.tracking_token } });
    expect(confirmed).toMatchObject({
      ok: true,
      status: "approved",
      kind: "upsell",
      reference: result.order_reference,
      amount: UPSELL_AMOUNT,
      attribution: context.parameters,
    });
  });

  it("rejects tampered receipts and never authorizes an upsell from another upsell", async () => {
    currentParentStatus = "approved";
    const tampered = await createUpsellPix({ data: { parentToken: parentToken + "x" } });
    expect(tampered).toMatchObject({ ok: false });
    const second = await signPixReceipt(parentRef, UPSELL_AMOUNT, secret, undefined, "upsell");
    expect(await createUpsellPix({ data: { parentToken: second } })).toMatchObject({ ok: false });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/transaction"))).toHaveLength(0);
  });
});
