import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkPixPayment } from "@/lib/pix.functions";
import { trackMeta, trackPurchase } from "@/lib/meta-events";

export function usePixConfirmation(token?: string) {
  const checkPayment = useServerFn(checkPixPayment);
  const [status, setStatus] = useState("pending");
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    setStatus("pending");
    setUnavailable(false);
    if (!token) return;
    let active = true;
    let busy = false;
    let finished = false;
    const until = Date.now() + 30 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      if (!active || busy || finished) return;
      if (Date.now() >= until) {
        setUnavailable(true);
        finished = true;
        return;
      }
      if (document.visibilityState === "hidden") {
        schedule();
        return;
      }
      busy = true;
      try {
        const result = await checkPayment({ data: { token: token! } });
        if (!active) return;
        if (!result.ok) {
          setUnavailable(true);
          if (result.code === "RECEIPT_EXPIRED") finished = true;
        } else {
          setUnavailable(false);
          setStatus(result.status);
          if (result.status !== "pending") {
            finished = true;
            if (result.status === "approved") trackPurchase(result.reference, result.amount);
            else
              trackMeta(
                "PixPaymentEnded",
                { status: result.status },
                { custom: true, key: result.reference },
              );
          }
        }
      } catch {
        if (active) setUnavailable(true);
      } finally {
        busy = false;
        if (active && !finished) schedule();
      }
    }
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(poll, 10000);
    }
    function onVisible() {
      if (document.visibilityState !== "hidden") {
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
  }, [token, checkPayment]);
  return { status, unavailable };
}
