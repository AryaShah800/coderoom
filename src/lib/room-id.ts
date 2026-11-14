import { customAlphabet } from "nanoid";

/**
 * Lowercase letters and digits without look-alikes (0/o, 1/l/i), so an ID can be read aloud or typed.
 * Keep in sync with ROOM_ID_PATTERN in sync-server/src/server.js.
 */
export const ROOM_ID_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const ROOM_ID_LENGTH = 10;
export const ROOM_ID_PATTERN = /^[23456789abcdefghjkmnpqrstuvwxyz]{10}$/;

const generate = customAlphabet(ROOM_ID_ALPHABET, ROOM_ID_LENGTH);

/** 31^10 ≈ 8e14 possible rooms: unguessable enough for share-by-link rooms without accounts. */
export function createRoomId(): string {
  return generate();
}

export function isValidRoomId(value: string): boolean {
  return ROOM_ID_PATTERN.test(value);
}

/**
 * Accepts a bare room ID or a pasted room link (https://host/room/<id>) and returns the ID,
 * or null if nothing valid was found.
 */
export function parseRoomInput(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (isValidRoomId(trimmed)) return trimmed;
  const match = trimmed.match(/\/room\/([^/?#\s]+)/);
  if (match?.[1] && isValidRoomId(match[1])) return match[1];
  return null;
}
