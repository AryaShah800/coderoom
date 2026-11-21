import { describe, expect, it } from "vitest";
import {
  cssString,
  initials,
  participantsFromAwareness,
  remoteCursorCss,
  sanitizeColor,
  sanitizeName,
  NAME_MAX_LENGTH,
} from "./participants";

describe("sanitizeName", () => {
  it("trims, collapses whitespace, strips control characters and caps length", () => {
    expect(sanitizeName("  Asha\t\n Shah ")).toBe("Asha Shah");
    expect(sanitizeName("A\u0000s\u0007ha")).toBe("Asha");
    expect(sanitizeName("x".repeat(100))).toHaveLength(NAME_MAX_LENGTH);
    expect(sanitizeName(42)).toBe("");
  });
});

describe("sanitizeColor", () => {
  it("only accepts #rrggbb and falls back otherwise", () => {
    expect(sanitizeColor("#38BDF8")).toBe("#38bdf8");
    expect(sanitizeColor("red;}body{display:none")).toBe("#f5a524");
    expect(sanitizeColor(undefined)).toBe("#f5a524");
  });
});

describe("initials", () => {
  it("uses first and last word", () => {
    expect(initials("Asha Shah")).toBe("AS");
    expect(initials("ben")).toBe("B");
    expect(initials("  ")).toBe("?");
  });
});

describe("participantsFromAwareness", () => {
  it("cleans untrusted peer state, drops nameless peers and lists self first", () => {
    const states = new Map<number, Record<string, unknown>>([
      [7, { user: { name: "Zed", color: "#4ade80" } }],
      [3, { user: { name: "  Me  ", color: "#f472b6" } }],
      [9, { user: { name: "Bad", color: "url(javascript:alert(1))" } }],
      [11, { cursor: {} }],
      [12, { user: { name: "   " } }],
    ]);
    const list = participantsFromAwareness(states, 3);
    expect(list.map((p) => p.name)).toEqual(["Me", "Bad", "Zed"]);
    expect(list[0]).toMatchObject({ clientId: 3, isSelf: true, color: "#f472b6" });
    expect(list.find((p) => p.name === "Bad")?.color).toBe("#f5a524");
  });
});

describe("remote cursor CSS", () => {
  it("escapes names so a peer cannot break out of the CSS string", () => {
    expect(cssString('a"b\\c</style>')).toBe('"a\\"b\\\\c\\3c /style>"');
    const css = remoteCursorCss([
      { clientId: 5, name: '"}body{display:none}', color: "#38bdf8", isSelf: false },
      { clientId: 1, name: "Me", color: "#4ade80", isSelf: true },
    ]);
    expect(css).toContain(".yRemoteSelectionHead-5::after{content:\"\\\"}body{display:none}\"");
    expect(css).toContain("border-left:2px solid #38bdf8");
    expect(css).not.toContain("yRemoteSelection-1{");
  });
});

describe("duplicate names", () => {
  it("keeps the earliest joiner's name and numbers the rest", () => {
    const states = new Map<number, Record<string, unknown>>([
      [30, { user: { name: "Sam", color: "#4ade80" } }],
      [10, { user: { name: "Sam", color: "#38bdf8" } }],
      [20, { user: { name: "Sam", color: "#f472b6" } }],
      [40, { user: { name: "Ann", color: "#f472b6" } }],
    ]);
    const byId = Object.fromEntries(participantsFromAwareness(states, 99).map((p) => [p.clientId, p.name]));
    expect(byId).toEqual({ 10: "Sam", 20: "Sam (2)", 30: "Sam (3)", 40: "Ann" });
  });
});

describe("remote cursor label visibility", () => {
  const people = [
    { clientId: 5, name: "Ben", color: "#38bdf8", isSelf: false },
    { clientId: 6, name: "Cy", color: "#4ade80", isSelf: false },
  ];
  const label = (css: string, id: number) => css.split("}").find((l) => l.trim().startsWith(`.yRemoteSelectionHead-${id}::after`)) ?? "";

  it("shows every label when no activity filter is given (default)", () => {
    const css = remoteCursorCss(people);
    expect(label(css, 5)).toContain("opacity:1");
    expect(label(css, 6)).toContain("opacity:1");
  });

  it("fades idle labels but keeps the caret rule, and keeps the followed person's label", () => {
    const css = remoteCursorCss(people, new Set([5]), 6);
    expect(label(css, 5)).toContain("opacity:1");
    expect(label(css, 6)).toContain("opacity:1"); // followed
    const idle = remoteCursorCss(people, new Set(), null);
    expect(label(idle, 5)).toContain("opacity:0");
    expect(idle).toContain(".yRemoteSelectionHead-5{position:absolute");
    expect(idle).toContain("prefers-reduced-motion");
  });
});
