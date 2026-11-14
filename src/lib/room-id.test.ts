import { describe, expect, it } from "vitest";
import { createRoomId, isValidRoomId, parseRoomInput, ROOM_ID_PATTERN } from "./room-id";

describe("room IDs", () => {
  it("generates 10-character IDs from the unambiguous alphabet", () => {
    const ids = new Set(Array.from({ length: 500 }, createRoomId));
    expect(ids.size).toBe(500);
    for (const id of ids) {
      expect(id).toMatch(ROOM_ID_PATTERN);
      expect(id).not.toMatch(/[01ilo]/);
    }
  });

  it("validates IDs strictly", () => {
    expect(isValidRoomId("abcdefghjk")).toBe(true);
    expect(isValidRoomId("ABCDEFGHJK")).toBe(false);
    expect(isValidRoomId("abcdefghj")).toBe(false);
    expect(isValidRoomId("abcdefghjkm")).toBe(false);
    expect(isValidRoomId("abcdefghj1")).toBe(false);
    expect(isValidRoomId("../../etc/")).toBe(false);
  });

  it("parses a bare code or a pasted room link", () => {
    expect(parseRoomInput("  abcdefghjk ")).toBe("abcdefghjk");
    expect(parseRoomInput("ABCDEFGHJK")).toBe("abcdefghjk");
    expect(parseRoomInput("https://coderoom.example/room/abcdefghjk?x=1#y")).toBe("abcdefghjk");
    expect(parseRoomInput("http://localhost:3000/room/abcdefghjk/")).toBe("abcdefghjk");
    expect(parseRoomInput("https://coderoom.example/room/nope")).toBeNull();
    expect(parseRoomInput("")).toBeNull();
  });
});
