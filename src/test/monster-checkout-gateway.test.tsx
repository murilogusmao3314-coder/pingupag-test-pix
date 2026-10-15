import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createPayment } = vi.hoisted(() => ({ createPayment: vi.fn() }));
vi.mock("@tanstack/react-start", async (importOriginal) => {
  const original = await importOriginal<typeof import("@tanstack/react-start")>();
  return { ...original, useServerFn: () => createPayment };
});
import { Checkout } from "../components/monster/checkout";

beforeEach(() => {
  createPayment.mockReset();
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
});
afterEach(cleanup);

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function reachPayment() {
  render(<Checkout onClose={vi.fn()} />);
  fill("Nome completo", "Cliente Teste");
  fill("E-mail", "test@example.invalid");
  fill("CPF", "000.000.000-00");
  fill("Celular", "(11) 99999-9999");
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fill("CEP", "01001-000");
  fill("Número", "100");
  fill("Endereço", "Rua Teste");
  fill("Bairro", "Centro");
  fill("Cidade", "São Paulo");
  fill("UF", "sp");
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

describe("Checkout gateway contract", () => {
  it("submits the total and normalized address only when Generate Pix is clicked", async () => {
    createPayment.mockResolvedValue({ ok: true, qr_code: "mock-pix-code", qr_code_base64: "" });
    reachPayment();
    expect(createPayment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Gerar PIX de R$ 9,90" }));
    await waitFor(() => expect(createPayment).toHaveBeenCalledOnce());
    expect(createPayment.mock.calls[0]?.[0]).toMatchObject({
      data: {
        amount: 990,
        document: "00000000000",
        phone: "11999999999",
        address: {
          street: "Rua Teste",
          number: "100",
          neighborhood: "Centro",
          city: "São Paulo",
          state: "SP",
          zipcode: "01001000",
        },
      },
    });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Aguardando pagamento"),
    );
  });

  it("shows the actionable gateway error without a fake payment success", async () => {
    createPayment.mockResolvedValue({
      ok: false,
      code: "GATEWAY_BLOCKED",
      error: "O gateway bloqueou a conexão do servidor (Cloudflare).",
    });
    reachPayment();
    fireEvent.click(screen.getByRole("button", { name: "Gerar PIX de R$ 9,90" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cloudflare");
    expect(screen.queryByText("Aguardando pagamento")).not.toBeInTheDocument();
    expect(createPayment).toHaveBeenCalledOnce();
  });
});
