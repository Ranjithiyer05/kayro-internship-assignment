import type { Appointment } from "./types";
import { isPast } from "./time";

/** Booked and not yet started. */
export const isUpcoming = (a: Appointment, now = new Date()) => a.status === "booked" && !isPast(a.date, a.time, now);

export function splitByTime(list: Appointment[], now = new Date()) {
  const upcoming = list.filter((a) => isUpcoming(a, now));
  const past = list.filter((a) => !isUpcoming(a, now)).reverse();
  return { upcoming, past };
}
