import { practice, schedule } from "@/lib/config";
import { getAppointment } from "@/lib/server/appointments";
import { handle } from "@/lib/server/http";
import { toIsoInstant } from "@/lib/time";

type Ctx = { params: Promise<{ id: string }> };

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (s: string) => s.replace(/[\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

// An .ics file so the client can put the appointment in their own calendar,
// which then reminds them on their phone even if they never open the app again.
export function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const appt = await getAppointment((await params).id);
    const start = new Date(toIsoInstant(appt.date, appt.time));
    const end = new Date(start.getTime() + schedule.slotMinutes * 60_000);
    const manage = new URL(`/appointments/${appt.id}`, req.url).toString();
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      `PRODID:-//${practice.name}//Appointments//EN`,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${appt.id}@nourish-studio`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${escape(`Nutrition consultation with ${practice.nutritionist}`)}`,
      `DESCRIPTION:${escape(`Need to change it? ${manage}`)}`,
      `URL:${manage}`,
      `STATUS:${appt.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT2H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escape(`Consultation with ${practice.nutritionist} in 2 hours`)}`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    return new Response(ics, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="consultation-${appt.date}.ics"`,
        "cache-control": "no-store",
      },
    });
  });
}
