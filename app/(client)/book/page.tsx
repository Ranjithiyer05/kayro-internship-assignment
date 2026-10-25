import type { Metadata } from "next";
import { BookingFlow } from "@/components/client/booking-flow";

export const metadata: Metadata = { title: "Book a consultation" };

export default function BookPage() {
  return <BookingFlow />;
}
