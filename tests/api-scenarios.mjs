// End-to-end checks against a running server: node tests/api-scenarios.mjs [baseUrl]
// Resets the demo data first, so only run it against a demo/test instance.
import assert from "node:assert/strict";

const BASE = process.argv[2] ?? "http://localhost:3000";
const call = async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};
const results = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push(["PASS", name]);
  } catch (e) {
    results.push(["FAIL", name, e.message]);
  }
};

// Find a free client slot a couple of days ahead.
const ist = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const plus = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const day = plus(ist, 2);

await call("POST", "/api/demo/reset");

await step("12. sample data present and normalised", async () => {
  const { body } = await call("GET", "/api/appointments");
  assert.equal(body.appointments.length, 5);
  const riya = body.appointments.filter((a) => a.clientName === "Riya Shah");
  assert.equal(riya.length, 2);
  assert.ok(riya.every((a) => a.clientPhone === "9820011111"));
});

await step("13. missing phone kept as null (shown as Not provided)", async () => {
  const { body } = await call("GET", "/api/appointments");
  const meera = body.appointments.find((a) => a.clientName === "Meera Iyer");
  assert.equal(meera.clientPhone, null);
  assert.equal(meera.status, "done");
});

let first;
await step("1. client books an available slot", async () => {
  const { body: s } = await call("GET", `/api/slots?date=${day}`);
  const slot = s.slots.find((x) => x.available);
  const r = await call("POST", "/api/appointments", { actor: "client", name: "test client", phone: "+91 99999 00001", date: day, time: slot.time });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  first = r.body.appointment;
  assert.equal(first.clientName, "Test Client");
  assert.equal(first.clientPhone, "9999900001");
  assert.equal(first.reminder24h, "scheduled");
});

await step("2. new booking appears in the dashboard list", async () => {
  const { body } = await call("GET", "/api/appointments");
  assert.ok(body.appointments.some((a) => a.id === first.id));
});

await step("3. another client cannot book the same slot", async () => {
  const r = await call("POST", "/api/appointments", { actor: "client", name: "Other Person", phone: "9999900002", date: day, time: first.time });
  assert.equal(r.status, 409);
  const { body: s } = await call("GET", `/api/slots?date=${day}`);
  assert.equal(s.slots.find((x) => x.time === first.time).available, false);
});

await step("3b. ten simultaneous bookings for one slot: exactly one wins", async () => {
  const { body: s } = await call("GET", `/api/slots?date=${day}`);
  const slot = s.slots.filter((x) => x.available).at(-1);
  const rs = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      call("POST", "/api/appointments", { actor: "client", name: `Racer ${String.fromCharCode(65 + i)}`, phone: `99999100${10 + i}`, date: day, time: slot.time }),
    ),
  );
  assert.equal(rs.filter((r) => r.status === 201).length, 1);
  assert.equal(rs.filter((r) => r.status === 409).length, 9);
});

let moved;
await step("4/5. client reschedules and the old slot frees up", async () => {
  const { body: s } = await call("GET", `/api/slots?date=${day}&exclude=${first.id}`);
  const target = s.slots.find((x) => x.available && x.time !== first.time);
  const r = await call("PATCH", `/api/appointments/${first.id}`, { actor: "client", action: "reschedule", date: day, time: target.time, expectedUpdatedAt: first.updatedAt });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  moved = r.body.appointment;
  assert.equal(moved.time, target.time);
  assert.equal(moved.rescheduleCount, 1);
  const { body: after } = await call("GET", `/api/slots?date=${day}`);
  assert.equal(after.slots.find((x) => x.time === first.time).available, true);
  assert.equal(after.slots.find((x) => x.time === target.time).available, false);
});

await step("stale write is rejected (old updatedAt)", async () => {
  const r = await call("PATCH", `/api/appointments/${first.id}`, { actor: "client", action: "confirm", expectedUpdatedAt: first.updatedAt });
  assert.equal(r.status, 409);
});

await step("client confirms attendance", async () => {
  const r = await call("PATCH", `/api/appointments/${moved.id}`, { actor: "client", action: "confirm", expectedUpdatedAt: moved.updatedAt });
  assert.equal(r.status, 200);
  assert.equal(r.body.appointment.attendance, "confirmed");
  moved = r.body.appointment;
});

await step("6. client cancels; record kept, slot released", async () => {
  const r = await call("PATCH", `/api/appointments/${moved.id}`, { actor: "client", action: "cancel" });
  assert.equal(r.status, 200);
  assert.equal(r.body.appointment.status, "cancelled");
  assert.ok(r.body.appointment.cancelledAt);
  const { body } = await call("GET", "/api/appointments?phone=9999900001");
  assert.equal(body.appointments.length, 1);
  const { body: s } = await call("GET", `/api/slots?date=${day}`);
  assert.equal(s.slots.find((x) => x.time === moved.time).available, true);
  const again = await call("PATCH", `/api/appointments/${moved.id}`, { actor: "client", action: "reschedule", date: day, time: "10:00" });
  assert.equal(again.status, 409);
});

let manual;
await step("7. nutritionist adds an appointment without a phone; visible to clients' slot list", async () => {
  const r = await call("POST", "/api/appointments", { actor: "dashboard", name: "Walk In", phone: "", date: day, time: "09:00" });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  manual = r.body.appointment;
  assert.equal(manual.clientPhone, null);
  assert.equal(manual.reminder24h, "unavailable");
  const { body: s } = await call("GET", `/api/slots?date=${day}`);
  assert.equal(s.slots.find((x) => x.time === "09:00").available, false);
});

await step("8/9. mark Done and No-show on past appointments", async () => {
  const { body } = await call("GET", "/api/appointments");
  const riya = body.appointments.find((a) => a.date === "2026-10-24" && a.time === "10:00");
  const arjun = body.appointments.find((a) => a.date === "2026-10-24" && a.time === "11:30");
  const d = await call("PATCH", `/api/appointments/${riya.id}`, { actor: "dashboard", action: "status", status: "done" });
  assert.equal(d.body.appointment.status, "done");
  const n = await call("PATCH", `/api/appointments/${arjun.id}`, { actor: "dashboard", action: "status", status: "no-show" });
  assert.equal(n.body.appointment.status, "no-show");
});

await step("can't mark a future appointment Done; client can't change status", async () => {
  const r = await call("PATCH", `/api/appointments/${manual.id}`, { actor: "dashboard", action: "status", status: "done" });
  assert.equal(r.status, 409);
  const c = await call("PATCH", `/api/appointments/${manual.id}`, { actor: "client", action: "status", status: "booked" });
  assert.equal(c.status, 403);
});

await step("completed appointments can't be edited by the client", async () => {
  const { body } = await call("GET", "/api/appointments");
  const meera = body.appointments.find((a) => a.clientName === "Meera Iyer");
  const r = await call("PATCH", `/api/appointments/${meera.id}`, { actor: "client", action: "cancel" });
  assert.equal(r.status, 409);
});

await step("15. invalid inputs give helpful errors", async () => {
  const r = await call("POST", "/api/appointments", { actor: "client", name: "", phone: "123", date: "31/02/2026", time: "25:00" });
  assert.equal(r.status, 400);
  assert.ok(r.body.fields.name && r.body.fields.phone && r.body.fields.date && r.body.fields.time, JSON.stringify(r.body));
  const past = await call("POST", "/api/appointments", { actor: "client", name: "Late Person", phone: "9999900003", date: "2026-10-20", time: "10:00" });
  assert.equal(past.status, 400);
  assert.match(past.body.error, /no longer open/);
  const odd = await call("POST", "/api/appointments", { actor: "client", name: "Odd Time", phone: "9999900003", date: day, time: "10:15" });
  assert.equal(odd.status, 400);
});

await step("calendar file is valid", async () => {
  const res = await fetch(`${BASE}/api/appointments/${manual.id}/calendar`);
  const text = await res.text();
  assert.match(res.headers.get("content-type"), /text\/calendar/);
  assert.match(text, /BEGIN:VEVENT/);
});

await step("reset puts the sample data back", async () => {
  await call("POST", "/api/demo/reset");
  const { body } = await call("GET", "/api/appointments");
  assert.equal(body.appointments.length, 5);
});

for (const r of results) console.log(r.join("  "));
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
