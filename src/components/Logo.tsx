import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2 rounded font-semibold tracking-tight text-fg">
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-md bg-accent font-mono text-sm font-bold text-accent-ink"
      >
        {"{}"}
      </span>
      <span className={compact ? "hidden sm:inline" : undefined}>CodeRoom</span>
    </Link>
  );
}
