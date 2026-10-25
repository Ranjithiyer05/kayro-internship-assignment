// Reminder rules, shared by the server (which stores reminder status) and the UI
// (which shows it). Sending lives in lib/server/reminder-provider.ts so a real
// WhatsApp or SMS provider can be plugged in without touching anything here.

import { practice } from "./config.ts";
import type { Appointment, ReminderKind, ReminderStatus, Status } from "./types.ts";
import { formatDateLong, formatTime, toIsoInstant } from "./time.ts";
import { formatPhone } from "./normalize.ts";

export const REMINDER_OFFSET_MINUTES: Record<ReminderKind, number> = {
  "24h": 24 * 60,
  "2h": 2 * 60,
};

export const REMINDER_LABEL: Record<ReminderKind, string> = {
  "24h": "Day-before reminder",
  "2h": "2-hour reminder",
};

export function reminderSendAt(date: string, time: string, kind: ReminderKind): Date {
  const start = new Date(toIsoInstant(date, time)).getTime();
  return new Date(start - REMINDER_OFFSET_MINUTES[kind] * 60_000);
}

type ReminderFields = Pick<Appointment, "reminder24h" | "reminder24hSentAt" | "reminder2h" | "reminder2hSentAt">;

/** Reminder state for a new or moved booking. */
export function initialReminders(
  appt: { date: string; time: string; clientPhone: string | null; status: Status },
  now: Date = new Date(),
): ReminderFields {
  const one = (kind: ReminderKind): ReminderStatus => {
    if (appt.status !== "booked") return "skipped";
    if (!appt.clientPhone) return "unavailable";
    return reminderSendAt(appt.date, appt.time, kind) <= now ? "skipped" : "scheduled";
  };
  return { reminder24h: one("24h"), reminder24hSentAt: null, reminder2h: one("2h"), reminder2hSentAt: null };
}

export interface ReminderView {
  kind: ReminderKind;
  label: string;
  status: ReminderStatus;
  sendAt: Date;
  sentAt: string | null;
  /** Scheduled, its time has come, and it has not gone out yet. */
  due: boolean;
}

export function reminderViews(appt: Appointment, now: Date = new Date()): ReminderView[] {
  return (["24h", "2h"] as const).map((kind) => {
    const status = kind === "24h" ? appt.reminder24h : appt.reminder2h;
    const sentAt = kind === "24h" ? appt.reminder24hSentAt : appt.reminder2hSentAt;
    const sendAt = reminderSendAt(appt.date, appt.time, kind);
    const start = new Date(toIsoInstant(appt.date, appt.time));
    return {
      kind,
      label: REMINDER_LABEL[kind],
      status,
      sendAt,
      sentAt,
      due: appt.status === "booked" && status === "scheduled" && sendAt <= now && now < start,
    };
  });
}

/** The text of a reminder, used by the WhatsApp link and by any provider. */
export function reminderMessage(appt: Appointment, kind: ReminderKind | "manual", manageUrl: string): string {
  const firstName = appt.clientName.split(" ")[0];
  const when =
    kind === "2h"
      ? `today at ${formatTime(appt.time)}`
      : `on ${formatDateLong(appt.date)} at ${formatTime(appt.time)}`;
  return [
    `Hi ${firstName}, a gentle reminder of your nutrition consultation with ${practice.nutritionist} ${when}.`,
    `Please tap to confirm you're coming, or to pick another time if plans have changed: ${manageUrl}`,
    `See you soon, ${practice.name}`,
  ].join("\n\n");
}

/** wa.me deep link that opens WhatsApp with the message ready to send. */
export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`;
}

export function displayPhone(phone: string | null): string {
  return phone ? formatPhone(phone) : "Not provided";
}
