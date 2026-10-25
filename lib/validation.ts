// Zod schemas shared by the forms (client-side) and the API (server-side), so
// both sides apply exactly the same rules and messages.

import { z } from "zod";
import { normalizeDate, normalizeName, normalizePhone, normalizeTime } from "./normalize.ts";
import { EDITABLE_STATUSES } from "./types.ts";

export const nameSchema = z
  .string({ error: "Please enter a name." })
  .trim()
  .min(1, "Please enter a name.")
  .transform((v, ctx) => {
    const n = normalizeName(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Names need 2 to 60 characters." });
      return z.NEVER;
    }
    if (!/^[\p{L}][\p{L}\p{M}' .-]*$/u.test(n)) {
      ctx.addIssue({ code: "custom", message: "Use letters only, please." });
      return z.NEVER;
    }
    return n;
  });

export const phoneSchema = z
  .string({ error: "Please enter a mobile number." })
  .trim()
  .min(1, "Please enter a mobile number.")
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Enter a 10-digit Indian mobile number, like 98200 11111." });
      return z.NEVER;
    }
    return p;
  });

/** Empty means "not provided" (the nutritionist may not have it, like Meera Iyer in the sample). */
export const optionalPhoneSchema = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Enter a 10-digit Indian mobile number, or leave it empty." });
      return z.NEVER;
    }
    return p;
  });

export const dateSchema = z.string({ error: "Pick a date." }).transform((v, ctx) => {
  const d = normalizeDate(v);
  if (!d) {
    ctx.addIssue({ code: "custom", message: "Pick a valid date." });
    return z.NEVER;
  }
  return d;
});

export const timeSchema = z.string({ error: "Pick a time." }).transform((v, ctx) => {
  const t = normalizeTime(v);
  if (!t) {
    ctx.addIssue({ code: "custom", message: "Pick a valid time." });
    return z.NEVER;
  }
  return t;
});

const notesSchema = z
  .string()
  .trim()
  .max(500, "Keep notes under 500 characters.")
  .optional()
  .transform((v) => v || null);

export const clientBookingSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  date: dateSchema,
  time: timeSchema,
});

export const dashboardBookingSchema = z.object({
  name: nameSchema,
  phone: optionalPhoneSchema,
  date: dateSchema,
  time: timeSchema,
  notes: notesSchema,
});

const expected = { expectedUpdatedAt: z.string().optional() };

export const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), status: z.enum(EDITABLE_STATUSES), ...expected }),
  z.object({ action: z.literal("reschedule"), date: dateSchema, time: timeSchema, ...expected }),
  z.object({ action: z.literal("cancel"), ...expected }),
  z.object({ action: z.literal("confirm"), ...expected }),
  z.object({ action: z.literal("reminder-sent"), kind: z.enum(["24h", "2h"]), ...expected }),
  z.object({
    action: z.literal("edit"),
    name: nameSchema,
    phone: optionalPhoneSchema,
    notes: notesSchema,
    ...expected,
  }),
]);

export type ClientBookingInput = z.input<typeof clientBookingSchema>;
export type DashboardBookingInput = z.input<typeof dashboardBookingSchema>;
export type PatchInput = z.input<typeof patchSchema>;

/** First error message per field, for API responses. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
