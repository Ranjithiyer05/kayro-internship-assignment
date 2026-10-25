import { reminderMessage, whatsappLink } from "@/lib/reminders";
import type { Appointment, ReminderKind } from "@/lib/types";

export function reminderLink(appt: Appointment, kind: ReminderKind | "manual") {
  if (!appt.clientPhone) return null;
  const manage = `${window.location.origin}/appointments/${appt.id}`;
  return whatsappLink(appt.clientPhone, reminderMessage(appt, kind, manage));
}
