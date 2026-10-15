import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clipboard, Coffee, LockKeyhole, ShieldCheck, Sparkles, Truck, Zap } from "lucide-react";
import { createPix } from "@/lib/pix.functions";

type Step = "welcome" | "quiz" | "checking" | "result" | "checkout" | "payment";
type Result = Awaited<ReturnType<typeof createPix>>;

const productImage = "https://monster.primewall.online/copo-quiz/assets/copo-frente.png";
const TEST_AMOUNT = 100;
const price = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(TEST_AMOUNT / 100);

const questions = [
  { category: "ROTINA", title: "Sua bebida esquenta antes de você terminar?", choices: ["Sim, sempre. No fim já está morna", "Não, eu bebo rápido"] },
  { category: "PREFERÊNCIA", title: "Em qual momento um copo térmico seria mais útil?", choices: ["No trabalho ou nos estudos", "Em passeios e viagens"] },
  { category: "TEMPERATURA", title: "O que você costuma levar na garrafa?", choices: ["Água ou bebida bem gelada", "Café ou bebida quente"] },
  { category: "DIA A DIA", title: "Você passa muito tempo fora de casa?", choices: ["Sim, quase o dia inteiro", "Não, só algumas horas"] },
  { category: "PRATICIDADE", title: "O que faz mais diferença para você?", choices: ["Conservar a temperatura", "Ter bastante capacidade"] },
  { category: "ESTILO", title: "Você prefere acessórios com qual visual?", choices: ["Discreto e minimalista", "Marcante e esportivo"] },
  { category: "TRANSPORTE", title: "Onde você mais levaria o copo?", choices: ["Na mochila ou no carro", "Na mesa ou na academia"] },
  { category: "USO", title: "Com que frequência você usaria um copo térmico?", choices: ["Todos os dias", "Nos fins de semana"] },
  { category: "FINAL", title: "Quer conhecer mais detalhes do copo de 1,15 litro?", choices: ["Sim, quero conhecer", "Quero ver as características"] },
] as const;

function ProductImage({ className = "" }: { className?: string }) {
  return <img className={`mq-product ${className}`} src={productImage} alt="Copo térmico preto e verde de 1,15 litro" loading="lazy" />;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Desafio do Copo | Experiência demonstrativa" },
      { name: "description", content: "Quiz interativo de nove etapas com demonstração de checkout e Pix." },
      { property: "og:title", content: "Desafio do Copo" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: QuizCheckout,
});

function QuizCheckout() {
  const createPayment = useServerFn(createPix);
  const [step, setStep] = useState<Step>("welcome");
  const [answers, setAnswers] = useState<number[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [payment, setPayment] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (step !== "checking") return;
    const timer = window.setTimeout(() => setStep("result"), 1250);
    return () => window.clearTimeout(timer);
  }, [step]);

  function choose(index: number) {
    setAnswers((old) => {
      const next = old.slice(0, questionIndex);
      next.push(index);
      return next;
    });
    if (questionIndex === questions.length - 1) {
      setStep("checking");
    } else {
      setQuestionIndex((n) => n + 1);
    }
  }

  function goBack() {
    if (step === "quiz") {
      if (questionIndex > 0) setQuestionIndex((n) => n - 1);
      else setStep("welcome");
    } else if (step === "checkout") setStep("result");
    else if (step === "result") {
      setStep("quiz");
      setQuestionIndex(questions.length - 1);
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const field = (key: string) => String(form.get(key) ?? "").trim();
    setPending(true);
    setPayment(null);
    try {
      const response = await createPayment({
        data: {
          amount: TEST_AMOUNT,
          description: "Copo térmico 1,15 L — demonstração Pix",
          name: field("name"),
          email: field("email"),
          document: field("document").replace(/\D/g, ""),
          phone: field("phone").replace(/\D/g, ""),
        },
      });
      setPayment(response);
      if (response.ok && response.qr_code) setStep("payment");
    } catch (error) {
      setPayment({ ok: false, error: error instanceof Error ? error.message : "Não foi possível gerar o Pix." });
    } finally {
      setPending(false);
    }
  }

  async function copyCode() {
    if (!payment?.ok || !payment.qr_code) return;
    try {
      await navigator.clipboard.writeText(payment.qr_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  }

  const currentQuestion = questions[questionIndex];
  const qrImage = payment?.ok ? payment.qr_code_base64 : "";
  const qrSrc = qrImage && (qrImage.startsWith("data:image/") || qrImage.startsWith("https://"))
    ? qrImage
    : qrImage ? `data:image/png;base64,${qrImage}` : "";

  return (
    <main className="mq-app">
      <div className="mq-glow mq-glow-one" aria-hidden="true" />
      <div className="mq-glow mq-glow-two" aria-hidden="true" />
      <header className="mq-header">
        <a href="/" className="mq-brand" aria-label="Desafio do Copo — início">
          <span className="mq-brand-symbol"><Zap size={21} fill="currentColor" /></span>
          <span>DESAFIO<span className="mq-green">.</span>COPO</span>
        </a>
        <span className="mq-header-note"><span className="mq-online" /> Experiência demonstrativa</span>
      </header>

      <div className="mq-shell">
        {step === "welcome" && (
          <section className="mq-hero mq-enter">
            <div className="mq-hero-copy">
              <span className="mq-eyebrow"><Sparkles size={15} /> O DESAFIO DE HOJE</span>
              <h1>Seu dia merece <span className="mq-gradient">uma pausa gelada.</span></h1>
              <p>Responda 9 perguntas rápidas sobre sua rotina e conheça as características de um copo térmico de 1,15 litro.</p>
              <button className="mq-button mq-main-cta" onClick={() => { setStep("quiz"); setQuestionIndex(0); setAnswers([]); }}>
                Começar o desafio <ArrowRight size={20} />
              </button>
              <div className="mq-hero-metrics">
                <span><CheckCircle2 size={17} /> 9 perguntas</span>
                <span><CheckCircle2 size={17} /> Cerca de 1 minuto</span>
                <span><CheckCircle2 size={17} /> Sem respostas erradas</span>
              </div>
            </div>
            <div className="mq-product-stage">
              <span className="mq-ring mq-ring-a" aria-hidden="true" /><span className="mq-ring mq-ring-b" aria-hidden="true" />
              <span className="mq-feature-tag mq-tag-top"><span className="mq-tag-icon"><Coffee size={15}/></span> Capacidade 1,15 L</span>
              <ProductImage className="mq-hero-product" />
              <span className="mq-feature-tag mq-tag-bottom"><span className="mq-tag-icon"><ShieldCheck size={15}/></span> Parede dupla</span>
            </div>
          </section>
        )}

        {step === "quiz" && currentQuestion && (
          <section className="mq-quiz mq-enter" aria-live="polite">
            <div className="mq-quiz-top">
              <button className="mq-back" onClick={goBack} aria-label="Voltar"><ArrowLeft size={18}/> Voltar</button>
              <span>Pergunta <strong>{questionIndex + 1}</strong> de {questions.length}</span>
            </div>
            <div className="mq-progress" role="progressbar" aria-valuenow={questionIndex + 1} aria-valuemin={1} aria-valuemax={questions.length} aria-label="Progresso do quiz">
              <span style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} />
            </div>
            <div className="mq-quiz-card">
              <span className="mq-eyebrow mq-center">{currentQuestion.category}</span>
              <h1>{currentQuestion.title}</h1>
              <div className="mq-answers">
                {currentQuestion.choices.map((answer, index) => (
                  <button className="mq-answer" onClick={() => choose(index)} key={answer}>
                    <span className="mq-choice-mark">{String.fromCharCode(65 + index)}</span>
                    <span>{answer}</span>
                    <ArrowRight size={19} className="mq-choice-arrow"/>
                  </button>
                ))}
              </div>
            </div>
            <p className="mq-footnote"><ShieldCheck size={16} /> Não existe resposta errada — é só responder todas.</p>
          </section>
        )}

        {step === "checking" && (
          <section className="mq-status mq-enter" role="status">
            <span className="mq-spinner" />
            <span className="mq-eyebrow">CONFERINDO</span>
            <h1>Organizando suas respostas</h1>
            <p>Preparando o resumo da sua experiência.</p>
            <div className="mq-status-lines"><span><Check size={16}/> 9 respostas recebidas</span><span><Check size={16}/> Preferências registradas nesta sessão</span></div>
          </section>
        )}

        {step === "result" && (
          <section className="mq-result mq-enter">
            <div className="mq-result-title">
              <span className="mq-success"><Check size={23}/></span>
              <span className="mq-eyebrow">DESAFIO COMPLETO</span>
              <h1>Você chegou ao final<span className="mq-green">.</span></h1>
              <p>Conheça o copo térmico de 1,15 litro e as condições de demonstração do checkout.</p>
            </div>
            <div className="mq-result-card">
              <div className="mq-result-photo"><ProductImage /></div>
              <div className="mq-result-info">
                <span className="mq-eyebrow">DETALHES DO PRODUTO</span>
                <h2>Copo térmico 1,15 litro</h2>
                <p>Modelo esportivo com alça, tampa e canudo. Confira as condições reais de compra e entrega antes de efetuar qualquer pagamento.</p>
                <div className="mq-benefits"><span><Check size={17}/> Capacidade de 1,15 L</span><span><Check size={17}/> Estrutura de parede dupla</span><span><Check size={17}/> Alça para transporte</span></div>
                <div className="mq-price-label">Pagamento demonstrativo <strong>{price}</strong></div>
                <button className="mq-button" onClick={() => { setPayment(null); setStep("checkout"); }}>Continuar para o checkout <ArrowRight size={20}/></button>
                <button className="mq-text-button" onClick={goBack}>Voltar às perguntas</button>
              </div>
            </div>
          </section>
        )}

        {step === "checkout" && (
          <section className="mq-checkout mq-enter">
            <button className="mq-back" onClick={goBack}><ArrowLeft size={18}/> Voltar ao produto</button>
            <div className="mq-checkout-head">
              <span className="mq-eyebrow"><LockKeyhole size={15}/> PAGAMENTO PIX</span>
              <h1>Finalize o teste</h1>
              <p>Esta é uma demonstração do checkout. O valor abaixo é uma cobrança real caso você confirme no seu aplicativo bancário; não representa uma reserva ou compra com entrega.</p>
            </div>
            <div className="mq-checkout-grid">
              <form className="mq-form-card" onSubmit={submitPayment}>
                <h2>Dados para gerar o Pix</h2>
                <div className="mq-field"><label htmlFor="mq-name">Nome completo</label><input id="mq-name" name="name" autoComplete="name" minLength={2} maxLength={120} required placeholder="Seu nome completo" /></div>
                <div className="mq-field"><label htmlFor="mq-email">E-mail</label><input id="mq-email" name="email" type="email" maxLength={200} autoComplete="email" required placeholder="voce@exemplo.com" /></div>
                <div className="mq-double">
                  <div className="mq-field"><label htmlFor="mq-doc">CPF ou CNPJ</label><input id="mq-doc" name="document" inputMode="numeric" pattern="[0-9 ./-]{11,18}" autoComplete="off" required placeholder="Somente números" /></div>
                  <div className="mq-field"><label htmlFor="mq-phone">Celular com DDD</label><input id="mq-phone" name="phone" inputMode="tel" autoComplete="tel" maxLength={18} required placeholder="(11) 99999-9999" /></div>
                </div>
                {payment && !payment.ok && <p className="mq-error" role="alert">{payment.error}</p>}
                <button className="mq-button" type="submit" disabled={pending}>{pending ? <><span className="mq-button-spinner"/> Gerando Pix...</> : <>Gerar Pix de {price} <ArrowRight size={19}/></>}</button>
                <p className="mq-secure"><LockKeyhole size={14}/> Dados enviados à API de pagamento pelo servidor, sem expor a chave no navegador.</p>
              </form>
              <aside className="mq-order">
                <h2>Resumo do teste</h2>
                <div className="mq-order-product"><ProductImage /><div><strong>Copo térmico 1,15 L</strong><span>Transação demonstrativa • não inclui entrega</span></div></div>
                <div className="mq-order-line"><span>Valor do teste</span><strong>{price}</strong></div>
                <div className="mq-order-line mq-order-total"><span>Total do Pix</span><strong>{price}</strong></div>
                <div className="mq-order-disclosure"><ShieldCheck size={19}/><p>Não há promessa de prêmio, estoque reservado ou envio de produto nesta demonstração.</p></div>
              </aside>
            </div>
          </section>
        )}

        {step === "payment" && payment?.ok && (
          <section className="mq-payment mq-enter">
            <span className="mq-success"><Check size={23}/></span>
            <span className="mq-eyebrow">COBRANÇA CRIADA</span>
            <h1>Seu código Pix está pronto</h1>
            <p>Valor: <strong>{price}</strong>. A geração do código não significa que o pagamento foi recebido.</p>
            <div className="mq-pix-card">
              {qrSrc ? <img src={qrSrc} alt="QR Code para pagamento via Pix" className="mq-qr"/> : <div className="mq-qr-placeholder">QR Code indisponível. Use o código copia e cola abaixo.</div>}
              <label htmlFor="mq-pix-code">Pix copia e cola</label>
              <textarea id="mq-pix-code" value={payment.qr_code} readOnly rows={3} />
              <button className="mq-button" onClick={copyCode}>{copied ? <><Check size={19}/> Código copiado</> : <><Clipboard size={18}/> Copiar código Pix</>}</button>
              <p className="mq-pix-hint">Abra o aplicativo do seu banco, escolha Pix e confira o destinatário e o valor antes de pagar.</p>
            </div>
            <button className="mq-text-button" onClick={() => { setStep("checkout"); setPayment(null); }}>Voltar ao formulário</button>
          </section>
        )}
      </div>
      <footer className="mq-footer">
        <span><Zap size={17}/> DESAFIO.COPO</span>
        <span>Protótipo independente de quiz e checkout. Não afiliado à Monster Energy.</span>
        <span><Truck size={15}/> Nenhum frete ou entrega incluídos no teste</span>
      </footer>
    </main>
  );
}
