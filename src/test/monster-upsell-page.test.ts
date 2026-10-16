import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Upsell 1 page and asset", () => {
  it("contains the requested amount, kit, direct preview URL and clear optional choices", () => {
    const page = readFileSync("src/routes/upsell1.tsx", "utf8");
    expect(page).toContain('createFileRoute("/upsell1")');
    expect(page).toContain("4 PULSEIRAS");
    expect(page).toContain("FONES SEM FIO");
    expect(page).toContain("SIM, QUERO O KIT POR R$ 39,90");
    expect(page).toContain("Não, obrigado");
    expect(page).toContain('disabled={state !== "ready" || pending}');
    expect(page).toContain('src="/upsell-kit.webp"');
    expect(page).toContain("O pedido original permanece pago");
    expect(page).toContain('createUpsellPix');
  });

  it("ships the actual uploaded kit as a local WebP, not an external hotlink", () => {
    const data = readFileSync("public/upsell-kit.webp");
    expect(data.length).toBeGreaterThan(4000);
    expect(data.toString("ascii", 0, 4)).toBe("RIFF");
    expect(data.toString("ascii", 8, 12)).toBe("WEBP");
  });

  it("keeps the original checkout and neon Pix action accessible on mobile", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain(".mst-upsell-shell");
    expect(css).toContain(".mst-upsell-payment .mst-pix-action");
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toContain("@media (max-width:390px)");
    const root = readFileSync("src/routes/index.tsx", "utf8");
    expect(root).toContain('window.location.assign("/upsell1")');
    expect(root).toContain("onFirstPaymentApproved={showFirstUpsell}");
  });
});
