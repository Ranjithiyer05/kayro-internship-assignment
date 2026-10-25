import { CheckCircle2, CircleDashed, Clock3, XCircle, Ban, BellRing, BellOff, Bell, MinusCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Appointment, ReminderStatus, Status } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import type { ReminderView } from "@/lib/reminders";

export const STATUS_STYLE: Record<Status, string> = {
  booked: "bg-booked-soft text-booked ring-booked/20",
  done: "bg-done-soft text-done ring-done/20",
  "no-show": "bg-noshow-soft text-noshow ring-noshow/20",
  cancelled: "bg-cancelled-soft text-cancelled ring-cancelled/20",
};

const STATUS_ICON: Record<Status, typeof Clock3> = {
  booked: Clock3,
  done: CheckCircle2,
  "no-show": XCircle,
  cancelled: Ban,
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-colors duration-300 ring-inset",
        STATUS_STYLE[status],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function AttendancePill({ appt, className }: { appt: Appointment; className?: string }) {
  if (appt.status !== "booked") return null;
  const confirmed = appt.attendance === "confirmed";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        confirmed ? "bg-sage-soft text-forest-deep" : "bg-warn-soft text-warn",
        className,
      )}
    >
      {confirmed ? <CheckCircle2 className="size-3.5" aria-hidden /> : <CircleDashed className="size-3.5" aria-hidden />}
      {confirmed ? "Confirmed" : "Not confirmed yet"}
    </span>
  );
}

const REMINDER_TEXT: Record<ReminderStatus, string> = {
  scheduled: "Scheduled",
  sent: "Sent",
  unavailable: "Unavailable",
  skipped: "Not needed",
};

export function ReminderChip({ view }: { view: ReminderView }) {
  const Icon =
    view.status === "sent" ? BellRing : view.status === "unavailable" ? BellOff : view.status === "skipped" ? MinusCircle : Bell;
  const label = view.due ? "Due now" : REMINDER_TEXT[view.status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        view.due
          ? "bg-warn-soft text-warn"
          : view.status === "sent"
            ? "bg-sage-soft text-forest-deep"
            : "bg-cream-deep text-muted",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
