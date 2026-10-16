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
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

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
    fireEvent.click(screen.getByRole("button", { name: "Gerar PIX de R$ 14,37" }));
    await waitFor(() => expect(createPayment).toHaveBeenCalledOnce());
    expect(createPayment.mock.calls[0]?.[0]).toMatchObject({
      data: {
        amount: 1437,
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

  it("forwards tracked campaign parameters into the actual checkout Pix request", async () => {
    vi.stubGlobal("TrackingParams", { getParameters: () => new URLSearchParams("utm_source=stale") });
    window.history.replaceState({}, "", "/?utm_source=facebook&utm_campaign=campaign123&utm_content=videoA&fbclid=click42");
    createPayment.mockResolvedValue({ ok: true, qr_code: "tracking-test-pix", qr_code_base64: "" });
    reachPayment();
    fireEvent.click(screen.getByRole("button", { name: "Gerar PIX de R$ 14,37" }));
    await waitFor(() => expect(createPayment).toHaveBeenCalledOnce());
    const request = createPayment.mock.calls[0]?.[0]?.data;
    expect(request.trackingParameters).toMatchObject({
      utm_source: "facebook",
      utm_campaign: "campaign123",
      utm_content: "videoA",
    });
    expect(request.parameters).toContainEqual(["fbclid", "click42"]);
  });

  it("does not submit a second Pix while the original request is in flight", async () => {
    let finish!: (value: unknown) => void;
    createPayment.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    reachPayment();
    const generate = screen.getByRole("button", { name: "Gerar PIX de R$ 14,37" });
    fireEvent.click(generate);
    fireEvent.click(generate);
    expect(createPayment).toHaveBeenCalledOnce();
    finish({ ok: true, qr_code: "pix-only-once", qr_code_base64: "" });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Aguardando pagamento"));
    expect(createPayment).toHaveBeenCalledOnce();
  });

  it("shows the actionable gateway error without a fake payment success", async () => {
    createPayment.mockResolvedValue({
      ok: false,
      code: "GATEWAY_BLOCKED",
      error: "O gateway bloqueou a conexão do servidor (Cloudflare).",
    });
    reachPayment();
    fireEvent.click(screen.getByRole("button", { name: "Gerar PIX de R$ 14,37" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cloudflare");
    expect(screen.queryByText("Aguardando pagamento")).not.toBeInTheDocument();
    expect(createPayment).toHaveBeenCalledOnce();
  });
});
