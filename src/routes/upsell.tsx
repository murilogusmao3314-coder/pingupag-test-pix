import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Clock3, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { Payment, type PixPayment } from "@/components/monster/payment";
import { rememberPendingPix } from "@/components/monster/pix-pending";
import { readUpsellOffer, readUpsellPayment, rememberUpsellPayment, forgetUpsellPayment, dismissUpsellOffer, type UpsellOffer } from "@/components/monster/upsell-session";
import { checkPixPayment } from "@/lib/pix.functions";
import { createUpsellPix, UPSELL_AMOUNT } from "@/lib/upsell.functions";
import { money } from "@/components/monster/checkout-schema";
import "./upsell.css";

export const Route = createFileRoute("/upsell")({
  head: () => ({ meta: [
    { title: "Serviço opcional de prioridade · Monster" },
    { name: "robots", content: "noindex,nofollow" },
    { name: "description", content: "Serviço de expedição e atendimento prioritários, opcional após a compra." },
  ] }),
  component: PriorityUpsell,
});

type OfferState = "checking" | "ready" | "preview" | "unavailable";

function PriorityUpsell() {
  const checkPayment = useServerFn(checkPixPayment);
  const createPayment = useServerFn(createUpsellPix);
  const [offer, setOffer] = useState<UpsellOffer | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [state, setState] = useState<OfferState>("checking");
  const [payment, setPayment] = useState<PixPayment | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    const saved = readUpsellOffer();
    if (!saved) {
      setState("preview");
      return () => { live = false; };
    }
    setOffer(saved);
    setAccessCode(saved.trackingAccess ?? "");
    const prior = readUpsellPayment();
    if (prior) setPayment(prior);
    void checkPayment({ data: { token: saved.parentToken } }).then((result) => {
      if (!live) return;
      // A previous/extra payment cannot authorize a service on a different order.
      if (result.ok && result.status === "approved" && result.kind !== "upsell" &&
          result.reference === saved.parentReference && result.tracking_code &&
          (!saved.trackingAccess || saved.trackingAccess === result.tracking_code)) {
        setAccessCode(result.tracking_code);
        setState("ready");
      } else {
        setState("unavailable");
      }
    }).catch(() => { if (live) setState("unavailable"); });
    return () => { live = false; };
  }, [checkPayment]);

  function continueToTracking() {
    // Both paths use the ORIGINAL front purchase's signed tracking access token.
    const access = accessCode || offer?.trackingAccess || readUpsellOffer()?.trackingAccess;
    if (offer) dismissUpsellOffer(offer.parentReference);
    forgetUpsellPayment();
    window.location.replace(access
      ? "/rastrear?acesso=" + encodeURIComponent(access)
      : "/pedido");
  }

  async function accept() {
    if (state !== "ready" || !offer || !accessCode || payment || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await createPayment({ data: { parentToken: offer.parentToken } });
      if (!response.ok) {
        setError(response.error);
        return;
      }
      const next: PixPayment = {
        qr_code: response.qr_code,
        qr_code_base64: response.qr_code_base64,
        tracking_token: response.tracking_token,
        order_reference: response.order_reference,
      };
      rememberPendingPix(response.tracking_token, response.order_reference);
      rememberUpsellPayment({
        ...next,
        tracking_token: response.tracking_token,
        order_reference: response.order_reference,
      });
      setPayment(next);
    } catch {
      setError("Não foi possível gerar o Pix do serviço. Seu pedido original continua confirmado.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mst pru-shell">
      <section className="pru-frame" aria-label="Oferta de serviço opcional após a compra">
        <div className="pru-overline"><span className="pru-pulse" /> ÚLTIMA ETAPA ANTES DO RASTREIO</div>
        {payment ? (
          <div className="pru-payment">
            <div className="pru-payment-art"><img src="/images/upsell-priority-box.avif" width={92} height={92} alt="Caixa de envio com identidade verde e preta" /></div>
            <span className="pru-eyebrow">SERVIÇO ADICIONAL · PIX SEPARADO</span>
            <h1>Confirme sua <em>prioridade.</em></h1>
            <p className="pru-lead">Este Pix de {money(UPSELL_AMOUNT)} é exclusivamente pelo serviço opcional. Seu pedido e código de rastreio original permanecem iguais.</p>
            <Payment payment={payment} amount={UPSELL_AMOUNT} showBack={false} showTrackingUnlock={false} onApproved={continueToTracking} />
            <p className="pru-information">Se já pagou o Pix adicional, aguarde a confirmação para registrar a contratação do serviço.</p>
            <button type="button" className="pru-decline" onClick={continueToTracking}>Não, prefiro a fila padrão</button>
          </div>
        ) : (
          <>
            <div className="pru-visual" aria-label="Apresentação do serviço de prioridade">
              <div className="pru-visual-orbit" aria-hidden="true"><span>PRIORIDADE</span><span>EXPEDIÇÃO</span></div>
              <img className="pru-package" src="/images/upsell-priority-box.avif" width={192} height={192} alt="Caixa kraft personalizada com detalhes pretos e verde neon" decoding="async" fetchPriority="high" />
              <span className="pru-visual-caption">PREPARAÇÃO COM CUIDADO EXTRA</span>
            </div>
            <span className="pru-eyebrow">ATENDIMENTO + EXPEDIÇÃO PRIORITÁRIOS</span>
            <h1>Seu pedido confirmado. <em>Quer prioridade?</em></h1>
            <p className="pru-lead">Adicione um cuidado extra à preparação e ao atendimento do seu pedido. Uma única contratação opcional de <strong>{money(UPSELL_AMOUNT)}</strong>.</p>

            <div className="pru-benefits" aria-label="Benefícios do serviço">
              <div className="pru-benefit"><span className="pru-benefit-mark"><PackageCheck size={22} strokeWidth={1.7} /></span><p><strong>Separação prioritária</strong><small>Seu pedido ganha prioridade na fila interna de preparação.</small></p><b className="pru-benefit-id">01</b></div>
              <div className="pru-benefit"><span className="pru-benefit-mark pru-benefit-freight"><Truck size={22} strokeWidth={1.7} /></span><p><strong>Encaminhamento prioritário</strong><small>Tratamento prioritário pela loja, sujeito à operação de envio.</small></p><b className="pru-benefit-id">02</b></div>
              <div className="pru-benefit pru-benefit-warranty"><img className="pru-guarantee" src="/images/upsell-warranty-90d.avif" width={92} height={92} alt="Selo dourado de garantia de 90 dias" decoding="async" /><p><strong>Garantia estendida a 90 dias</strong><small>Mais cobertura sobre os produtos elegíveis do pedido.</small></p></div>
              <div className="pru-benefit"><span className="pru-benefit-mark pru-benefit-time" aria-label="Duas horas">2<small>H</small></span><p><strong>Suporte em até 2 horas</strong><small>Prioridade na primeira resposta durante o horário de atendimento.</small></p><b className="pru-benefit-id">04</b></div>
            </div>

            <div className="pru-price-card">
              <div><span>SERVIÇO ÚNICO E OPCIONAL</span><strong>{money(UPSELL_AMOUNT)}</strong></div>
            </div>

            {error && <div role="alert" className="pru-error">{error}</div>}
            {state !== "ready" && <p className="pru-status" role="status">
              {state === "checking" ? "Verificando a compra anterior…" : state === "preview"
                ? "Esta página só libera a contratação após uma compra aprovada."
                : "A confirmação anterior não está disponível para nova contratação. Seu rastreio continua acessível."}
            </p>}
            <button className="pru-cta" type="button" disabled={state !== "ready" || pending} onClick={accept}>
              {pending ? "Preparando Pix do serviço…" : <>SIM, QUERO PRIORIDADE POR {money(UPSELL_AMOUNT)} <ArrowRight size={20} aria-hidden="true" /></>}
            </button>
            <button type="button" className="pru-decline" onClick={continueToTracking}>Não, prefiro a fila padrão</button>
            <div className="pru-after"><Clock3 size={16} aria-hidden="true" /> Após esta etapa, você acessa o rastreio do pedido com o mesmo código, aceitando ou não.</div>
          </>
        )}
        <div className="pru-security"><ShieldCheck size={15} aria-hidden="true" /> Serviço opcional · Pedido original preservado · Nenhum débito automático</div>
      </section>
    </main>
  );
}
