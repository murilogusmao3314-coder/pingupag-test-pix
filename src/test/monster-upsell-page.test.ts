import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Optional priority service and original tracking integrity", () => {
  it("offers R$ 18,43 once, with four benefits, clear opt-out and no original-code mutation", () => {
    const page = readFileSync("src/routes/upsell.tsx", "utf8");
    expect(page).toContain('createFileRoute("/upsell")');
    expect(page).toContain('Serviço opcional');
    expect(page).toContain('/images/upsell-priority-box.avif');
    expect(page).toContain('/images/upsell-warranty-90d.avif');
    expect(page).toContain('pru-visual');
    expect(page).toContain('pru-benefit-warranty');
    expect(page).toContain('Separação prioritária');
    expect(page).toContain('Encaminhamento prioritário');
    expect(page).toContain('Garantia estendida a 90 dias');
    expect(page).toContain('Suporte em até 2 horas');
    expect(page).toContain('Não, prefiro a fila padrão');
    expect(page).toContain('SIM, QUERO PRIORIDADE POR');
    expect(page).toContain('money(UPSELL_AMOUNT)');
    expect(page).toContain('state !== "ready" || pending');
    expect(page).toContain('onApproved={continueToTracking}');
    expect(page).toContain('onClick={continueToTracking}');
    expect(page).toContain('"/rastrear?acesso=" + encodeURIComponent(access)');
    expect(page).toContain('showTrackingUnlock={false}');
  });

  it("uses a responsive isolated layout without a header, footer or forced charge", () => {
    const page = readFileSync("src/routes/upsell.tsx", "utf8");
    const css = readFileSync("src/routes/upsell.css", "utf8");
    expect(page).not.toMatch(/<header\b|<footer\b|<nav\b/i);
    expect(page).not.toContain('createPix(');
    expect(css).toContain('.pru-shell');
    expect(css).toContain('.pru-visual');
    expect(css).toContain('.pru-guarantee');
    expect(css).toContain('@media(max-width:520px)');
    expect(css).toContain('env(safe-area-inset-bottom)');
    const legacy = readFileSync("src/routes/upsell1.tsx", "utf8");
    expect(legacy).toContain('<Navigate to="/upsell" replace />');
    expect(legacy).not.toContain('FONES SEM FIO');
  });

  it("ships both user-provided images as real optimized AVIF assets", () => {
    const box = readFileSync("public/images/upsell-priority-box.avif");
    const guarantee = readFileSync("public/images/upsell-warranty-90d.avif");
    for (const asset of [box, guarantee]) {
      expect(asset.length).toBeGreaterThan(1000);
      expect(asset.toString("ascii", 4, 12)).toBe("ftypavif");
    }
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
