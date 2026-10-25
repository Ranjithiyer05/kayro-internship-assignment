import { storageMode } from "@/lib/server/appointments";
import { json } from "@/lib/server/http";
import { getReminderProvider } from "@/lib/server/reminder-provider";

export function GET() {
  return json({
    ok: true,
    storage: storageMode(),
    reminders: getReminderProvider()?.name ?? "none",
    resetEnabled: process.env.DEMO_RESET_ENABLED !== "false",
  });
}
