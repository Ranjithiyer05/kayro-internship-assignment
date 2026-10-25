"use client";

import {
  AlertCircle,
  ArrowDownUp,
  BellRing,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  PhoneOff,
  RefreshCw,
  Search,
  UserX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { practice } from "@/lib/config";
import { displayPhone, reminderViews } from "@/lib/reminders";
import { addDays, formatDateLong, formatDateShort, formatTime, isPast, practiceNow, relativeDay, toIsoInstant } from "@/lib/time";
import type { Appointment, Status } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { Logo } from "../logo";
import { AttendancePill, StatusBadge } from "../status";
import { Button, buttonVariants } from "../ui/button";
import { Card } from "../ui/card";
import { Dialog, DialogContent } from "../ui/dialog";
import { inputClass } from "../ui/field";
import { Skeleton } from "../ui/skeleton";
import { AddAppointmentDialog } from "./add-dialog";
import { AppointmentDialog, StatusControl } from "./appointment-dialog";
import { useAllAppointments } from "./use-all-appointments";

type StatusFilter = "all" | Status;

const hoursUntil = (a: Appointment) => (new Date(toIsoInstant(a.date, a.time)).getTime() - Date.now()) / 3_600_000;

function Stat({ label, value, sub, icon: Icon, accent }: { label: string; value: number | string; sub?: string; icon: typeof AlertCircle; accent?: boolean }) {
  return (
    <div className={cn("rounded-3xl px-5 py-4 shadow-soft", accent ? "bg-forest text-white" : "border border-line bg-surface")}>
      <div className="flex items-center justify-between">
        <p className={cn("text-xs font-semibold tracking-[0.14em] uppercase", accent ? "text-sage" : "text-muted")}>{label}</p>
        <Icon className={cn("size-4", accent ? "text-sage" : "text-forest")} aria-hidden />
      </div>
      <p className={cn("mt-2 font-display text-4xl", accent ? "text-white" : "text-ink")}>{value}</p>
      {sub && <p className={cn("mt-0.5 text-xs", accent ? "text-white/70" : "text-muted")}>{sub}</p>}
    </div>
  );
}

interface AttentionItem {
  appt: Appointment;
  icon: typeof AlertCircle;
  text: string;
  tone: "warn" | "red" | "neutral";
}

function attentionItems(list: Appointment[]): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const a of list) {
    if (a.status !== "booked") continue;
    const started = isPast(a.date, a.time);
    if (started) {
      // Never assumed to be a no-show: she decides.
      items.push({ appt: a, icon: CircleDashed, text: "Time has passed. Mark it Done or No-show.", tone: "neutral" });
      continue;
    }
    if (!a.clientPhone) {
      items.push({ appt: a, icon: PhoneOff, text: "No phone number, so no reminders can go out.", tone: "warn" });
      continue;
    }
    const due = reminderViews(a).find((r) => r.due);
    if (due) {
      items.push({ appt: a, icon: BellRing, text: `${due.label} is due. Send it on WhatsApp.`, tone: "warn" });
    } else if (a.attendance !== "confirmed" && hoursUntil(a) <= 48) {
      items.push({ appt: a, icon: AlertCircle, text: "Hasn't confirmed yet. Worth a quick check-in.", tone: "warn" });
    }
  }
  return items;
}

const PREP_GROUPS: { key: string; label: string; icon: typeof CheckCircle2; match: (a: Appointment) => boolean; tone: string }[] = [
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2, match: (a) => a.status === "booked" && a.attendance === "confirmed", tone: "text-forest" },
  { key: "awaiting", label: "Awaiting confirmation", icon: CircleDashed, match: (a) => a.status === "booked" && a.attendance !== "confirmed", tone: "text-warn" },
  { key: "cancelled", label: "Cancelled", icon: X, match: (a) => a.status === "cancelled", tone: "text-cancelled" },
  { key: "done", label: "Completed", icon: CheckCircle2, match: (a) => a.status === "done", tone: "text-done" },
  { key: "no-show", label: "No-shows", icon: UserX, match: (a) => a.status === "no-show", tone: "text-noshow" },
];

function DailyPrep({ list, onOpen }: { list: Appointment[]; onOpen: (a: Appointment) => void }) {
  const today = practiceNow().date;
  const [day, setDay] = useState(today);
  const dayList = list.filter((a) => a.date === day);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl text-ink">Daily preparation</h2>
        <div className="inline-flex rounded-full bg-cream-deep p-0.5 text-sm" role="tablist" aria-label="Day">
          {[today, addDays(today, 1)].map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={day === d}
              onClick={() => setDay(d)}
              className={cn("rounded-full px-3 py-1 transition-colors", day === d ? "bg-surface shadow-soft" : "text-muted hover:text-ink")}
            >
              {relativeDay(d)}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">
        This helps you spot clients who haven't confirmed, so you can follow up before keeping the time free for them.
      </p>
      {dayList.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-cream px-4 py-6 text-center text-sm text-muted">Nothing booked for {relativeDay(day).toLowerCase()}.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {PREP_GROUPS.map((g) => {
            const items = dayList.filter(g.match);
            return (
              <li key={g.key}>
                <div className="flex items-center gap-2 text-sm">
                  <g.icon className={cn("size-4", g.tone)} aria-hidden />
                  <span className="font-medium text-ink">{g.label}</span>
                  <span className="ml-auto rounded-full bg-cream-deep px-2 text-xs leading-5 text-muted">{items.length}</span>
                </div>
                {items.length > 0 && (
                  <ul className="mt-1.5 ml-6 flex flex-wrap gap-1.5">
                    {items.map((a) => (
                      <li key={a.id}>
                        <button
                          onClick={() => onOpen(a)}
                          className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-soft transition-colors hover:border-forest/40 hover:bg-sage-wash"
                        >
                          {formatTime(a.time)} · {a.clientName}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function TodaySchedule({ list, onOpen }: { list: Appointment[]; onOpen: (a: Appointment) => void }) {
  const today = practiceNow().date;
  const items = list.filter((a) => a.date === today);
  return (
    <Card className="p-5">
      <h2 className="font-display text-xl text-ink">Today's schedule</h2>
      <p className="text-sm text-muted">{formatDateLong(today)}</p>
      {items.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-cream px-4 py-6 text-center text-sm text-muted">A clear day. No appointments today.</p>
      ) : (
        <ol className="mt-4 space-y-1">
          {items.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => onOpen(a)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-sage-wash",
                  a.status === "cancelled" && "opacity-60",
                )}
              >
                <span className="w-16 shrink-0 text-sm font-semibold text-ink">{formatTime(a.time)}</span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate font-medium text-ink", a.status === "cancelled" && "line-through")}>{a.clientName}</span>
                  <span className="block text-xs text-muted">{displayPhone(a.clientPhone)}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <StatusBadge status={a.status} />
                  {a.status === "booked" && <AttendancePill appt={a} className="px-2 py-0.5" />}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function ResetDemo({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 hover:text-ink">
        <RefreshCw className="size-3.5" aria-hidden /> Reset demo data
      </button>
      <DialogContent title="Reset to the sample data?" description="Removes every change and booking, then loads the five sample appointments again.">
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
            Keep my data
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.reset();
                onDone();
                toast.success("Sample data restored.");
                setOpen(false);
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Reset
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Dashboard() {
  const { appointments, error, syncedAt, refresh, upsert } = useAllAppointments();
  const [storage, setStorage] = useState<"supabase" | "demo" | null>(null);
  const [query, setQuery] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortAsc, setSortAsc] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    api.health().then((h) => setStorage(h.storage)).catch(() => {});
  }, []);

  const today = practiceNow().date;
  const list = appointments ?? [];

  const stats = useMemo(() => {
    const todays = list.filter((a) => a.date === today && a.status !== "cancelled");
    const upcoming = list.filter((a) => a.status === "booked" && !isPast(a.date, a.time));
    const done = list.filter((a) => a.status === "done").length;
    const noShows = list.filter((a) => a.status === "no-show").length;
    const closed = done + noShows;
    return {
      today: todays.length,
      todayConfirmed: todays.filter((a) => a.attendance === "confirmed").length,
      upcoming: upcoming.length,
      upcomingUnconfirmed: upcoming.filter((a) => a.attendance !== "confirmed").length,
      done,
      noShows,
      noShowRate: closed ? Math.round((noShows / closed) * 100) : null,
    };
  }, [list, today]);

  const attention = useMemo(() => attentionItems(list), [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return list
      .filter((a) => (todayOnly ? a.date === today : date ? a.date === date : true))
      .filter((a) => (status === "all" ? true : a.status === status))
      .filter((a) => {
        if (!q) return true;
        return a.clientName.toLowerCase().includes(q) || (qDigits.length > 0 && (a.clientPhone ?? "").includes(qDigits));
      })
      .sort((a, b) => (sortAsc ? 1 : -1) * (a.date + a.time).localeCompare(b.date + b.time));
  }, [list, query, todayOnly, date, status, sortAsc, today]);

  const filtersOn = query || todayOnly || date || status !== "all";
  const openAppt = list.find((a) => a.id === openId) ?? null;
  const history = openAppt?.clientPhone ? list.filter((a) => a.clientPhone === openAppt.clientPhone) : openAppt ? [openAppt] : [];

  const clearFilters = () => {
    setQuery("");
    setTodayOnly(false);
    setDate("");
    setStatus("all");
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo href="/dashboard" suffix="Practice" />
          <div className="flex items-center gap-2">
            <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}>
              Client app <ExternalLink aria-hidden />
            </Link>
            <AddAppointmentDialog onAdded={upsert} />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 md:py-8">
        <div>
          <p className="text-sm text-muted">{mounted ? formatDateLong(today) : " "}</p>
          <h1 className="font-display text-4xl text-ink sm:text-5xl">
            Hello, {practice.nutritionist.split(" ").slice(0, 2).join(" ")}
          </h1>
        </div>

        {storage === "demo" && (
          <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
            <strong className="font-semibold">Demo storage.</strong> Data is saved on this server only. Connect Supabase (see README) for
            shared, permanent storage.
          </p>
        )}
        {error && (
          <p role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-noshow-soft px-4 py-3 text-sm text-noshow">
            {error}
            <button onClick={refresh} className="font-medium underline">
              Retry
            </button>
          </p>
        )}

        {!appointments ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : (
          <section aria-label="Overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat accent icon={CalendarDays} label="Today" value={stats.today} sub={`${stats.todayConfirmed} confirmed`} />
            <Stat icon={CircleDashed} label="Upcoming" value={stats.upcoming} sub={`${stats.upcomingUnconfirmed} not confirmed`} />
            <Stat icon={CheckCircle2} label="Completed" value={stats.done} sub="consultations" />
            <Stat
              icon={UserX}
              label="No-shows"
              value={stats.noShows}
              sub={stats.noShowRate === null ? "none recorded" : `${stats.noShowRate}% of past appointments`}
            />
          </section>
        )}

        {appointments && (
          <section aria-labelledby="attention-h">
            <h2 id="attention-h" className="mb-3 font-display text-xl text-ink">
              Needs your attention{" "}
              <span className="font-sans text-sm font-normal text-muted">({attention.length})</span>
            </h2>
            {attention.length === 0 ? (
              <p className="rounded-2xl bg-sage-wash px-4 py-3 text-sm text-forest-deep">All caught up. Everyone upcoming has confirmed.</p>
            ) : (
              <ul className="grid gap-2 md:grid-cols-2">
                {attention.map(({ appt, icon: Icon, text, tone }) => (
                  <li key={appt.id}>
                    <button
                      onClick={() => setOpenId(appt.id)}
                      className="flex w-full items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-forest/40"
                    >
                      <Icon
                        className={cn("mt-0.5 size-4 shrink-0", tone === "warn" ? "text-warn" : tone === "red" ? "text-noshow" : "text-muted")}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">
                          {appt.clientName} · {relativeDay(appt.date)}, {formatTime(appt.time)}
                        </span>
                        <span className="block text-sm text-muted">{text}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {appointments && (
          <div className="grid gap-4 lg:grid-cols-2">
            <TodaySchedule list={list} onOpen={(a) => setOpenId(a.id)} />
            <DailyPrep list={list} onOpen={(a) => setOpenId(a.id)} />
          </div>
        )}

        <section aria-labelledby="all-h" className="space-y-4">
          <h2 id="all-h" className="font-display text-2xl text-ink">
            Appointments
          </h2>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or phone"
                aria-label="Search by name or phone"
                className={cn(inputClass, "h-11 pl-10")}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setTodayOnly((t) => !t);
                  setDate("");
                }}
                aria-pressed={todayOnly}
                className={cn(
                  "inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
                  todayOnly ? "border-forest bg-forest text-white" : "border-line-strong bg-surface text-ink hover:bg-sage-wash",
                )}
              >
                <CalendarDays className="size-4" aria-hidden /> Today
              </button>
              <label className="sr-only" htmlFor="date-filter">
                Filter by date
              </label>
              <input
                id="date-filter"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTodayOnly(false);
                }}
                className={cn(inputClass, "h-11 w-auto px-3 text-sm")}
              />
              <label className="sr-only" htmlFor="status-filter">
                Filter by status
              </label>
              <select
                id="status-filter"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                className={cn(inputClass, "h-11 w-auto px-3 text-sm")}
              >
                <option value="all">All statuses</option>
                {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <Button variant="secondary" size="sm" className="h-11" onClick={() => setSortAsc((s) => !s)} aria-label={`Sort by time, ${sortAsc ? "earliest" : "latest"} first`}>
                <ArrowDownUp aria-hidden /> {sortAsc ? "Earliest first" : "Latest first"}
              </Button>
              {filtersOn && (
                <Button variant="ghost" size="sm" className="h-11" onClick={clearFilters}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          <p className="text-sm text-muted" aria-live="polite">
            {appointments ? `Showing ${filtered.length} of ${list.length}` : "Loading…"}
          </p>

          {!appointments ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="flex flex-col items-center p-10 text-center">
              <Search className="size-6 text-muted" aria-hidden />
              <p className="mt-3 font-medium text-ink">{list.length === 0 ? "No appointments yet" : "Nothing matches these filters"}</p>
              <p className="mt-1 text-sm text-muted">
                {list.length === 0 ? "New bookings from the client app will appear here." : "Try a different search, or clear the filters."}
              </p>
              {filtersOn && (
                <Button variant="secondary" size="sm" className="mt-4" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </Card>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-3xl border border-line bg-surface shadow-soft md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-cream/60 text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-medium">Client</th>
                      <th scope="col" className="px-3 py-3 font-medium">Phone</th>
                      <th scope="col" className="px-3 py-3 font-medium">Date</th>
                      <th scope="col" className="px-3 py-3 font-medium">Time</th>
                      <th scope="col" className="px-3 py-3 font-medium">Status</th>
                      <th scope="col" className="px-3 py-3 font-medium">Confirmation</th>
                      <th scope="col" className="px-5 py-3 font-medium"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filtered.map((a) => (
                      <tr key={a.id} className={cn("transition-colors hover:bg-cream/50", a.date === today && "bg-sage-wash/40")}>
                        <td className="px-5 py-3 font-medium text-ink">{a.clientName}</td>
                        <td className={cn("px-3 py-3 tabular-nums", a.clientPhone ? "text-ink-soft" : "text-warn")}>{displayPhone(a.clientPhone)}</td>
                        <td className="px-3 py-3 text-ink-soft">{formatDateShort(a.date)}</td>
                        <td className="px-3 py-3 tabular-nums text-ink-soft">{formatTime(a.time)}</td>
                        <td className="px-3 py-3">
                          <StatusControl appt={a} onChange={upsert} size="sm" />
                        </td>
                        <td className="px-3 py-3">{a.status === "booked" && !isPast(a.date, a.time) ? <AttendancePill appt={a} /> : <span className="text-muted">—</span>}</td>
                        <td className="px-5 py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setOpenId(a.id)}>
                            Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="space-y-2 md:hidden">
                {filtered.map((a) => (
                  <li key={a.id} className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
                    <button onClick={() => setOpenId(a.id)} className="flex w-full items-start justify-between gap-3 text-left">
                      <span>
                        <span className="block font-medium text-ink">{a.clientName}</span>
                        <span className={cn("block text-sm", a.clientPhone ? "text-muted" : "text-warn")}>{displayPhone(a.clientPhone)}</span>
                        <span className="mt-1 block text-sm text-ink-soft">
                          {formatDateShort(a.date)} · {formatTime(a.time)}
                        </span>
                      </span>
                      {a.status === "booked" && !isPast(a.date, a.time) && <AttendancePill appt={a} />}
                    </button>
                    <div className="mt-3">
                      <StatusControl appt={a} onChange={upsert} size="sm" />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-xs text-muted">
          <span>
            {syncedAt ? `Synced ${syncedAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" })}` : "Syncing…"}
            {" · "}Updates from the client app appear automatically.
          </span>
          <ResetDemo onDone={refresh} />
        </footer>
      </main>

      <AppointmentDialog
        appt={openAppt}
        open={Boolean(openAppt)}
        onOpenChange={(o) => !o && setOpenId(null)}
        onChange={upsert}
        history={history}
      />
    </div>
  );
}
