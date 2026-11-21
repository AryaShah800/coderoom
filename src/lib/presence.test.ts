import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  ACTIVE_MS,
  PresenceTracker,
  TYPING_IDLE_MS,
  TYPING_MS,
  TypingPublisher,
  cursorFingerprint,
  remoteCursorIndex,
  type PresenceSnapshot,
} from "./presence";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const cursorAt = (doc: Y.Doc, index: number) => ({
  selection: { head: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(doc.getText("code"), index)) },
});

describe("cursorFingerprint / remoteCursorIndex", () => {
  it("ignores missing or malformed cursor data", () => {
    expect(cursorFingerprint(undefined)).toBeNull();
    expect(cursorFingerprint({ selection: { head: "x" } })).toBeNull();
    expect(cursorFingerprint({ selection: { head: { a: 1 } } })).not.toBeNull();
    const doc = new Y.Doc();
    expect(remoteCursorIndex(doc, doc.getText("code"), { selection: { head: { garbage: true } } })).toBeNull();
    expect(remoteCursorIndex(doc, doc.getText("code"), null)).toBeNull();
  });

  it("resolves a peer's relative position to an index in the shared text", () => {
    const doc = new Y.Doc();
    const text = doc.getText("code");
    text.insert(0, "hello world");
    const state = cursorAt(doc, 6);
    expect(remoteCursorIndex(doc, text, state)).toBe(6);
    text.insert(0, ">>> "); // later edits move the caret with the text
    expect(remoteCursorIndex(doc, text, state)).toBe(10);
  });
});

describe("PresenceTracker", () => {
  const setup = () => {
    const doc = new Y.Doc();
    doc.getText("code").insert(0, "abcdef");
    const seen: PresenceSnapshot[] = [];
    const tracker = new PresenceTracker((s) => seen.push(s));
    return { doc, seen, tracker };
  };

  it("shows a label when a caret moves and hides it after the idle window", () => {
    const { doc, seen, tracker } = setup();
    tracker.ingest(5, cursorAt(doc, 1));
    expect(seen.at(-1)).toEqual({ active: [5], typing: [] });
    vi.advanceTimersByTime(ACTIVE_MS - 100);
    expect(seen.at(-1)?.active).toEqual([5]);
    vi.advanceTimersByTime(200);
    expect(seen.at(-1)).toEqual({ active: [], typing: [] });
  });

  it("an unchanged caret does not keep the label alive; a moved one does", () => {
    const { doc, seen, tracker } = setup();
    tracker.ingest(5, cursorAt(doc, 1));
    vi.advanceTimersByTime(2_000);
    tracker.ingest(5, cursorAt(doc, 1)); // heartbeat, same caret
    vi.advanceTimersByTime(600);
    expect(seen.at(-1)?.active).toEqual([]);
    tracker.ingest(5, cursorAt(doc, 3)); // moved
    expect(seen.at(-1)?.active).toEqual([5]);
  });

  it("tracks typing and expires it even if the peer never sends false", () => {
    const { doc, seen, tracker } = setup();
    tracker.ingest(7, { ...cursorAt(doc, 2), typing: true });
    expect(seen.at(-1)?.typing).toEqual([7]);
    vi.advanceTimersByTime(TYPING_MS + 50);
    expect(seen.at(-1)?.typing).toEqual([]);
  });

  it("clears typing immediately when the peer says so, and forgets removed peers", () => {
    const { doc, seen, tracker } = setup();
    tracker.ingest(7, { ...cursorAt(doc, 2), typing: true });
    tracker.ingest(7, { ...cursorAt(doc, 2), typing: false });
    expect(seen.at(-1)?.typing).toEqual([]);
    tracker.ingest(8, cursorAt(doc, 1));
    tracker.remove(8);
    expect(seen.at(-1)?.active).not.toContain(8);
  });
});

describe("TypingPublisher", () => {
  it("sends true once per refresh window and false after idle", () => {
    const calls: boolean[] = [];
    const p = new TypingPublisher((t) => calls.push(t));
    p.edited();
    p.edited();
    p.edited();
    expect(calls).toEqual([true]);
    vi.advanceTimersByTime(TYPING_IDLE_MS + 10);
    expect(calls).toEqual([true, false]);
    p.edited();
    expect(calls).toEqual([true, false, true]);
  });
});
