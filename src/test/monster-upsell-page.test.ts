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
    expect(page).toContain('src="/upsell-kit-hq.webp"');
    expect(page).toContain('srcSet="/upsell-kit-hq.avif"');
    expect(page).toContain('width={900}');
    expect(page).toContain('height={900}');
    expect(page).toContain("O pedido original permanece pago");
    expect(page).toContain('createUpsellPix');
  });

  it("ships detailed 900px AVIF with high-quality WebP fallback, not the old 4.5KB thumbnail", () => {
    const webp = readFileSync("public/upsell-kit-hq.webp");
    const avif = readFileSync("public/upsell-kit-hq.avif");
    expect(webp.length).toBeGreaterThan(70000);
    expect(webp.toString("ascii", 0, 4)).toBe("RIFF");
    expect(webp.toString("ascii", 8, 12)).toBe("WEBP");
    expect(avif.length).toBeGreaterThan(40000);
    expect(avif.toString("ascii", 4, 12)).toBe("ftypavif");
    const page = readFileSync("src/routes/upsell1.tsx", "utf8");
    expect(page).toMatch(/<picture>[\s\S]*type="image\/avif"[\s\S]*src="\/upsell-kit-hq.webp"[\s\S]*<\/picture>/);
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
