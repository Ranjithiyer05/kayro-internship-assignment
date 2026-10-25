export const STATUSES = ["booked", "done", "no-show", "cancelled"] as const;
export type Status = (typeof STATUSES)[number];

// Statuses the nutritionist sets by hand. "cancelled" comes from a cancel action,
// so a cancellation is never confused with a no-show.
export const EDITABLE_STATUSES = ["booked", "done", "no-show"] as const satisfies readonly Status[];

export const STATUS_LABEL: Record<Status, string> = {
  booked: "Booked",
  done: "Done",
  "no-show": "No-show",
  cancelled: "Cancelled",
};

export const ATTENDANCE = ["pending", "confirmed"] as const;
export type Attendance = (typeof ATTENDANCE)[number];

// scheduled:   will go out at its send time (or is waiting for a provider to be connected)
// sent:        a provider sent it, or the nutritionist sent it herself from the dashboard
// unavailable: no phone number, so there is nobody to remind
// skipped:     not needed, e.g. booked after the reminder time had passed, or cancelled
export const REMINDER_STATUSES = ["scheduled", "sent", "unavailable", "skipped"] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];
export type ReminderKind = "24h" | "2h";

export const SOURCES = ["client", "dashboard", "sample"] as const;
export type Source = (typeof SOURCES)[number];

export interface Appointment {
  id: string;
  clientName: string;
  /** 10-digit Indian mobile number, or null when not provided. */
  clientPhone: string | null;
  /** YYYY-MM-DD in the practice time zone (Asia/Kolkata). */
  date: string;
  /** HH:MM, 24-hour, in the practice time zone. */
  time: string;
  status: Status;
  attendance: Attendance;
  confirmedAt: string | null;
  reminder24h: ReminderStatus;
  reminder24hSentAt: string | null;
  reminder2h: ReminderStatus;
  reminder2hSentAt: string | null;
  rescheduleCount: number;
  source: Source;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
}

export interface Slot {
  time: string;
  available: boolean;
}
