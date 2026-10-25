"use client";

import { CalendarDays, CalendarPlus, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { buttonVariants } from "../ui/button";
import { Logo } from "../logo";

const LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/book", label: "Book", icon: CalendarPlus },
  { href: "/appointments", label: "My visits", icon: CalendarDays },
];

const DESKTOP_LINKS = [
  { href: "/", label: "Home" },
  { href: "/appointments", label: "My appointments" },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function TopBar() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {DESKTOP_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(path, l.href) ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-2 text-[15px] transition-colors",
                isActive(path, l.href) ? "bg-sage-soft text-forest-deep" : "text-ink-soft hover:bg-cream-deep",
              )}
            >
              {l.label}
            </Link>
          ))}
          <Link href="/book" className={cn(buttonVariants({ size: "sm" }), "ml-2")}>
            Book a consultation
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                  active ? "text-forest" : "text-muted",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors duration-200",
                    active && "bg-sage-soft",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
