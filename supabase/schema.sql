-- Nourish Studio appointments: run once in the Supabase SQL editor.
-- Safe to run again: everything is "if not exists" / "on conflict do nothing".

create table if not exists public.appointments (
  id                       uuid primary key default gen_random_uuid(),
  client_name              text not null check (char_length(client_name) between 2 and 60),
  client_phone             text check (client_phone ~ '^[6-9][0-9]{9}$'),        -- null = not provided
  appointment_date         date not null,                                          -- Asia/Kolkata calendar date
  appointment_time         time not null,                                          -- Asia/Kolkata wall-clock time
  status                   text not null default 'booked'
                             check (status in ('booked', 'done', 'no-show', 'cancelled')),
  attendance_confirmation  text not null default 'pending'
                             check (attendance_confirmation in ('pending', 'confirmed')),
  confirmed_at             timestamptz,
  reminder_24h_status      text not null default 'scheduled'
                             check (reminder_24h_status in ('scheduled', 'sent', 'unavailable', 'skipped')),
  reminder_24h_sent_at     timestamptz,
  reminder_2h_status       text not null default 'scheduled'
                             check (reminder_2h_status in ('scheduled', 'sent', 'unavailable', 'skipped')),
  reminder_2h_sent_at      timestamptz,
  reschedule_count         integer not null default 0 check (reschedule_count >= 0),
  source                   text not null default 'client' check (source in ('client', 'dashboard', 'sample')),
  notes                    text check (char_length(notes) <= 500),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  cancelled_at             timestamptz,
  constraint cancelled_has_timestamp check (status <> 'cancelled' or cancelled_at is not null)
);

-- The double-booking guard. Only one active (non-cancelled) appointment per slot.
-- Two concurrent inserts for the same slot: Postgres lets exactly one win and the
-- other gets error 23505, which the app turns into "that time was just taken".
-- Cancelled rows are excluded, so cancelling frees the slot but keeps the history.
create unique index if not exists appointments_one_active_per_slot
  on public.appointments (appointment_date, appointment_time)
  where status <> 'cancelled';

create index if not exists appointments_phone_idx on public.appointments (client_phone);
create index if not exists appointments_date_idx on public.appointments (appointment_date, appointment_time);

-- Row Level Security: on, with no policies. The browser never talks to the
-- database. All reads and writes go through the app's server routes using the
-- service-role key, which stays on the server. The public anon key, if anyone
-- has it, can read or write nothing.
alter table public.appointments enable row level security;

-- Sample data from the brief, already normalised. Fixed ids make it idempotent.
-- (The app also inserts these on first start, the same way, so this block is optional.)
insert into public.appointments
  (id, client_name, client_phone, appointment_date, appointment_time, status,
   reminder_24h_status, reminder_2h_status, source, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000001', 'Riya Shah',   '9820011111', '2026-10-24', '10:00', 'booked',  'scheduled',   'scheduled',   'sample', '2026-10-18T09:00:00Z', '2026-10-18T09:00:00Z'),
  ('00000000-0000-4000-8000-000000000002', 'Arjun Mehta', '9820022222', '2026-10-24', '11:30', 'booked',  'scheduled',   'scheduled',   'sample', '2026-10-18T09:00:00Z', '2026-10-18T09:00:00Z'),
  ('00000000-0000-4000-8000-000000000003', 'Riya Shah',   '9820011111', '2026-10-25', '16:00', 'booked',  'scheduled',   'scheduled',   'sample', '2026-10-18T09:00:00Z', '2026-10-18T09:00:00Z'),
  ('00000000-0000-4000-8000-000000000004', 'Meera Iyer',  null,         '2026-10-23', '09:00', 'done',    'skipped',     'skipped',     'sample', '2026-10-18T09:00:00Z', '2026-10-18T09:00:00Z'),
  ('00000000-0000-4000-8000-000000000005', 'Kabir Rao',   '9820033333', '2026-10-22', '14:00', 'no-show', 'skipped',     'skipped',     'sample', '2026-10-18T09:00:00Z', '2026-10-18T09:00:00Z')
on conflict (id) do nothing;
