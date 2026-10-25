"use client";

import { ArrowRight, BellRing, CalendarPlus, Clock3, Leaf, MapPin } from "lucide-react";
import Link from "next/link";
import { practice } from "@/lib/config";
import { cn } from "@/lib/cn";
import { splitByTime } from "@/lib/appointment-groups";
import { formatDateLong, formatTime, practiceNow, relativeDay, toIsoInstant } from "@/lib/time";
import type { Appointment } from "@/lib/types";
import { Botanical } from "../botanical";
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
  const confirmed = appt.attendance === "confirmed";
  return (
    <article className="animate-fade-up overflow-hidden rounded-3xl shadow-lift" aria-labelledby="next-h">
      <div className="relative overflow-hidden bg-forest px-6 pt-6 pb-7 text-cream sm:px-8 sm:pt-8">
        <Botanical className="pointer-events-none absolute -right-6 -bottom-8 size-56 text-white/10" />
        <div className="relative flex items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-[0.18em] text-sage uppercase">Your next consultation</p>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium",
              confirmed ? "bg-white/15 text-white" : "bg-warn-soft text-warn",
            )}
          >
            <span className={cn("size-1.5 rounded-full", confirmed ? "bg-sage" : "bg-warn")} aria-hidden />
            {confirmed ? "Confirmed" : "Not confirmed yet"}
          </span>
        </div>
        <h2 id="next-h" className="relative mt-4 font-display text-4xl leading-tight text-white sm:text-5xl">
          {relativeDay(appt.date)}, <span className="italic">{formatTime(appt.time)}</span>
        </h2>
        <p className="relative mt-1 text-white/70">{formatDateLong(appt.date)}</p>
        <div className="relative mt-6 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-cream font-display text-lg text-forest-deep" aria-hidden>
            {practice.nutritionist.replace("Dr. ", "").split(" ").map((w) => w[0]).join("")}
          </span>
          <div className="text-sm">
            <p className="font-medium text-white">{practice.nutritionist}</p>
            <p className="flex flex-wrap items-center gap-x-3 text-white/70">
              <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" aria-hidden /> {practice.consultationMinutes} min</span>
              <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden /> {practice.name}, {practice.city}</span>
            </p>
          </div>
        </div>
      </div>
      {soon && !confirmed && (
        // The in-app reminder: shown in the 24 hours before, until the client confirms.
        <div className="flex items-start gap-3 bg-warn-soft px-6 py-3.5 text-sm text-warn sm:px-8" role="status">
          <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <strong className="font-semibold">Reminder:</strong> your consultation is{" "}
            {relativeDay(appt.date).toLowerCase() === "today" ? "today" : "tomorrow"} at {formatTime(appt.time)}. Please
            let {practice.nutritionist.split(" ").slice(0, 2).join(" ")} know you're coming.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 bg-surface px-6 py-4 sm:px-8">
        <ConfirmAttendanceButton appt={appt} onChange={onChange} />
        {confirmed && <span className="mr-2 text-sm text-muted">Thanks for confirming, see you then.</span>}
        <RescheduleDialog appt={appt} onChange={onChange} />
        <CancelDialog appt={appt} onChange={onChange} />
        <AddToCalendarLink appt={appt} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:underline sm:ml-auto" />
      </div>
    </article>
  );
}

function NutritionistCard() {
  return (
    <aside className="rounded-3xl border border-line bg-surface p-6 shadow-soft">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-sage-soft font-display text-xl text-forest-deep" aria-hidden>
          {practice.nutritionist.replace("Dr. ", "").split(" ").map((w) => w[0]).join("")}
        </span>
        <div>
          <p className="font-display text-lg text-ink">{practice.nutritionist}</p>
          <p className="text-sm text-muted">{practice.nutritionistTitle} · {practice.city}</p>
        </div>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
        &ldquo;No strict diets, no guilt. We start with how you actually eat and build from there, one small habit at a time.&rdquo;
      </p>
    </aside>
  );
}

function EmptyState({ returning }: { returning: boolean }) {
  return (
    <Card className="relative animate-fade-up overflow-hidden p-6 text-center sm:p-10">
      <Botanical className="pointer-events-none absolute -top-6 -right-8 size-48 text-sage/40" />
      <div className="relative mx-auto grid size-14 place-items-center rounded-full bg-sage-soft text-forest">
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

const PROMISES = [
  { icon: CalendarPlus, title: "Book in a minute", body: "Pick a day and a time that suits you. No calls, no back and forth." },
  { icon: BellRing, title: "A gentle reminder", body: "A nudge the day before and a couple of hours before, so nothing slips." },
  { icon: Leaf, title: "Plans change? That's fine", body: "Move or cancel with one tap, and your time goes to someone who needs it." },
];

export function ClientHome() {
  const { profile, ready, setProfile } = useProfile();
  const { appointments, loading, upsert, error } = useMyAppointments();
  const { upcoming, past } = splitByTime(appointments ?? []);
  const [next, ...later] = upcoming;
  const firstName = profile?.name.split(" ")[0];

  return (
    <div className="space-y-10">
      <section aria-labelledby="hello" className="max-w-2xl">
        <p className="text-xs font-semibold tracking-[0.18em] text-forest uppercase">{ready ? formatDateLong(practiceNow().date) : "\u00a0"}</p>
        <h1 id="hello" className="mt-3 font-display text-[2.6rem] leading-[1.05] text-ink sm:text-6xl">
          {ready ? greeting() : "Welcome"}
          {ready && firstName && (
            <>
              ,<br className="sm:hidden" /> <span className="italic text-forest">{firstName}</span>
            </>
          )}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">Small, steady changes add up. We're glad you're here.</p>
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

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 space-y-8">
          {loading ? (
            <Card className="space-y-4 p-7" aria-label="Loading your appointments">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-12 w-72" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-11 w-full" />
            </Card>
          ) : next ? (
            <NextAppointment appt={next} onChange={upsert} />
          ) : (
            <EmptyState returning={Boolean(profile)} />
          )}

          {!loading && !profile && (
            <Card className="p-6 sm:p-7">
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
        </div>

        <div className="min-w-0 space-y-5 lg:sticky lg:top-24">
          <NutritionistCard />
          <section aria-labelledby="promise-h" className="rounded-3xl bg-sage-wash p-6">
            <h2 id="promise-h" className="text-xs font-semibold tracking-[0.18em] text-forest uppercase">
              How it works
            </h2>
            <ul className="mt-4 space-y-5">
              {PROMISES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-forest shadow-soft">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-display text-[17px] text-ink">{title}</h3>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <p className="text-center text-sm text-muted md:hidden">
        Are you the nutritionist?{" "}
        <Link href="/dashboard" className="font-medium text-forest underline">
          Open the practice dashboard
        </Link>
      </p>
    </div>
  );
}
