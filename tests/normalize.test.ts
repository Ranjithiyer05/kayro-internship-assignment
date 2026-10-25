import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDate, normalizeName, normalizePhone, normalizeTime } from "../lib/normalize.ts";
import { buildSeed } from "../lib/seed.ts";
import { initialReminders, reminderViews } from "../lib/reminders.ts";
import { isBookableByClient, isPast, practiceNow, slotTimes } from "../lib/time.ts";

test("phones: spaces, +91, leading 0 and invalid numbers", () => {
  assert.equal(normalizePhone("98200 11111"), "9820011111");
  assert.equal(normalizePhone("9820011111"), "9820011111");
  assert.equal(normalizePhone("+91 98200-11111"), "9820011111");
  assert.equal(normalizePhone("098200 11111"), "9820011111");
  assert.equal(normalizePhone(""), null);
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizePhone("1820011111"), null); // Indian mobiles start 6-9
});

test("dates: every format in the sample sheet", () => {
  assert.equal(normalizeDate("24/10/2026"), "2026-10-24");
  assert.equal(normalizeDate("2026-10-24"), "2026-10-24");
  assert.equal(normalizeDate("25-10-2026"), "2026-10-25");
  assert.equal(normalizeDate("31/02/2026"), null);
  assert.equal(normalizeDate("tomorrow"), null);
});

test("times: 24h, am/pm, bare hours", () => {
  assert.equal(normalizeTime("10:00"), "10:00");
  assert.equal(normalizeTime("11:30am"), "11:30");
  assert.equal(normalizeTime("4 pm"), "16:00");
  assert.equal(normalizeTime("09:00"), "09:00");
  assert.equal(normalizeTime("14:00"), "14:00");
  assert.equal(normalizeTime("12 pm"), "12:00");
  assert.equal(normalizeTime("12am"), "00:00");
  assert.equal(normalizeTime("25:00"), null);
  assert.equal(normalizeTime("4"), null);
});

test("names are tidied", () => {
  assert.equal(normalizeName("  riya   shah "), "Riya Shah");
  assert.equal(normalizeName("x"), null);
});

test("sample data normalises to the intended five records", () => {
  const seed = buildSeed();
  assert.deepEqual(
    seed.map((a) => [a.clientName, a.clientPhone, a.date, a.time, a.status]),
    [
      ["Riya Shah", "9820011111", "2026-10-24", "10:00", "booked"],
      ["Arjun Mehta", "9820022222", "2026-10-24", "11:30", "booked"],
      ["Riya Shah", "9820011111", "2026-10-25", "16:00", "booked"],
      ["Meera Iyer", null, "2026-10-23", "09:00", "done"],
      ["Kabir Rao", "9820033333", "2026-10-22", "14:00", "no-show"],
    ],
  );
  // Same person despite the two phone formats.
  assert.equal(seed[0].clientPhone, seed[2].clientPhone);
  // Every sample slot is a real slot in the schedule.
  for (const a of seed) assert.ok(slotTimes().includes(a.time), a.time);
  // Stable ids so seeding is idempotent.
  assert.deepEqual(buildSeed().map((a) => a.id), seed.map((a) => a.id));
});

test("time zone: practice clock is IST regardless of the machine's zone", () => {
  // 2026-10-24T20:00Z is 01:30 on the 25th in India.
  assert.deepEqual(practiceNow(new Date("2026-10-24T20:00:00Z")), { date: "2026-10-25", minutes: 90 });
});

test("clients can't book the past or too soon", () => {
  const now = new Date("2026-10-25T08:00:00Z"); // 13:30 IST
  assert.equal(isBookableByClient("2026-10-24", "16:00", now), false);
  assert.equal(isBookableByClient("2026-10-25", "14:00", now), false); // under an hour away
  assert.equal(isBookableByClient("2026-10-25", "15:00", now), true);
  assert.equal(isBookableByClient("2026-10-25", "13:00", now), false); // lunch break
  assert.equal(isPast("2026-10-25", "13:30", now), true);
  assert.equal(isPast("2026-10-25", "16:00", now), false);
});

test("reminders: scheduled, skipped when too late, unavailable without a phone", () => {
  const now = new Date("2026-10-25T08:00:00Z"); // 13:30 IST on the 25th
  const r = initialReminders({ date: "2026-10-27", time: "10:00", clientPhone: "9820011111", status: "booked" }, now);
  assert.equal(r.reminder24h, "scheduled");
  assert.equal(r.reminder2h, "scheduled");
  const late = initialReminders({ date: "2026-10-25", time: "17:00", clientPhone: "9820011111", status: "booked" }, now);
  assert.equal(late.reminder24h, "skipped");
  assert.equal(late.reminder2h, "scheduled");
  const nophone = initialReminders({ date: "2026-10-27", time: "10:00", clientPhone: null, status: "booked" }, now);
  assert.equal(nophone.reminder24h, "unavailable");

  const riya = buildSeed()[2]; // today 4 pm, booked days ago
  const views = reminderViews(riya, now);
  assert.equal(views[0].due, true); // day-before reminder is overdue, nobody sent it
  assert.equal(views[1].due, false); // 2h reminder is at 2 pm
});
