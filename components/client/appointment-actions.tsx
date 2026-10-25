"use client";

import { CalendarClock, CalendarPlus, CheckCircle2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api, RequestError } from "@/lib/api";
import { formatDateLong, formatTime } from "@/lib/time";
import type { Appointment } from "@/lib/types";
import { SlotPicker, type SlotValue } from "../slot-picker";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogContent } from "../ui/dialog";

type OnChange = (a: Appointment) => void;

function errorToast(e: unknown, fallback: string) {
  toast.error(e instanceof RequestError ? e.message : fallback);
}

export function ConfirmAttendanceButton({
  appt,
  onChange,
  size = "md",
  className,
}: {
  appt: Appointment;
  onChange: OnChange;
  size?: "sm" | "md";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  if (appt.attendance === "confirmed") return null;
  return (
    <Button
      size={size}
      className={className}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          onChange(await api.patch(appt.id, { action: "confirm", expectedUpdatedAt: appt.updatedAt }, "client"));
          toast.success("Thanks! We've let the practice know you're coming.");
        } catch (e) {
          errorToast(e, "We couldn't confirm that. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <CheckCircle2 aria-hidden /> I'll be there
    </Button>
  );
}

export function RescheduleDialog({
  appt,
  onChange,
  trigger,
}: {
  appt: Appointment;
  onChange: OnChange;
  trigger?: (open: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<SlotValue | null>({ date: appt.date, time: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!value?.time) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch(
        appt.id,
        { action: "reschedule", date: value.date, time: value.time, expectedUpdatedAt: appt.updatedAt },
        "client",
      );
      onChange(updated);
      setOpen(false);
      toast.success(`Moved to ${formatDateLong(updated.date)} at ${formatTime(updated.time)}.`);
    } catch (e) {
      setError(e instanceof RequestError ? e.message : "We couldn't move it. Please try again.");
      if (e instanceof RequestError && e.status === 409) setValue({ date: value.date, time: null });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setValue({ date: appt.date, time: null });
          setError(null);
        }
      }}
    >
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <CalendarClock aria-hidden /> Reschedule
        </Button>
      )}
      <DialogContent
        title="Pick a new time"
        description={`Currently ${formatDateLong(appt.date)} at ${formatTime(appt.time)}. Your old time is released as soon as you move.`}
      >
        <SlotPicker actor="client" value={value} onChange={setValue} excludeId={appt.id} />
        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-noshow-soft px-4 py-3 text-sm text-noshow">
            {error}
          </p>
        )}
        <div className="sticky bottom-0 mt-5 flex gap-3 bg-surface pt-2">
          <DialogClose asChild>
            <Button variant="ghost" className="flex-1">
              Keep current time
            </Button>
          </DialogClose>
          <Button className="flex-1" disabled={!value?.time} loading={busy} onClick={submit}>
            {value?.time ? `Move to ${formatTime(value.time)}` : "Choose a time"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CancelDialog({ appt, onChange }: { appt: Appointment; onChange: OnChange }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="danger-ghost" size="sm" onClick={() => setOpen(true)}>
        <X aria-hidden /> Cancel
      </Button>
      <DialogContent
        title="Cancel this consultation?"
        description={`${formatDateLong(appt.date)} at ${formatTime(appt.time)}`}
      >
        <p className="text-[15px] text-ink-soft">
          No problem, plans change. Cancelling frees the time so someone else can use it. If you'd rather keep your
          consultation, you can move it to another day instead.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <DialogClose asChild>
            <Button variant="secondary" className="flex-1">
              Keep it
            </Button>
          </DialogClose>
          <Button
            variant="danger"
            className="flex-1"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                onChange(await api.patch(appt.id, { action: "cancel", expectedUpdatedAt: appt.updatedAt }, "client"));
                setOpen(false);
                toast.success("Cancelled. The time is free for someone else now.");
              } catch (e) {
                errorToast(e, "We couldn't cancel it. Please try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Yes, cancel it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AddToCalendarLink({ appt, className }: { appt: Appointment; className?: string }) {
  return (
    <a
      href={`/api/appointments/${appt.id}/calendar`}
      className={className ?? "inline-flex items-center gap-1.5 text-sm font-medium text-forest underline-offset-4 hover:underline"}
    >
      <CalendarPlus className="size-4" aria-hidden /> Add to my calendar
    </a>
  );
}
