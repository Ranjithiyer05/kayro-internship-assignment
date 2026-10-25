"use client";

import { ArrowRight, BellRing, CalendarPlus, Clock3, Leaf, MapPin, UserRound } from "lucide-react";
import Link from "next/link";
import { practice } from "@/lib/config";
import { cn } from "@/lib/cn";
import { splitByTime } from "@/lib/appointment-groups";
import { formatDateLong, formatTime, practiceNow, relativeDay, toIsoInstant } from "@/lib/time";
import type { Appointment } from "@/lib/types";
import { AttendancePill } from "../status";
import { buttonVariants } from "../ui/button";
import { Card } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { AddToCalendarLink, CancelDialog, ConfirmAttendanceButton, RescheduleDialog } from "./appointment-actions";
import { AppointmentCard } from "./appointment-card";
import { FindAppointments } from "./find-appointments";
import { useMyAppointments, useProfile } from "./profile";

function greeting() {
  const h = Math.floor(practiceNow().minutes / 60);
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const hoursUntil = (a: Appointment) => (new Date(toIsoInstant(a.date, a.time)).getTime() - Date.now()) / 3_600_000;

function NextAppointment({ appt, onChange }: { appt: Appointment; onChange: (a: Appointment) => void }) {
  const soon = hoursUntil(appt) <= 24;
  return (
    <Card className="animate-fade-up overflow-hidden">
      {soon && appt.attendance !== "confirmed" && (
        // The in-app reminder: shown in the 24 hours before, until the client confirms.
        <div className="flex items-start gap-3 bg-warn-soft px-5 py-3.5 text-sm text-warn sm:px-7" role="status">
          <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <strong className="font-semibold">Reminder:</strong> your consultation is{" "}
            {relativeDay(appt.date).toLowerCase() === "today" ? "today" : "tomorrow"} at {formatTime(appt.time)}. Please
            let {practice.nutritionist.split(" ").slice(0, 2).join(" ")} know you're coming.
          </p>
        </div>
      )}
      <div className="p-5 sm:p-7">
        <p className="text-sm font-medium tracking-wide text-forest uppercase">Your next consultation</p>
        <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">
          {relativeDay(appt.date)}, {formatTime(appt.time)}
        </h2>
        <p className="mt-1 text-muted">{formatDateLong(appt.date)}</p>

        <dl className="mt-5 grid gap-3 text-[15px] sm:grid-cols-3">
          <div className="flex items-center gap-2.5">
            <UserRound className="size-4 text-forest" aria-hidden />
            <dt className="sr-only">With</dt>
            <dd>{practice.nutritionist}</dd>
          </div>
          <div className="flex items-center gap-2.5">
            <Clock3 className="size-4 text-forest" aria-hidden />
            <dt className="sr-only">Length</dt>
            <dd>{practice.consultationMinutes}-minute consultation</dd>
          </div>
          <div className="flex items-center gap-2.5">
            <MapPin className="size-4 text-forest" aria-hidden />
            <dt className="sr-only">Where</dt>
            <dd>{practice.name}, {practice.city}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <AttendancePill appt={appt} />
          {appt.attendance === "confirmed" && (
            <span className="text-sm text-muted">Thanks for confirming, see you then.</span>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
          <ConfirmAttendanceButton appt={appt} onChange={onChange} />
          <RescheduleDialog appt={appt} onChange={onChange} />
          <CancelDialog appt={appt} onChange={onChange} />
          <AddToCalendarLink appt={appt} className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:underline" />
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ returning }: { returning: boolean }) {
  return (
    <Card className="animate-fade-up p-6 text-center sm:p-10">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-sage-soft text-forest">
        <Leaf className="size-7" aria-hidden />
      </div>
      <h2 className="mt-4 font-display text-2xl text-ink sm:text-3xl">
        {returning ? "Nothing booked right now" : "Your first step starts here"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-muted">
        {returning
          ? "Ready for your next check-in? Pick a time that suits you, it takes under a minute."
          : `A relaxed ${practice.consultationMinutes}-minute chat with ${practice.nutritionist} about your goals, your routine and the food you enjoy.`}
      </p>
      <Link href="/book" className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
        <CalendarPlus aria-hidden /> Book a consultation
      </Link>
    </Card>
  );
}

export function ClientHome() {
  const { profile, ready, setProfile } = useProfile();
  const { appointments, loading, upsert, error } = useMyAppointments();
  const { upcoming, past } = splitByTime(appointments ?? []);
  const [next, ...later] = upcoming;
  const firstName = profile?.name.split(" ")[0];

  return (
    <div className="space-y-8">
      <section aria-labelledby="hello">
        <p className="text-sm text-muted">{ready ? formatDateLong(practiceNow().date) : " "}</p>
        <h1 id="hello" className="mt-1 font-display text-4xl text-ink sm:text-5xl">
          {ready ? `${greeting()}${firstName ? `, ${firstName}` : ""}` : "Welcome"}
        </h1>
        <p className="mt-2 max-w-xl text-lg text-ink-soft">
          Small, steady changes add up. We're glad you're here.
        </p>
        {profile && (
          <p className="mt-2 text-sm text-muted">
            Not {firstName}?{" "}
            <button type="button" onClick={() => setProfile(null)} className="font-medium text-forest underline-offset-4 hover:underline">
              Switch
            </button>
          </p>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-2xl bg-noshow-soft px-4 py-3 text-sm text-noshow">
          {error}
        </p>
      )}

      {loading ? (
        <Card className="space-y-4 p-7" aria-label="Loading your appointments">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-11 w-full" />
        </Card>
      ) : next ? (
        <NextAppointment appt={next} onChange={upsert} />
      ) : (
        <EmptyState returning={Boolean(profile)} />
      )}

      {!loading && !profile && (
        <Card className="p-5 sm:p-7">
          <h2 className="font-display text-xl text-ink">Booked before?</h2>
          <p className="mt-1 mb-4 text-sm text-muted">Enter your number to see, move or cancel your appointments.</p>
          <FindAppointments />
        </Card>
      )}

      {!loading && later.length > 0 && (
        <section aria-labelledby="later" className="space-y-3">
          <h2 id="later" className="font-display text-2xl text-ink">
            Also coming up
          </h2>
          {later.map((a) => (
            <AppointmentCard key={a.id} appt={a} onChange={upsert} />
          ))}
        </section>
      )}

      {!loading && past.length > 0 && (
        <section aria-labelledby="history" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 id="history" className="font-display text-2xl text-ink">
              Your history
            </h2>
            {past.length > 3 && (
              <Link href="/appointments?tab=past" className="inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline">
                See all <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
          {past.slice(0, 3).map((a) => (
            <AppointmentCard key={a.id} appt={a} onChange={upsert} compact />
          ))}
        </section>
      )}

      <section aria-labelledby="about" className="grid gap-4 sm:grid-cols-3">
        <h2 id="about" className="sr-only">
          About your consultations
        </h2>
        {[
          { title: "Book in a minute", body: "Pick a day and a time that suits you. No calls, no back and forth." },
          { title: "A gentle reminder", body: "We nudge you the day before and a couple of hours before, so nothing slips." },
          { title: "Plans change? That's fine", body: "Move or cancel with one tap, and your time goes to someone who needs it." },
        ].map((f) => (
          <div key={f.title} className="rounded-3xl bg-sage-wash p-5">
            <h3 className="font-display text-lg text-ink">{f.title}</h3>
            <p className="mt-1 text-sm text-ink-soft">{f.body}</p>
          </div>
        ))}
      </section>

      <p className="text-center text-sm text-muted md:hidden">
        Are you the nutritionist?{" "}
        <Link href="/dashboard" className="font-medium text-forest underline">
          Open the practice dashboard
        </Link>
      </p>
    </div>
  );
}
