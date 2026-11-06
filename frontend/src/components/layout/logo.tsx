import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={cn("size-9 shrink-0", className)}
    >
      <rect width="40" height="40" rx="11" fill="#12857c" />
      <path
        d="M7 21h5l3-8 5 17 4-12 3 6h6"
        fill="none"
        stroke="#ecfdf8"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="33" cy="24" r="1.8" fill="#a8e8dd" />
    </svg>
  );
}

type LogoProps = {
  href?: string;
  className?: string;
  onDark?: boolean;
  showTagline?: boolean;
};

export function Logo({
  href = "/",
  className,
  onDark = false,
  showTagline = true,
}: LogoProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-lg",
        className,
      )}
      aria-label="Attune home"
    >
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "text-[1.05rem] font-semibold tracking-tight",
            onDark ? "text-white" : "text-ink",
          )}
        >
          Attune
        </span>
        {showTagline ? (
          <span
            className={cn(
              "mt-1 text-[0.625rem] font-medium uppercase tracking-[0.16em]",
              onDark ? "text-white/50" : "text-ink-subtle",
            )}
          >
            Research workspace
          </span>
        ) : null}
      </span>
    </Link>
  );
}
