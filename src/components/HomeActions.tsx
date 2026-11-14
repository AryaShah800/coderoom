"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createRoomId, parseRoomInput } from "@/lib/room-id";

export function HomeActions() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const inputId = useId();
  const errorId = useId();

  const createRoom = () => {
    setCreating(true);
    router.push(`/room/${createRoomId()}`);
  };

  const joinRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const roomId = parseRoomInput(value);
    if (!roomId) {
      setError("Enter a 10-character room code or paste a room link.");
      return;
    }
    setError(null);
    router.push(`/room/${roomId}`);
  };

  return (
    <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
      <button
        type="button"
        onClick={createRoom}
        disabled={creating}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-accent px-6 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-70"
      >
        {creating ? "Creating room…" : "Create a room"}
        <span aria-hidden="true">→</span>
      </button>

      <form onSubmit={joinRoom} noValidate className="flex flex-col gap-2">
        <label htmlFor={inputId} className="sr-only">
          Room code or link
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Room code or link"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="h-12 min-w-0 flex-1 rounded-lg border border-line-strong bg-panel px-4 font-mono text-sm text-fg placeholder:text-muted"
          />
          <button
            type="submit"
            className="h-12 rounded-lg border border-line-strong bg-panel-2 px-5 font-medium text-fg transition hover:border-muted"
          >
            Join
          </button>
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-sm text-bad">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
