import { Sprout } from "lucide-react";
import Link from "next/link";
import { practice } from "@/lib/config";

export function Logo({ href = "/", suffix }: { href?: string; suffix?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 rounded-full" aria-label={`${practice.name} home`}>
      <span className="grid size-9 place-items-center rounded-full bg-forest text-white">
        <Sprout className="size-5" aria-hidden />
      </span>
      <span className="font-display text-lg text-ink">
        {practice.name}
        {suffix && <span className="ml-1.5 font-sans text-sm font-normal text-muted">{suffix}</span>}
      </span>
    </Link>
  );
}
