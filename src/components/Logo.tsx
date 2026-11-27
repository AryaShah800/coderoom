import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group inline-flex min-h-10 min-w-10 items-center gap-2 rounded font-semibold tracking-tight text-fg">
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-md bg-accent font-mono text-sm font-bold text-accent-ink"
      >
        {"{}"}
      </span>
      <span className={compact ? "sr-only sm:not-sr-only" : undefined}>CodeRoom</span>
    </Link>
  );
}
