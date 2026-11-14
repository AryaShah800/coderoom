import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import * as Y from "yjs";
import { server } from "@/test/msw";
import { getShared, readLastRun } from "@/lib/collab";
import { useRoomStore, type Collab } from "@/store/room";
import { useRunAvailability, useRunCode } from "./use-run-code";

const API = "http://localhost:3000/api/run";

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let doc: Y.Doc;
beforeEach(() => {
  doc = new Y.Doc();
  getShared(doc).text.insert(0, "print(input())");
  const store = useRoomStore.getState();
  store.enterRoom(`r${Math.random()}`);
  store.setLanguage("python");
  // The hook only touches collab.doc; the provider is not needed here.
  store.setCollab({ doc, provider: {} } as unknown as Collab);
});

describe("useRunCode", () => {
  it("posts the shared code and stdin, then publishes the result to every peer", async () => {
    let body: unknown;
    server.use(
      http.post(API, async ({ request }) => {
        body = await request.json();
        await delay(20);
        return HttpResponse.json({
          status: { id: 3, description: "Accepted" },
          stdout: "hi\n",
          stderr: "",
          compileOutput: "",
          message: "",
          time: 0.01,
          memory: 10,
          truncated: false,
        });
      }),
    );
    const { result } = renderHook(() => useRunCode("Asha", "hi"));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current();
    });
    expect(useRoomStore.getState().isRunning).toBe(true);
    await act(() => pending);

    expect(body).toEqual({ language: "python", source: "print(input())", stdin: "hi" });
    expect(useRoomStore.getState().isRunning).toBe(false);
    expect(readLastRun(doc)).toMatchObject({ by: "Asha", language: "python", result: { stdout: "hi\n" } });
  });

  it("keeps configuration errors local instead of broadcasting them", async () => {
    server.use(
      http.post(API, () =>
        HttpResponse.json({ error: { code: "not_configured", message: "Set JUDGE0_URL" } }, { status: 503 }),
      ),
    );
    const { result } = renderHook(() => useRunCode("Asha", ""));
    await act(() => result.current());
    expect(readLastRun(doc)).toBeNull();
    expect(useRoomStore.getState().lastRun).toMatchObject({ error: { code: "not_configured" } });
  });

  it("reports network failures without throwing", async () => {
    server.use(http.post(API, () => HttpResponse.error()));
    const { result } = renderHook(() => useRunCode("Asha", ""));
    await act(() => result.current());
    expect(useRoomStore.getState().lastRun).toMatchObject({ error: { code: "network" } });
    expect(useRoomStore.getState().isRunning).toBe(false);
  });

  it("ignores a second click while a run is in flight", async () => {
    let calls = 0;
    server.use(
      http.post(API, async () => {
        calls++;
        await delay(30);
        return HttpResponse.json({ error: { code: "upstream_error", message: "x" } }, { status: 502 });
      }),
    );
    const { result } = renderHook(() => useRunCode("Asha", ""));
    await act(() => Promise.all([result.current(), result.current()]));
    expect(calls).toBe(1);
  });
});

describe("useRunAvailability", () => {
  it("reads the configured flag from GET /api/run", async () => {
    server.use(http.get(API, () => HttpResponse.json({ configured: false })));
    const { result } = renderHook(() => useRunAvailability());
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(false));
  });
});
