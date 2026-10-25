"use client";

import { CalendarPlus, History } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { splitByTime } from "@/lib/appointment-groups";
import { buttonVariants } from "../ui/button";
import { Card } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { AppointmentCard } from "./appointment-card";
import { FindAppointments } from "./find-appointments";
import { useMyAppointments, useProfile } from "./profile";

export function MyAppointments() {
  const { profile, ready } = useProfile();
  const { appointments, loading, upsert, error } = useMyAppointments();
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") === "past" ? "past" : "upcoming";
  const { upcoming, past } = splitByTime(appointments ?? []);
  const list = tab === "upcoming" ? upcoming : past;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink sm:text-4xl">My appointments</h1>
        <p className="mt-1 text-muted">Confirm, move or cancel, and see your past visits.</p>
      </div>

      {ready && !profile ? (
        <Card className="p-5 sm:p-7">
          <h2 className="font-display text-xl text-ink">Find your appointments</h2>
          <p className="mt-1 mb-4 text-sm text-muted">Use the mobile number you booked with.</p>
          <FindAppointments />
        </Card>
      ) : (
        <>
          <div role="tablist" aria-label="Appointments" className="inline-flex rounded-full bg-cream-deep p-1">
            {(["upcoming", "past"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => router.replace(t === "past" ? "/appointments?tab=past" : "/appointments", { scroll: false })}
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-medium transition-all duration-200",
                  tab === t ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
                )}
              >
                {t === "upcoming" ? `Upcoming${appointments ? ` (${upcoming.length})` : ""}` : "Past & cancelled"}
              </button>
            ))}
          </div>

          {error && (
            <p role="alert" className="rounded-2xl bg-noshow-soft px-4 py-3 text-sm text-noshow">
              {error}
            </p>
          )}

          <div role="tabpanel" className="space-y-3">
            {loading ? (
              [0, 1].map((i) => <Skeleton key={i} className="h-28 rounded-3xl" />)
            ) : list.length === 0 ? (
              <Card className="flex flex-col items-center p-8 text-center">
                {tab === "upcoming" ? (
                  <CalendarPlus className="size-7 text-forest" aria-hidden />
                ) : (
                  <History className="size-7 text-forest" aria-hidden />
                )}
                <p className="mt-3 font-medium text-ink">
                  {tab === "upcoming" ? "No upcoming appointments" : "No past appointments yet"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {tab === "upcoming" ? "When you book, it'll show up here." : "Your visits will collect here over time."}
                </p>
                {tab === "upcoming" && (
                  <Link href="/book" className={cn(buttonVariants(), "mt-5")}>
                    Book a consultation
                  </Link>
                )}
              </Card>
            ) : (
              list.map((a) => <AppointmentCard key={a.id} appt={a} onChange={upsert} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}
