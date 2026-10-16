import { useEffect, useId, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPix } from "@/lib/pix.functions";
import { cn } from "@/lib/utils";
import { trackMeta, orderMeta } from "@/lib/meta-events";
import { Action, Photo } from "./primitives";
import {
  customerSchema,
  addressSchema,
  emptyFields,
  calculateTotal,
  money,
  type CheckoutFields,
  type Shipping,
} from "./checkout-schema";
import { CustomerFields, AddressFields } from "./checkout-fields";
import { useCepLookup } from "./use-cep-lookup";
import { ShippingOptions, Extras, Totals, Seals } from "./order";
import { Payment, type PixPayment } from "./payment";
import { rememberPendingPix } from "./pix-pending";
import { getCheckoutTracking } from "@/lib/utmify-tracking";
export function Checkout({
  onClose,
  remaining = 600,
}: {
  onClose: () => void;
  remaining?: number;
}) {
  const checkoutId = useId();
  const [step, setStep] = useState(1);
  const [fields, setFields] = useState(emptyFields);
  const [shipping, setShipping] = useState<Shipping>("pac");
  const [cup, setCup] = useState(false);
  const [pack, setPack] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [payment, setPayment] = useState<PixPayment | null>(null);
  const cepFeedback = useCepLookup(fields, setFields, step === 2 && !payment);
  const createPayment = useServerFn(createPix);
  const total = calculateTotal(shipping, cup, pack);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    document.querySelector(".mst-co")?.scrollTo({ top: 0 });
  }, [step, payment]);
  useEffect(() => {
    trackMeta("InitiateCheckout", orderMeta(990), { key: checkoutId });
  }, [checkoutId]);
  useEffect(() => {
    if (!payment)
      trackMeta(
        "CheckoutStepView",
        { step, stage: ["customer", "delivery", "payment"][step - 1] ?? "checkout" },
        { custom: true, key: `${checkoutId}:${step}` },
      );
  }, [checkoutId, step, payment]);
  function changeShipping(next: Shipping) {
    if (next === shipping) return;
    trackMeta(
      "ShippingSelected",
      { ...orderMeta(calculateTotal(next, cup, pack), cup, pack), shipping_method: next },
      { custom: true },
    );
    setShipping(next);
  }
  function toggleExtra(key: "cup" | "pack") {
    const selected = key === "cup" ? cup : pack;
    const id = key === "cup" ? "monster-extra-cup" : "monster-pack-6";
    trackMeta(
      selected ? "RemoveFromCart" : "AddToCart",
      {
        currency: "BRL",
        value: key === "cup" ? 19.9 : 9.9,
        content_type: "product",
        content_ids: [id],
        num_items: 1,
      },
      { custom: selected },
    );
    if (key === "cup") setCup(!cup);
    else setPack(!pack);
  }
  function update(key: keyof CheckoutFields, value: string) {
    setFields((old) => ({ ...old, [key]: value }));
  }
  function back() {
    if (pending) return;
    setError("");
    if (payment) {
      setPayment(null);
      return;
    }
    if (step === 1) onClose();
    else setStep(step - 1);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError("");
    const customer = customerSchema.safeParse(fields);
    if (!customer.success) {
      trackMeta("CheckoutValidationError", { stage: "customer" }, { custom: true });
      setError(customer.error.issues[0]?.message ?? "Confira seus dados.");
      setStep(1);
      return;
    }
    if (step === 1) {
      trackMeta("Lead", { content_name: "Checkout Monster" }, { key: checkoutId });
      setStep(2);
      return;
    }
    const address = addressSchema.safeParse(fields);
    if (!address.success) {
      trackMeta("CheckoutValidationError", { stage: "delivery" }, { custom: true });
      setError(address.error.issues[0]?.message ?? "Confira o endereço.");
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    trackMeta(
      "AddPaymentInfo",
      { ...orderMeta(total, cup, pack), payment_method: "pix" },
      { key: checkoutId },
    );
    trackMeta("PixRequested", orderMeta(total, cup, pack), { custom: true });
    setPending(true);
    try {
      const result = await createPayment({
        data: {
          ...customer.data,
          amount: total,
          trackingParameters: getCheckoutTracking(),
          address: {
            street: address.data.street,
            number: address.data.number,
            complement: address.data.complement,
            neighborhood: address.data.neighborhood,
            city: address.data.city,
            state: address.data.state,
            zipcode: address.data.cep,
          },
          description: `Copo Monster 1,15L — envio ${shipping.toUpperCase()}${cup ? " +1 copo" : ""}${pack ? " + fardo 6x473ml" : ""}`,
        },
      });
      if (result.ok) {
        rememberPendingPix(result.tracking_token, result.order_reference);
        trackMeta(
          "PixGenerated",
          { ...orderMeta(total, cup, pack), payment_method: "pix" },
          { custom: true, key: result.order_reference || checkoutId },
        );
        setPayment({
          qr_code: result.qr_code,
          qr_code_base64: result.qr_code_base64,
          ...(result.tracking_token ? { tracking_token: result.tracking_token } : {}),
          ...(result.order_reference ? { order_reference: result.order_reference } : {}),
        });
      } else {
        trackMeta("CheckoutError", { stage: "pix_generation" }, { custom: true });
        setError(result.error);
      }
    } catch {
      trackMeta("CheckoutError", { stage: "pix_generation" }, { custom: true });
      setError("Não foi possível gerar o PIX. Tente novamente em instantes.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="mst-co" role="dialog" aria-modal="true" aria-label="Checkout do resgate">
      <header className="mst-co-head">
        <Button
          variant="ghost"
          className="mst-co-back"
          aria-label="Voltar"
          onClick={back}
          disabled={pending}
        >
          <ArrowLeft />
        </Button>
        <span className="mst-co-brand">
          <Photo file="monster-logo.png" alt="Monster" />
          <span>Monster Drinkware</span>
        </span>
        <span className="mst-co-secure">Ambiente seguro</span>
      </header>
      <form id="monster-checkout" onSubmit={submit} noValidate>
        <div className="mst-co-body">
          {payment ? (
            <>
              <Payment payment={payment} onBack={() => setPayment(null)} />
              <Totals shipping={shipping} cup={cup} pack={pack} />
            </>
          ) : (
            <>
              <div className="mst-steps-nav">
                {["Seus dados", "Entrega", "Pagamento"].map((label, i) => (
                  <div
                    className={cn("mst-step", step === i + 1 && "is-on", step > i + 1 && "is-done")}
                    key={label}
                  >
                    <i>{i + 1}</i>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              {step === 1 && <CustomerFields fields={fields} update={update} />}{" "}
              {step === 2 && (
                <>
                  <h2 className="mst-h2">
                    Onde entregar
                    <br />
                    <span className="mst-lime">o seu copo</span>
                  </h2>
                  <ShippingOptions shipping={shipping} onChange={changeShipping} />
                  <AddressFields fields={fields} update={update} cepFeedback={cepFeedback} />
                </>
              )}
              {step === 3 && (
                <>
                  <h2 className="mst-h2">
                    Pague só o envio
                    <br />e leve o seu <span className="mst-lime">copo grátis</span>
                  </h2>
                  <p className="mst-sub">
                    O copo custa R$ 0,00. O total corresponde à entrega escolhida e aos adicionais
                    que você selecionar.
                  </p>
                  <Extras cup={cup} pack={pack} toggle={toggleExtra} />
                  <Totals shipping={shipping} cup={cup} pack={pack} />
                  <div className="mst-pay-tabs">
                    <div className="mst-pay-tab is-on">
                      PIX<small>Aprovação pelo seu banco</small>
                    </div>
                  </div>
                  <p className="mst-disclosure">
                    Ao gerar o Pix, você cria uma cobrança real. Os dados necessários do cliente, o
                    endereço de entrega e o total são enviados ao gateway pelo servidor.
                  </p>
                </>
              )}
              {error && (
                <p className="mst-err" role="alert">
                  {error}
                </p>
              )}
              <Seals />
            </>
          )}
        </div>
      </form>
      {!payment && (
        <div className="mst-bar-fixed">
          <div className="mst-bar-in">
            <div className="mst-bar-top">
              <span>Reserva do prêmio</span>
              <b>
                {String(Math.floor(remaining / 60)).padStart(2, "0")}:
                {String(remaining % 60).padStart(2, "0")}
              </b>
              <span>Total {money(total)}</span>
            </div>
            <Action type="submit" form="monster-checkout" disabled={pending}>
              {pending ? "Gerando PIX…" : step < 3 ? "Continuar" : `Gerar PIX de ${money(total)}`}
            </Action>
          </div>
        </div>
      )}
    </div>
  );
}
