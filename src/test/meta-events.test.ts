import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});
describe("Meta funnel event safety", () => {
  it("sends standard and custom events with unique document IDs and suppresses duplicate transitions", async () => {
    const fbq = vi.fn();
    vi.stubGlobal("fbq", fbq);
    const { trackMeta, orderMeta } = await import("../lib/meta-events");
    trackMeta("InitiateCheckout", orderMeta(3874, true, true), { key: "checkout-1" });
    trackMeta("InitiateCheckout", orderMeta(3874, true, true), { key: "checkout-1" });
    trackMeta("QuizAnswer", { question: 2 }, { custom: true });
    expect(fbq).toHaveBeenCalledTimes(2);
    expect(fbq.mock.calls[0]!.slice(0, 3)).toEqual([
      "track",
      "InitiateCheckout",
      expect.objectContaining({ value: 38.74, currency: "BRL", num_items: 3 }),
    ]);
    expect(fbq.mock.calls[0]![3].eventID).not.toBe("InitiateCheckout:checkout-1");
    expect(fbq.mock.calls[1]).toEqual(["trackCustom", "QuizAnswer", { question: 2 }]);
  });
  it("deduplicates approved purchases across module reloads using the order reference", async () => {
    const fbq = vi.fn();
    vi.stubGlobal("fbq", fbq);
    const first = await import("../lib/meta-events");
    first.trackPurchase("order-a", 1894);
    first.trackPurchase("order-a", 1894);
    vi.resetModules();
    const next = await import("../lib/meta-events");
    next.trackPurchase("order-a", 1894);
    next.trackPurchase("order-b", 990);
    expect(fbq).toHaveBeenCalledTimes(2);
    expect(fbq.mock.calls[0]).toEqual([
      "track",
      "Purchase",
      { value: 18.94, currency: "BRL", order_id: "order-a", payment_method: "pix" },
      { eventID: "Purchase:order-a" },
    ]);
  });
  it("does not throw or mark unsent events if the pixel is absent or throws", async () => {
    vi.stubGlobal("fbq", undefined);
    const { trackMeta } = await import("../lib/meta-events");
    expect(() => trackMeta("Lead", {}, { key: "safe" })).not.toThrow();
    vi.stubGlobal("fbq", () => {
      throw Error("blocked");
    });
    expect(() => trackMeta("Lead", {}, { key: "safe" })).not.toThrow();
    const fbq = vi.fn();
    vi.stubGlobal("fbq", fbq);
    trackMeta("Lead", {}, { key: "safe" });
    expect(fbq).toHaveBeenCalledOnce();
  });
});
