// Execute the actual public script in isolated browser documents.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

type BrowserWindow = Window &
  typeof globalThis & {
    TrackingParams: { addToUrl: (url: string) => string };
  };
type Browser = { window: BrowserWindow };
// The project ships jsdom without its optional declaration package.
const { JSDOM } = createRequire(`${process.cwd()}/package.json`)("jsdom") as {
  JSDOM: new (html: string, options: { url: string; runScripts: string }) => Browser;
};
import { afterEach, describe, expect, it } from "vitest";

const source = readFileSync("public/tracking-params.js", "utf8");
const KEY = "tracking_params_v1";
const browsers: Browser[] = [];
function browser(search = "", html = "", setup?: (window: Window) => void) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
    url: `https://shop.example/${search}`,
    runScripts: "outside-only",
  });
  browsers.push(dom);
  setup?.(dom.window as unknown as Window);
  dom.window.eval(source);
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
  return dom.window;
}
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
afterEach(() => {
  browsers.splice(0).forEach((dom) => dom.window.close());
});

describe("URL parameter continuity", () => {
  it("captures arbitrary, duplicate, empty and encoded parameters without changing the entry URL", () => {
    const query = "?abc=123&utm_source=facebook&custom=a%26b&tag=1&tag=2&empty=&__proto__=safe";
    const win = browser(query);
    expect(win.location.search).toBe(query);
    const saved = JSON.parse(win.localStorage.getItem(KEY)!);
    expect(saved.params).toContainEqual(["__proto__", "safe"]);
    expect(saved.params.filter(([name]: string[]) => name === "tag")).toEqual([
      ["tag", "1"],
      ["tag", "2"],
    ]);
    expect(saved.expiresAt - saved.updatedAt).toBe(30 * 86400000);
    expect(win.document.cookie).toContain(`${KEY}_count=`);
    expect(saved.firstSource.value).toBe("facebook");
  });

  it("merges new visits, preserves first touch and restores on a direct visit", () => {
    const first = browser("?utm_source=first&keep=yes&utm_campaign=original");
    const initial = first.localStorage.getItem(KEY)!;
    const next = browser("?utm_source=second&new=ok", "", (win) =>
      win.localStorage.setItem(KEY, initial),
    );
    const saved = JSON.parse(next.localStorage.getItem(KEY)!);
    expect(saved.params).toContainEqual(["keep", "yes"]);
    expect(saved.params).toContainEqual(["utm_source", "second"]);
    expect(saved.firstSource.value).toBe("first");
    expect(saved.firstCampaign.value).toBe("original");
    expect(saved.firstAccess).toBe(JSON.parse(initial).firstAccess);
    const direct = browser("", "", (win) => win.localStorage.setItem(KEY, JSON.stringify(saved)));
    expect(new URL(direct.location.href).searchParams.get("new")).toBe("ok");
    expect(JSON.parse(direct.localStorage.getItem(KEY)!).params).toEqual(saved.params);
  });

  it("uses chunked cookies when localStorage is blocked, including large values", () => {
    const setup = (win: Window) =>
      Object.defineProperty(win, "localStorage", {
        get() {
          throw new Error("blocked");
        },
      });
    const first = browser(`?large=${"x".repeat(6000)}&utm_source=cookie`, "", setup);
    const cookies = first.document.cookie.split("; ");
    expect(cookies.length).toBeGreaterThan(3);
    const direct = browser("", "", (win) => {
      setup(win);
      cookies.forEach((cookie) => {
        win.document.cookie = cookie;
      });
    });
    expect(new URL(direct.location.href).searchParams.get("large")).toHaveLength(6000);
    expect(new URL(direct.location.href).searchParams.get("utm_source")).toBe("cookie");
  });

  it("continues in memory with both storages unavailable and tolerates corrupt or expired records", () => {
    const blocked = browser("?abc=123", '<a href="/next">Next</a>', (win) => {
      Object.defineProperty(win, "localStorage", {
        get() {
          throw new Error("blocked");
        },
      });
      Object.defineProperty(win.document, "cookie", {
        get() {
          throw new Error("blocked");
        },
        set() {
          throw new Error("blocked");
        },
      });
    });
    expect(blocked.document.querySelector("a")!.href).toContain("abc=123");
    for (const raw of [
      "broken",
      JSON.stringify({ version: 1, expiresAt: 1, params: [["old", "yes"]] }),
    ]) {
      const win = browser("", "", (win) => win.localStorage.setItem(KEY, raw));
      expect(win.location.search).toBe("");
    }
  });

  it("decorates internal/external links preserving destination values, hashes and ignored schemes", async () => {
    const win = browser(
      "?utm_source=entry&tag=1&tag=2",
      '<a href="https://checkout.example/pay?utm_source=checkout#order">Pay</a>',
    );
    const link = win.document.querySelector("a")!;
    const url = new URL(link.href);
    expect(url.searchParams.get("utm_source")).toBe("checkout");
    expect(url.searchParams.getAll("tag")).toEqual(["1", "2"]);
    expect(url.hash).toBe("#order");
    const dynamic = win.document.createElement("a");
    dynamic.href = "/later?fixed=1#section";
    win.document.body.append(dynamic);
    await settle();
    expect(new URL(dynamic.href).searchParams.get("utm_source")).toBe("entry");
    dynamic.setAttribute("href", "/changed?utm_source=own");
    await settle();
    expect(new URL(dynamic.href).searchParams.get("utm_source")).toBe("own");
    for (const href of ["#part", "mailto:me@example.com", "tel:123", "javascript:void(0)"]) {
      expect(win.TrackingParams.addToUrl(href)).toBe(href);
    }
  });

  it.each(["get", "post"])(
    "adds stable hidden fields to %s forms without changing action or existing fields",
    async (method) => {
      const win = browser(
        "?abc=123&tag=1&tag=2&email=tracking",
        `<form method="${method}" action="/send?fixed=own#done"><input name="email" value="customer"></form>`,
      );
      const form = win.document.querySelector("form")!;
      const action = form.getAttribute("action");
      expect(form.getAttribute("action")).toBe(action);
      expect(form.querySelector<HTMLInputElement>('[name="email"]')!.value).toBe("customer");
      expect(
        Array.from(form.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="tag"]')).map(
          (input) => input.value,
        ),
      ).toEqual(["1", "2"]);
      expect(form.querySelector<HTMLInputElement>('[name="fixed"]')!.value).toBe("own");
      expect(form.querySelector<HTMLInputElement>('[name="abc"]')!.value).toBe("123");
      await settle();
      expect(form.querySelectorAll('input[name="abc"]')).toHaveLength(1);
      expect(form.getAttribute("action")).toBe(action);
      const dynamic = win.document.createElement("form");
      win.document.body.append(dynamic);
      await settle();
      expect(dynamic.querySelector<HTMLInputElement>('[name="abc"]')!.value).toBe("123");
    },
  );

  it("does not shadow form methods with reserved tracking names; formdata includes them", () => {
    const win = browser(
      "?submit=tracking&action=custom&elements=all",
      '<form action="/send"></form>',
    );
    const form = win.document.querySelector("form")!;
    expect(typeof form.submit).toBe("function");
    expect(form.getAttribute("action")).toBe("/send");
    expect(form.querySelector('[name="submit"]')).toBeNull();
    const data = new win.FormData();
    const event = new win.Event("formdata");
    Object.defineProperty(event, "formData", { value: data });
    form.dispatchEvent(event);
    expect(data.get("submit")).toBe("tracking");
    expect(data.get("action")).toBe("custom");
  });

  it("preserves parameters on SPA navigation and window.open without touching API requests", () => {
    const calls: unknown[][] = [];
    const win = browser("?abc=123", "", (win) => {
      win.open = ((...args: unknown[]) => {
        calls.push(args);
        return null;
      }) as typeof win.open;
    });
    win.history.pushState({ step: 2 }, "", "/quiz?step=2#question");
    expect(new URL(win.location.href).searchParams.get("abc")).toBe("123");
    expect(win.location.hash).toBe("#question");
    expect(win.history.state).toEqual({ step: 2 });
    win.history.replaceState({ step: 3 }, "", "/checkout");
    expect(new URL(win.location.href).searchParams.get("abc")).toBe("123");
    win.open("https://checkout.example/pay?own=yes#pix", "_blank", "noopener");
    expect(new URL(String(calls[0]![0])).searchParams.get("abc")).toBe("123");
    expect(calls[0]!.slice(1)).toEqual(["_blank", "noopener"]);
    expect(source).not.toMatch(/(?:window\.)?(?:fetch|XMLHttpRequest)\s*=/);
  });

  it("does not write storage in response to another tab or duplicate installation", async () => {
    const win = browser("?abc=123");
    const before = win.localStorage.getItem(KEY);
    const api = win.TrackingParams;
    win.dispatchEvent(new win.StorageEvent("storage", { key: KEY, newValue: before }));
    await settle();
    expect(win.localStorage.getItem(KEY)).toBe(before);
    win.eval(source);
    expect(win.TrackingParams).toBe(api);
  });
});
