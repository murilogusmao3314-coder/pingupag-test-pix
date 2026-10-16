import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { lookupOrderTracking } from "./order-tracking.server";

export const getOrderTracking = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => z.object({
    code: z.string().min(1).max(120),
  }).strict().parse(value))
  .handler(async ({ data }) => {
    const key = process.env["PINGUPAG_API_KEY"]?.trim();
    if (!key || /[\r\n]/.test(key)) return { ok: false as const, code: "UNAVAILABLE" as const };
    return lookupOrderTracking(data.code, key);
  });
