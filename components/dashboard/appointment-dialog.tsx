"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, MessageCircle, Pencil, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { api, RequestError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/normalize";
import { displayPhone, reminderViews } from "@/lib/reminders";
import { formatDateLong, formatTime, isPast } from "@/lib/time";
import type { Appointment, ReminderKind, Status } from "@/lib/types";
import { EDITABLE_STATUSES, STATUS_LABEL } from "@/lib/types";
import { nameSchema, optionalPhoneSchema } from "@/lib/validation";
import { SlotPicker, type SlotValue } from "../slot-picker";
import { AttendancePill, ReminderChip, STATUS_STYLE, StatusBadge } from "../status";
import { Button } from "../ui/button";
import { Dialog, DialogContent } from "../ui/dialog";
import { Field } from "../ui/field";
import { reminderLink } from "./whatsapp";

const stamp = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

const SOURCE_LABEL = { client: "Client app", dashboard: "Added by you", sample: "Sample data" } as const;

export function useStatusChange(onChange: (a: Appointment) => void) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const change = async (appt: Appointment, status: Exclude<Status, "cancelled">) => {
    if (appt.status === status) return;
    setBusyId(appt.id);
    try {
      onChange(await api.patch(appt.id, { action: "status", status, expectedUpdatedAt: appt.updatedAt }, "dashboard"));
      toast.success(`${appt.clientName} marked ${STATUS_LABEL[status]}.`);
    } catch (e) {
      toast.error(e instanceof RequestError ? e.message : "Couldn't update the status.");
    } finally {
      setBusyId(null);
    }
  };
  return { change, busyId };
}

export function StatusControl({
  appt,
  onChange,
  size = "md",
}: {
  appt: Appointment;
  onChange: (a: Appointment) => void;
  size?: "sm" | "md";
}) {
  const { change, busyId } = useStatusChange(onChange);
  const started = isPast(appt.date, appt.time);
  if (appt.status === "cancelled") return <StatusBadge status="cancelled" />;
  return (
    <div role="radiogroup" aria-label={`Status for ${appt.clientName}`} className="inline-flex rounded-full bg-cream-deep p-0.5" aria-busy={busyId === appt.id}>
      {EDITABLE_STATUSES.map((s) => {
        const active = appt.status === s;
        const blocked = s !== "booked" && !started;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={busyId === appt.id || blocked}
            title={blocked ? "Available once the appointment time has started" : undefined}
            onClick={() => change(appt, s)}
            className={cn(
              "rounded-full font-medium transition-all duration-200",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
              active ? cn("ring-1 ring-inset shadow-soft", STATUS_STYLE[s]) : "text-muted hover:text-ink disabled:opacity-40 disabled:hover:text-muted",
            )}
          >
            {STATUS_LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}

const editSchema = z.object({ name: nameSchema, phone: optionalPhoneSchema, notes: z.string().max(500).optional() });
type EditIn = z.input<typeof editSchema>;
type EditOut = z.output<typeof editSchema>;

function EditDetails({ appt, onDone }: { appt: Appointment; onDone: (a?: Appointment) => void }) {
  const form = useForm<EditIn, unknown, EditOut>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: appt.clientName, phone: appt.clientPhone ? formatPhone(appt.clientPhone) : "", notes: appt.notes ?? "" },
  });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit(async (d) => {
        try {
          const updated = await api.patch(
            appt.id,
            { action: "edit", name: d.name, phone: d.phone ?? "", notes: d.notes ?? "", expectedUpdatedAt: appt.updatedAt },
            "dashboard",
          );
          toast.success("Details saved.");
          onDone(updated);
        } catch (e) {
          if (e instanceof RequestError && e.fields) {
            for (const [k, v] of Object.entries(e.fields)) form.setError(k as keyof EditIn, { message: v });
          } else toast.error((e as Error).message);
        }
      })}
    >
      <Field label="Client name" error={form.formState.errors.name?.message} {...form.register("name")} />
      <Field
        label="Mobile number"
        type="tel"
        inputMode="numeric"
        hint="Leave empty if you don't have it."
        error={form.formState.errors.phone?.message}
        {...form.register("phone")}
      />
      <div className="space-y-1.5">
        <label htmlFor="edit-notes" className="block text-sm font-medium text-ink-soft">
          Notes
        </label>
        <textarea
          id="edit-notes"
          rows={3}
          className="w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-[16px] focus:border-forest focus:ring-3 focus:ring-forest/15 focus:outline-none"
          {...form.register("notes")}
        />
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="ghost" className="flex-1" onClick={() => onDone()}>
          Back
        </Button>
        <Button type="submit" className="flex-1" loading={form.formState.isSubmitting}>
          Save details
        </Button>
      </div>
    </form>
  );
}

function Reschedule({ appt, onDone }: { appt: Appointment; onDone: (a?: Appointment) => void }) {
  const [value, setValue] = useState<SlotValue | null>({ date: appt.date, time: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <SlotPicker actor="dashboard" value={value} onChange={setValue} excludeId={appt.id} />
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-noshow-soft px-4 py-3 text-sm text-noshow">
          {error}
        </p>
      )}
      <div className="sticky bottom-0 mt-5 flex gap-3 bg-surface pt-2">
        <Button variant="ghost" className="flex-1" onClick={() => onDone()}>
          Back
        </Button>
        <Button
          className="flex-1"
          disabled={!value?.time}
          loading={busy}
          onClick={async () => {
            if (!value?.time) return;
            setBusy(true);
            setError(null);
            try {
              const updated = await api.patch(
                appt.id,
                { action: "reschedule", date: value.date, time: value.time, expectedUpdatedAt: appt.updatedAt },
                "dashboard",
              );
              toast.success(`Moved to ${formatDateLong(updated.date)}, ${formatTime(updated.time)}.`);
              onDone(updated);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {value?.time ? `Move to ${formatTime(value.time)}` : "Choose a time"}
        </Button>
      </div>
    </div>
  );
}

export function AppointmentDialog({
  appt,
  open,
  onOpenChange,
  onChange,
  history,
}: {
  appt: Appointment | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChange: (a: Appointment) => void;
  /** All appointments for the same phone, for the client history line. */
  history: Appointment[];
}) {
  const [mode, setMode] = useState<"view" | "edit" | "reschedule" | "cancel">("view");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setMode("view");
  }, [open, appt?.id]);
  if (!appt) return null;

  const started = isPast(appt.date, appt.time);
  const upcoming = appt.status === "booked" && !started;
  const reminders = reminderViews(appt);
  const noShows = history.filter((h) => h.status === "no-show").length;
  const visits = history.filter((h) => h.status === "done").length;

  const finish = (a?: Appointment) => {
    if (a) onChange(a);
    setMode("view");
  };

  const sendReminder = async (kind: ReminderKind) => {
    const link = reminderLink(appt, kind);
    if (!link) return;
    window.open(link, "_blank", "noopener,noreferrer");
    try {
      onChange(await api.patch(appt.id, { action: "reminder-sent", kind, expectedUpdatedAt: appt.updatedAt }, "dashboard"));
      toast.success("WhatsApp opened with the reminder. Marked as sent.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const title = mode === "edit" ? "Edit client details" : mode === "reschedule" ? "Move appointment" : mode === "cancel" ? "Cancel appointment?" : appt.clientName;
  const description = `${formatDateLong(appt.date)} at ${formatTime(appt.time)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        {mode === "edit" && <EditDetails appt={appt} onDone={finish} />}
        {mode === "reschedule" && <Reschedule appt={appt} onDone={finish} />}
        {mode === "cancel" && (
          <div>
            <p className="text-[15px] text-ink-soft">
              The appointment stays in the history as Cancelled and the time becomes free to book again.
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setMode("view")}>
                Keep it
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    finish(await api.patch(appt.id, { action: "cancel", expectedUpdatedAt: appt.updatedAt }, "dashboard"));
                    toast.success("Appointment cancelled. The slot is free again.");
                  } catch (e) {
                    toast.error((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Yes, cancel
              </Button>
            </div>
          </div>
        )}
        {mode === "view" && (
          <div className="space-y-6">
            <section aria-label="Status" className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={appt.status} />
                <AttendancePill appt={appt} />
              </div>
              {appt.status !== "cancelled" ? (
                <div>
                  <StatusControl appt={appt} onChange={onChange} />
                  {!started && <p className="mt-1.5 text-xs text-muted">Done and No-show unlock when the appointment starts.</p>}
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busy}
                  disabled={started}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      onChange(await api.patch(appt.id, { action: "status", status: "booked", expectedUpdatedAt: appt.updatedAt }, "dashboard"));
                      toast.success("Booking restored.");
                    } catch (e) {
                      toast.error((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <RotateCcw aria-hidden /> Restore booking
                </Button>
              )}
            </section>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Phone</dt>
                <dd className={cn("font-medium", !appt.clientPhone && "text-warn")}>{displayPhone(appt.clientPhone)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Booked via</dt>
                <dd className="font-medium">{SOURCE_LABEL[appt.source]}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Confirmation</dt>
                <dd className="font-medium">{appt.confirmedAt ? `Confirmed ${stamp(appt.confirmedAt)}` : appt.status === "booked" ? "Not yet" : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Client history</dt>
                <dd className="font-medium">
                  {visits} visit{visits === 1 ? "" : "s"} · {noShows} no-show{noShows === 1 ? "" : "s"}
                </dd>
              </div>
              {appt.rescheduleCount > 0 && (
                <div>
                  <dt className="text-xs text-muted">Moved</dt>
                  <dd className="font-medium">{appt.rescheduleCount}×</dd>
                </div>
              )}
              {appt.cancelledAt && (
                <div>
                  <dt className="text-xs text-muted">Cancelled</dt>
                  <dd className="font-medium">{stamp(appt.cancelledAt)}</dd>
                </div>
              )}
              {appt.notes && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted">Notes</dt>
                  <dd className="whitespace-pre-wrap">{appt.notes}</dd>
                </div>
              )}
            </dl>

            {appt.status === "booked" && (
              <section aria-labelledby="reminders-h" className="rounded-2xl bg-cream p-4">
                <h3 id="reminders-h" className="font-sans text-sm font-semibold text-ink">
                  Reminders
                </h3>
                <ul className="mt-3 space-y-3">
                  {reminders.map((r) => (
                    <li key={r.kind} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        {r.label}
                        <span className="block text-xs text-muted">
                          {r.status === "sent" && r.sentAt ? `Sent ${stamp(r.sentAt)}` : `Due ${stamp(r.sendAt.toISOString())}`}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <ReminderChip view={r} />
                        {appt.clientPhone && r.status !== "sent" && upcoming && (
                          <Button size="sm" variant={r.due ? "primary" : "secondary"} onClick={() => sendReminder(r.kind)}>
                            <MessageCircle aria-hidden /> Send
                          </Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted">
                  No messaging service is connected, so nothing is sent automatically. "Send" opens WhatsApp with the message written for you.
                </p>
              </section>
            )}

            <div className="flex flex-wrap gap-2 border-t border-line pt-5">
              <Button variant="secondary" size="sm" onClick={() => setMode("edit")}>
                <Pencil aria-hidden /> Edit details
              </Button>
              {upcoming && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => setMode("reschedule")}>
                    <CalendarClock aria-hidden /> Reschedule
                  </Button>
                  <Button variant="danger-ghost" size="sm" onClick={() => setMode("cancel")}>
                    <X aria-hidden /> Cancel
                  </Button>
                </>
              )}
              {appt.clientPhone && (
                <a
                  href={reminderLink(appt, "manual") ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-forest hover:bg-sage-wash"
                >
                  <MessageCircle className="size-4" aria-hidden /> WhatsApp
                </a>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
