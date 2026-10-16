import { readFileSync } from "node:fs";
import { fireEvent, render, cleanup, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShippingOptions, Extras } from "../components/monster/order";
import { Payment } from "../components/monster/payment";

afterEach(cleanup);

describe("Checkout button intent", () => {
  it("changes shipping and extras without submitting a payment", () => {
    const submitted = vi.fn();
    const shipping = vi.fn();
    const extra = vi.fn();
    const view = render(<form onSubmit={event => { event.preventDefault(); submitted(); }}>
      <ShippingOptions shipping="pac" onChange={shipping} />
      <Extras cup={false} pack={false} toggle={extra} />
    </form>);
    fireEvent.click(view.getByRole("radio", { name: /Expresso/ }));
    fireEvent.click(view.getByRole("checkbox", { name: /Leva/ }));
    fireEvent.click(view.getByRole("checkbox", { name: /Fardo/ }));
    expect(shipping).toHaveBeenCalledWith("sedex");
    expect(extra.mock.calls).toEqual([["cup"], ["pack"]]);
    expect(submitted).not.toHaveBeenCalled();
  });

  it("keeps one neon Pix copy action, total and QR code in the payment view", () => {
    const view = render(
      <Payment
        payment={{ qr_code: "PIX-TEST-CODE", qr_code_base64: "" }}
        amount={1894}
        summary={<div data-testid="payment-summary">Resumo do pedido</div>}
        onBack={vi.fn()}
      />,
    );
    const action = view.getByRole("group", { name: "Ações do pagamento Pix" });
    expect(action.textContent).toContain("R$ 18,94");
    expect(view.getAllByRole("button", { name: "Copiar código PIX" })).toHaveLength(1);
    expect(action.querySelectorAll(".mst-cta")).toHaveLength(1);
    expect(view.getByTestId("payment-summary").compareDocumentPosition(action) &
      Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((view.getByLabelText("Pix Copia e Cola") as HTMLTextAreaElement).value)
      .toBe("PIX-TEST-CODE");
  });

  it("keeps mobile checkout and Pix bars fixed with safe-area padding", () => {
    const styles = readFileSync("src/styles.css", "utf8");
    expect(styles).toMatch(/\.mst-co \.mst-pix-action\s*\{\s*position:\s*fixed/);
    expect(styles).toContain("env(safe-area-inset-bottom)");
    expect(styles).toContain(".mst-co .mst-bar-fixed .mst-cta");
    const checkout = readFileSync("src/components/monster/checkout.tsx", "utf8");
    expect(checkout).toContain('className="mst-bar-fixed"');
    expect(checkout).toContain('className="mst-bar-act"');
    expect(checkout).toContain('amount={total}');
  });

  it("copies Pix and returns to correction without creating another charge", async () => {
    const submitted = vi.fn();
    const back = vi.fn();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const view = render(<form onSubmit={event => { event.preventDefault(); submitted(); }}>
      <Payment payment={{ qr_code: "TEST-CODE", qr_code_base64: "" }} onBack={back} />
    </form>);
    await act(async () => { fireEvent.click(view.getByRole("button", { name: "Copiar código PIX" })); });
    fireEvent.click(view.getByRole("button", { name: "Voltar para corrigir os dados" }));
    expect(back).toHaveBeenCalledOnce();
    expect(submitted).not.toHaveBeenCalled();
  });
});
