import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Clock3, ShieldCheck } from "lucide-react";
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

/** Bespoke angular shipping marks for this upsell; not generic icon-library glyphs. */
type PriorityIconKind = "sorting" | "dispatch" | "support";

function PriorityIcon({ kind }: { kind: PriorityIconKind }) {
  return <svg className="pru-custom-icon" viewBox="0 0 44 44" fill="none" aria-hidden="true" focusable="false">
    {kind === "sorting" ? <>
      <path d="M7 15.5 21.8 8l15 7.5-15 7.8L7 15.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="m7 15.5 0 14.4 14.8 7.5 0-14.1m15-7.8v14.4l-15 7.5M21.8 8v15.3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="m11.4 9.9 4-3.5m-1.3 7.8 5-4.4" stroke="#b4f56d" strokeWidth="2.1" strokeLinecap="square"/>
      <path d="m25.7 17.4 6.7-3.5" stroke="#b4f56d" strokeWidth="2.4" strokeLinecap="square"/>
      <path d="m27 27 3.7-2v5.3L27 32.4V27Z" fill="#a6ff00" fillOpacity=".85"/>
    </> : kind === "dispatch" ? <>
      <path d="M13 11.5 23.7 6l11.2 6.4v13L23.7 32 13 25.5v-14Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="m13 11.5 10.7 6.7 11.2-5.8m-11.2 5.8V32" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round"/>
      <path d="M4.3 20.4h12.4m-9.4 5h10.6M4.3 30.4h11.1" stroke="#bcff75" strokeWidth="2.6" strokeLinecap="square"/>
      <path d="m28.5 35 7.8-4.2m-4.1 5.9 5.6-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square"/>
    </> : <>
      <path d="M10 11.5h24v19.1H19.5l-7.4 5V30.6H10V11.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M15.6 17.8h12.7" stroke="#a6ff00" strokeWidth="1.9" strokeLinecap="square"/>
      <text x="22" y="27.2" fill="#d4ff9b" fontFamily="ui-monospace, monospace" fontSize="9.8" fontWeight="800" textAnchor="middle" letterSpacing="-.6">2H</text>
      <path d="m32.7 6 2.1-2.1M8.6 8.4 6 5.9" stroke="#b4f56d" strokeWidth="2" strokeLinecap="square"/>
    </>}
  </svg>;
}



/** Scalable box art designed for the site, without low-resolution raster scaling. */
function PremiumParcel() {
  return (
    <svg className="pru-package" viewBox="0 0 260 250" fill="none" role="img" aria-label="Caixa temática de envio com acabamento kraft, preto e verde" focusable="false">
      <defs>
        <linearGradient id="pru-box-top" x1="46" y1="39" x2="191" y2="115" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F7D4A1"/><stop offset=".56" stopColor="#D4A16B"/><stop offset="1" stopColor="#F8D4A2"/>
        </linearGradient>
        <linearGradient id="pru-box-front" x1="27" y1="93" x2="124" y2="230" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E2B184"/><stop offset="1" stopColor="#A56B3E"/>
        </linearGradient>
        <linearGradient id="pru-box-side" x1="125" y1="110" x2="230" y2="220" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C28D57"/><stop offset="1" stopColor="#754824"/>
        </linearGradient>
        <linearGradient id="pru-box-tape" x1="100" y1="37" x2="169" y2="152" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3D4240"/><stop offset=".5" stopColor="#161B1C"/><stop offset="1" stopColor="#080B0E"/>
        </linearGradient>
        <filter id="pru-box-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.8"/>
        </filter>
      </defs>
      <ellipse cx="132" cy="229" rx="94" ry="12" fill="#A6FF00" fillOpacity=".14" filter="url(#pru-box-glow)"/>
      <path d="M22 75 122 24 239 83 135 127 22 75Z" fill="url(#pru-box-top)" stroke="#F5D0A0" strokeWidth="2.2" strokeLinejoin="round"/>
      <path d="M22 75 135 127 135 225 22 176V75Z" fill="url(#pru-box-front)" stroke="#DEB58B" strokeWidth="2.2" strokeLinejoin="round"/>
      <path d="M135 127 239 83V182L135 225V127Z" fill="url(#pru-box-side)" stroke="#9B653B" strokeWidth="2.2" strokeLinejoin="round"/>
      <path d="M84 44 110 31 214 95 184 108 84 44Z" fill="url(#pru-box-tape)"/>
      <path d="M118 112 142 122 142 153 118 144V112Z" fill="#171B1C" opacity=".86"/>
      <path d="M36 185 55 193 135 223V206L32 168 22 162V178L36 185Z" fill="#191C1C"/>
      <path d="M144 206 232 168V188L144 223V206Z" fill="#171C1C"/>
      <path d="M32 163 44 169 135 209M144 208 229 170" stroke="#9BE600" strokeWidth="3" opacity=".9"/>
      <path d="M176 110 228 87 239 83V120L215 132 239 94" fill="#151717" opacity=".88"/>
      <path d="m188 198 38-74-8 42-21 35 26-26-17 30" fill="#9CE900" opacity=".88"/>
      <path d="m37 111 4 7 10 3m10-11 4 6 9 2m11-11 5 6" stroke="#3E2E20" strokeWidth="2" strokeLinecap="square" opacity=".55"/>
      <path d="M51 101c13 4 25 6 32 4 4 5 12 6 18 6l-4 11-5-2-7 48-9 27-2-17 5-61-10-2-3 48-6 28-2-19 3-58-9-4-5 46-4 17-1-21 3-58-8-4 15-9Z" fill="#111A10" opacity=".95"/>
      <path d="m55 108 13 5-8 55-3 12-1-16 3-49-6-2m22 4 10 2-8 57-4 11 1-19 4-46m14 2 7-2-7 48-5 14 1-18 6-44" stroke="#A6FF00" strokeWidth="5.2" strokeLinecap="square" strokeLinejoin="round"/>
      <path d="M38 150h20v22H38z" stroke="#795536" strokeOpacity=".2"/>
      <path d="M41 157v14m3-14v14m3-14v14m2-14v14m4-14v14" stroke="#33281D" strokeWidth="1.5" opacity=".62"/>
      <path d="M35 79v95m1-96 98 46m99-38-97 41" stroke="#FFF0D1" strokeOpacity=".35" strokeWidth="1.5"/>
      <path d="M178 66 210 84" stroke="#C0F268" strokeWidth="1.8" opacity=".72"/>
      <path d="M141 225 239 183" stroke="#2C1B0B" strokeWidth="2" opacity=".6"/>
    </svg>
  );
}

/** Precisely scalable ninety-day warranty insignia, replacing the raster seal. */
function WarrantyInsignia() {
  return (
    <svg className="pru-guarantee" viewBox="0 0 96 96" fill="none" role="img" aria-label="Selo de garantia de 90 dias" focusable="false">
      <defs>
        <linearGradient id="pru-warranty-gold" x1="16" y1="9" x2="83" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF0A1" />
          <stop offset=".38" stopColor="#DAA935" />
          <stop offset=".73" stopColor="#947021" />
          <stop offset="1" stopColor="#F4D16F" />
        </linearGradient>
        <linearGradient id="pru-warranty-dark" x1="23" y1="14" x2="76" y2="83" gradientUnits="userSpaceOnUse">
          <stop stopColor="#25301B"/>
          <stop offset="1" stopColor="#0A100C"/>
        </linearGradient>
      </defs>
      <path d="M48 4 83 15 89 49 75 77 48 92 21 77 7 49 13 15 48 4Z" fill="url(#pru-warranty-gold)"/>
      <path d="M48 10 78 20 83 49 70 73 48 85 26 73 13 49 18 20 48 10Z" fill="url(#pru-warranty-dark)" stroke="#FAE298" strokeWidth="1.2"/>
      <path d="M48 14 74 23 79 49 67 70 48 80 29 70 17 49 22 23 48 14Z" stroke="#A7EA52" strokeOpacity=".55" strokeWidth="1"/>
      <path d="m34 24 14-5 14 5" stroke="#E6CA78" strokeWidth="1.4" strokeLinecap="square"/>
      <text x="48" y="57" fill="#F7D86D" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="33" fontWeight="900" textAnchor="middle" letterSpacing="-2.5">90</text>
      <path d="M30 61H66" stroke="#9EE447" strokeWidth="1.5"/>
      <text x="48" y="71" fill="#EAD9A1" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="9" fontWeight="800" textAnchor="middle" letterSpacing="2.2">DIAS</text>
      <circle cx="48" cy="14" r="2" fill="#D8F69D"/>
    </svg>
  );
}

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
            <div className="pru-payment-art"><PremiumParcel /></div>
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
              <PremiumParcel />
              <span className="pru-visual-caption">PREPARAÇÃO COM CUIDADO EXTRA</span>
            </div>
            <span className="pru-eyebrow">ATENDIMENTO + EXPEDIÇÃO PRIORITÁRIOS</span>
            <h1>Seu pedido confirmado. <em>Quer prioridade?</em></h1>
            <p className="pru-lead">Adicione um cuidado extra à preparação e ao atendimento do seu pedido. Uma única contratação opcional de <strong>{money(UPSELL_AMOUNT)}</strong>.</p>

            <div className="pru-benefits" aria-label="Benefícios do serviço">
              <div className="pru-benefit"><span className="pru-benefit-mark pru-benefit-sort"><PriorityIcon kind="sorting" /></span><p><strong>Separação prioritária</strong><small>Seu pedido ganha prioridade na fila interna de preparação.</small></p><b className="pru-benefit-id">01</b></div>
              <div className="pru-benefit"><span className="pru-benefit-mark pru-benefit-freight"><PriorityIcon kind="dispatch" /></span><p><strong>Encaminhamento prioritário</strong><small>Tratamento prioritário pela loja, sujeito à operação de envio.</small></p><b className="pru-benefit-id">02</b></div>
              <div className="pru-benefit pru-benefit-warranty"><WarrantyInsignia /><p><strong>Garantia estendida a 90 dias</strong><small>Mais cobertura sobre os produtos elegíveis do pedido.</small></p></div>
              <div className="pru-benefit"><span className="pru-benefit-mark pru-benefit-time"><PriorityIcon kind="support" /></span><p><strong>Suporte em até 2 horas</strong><small>Prioridade na primeira resposta durante o horário de atendimento.</small></p><b className="pru-benefit-id">04</b></div>
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
