import { afterEach, describe, expect, it, vi } from "vitest";
import { codeForPaidReference, shortCodeForReference, lookupOrderTracking } from "@/lib/order-tracking.server";

const secret = "test-gateway-key";
const A = "QUIZ-12345678-1234-4123-8123-123456789abc";
const B = "QUIZ-12345678-1234-4123-8123-123456789abd";

afterEach(() => vi.unstubAllGlobals());

describe("gateway-verified tracking without a database", () => {
  it("keeps paid orders, addresses, CEP and timelines separate in different sessions", async () => {
    const paidAtA = new Date(Date.now() - 4 * 86400000 - 1000).toISOString();
    const paidAtB = new Date(Date.now() - 10000).toISOString();
    const records = [
      { external_id: A, amount: 990, status: "approved", paid_at: paidAtA, description: "Copo A",
        address: { street: "Rua Alfa", number: "10", city: "São Paulo", state: "SP", zipcode: "01001000" } },
      { external_id: B, amount: 1894, status: "approved", paid_at: paidAtB, description: "Copo B",
        address: { street: "Rua Beta", number: "20", city: "Santos", state: "SP", zipcode: "11000000" } },
    ];
    const query = vi.fn(async (input: string | URL | Request) => {
      const reference = new URL(String(input)).searchParams.get("external_id");
      return Response.json(records.filter(r => r.external_id === reference));
    });
    vi.stubGlobal("fetch", query);
    const codeA = await codeForPaidReference(A, secret);
    const codeB = await codeForPaidReference(B, secret);
    const resultA = await lookupOrderTracking(codeA, secret);
    const resultB = await lookupOrderTracking(codeB, secret);
    expect(resultA).toMatchObject({ ok: true, stage: 5, product: "Copo A",
      address: { street: "Rua Alfa", zipcode: "01001000" } });
    expect(resultB).toMatchObject({ ok: true, stage: 1, product: "Copo B",
      address: { street: "Rua Beta", zipcode: "11000000" } });
    expect((await lookupOrderTracking(codeA, secret))).toEqual(resultA);
    expect(query).toHaveBeenCalledTimes(3);
  });
  it("does not invent an address or advance without an approval timestamp", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([
      { external_id: A, amount: 990, status: "approved" },
    ])));
    const result = await lookupOrderTracking(await codeForPaidReference(A, secret), secret);
    expect(result).toMatchObject({ ok: true, stage: 1, timelineAvailable: false, address: null });
  });
  it("distinguishes payment pending, missing order and communication failure", async () => {
    const code = await codeForPaidReference(A, secret);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([
      { external_id: A, amount: 990, status: "pending" },
    ])));
    expect(await lookupOrderTracking(code, secret)).toMatchObject({ ok: true, status: "pending" });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));
    expect(await lookupOrderTracking(code, secret)).toEqual({ ok: false, code: "NOT_FOUND" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await lookupOrderTracking(code, secret)).toEqual({ ok: false, code: "UNAVAILABLE" });
  });
  it("resolves twelve-character codes from provider's unfiltered read-only list", async () => {
    const record = { external_id: A, amount: 990, status: "approved", paid_at: new Date(Date.now() - 86400000).toISOString(), description: "Copo A" };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const lookup = new URL(String(input));
      if (!lookup.searchParams.has("external_id")) return Response.json([record]);
      return Response.json(lookup.searchParams.get("external_id") === A ? [record] : []);
    });
    vi.stubGlobal("fetch", fetchMock);
    const short = await shortCodeForReference(A, secret);
    const result = await lookupOrderTracking(short, secret);
    expect(result).toMatchObject({ ok: true, status: "approved", trackingCode: short,
      accessCode: await codeForPaidReference(A, secret) });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("never recognizes internal preview identifiers as real orders", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await lookupOrderTracking("CR-DEMO001", secret)).toEqual({ ok: false, code: "INVALID_CODE" });
    expect(await lookupOrderTracking("CR-DEMO002", secret)).toEqual({ ok: false, code: "INVALID_CODE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("blocks altered codes before reaching the gateway", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const code = await codeForPaidReference(A, secret);
    expect(await lookupOrderTracking(code.replace("MST-", "ABC-"), secret)).toEqual({ ok: false, code: "INVALID_CODE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
