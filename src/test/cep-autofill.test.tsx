import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddressFields } from "../components/monster/checkout-fields";
import { useCepLookup } from "../components/monster/use-cep-lookup";
import { emptyFields } from "../components/monster/checkout-schema";
import { lookupCep } from "../components/monster/cep-lookup";
const request = vi.fn();
const address = {
  cep: "01001-000",
  logradouro: "Praça da Sé",
  bairro: "Sé",
  localidade: "São Paulo",
  uf: "SP",
};
function Harness() {
  const [fields, setFields] = useState({
    ...emptyFields,
    number: "100",
    complement: "Apartamento 2",
  });
  const [enabled, setEnabled] = useState(true);
  const cepFeedback = useCepLookup(fields, setFields, enabled);
  return (
    <>
      <button onClick={() => setEnabled((value) => !value)}>Alternar etapa</button>
      <AddressFields
        fields={fields}
        update={(key, value) => setFields((old) => ({ ...old, [key]: value }))}
        cepFeedback={cepFeedback}
      />
    </>
  );
}
function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
const advance = async (ms = 300) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};
beforeEach(() => {
  vi.useFakeTimers();
  request.mockReset();
  vi.stubGlobal("fetch", request);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CEP autofill", () => {
  it("waits for eight digits, masks the CEP and fills only the four address fields", async () => {
    request.mockResolvedValue(new Response(JSON.stringify(address)));
    render(<Harness />);
    fill("CEP (opcional)", "01001");
    await advance();
    expect(request).not.toHaveBeenCalled();
    fill("CEP (opcional)", "01001000");
    expect(screen.getByLabelText("CEP (opcional)")).toHaveValue("01001-000");
    expect(screen.getByRole("status")).toHaveTextContent("Buscando endereço");
    await advance();
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0]?.[0]).toBe("https://viacep.com.br/ws/01001000/json/");
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    expect(screen.getByLabelText("Endereço")).toHaveValue("Praça da Sé");
    expect(screen.getByLabelText("Bairro")).toHaveValue("Sé");
    expect(screen.getByLabelText("Cidade")).toHaveValue("São Paulo");
    expect(screen.getByLabelText("UF")).toHaveValue("SP");
    expect(screen.getByLabelText("Número")).toHaveValue("100");
    expect(screen.getByLabelText("Complemento (opcional)")).toHaveValue("Apartamento 2");
    expect(screen.getByLabelText("Endereço")).not.toBeDisabled();
  });
  it("keeps a manual edit made while waiting and does not repeat a successful lookup on returning to delivery", async () => {
    let finish!: (response: Response) => void;
    request.mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    );
    render(<Harness />);
    fill("CEP (opcional)", "01001-000");
    fill("Endereço", "Minha rua corrigida");
    await advance();
    fill("Bairro", "Meu bairro corrigido");
    await act(async () => {
      finish(new Response(JSON.stringify(address)));
    });
    expect(screen.getByLabelText("Endereço")).toHaveValue("Minha rua corrigida");
    expect(screen.getByLabelText("Bairro")).toHaveValue("Meu bairro corrigido");
    fireEvent.click(screen.getByRole("button", { name: "Alternar etapa" }));
    fireEvent.click(screen.getByRole("button", { name: "Alternar etapa" }));
    await advance();
    expect(request).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Endereço")).toHaveValue("Minha rua corrigida");
  });
  it("ignores a late response from the previous CEP, even if fetch does not honor abort", async () => {
    let finishOld!: (response: Response) => void;
    request
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          finishOld = resolve;
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...address,
            cep: "20040-020",
            logradouro: "Rua da Assembleia",
            bairro: "Centro",
            localidade: "Rio de Janeiro",
            uf: "RJ",
          }),
        ),
      );
    render(<Harness />);
    fill("CEP (opcional)", "01001000");
    await advance();
    const firstSignal = request.mock.calls[0]?.[1].signal as AbortSignal;
    fill("CEP (opcional)", "20040020");
    await advance();
    expect(firstSignal.aborted).toBe(true);
    await act(async () => {
      finishOld(new Response(JSON.stringify(address)));
    });
    expect(screen.getByLabelText("Endereço")).toHaveValue("Rua da Assembleia");
    expect(screen.getByLabelText("UF")).toHaveValue("RJ");
  });
  it("refills a previously resolved CEP after switching to another pending CEP and back", async () => {
    request
      .mockResolvedValueOnce(new Response(JSON.stringify(address)))
      .mockReturnValueOnce(new Promise<Response>(() => {}))
      .mockResolvedValueOnce(new Response(JSON.stringify(address)));
    render(<Harness />);
    fill("CEP (opcional)", "01001000");
    await advance();
    fill("CEP (opcional)", "20040020");
    await advance();
    expect(screen.getByLabelText("Endereço")).toHaveValue("");
    fill("CEP (opcional)", "01001000");
    await advance();
    expect(screen.getByLabelText("Endereço")).toHaveValue("Praça da Sé");
    expect(request).toHaveBeenCalledTimes(3);
  });
  it("clears an old automatic street when a new CEP is general and needs manual completion", async () => {
    request
      .mockResolvedValueOnce(new Response(JSON.stringify(address)))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...address, cep: "12345-000", logradouro: "", bairro: "" })),
      );
    render(<Harness />);
    fill("CEP (opcional)", "01001000");
    await advance();
    fill("CEP (opcional)", "12345000");
    await advance();
    expect(screen.getByLabelText("Endereço")).toHaveValue("");
    expect(screen.getByLabelText("Bairro")).toHaveValue("");
    expect(screen.getByLabelText("Número")).toHaveValue("100");
    expect(screen.getByRole("status")).toHaveTextContent("Complete a rua");
  });
  it.each([true, "true"])(
    "handles nonexistent CEP with erro=%s and supports an explicit retry",
    async (erro) => {
      request
        .mockResolvedValueOnce(new Response(JSON.stringify({ erro })))
        .mockResolvedValueOnce(new Response(JSON.stringify(address)));
      render(<Harness />);
      fill("CEP (opcional)", "01001000");
      await advance();
      expect(screen.getByRole("status")).toHaveTextContent("CEP não encontrado");
      fill("Endereço", "Endereço manual");
      fireEvent.click(screen.getByRole("button", { name: "Tentar buscar CEP novamente" }));
      await advance();
      expect(screen.getByLabelText("Cidade")).toHaveValue("São Paulo");
      expect(request).toHaveBeenCalledTimes(2);
    },
  );
  it("allows manual input after timeout and aborts pending work on unmount", async () => {
    request.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const view = render(<Harness />);
    fill("CEP (opcional)", "01001000");
    await advance();
    await advance(8000);
    expect(screen.getByRole("status")).toHaveTextContent("Preencha o endereço manualmente");
    fill("Endereço", "Rua manual");
    expect(screen.getByLabelText("Endereço")).toHaveValue("Rua manual");
    fireEvent.click(screen.getByRole("button", { name: "Tentar buscar CEP novamente" }));
    await advance();
    const signal = request.mock.calls[1]?.[1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
  });
  it("rejects malformed, mismatched, HTTP and network responses without filling arbitrary values", async () => {
    for (const data of [null, [], { ...address, cep: "99999-999" }, { ...address, uf: "XX" }]) {
      request.mockResolvedValueOnce(new Response(JSON.stringify(data)));
      await expect(lookupCep("01001000", new AbortController().signal)).rejects.toThrow();
    }
    request.mockResolvedValueOnce(new Response("error", { status: 500 }));
    await expect(lookupCep("01001000", new AbortController().signal)).rejects.toThrow();
    request.mockRejectedValueOnce(new Error("offline"));
    await expect(lookupCep("01001000", new AbortController().signal)).rejects.toThrow();
  });
});
