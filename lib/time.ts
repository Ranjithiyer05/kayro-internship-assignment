// Date and slot helpers. Everything is computed in the practice time zone so a
// client in another country, or a server running in UTC, sees the same slots.

import { schedule } from "./config.ts";
import { minutesOf, timeOf } from "./normalize.ts";

/** Current date (YYYY-MM-DD) and minutes since midnight in the practice time zone. */
export function practiceNow(now: Date = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: schedule.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function weekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isOpenDay(date: string): boolean {
  return (schedule.openDays as readonly number[]).includes(weekday(date));
}

/** Every slot start time on an open day, ignoring bookings. */
export function slotTimes(): string[] {
  const out: string[] = [];
  const end = minutesOf(schedule.dayEnd);
  for (let t = minutesOf(schedule.dayStart); t + schedule.slotMinutes <= end; t += schedule.slotMinutes) {
    const inBreak = schedule.breaks.some((b) => t >= minutesOf(b.start) && t < minutesOf(b.end));
    if (!inBreak) out.push(timeOf(t));
  }
  return out;
}

export function isValidSlot(date: string, time: string): boolean {
  return isOpenDay(date) && slotTimes().includes(time);
}

/** True when a client may still book this slot (not in the past, enough notice, within the booking window). */
export function isBookableByClient(date: string, time: string, now: Date = new Date()): boolean {
  const today = practiceNow(now);
  if (date < today.date) return false;
  if (date > addDays(today.date, schedule.bookAheadDays)) return false;
  if (date === today.date && minutesOf(time) < today.minutes + schedule.minNoticeMinutes) return false;
  return isValidSlot(date, time);
}

/** True once the appointment's start time has passed. */
export function isPast(date: string, time: string, now: Date = new Date()): boolean {
  const today = practiceNow(now);
  if (date !== today.date) return date < today.date;
  return minutesOf(time) <= today.minutes;
}

/** The next N open days, starting today. */
export function upcomingOpenDays(count: number = schedule.bookAheadDays, now: Date = new Date()): string[] {
  const out: string[] = [];
  const start = practiceNow(now).date;
  for (let i = 0; out.length < count && i <= schedule.bookAheadDays; i++) {
    const d = addDays(start, i);
    if (isOpenDay(d)) out.push(d);
  }
  return out;
}

const dateFmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", ...opts });

function utcDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "Sat, 25 Oct" */
export function formatDateShort(date: string): string {
  return dateFmt({ weekday: "short", day: "numeric", month: "short" }).format(utcDate(date));
}

/** "Saturday, 25 October 2026" */
export function formatDateLong(date: string): string {
  return dateFmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(utcDate(date));
}

/** "4:00 pm" */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "Today", "Tomorrow", or "Sat, 25 Oct". */
export function relativeDay(date: string, now: Date = new Date()): string {
  const today = practiceNow(now).date;
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date === addDays(today, -1)) return "Yesterday";
  return formatDateShort(date);
}

/** ISO 8601 instant for an appointment, using the practice's fixed +05:30 offset. */
export function toIsoInstant(date: string, time: string): string {
  return `${date}T${time}:00+05:30`;
}
