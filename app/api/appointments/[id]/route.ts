import { z } from "zod";
import {
  ApiError,
  cancelAppointment,
  confirmAttendance,
  editDetails,
  getAppointment,
  markReminderSent,
  rescheduleAppointment,
  setStatus,
} from "@/lib/server/appointments";
import { handle, json, readJson } from "@/lib/server/http";
import { patchSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

const idSchema = z.string().min(1).max(64);

export function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = idSchema.parse((await params).id);
    return json({ appointment: await getAppointment(id) });
  });
}

export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const id = idSchema.parse((await params).id);
    const body = await readJson(req);
    const actor = (body as { actor?: string })?.actor === "dashboard" ? "dashboard" : "client";
    const patch = patchSchema.parse(body);
    const expected = patch.expectedUpdatedAt;
    let appointment;
    switch (patch.action) {
      case "reschedule":
        appointment = await rescheduleAppointment(id, patch.date, patch.time, actor, expected);
        break;
      case "cancel":
        appointment = await cancelAppointment(id, expected);
        break;
      case "confirm":
        appointment = await confirmAttendance(id, expected);
        break;
      case "status":
        if (actor !== "dashboard") throw new ApiError(403, "Only the practice can change an appointment's status.");
        appointment = await setStatus(id, patch.status, expected);
        break;
      case "reminder-sent":
        if (actor !== "dashboard") throw new ApiError(403, "Only the practice can record reminders.");
        appointment = await markReminderSent(id, patch.kind, expected);
        break;
      case "edit":
        if (actor !== "dashboard") throw new ApiError(403, "Only the practice can edit client details.");
        appointment = await editDetails(id, patch, expected);
        break;
    }
    return json({ appointment });
  });
}
