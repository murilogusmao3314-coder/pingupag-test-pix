import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetPendingPix, readPendingPix, rememberPendingPix } from "../components/monster/pix-pending";

const { checkPayment } = vi.hoisted(() => ({ checkPayment: vi.fn() }));
vi.mock("@/lib/pix.functions", () => ({ checkPixPayment: checkPayment }));
vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: () => checkPayment,
}));
import { usePendingPurchases } from "../components/monster/use-pending-purchases";

const reference = "QUIZ-12345678-1234-1234-1234-123456789012";
const token = "test-read-only-token-with-sufficient-length";
beforeEach(() => {
  localStorage.clear();
  checkPayment.mockReset();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("Pix purchase recovery", () => {
  it("retains only bounded, valid, non-personal status capabilities", () => {
    rememberPendingPix(token, reference);
    rememberPendingPix("secret-customer@example.invalid", "arbitrary");
    expect(readPendingPix()).toEqual([{ reference, token, createdAt: expect.any(Number) }]);
    expect(localStorage.getItem("monster_pending_pix_v1")).not.toMatch(/cpf|email|qr_code/i);
    forgetPendingPix(reference);
    expect(readPendingPix()).toEqual([]);
  });

  it("recovers approval after returning to the page without creating a second Pix", async () => {
    const dataLayer: Record<string, unknown>[] = [];
    const fbq = vi.fn();
    vi.stubGlobal("dataLayer", dataLayer);
    vi.stubGlobal("fbq", fbq);
    rememberPendingPix(token, reference);
    checkPayment.mockResolvedValue({
      ok: true,
      status: "approved",
      reference,
      amount: 2286,
    });
    renderHook(() => usePendingPurchases(true));
    await waitFor(() => expect(dataLayer).toHaveLength(1));
    expect(dataLayer[0]).toMatchObject({
      event: "purchase",
      ecommerce: { value: 22.86, currency: "BRL" },
    });
    expect(fbq.mock.calls.some((call) => call[1] === "Purchase")).toBe(true);
    expect(readPendingPix()).toEqual([]);
    expect(checkPayment).toHaveBeenCalledOnce();
  });

  it("exposes the first paid receipt for an optional offer but not an already-paid upsell", async () => {
    const onFirstPaymentApproved = vi.fn();
    rememberPendingPix(token, reference);
    checkPayment.mockResolvedValueOnce({
      ok: true, status: "approved", reference, amount: 2286, upsellEligible: true,
    });
    const first = renderHook(() => usePendingPurchases(true, onFirstPaymentApproved));
    await waitFor(() =>
      expect(onFirstPaymentApproved).toHaveBeenCalledWith(token, reference),
    );
    first.unmount();
    onFirstPaymentApproved.mockClear();
    rememberPendingPix(token, reference);
    checkPayment.mockResolvedValueOnce({
      ok: true, status: "approved", kind: "upsell", reference, amount: 3990,
    });
    const second = renderHook(() => usePendingPurchases(true, onFirstPaymentApproved));
    await waitFor(() => expect(readPendingPix()).toHaveLength(0));
    expect(onFirstPaymentApproved).not.toHaveBeenCalled();
    second.unmount();
  });

  it("does not report a purchase when the gateway says pending", async () => {
    const dataLayer: Record<string, unknown>[] = [];
    vi.stubGlobal("dataLayer", dataLayer);
    rememberPendingPix(token, reference);
    checkPayment.mockResolvedValue({ ok: true, status: "pending", reference, amount: 1437 });
    const view = renderHook(() => usePendingPurchases(true));
    await act(async () => {
      await waitFor(() => expect(checkPayment).toHaveBeenCalledOnce());
    });
    expect(dataLayer).toEqual([]);
    expect(readPendingPix()).toHaveLength(1);
    view.unmount();
  });
});
