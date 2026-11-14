import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main id="main" className="grid flex-1 place-items-center px-6 py-24 text-center">
      <div className="flex max-w-md flex-col items-center gap-4">
        <Logo />
        <h1 className="text-2xl font-semibold">That room does not exist</h1>
        <p className="text-muted">
          Room codes are 10 characters of lowercase letters and digits. Check the link, or start a new room.
        </p>
        <Link href="/" className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink">
          Back to CodeRoom
        </Link>
      </div>
    </main>
  );
}
