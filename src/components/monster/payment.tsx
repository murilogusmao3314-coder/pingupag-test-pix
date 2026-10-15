import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Action } from "./primitives";
import { PixQrCode } from "./pix-qr-code";
import { trackMeta } from "@/lib/meta-events";
import { usePixConfirmation } from "./use-pix-confirmation";
export interface PixPayment {
  qr_code: string;
  qr_code_base64: string;
  tracking_token?: string;
  order_reference?: string;
}
export function Payment({ payment, onBack }: { payment: PixPayment; onBack: () => void }) {
  const { status, unavailable } = usePixConfirmation(payment.tracking_token);
  useEffect(() => {
    trackMeta(
      "PixViewed",
      { payment_method: "pix" },
      { custom: true, key: payment.order_reference || "pix-current" },
    );
  }, [payment.order_reference]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const code = useRef<HTMLTextAreaElement>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(payment.qr_code);
      trackMeta(
        "PixCopied",
        { payment_method: "pix" },
        { custom: true, key: payment.order_reference || "pix-current" },
      );
      setCopied(true);
      setError("");
    } catch {
      code.current?.focus();
      code.current?.select();
      setError("Não foi possível copiar. O código foi selecionado; toque e segure para copiar.");
    }
  }
  return (
    <>
      <div className="mst-kicker">Último passo</div>
      <h2 className="mst-h2">
        Seu código <span className="mst-lime">PIX</span>
      </h2>
      <PixQrCode key={payment.qr_code} value={payment.qr_code} />
      <Action type="button" onClick={copy}>
        {copied ? "Código copiado!" : "Copiar código PIX"}
      </Action>
      <label className="mst-foot" htmlFor="pix-code">
        Pix Copia e Cola
      </label>
      <textarea
        id="pix-code"
        ref={code}
        className="mst-pix-code"
        value={payment.qr_code}
        readOnly
        rows={4}
      />
      <ol className="mst-pix-steps">
        <li>Abra o app do seu banco</li>
        <li>Escolha PIX &gt; Pix Copia e Cola</li>
        <li>Cole o código e confira o destinatário e o valor antes de pagar</li>
      </ol>
      {error && (
        <p className="mst-err" role="alert">
          {error}
        </p>
      )}
      <div className="mst-watch" role="status">
        {status === "approved"
          ? "Pagamento confirmado"
          : status === "failed"
            ? "Pagamento cancelado ou expirado"
            : status === "refunded"
              ? "Pagamento reembolsado"
              : status === "chargeback"
                ? "Pagamento contestado"
                : "Aguardando pagamento"}
      </div>
      <p className="mst-disclosure">
        {status === "approved"
          ? "Seu pagamento Pix foi confirmado pelo gateway."
          : !payment.tracking_token
            ? "A geração do código não confirma pagamento. A confirmação automática não está disponível para esta cobrança."
            : unavailable
              ? "Não foi possível consultar a confirmação agora. A geração do código não confirma pagamento; confira o status com o suporte antes de gerar outro Pix."
              : "A geração do código não confirma pagamento. O status é consultado automaticamente enquanto esta página estiver aberta."}
      </p>
      <Button type="button" variant="ghost" className="mst-back" onClick={onBack}>
        Voltar para corrigir os dados
      </Button>
    </>
  );
}
