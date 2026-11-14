import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import WebSocket from 'ws'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { docs } from '@y/websocket-server/utils'
import { createSyncServer } from '../src/server.js'

const ROOM = 'abcdefghjk'

/** Resolves with the HTTP status of a rejected upgrade, or 101 if it opened. */
const upgradeStatus = (url, options = {}) =>
  new Promise((resolve) => {
    const ws = new WebSocket(url, options)
    ws.on('open', () => {
      ws.close()
      resolve(101)
    })
    ws.on('unexpected-response', (_req, res) => resolve(res.statusCode))
    ws.on('error', () => {})
  })

const waitFor = async (check, timeoutMs = 3000) => {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for condition')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

const connect = (base, room) => {
  const doc = new Y.Doc()
  const provider = new WebsocketProvider(base, room, doc, { WebSocketPolyfill: WebSocket, disableBc: true })
  return {
    doc,
    provider,
    destroy: () => {
      provider.destroy()
      doc.destroy()
    }
  }
}

describe('sync server', () => {
  let sync
  let base

  before(async () => {
    sync = createSyncServer({ port: 0, allowedOrigins: [], maxConnectionsPerIp: 6, roomTtlMs: 1000 })
    const { port } = await sync.listen()
    base = `ws://127.0.0.1:${port}`
  })

  after(async () => {
    await sync.close()
  })

  test('health endpoint reports status', async () => {
    const res = await fetch(base.replace('ws', 'http') + '/healthz')
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.ok, true)
  })

  test('two clients in the same room converge on the same text', async () => {
    const a = connect(base, ROOM)
    const b = connect(base, ROOM)
    try {
      await waitFor(() => a.provider.synced && b.provider.synced)
      a.doc.getText('code').insert(0, 'console.log("hi")')
      await waitFor(() => b.doc.getText('code').toString() === 'console.log("hi")')
      b.doc.getText('code').insert(0, '// b\n')
      await waitFor(() => a.doc.getText('code').toString() === '// b\nconsole.log("hi")')
    } finally {
      a.destroy()
      b.destroy()
    }
  })

  test('awareness (names, colours, cursors) is relayed between clients', async () => {
    const a = connect(base, 'mnpqrstuvw')
    const b = connect(base, 'mnpqrstuvw')
    try {
      a.provider.awareness.setLocalStateField('user', { name: 'Asha', color: '#f97316' })
      await waitFor(() =>
        [...b.provider.awareness.getStates().values()].some((s) => s.user?.name === 'Asha')
      )
    } finally {
      a.destroy()
      b.destroy()
    }
  })

  test('rooms are isolated from each other', async () => {
    const a = connect(base, '2345678923')
    const b = connect(base, '2345678924')
    try {
      await waitFor(() => a.provider.synced && b.provider.synced)
      a.doc.getText('code').insert(0, 'secret')
      await new Promise((resolve) => setTimeout(resolve, 200))
      assert.equal(b.doc.getText('code').toString(), '')
    } finally {
      a.destroy()
      b.destroy()
    }
  })

  test('rejects malformed room names', async () => {
    assert.equal(await upgradeStatus(`${base}/not-a-room`), 400)
    assert.equal(await upgradeStatus(`${base}/ABCDEFGHJK`), 400)
    assert.equal(await upgradeStatus(`${base}/../etc`), 400)
  })

  test('caps concurrent connections per IP', async () => {
    const sockets = []
    try {
      for (let i = 0; i < 6; i++) {
        const ws = new WebSocket(`${base}/zyxwvutsrq`)
        await new Promise((resolve) => ws.on('open', resolve))
        sockets.push(ws)
      }
      assert.equal(await upgradeStatus(`${base}/zyxwvutsrq`), 429)
    } finally {
      for (const ws of sockets) ws.close()
    }
  })

  test('sweeps rooms that stay empty past the TTL', async () => {
    const room = 'qqqqqqqqqq'
    const a = connect(base, room)
    await waitFor(() => a.provider.synced)
    a.destroy()
    await waitFor(() => docs.get(room)?.conns.size === 0)
    assert.equal(sync.sweep(Date.now()), 0, 'not swept before the TTL')
    assert.ok(docs.has(room))
    assert.ok(sync.sweep(Date.now() + 5000) >= 1)
    assert.equal(docs.has(room), false)
  })
})

describe('origin allowlist', () => {
  test('only listed origins may connect', async () => {
    const sync = createSyncServer({ port: 0, allowedOrigins: ['https://coderoom.example'] })
    const { port } = await sync.listen()
    const url = `ws://127.0.0.1:${port}/abcdefghjk`
    try {
      assert.equal(await upgradeStatus(url, { origin: 'https://evil.example' }), 403)
      assert.equal(await upgradeStatus(url), 403)
      assert.equal(await upgradeStatus(url, { origin: 'https://coderoom.example' }), 101)
    } finally {
      await sync.close()
    }
  })
})
