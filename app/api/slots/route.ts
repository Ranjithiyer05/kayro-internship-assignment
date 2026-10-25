import { availableSlots } from "@/lib/server/appointments";
import { handle, json } from "@/lib/server/http";
import { dateSchema } from "@/lib/validation";

// GET /api/slots?date=2026-10-26[&actor=dashboard][&exclude=<appointment id being moved>]
export function GET(req: Request) {
  return handle(async () => {
    const params = new URL(req.url).searchParams;
    const date = dateSchema.parse(params.get("date") ?? "");
    const actor = params.get("actor") === "dashboard" ? "dashboard" : "client";
    const slots = await availableSlots(date, { actor, excludeId: params.get("exclude") ?? undefined });
    return json({ date, slots });
  });
}
