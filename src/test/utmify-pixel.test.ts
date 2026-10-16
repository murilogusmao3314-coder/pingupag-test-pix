import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync("public/utmify-pixel.js", "utf8");

describe("Utmify pixel loader", () => {
  it("loads the decoded vendor SDK just once without disturbing Meta Pixel", () => {
    const appendChild = vi.fn();
    const script = { src: "", async: false };
    const document = {
      createElement: vi.fn(() => script),
      head: { appendChild },
    };
    const fbq = vi.fn();
    const context = createContext({ document, fbq });
    context["window"] = context;
    runInContext(source, context);
    runInContext(source, context);
    expect(context["pixelId"]).toBe("6ad16da395251dffc52bd4c2");
    expect(script.src).toBe("https://cdn.utmify.com.br/scripts/pixel/pixel.js");
    expect(script.async).toBe(true);
    expect(appendChild).toHaveBeenCalledOnce();
    expect(fbq).not.toHaveBeenCalled();
    expect(source).not.toMatch(/atob\(|eval\(|fetch\(/);
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    expect(root.match(/src="\/utmify-pixel.js"/g)).toHaveLength(1);
    expect(root.match(/src="\/meta-pixel.js"/g)).toHaveLength(1);
    expect(root.indexOf("/tracking-params.js")).toBeLessThan(root.indexOf("/utmify-pixel.js"));
  });
});
