"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { api, RequestError } from "@/lib/api";
import { formatDateLong, formatTime } from "@/lib/time";
import type { Appointment } from "@/lib/types";
import { nameSchema, optionalPhoneSchema } from "@/lib/validation";
import { SlotPicker, type SlotValue } from "../slot-picker";
import { Button } from "../ui/button";
import { Dialog, DialogContent } from "../ui/dialog";
import { Field } from "../ui/field";

const schema = z.object({
  name: nameSchema,
  phone: optionalPhoneSchema,
  notes: z.string().max(500, "Keep notes under 500 characters.").optional(),
});
type In = z.input<typeof schema>;
type Out = z.output<typeof schema>;

export function AddAppointmentDialog({ onAdded }: { onAdded: (a: Appointment) => void }) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<SlotValue | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(schema), defaultValues: { name: "", phone: "", notes: "" } });

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (o) {
      form.reset({ name: "", phone: "", notes: "" });
      setSlot(null);
      setSlotError(null);
      setFormError(null);
    }
  };

  const submit = form.handleSubmit(async (d) => {
    if (!slot?.time) {
      setSlotError("Pick a date and time.");
      return;
    }
    setFormError(null);
    try {
      const appt = await api.create(
        { name: d.name, phone: d.phone ?? undefined, notes: d.notes || undefined, date: slot.date, time: slot.time },
        "dashboard",
      );
      onAdded(appt);
      toast.success(`${appt.clientName} booked for ${formatDateLong(appt.date)}, ${formatTime(appt.time)}.`);
      setOpen(false);
    } catch (e) {
      if (e instanceof RequestError) {
        if (e.fields?.time) {
          setSlotError(e.fields.time);
          setSlot({ date: slot.date, time: null });
        }
        if (e.fields?.name) form.setError("name", { message: e.fields.name });
        if (e.fields?.phone) form.setError("phone", { message: e.fields.phone });
        setFormError(e.message);
      } else setFormError("Couldn't save the appointment. Please try again.");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button onClick={() => onOpenChange(true)}>
        <Plus aria-hidden /> Add appointment
      </Button>
      <DialogContent title="Add an appointment" description="For bookings that come in by phone or WhatsApp.">
        <form noValidate onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client name" autoComplete="off" error={form.formState.errors.name?.message} {...form.register("name")} />
            <Field
              label="Mobile number"
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              placeholder="98200 11111"
              hint="Optional, but needed for reminders."
              error={form.formState.errors.phone?.message}
              {...form.register("phone")}
            />
          </div>
          <SlotPicker
            actor="dashboard"
            value={slot}
            onChange={(v) => {
              setSlot(v);
              setSlotError(null);
            }}
          />
          {slotError && (
            <p role="alert" className="text-sm text-noshow">
              {slotError}
            </p>
          )}
          <div className="space-y-1.5">
            <label htmlFor="add-notes" className="block text-sm font-medium text-ink-soft">
              Notes <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="add-notes"
              rows={2}
              className="w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-[16px] focus:border-forest focus:ring-3 focus:ring-forest/15 focus:outline-none"
              {...form.register("notes")}
            />
          </div>
          {formError && !slotError && (
            <p role="alert" className="rounded-xl bg-noshow-soft px-4 py-3 text-sm text-noshow">
              {formError}
            </p>
          )}
          <div className="sticky bottom-0 flex gap-3 bg-surface pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={form.formState.isSubmitting}>
              {slot?.time ? `Book ${formatTime(slot.time)}` : "Save appointment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
