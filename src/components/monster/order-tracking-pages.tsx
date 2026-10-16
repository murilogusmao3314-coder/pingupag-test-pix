import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, CheckCheck, Clipboard, MapPin, Package, RotateCw, ShieldCheck, Truck, Search, BadgeCheck, LockKeyhole, CircleDot, Sparkles } from "lucide-react";
import { getOrderTracking } from "@/lib/order-tracking.functions";
import { recentTrackingCodes, rememberTrackingCode, resolveSavedTrackingCode } from "./tracking-client";
import "./order-tracking.css";

type TrackingData = Awaited<ReturnType<typeof getOrderTracking>>; 
type View = "initial" | "loading" | "invalid" | "not_found" | "unavailable" | "pending" | "ended" | "found";
const CODE_PATTERN = /^(?:CR[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}|MST-[0-9A-F]{32}-[0-9A-F]{24})$/;
const STEPS = [
  ["Pedido recebido", "O pedido foi registrado para acompanhamento."],
  ["Pedido em preparação", "Etapa de preparação do pedido."],
  ["Preparação do envio", "Organização do processo de envio."],
  ["Encaminhamento para o destino", "Etapa de encaminhamento prevista no acompanhamento."],
  ["Etapa final de entrega", "Acompanhamento na fase final."],
  ["Aguarde a entrega", "Acompanhe novas informações nesta página."],
] as const;

function Brand({ small = false }: { small?: boolean }) {
  return <header className="trk-brand">
    <a href="/" aria-label="Voltar à loja" className="trk-brand-logo"><img src="/images/monster-logo.png" alt="Monster" /></a>
    <span>{small ? "CONFIRMAÇÃO DE PEDIDO" : "ACOMPANHAMENTO DO PEDIDO"}</span>
    <ShieldCheck size={19} aria-hidden="true" />
  </header>;
}
function FormatAddress({ address }: { address: NonNullable<Extract<TrackingData, { ok: true }>["address"]> }) {
  const street = [address.street, address.number].filter(Boolean).join(", ");
  const region = [address.neighborhood, address.city, address.state].filter(Boolean).join(" · ");
  return <div className="trk-address">
    <MapPin size={20} aria-hidden="true" />
    <div><strong>Destino informado no pedido</strong>
      {street && <p>{street}</p>}
      {address.complement && <p>{address.complement}</p>}
      {region && <p>{region}</p>}
      {address.zipcode && <p>CEP: {address.zipcode.replace(/^(\d{5})(\d{3})$/, "$1-$2")}</p>}
    </div>
  </div>;
}
function TrackingOverview({ data }: { data: Extract<TrackingData, { ok: true }> }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(data.trackingCode);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return <div className="trk-detail">
    <div className="trk-item-summary">
      <div className="trk-card-icon"><Package size={22} aria-hidden="true" /></div>
      <span className="trk-eyebrow">PEDIDO CONFIRMADO</span>
      <h2>{data.product}</h2>
      <div className="trk-codebox"><div><small>CÓDIGO DE ACOMPANHAMENTO</small><strong className="trk-track-number">{data.trackingCode}</strong></div>
        <button className="trk-copy" type="button" onClick={copyCode}><Clipboard size={17} /> {copied ? "Copiado" : "Copiar"}</button>
      </div>
      {copyError && <p className="trk-help" role="alert">Não foi possível copiar automaticamente. Selecione o código acima para copiar.</p>}
      {data.address && <FormatAddress address={data.address} />}
      {!data.address && <p className="trk-help">Os dados de endereço não foram disponibilizados nesta consulta. O código continua válido para acompanhamento.</p>}
    </div>
    <section className="trk-journey" aria-label="Etapas do acompanhamento">
      <div className="trk-journey-top">
        <div className="trk-journey-title"><div className="trk-card-icon"><Truck size={21} aria-hidden="true" /></div><span className="trk-eyebrow">ACOMPANHAMENTO</span><h2 className={data.stage === 6 ? "trk-last" : ""}>Etapas do seu pedido</h2></div>
        <span className="trk-step-count">{data.stage} de 6 etapas</span>
      </div>
      <ol className="trk-steps">
        {STEPS.map(([title, description], index) => {
          const number = index + 1;
          const completed = number <= data.stage;
          return <li className={(completed ? "is-complete " : "") + (number === data.stage ? "is-current" : "")} key={title}>
            <span className="trk-step-marker" aria-hidden="true">{completed ? <Check size={16} strokeWidth={3} /> : <CircleDot size={14} />}</span>
            <div className="trk-step-copy"><strong>{title}</strong><span>{description}</span></div>
            {number === data.stage && <span className="trk-now">ETAPA ATUAL</span>}
          </li>;
        })}
      </ol>
      {!data.timelineAvailable && <p className="trk-help">As próximas etapas serão atualizadas quando houver informações suficientes sobre a confirmação do pedido.</p>}
    </section>
  </div>;
}

export function TrackingPage() {
  const findTracking = useServerFn(getOrderTracking);
  const [text, setText] = useState("");
  const [view, setView] = useState<View>("initial");
  const [details, setDetails] = useState<Extract<TrackingData, { ok: true }> | null>(null);
  const request = useRef(0);
  const lookup = useCallback(async (code: string, updateUrl = true) => {
    const cleaned = code.trim().toUpperCase();
    setText(cleaned);
    setDetails(null);
    const current = ++request.current;
    if (!CODE_PATTERN.test(cleaned)) { setView("invalid"); return; }
    setView("loading");
    const began = Date.now();
    let response: TrackingData | null = null;
    try { response = await findTracking({ data: { code: resolveSavedTrackingCode(cleaned) } }); }
    catch { /* The lookup should still display an explicit communication failure. */ }
    const remaining = 2000 - (Date.now() - began);
    if (remaining > 0) await new Promise<void>((resolve) => setTimeout(resolve, remaining));
    if (current !== request.current) return;
    if (!response) { setView("unavailable"); return; }
    if (!response.ok) {
      setView(response.code === "INVALID_CODE" ? "invalid" : response.code === "NOT_FOUND" ? "not_found" : "unavailable");
      return;
    }
    if (response.status !== "approved") { setView(response.status === "pending" ? "pending" : "ended"); return; }
    rememberTrackingCode(response.accessCode, response.trackingCode);
    setText(response.trackingCode);
    setDetails(response);
    setView("found");
    if (updateUrl) window.history.replaceState(null, "", "/rastrear?acesso=" + encodeURIComponent(response.accessCode));
  }, [findTracking]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("acesso") ?? params.get("codigo");
    if (code) void lookup(code, false);
    return () => { request.current++; };
  }, [lookup]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookup(text);
  }
  return <main className="trk-shell">
    <Brand />
    <div className="trk-wrap">
      <div className="trk-notice"><ShieldCheck size={20} aria-hidden="true" /><p><strong>Canal de acompanhamento da loja.</strong> Consulte as atualizações do seu pedido por esta página e salve o link para futuras consultas. Para dúvidas sobre entrega, entre em contato com a loja.</p></div>
      <div className="trk-hero"><div className="trk-hero-mark"><Package size={28} strokeWidth={1.7} /></div><div className="trk-eyebrow">SEU PEDIDO, EM UM SÓ LUGAR</div>
        <h1>Acompanhe seu <em>pedido.</em></h1>
        <p>Digite o código recebido após a aprovação do pagamento para consultar as informações disponíveis.</p>
      </div>
      <form className="trk-search" onSubmit={submit}>
        <label htmlFor="tracking-code">Código de acompanhamento</label>
        <div className="trk-search-row"><input id="tracking-code" value={text} autoComplete="off" spellCheck={false} onChange={e => setText(e.target.value)} placeholder="CRXXXXXXXXXX" maxLength={75} aria-invalid={view === "invalid" || view === "not_found"} />
          <button type="submit" disabled={view === "loading"}><Search size={18} aria-hidden="true" /> Consultar</button></div>
      </form>
      {view === "loading" && <div className="trk-state" role="status"><RotateCw className="trk-spin" size={25} /><h2>Consultando seu pedido…</h2><p>Verificando as informações no sistema.</p></div>}
      {view === "initial" && <div className="trk-state trk-state-initial"><Package size={28} /><h2>Seu acompanhamento começa aqui</h2><p>Informe seu código no campo acima.</p></div>}
      {(view === "invalid" || view === "not_found" || view === "unavailable" || view === "pending" || view === "ended") &&
        <div className="trk-state" role="status"><Package size={26} />
          <h2>{view === "invalid" ? "Código inválido" : view === "not_found" ? "Pedido não encontrado" : view === "pending" ? "Pagamento em análise" : view === "ended" ? "Acompanhamento indisponível" : "Não foi possível consultar agora"}</h2>
          <p>{view === "invalid" ? "Confira os caracteres e tente novamente." : view === "not_found" ? "Não encontramos um pedido com esse código." : view === "pending" ? "Aguardando a confirmação real do pagamento." : view === "ended" ? "O pagamento deste pedido não está mais aprovado. Procure o suporte." : "Verifique sua conexão e tente consultar novamente."}</p>
          {(view === "unavailable" || view === "pending") && <button type="button" className="trk-retry" onClick={() => void lookup(text)}><RotateCw size={16} /> Consultar novamente</button>}
        </div>}
      {view === "found" && details && <TrackingOverview data={details} />}
      <div className="trk-footnote"><Truck size={18} /><span>Este acompanhamento é disponibilizado pela plataforma da loja. As etapas exibidas são estados internos de acompanhamento e não comprovam movimentações físicas da transportadora ou entrega.</span></div>
    </div>
  </main>;
}

export function ConfirmationPage() {
  const findTracking = useServerFn(getOrderTracking);
  const [view, setView] = useState<"checking" | "approved" | "unavailable" | "pending" | "missing">("checking");
  const [order, setOrder] = useState<Extract<TrackingData, { ok: true }> | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    const code = new URLSearchParams(window.location.search).get("acesso") ?? recentTrackingCodes()[0];
    if (!code) { setView("missing"); return; }
    setView("checking");
    void findTracking({ data: { code } }).then(result => {
      if (!live) return;
      if (result.ok && result.status === "approved") { rememberTrackingCode(result.accessCode, result.trackingCode); setOrder(result); setView("approved"); }
      else setView(result.ok && result.status === "pending" ? "pending" : "unavailable");
    }).catch(() => { if (live) setView("unavailable"); });
    return () => { live = false; };
  }, [findTracking, retry]);
  return <main className="trk-shell"><Brand small /><div className="trk-wrap">
    <section className="trk-confirm" role="status">
      {view === "approved" ? <><div className="trk-success-symbol"><CheckCheck size={42} /></div>
          <span className="trk-eyebrow">COMPRA CONFIRMADA</span><h1>Pagamento <em>aprovado!</em></h1>
          <p>Seu pagamento foi confirmado e o pedido foi registrado para acompanhamento.</p>
          {order && <div className="trk-confirm-product"><Package size={18} />{order.product}</div>}
          {order && <div className="trk-confirm-code"><small>SEU CÓDIGO DE ACOMPANHAMENTO</small><strong className="trk-track-number">{order.trackingCode}</strong></div>}
          <div className="trk-confirm-notice"><ShieldCheck size={18} /><span>Guarde este link. O acompanhamento do pedido estará disponível na página da loja, com as atualizações registradas em nosso sistema.</span></div>
          {order && <a className="trk-primary" href={"/rastrear?acesso=" + encodeURIComponent(order.accessCode)}>Acompanhar meu pedido <ArrowRight size={19} /></a>}
        </> : <>
          <div className="trk-confirm-icon"><Package size={35} /></div>
          <h1>{view === "checking" ? "Conferindo pagamento…" : view === "pending" ? "Aguardando aprovação" : view === "missing" ? "Localize seu pedido" : "Consulta indisponível"}</h1>
          <p>{view === "checking" ? "Consultando o status confirmado no sistema." : view === "pending" ? "O pagamento ainda não foi aprovado. Você pode consultar novamente." : view === "missing" ? "Abra seu código de acompanhamento para verificar um pedido." : "Não foi possível confirmar o pagamento neste momento. Tente novamente."}</p>
          {(view === "pending" || view === "unavailable") && <button type="button" className="trk-primary" onClick={() => setRetry(v => v + 1)}><RotateCw size={18} /> Consultar novamente</button>}
          <a href="/rastrear" className="trk-secondary">Consultar com meu código <ArrowRight size={17} /></a>
        </>}
    </section>
  </div></main>;
}

/** Isolated internal visual preview. It never requests or changes payment status. */
export function InternalTrackingPreview() {
  const [code, setCode] = useState<"CR-DEMO001" | "CR-DEMO002">("CR-DEMO001");
  const [page, setPage] = useState<"confirmacao" | "rastreio">("confirmacao");
  const data: Extract<TrackingData, { ok: true }> = {
    ok: true, status: "approved", trackingCode: code, accessCode: "",
    product: "Copo térmico Monster 1,15L", address: null,
    stage: code === "CR-DEMO001" ? 2 : 5, timelineAvailable: true,
  };
  return <main className="trk-shell">
    <Brand small={page === "confirmacao"} />
    <div className="trk-wrap">
      <div className="trk-preview-alert" role="status">
        <LockKeyhole size={18} aria-hidden="true" />
        <span><b>Prévia interna para a equipe.</b> Os códigos desta tela não representam pagamentos ou rastreamentos reais.</span>
      </div>
      <nav className="trk-preview-nav" aria-label="Exemplos de teste">
        {(["CR-DEMO001", "CR-DEMO002"] as const).map((item) =>
          <button type="button" key={item} onClick={() => { setCode(item); setPage("confirmacao"); }}
            aria-pressed={code === item} className={code === item ? "is-selected" : ""}>{item}</button>)}
      </nav>
      {page === "confirmacao" ? <section className="trk-confirm trk-preview-confirm" aria-label="Prévia da página de aprovação">
        <div className="trk-success-symbol"><CheckCheck size={42} /></div>
        <span className="trk-eyebrow">EXEMPLO DE PÓS-VENDA</span>
        <h1>Pagamento <em>aprovado!</em></h1>
        <p>Seu pagamento foi confirmado e o pedido foi registrado para acompanhamento.</p>
        <div className="trk-confirm-product"><Package size={18} />{data.product}</div>
        <div className="trk-confirm-code"><small>SEU CÓDIGO DE ACOMPANHAMENTO</small><strong className="trk-track-number">{code}</strong></div>
        <div className="trk-confirm-notice"><ShieldCheck size={18} /><span>Guarde este link. O acompanhamento do pedido estará disponível na página da loja, com as atualizações registradas em nosso sistema.</span></div>
        <button type="button" className="trk-primary" onClick={() => setPage("rastreio")}>Acompanhar meu pedido <ArrowRight size={19} /></button>
      </section> : <>
        <div className="trk-hero trk-preview-heading"><div className="trk-hero-mark"><Sparkles size={26} /></div>
          <span className="trk-eyebrow">ACOMPANHAMENTO INDIVIDUAL</span><h1>Seu pedido, <em>etapa por etapa.</em></h1>
          <p>Consulte o progresso do seu pedido diretamente em nossa página de acompanhamento.</p></div>
        <TrackingOverview data={data} />
        <button type="button" className="trk-retry trk-preview-back" onClick={() => setPage("confirmacao")}>Voltar à confirmação</button>
      </>}
      <div className="trk-footnote"><BadgeCheck size={18} /><span>Visualização para conferência da interface. Nenhum Pix é criado e nenhum pedido real é consultado.</span></div>
    </div>
  </main>;
}
