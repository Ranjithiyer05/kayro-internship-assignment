import type { Metadata } from "next";
import { AppointmentDetail } from "@/components/client/appointment-detail";

export const metadata: Metadata = { title: "Your appointment", robots: { index: false } };

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppointmentDetail id={id} />;
}
