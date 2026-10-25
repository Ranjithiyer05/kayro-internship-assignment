"use client";

import { ChevronRight, Clock3, UserRound } from "lucide-react";
import Link from "next/link";
import { practice } from "@/lib/config";
import { cn } from "@/lib/cn";
import { isUpcoming } from "@/lib/appointment-groups";
import { formatTime, relativeDay } from "@/lib/time";
import type { Appointment } from "@/lib/types";
import { AttendancePill, StatusBadge } from "../status";
import { CancelDialog, ConfirmAttendanceButton, RescheduleDialog } from "./appointment-actions";

export function DateTile({ date, muted }: { date: string; muted?: boolean }) {
  const d = new Date(`${date}T00:00:00Z`);
  const month = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(d);
  return (
    <div
      className={cn(
        "flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl",
        muted ? "bg-cream-deep text-muted" : "bg-sage-soft text-forest-deep",
      )}
      aria-hidden
    >
      <span className="text-[11px] font-semibold tracking-wide uppercase">{month}</span>
      <span className="font-display text-2xl leading-none">{d.getUTCDate()}</span>
    </div>
  );
}

export function AppointmentCard({
  appt,
  onChange,
  compact,
}: {
  appt: Appointment;
  onChange: (a: Appointment) => void;
  compact?: boolean;
}) {
  const upcoming = isUpcoming(appt);
  return (
    <article className="animate-fade-up rounded-3xl border border-line bg-surface p-4 shadow-soft sm:p-5">
      <Link href={`/appointments/${appt.id}`} className="group flex items-center gap-4">
        <DateTile date={appt.date} muted={!upcoming} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">
            {relativeDay(appt.date)} · {formatTime(appt.time)}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted">
            <UserRound className="size-3.5 shrink-0" aria-hidden />
            {practice.nutritionist}
            <span aria-hidden>·</span>
            <Clock3 className="size-3.5 shrink-0" aria-hidden />
            {practice.consultationMinutes} min
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {upcoming ? <AttendancePill appt={appt} /> : <StatusBadge status={appt.status} />}
          </div>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
        <span className="sr-only">View details</span>
      </Link>
      {upcoming && !compact && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <ConfirmAttendanceButton appt={appt} onChange={onChange} size="sm" />
          <RescheduleDialog appt={appt} onChange={onChange} />
          <CancelDialog appt={appt} onChange={onChange} />
        </div>
      )}
    </article>
  );
}
