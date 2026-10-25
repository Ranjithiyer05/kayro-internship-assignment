"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, BellRing, CalendarCheck2, CheckCircle2, Clock3, MapPin, Pencil, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, RequestError } from "@/lib/api";
import { practice } from "@/lib/config";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/normalize";
import { formatDateLong, formatTime } from "@/lib/time";
import type { Appointment } from "@/lib/types";
import { nameSchema, phoneSchema } from "@/lib/validation";
import { SlotPicker, type SlotValue } from "../slot-picker";
import { Button, buttonVariants } from "../ui/button";
import { Card } from "../ui/card";
import { Field } from "../ui/field";
import { AddToCalendarLink, ConfirmAttendanceButton } from "./appointment-actions";
import { useProfile } from "./profile";

const detailsSchema = z.object({ name: nameSchema, phone: phoneSchema });
type DetailsIn = z.input<typeof detailsSchema>;
type DetailsOut = z.output<typeof detailsSchema>;

const STEPS = ["Time", "Your details", "Confirm"] as const;

function Steps({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Booking steps">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-1 items-center gap-2" aria-current={i === current ? "step" : undefined}>
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors duration-300",
              i < current ? "bg-forest text-white" : i === current ? "bg-forest text-white ring-4 ring-forest/15" : "bg-cream-deep text-muted",
            )}
          >
            {i < current ? <CheckCircle2 className="size-4" aria-hidden /> : i + 1}
          </span>
          <span className={cn("text-sm", i === current ? "font-medium text-ink" : "text-muted", i !== current && "hidden sm:inline")}>
            {label}
          </span>
          {i < STEPS.length - 1 && <span className={cn("h-px flex-1 transition-colors duration-300", i < current ? "bg-forest" : "bg-line-strong")} />}
        </li>
      ))}
    </ol>
  );
}

function Summary({ slot, details, onEdit }: { slot: { date: string; time: string }; details?: DetailsOut; onEdit?: (step: number) => void }) {
  const Row = ({ icon: Icon, label, value, step }: { icon: typeof Clock3; label: string; value: string; step?: number }) => (
    <div className="flex items-center gap-3 py-3">
      <Icon className="size-5 shrink-0 text-forest" aria-hidden />
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="text-[15px] font-medium text-ink">{value}</dd>
      </div>
      {onEdit && step !== undefined && (
        <button type="button" onClick={() => onEdit(step)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-forest hover:bg-sage-wash">
          <Pencil className="size-3.5" aria-hidden /> Change
        </button>
      )}
    </div>
  );
  return (
    <dl className="divide-y divide-line">
      <Row icon={CalendarCheck2} label="Date" value={formatDateLong(slot.date)} step={0} />
      <Row icon={Clock3} label="Time" value={`${formatTime(slot.time)} · ${practice.consultationMinutes} minutes`} step={0} />
      <Row icon={UserRound} label="With" value={`${practice.nutritionist}, ${practice.nutritionistTitle}`} />
      <Row icon={MapPin} label="Where" value={`${practice.name}, ${practice.city}`} />
      {details && <Row icon={UserRound} label="Booked for" value={`${details.name} · ${formatPhone(details.phone)}`} step={1} />}
    </dl>
  );
}

export function BookingFlow() {
  const { profile, ready, setProfile } = useProfile();
  const [step, setStep] = useState(0);
  const [slot, setSlot] = useState<SlotValue | null>(null);
  const [details, setDetails] = useState<DetailsOut>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const inFlight = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const form = useForm<DetailsIn, unknown, DetailsOut>({
    resolver: zodResolver(detailsSchema),
    mode: "onTouched",
    defaultValues: { name: "", phone: "" },
  });

  useEffect(() => {
    if (ready && profile && !form.getValues("name")) {
      form.reset({ name: profile.name, phone: formatPhone(profile.phone) });
    }
  }, [ready, profile, form]);

  // Move focus to the new step's heading so screen readers announce it.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step, booked]);

  const go = (n: number) => {
    setError(null);
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirm = async () => {
    if (!slot?.time || !details || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const appt = await api.create({ name: details.name, phone: details.phone, date: slot.date, time: slot.time }, "client");
      setProfile({ name: appt.clientName, phone: details.phone });
      setBooked(appt);
    } catch (e) {
      const msg = e instanceof RequestError ? e.message : "We couldn't book that. Please try again.";
      if (e instanceof RequestError && (e.status === 409 || e.fields?.time)) {
        // Someone took the slot while this client was typing. Send them back to pick again.
        setSlot({ date: slot.date, time: null });
        setStep(0);
      }
      setError(msg);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  if (booked) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="animate-pop p-6 text-center sm:p-10">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-done-soft text-done">
            <CheckCircle2 className="size-8" aria-hidden />
          </div>
          <h1 ref={headingRef} tabIndex={-1} className="mt-5 font-display text-3xl text-ink outline-none">
            You're booked, {booked.clientName.split(" ")[0]}!
          </h1>
          <p className="mt-2 text-muted">
            {formatDateLong(booked.date)} at {formatTime(booked.time)} with {practice.nutritionist}.
          </p>
          <div className="mt-6 rounded-2xl bg-sage-wash p-5 text-left">
            <h2 className="font-display text-lg text-ink">What happens next</h2>
            <ul className="mt-3 space-y-3 text-[15px] text-ink-soft">
              <li className="flex gap-3">
                <BellRing className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden />
                You'll see a reminder here the day before, and the practice will check in with you on WhatsApp.
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden />
                Tap "I'll be there" when you know you're coming. It helps {practice.nutritionist.split(" ").slice(0, 2).join(" ")} plan her day.
              </li>
              <li className="flex gap-3">
                <CalendarCheck2 className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden />
                Can't make it? Move or cancel from My visits so someone else can have the time.
              </li>
            </ul>
          </div>
          <div className="mt-6 flex flex-col items-center gap-3">
            <ConfirmAttendanceButton appt={booked} onChange={setBooked} className="w-full sm:w-auto" />
            {booked.attendance === "confirmed" && (
              <p className="text-sm font-medium text-forest">Confirmed. Thank you!</p>
            )}
            <AddToCalendarLink appt={booked} />
            <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "mt-1")}>
              Back to home
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl text-ink outline-none sm:text-4xl">
          {step === 0 ? "When suits you?" : step === 1 ? "A little about you" : "Does this look right?"}
        </h1>
        <p className="mt-1 text-muted">
          {step === 0
            ? `A ${practice.consultationMinutes}-minute consultation with ${practice.nutritionist}.`
            : step === 1
              ? "So we know who's coming and can send you a reminder."
              : "Check the details, then confirm your booking."}
        </p>
      </div>

      <Steps current={step} />

      {error && (
        <p role="alert" className="animate-fade-in rounded-2xl bg-noshow-soft px-4 py-3 text-sm text-noshow">
          {error}
        </p>
      )}

      {step === 0 && (
        <Card className="animate-fade-up p-5 sm:p-7">
          <SlotPicker actor="client" value={slot} onChange={(v) => { setSlot(v); setError(null); }} />
          <div className="mt-6 flex justify-end border-t border-line pt-5">
            <Button size="lg" disabled={!slot?.time} onClick={() => go(1)} className="w-full sm:w-auto">
              {slot?.time ? `Continue with ${formatTime(slot.time)}` : "Pick a time to continue"} <ArrowRight aria-hidden />
            </Button>
          </div>
        </Card>
      )}

      {step === 1 && slot?.time && (
        <Card className="animate-fade-up p-5 sm:p-7">
          <p className="mb-5 rounded-2xl bg-sage-wash px-4 py-3 text-sm text-forest-deep">
            {formatDateLong(slot.date)} at <strong>{formatTime(slot.time)}</strong>
          </p>
          <form
            noValidate
            onSubmit={form.handleSubmit((d) => {
              setDetails(d);
              go(2);
            })}
            className="space-y-4"
          >
            <Field
              label="Your name"
              autoComplete="name"
              placeholder="e.g. Riya Shah"
              error={form.formState.errors.name?.message}
              {...form.register("name")}
            />
            <Field
              label="Mobile number"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98200 11111"
              hint="10-digit Indian mobile. We only use it for your reminders."
              error={form.formState.errors.phone?.message}
              {...form.register("phone")}
            />
            <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => go(0)}>
                <ArrowLeft aria-hidden /> Back
              </Button>
              <Button type="submit" size="lg">
                Review booking <ArrowRight aria-hidden />
              </Button>
            </div>
          </form>
        </Card>
      )}

      {step === 2 && slot?.time && details && (
        <Card className="animate-fade-up p-5 sm:p-7">
          <Summary slot={{ date: slot.date, time: slot.time }} details={details} onEdit={go} />
          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => go(1)} disabled={submitting}>
              <ArrowLeft aria-hidden /> Back
            </Button>
            <Button size="lg" onClick={confirm} loading={submitting}>
              {submitting ? "Booking…" : "Confirm booking"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
