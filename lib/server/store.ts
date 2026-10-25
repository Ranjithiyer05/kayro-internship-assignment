// Storage. One interface, two backends:
//
//  - Supabase (Postgres) when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.
//    This is the production mode: the client app and the dashboard read and write
//    the same table, and a partial unique index makes double booking impossible
//    even under concurrent requests (see supabase/schema.sql).
//
//  - Local demo mode otherwise: a JSON file on disk, written atomically behind an
//    in-process lock. Data survives refreshes and restarts of `next dev`. On a
//    serverless host it lives in /tmp and is per-instance, so it is for demos only.
//
// Only server code imports this file. The service-role key never reaches the browser.

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Appointment } from "../types.ts";
import { buildSeed } from "../seed.ts";

export class SlotTakenError extends Error {
  constructor() {
    super("That time has just been booked by someone else.");
  }
}

export class StaleWriteError extends Error {
  constructor() {
    super("This appointment was changed somewhere else. Refresh and try again.");
  }
}

export type StoreKind = "supabase" | "demo";

export interface Store {
  kind: StoreKind;
  list(): Promise<Appointment[]>;
  get(id: string): Promise<Appointment | null>;
  /** Throws SlotTakenError if an active booking already holds the slot. */
  insert(appt: Appointment): Promise<Appointment>;
  /**
   * Replaces a record, but only if it has not changed since it was read
   * (`expectedUpdatedAt`). Throws SlotTakenError or StaleWriteError.
   */
  update(next: Appointment, expectedUpdatedAt: string): Promise<Appointment>;
  /** Deletes everything and loads the sample data again. */
  reset(): Promise<void>;
}

const holdsSlot = (a: Appointment) => a.status !== "cancelled";
const clashes = (a: Appointment, b: Appointment) =>
  a.id !== b.id && a.date === b.date && a.time === b.time && holdsSlot(a) && holdsSlot(b);

// ---------------------------------------------------------------------------
// Local demo mode
// ---------------------------------------------------------------------------

class FileStore implements Store {
  kind = "demo" as const;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private file: string) {}

  /** Runs one read-modify-write at a time, so the slot check and the write are atomic. */
  private locked<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async read(): Promise<Appointment[]> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8")) as Appointment[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      // First run: create the file with the sample data. Never re-seeds after that.
      const seed = buildSeed();
      await this.write(seed);
      return seed;
    }
  }

  private async write(all: Appointment[]) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(all, null, 2));
    await fs.rename(tmp, this.file);
  }

  list() {
    return this.locked(() => this.read());
  }
  get(id: string) {
    return this.locked(async () => (await this.read()).find((a) => a.id === id) ?? null);
  }
  insert(appt: Appointment) {
    return this.locked(async () => {
      const all = await this.read();
      if (all.some((a) => clashes(a, appt))) throw new SlotTakenError();
      all.push(appt);
      await this.write(all);
      return appt;
    });
  }
  update(next: Appointment, expectedUpdatedAt: string) {
    return this.locked(async () => {
      const all = await this.read();
      const i = all.findIndex((a) => a.id === next.id);
      if (i === -1 || all[i].updatedAt !== expectedUpdatedAt) throw new StaleWriteError();
      if (all.some((a) => clashes(a, next))) throw new SlotTakenError();
      all[i] = next;
      await this.write(all);
      return next;
    });
  }
  reset() {
    return this.locked(() => this.write(buildSeed()));
  }
}

// ---------------------------------------------------------------------------
// Supabase (Postgres)
// ---------------------------------------------------------------------------

interface Row {
  id: string;
  client_name: string;
  client_phone: string | null;
  appointment_date: string;
  appointment_time: string;
  status: Appointment["status"];
  attendance_confirmation: Appointment["attendance"];
  confirmed_at: string | null;
  reminder_24h_status: Appointment["reminder24h"];
  reminder_24h_sent_at: string | null;
  reminder_2h_status: Appointment["reminder2h"];
  reminder_2h_sent_at: string | null;
  reschedule_count: number;
  source: Appointment["source"];
  notes: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
}

const toRow = (a: Appointment): Row => ({
  id: a.id,
  client_name: a.clientName,
  client_phone: a.clientPhone,
  appointment_date: a.date,
  appointment_time: a.time,
  status: a.status,
  attendance_confirmation: a.attendance,
  confirmed_at: a.confirmedAt,
  reminder_24h_status: a.reminder24h,
  reminder_24h_sent_at: a.reminder24hSentAt,
  reminder_2h_status: a.reminder2h,
  reminder_2h_sent_at: a.reminder2hSentAt,
  reschedule_count: a.rescheduleCount,
  source: a.source,
  notes: a.notes,
  created_at: a.createdAt,
  updated_at: a.updatedAt,
  cancelled_at: a.cancelledAt,
});

// Postgres returns timestamps as "2026-10-25T07:00:00+00:00" and times as "16:00:00".
// Normalise both so values compare equal to what we wrote.
const iso = (v: string | null) => (v ? new Date(v).toISOString() : null);

const fromRow = (r: Row): Appointment => ({
  id: r.id,
  clientName: r.client_name,
  clientPhone: r.client_phone,
  date: r.appointment_date,
  time: r.appointment_time.slice(0, 5),
  status: r.status,
  attendance: r.attendance_confirmation,
  confirmedAt: iso(r.confirmed_at),
  reminder24h: r.reminder_24h_status,
  reminder24hSentAt: iso(r.reminder_24h_sent_at),
  reminder2h: r.reminder_2h_status,
  reminder2hSentAt: iso(r.reminder_2h_sent_at),
  rescheduleCount: r.reschedule_count,
  source: r.source,
  notes: r.notes,
  createdAt: iso(r.created_at)!,
  updatedAt: iso(r.updated_at)!,
  cancelledAt: iso(r.cancelled_at),
});

const UNIQUE_VIOLATION = "23505";
const TABLE = "appointments";

class SupabaseStore implements Store {
  kind = "supabase" as const;
  private seeded: Promise<void> | null = null;
  constructor(private db: SupabaseClient) {}

  /** Inserts the sample rows once. Fixed ids + ignoreDuplicates make this idempotent. */
  private ensureSeeded() {
    this.seeded ??= (async () => {
      const { error } = await this.db
        .from(TABLE)
        .upsert(buildSeed().map(toRow), { onConflict: "id", ignoreDuplicates: true });
      if (error && error.code !== UNIQUE_VIOLATION) {
        this.seeded = null;
        throw new Error(`Could not load sample data: ${error.message}`);
      }
    })();
    return this.seeded;
  }

  async list() {
    await this.ensureSeeded();
    const { data, error } = await this.db.from(TABLE).select("*").order("appointment_date").order("appointment_time");
    if (error) throw new Error(error.message);
    return (data as Row[]).map(fromRow);
  }
  async get(id: string) {
    await this.ensureSeeded();
    const { data, error } = await this.db.from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow(data as Row) : null;
  }
  async insert(appt: Appointment) {
    await this.ensureSeeded();
    const { data, error } = await this.db.from(TABLE).insert(toRow(appt)).select("*").single();
    if (error?.code === UNIQUE_VIOLATION) throw new SlotTakenError();
    if (error) throw new Error(error.message);
    return fromRow(data as Row);
  }
  async update(next: Appointment, expectedUpdatedAt: string) {
    const { data, error } = await this.db
      .from(TABLE)
      .update(toRow(next))
      .eq("id", next.id)
      .eq("updated_at", expectedUpdatedAt)
      .select("*");
    if (error?.code === UNIQUE_VIOLATION) throw new SlotTakenError();
    if (error) throw new Error(error.message);
    if (!data?.length) throw new StaleWriteError();
    return fromRow(data[0] as Row);
  }
  async reset() {
    const { error } = await this.db.from(TABLE).delete().not("id", "is", null);
    if (error) throw new Error(error.message);
    this.seeded = null;
    await this.ensureSeeded();
  }
}

function createStore(): Store {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (url && key) {
    return new SupabaseStore(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
  }
  const file =
    process.env.DEMO_DATA_FILE ??
    (process.env.VERCEL ? "/tmp/kayro-demo/appointments.json" : path.join(process.cwd(), ".data", "appointments.json"));
  return new FileStore(file);
}

// One store per process, kept across hot reloads in development.
const g = globalThis as unknown as { __kayroStore?: Store };
export function getStore(): Store {
  g.__kayroStore ??= createStore();
  return g.__kayroStore;
}
