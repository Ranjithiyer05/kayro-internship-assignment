import { ApiError, resetDemoData } from "@/lib/server/appointments";
import { handle, json } from "@/lib/server/http";

// Puts the five sample appointments back. Handy for reviewers; switch it off for
// a real practice with DEMO_RESET_ENABLED=false.
export function POST() {
  return handle(async () => {
    if (process.env.DEMO_RESET_ENABLED === "false") throw new ApiError(403, "Resetting is switched off here.");
    await resetDemoData();
    return json({ ok: true });
  });
}
