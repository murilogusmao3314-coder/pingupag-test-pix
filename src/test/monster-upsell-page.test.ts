import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Optional priority service and original tracking integrity", () => {
  it("offers R$ 18,43 once, with three benefits, clear opt-out and no original-code mutation", () => {
    const page = readFileSync("src/routes/upsell.tsx", "utf8");
    expect(page).toContain('createFileRoute("/upsell")');
    expect(page).toContain('Serviço opcional');
    expect(page).toContain('function PremiumParcel()');
    expect(page).toContain('<PremiumParcel />');
    expect(page).not.toContain('/images/upsell-priority-box.avif');
    expect(page).toContain('function WarrantyInsignia()');
    expect(page).toContain('<WarrantyInsignia />');
    expect(page).not.toContain('/images/upsell-warranty-90d.avif');
    expect(page).toContain('pru-visual');
    expect(page).toContain('pru-benefit-warranty');
    expect(page).toContain('<PriorityIcon kind="sorting" />');
    expect(page).toContain('<PriorityIcon kind="dispatch" />');
    expect(page).not.toContain('<PriorityIcon kind="support" />');
    expect(page).not.toContain('<PackageCheck ');
    expect(page).not.toContain('<Truck ');
    expect(page).toContain('Separação prioritária');
    expect(page).toContain('Encaminhamento prioritário');
    expect(page).toContain('Garantia estendida a 90 dias');
    expect(page).not.toMatch(/Suporte em até 2 horas|atendimento|\\b2H\\b/i);
    expect(page).toContain('PREPARAÇÃO + EXPEDIÇÃO PRIORITÁRIAS');
    expect((page.match(/className="pru-benefit(?:\s|")/g) ?? []).length).toBe(3);
    expect(page).toContain('Não, prefiro a fila padrão');
    expect(page).not.toContain("Seu pedido original já foi aprovado. O rastreio independe desta oferta.");
    expect(page).not.toContain("Não é taxa de liberação. O envio e o rastreio do pedido original continuam normalmente se você não contratar.");
    expect(page).toContain("Após esta etapa, você acessa o rastreio do pedido com o mesmo código, aceitando ou não.");
    expect(page).toContain('SIM, QUERO PRIORIDADE POR');
    expect(page).toContain('money(UPSELL_AMOUNT)');
    expect(page).toContain('state !== "ready" || pending');
    expect(page).toContain('onApproved={continueToTracking}');
    expect(page).toContain('onClick={continueToTracking}');
    expect(page).toContain('"/rastrear?acesso=" + encodeURIComponent(access)');
    expect(page).toContain('showTrackingUnlock={false}');
    expect(page).toContain('result.status === "approved" && result.kind !== "upsell"');
    expect(page).toContain('result.reference === saved.parentReference && result.tracking_code');
    expect(page).toContain('(!saved.trackingAccess || saved.trackingAccess === result.tracking_code)');
    expect(page).toContain('state !== "ready" || !offer || !accessCode || payment || pending');
    expect(page).toContain('readUpsellOffer()?.trackingAccess');
    expect(page).toContain('forgetUpsellPayment()');
  });

  it("uses a responsive isolated layout without a header, footer or forced charge", () => {
    const page = readFileSync("src/routes/upsell.tsx", "utf8");
    const css = readFileSync("src/routes/upsell.css", "utf8");
    expect(page).not.toMatch(/<header\b|<footer\b|<nav\b/i);
    expect(page).not.toContain('createPix(');
    expect(css).toContain('.pru-shell');
    expect(css).toContain('.pru-visual');
    expect(css).toContain('.pru-guarantee');
    expect(css).toContain('.pru-custom-icon');
    expect(css).toContain('width:128px');
    expect(css).toContain('width:56px');
    expect(css).toContain('@media(max-width:520px)');
    expect(css).toContain('env(safe-area-inset-bottom)');
    const legacy = readFileSync("src/routes/upsell1.tsx", "utf8");
    expect(legacy).toContain('<Navigate to="/upsell" replace />');
    expect(legacy).not.toContain('FONES SEM FIO');
  });

  it("uses crisp scalable artwork for both the parcel and the guarantee", () => {
    const page = readFileSync("src/routes/upsell.tsx", "utf8");
    expect(page).toContain('viewBox="0 0 260 250"');
    expect(page).toContain('viewBox="0 0 96 96"');
    expect(page).toContain("function PremiumParcel()");
    expect(page).toContain("function WarrantyInsignia()");
  });

  it("stores front tracking before the upsell redirect and keeps the live tracker separate", () => {
    const index = readFileSync("src/routes/index.tsx", "utf8");
    const hook = readFileSync("src/components/monster/use-pix-confirmation.ts", "utf8");
    const page = readFileSync("src/routes/upsell.tsx", "utf8");
    const tracker = readFileSync("src/routes/rastrear.tsx", "utf8");
    expect(hook).toContain('result.kind !== "upsell" && result.tracking_code');
    expect(index).toContain('rememberUpsellOffer(token, reference, originalAccess)');
    expect(index).toContain('window.location.assign("/upsell")');
    expect(page).toContain('trackingAccess === result.tracking_code');
    expect(page).toContain('dismissUpsellOffer(offer.parentReference)');
    expect(tracker).toContain('component: TrackingPage');
  });
});
