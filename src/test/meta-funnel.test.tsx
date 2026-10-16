import type { ComponentType } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { createPayment, checkPayment } = vi.hoisted(() => ({
  createPayment: vi.fn(),
  checkPayment: vi.fn(),
}));
vi.mock("@/lib/pix.functions", () => ({ createPix: createPayment, checkPixPayment: checkPayment }));
vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: (fn: unknown) => fn,
}));
import { Route } from "../routes/index";
import { Payment } from "../components/monster/payment";
const Experience = Route.options.component as ComponentType;
const fbq = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fbq", fbq);
  fbq.mockClear();
  sessionStorage.clear();
  localStorage.clear();
  createPayment.mockReset();
  checkPayment.mockReset();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});
function events(name: string) {
  return fbq.mock.calls.filter((call) => call[1] === name);
}
function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("Meta events across the actual funnel", () => {
  it("covers nine questions, offer, checkout, extras and Pix; Purchase waits for verified approval", async () => {
    createPayment.mockResolvedValue({
      ok: true,
      qr_code: "private-pix-code",
      qr_code_base64: "",
      tracking_token: "private-token",
      order_reference: "funnel-order",
    });
    checkPayment.mockResolvedValue({
      ok: true,
      status: "pending",
      reference: "funnel-order",
      amount: 5874,
    });
    render(<Experience />);
    fireEvent.click(screen.getByRole("button", { name: "Começar o desafio" }));
    for (let i = 0; i < 9; i++) {
      fireEvent.click(screen.getByRole("group").querySelector("button")!);
      await act(async () => {
        vi.advanceTimersByTime(330);
      });
    }
    await act(async () => {
      vi.advanceTimersByTime(2800);
    });
    expect(events("QuizQuestionView")).toHaveLength(9);
    expect(events("QuizAnswer")).toHaveLength(9);
    expect(events("QuizCompleted")).toHaveLength(1);
    expect(events("ViewContent")).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Resgatar meu copo" })[0]!);
    expect(events("InitiateCheckout")).toHaveLength(1);
    fill("Nome completo", "Cliente Privado");
    fill("E-mail", "private@example.invalid");
    fill("CPF", "000.000.000-00");
    fill("Celular", "(11) 99999-9999");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(events("Lead")).toHaveLength(1);
    fireEvent.click(screen.getByRole("radio", { name: /Expresso/ }));
    fill("CEP", "01001-000");
    fill("Número", "100");
    fill("Endereço", "Rua Privada");
    fill("Bairro", "Centro");
    fill("Cidade", "São Paulo");
    fill("UF", "sp");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Leva \+1 copo/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Fardo Monster/ }));
    expect(events("CheckoutStepView")).toHaveLength(3);
    expect(events("AddToCart")).toHaveLength(3);
    expect(events("Purchase")).toHaveLength(0);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Gerar PIX de R$ 58,74" }));
    });
    expect(events("AddPaymentInfo")[0]?.[2]).toMatchObject({ currency: "BRL", value: 58.74 });
    expect(events("PixGenerated")).toHaveLength(1);
    expect(events("PixViewed")).toHaveLength(1);
    expect(events("Purchase")).toHaveLength(0);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar código PIX" }));
    });
    expect(events("PixCopied")).toHaveLength(1);
    checkPayment.mockResolvedValue({
      ok: true,
      status: "approved",
      reference: "funnel-order",
      amount: 5874,
    });
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(events("Purchase")).toHaveLength(1);
    expect(events("Purchase")[0]?.[2]).toMatchObject({
      currency: "BRL",
      value: 58.74,
      order_id: "funnel-order",
    });
    expect(screen.getByRole("status")).toHaveTextContent("Pagamento confirmado");
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    expect(events("Purchase")).toHaveLength(1);
    expect(JSON.stringify(fbq.mock.calls)).not.toMatch(
      /private@example|Cliente Privado|00000000000|Rua Privada|private-pix-code|private-token/,
    );
  });

  it("never sends Purchase after a status error, terminal failure or unmount", async () => {
    checkPayment.mockRejectedValue(new Error("offline"));
    const view = render(
      <Payment
        payment={{
          qr_code: "code",
          qr_code_base64: "",
          tracking_token: "token",
          order_reference: "failed-order",
        }}
        onBack={vi.fn()}
      />,
    );
    await act(async () => {});
    expect(events("Purchase")).toHaveLength(0);
    checkPayment.mockResolvedValue({
      ok: true,
      status: "failed",
      reference: "failed-order",
      amount: 990,
    });
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("cancelado ou expirado");
    expect(events("Purchase")).toHaveLength(0);
    const requests = checkPayment.mock.calls.length;
    view.unmount();
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    expect(checkPayment).toHaveBeenCalledTimes(requests);
  });
});
