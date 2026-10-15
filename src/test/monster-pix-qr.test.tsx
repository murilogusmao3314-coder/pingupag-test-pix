import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Payment } from "../components/monster/payment";
import { createPixQrImage } from "../components/monster/pix-qr";

// Fixture only: never submitted to a bank or gateway.
const pixCode =
  "00020126580014BR.GOV.BCB.PIX0136test-fixture@example.invalid52040000530398654049.905802BR5913CLIENTE TESTE6009SAO PAULO62070503***6304TEST";
const fetchSpy = vi.fn();
const copySpy = vi.fn();
beforeEach(() => {
  fetchSpy.mockReset();
  copySpy.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("fetch", fetchSpy);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: copySpy },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Local Pix QR rendering", () => {
  it.each(["", "broken-image", "https://unavailable-image.invalid/qr.png"])(
    "renders a QR without relying on the provider image: %s",
    async (providerImage) => {
      render(
        <Payment payment={{ qr_code: pixCode, qr_code_base64: providerImage }} onBack={vi.fn()} />,
      );
      const image = await screen.findByRole("img", { name: "QR Code do PIX" });
      expect(image.getAttribute("src")).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
      expect(screen.getByLabelText("Pix Copia e Cola")).toHaveValue(pixCode);
      fireEvent.click(screen.getByRole("button", { name: "Copiar código PIX" }));
      await waitFor(() => expect(copySpy).toHaveBeenCalledWith(pixCode));
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it("replaces the QR when the transaction changes without leaving the old QR visible", async () => {
    const view = render(
      <Payment payment={{ qr_code: pixCode, qr_code_base64: "" }} onBack={vi.fn()} />,
    );
    const first = (await screen.findByRole("img", { name: "QR Code do PIX" })).getAttribute("src");
    view.rerender(
      <Payment payment={{ qr_code: `${pixCode}NEXT`, qr_code_base64: "" }} onBack={vi.fn()} />,
    );
    await waitFor(() =>
      expect(screen.getByRole("img", { name: "QR Code do PIX" }).getAttribute("src")).not.toBe(
        first,
      ),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps copy and paste available if the browser cannot display the image", async () => {
    render(<Payment payment={{ qr_code: pixCode, qr_code_base64: "" }} onBack={vi.fn()} />);
    fireEvent.error(await screen.findByRole("img", { name: "QR Code do PIX" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Pix Copia e Cola");
    fireEvent.click(screen.getByRole("button", { name: "Copiar código PIX" }));
    await waitFor(() => expect(copySpy).toHaveBeenCalledWith(pixCode));
  });

  it("creates a crisp black and white SVG with a four-module quiet zone and no embedded payload text", async () => {
    const image = await createPixQrImage(pixCode);
    const svg = decodeURIComponent(image.split(",").slice(1).join(","));
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('fill="white"');
    expect(svg).toContain('fill="black"');
    expect(svg).toContain("M16,16");
    expect(svg).not.toContain("test-fixture@example.invalid");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("supports UTF-8 without changing the displayed or copied payment string", async () => {
    const first = await createPixQrImage("PIX-FIXTURE-SÃO-PAULO");
    const second = await createPixQrImage("PIX-FIXTURE-SAO-PAULO");
    expect(first).not.toBe(second);
  });

  it("rejects an empty or excessive code instead of rendering a misleading QR", async () => {
    await expect(createPixQrImage(" ")).rejects.toThrow("Missing Pix code");
    await expect(createPixQrImage("x".repeat(2001))).rejects.toThrow("capacity");
  });
});
