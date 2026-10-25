"use client";

import { ArrowLeft, CalendarCheck2, Clock3, MapPin, MessageCircle, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { isUpcoming } from "@/lib/appointment-groups";
import { practice } from "@/lib/config";
import { displayPhone, reminderViews } from "@/lib/reminders";
import { formatDateLong, formatTime, relativeDay } from "@/lib/time";
import type { Appointment } from "@/lib/types";
import { AttendancePill, ReminderChip, StatusBadge } from "../status";
import { Card } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { AddToCalendarLink, CancelDialog, ConfirmAttendanceButton, RescheduleDialog } from "./appointment-actions";
import { useProfile } from "./profile";

const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

export function AppointmentDetail({ id }: { id: string }) {
  const { profile, ready, setProfile } = useProfile();
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get(id).then(setAppt).catch((e: Error) => setError(e.message));
  }, [id]);

  // Opening your own appointment link (e.g. from a WhatsApp reminder) signs you in on this device.
  useEffect(() => {
    if (ready && appt?.clientPhone && profile?.phone !== appt.clientPhone) {
      setProfile({ name: appt.clientName, phone: appt.clientPhone });
    }
  }, [ready, appt, profile, setProfile]);

  const back = (
    <Link href="/appointments" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden /> My appointments
    </Link>
  );

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {back}
        <Card className="p-8 text-center">
          <p className="font-medium text-ink">{error}</p>
          <p className="mt-1 text-sm text-muted">The link may be old. You can find your bookings from My appointments.</p>
        </Card>
      </div>
    );
  }

  if (!appt) {
    return (
      <div className="mx-auto max-w-2xl space-y-4" aria-busy>
        {back}
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  const upcoming = isUpcoming(appt);
  const reminders = reminderViews(appt);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {back}
      <Card className="animate-fade-up p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={appt.status} />
          {upcoming && <AttendancePill appt={appt} />}
        </div>
        <h1 className="mt-3 font-display text-3xl text-ink sm:text-4xl">
          {relativeDay(appt.date)}, {formatTime(appt.time)}
        </h1>
        <p className="mt-1 text-muted">{formatDateLong(appt.date)}</p>

        <dl className="mt-6 grid gap-4 text-[15px] sm:grid-cols-2">
          {[
            { icon: UserRound, label: "With", value: `${practice.nutritionist}, ${practice.nutritionistTitle}` },
            { icon: Clock3, label: "Length", value: `${practice.consultationMinutes} minutes` },
            { icon: MapPin, label: "Where", value: `${practice.name}, ${practice.city}` },
            { icon: CalendarCheck2, label: "Booked for", value: `${appt.clientName} · ${displayPhone(appt.clientPhone)}` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex gap-3">
              <Icon className="mt-0.5 size-5 shrink-0 text-forest" aria-hidden />
              <div>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="text-ink">{value}</dd>
              </div>
            </div>
          ))}
        </dl>

        {upcoming && (
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
            <ConfirmAttendanceButton appt={appt} onChange={setAppt} />
            <RescheduleDialog appt={appt} onChange={setAppt} />
            <CancelDialog appt={appt} onChange={setAppt} />
          </div>
        )}
        {!upcoming && appt.status !== "cancelled" && (
          <p className="mt-6 border-t border-line pt-5 text-sm text-muted">
            This consultation has passed, so it can't be changed. Want another one?{" "}
            <Link href="/book" className="font-medium text-forest underline">
              Book again
            </Link>
          </p>
        )}
        {appt.status === "cancelled" && appt.cancelledAt && (
          <p className="mt-6 border-t border-line pt-5 text-sm text-muted">Cancelled on {dateTime(appt.cancelledAt)}.</p>
        )}
      </Card>

      {upcoming && (
        <Card className="p-5 sm:p-7">
          <h2 className="font-display text-xl text-ink">Confirmation and reminders</h2>
          <ul className="mt-4 space-y-3 text-[15px]">
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-soft">Your confirmation</span>
              <span className="text-right text-sm text-muted">
                {appt.confirmedAt ? `Confirmed ${dateTime(appt.confirmedAt)}` : "Waiting for you"}
              </span>
            </li>
            {reminders.map((r) => (
              <li key={r.kind} className="flex items-center justify-between gap-3">
                <span className="text-ink-soft">
                  {r.label}
                  <span className="block text-xs text-muted">
                    {r.status === "sent" && r.sentAt ? `Sent ${dateTime(r.sentAt)}` : `Due ${dateTime(r.sendAt.toISOString())}`}
                  </span>
                </span>
                <ReminderChip view={r} />
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4">
            <AddToCalendarLink appt={appt} />
            <a
              href={`https://wa.me/${practice.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:underline"
            >
              <MessageCircle className="size-4" aria-hidden /> Message the practice
            </a>
          </div>
        </Card>
      )}
    </div>
  );
}
