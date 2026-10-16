import { beforeEach, describe, expect, it } from "vitest";
import {
  readUpsellOffer,
  rememberUpsellOffer,
  dismissUpsellOffer,
  readUpsellPayment,
  rememberUpsellPayment,
  forgetUpsellPayment,
} from "../components/monster/upsell-session";

const parentRef = "QUIZ-12345678-1234-1234-1234-123456789012";
const parentToken = "signed-opaque-token-for-customer-without-plaintext";
const upsellRef = "QUIZ-abcdefab-1234-1234-1234-abcdefabcdef";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("Upsell offer continuation", () => {
  it("stores only short-lived opaque first-purchase authorization", () => {
    expect(rememberUpsellOffer(parentToken, parentRef)).toBe(true);
    expect(readUpsellOffer()).toMatchObject({
      parentToken,
      parentReference: parentRef,
    });
    expect(localStorage.getItem("monster_upsell_offer_v1")).not.toMatch(/cpf|email|address|name/i);
    expect(rememberUpsellOffer(parentToken, "not-a-reference")).toBe(false);
  });

  it("respects declining the offer and does not show it again for that payment", () => {
    rememberUpsellOffer(parentToken, parentRef);
    dismissUpsellOffer(parentRef);
    expect(readUpsellOffer()).toBeNull();
    expect(rememberUpsellOffer(parentToken, parentRef)).toBe(false);
  });

  it("recovers an existing Pix without creating another charge", () => {
    rememberUpsellPayment({
      qr_code: "pix-copy-and-paste",
      qr_code_base64: "",
      tracking_token: "signed-upsell-status-token",
      order_reference: upsellRef,
    });
    expect(readUpsellPayment()).toMatchObject({
      qr_code: "pix-copy-and-paste",
      order_reference: upsellRef,
    });
    forgetUpsellPayment();
    expect(readUpsellPayment()).toBeNull();
  });
});
