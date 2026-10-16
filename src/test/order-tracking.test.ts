import { describe, expect, it } from "vitest";
import { codeForPaidReference, referenceFromCode, shortCodeForReference, stageForApprovedAt } from "@/lib/order-tracking.server";

const secret = "unit-test-secret";
const first = "QUIZ-12345678-1234-4123-8123-123456789abc";
const second = "QUIZ-12345678-1234-4123-8123-123456789abd";

describe("individual stateless tracking codes", () => {
  it("creates a stable code on repeated confirmations", async () => {
    expect(await codeForPaidReference(first, secret)).toBe(await codeForPaidReference(first, secret));
  });
  it("never aliases independent orders", async () => {
    expect(await codeForPaidReference(first, secret)).not.toBe(await codeForPaidReference(second, secret));
  });
  it("authenticates manual codes before any gateway query", async () => {
    const code = await codeForPaidReference(first, secret);
    expect(await referenceFromCode(code, secret)).toBe(first);
    expect(await referenceFromCode(code, "different-secret")).toBeNull();
    expect(await referenceFromCode(code.slice(0, -1) + (code.endsWith("0") ? "1" : "0"), secret)).toBeNull();
    expect(await referenceFromCode("bad", secret)).toBeNull();
  });
  it("provides stable twelve-character readable identifiers for independent orders", async () => {
    const a = await shortCodeForReference(first, secret);
    const b = await shortCodeForReference(second, secret);
    expect(a).toMatch(/^CR[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
    expect(a).toHaveLength(12);
    expect(a).not.toBe(b);
    expect(await shortCodeForReference(first, secret)).toBe(a);
  });
  it("calculates elapsed complete UTC days per order and caps at six", () => {
    const now = Date.parse("2026-10-16T12:00:00.000Z");
    expect(stageForApprovedAt("2026-10-16T10:00:00.000Z", now)).toBe(1);
    expect(stageForApprovedAt("2026-10-15T10:00:00.000Z", now)).toBe(2);
    expect(stageForApprovedAt("2026-10-12T10:00:00.000Z", now)).toBe(5);
    expect(stageForApprovedAt("2026-10-01T10:00:00.000Z", now)).toBe(6);
    expect(stageForApprovedAt(null, now)).toBe(1);
    expect(stageForApprovedAt("2026-10-17T12:00:00.000Z", now)).toBe(1);
  });
});
