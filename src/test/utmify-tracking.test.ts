import { afterEach, describe, expect, it, vi } from "vitest";
import { getCheckoutTracking, getCheckoutAttribution } from "../lib/utmify-tracking";

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
});

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

  it("retains arbitrary Facebook/click params, duplicates and empty values through checkout", () => {
    vi.stubGlobal("TrackingParams", {
      getParameters: () => new URLSearchParams(
        "utm_source=facebook&fbclid=FB%2F123&unknown=anything&tag=1&tag=2&empty=&email=private%40example.com&api_token=SECRET",
      ),
    });
    const result = getCheckoutAttribution();
    expect(result.trackingParameters.utm_source).toBe("facebook");
    expect(result.parameters).toEqual([
      ["utm_source", "facebook"],
      ["fbclid", "FB/123"],
      ["unknown", "anything"],
      ["tag", "1"],
      ["tag", "2"],
      ["empty", ""],
    ]);
    expect(JSON.stringify(result.parameters)).not.toMatch(/private|SECRET/);
  });

  it("caps untrusted campaign data so a URL cannot inflate a Pix receipt", () => {
    const params = new URLSearchParams();
    for (let index = 0; index < 100; index++) params.append(`click_${index}`, "x".repeat(500));
    vi.stubGlobal("TrackingParams", { getParameters: () => params });
    const result = getCheckoutAttribution();
    expect(result.parameters.length).toBeLessThanOrEqual(64);
    expect(result.parameters.reduce((total, [key, value]) => total + key.length + value.length, 0))
      .toBeLessThanOrEqual(2600);
  });

  it("uses current checkout URL values over an older tracking helper snapshot", () => {
    vi.stubGlobal("TrackingParams", {
      getParameters: () => new URLSearchParams("utm_source=old&utm_medium=paid&fbclid=stored"),
    });
    window.history.replaceState({}, "", "/?utm_source=facebook&utm_campaign=now&utm_content=creative42");
    const result = getCheckoutAttribution();
    expect(result.trackingParameters).toMatchObject({
      utm_source: "facebook", utm_campaign: "now", utm_content: "creative42",
      utm_medium: "paid",
    });
    expect(result.parameters).toContainEqual(["fbclid", "stored"]);
  });

  it("recovers UTMs from saved click data before the deferred helper loads", () => {
    vi.stubGlobal("TrackingParams", undefined);
    window.localStorage.setItem("tracking_params_v1", JSON.stringify({
      version: 1,
      expiresAt: Date.now() + 60_000,
      params: [["utm_source", "facebook"], ["utm_campaign", "launch"],
        ["utm_content", "ad01"], ["fbclid", "fb-test"]],
    }));
    expect(getCheckoutAttribution()).toMatchObject({
      trackingParameters: { utm_source: "facebook", utm_campaign: "launch",
        utm_content: "ad01" },
    });
    expect(getCheckoutAttribution().parameters).toContainEqual(["fbclid", "fb-test"]);
  });

  it("preserves nulls for organic traffic with no parameters", () => {
    vi.stubGlobal("TrackingParams", { getParameters: () => new URLSearchParams("") });
    expect(Object.values(getCheckoutTracking()).every((value) => value === null)).toBe(true);
  });
});
