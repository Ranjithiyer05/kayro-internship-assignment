"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { phoneSchema } from "@/lib/validation";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { useProfile } from "./profile";

/** "Booked before?" Finds a client's appointments by the phone number they booked with. */
export function FindAppointments() {
  const { setProfile } = useProfile();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    setError(undefined);
    try {
      const list = await api.list(parsed.data);
      if (!list.length) {
        setError("We couldn't find any bookings for that number. Check it, or book your first consultation.");
        return;
      }
      setProfile({ name: list[list.length - 1].clientName, phone: parsed.data });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
      <Field
        label="Mobile number you booked with"
        className="flex-1"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="98200 11111"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        error={error}
      />
      <Button type="submit" variant="secondary" loading={busy} className="sm:mt-7">
        <Search aria-hidden /> Find my appointments
      </Button>
    </form>
  );
}
