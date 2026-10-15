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
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Configured Pix gateway", () => {
  it("sends the existing contract to the requested HTTPS endpoint using the documented contract and guarded redirects", async () => {
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
    expect(options.redirect).toBe("manual");
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

  it("normalizes accidental surrounding whitespace when the key is pasted", async () => {
    vi.stubEnv("PINGUPAG_API_KEY", "  unit-test-key\n");
    request.mockResolvedValue(
      new Response(JSON.stringify({ qr_code: "mock-code" }), { status: 200 }),
    );
    expect((await createPix({ data: customer })).ok).toBe(true);
    expect(request.mock.calls[0]?.[1].headers).toMatchObject({ "X-API-Key": "unit-test-key" });
  });

  it("reports an invalid multiline credential before attempting to connect", async () => {
    vi.stubEnv("PINGUPAG_API_KEY", "unit-test-key\ninvalid-part");
    expect(await createPix({ data: customer })).toMatchObject({
      ok: false,
      error: expect.stringContaining("quebra de linha"),
    });
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

  it("accepts the documented response and sends the delivery address in the required format", async () => {
    request.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "success",
          transaction_id: 238,
          id: "ORDER-238",
          qr_code: "documented-pix",
          qr_code_base64: "data:image/png;base64,TEST",
          amount: 3970,
        }),
        { status: 200 },
      ),
    );
    const address = {
      street: "Rua Teste",
      number: "100",
      complement: "",
      neighborhood: "Centro",
      city: "São Paulo",
      state: "SP",
      zipcode: "01001000",
    };
    expect(await createPix({ data: { ...customer, address } })).toMatchObject({
      ok: true,
      qr_code: "documented-pix",
    });
    expect(JSON.parse(String(request.mock.calls[0]?.[1].body))).toMatchObject({
      source: "api_externa",
      address,
    });
  });

  it("follows a same-gateway 307 with one unchanged transaction reference", async () => {
    request
      .mockResolvedValueOnce(
        new Response(null, { status: 307, headers: { Location: "/gateway/v1/transaction/" } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ qr_code: "redirect-pix" }), { status: 200 }),
      );
    expect(await createPix({ data: customer })).toMatchObject({
      ok: true,
      qr_code: "redirect-pix",
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]?.[0]).toBe(
      "https://pagamento-processador.org.ua/gateway/v1/transaction/",
    );
    expect(request.mock.calls[1]?.[1].body).toBe(request.mock.calls[0]?.[1].body);
  });

  it("changes POST to GET after 303 without posting another charge", async () => {
    request
      .mockResolvedValueOnce(
        new Response(null, {
          status: 303,
          headers: { Location: "/gateway/v1/transaction/result" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ qr_code: "result-pix" }), { status: 200 }),
      );
    expect((await createPix({ data: customer })).ok).toBe(true);
    expect(request.mock.calls[1]?.[1].method).toBe("GET");
    expect(request.mock.calls[1]?.[1].body).toBeUndefined();
  });

  it.each([
    "https://another-processor.invalid/gateway/v1/transaction",
    "http://pagamento-processador.org.ua/gateway/v1/transaction",
    "/login",
  ])("does not forward the key to an unauthorized redirect: %s", async (location) => {
    request.mockResolvedValue(new Response(null, { status: 307, headers: { Location: location } }));
    expect(await createPix({ data: customer })).toMatchObject({
      ok: false,
      code: "GATEWAY_REDIRECT",
    });
    expect(request).toHaveBeenCalledOnce();
  });

  it("terminates redirect loops after the bounded number of requests", async () => {
    request.mockImplementation(() =>
      Promise.resolve(
        new Response(null, { status: 307, headers: { Location: "/gateway/v1/transaction" } }),
      ),
    );
    expect(await createPix({ data: customer })).toMatchObject({
      ok: false,
      code: "GATEWAY_REDIRECT",
    });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["EAI_AGAIN", "GATEWAY_DNS"],
    ["ENOTFOUND", "GATEWAY_DNS"],
    ["CERT_HAS_EXPIRED", "GATEWAY_TLS"],
    ["ECONNREFUSED", "GATEWAY_CONNECTION"],
  ])("reports %s safely without retrying the POST", async (cause, code) => {
    request.mockRejectedValue(
      new TypeError("unit-test-key private-details", { cause: { code: cause } }),
    );
    const result = await createPix({ data: customer });
    expect(result).toMatchObject({ ok: false, code });
    expect(JSON.stringify(result)).not.toMatch(/unit-test-key|private-details/);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(
      /unit-test-key|private-details/,
    );
    expect(request).toHaveBeenCalledOnce();
  });

  it("distinguishes a timeout from authentication or provider rejection", async () => {
    request.mockRejectedValue(new DOMException("expired", "TimeoutError"));
    expect(await createPix({ data: customer })).toMatchObject({
      ok: false,
      code: "GATEWAY_TIMEOUT",
    });
    expect(request).toHaveBeenCalledOnce();
  });

  it("identifies a Cloudflare block without retrying or altering the request identity", async () => {
    request.mockResolvedValue(
      new Response(
        JSON.stringify({ cloudflare_error: true, error_code: 1010, detail: "unit-test-key" }),
        { status: 403 },
      ),
    );
    const result = await createPix({ data: customer });
    expect(result).toMatchObject({ ok: false, code: "GATEWAY_BLOCKED" });
    expect(JSON.stringify(result)).not.toContain("unit-test-key");
    expect(request).toHaveBeenCalledOnce();
  });

  it("reports an invalid or inactive API key separately", async () => {
    request.mockResolvedValue(new Response("invalid key", { status: 401 }));
    expect(await createPix({ data: customer })).toMatchObject({ ok: false, code: "GATEWAY_AUTH" });
  });
});
