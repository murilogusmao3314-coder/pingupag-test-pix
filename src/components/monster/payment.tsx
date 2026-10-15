import { useRef,useState } from "react";
import { Button } from "@/components/ui/button";
import { Action } from "./primitives";
export interface PixPayment {qr_code:string;qr_code_base64:string}
export function Payment({payment,onBack}:{payment:PixPayment;onBack:()=>void}) {
 const [copied,setCopied]=useState(false);const [error,setError]=useState("");const code=useRef<HTMLTextAreaElement>(null);
 const raw=payment.qr_code_base64;
 const image=raw.startsWith("https://")||/^data:image\/(png|jpeg|webp);base64,/.test(raw)?raw:raw&&/^[A-Za-z0-9+/=\s]+$/.test(raw)?`data:image/png;base64,${raw}`:"";
 async function copy(){try{await navigator.clipboard.writeText(payment.qr_code);setCopied(true);setError("");}catch{code.current?.focus();code.current?.select();setError("Não foi possível copiar. O código foi selecionado; toque e segure para copiar.");}}
 return <><div className="mst-kicker">Último passo</div><h2 className="mst-h2">Seu código <span className="mst-lime">PIX</span></h2><Action type="button" onClick={copy}>{copied?"Código copiado!":"Copiar código PIX"}</Action><label className="mst-foot" htmlFor="pix-code">Pix Copia e Cola</label><textarea id="pix-code" ref={code} className="mst-pix-code" value={payment.qr_code} readOnly rows={4}/>{image?<div className="mst-qr"><img src={image} alt="QR Code do PIX" width={200} height={200}/></div>:<p className="mst-foot">QR Code indisponível. Use o código Pix Copia e Cola.</p>}<ol className="mst-pix-steps"><li>Abra o app do seu banco</li><li>Escolha PIX &gt; Pix Copia e Cola</li><li>Cole o código e confira o destinatário e o valor antes de pagar</li></ol>{error&&<p className="mst-err" role="alert">{error}</p>}<div className="mst-watch" role="status">Aguardando pagamento</div><p className="mst-disclosure">A geração do código não confirma pagamento. A confirmação automática não está disponível nesta integração.</p><Button type="button" variant="ghost" className="mst-back" onClick={onBack}>Voltar para corrigir os dados</Button></>;
}

