// Browser-side calls to our own API. Everything the UI does goes through these.

import type { Appointment, Slot } from "./types";
import type { PatchInput } from "./validation";

export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new RequestError("You seem to be offline. Check your connection and try again.", 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new RequestError(body.error ?? "Something went wrong. Please try again.", res.status, body.fields);
  return body as T;
}

export type Actor = "client" | "dashboard";

export const api = {
  list: (phone?: string) =>
    request<{ appointments: Appointment[] }>(`/api/appointments${phone ? `?phone=${encodeURIComponent(phone)}` : ""}`).then(
      (r) => r.appointments,
    ),
  get: (id: string) => request<{ appointment: Appointment }>(`/api/appointments/${id}`).then((r) => r.appointment),
  create: (input: { name: string; phone?: string; date: string; time: string; notes?: string }, actor: Actor) =>
    request<{ appointment: Appointment }>("/api/appointments", {
      method: "POST",
      body: JSON.stringify({ ...input, actor }),
    }).then((r) => r.appointment),
  patch: (id: string, patch: PatchInput, actor: Actor) =>
    request<{ appointment: Appointment }>(`/api/appointments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...patch, actor }),
    }).then((r) => r.appointment),
  slots: (date: string, actor: Actor, exclude?: string) =>
    request<{ slots: Slot[] }>(
      `/api/slots?date=${date}&actor=${actor}${exclude ? `&exclude=${encodeURIComponent(exclude)}` : ""}`,
    ).then((r) => r.slots),
  health: () => request<{ storage: "supabase" | "demo"; reminders: string; resetEnabled: boolean }>("/api/health"),
  reset: () => request<{ ok: true }>("/api/demo/reset", { method: "POST" }),
};
