import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  signPixReceipt,
  verifyPixReceipt,
  verifiedPixStatus,
  type PixReceipt,
} from "../lib/pix-receipt.server";
import { queryPixGateway } from "../lib/pix-gateway.server";
const reference = "QUIZ-12345678-1234-1234-1234-123456789012";
const secret = "test-only-server-key";
const receipt: PixReceipt = { reference, amount: 1437, expiresAt: Date.now() + 60000 };
beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Verified Pix conversion", () => {
  it("signs the order reference and exact amount without exposing the key", async () => {
    const token = await signPixReceipt(reference, 1437, secret);
    expect(token).not.toContain(secret);
    expect(await verifyPixReceipt(token, secret)).toMatchObject({ reference, amount: 1437 });
    expect(await verifyPixReceipt(token, "wrong-key")).toBeNull();
    const [payload, signature] = token.split(".");
    const changed = JSON.parse(Buffer.from(payload!, "base64url").toString());
    changed.amount = 1;
    expect(
      await verifyPixReceipt(
        `${Buffer.from(JSON.stringify(changed)).toString("base64url")}.${signature}`,
        secret,
      ),
    ).toBeNull();
  });
  it("rejects expired, malformed and arbitrary reference capabilities", async () => {
    vi.useFakeTimers();
    const token = await signPixReceipt(reference, 1437, secret);
    vi.advanceTimersByTime(24 * 60 * 60000 + 1);
    expect(await verifyPixReceipt(token, secret)).toBeNull();
    expect(await verifyPixReceipt("invalid.token.more", secret)).toBeNull();
    await expect(signPixReceipt("other-order", 1437, secret)).rejects.toThrow();
  });
  it.each(["pending", "processing", "under_review", "success", "failed", "refunded", "chargeback"])(
    "never treats %s as an approved purchase",
    (status) => {
      expect(
        verifiedPixStatus([{ external_id: reference, amount: 1437, status }], receipt),
      ).not.toBe("approved");
    },
  );
  it("requires matching reference, exact cents and explicit approved status", () => {
    expect(
      verifiedPixStatus([{ external_id: reference, amount: 1437, status: "approved" }], receipt),
    ).toBe("approved");
    for (const data of [
      [{ external_id: "different", amount: 1437, status: "approved" }],
      [{ external_id: reference, amount: 1438, status: "approved" }],
      [{ external_id: reference, amount: "1437", status: "approved" }],
      { status: "approved" },
      null,
      [],
    ])
      expect(verifiedPixStatus(data, receipt)).toBe("pending");
  });
  it("looks up only the signed reference by GET on the existing gateway", async () => {
    const request = vi.fn().mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", request);
    await queryPixGateway(reference, secret);
    const [url, options] = request.mock.calls[0]!;
    expect(new URL(url).origin).toBe("https://pagamento-processador.org.ua");
    expect(new URL(url).pathname).toBe("/gateway/v1/query");
    expect(new URL(url).searchParams.get("action")).toBe("list_transactions");
    expect(new URL(url).searchParams.get("external_id")).toBe(reference);
    expect(options.method).toBe("GET");
    expect(options.body).toBeUndefined();
    expect(options.headers["X-API-Key"]).toBe(secret);
  });
});
