"use client";

import { useId, useState, type FormEvent } from "react";
import { NAME_MAX_LENGTH, PARTICIPANT_COLORS, sanitizeName, type ParticipantIdentity } from "@/lib/participants";

interface JoinFormProps {
  roomId: string;
  initialName: string;
  initialColor: string;
  onJoin: (identity: ParticipantIdentity) => void;
}

export function JoinForm({ roomId, initialName, initialColor, onJoin }: JoinFormProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor || PARTICIPANT_COLORS[0].value);
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();
  const errorId = useId();
  const hintId = useId();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = sanitizeName(name);
    if (!clean) {
      setError("Enter a name so others know who is typing.");
      return;
    }
    setError(null);
    onJoin({ name: clean, color });
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby="join-heading"
      className="w-full max-w-md rounded-2xl border border-line bg-panel p-8 shadow-2xl shadow-black/40"
    >
      <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">Room {roomId}</p>
      <h1 id="join-heading" className="mt-2 text-2xl font-semibold tracking-tight">
        Join the room
      </h1>
      <p className="mt-1 text-sm text-muted">Pick how others will see you. Saved on this device for next time.</p>

      <div className="mt-6 flex flex-col gap-2">
        <label htmlFor={nameId} className="text-sm font-medium">
          Your name
        </label>
        <input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="nickname"
          autoFocus
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          className="h-11 rounded-lg border border-line-strong bg-ink px-3 text-fg placeholder:text-muted"
          placeholder="e.g. Asha"
        />
        <p id={hintId} className="text-xs text-muted">
          Up to {NAME_MAX_LENGTH} characters.
        </p>
        {error && (
          <p id={errorId} role="alert" className="text-sm text-bad">
            {error}
          </p>
        )}
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium">Cursor colour</legend>
        <div className="mt-3 grid grid-cols-8 gap-2">
          {PARTICIPANT_COLORS.map((option) => (
            <label key={option.value} className="relative grid place-items-center">
              <input
                type="radio"
                name="color"
                value={option.value}
                checked={color === option.value}
                onChange={() => setColor(option.value)}
                className="peer sr-only"
              />
              <span className="sr-only">{option.name}</span>
              <span
                aria-hidden="true"
                style={{ backgroundColor: option.value }}
                className="size-8 cursor-pointer rounded-full ring-offset-2 ring-offset-panel transition peer-checked:ring-2 peer-checked:ring-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent"
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-8 flex items-center gap-3 rounded-lg border border-line bg-ink px-3 py-2" aria-hidden="true">
        <span className="h-5 border-l-2" style={{ borderColor: color }} />
        <span className="rounded px-1.5 text-xs font-semibold text-ink" style={{ backgroundColor: color }}>
          {sanitizeName(name) || "Your name"}
        </span>
        <span className="text-xs text-muted">is how your cursor looks to others</span>
      </div>

      <button
        type="submit"
        className="mt-6 h-11 w-full rounded-lg bg-accent font-semibold text-accent-ink transition hover:brightness-110"
      >
        Join room
      </button>
    </form>
  );
}
