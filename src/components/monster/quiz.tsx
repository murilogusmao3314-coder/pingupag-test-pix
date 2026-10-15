import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import content from "./content.json";
import { QuizIcon, Photo } from "./primitives";
export interface Option { text:string; subtitle?:string; icon_key?:string; image?:string; tone?:string }
export function Quiz({ index, answers, selecting, onChoose, onBack }: { index:number; answers:Record<number,number>; selecting:boolean; onChoose:(n:number)=>void; onBack:()=>void }) {
 const q=content.quiz_questions[index];
 if (!q) return null;
 const missing=9-Object.keys(answers).length;
 return <><div className="mst-hud"><div className="mst-hud-top"><span>Pergunta <b>{index+1}</b> de 9</span><span className="mst-lock">{missing===1?"Falta 1 resposta":`Faltam ${missing} respostas`}</span></div><progress className="mst-progress-native" max={9} value={Object.keys(answers).length} aria-label="Progresso do desafio"/></div><div className="mst-card"><div className="mst-kicker">{q.key}</div><h2 className="mst-q">{q.question}</h2><div className={cn("mst-opts",`is-${q.kind}`)}>{q.options.map((option:Option,n) => <Button variant="ghost" type="button" key={option.text} disabled={selecting} aria-pressed={answers[index]===n} className={cn("mst-opt",q.kind!=="duo"&&"mst-opt-col",option.tone==="no"&&"is-no",answers[index]===n&&"is-picked")} onClick={()=>onChoose(n)}>{option.image?<span className="mst-opt-img"><Photo file={option.image} alt={option.text}/></span>:<span className="mst-opt-ico"><QuizIcon name={option.icon_key??"sim"}/></span>}<span className="mst-opt-txt">{option.text}{option.subtitle&&<small>{option.subtitle}</small>}</span></Button>)}</div></div><p className="mst-foot">Não existe resposta errada — só precisa responder todas.</p><Button variant="ghost" className="mst-back" onClick={onBack} disabled={selecting}>← Voltar</Button></>;
}
