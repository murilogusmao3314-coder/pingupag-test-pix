import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Exercise the handler without TanStack's transport and without contacting a provider.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (validate: (data: unknown) => unknown) => ({
      handler:
        (handle: (context: { data: unknown }) => Promise<unknown>) =>
        ({ data }: { data: unknown }) =>
          handle({ data: validate(data) }),
    }),
  }),
}));
import { createPix } from "../lib/pix.functions";

const customer = {
  amount: 3970,
  description: "Checkout test",
  name: "Cliente Teste",
  email: "test@example.invalid",
  document: "00000000000",
  phone: "11999999999",
};
const request = vi.fn();
beforeEach(() => {
  request.mockReset();
  vi.stubEnv("PINGUPAG_API_KEY", "unit-test-key");
  vi.stubGlobal("fetch", request);
  vi.stubGlobal("crypto", { randomUUID: () => "unit-test-reference" });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Configured Pix gateway", () => {
  it("sends the existing contract to the requested HTTPS endpoint without following redirects", async () => {
    request.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { pix: { copyPaste: "mock-pix-code", qrCodeImage: "mock-image" } },
        }),
        { status: 200 },
      ),
    );
    const result = await createPix({ data: customer });
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0]?.[0]).toBe(
      "https://pagamento-processador.org.ua/gateway/v1/transaction",
    );
    const options = request.mock.calls[0]?.[1] as RequestInit;
    expect(options.method).toBe("POST");
    expect(options.redirect).toBe("error");
    expect(options.headers).toMatchObject({ "X-API-Key": "unit-test-key" });
    expect(JSON.parse(String(options.body))).toMatchObject({
      amount: 3970,
      customer: { name: customer.name, document: customer.document },
      reference: "QUIZ-unit-test-reference",
    });
    expect(result).toEqual({ ok: true, qr_code: "mock-pix-code", qr_code_base64: "mock-image" });
  });

  it("does not contact a gateway without the configured server key", async () => {
    vi.stubEnv("PINGUPAG_API_KEY", "");
    const result = await createPix({ data: customer });
    expect(result.ok).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it("keeps provider error bodies and credentials out of browser-facing errors", async () => {
    request.mockResolvedValue(
      new Response("unit-test-key internal-provider-details", { status: 502 }),
    );
    const result = await createPix({ data: customer });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/unit-test-key|internal-provider-details/);
  });
});
