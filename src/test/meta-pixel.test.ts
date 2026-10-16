import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync("public/meta-pixel.js", "utf8");
function setup(existingFbq?: ReturnType<typeof vi.fn>) {
  const insertBefore = vi.fn();
  const script = { parentNode: { insertBefore } };
  const created = { async: false, src: "" };
  const document = {
    createElement: vi.fn(() => created),
    getElementsByTagName: vi.fn(() => [script]),
  };
  const context = createContext({ document });
  context["window"] = context;
  if (existingFbq) context["fbq"] = existingFbq;
  return { context, document, created, script, insertBefore };
}

describe("Meta Pixel installation", () => {
  it("loads the official SDK asynchronously and queues the provided pixel and PageView", () => {
    const browser = setup();
    runInContext(source, browser.context);
    expect(browser.created.src).toBe("https://connect.facebook.net/en_US/fbevents.js");
    expect(browser.created.async).toBe(true);
    expect(browser.insertBefore).toHaveBeenCalledExactlyOnceWith(browser.created, browser.script);
    const fbq = browser.context["fbq"] as { queue: IArguments[] };
    expect(fbq.queue.map((args) => Array.from(args))).toEqual([
      ["init", "1078609691707266"],
      ["track", "PageView"],
    ]);
    expect(browser.context["_fbq"]).toBe(fbq);
    runInContext(source, browser.context);
    expect(browser.insertBefore).toHaveBeenCalledTimes(1);
    expect(fbq.queue).toHaveLength(2);
  });

  it("reuses an existing Meta SDK without loading it again", () => {
    const fbq = vi.fn();
    const browser = setup(fbq);
    runInContext(source, browser.context);
    runInContext(source, browser.context);
    expect(browser.document.createElement).not.toHaveBeenCalled();
    expect(fbq.mock.calls).toEqual([
      ["init", "1078609691707266"],
      ["track", "PageView"],
    ]);
  });

  it("installs the script in the shared head and the fallback only inside noscript", () => {
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    expect(root).toMatch(/<head>[\s\S]*<script src="\/meta-pixel.js" defer \/>[\s\S]*<\/head>/);
    expect(root).toMatch(
      /<noscript>[\s\S]*facebook.com\/tr\?id=1078609691707266&ev=PageView&noscript=1[\s\S]*<\/noscript>/,
    );
    expect(root.match(/src="\/meta-pixel.js"/g)).toHaveLength(1);
  });
});
