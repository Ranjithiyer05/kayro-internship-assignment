import Link from "next/link";
import { BottomNav, TopBar } from "@/components/client/nav";
import { ProfileProvider } from "@/components/client/profile";
import { practice } from "@/lib/config";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-forest focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <TopBar />
      <main id="main" className="mx-auto max-w-5xl px-4 pt-6 pb-28 sm:px-6 md:pt-10 md:pb-16">
        {children}
      </main>
      <footer className="mx-auto hidden max-w-5xl items-center justify-between border-t border-line px-6 py-6 text-sm text-muted md:flex">
        <p>
          {practice.name} · {practice.nutritionist}, {practice.nutritionistTitle} · {practice.city}
        </p>
        <Link href="/dashboard" className="hover:text-ink">
          Practice dashboard
        </Link>
      </footer>
      <BottomNav />
    </ProfileProvider>
  );
}
