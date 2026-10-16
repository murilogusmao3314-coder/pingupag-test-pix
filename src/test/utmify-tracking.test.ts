import { afterEach, describe, expect, it, vi } from "vitest";
import { getCheckoutTracking } from "../lib/utmify-tracking";

afterEach(() => vi.unstubAllGlobals());

describe("Utmify attribution collection", () => {
  it("forwards the seven documented fields but never sensitive or arbitrary URL values", () => {
    vi.stubGlobal("TrackingParams", {
      getParameters: () => new URLSearchParams(
        "src=organic&sck=click%2F02&utm_source=facebook&utm_campaign=teste123&utm_medium=paid&utm_content=criativo01&utm_term=feed&email=private%40example.com&foo=bar",
      ),
    });
    expect(getCheckoutTracking()).toEqual({
      src: "organic",
      sck: "click/02",
      utm_source: "facebook",
      utm_campaign: "teste123",
      utm_medium: "paid",
      utm_content: "criativo01",
      utm_term: "feed",
    });
    expect(JSON.stringify(getCheckoutTracking())).not.toContain("private@example.com");
  });

  it("preserves nulls for organic traffic with no parameters", () => {
    vi.stubGlobal("TrackingParams", { getParameters: () => new URLSearchParams("") });
    expect(Object.values(getCheckoutTracking()).every((value) => value === null)).toBe(true);
  });
});
