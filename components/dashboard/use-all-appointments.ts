"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Appointment } from "@/lib/types";

/**
 * Every appointment, kept in sync with the client app: refetched every 8 seconds
 * and whenever the tab regains focus.
 */
export function useAllAppointments() {
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      setAppointments(await api.list());
      setError(null);
      setSyncedAt(new Date());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 8_000);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      clearInterval(t);
    };
  }, [refresh]);

  const upsert = useCallback((a: Appointment) => {
    setAppointments((prev) => {
      const list = prev ?? [];
      const exists = list.some((x) => x.id === a.id);
      return (exists ? list.map((x) => (x.id === a.id ? a : x)) : [...list, a]).sort((x, y) =>
        (x.date + x.time).localeCompare(y.date + y.time),
      );
    });
  }, []);

  return { appointments, error, syncedAt, refresh, upsert };
}
