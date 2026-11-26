import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { changeLanguage, getShared, initializeRoom, publishRun, readLanguage, readLastRun } from "./collab";
import { getLanguage } from "./languages";

/** Connects two docs in memory, like two browsers through the sync server. */
function linkedDocs() {
  const a = new Y.Doc();
  const b = new Y.Doc();
  a.on("update", (u: Uint8Array, origin: unknown) => origin !== "remote" && Y.applyUpdate(b, u, "remote"));
  b.on("update", (u: Uint8Array, origin: unknown) => origin !== "remote" && Y.applyUpdate(a, u, "remote"));
  return { a, b };
}

describe("initializeRoom", () => {
  it("seeds a new room once and never overwrites an existing room", () => {
    const { a, b } = linkedDocs();
    expect(initializeRoom(a)).toBe(true);
    expect(initializeRoom(b)).toBe(false);
    const code = getShared(b).text.toString();
    expect(code).toBe(getLanguage("javascript").template);
    expect(readLanguage(b)).toBe("javascript");
  });

  it("keeps code that is already in the doc", () => {
    const doc = new Y.Doc();
    getShared(doc).text.insert(0, "print(1)");
    initializeRoom(doc);
    expect(getShared(doc).text.toString()).toBe("print(1)");
  });
});

describe("changeLanguage", () => {
  it("swaps an untouched template for the new language's template, for every peer", () => {
    const { a, b } = linkedDocs();
    initializeRoom(a);
    changeLanguage(b, "python");
    expect(readLanguage(a)).toBe("python");
    expect(getShared(a).text.toString()).toBe(getLanguage("python").template);
  });

  it("keeps real code when switching language", () => {
    const doc = new Y.Doc();
    initializeRoom(doc);
    const text = getShared(doc).text;
    text.insert(text.length, "// my change\n");
    const before = text.toString();
    changeLanguage(doc, "go");
    expect(readLanguage(doc)).toBe("go");
    expect(text.toString()).toBe(before);
  });
});

describe("shared run output", () => {
  it("round-trips a run between peers", () => {
    const { a, b } = linkedDocs();
    publishRun(a, {
      by: "Asha",
      language: "python",
      at: 1,
      result: {
        status: { id: 3, description: "Accepted" },
        stdout: "hi\n",
        stderr: "",
        compileOutput: "",
        message: "",
        time: 0.01,
        memory: 100,
        truncated: false,
      },
    });
    expect(readLastRun(b)).toMatchObject({ by: "Asha", language: "python", result: { stdout: "hi\n" } });
  });

  it("ignores malformed run data sent by a peer", () => {
    const doc = new Y.Doc();
    const meta = getShared(doc).meta;
    meta.set("lastRun", { by: "x", language: "cobol", at: 1, result: { status: { id: 3 } } });
    expect(readLastRun(doc)).toBeNull();
    meta.set("lastRun", { by: "x", language: "python", at: 1 });
    expect(readLastRun(doc)).toBeNull();
    meta.set("lastRun", "nonsense");
    expect(readLastRun(doc)).toBeNull();
  });

  it("normalizes a partial run result from a peer instead of passing it through", () => {
    const doc = new Y.Doc();
    getShared(doc).meta.set("lastRun", {
      by: "x",
      language: "python",
      at: 1,
      result: { status: { id: 3 }, stdout: 42, time: "fast", memory: Number.NaN },
    });
    expect(readLastRun(doc)?.result).toEqual({
      status: { id: 3, description: "Finished" },
      stdout: "",
      stderr: "",
      compileOutput: "",
      message: "",
      time: null,
      memory: null,
      truncated: false,
    });
  });
});
