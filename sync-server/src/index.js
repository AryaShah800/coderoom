#!/usr/bin/env node
import { createSyncServer } from './server.js'

const numberFromEnv = (name, fallback) => {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number`)
  return value
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const sync = createSyncServer({
  // Render and similar hosts provide PORT and need 0.0.0.0; locally we stay on loopback.
  port: numberFromEnv('PORT', 1234),
  host: process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1'),
  allowedOrigins,
  maxPayloadBytes: numberFromEnv('MAX_PAYLOAD_BYTES', 1024 * 1024),
  maxRooms: numberFromEnv('MAX_ROOMS', 500),
  maxConnectionsPerIp: numberFromEnv('MAX_CONNECTIONS_PER_IP', 20),
  roomTtlMs: numberFromEnv('ROOM_TTL_MS', 30 * 60 * 1000),
  log: (msg) => console.log(`[sync] ${msg}`)
})

const { port, host } = await sync.listen()
console.log(`[sync] CodeRoom sync server listening on ws://${host}:${port}`)
if (allowedOrigins.length === 0) {
  console.warn('[sync] ALLOWED_ORIGINS is empty: any origin may connect (fine for local development only)')
}

const shutdown = async () => {
  await sync.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
