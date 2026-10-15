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
