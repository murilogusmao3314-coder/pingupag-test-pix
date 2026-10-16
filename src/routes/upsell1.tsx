import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ArrowRight, ShieldCheck } from "lucide-react";
import { Action } from "@/components/monster/primitives";
import { Payment, type PixPayment } from "@/components/monster/payment";
import { rememberPendingPix } from "@/components/monster/pix-pending";
import {
  readUpsellOffer,
  readUpsellPayment,
  rememberUpsellPayment,
  forgetUpsellPayment,
  dismissUpsellOffer,
  type UpsellOffer,
} from "@/components/monster/upsell-session";
import { checkPixPayment } from "@/lib/pix.functions";
import { createUpsellPix, UPSELL_AMOUNT } from "@/lib/upsell.functions";
import { money } from "@/components/monster/checkout-schema";

export const Route = createFileRoute("/upsell1")({
  head: () => ({
    meta: [
      { title: "Upsell 1 · Kit de pulseiras e fones sem fio" },
      { name: "description", content: "Oferta adicional opcional de 4 pulseiras e fones sem fio com estojo temático." },
    ],
  }),
  component: UpsellOne,
});

type State = "checking" | "preview" | "ready" | "declined" | "confirmed";

function UpsellOne() {
  const checkPayment = useServerFn(checkPixPayment);
  const generatePix = useServerFn(createUpsellPix);
  const [state, setState] = useState<State>("checking");
  const [offer, setOffer] = useState<UpsellOffer | null>(null);
  const [payment, setPayment] = useState<PixPayment | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const prior = readUpsellPayment();
    const saved = readUpsellOffer();
    if (prior) setPayment(prior);
    if (!saved) {
      setState(prior ? "ready" : "preview");
      return () => { active = false; };
    }
    setOffer(saved);
    void checkPayment({ data: { token: saved.parentToken } })
      .then((result) => {
        if (!active) return;
        setState(
          result.ok &&
          result.status === "approved" &&
          result.reference === saved.parentReference &&
          result.kind !== "upsell" && result.upsellEligible ? "ready" : "preview",
        );
      })
      .catch(() => { if (active) setState("preview"); });
    return () => { active = false; };
  }, [checkPayment]);

  async function acceptOffer() {
    if (state !== "ready" || !offer || pending || payment) return;
    setPending(true);
    setError("");
    try {
      const result = await generatePix({ data: { parentToken: offer.parentToken } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const next: PixPayment = {
        qr_code: result.qr_code,
        qr_code_base64: result.qr_code_base64,
        tracking_token: result.tracking_token,
        order_reference: result.order_reference,
      };
      rememberPendingPix(result.tracking_token, result.order_reference);
      rememberUpsellPayment({ ...next, tracking_token: result.tracking_token, order_reference: result.order_reference });
      setPayment(next);
    } catch {
      setError("Não foi possível gerar o Pix adicional. Confira sua conexão e tente novamente.");
    } finally {
      setPending(false);
    }
  }
  function declineOffer() {
    if (offer) dismissUpsellOffer(offer.parentReference);
    forgetUpsellPayment();
    setPayment(null);
    setState("declined");
  }
  function onUpsellApproved() {
    if (offer) dismissUpsellOffer(offer.parentReference);
    forgetUpsellPayment();
    setState("confirmed");
  }

  const summary = (
    <div className="mst-totals">
      <div className="mst-total-row"><span>4 pulseiras temáticas</span><b>Inclusas</b></div>
      <div className="mst-total-row"><span>Fones Bluetooth com estojo temático</span><b>Inclusos</b></div>
      <div className="mst-total-final"><span>Pedido adicional</span><b>{money(UPSELL_AMOUNT)}</b></div>
    </div>
  );

  return (
    <main className="mst mst-co mst-upsell-shell">
      <div className="mst-upsell-content">
        <header className="mst-upsell-top">
          <span className="mst-upsell-icon" aria-hidden="true">M</span>
          <span>OFERTA ADICIONAL</span>
          <span className="mst-upsell-step">UPSELL 01</span>
        </header>
        {state === "confirmed" || state === "declined" ? (
          <div className="mst-upsell-finish" role="status">
            <div className="mst-upsell-done"><Check aria-hidden="true" /></div>
            <h1>{state === "confirmed" ? "PAGAMENTO ADICIONAL CONFIRMADO" : "PEDIDO ORIGINAL MANTIDO"}</h1>
            <p>{state === "confirmed"
              ? "Seu pagamento adicional foi aprovado. Guarde os comprovantes dos dois pedidos."
              : "Você recusou o kit opcional. Seu pedido anterior não foi alterado."}</p>
            <Link to="/pedido" className="mst-upsell-return">Acompanhar meu pedido <ArrowRight size={16} /></Link>
          </div>
        ) : payment ? (
          <section className="mst-upsell-payment" aria-label="Pagamento do kit opcional">
            <div className="mst-kicker">Pedido adicional · {money(UPSELL_AMOUNT)}</div>
            <h1 className="mst-h2">FINALIZE O <span className="mst-lime">KIT EXTRA</span></h1>
            <p className="mst-sub">Este Pix é separado e não altera o pagamento anterior.</p>
            <Payment
              payment={payment}
              showBack={false}
              onApproved={onUpsellApproved}
              amount={UPSELL_AMOUNT}
              summary={summary}
            />
            <button type="button" className="mst-upsell-skip" onClick={declineOffer}>
              Não quero prosseguir com este Pix adicional
            </button>
          </section>
        ) : (
          <section className="mst-upsell-offer" aria-label="Oferta adicional opcional">
            <div className="mst-upsell-eyebrow"><span aria-hidden="true">✦</span> VOCÊ TAMBÉM PODE LEVAR</div>
            <h1>4 PULSEIRAS <span>+ FONES SEM FIO</span></h1>
            <p className="mst-upsell-sub">Kit com visual inspirado na Monster: quatro pulseiras e fones Bluetooth com estojo temático.</p>
            <div className="mst-upsell-image">
              <picture>
                <source type="image/avif" srcSet="/images/upsell-kit-hq.avif" />
                <img
                  src="/images/upsell-kit-hq.webp"
                  alt="Quatro pulseiras temáticas verdes, pretas e brancas ao lado de fones sem fio brancos com estojo preto e verde"
                  width={900}
                  height={900}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
              </picture>
              <span className="mst-upsell-photo-tag">KIT COM 5 ITENS</span>
            </div>
            <div className="mst-upsell-details">
              <div className="mst-upsell-detail"><Check size={17} aria-hidden="true" /> 4 pulseiras temáticas</div>
              <div className="mst-upsell-detail"><Check size={17} aria-hidden="true" /> 1 par de fones Bluetooth com estojo temático</div>
            </div>
            <div className="mst-upsell-price">
              <span>VALOR DO KIT OPCIONAL</span>
              <strong>{money(UPSELL_AMOUNT)}</strong>
            </div>
            <p className="mst-upsell-clarity">
              Compra separada, mediante novo Pix. Os fones não são anunciados como AirPods oficiais da Apple ou como edição licenciada. Confirme as especificações e o fabricante antes de comprar.
            </p>
            {error && <p className="mst-err" role="alert">{error}</p>}
            {state === "preview" && (
              <p className="mst-upsell-preview" role="status">
                Prévia do Upsell 1: para gerar um Pix real, conclua a compra inicial e aguarde a aprovação.
              </p>
            )}
            {state === "checking" && <p className="mst-upsell-preview" role="status">Verificando a compra anterior…</p>}
            <Action className="mst-upsell-accept" type="button" disabled={state !== "ready" || pending} onClick={acceptOffer}>
              {pending ? "GERANDO PIX…" : "SIM, QUERO O KIT POR R$ 39,90"}
            </Action>
            <button className="mst-upsell-skip" type="button" onClick={declineOffer}>
              Não, obrigado. Quero finalizar meu pedido.
            </button>
            <div className="mst-upsell-safe"><ShieldCheck size={15} aria-hidden="true" /> O pedido original permanece pago mesmo se você recusar esta oferta.</div>
          </section>
        )}
      </div>
    </main>
  );
}
