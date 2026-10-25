// One place for everything about the practice. Change these and the whole site,
// the structured data and the booking rules follow.

export const practice = {
  name: "Nourish Studio",
  tagline: "Nutrition consultations that fit your life",
  nutritionist: "Dr. Nidhi Kapoor",
  nutritionistTitle: "Clinical Nutritionist",
  description:
    "Book a one-to-one nutrition consultation in under a minute. Pick a time that suits you, get a friendly reminder, and reschedule with one tap if plans change.",
  city: "Mumbai",
  region: "Maharashtra",
  country: "IN",
  // Shown on the site and used for WhatsApp links. Fictional demo number.
  whatsapp: "919820000000",
  phoneDisplay: "+91 98200 00000",
  priceRange: "₹₹",
  consultationMinutes: 30,
} as const;

// Booking rules. All times are in the practice's own time zone.
export const schedule = {
  timeZone: "Asia/Kolkata",
  // 0 = Sunday ... 6 = Saturday. The sample data has a Sunday booking (25 Oct 2026),
  // so the practice is treated as open every day.
  openDays: [0, 1, 2, 3, 4, 5, 6],
  dayStart: "09:00",
  dayEnd: "18:00", // last slot starts at dayEnd - slotMinutes
  slotMinutes: 30,
  breaks: [{ start: "13:00", end: "14:00" }],
  bookAheadDays: 30,
  // Clients cannot book a slot that starts sooner than this.
  minNoticeMinutes: 60,
} as const;

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
