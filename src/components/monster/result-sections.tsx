import { useState } from "react";
import { Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import content from "./content.json";
import { Action, Photo } from "./primitives";
export function ResultSections({ onRedeem }: { onRedeem: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <section className="mst-sec">
        <div className="mst-wrap">
          <div className="mst-sec-label">// O que você ganhou</div>
          <h2 className="mst-h2">
            Não é brinde
            <br />
            <span className="mst-lime">de plástico.</span>
          </h2>
          <div className="mst-specs">
            {content.features.map((f) => (
              <figure className="mst-spec" key={f.title}>
                <div className="mst-spec-ph">
                  <Photo file={f.image} alt={f.alt} loading="lazy" />
                </div>
                <figcaption>
                  <b>{f.title}</b>
                  <span>{f.description}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
      <section className="mst-sec">
        <div className="mst-wrap">
          <div className="mst-sec-label">// Quem já resgatou</div>
          <h2 className="mst-h2">
            Chegou, e é<br />
            <span className="mst-lime">o copo mesmo.</span>
          </h2>
          <div className="mst-revs">
            {content.testimonials.map((r) => (
              <figure className="mst-rev" key={r.name}>
                <Photo file={r.image} alt={r.alt} loading="lazy" />
                <figcaption>
                  <div className="mst-rev-stars" aria-label="5 estrelas">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} fill="currentColor" />
                    ))}
                  </div>
                  <p>{r.quote}</p>
                  <b>{r.name}</b>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
      <section className="mst-sec">
        <div className="mst-wrap">
          <div className="mst-sec-label">// Dúvidas do desafio</div>
          <h2 className="mst-h2">
            Antes de <span className="mst-lime">resgatar.</span>
          </h2>
          <div className="mst-faq">
            {content.faqs.map((f, i) => (
              <div className="mst-faq-item" key={f.question}>
                <Button
                  variant="ghost"
                  className="mst-faq-q"
                  aria-expanded={open === f.question}
                  aria-controls={`faq-${i}`}
                  onClick={() => setOpen(open === f.question ? null : f.question)}
                >
                  {f.question}
                  <i aria-hidden="true">{open === f.question ? "−" : "+"}</i>
                </Button>
                {open === f.question && (
                  <div className="mst-faq-a" id={`faq-${i}`}>
                    {f.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mst-sec">
        <div className="mst-wrap">
          <div className="mst-sec-label">// Última chamada</div>
          <h2 className="mst-h2">
            Seu copo está
            <br />
            <span className="mst-lime">reservado.</span>
          </h2>
          <p className="mst-sub">{content.final_cta_section.subtext}</p>
          <Action onClick={onRedeem}>Resgatar meu copo</Action>
        </div>
      </section>
      <footer className="mst-company mst-wrap">
        <strong>{content.footer.company_name}</strong>
        {content.footer.cnpj}
        <p className="mst-disclosure">
          Recriação da referência fornecida. As informações promocionais e os depoimentos são do
          material original; não constituem comprovação de estoque, entrega ou vínculo oficial neste
          projeto.
        </p>
      </footer>
    </>
  );
}
export function Prize({
  remaining,
  onRedeem,
  preferences = "",
}: {
  remaining: number;
  onRedeem: () => void;
  preferences?: string;
}) {
  const time = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  return (
    <>
      <div className="mst-win">
        <Check />
        Desafio completo
      </div>
      <h2 className="mst-h1">
        Você ganhou
        <br />o Copo Monster
        <br />
        <span className="mst-lime">grátis</span>
      </h2>
      <div className="mst-palco">
        <Photo file="copo-frente.png" alt="Copo Térmico Monster 1,15L liberado no desafio" />
        <div className="mst-selo">
          <s>R$ 197</s>
          <b>R$ 0</b>
        </div>
      </div>
      <div className="mst-prize-name">
        Copo Térmico Monster 1,15L<span>aço inox de parede dupla + chaveiro duplo</span>
      </div>
      <ul className="mst-mini">
        {content.quiz_intro_and_result_copy.premio_mini_specs.map((s) => (
          <li key={s.value}>
            <b>{s.value}</b>
            <span>{s.label}</span>
          </li>
        ))}
      </ul>
      {preferences && (
        <p className="mst-profile">
          <span>Suas preferências</span>
          <b>{preferences}</b>
        </p>
      )}
      <div className="mst-reserva">
        <span>Reservado no seu nome por</span>
        <b>{time}</b>
      </div>
      <Action onClick={onRedeem}>Resgatar meu copo</Action>
      <p className="mst-disclosure">
        Contagem visual da referência; não representa reserva real de estoque.
      </p>
    </>
  );
}
