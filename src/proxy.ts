import { NextResponse, type NextRequest } from "next/server";

// Same pattern as src/lib/room-id.ts (kept inline: proxy code should not depend on app modules).
const ROOM_ID = /^[23456789abcdefghjkmnpqrstuvwxyz]{10}$/;

/**
 * The room page streams its shell before the room ID is checked, which would answer malformed
 * room URLs with HTTP 200. Rewriting them to an unknown path here gives a real 404 status
 * together with the app's not-found page.
 */
export function proxy(request: NextRequest) {
  const id = request.nextUrl.pathname.split("/")[2] ?? "";
  if (ROOM_ID.test(id)) return NextResponse.next();
  return NextResponse.rewrite(new URL("/_room-not-found", request.url));
}

export const config = {
  matcher: "/room/:id*",
};
