"use client";

// The client app has no login (the brief asks for an open demo). We remember the
// name and phone the client booked with on this device, and use the phone to
// find their appointments. See README "Known limitations".

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Appointment } from "@/lib/types";

export interface Profile {
  name: string;
  phone: string;
}

const KEY = "nourish.profile.v1";

interface ProfileCtx {
  profile: Profile | null;
  ready: boolean;
  setProfile: (p: Profile | null) => void;
}

const Ctx = createContext<ProfileCtx>({ profile: null, ready: false, setProfile: () => {} });

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setState] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      // Private mode or blocked storage: the app still works, it just won't remember.
    }
    setReady(true);
  }, []);

  const setProfile = useCallback((p: Profile | null) => {
    setState(p);
    try {
      if (p) localStorage.setItem(KEY, JSON.stringify(p));
      else localStorage.removeItem(KEY);
    } catch {}
  }, []);

  return <Ctx.Provider value={{ profile, ready, setProfile }}>{children}</Ctx.Provider>;
}

export const useProfile = () => useContext(Ctx);

/**
 * The signed-in client's appointments, kept fresh: refetched when the tab regains
 * focus and every 30 seconds, so changes made in the dashboard show up here.
 */
export function useMyAppointments() {
  const { profile, ready } = useProfile();
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const phone = profile?.phone;

  const refresh = useCallback(async () => {
    if (!phone) return;
    try {
      setAppointments(await api.list(phone));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [phone]);

  useEffect(() => {
    if (!ready) return;
    if (!phone) {
      setAppointments([]);
      return;
    }
    setAppointments(null);
    refresh();
    const onFocus = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    const t = setInterval(refresh, 30_000);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      clearInterval(t);
    };
  }, [ready, phone, refresh]);

  /** Swap in an updated record without waiting for the next refetch. */
  const upsert = useCallback((a: Appointment) => {
    setAppointments((prev) => {
      if (!prev) return [a];
      const i = prev.findIndex((x) => x.id === a.id);
      const next = i === -1 ? [...prev, a] : prev.map((x) => (x.id === a.id ? a : x));
      return next.sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
    });
  }, []);

  return { appointments, error, refresh, upsert, loading: !ready || (Boolean(phone) && appointments === null) };
}
