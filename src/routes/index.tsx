import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Action, Photo } from "@/components/monster/primitives";
import { Quiz } from "@/components/monster/quiz";
import { Prize, ResultSections } from "@/components/monster/result-sections";
import { Checkout } from "@/components/monster/checkout";
import { assets } from "@/components/monster/assets";
import { cn } from "@/lib/utils";
import { trackMeta, orderMeta } from "@/lib/meta-events";
import {
  QUIZ_SESSION_KEY,
  restoreQuizSession,
  serializeQuizSession,
  quizPreferences,
  type QuizScreen,
} from "@/components/monster/quiz-session";
type Screen = QuizScreen;
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Desafio Monster · Responda o Quiz e Leve o Copo 1,15L" },
      {
        name: "description",
        content:
          "Responda as 9 perguntas do Desafio Monster e conheça o copo térmico de 1,15L. Resgate com entrega PAC ou SEDEX e pagamento Pix.",
      },
      { property: "og:title", content: "Desafio Monster · Copo Térmico 1,15L grátis" },
      {
        property: "og:description",
        content:
          "9 perguntas rápidas e o Copo Térmico Monster 1,15L de R$ 197 sai por R$ 0. Você paga o envio e os adicionais escolhidos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: assets["copo-frente.png"] },
      { name: "twitter:image", content: assets["copo-frente.png"] },
    ],
  }),
  component: MonsterExperience,
});
function MonsterExperience() {
  const [sessionReady, setSessionReady] = useState(false);
  const [screen, setScreen] = useState<Screen>("welcome");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [selecting, setSelecting] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(600);
  const [analysis, setAnalysis] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    try {
      const saved = restoreQuizSession(window.sessionStorage.getItem(QUIZ_SESSION_KEY));
      if (saved) {
        setScreen(saved.screen);
        setIndex(saved.index);
        setAnswers(saved.answers);
        setDeadline(saved.deadline);
      }
    } catch {
      /* The quiz remains usable when session storage is blocked. */
    }
    setSessionReady(true);
  }, []);
  useEffect(() => {
    if (!sessionReady) return;
    try {
      window.sessionStorage.setItem(
        QUIZ_SESSION_KEY,
        serializeQuizSession({ screen, index, answers, deadline }),
      );
    } catch {
      /* No personal data is persisted. */
    }
  }, [sessionReady, screen, index, answers, deadline]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    if (screen === "quiz") document.getElementById("quiz-question")?.focus({ preventScroll: true });
  }, [screen, index]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (screen !== "checking") return;
    const start = Date.now();
    const interval = setInterval(
      () => setAnalysis(Math.min(3, Math.floor((Date.now() - start) / 850))),
      200,
    );
    const end = setTimeout(() => {
      trackMeta("QuizCompleted", { total_questions: 9 }, { custom: true, key: "quiz-complete" });
      setScreen("result");
      setDeadline((old) => old ?? Date.now() + 600000);
    }, 2800);
    return () => {
      clearInterval(interval);
      clearTimeout(end);
    };
  }, [screen]);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadline]);
  useEffect(() => {
    if (!sessionReady) return;
    trackMeta(
      "FunnelStepView",
      { stage: screen, question: screen === "quiz" ? index + 1 : 0 },
      { custom: true, key: `stage:${screen}:${screen === "quiz" ? index : 0}` },
    );
    if (screen === "welcome" || screen === "result") {
      trackMeta(
        "ViewContent",
        { ...orderMeta(0), content_category: screen === "result" ? "quiz_offer" : "quiz_landing" },
        { key: `content:${screen}` },
      );
    }
    if (screen === "quiz")
      trackMeta(
        "QuizQuestionView",
        { question: index + 1, total_questions: 9 },
        { custom: true, key: `question:${index}` },
      );
  }, [sessionReady, screen, index]);
  function redeem() {
    if (checkout) return;
    trackMeta("AddToCart", orderMeta(0), { key: "quiz-prize" });
    setCheckout(true);
  }
  function choose(n: number) {
    if (selecting || timer.current !== null) return;
    trackMeta("QuizAnswer", { question: index + 1, total_questions: 9 }, { custom: true });
    setSelecting(true);
    setAnswers((old) => ({ ...old, [index]: n }));
    timer.current = setTimeout(() => {
      timer.current = null;
      setSelecting(false);
      if (index === 8) {
        setAnalysis(0);
        setScreen("checking");
      } else setIndex(index + 1);
    }, 330);
  }
  return (
    <main className="mst">
      <header className="mst-top">
        <div className="mst-top-in">Desafio Monster · Copo 1,15L grátis</div>
        <progress
          className="mst-progress-native"
          value={Object.keys(answers).length}
          max={9}
          aria-label="Progresso total"
        />
      </header>
      <section className="mst-stage">
        <div className="mst-wrap">
          <div className="mst-screen is-on" key={screen === "quiz" ? `quiz-${index}` : screen}>
            {screen === "welcome" && (
              <>
                <Photo
                  file="monster-logo.png"
                  alt="Monster Energy"
                  className="mst-logo"
                  loading="eager"
                />
                <div className="mst-kicker">O desafio de hoje</div>
                <h1 className="mst-h1">
                  Responda tudo
                  <br />e ganhe o copo
                  <br />
                  <span className="mst-lime">grátis</span>
                </h1>
                <p className="mst-sub">
                  9 perguntas rápidas sobre o seu dia. Chegou no fim, o Copo Térmico Monster 1,15L
                  de R$ 197 sai <b>por zero</b> — o copo é seu.
                </p>
                <div className="mst-hero-ph">
                  <Photo
                    file="copo-frente.png"
                    alt="Copo térmico Monster 1,15L, prêmio do desafio"
                    loading="eager"
                  />
                  <span className="mst-tag">R$ 0,00</span>
                </div>
                <Action
                  onClick={() => {
                    trackMeta("QuizStarted", { total_questions: 9 }, { custom: true });
                    setIndex(0);
                    setAnswers({});
                    setDeadline(null);
                    setScreen("quiz");
                  }}
                >
                  Começar o desafio
                </Action>
                <div className="mst-facts">
                  <span>9 perguntas</span>
                  <i>/</i>
                  <span>1 minuto</span>
                  <i>/</i>
                  <span>copo grátis</span>
                </div>
              </>
            )}
            {screen === "quiz" && (
              <Quiz
                index={index}
                answers={answers}
                selecting={selecting}
                onChoose={choose}
                onBack={() => {
                  trackMeta("QuizBack", { question: index + 1 }, { custom: true });
                  if (index > 0) setIndex(index - 1);
                  else setScreen("welcome");
                }}
              />
            )}{" "}
            {screen === "checking" && (
              <div role="status">
                <div className="mst-kicker">Conferindo</div>
                <h2 className="mst-h1">
                  Validando
                  <br />
                  <span className="mst-lime">suas respostas</span>
                </h2>
                <div className="mst-load">
                  <span className="mst-loading" />
                </div>
                <ul className="mst-steps">
                  {[
                    "Conferindo suas 9 respostas",
                    "Checando estoque na sua região",
                    "Liberando o prêmio no seu nome",
                  ].map((s, i) => (
                    <li key={s} className={cn(analysis > i && "is-done")}>
                      {s}
                    </li>
                  ))}
                </ul>
                <p className="mst-disclosure">
                  Animação local do desafio. Não há consulta real de estoque ou reserva de produto.
                </p>
              </div>
            )}
            {screen === "result" && (
              <Prize
                preferences={quizPreferences(answers)}
                remaining={remaining}
                onRedeem={redeem}
              />
            )}
          </div>
        </div>
      </section>
      {screen === "result" && <ResultSections onRedeem={redeem} />}
      <div hidden={!checkout}>
        {checkout && <Checkout remaining={remaining} onClose={() => setCheckout(false)} />}
      </div>
    </main>
  );
}
