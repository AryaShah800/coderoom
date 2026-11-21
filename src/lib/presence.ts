import * as Y from "yjs";

/** A caret label stays visible this long after its owner last moved or typed, then fades. */
export const ACTIVE_MS = 2_500;
/** "Is typing" lasts this long after the last typing signal seen from a peer. */
export const TYPING_MS = 3_000;
/** The local client refreshes its typing flag at most this often. */
export const TYPING_REFRESH_MS = 1_000;
/** The local client clears its typing flag after this long without edits. */
export const TYPING_IDLE_MS = 1_500;

type AwarenessState = Record<string, unknown> | null | undefined;

const headOf = (state: AwarenessState): object | null => {
  const head = (state?.selection as { head?: unknown } | undefined)?.head;
  return head !== null && head !== undefined && typeof head === "object" ? head : null;
};

/** A stable string for a peer's caret, so movement can be detected. Peer data is untrusted. */
export function cursorFingerprint(state: AwarenessState): string | null {
  const head = headOf(state);
  if (!head) return null;
  try {
    return JSON.stringify(head);
  } catch {
    return null;
  }
}

/** Index into the shared text where a peer's caret is, or null when unknown or invalid. */
export function remoteCursorIndex(doc: Y.Doc, text: Y.Text, state: AwarenessState): number | null {
  const head = headOf(state);
  if (!head) return null;
  try {
    const abs = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(head), doc);
    return abs && abs.type === text ? abs.index : null;
  } catch {
    return null;
  }
}

export interface PresenceSnapshot {
  /** Clients whose caret moved or who typed recently: their name label is shown. */
  active: number[];
  /** Clients currently typing. */
  typing: number[];
}

interface Entry {
  cursor: string | null;
  activeUntil: number;
  typingUntil: number;
}

/**
 * Turns raw awareness updates into "recently active" and "typing" sets that expire on their own.
 * Timing is injectable so it can be unit tested without real waiting.
 */
export class PresenceTracker {
  private entries = new Map<number, Entry>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private last = "";

  constructor(
    private readonly onChange: (snapshot: PresenceSnapshot) => void,
    private readonly now: () => number = Date.now,
  ) {}

  ingest(clientId: number, state: AwarenessState) {
    const t = this.now();
    const entry = this.entries.get(clientId) ?? { cursor: null, activeUntil: 0, typingUntil: 0 };
    const cursor = cursorFingerprint(state);
    if (cursor !== entry.cursor) {
      entry.cursor = cursor;
      if (cursor !== null) entry.activeUntil = t + ACTIVE_MS;
    }
    if (state?.typing === true) {
      entry.typingUntil = t + TYPING_MS;
      entry.activeUntil = Math.max(entry.activeUntil, t + ACTIVE_MS);
    } else {
      entry.typingUntil = 0;
    }
    this.entries.set(clientId, entry);
    this.publish();
  }

  remove(clientId: number) {
    if (this.entries.delete(clientId)) this.publish();
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.entries.clear();
  }

  snapshot(): PresenceSnapshot {
    const t = this.now();
    const active: number[] = [];
    const typing: number[] = [];
    for (const [id, e] of this.entries) {
      if (e.activeUntil > t) active.push(id);
      if (e.typingUntil > t) typing.push(id);
    }
    return { active: active.sort((a, b) => a - b), typing: typing.sort((a, b) => a - b) };
  }

  private publish() {
    const snap = this.snapshot();
    const key = JSON.stringify(snap);
    if (key !== this.last) {
      this.last = key;
      this.onChange(snap);
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const t = this.now();
    let next = Infinity;
    for (const e of this.entries.values()) {
      for (const until of [e.activeUntil, e.typingUntil]) if (until > t) next = Math.min(next, until);
    }
    if (next !== Infinity) this.timer = setTimeout(() => this.publish(), next - t + 5);
  }
}

/**
 * Local "I am typing" flag in awareness: set (refreshed at most once per TYPING_REFRESH_MS) while
 * the person edits, cleared after TYPING_IDLE_MS of quiet.
 */
export class TypingPublisher {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastSent = 0;
  private on = false;

  constructor(
    private readonly set: (typing: boolean) => void,
    private readonly now: () => number = Date.now,
  ) {}

  edited() {
    const t = this.now();
    if (!this.on || t - this.lastSent >= TYPING_REFRESH_MS) {
      this.on = true;
      this.lastSent = t;
      this.set(true);
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.stop(), TYPING_IDLE_MS);
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.on) {
      this.on = false;
      this.set(false);
    }
  }
}
