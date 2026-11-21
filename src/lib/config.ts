/** Public (browser) configuration. NEXT_PUBLIC_* values are inlined at build time. */
export const SYNC_URL = (process.env.NEXT_PUBLIC_SYNC_URL || "ws://localhost:1234").replace(/\/+$/, "");

/** After this long without a connection, explain that the free-tier sync server may be waking up. */
export const SLOW_CONNECT_MS = 5_000;

/** How long the sync server keeps an empty room (its ROOM_TTL_MS default, 30 minutes). Shown to users. */
export const ROOM_EMPTY_TTL_MINUTES = Number(process.env.NEXT_PUBLIC_ROOM_TTL_MINUTES) || 30;
