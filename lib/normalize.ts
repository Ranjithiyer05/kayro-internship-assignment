// Turns the messy values people actually type (and that live in the sample
// spreadsheet) into one clean format. Pure functions, no I/O, easy to test.

/**
 * Indian mobile numbers: strips spaces, dashes, a leading +91 / 91 / 0.
 * Returns the 10-digit number, or null if it is not a valid mobile number.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = String(input).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return digits;
}

/** "9820011111" -> "98200 11111" */
export function formatPhone(phone: string): string {
  if (!/^\d{10}$/.test(phone)) return phone;
  return `${phone.slice(0, 5)} ${phone.slice(5)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY and DD.MM.YYYY.
 * Day-first is assumed for the short forms because that is how dates are written in India.
 * Returns YYYY-MM-DD or null.
 */
export function normalizeDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  if (!isRealDate(y, m, d)) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Accepts "14:00", "9:00", "09:00", "11:30am", "4 pm", "4:30 PM", "1600".
 * Returns HH:MM (24-hour) or null.
 */
export function normalizeTime(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim().toLowerCase().replace(/\./g, "");
  const match = s.match(/^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let h = Number(match[1]);
  const min = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3];
  if (min > 59) return null;
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    if (meridiem === "pm" && h !== 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;
  } else if (!match[2] && s.length <= 2) {
    // A bare "4" is too ambiguous to guess.
    return null;
  }
  if (h > 23) return null;
  return `${pad(h)}:${pad(min)}`;
}

/** Collapses whitespace and title-cases each word: "  riya   shah " -> "Riya Shah". */
export function normalizeName(input: string | null | undefined): string | null {
  if (!input) return null;
  const cleaned = String(input).replace(/\s+/g, " ").trim();
  if (cleaned.length < 2 || cleaned.length > 60) return null;
  return cleaned
    .split(" ")
    .map((w) => (w === w.toLowerCase() || w === w.toUpperCase() ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function timeOf(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}
