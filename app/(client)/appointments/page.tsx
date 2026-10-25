import type { Metadata } from "next";
import { Suspense } from "react";
import { MyAppointments } from "@/components/client/my-appointments";

export const metadata: Metadata = { title: "My appointments", robots: { index: false } };

export default function AppointmentsPage() {
  return (
    <Suspense>
      <MyAppointments />
    </Suspense>
  );
}
