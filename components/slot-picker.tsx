"use client";

import { CalendarX2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type Actor } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateLong, formatTime, upcomingOpenDays } from "@/lib/time";
import type { Slot } from "@/lib/types";
import { Skeleton } from "./ui/skeleton";

const dayName = (d: string) =>
  new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const monthName = (d: string) =>
  new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

function part(time: string) {
  const h = Number(time.slice(0, 2));
  return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
}

export interface SlotValue {
  date: string;
  time: string | null;
}

/** Pick a day from a scrolling strip, then one of that day's free times. */
export function SlotPicker({
  actor,
  value,
  onChange,
  excludeId,
  days = 21,
}: {
  actor: Actor;
  value: SlotValue | null;
  onChange: (v: SlotValue) => void;
  excludeId?: string;
  days?: number;
}) {
  // Computed after mount so a page built yesterday never shows yesterday's dates.
  const [dates, setDates] = useState<string[] | null>(null);
  useEffect(() => setDates(upcomingOpenDays(days)), [days]);
  const date = value?.date ?? dates?.[0] ?? null;
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setSlots(null);
    setError(null);
    api
      .slots(date, actor, excludeId)
      .then((s) => !cancelled && setSlots(s))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [date, actor, excludeId, reload]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [dates]);

  if (!dates || !date) {
    return (
      <div className="space-y-5" aria-busy>
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[76px] w-16 shrink-0 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      </div>
    );
  }

  const free = slots?.filter((s) => s.available) ?? [];
  const groups = ["Morning", "Afternoon", "Evening"]
    .map((name) => ({ name, slots: free.filter((s) => part(s.time) === name) }))
    .filter((g) => g.slots.length);

  return (
    <div className="space-y-5">
      <fieldset className="min-w-0">
        <legend className="mb-2.5 text-sm font-medium text-ink-soft">Choose a day</legend>
        <div className="scroller -mx-1 flex gap-2 overflow-x-auto px-1 pt-0.5 pb-2" role="radiogroup" aria-label="Day">
          {dates.map((d) => {
            const selected = d === date;
            return (
              <button
                key={d}
                ref={selected ? selectedRef : undefined}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={formatDateLong(d)}
                onClick={() => onChange({ date: d, time: null })}
                className={cn(
                  "flex w-16 shrink-0 flex-col items-center rounded-2xl border py-2.5 transition-all duration-200",
                  selected
                    ? "scale-[1.03] border-forest bg-forest text-white shadow-soft"
                    : "border-line bg-surface text-ink hover:border-forest/40 hover:bg-sage-wash",
                )}
              >
                <span className={cn("text-xs", selected ? "text-white/80" : "text-muted")}>{dayName(d)}</span>
                <span className="font-display text-xl leading-tight">{Number(d.slice(8))}</span>
                <span className={cn("text-[11px] uppercase tracking-wide", selected ? "text-white/80" : "text-muted")}>
                  {monthName(d)}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="min-w-0" aria-live="polite" aria-busy={!slots && !error}>
        <legend className="mb-2.5 text-sm font-medium text-ink-soft">
          Free times on <span className="text-ink">{formatDateLong(date)}</span>
        </legend>
        {error ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-noshow-soft px-4 py-3 text-sm text-noshow">
            <span>{error}</span>
            <button type="button" onClick={() => setReload((n) => n + 1)} className="inline-flex items-center gap-1 font-medium underline">
              <RefreshCw className="size-3.5" /> Retry
            </button>
          </div>
        ) : !slots ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center">
            <CalendarX2 className="mb-2 size-6 text-muted" aria-hidden />
            <p className="font-medium text-ink">No free times left on this day</p>
            <p className="mt-1 text-sm text-muted">Try the next day, there's usually room.</p>
          </div>
        ) : (
          <div className="space-y-4" role="radiogroup" aria-label="Time">
            {groups.map((g) => (
              <div key={g.name}>
                <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{g.name}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {g.slots.map((s) => {
                    const selected = value?.time === s.time && value.date === date;
                    return (
                      <button
                        key={s.time}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onChange({ date, time: s.time })}
                        className={cn(
                          "h-11 rounded-xl border text-[15px] font-medium transition-all duration-200",
                          selected
                            ? "scale-[1.03] border-forest bg-forest text-white shadow-soft"
                            : "border-line bg-surface text-ink hover:border-forest/50 hover:bg-sage-wash",
                        )}
                      >
                        {formatTime(s.time)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}
