// Booking rules. Every write from the client app and the dashboard goes through
// here, so both sides follow the same rules on the same records.

import "server-only";
import type { Appointment, ReminderKind, Slot, Status } from "../types.ts";
import { initialReminders } from "../reminders.ts";
import { isBookableByClient, isPast, isValidSlot, slotTimes } from "../time.ts";
import { formatDateShort, formatTime } from "../time.ts";
import { getStore, SlotTakenError, StaleWriteError } from "./store.ts";

export type Actor = "client" | "dashboard";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

const nowIso = () => new Date().toISOString();

function checkSlot(date: string, time: string, actor: Actor) {
  if (!isValidSlot(date, time)) {
    throw new ApiError(400, "That isn't one of the practice's consultation times.", { time: "Pick one of the listed times." });
  }
  if (actor === "client" && !isBookableByClient(date, time)) {
    throw new ApiError(400, "That time is no longer open for booking. Please pick another.", { time: "Pick a later time." });
  }
  if (actor === "dashboard" && isPast(date, time)) {
    throw new ApiError(400, "That time has already passed.", { time: "Pick a time that hasn't passed." });
  }
}

function slotTakenError(date: string, time: string) {
  return new ApiError(409, `${formatDateShort(date)} at ${formatTime(time)} was just taken. Please pick another time.`, {
    time: "Just taken, pick another time.",
  });
}

async function write(next: Appointment, prev: Appointment): Promise<Appointment> {
  try {
    return await getStore().update(next, prev.updatedAt);
  } catch (err) {
    if (err instanceof SlotTakenError) throw slotTakenError(next.date, next.time);
    if (err instanceof StaleWriteError) throw new ApiError(409, err.message);
    throw err;
  }
}

export async function listAppointments(filter: { phone?: string } = {}): Promise<Appointment[]> {
  const all = await getStore().list();
  const rows = filter.phone ? all.filter((a) => a.clientPhone === filter.phone) : all;
  return rows.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export async function getAppointment(id: string): Promise<Appointment> {
  const appt = await getStore().get(id);
  if (!appt) throw new ApiError(404, "We couldn't find that appointment.");
  return appt;
}

export async function availableSlots(date: string, opts: { actor: Actor; excludeId?: string }): Promise<Slot[]> {
  const taken = new Set(
    (await getStore().list())
      .filter((a) => a.date === date && a.status !== "cancelled" && a.id !== opts.excludeId)
      .map((a) => a.time),
  );
  return slotTimes().map((time) => {
    const open = opts.actor === "client" ? isBookableByClient(date, time) : isValidSlot(date, time) && !isPast(date, time);
    return { time, available: open && !taken.has(time) };
  });
}

export async function createAppointment(
  input: { name: string; phone: string | null; date: string; time: string; notes?: string | null },
  actor: Actor,
): Promise<Appointment> {
  checkSlot(input.date, input.time, actor);
  const now = new Date();
  const appt: Appointment = {
    id: crypto.randomUUID(),
    clientName: input.name,
    clientPhone: input.phone,
    date: input.date,
    time: input.time,
    status: "booked",
    attendance: "pending",
    confirmedAt: null,
    ...initialReminders({ date: input.date, time: input.time, clientPhone: input.phone, status: "booked" }, now),
    rescheduleCount: 0,
    source: actor,
    notes: input.notes ?? null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    cancelledAt: null,
  };
  try {
    return await getStore().insert(appt);
  } catch (err) {
    if (err instanceof SlotTakenError) throw slotTakenError(input.date, input.time);
    throw err;
  }
}

function assertUpcoming(appt: Appointment, verb: string) {
  if (appt.status === "cancelled") throw new ApiError(409, `This appointment was cancelled, so it can't be ${verb}.`);
  if (appt.status !== "booked") throw new ApiError(409, `This consultation is already marked ${appt.status === "done" ? "done" : "as a no-show"}, so it can't be ${verb}.`);
  if (isPast(appt.date, appt.time)) throw new ApiError(409, `This appointment has already started, so it can't be ${verb}.`);
}

function checkFresh(appt: Appointment, expectedUpdatedAt?: string) {
  if (expectedUpdatedAt && expectedUpdatedAt !== appt.updatedAt) {
    throw new ApiError(409, "This appointment was changed somewhere else. We've refreshed it, please check and try again.");
  }
}

export async function rescheduleAppointment(id: string, date: string, time: string, actor: Actor, expectedUpdatedAt?: string) {
  const prev = await getAppointment(id);
  checkFresh(prev, expectedUpdatedAt);
  assertUpcoming(prev, "moved");
  if (prev.date === date && prev.time === time) throw new ApiError(400, "That's the same time you already have.");
  checkSlot(date, time, actor);
  const now = new Date();
  return write(
    {
      ...prev,
      date,
      time,
      // A new time needs a fresh confirmation and fresh reminders.
      attendance: "pending",
      confirmedAt: null,
      ...initialReminders({ date, time, clientPhone: prev.clientPhone, status: "booked" }, now),
      rescheduleCount: prev.rescheduleCount + 1,
      updatedAt: now.toISOString(),
    },
    prev,
  );
}

export async function cancelAppointment(id: string, expectedUpdatedAt?: string) {
  const prev = await getAppointment(id);
  checkFresh(prev, expectedUpdatedAt);
  assertUpcoming(prev, "cancelled");
  const now = nowIso();
  // The record stays (history is never deleted). Its slot is freed because
  // only non-cancelled records hold a slot.
  return write(
    {
      ...prev,
      status: "cancelled",
      cancelledAt: now,
      reminder24h: prev.reminder24h === "scheduled" ? "skipped" : prev.reminder24h,
      reminder2h: prev.reminder2h === "scheduled" ? "skipped" : prev.reminder2h,
      updatedAt: now,
    },
    prev,
  );
}

export async function confirmAttendance(id: string, expectedUpdatedAt?: string) {
  const prev = await getAppointment(id);
  checkFresh(prev, expectedUpdatedAt);
  assertUpcoming(prev, "confirmed");
  if (prev.attendance === "confirmed") return prev;
  const now = nowIso();
  return write({ ...prev, attendance: "confirmed", confirmedAt: now, updatedAt: now }, prev);
}

export async function setStatus(id: string, status: Exclude<Status, "cancelled">, expectedUpdatedAt?: string) {
  const prev = await getAppointment(id);
  checkFresh(prev, expectedUpdatedAt);
  if (prev.status === status) return prev;
  if ((status === "done" || status === "no-show") && !isPast(prev.date, prev.time)) {
    throw new ApiError(409, "You can mark this once the appointment time has started.");
  }
  const now = nowIso();
  // Restoring a cancelled booking takes its slot back, which the store refuses if
  // someone else has booked it since.
  return write({ ...prev, status, cancelledAt: status === "booked" ? null : prev.cancelledAt, updatedAt: now }, prev);
}

export async function markReminderSent(id: string, kind: ReminderKind, expectedUpdatedAt?: string) {
  const prev = await getAppointment(id);
  checkFresh(prev, expectedUpdatedAt);
  if (!prev.clientPhone) throw new ApiError(400, "There's no phone number for this client yet.");
  const now = nowIso();
  const next =
    kind === "24h"
      ? { ...prev, reminder24h: "sent" as const, reminder24hSentAt: now }
      : { ...prev, reminder2h: "sent" as const, reminder2hSentAt: now };
  return write({ ...next, updatedAt: now }, prev);
}

export async function editDetails(
  id: string,
  input: { name: string; phone: string | null; notes: string | null },
  expectedUpdatedAt?: string,
) {
  const prev = await getAppointment(id);
  checkFresh(prev, expectedUpdatedAt);
  const now = new Date();
  let reminders = {};
  // Adding a missing number makes reminders possible again.
  if (!prev.clientPhone && input.phone && prev.status === "booked") {
    reminders = initialReminders({ ...prev, clientPhone: input.phone }, now);
  } else if (prev.clientPhone && !input.phone) {
    reminders = { reminder24h: "unavailable", reminder2h: "unavailable" };
  }
  return write(
    { ...prev, clientName: input.name, clientPhone: input.phone, notes: input.notes, ...reminders, updatedAt: now.toISOString() },
    prev,
  );
}

export async function resetDemoData() {
  await getStore().reset();
}

export function storageMode() {
  return getStore().kind;
}
