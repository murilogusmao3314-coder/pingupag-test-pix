import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkPixPayment } from "@/lib/pix.functions";
import { trackPurchase } from "@/lib/meta-events";
import { forgetPendingPix, readPendingPix } from "./pix-pending";

/** Recover confirmed purchases when a visitor returns after leaving the Pix screen. */
export function usePendingPurchases(enabled: boolean) {
  const checkPayment = useServerFn(checkPixPayment);
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    async function poll() {
      if (!active || busy || document.visibilityState === "hidden") return;
      const pending = readPendingPix();
      if (!pending.length) return;
      busy = true;
      try {
        for (const entry of pending) {
          if (!active) break;
          try {
            const result = await checkPayment({ data: { token: entry.token } });
            if (!active) break;
            if (!result.ok) {
              if (result.code === "RECEIPT_EXPIRED") forgetPendingPix(entry.reference);
              continue;
            }
            if (result.reference !== entry.reference) continue;
            if (result.status === "approved") trackPurchase(result.reference, result.amount, result.attribution);
            if (result.status !== "pending") forgetPendingPix(entry.reference);
          } catch {
            // The next visible retry can recover intermittent network failures.
          }
        }
      } finally {
        busy = false;
        if (active && readPendingPix().length) schedule();
      }
    }
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => void poll(), 30000);
    }
    function onVisible() {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void poll();
      }
    }
    void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, checkPayment]);
}
