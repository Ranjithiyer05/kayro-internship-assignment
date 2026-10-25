// Where reminders actually get sent. Nothing is connected by default, and the app
// never marks a reminder as sent unless something really sent it.
//
// To connect a real channel, set REMINDER_WEBHOOK_URL to an endpoint that delivers
// the message (a Twilio / Gupshup / WhatsApp Cloud API function, a Zapier or Make
// hook, etc.), then call GET /api/cron/reminders every 15 minutes from a scheduler.
// To add a provider in code instead, implement ReminderProvider and return it from
// getReminderProvider().

import "server-only";
import type { Appointment, ReminderKind } from "../types.ts";

export interface ReminderMessage {
  to: string; // E.164, e.g. +919820011111
  text: string;
  appointmentId: string;
  kind: ReminderKind;
}

export interface ReminderProvider {
  name: string;
  send(message: ReminderMessage): Promise<void>;
}

class WebhookProvider implements ReminderProvider {
  name = "webhook";
  constructor(
    private url: string,
    private secret?: string,
  ) {}
  async send(message: ReminderMessage) {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.secret ? { authorization: `Bearer ${this.secret}` } : {}),
      },
      body: JSON.stringify(message),
    });
    if (!res.ok) throw new Error(`Reminder webhook answered ${res.status}`);
  }
}

export function getReminderProvider(): ReminderProvider | null {
  const url = process.env.REMINDER_WEBHOOK_URL;
  if (url) return new WebhookProvider(url, process.env.REMINDER_WEBHOOK_SECRET);
  return null;
}

export function e164(phone: NonNullable<Appointment["clientPhone"]>) {
  return `+91${phone}`;
}
