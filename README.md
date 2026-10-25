# Nourish Studio: appointments for a wellness practice

A two-sided appointments product for a nutritionist whose clients book over WhatsApp, and about 1 in 4 don't turn up.

- **Client app** (`/`): mobile-first. Shows your next consultation, lets you book in three short steps, and lets you confirm, reschedule or cancel.
- **Nutritionist dashboard** (`/dashboard`): shows today's schedule, a daily preparation list, what needs attention, and every appointment with quick status changes, search, filters and manual booking.

Both sides read and write the same records through the same API, so a change on one side shows up on the other. The dashboard re-syncs every 8 seconds and whenever the tab regains focus.

## Features

| Area | What it does |
| --- | --- |
| Booking | Pick a date, then a free slot, then enter name and phone. You review everything before you confirm, then see a success screen. Only open, future slots are shown. Double booking is blocked on the server. |
| My appointments | Upcoming and past/cancelled tabs, a detail page, and confirm, reschedule (with a slot picker) and cancel (with a confirmation step). Past and completed appointments are read-only. |
| Dashboard | Overview stats from real records, a "Needs your attention" list, today's schedule, and a daily prep list (Confirmed, Awaiting confirmation, Cancelled, Completed, No-shows). The table has three colour-coded statuses (Booked blue, Done green, No-show red). You can search by name or phone, filter by Today, date or status, and sort by time. Details open in a modal, and you can add appointments by hand. |
| No-show prevention | Clients confirm attendance, and unconfirmed clients are flagged. There is an in-app reminder banner in the 24 hours before. Reminder status is tracked for 24h and 2h (scheduled, sent, unavailable or not needed), with a one-tap WhatsApp message prefilled from the dashboard. Clients get an `.ics` calendar file with a 2h alarm. Rescheduling and cancelling are one tap, so slots get freed. Each client's past no-shows are shown. |

## Stack

Next.js 16 (App Router, TypeScript), Tailwind CSS v4, shadcn/ui-style components on Radix Dialog, Lucide icons, Zod (shared client/server validation), React Hook Form, Sonner toasts, Supabase Postgres (production) with a file-backed demo mode.

## Architecture

```
app/(client)/…        client app pages     app/dashboard        nutritionist dashboard
app/api/…             route handlers: appointments, slots, calendar (.ics), health, demo reset, cron/reminders
lib/server/appointments.ts   every booking rule (one place for both sides)
lib/server/store.ts          storage: SupabaseStore | FileStore (demo)
lib/validation.ts            Zod schemas used by forms and API
lib/normalize.ts, time.ts    phone/date/time parsing, IST time handling, slot generation
lib/reminders.ts             reminder schedule/status; lib/server/reminder-provider.ts = pluggable sender
supabase/schema.sql          table, constraints, unique slot index, RLS
```

**Double booking.** In Postgres, a partial unique index on `(appointment_date, appointment_time) WHERE status <> 'cancelled'` means that when two people book the same slot at once, only one write can succeed. The other gets error 23505, which the app shows as "that time was just taken". In demo mode, a per-process write lock does the same job. Updates also carry `expectedUpdatedAt`, so a stale edit is rejected instead of silently overwriting a newer one.

**Time zones.** Dates are stored as `YYYY-MM-DD` and times as `HH:MM` in practice time (Asia/Kolkata). "Now" is always computed in IST using `Intl`, so a UTC server or a client abroad sees the same slots.

## Database schema

Table `appointments`: `id uuid`, `client_name`, `client_phone` (10 digits or null), `appointment_date date`, `appointment_time time`, `status` (booked, done, no-show or cancelled), `attendance_confirmation` (pending or confirmed), `confirmed_at`, `reminder_24h_status`, `reminder_24h_sent_at`, `reminder_2h_status`, `reminder_2h_sent_at`, `reschedule_count`, `source` (client, dashboard or sample), `notes`, `created_at`, `updated_at`, `cancelled_at`. Every enum has a CHECK constraint. See `supabase/schema.sql`.

**Security.** RLS is enabled with no policies, so the public anon key can read and write nothing. Only the server routes touch the database, using the service-role key, which lives in server env vars and is never sent to the browser.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000  (dashboard: /dashboard)
```

With no env vars set, it runs in **demo mode**: data lives in `.data/appointments.json`, is seeded once with the five sample rows, and survives refreshes and restarts.

## Use Supabase

1. Create a Supabase project. In the SQL editor, run `supabase/schema.sql` (it also inserts the sample rows, idempotently).
2. Copy `.env.example` to `.env.local` and set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Project settings → API).
3. `npm run dev`. The dashboard's "Demo storage" banner disappears when Supabase is in use.

## Deploy (Vercel)

1. Push the repo to GitHub and import it in Vercel. No build settings are needed.
2. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Project → Settings → Environment Variables, then redeploy.
3. Open the URL. `/api/health` should report `"storage":"supabase"`.

Without Supabase, a Vercel deploy falls back to demo mode in `/tmp`. That data is per server instance and temporary, so the two sides may not stay in sync. Use Supabase for the hosted demo.

## Sample data

The five rows from the brief are kept in their original messy form in `lib/seed.ts` and passed through the same normalisers as real input. For example, `24/10/2026`, `2026-10-24` and `25-10-2026` all become ISO dates, `11:30am` and `4 pm` become `11:30` and `16:00`, and `98200 11111` and `9820011111` become the same phone. Meera Iyer has no phone, so it shows as "Not provided" and her reminders are "unavailable". Seed ids are fixed, so seeding is idempotent. The dashboard's "Reset demo data" button restores the sample rows.

## Tests

```bash
npm test                                # unit: normalisers, sample data, IST handling, booking window, reminders
npm run build && npm start &
node tests/api-scenarios.mjs            # end-to-end API scenarios (resets demo data!)
```

`api-scenarios.mjs` covers booking, dashboard visibility, the same-slot rejection, 10 concurrent bookings for one slot (exactly one wins), reschedule freeing the old slot, stale-write rejection, confirm, cancel (the history is kept and the slot freed), manual add without a phone, Done and No-show, the guards (no Done on future appointments, clients can't set status, completed appointments are read-only), validation errors, the `.ics` file, and reset.

## Known limitations

- **No login.** The brief asks for an open demo. Clients are recognised by the phone number saved on their device or by their private appointment link. The dashboard is open to anyone with the URL. A real practice would add phone OTP for clients and a password for the dashboard.
- **Reminders are not sent automatically.** No WhatsApp or SMS provider is connected. The app tracks when each reminder is due and shows it in-app and on the dashboard. "Send" opens WhatsApp with the message prefilled, and the reminder is marked sent when she taps it. To automate this, set `REMINDER_WEBHOOK_URL` and call `GET /api/cron/reminders` every 15 minutes. Vercel Hobby cron only runs daily, so use an external scheduler or Vercel Pro.
- One nutritionist and one fixed weekly schedule, set in `lib/config.ts`. The practice is open every day, because the sample data includes a Sunday booking.
- The dashboard syncs by polling, not realtime. Supabase Realtime would be the next step.
