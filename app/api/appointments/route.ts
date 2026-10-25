import { z } from "zod";
import { createAppointment, listAppointments } from "@/lib/server/appointments";
import { handle, json, readJson } from "@/lib/server/http";
import { clientBookingSchema, dashboardBookingSchema, phoneSchema } from "@/lib/validation";

// GET /api/appointments            -> every appointment (dashboard)
// GET /api/appointments?phone=...  -> one client's appointments (client app)
export function GET(req: Request) {
  return handle(async () => {
    const phoneParam = new URL(req.url).searchParams.get("phone");
    const phone = phoneParam === null ? undefined : phoneSchema.parse(phoneParam);
    return json({ appointments: await listAppointments({ phone }) });
  });
}

const actorSchema = z.object({ actor: z.enum(["client", "dashboard"]).default("client") });

export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const { actor } = actorSchema.parse(body);
    const input = actor === "client" ? clientBookingSchema.parse(body) : dashboardBookingSchema.parse(body);
    const appointment = await createAppointment(input, actor);
    return json({ appointment }, 201);
  });
}
