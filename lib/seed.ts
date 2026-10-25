// The sample data from the brief, exactly as given, including its mixed formats.
// It goes through the same normalisers as every real booking, so the clean-up is
// visible and tested rather than done by hand.

import type { Appointment, Status } from "./types.ts";
import { normalizeDate, normalizeName, normalizePhone, normalizeTime } from "./normalize.ts";
import { initialReminders } from "./reminders.ts";

export const RAW_SAMPLE = [
  { client: "Riya Shah", phone: "98200 11111", date: "24/10/2026", time: "10:00", status: "Booked" },
  { client: "Arjun Mehta", phone: "98200 22222", date: "2026-10-24", time: "11:30am", status: "Booked" },
  { client: "Riya Shah", phone: "9820011111", date: "25-10-2026", time: "4 pm", status: "Booked" },
  { client: "Meera Iyer", phone: "", date: "23/10/2026", time: "09:00", status: "Done" },
  { client: "Kabir Rao", phone: "98200 33333", date: "22/10/2026", time: "14:00", status: "No-show" },
];

const STATUS_MAP: Record<string, Status> = {
  booked: "booked",
  done: "done",
  "no-show": "no-show",
  noshow: "no-show",
  "no show": "no-show",
  cancelled: "cancelled",
};

// Fixed ids make the seed idempotent: inserting it twice is a no-op.
export const SEED_IDS = RAW_SAMPLE.map((_, i) => `00000000-0000-4000-8000-00000000000${i + 1}`);

// The sheet does not say when these were booked, so assume a few days before the earliest one.
const SEED_CREATED_AT = "2026-10-18T09:00:00.000Z";

export function buildSeed(): Appointment[] {
  return RAW_SAMPLE.map((row, i) => {
    const date = normalizeDate(row.date);
    const time = normalizeTime(row.time);
    const name = normalizeName(row.client);
    const status = STATUS_MAP[row.status.trim().toLowerCase()];
    if (!date || !time || !name || !status) {
      throw new Error(`Sample row ${i + 1} could not be read: ${JSON.stringify(row)}`);
    }
    // Meera Iyer has no phone in the sheet. Keep the row and show "Not provided";
    // never invent a number.
    const phone = normalizePhone(row.phone);
    return {
      id: SEED_IDS[i],
      clientName: name,
      clientPhone: phone,
      date,
      time,
      status,
      attendance: "pending",
      confirmedAt: null,
      ...initialReminders({ date, time, clientPhone: phone, status }, new Date(SEED_CREATED_AT)),
      rescheduleCount: 0,
      source: "sample",
      notes: null,
      createdAt: SEED_CREATED_AT,
      updatedAt: SEED_CREATED_AT,
      cancelledAt: null,
    } satisfies Appointment;
  });
}
