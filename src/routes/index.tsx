import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { createPix } from "@/lib/pix.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Teste Pix PinguPag" },
      { name: "description", content: "Formulário para testar cobranças Pix via PinguPag." },
      { property: "og:title", content: "Teste Pix PinguPag" },
      { property: "og:description", content: "Formulário para testar cobranças Pix via PinguPag." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Result = Awaited<ReturnType<typeof createPix>>;
const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function Index() {
  const pix = useServerFn(createPix);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "");
    setLoading(true);
    setResult(null);
    try {
      setResult(await pix({ data: {
        amount: Math.round(parseFloat(g("amount").replace(",", ".")) * 100),
        description: g("description"),
        name: g("name"),
        email: g("email"),
        document: g("document").replace(/\D/g, ""),
        phone: g("phone").replace(/\D/g, ""),
      } }));
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : "Dados inválidos" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-bold">Teste Pix PinguPag</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input name="amount" defaultValue="1,00" placeholder="Valor (R$)" className={input} required />
        <input name="description" defaultValue="Produto Teste" placeholder="Descrição" className={input} required />
        <input name="name" placeholder="Nome completo" className={input} required />
        <input name="email" type="email" placeholder="E-mail" className={input} required />
        <input name="document" placeholder="CPF/CNPJ" className={input} required />
        <input name="phone" placeholder="Telefone com DDD" className={input} required />
        <button disabled={loading} className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
          {loading ? "Gerando..." : "Gerar Pix de teste"}
        </button>
      </form>
      {result && !result.ok && <p className="mt-4 text-sm text-destructive break-all">{result.error}</p>}
      {result?.ok && (
        <div className="mt-4 space-y-2">
          {result.qr_code_base64 && <img src={result.qr_code_base64} alt="QR Code Pix" className="mx-auto w-56" />}
          <textarea readOnly value={result.qr_code} className={input} rows={3} />
          <button onClick={() => navigator.clipboard.writeText(result.qr_code)} className="w-full rounded-md border border-input px-4 py-2 text-sm">Copiar código Pix</button>
        </div>
      )}
    </main>
  );
}
