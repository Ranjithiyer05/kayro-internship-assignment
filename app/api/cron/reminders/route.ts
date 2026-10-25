import { siteUrl } from "@/lib/config";
import { listAppointments, markReminderSent } from "@/lib/server/appointments";
import { handle, json } from "@/lib/server/http";
import { e164, getReminderProvider } from "@/lib/server/reminder-provider";
import { reminderMessage, reminderViews } from "@/lib/reminders";

// Sends any reminders that are due. Call it every ~15 minutes from a scheduler
// (Vercel Cron on a paid plan, cron-job.org, GitHub Actions...). With no provider
// connected it only reports what is due and marks nothing as sent.
export function GET(req: Request) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
      return json({ error: "Unauthorised" }, 401);
    }
    const provider = getReminderProvider();
    const now = new Date();
    const due = (await listAppointments()).flatMap((appt) =>
      reminderViews(appt, now)
        .filter((r) => r.due && appt.clientPhone)
        .map((r) => ({ appt, kind: r.kind })),
    );
    if (!provider) {
      return json({ provider: null, due: due.map(({ appt, kind }) => ({ id: appt.id, kind })), sent: 0 });
    }
    let sent = 0;
    const failed: string[] = [];
    for (const { appt, kind } of due) {
      try {
        const text = reminderMessage(appt, kind, `${siteUrl()}/appointments/${appt.id}`);
        await provider.send({ to: e164(appt.clientPhone!), text, appointmentId: appt.id, kind });
        await markReminderSent(appt.id, kind);
        sent++;
      } catch (err) {
        console.error("Reminder failed", appt.id, kind, err);
        failed.push(`${appt.id}:${kind}`);
      }
    }
    return json({ provider: provider.name, due: due.length, sent, failed });
  });
}
