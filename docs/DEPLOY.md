# Deploying CodeRoom

CodeRoom is two services. Live since 21 Nov 2026: app https://coderoom-aryashah.vercel.app, sync server https://coderoom-sync.onrender.com (`/healthz`).

| Service | Runs | Host used in the config | Why separate |
|---|---|---|---|
| App | Next.js 16 (`/`, `/room/[id]`, `/api/run`) | Vercel (Hobby) via `vercel.json` | Static/serverless |
| Sync server | `sync-server/` (y-websocket relay) | Render free web service via `render.yaml` | Vercel functions cannot hold long-lived WebSockets |

## Order of operations
The two services need each other's URL, so do it in this order.

1. **Sync server first.** In Render choose New > Blueprint and point it at this repo (it reads `render.yaml`), or create a Node web service by hand with root directory `sync-server`, build `npm ci`, start `npm start`, health check `/healthz`. Leave `ALLOWED_ORIGINS` empty for the moment. When it is live, note its URL, for example `https://coderoom-sync.onrender.com`. The WebSocket URL is the same host with `wss://`.
2. **App second.** Import the repo into Vercel (framework preset Next.js, root directory is the repo root). Set the environment variable below, then deploy.
   - `NEXT_PUBLIC_SYNC_URL` = `wss://coderoom-sync.onrender.com` (**build time**: change it and you must redeploy).
3. **Close the loop.** In Render set `ALLOWED_ORIGINS` to the exact origin of the Vercel deployment (`https://<project>.vercel.app`, plus your custom domain if you add one; comma-separated, no trailing slash) and redeploy the sync server. Until you do, any website can open sockets to your relay.
4. **Verify** (replace the hosts):

```bash
curl -s https://coderoom-sync.onrender.com/healthz          # JSON status from the sync server
curl -s https://<project>.vercel.app/api/run                 # {"configured":false} unless JUDGE0_URL is set
```

Then open the app in two different browsers, create a room in one, paste the link in the other, type in both. Only after this works should a live link go in the README.

## Environment variables
| Variable | Service | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SYNC_URL` | app (build time) | yes | `wss://...`. Default is `ws://localhost:1234`, which cannot work in production |
| `NEXT_PUBLIC_ROOM_TTL_MINUTES` | app (build time) | no | Number shown in the room-lifetime notice. Keep equal to the sync server's `ROOM_TTL_MS` (default 30) |
| `JUDGE0_URL`, `JUDGE0_AUTH_TOKEN`, `JUDGE0_RAPIDAPI_KEY`, `JUDGE0_RAPIDAPI_HOST`, `JUDGE0_TIMEOUT_MS` | app (server only) | no | Only for Java, C++, C, Go and Rust. JavaScript, TypeScript and Python run in the browser and need none of these. Without `JUDGE0_URL` the UI marks those languages "editor only" |
| `ALLOWED_ORIGINS` | sync server | yes in production | Comma-separated origins allowed to connect |
| `HOST` | sync server | set by `render.yaml` | `0.0.0.0` so the platform can reach it |
| `PORT` | sync server | set by Render | Read automatically |
| `ROOM_TTL_MS` | sync server | no | How long an empty room is kept (default 1,800,000 = 30 min) |
| `MAX_ROOMS`, `MAX_CONNECTIONS_PER_IP`, `MAX_PAYLOAD_BYTES` | sync server | no | Limits, see `sync-server/.env.example` |

`.env.example` and `sync-server/.env.example` document the same names. Never commit real values.

## What to expect on the free tiers
- **Cold start.** A free Render web service sleeps after a period without traffic and takes tens of seconds to wake up. The app already shows a "the server may be waking up" banner after 5 s without a connection. Opening the room link wakes it.
- **Rooms are in memory.** A restart (including a free-tier sleep and wake, or a redeploy) deletes every room, and an empty room is dropped after `ROOM_TTL_MS`. The app says so in the room and offers **Export file**. There is no database; do not describe it as saved.
- **The in-browser runner needs no server**, but Python downloads Pyodide v0.27.7 from jsDelivr on the first Python run.
- **Rate limiting** for `/api/run` is per server instance (in memory); on serverless it is best effort.

## Fly.io instead of Render
`sync-server` is a plain Node service. On Fly, `fly launch` inside `sync-server/` (no Dockerfile needed if you accept the Node buildpack), set `HOST=0.0.0.0`, `ALLOWED_ORIGINS`, and internal port to the `PORT` you choose (the server reads `PORT`). Keep a single machine: rooms live in one process's memory, so two machines would split people into different copies of a room.

## Not done / needs you
- Creating the Vercel project, the Render service and any domain.
- Optional: a Judge0 endpoint (self-hosted, or a RapidAPI key) for the server-run languages.
- Measuring Lighthouse on the deployed URL (the repo has no scores yet).
