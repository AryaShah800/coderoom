import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ConnectionBanner, ConnectionStatus, describeConnection } from "./ConnectionStatus";
import { useRoomStore } from "@/store/room";
import { SLOW_CONNECT_MS } from "@/lib/config";

beforeEach(() => useRoomStore.getState().enterRoom(`room-${Math.random()}`));
afterEach(() => vi.useRealTimers());

describe("describeConnection", () => {
  it("distinguishes first connect, sync, live, reconnect and offline", () => {
    expect(describeConnection("connecting", false, false).label).toBe("Connecting…");
    expect(describeConnection("connected", true, false).label).toBe("Syncing…");
    expect(describeConnection("connected", true, true).label).toBe("Live");
    expect(describeConnection("connecting", true, true).label).toBe("Reconnecting…");
    expect(describeConnection("disconnected", true, true).label).toBe("Offline");
  });
});

describe("ConnectionStatus", () => {
  it("is a polite status region that follows the store", () => {
    render(<ConnectionStatus />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Connection: Connecting…");
    act(() => {
      useRoomStore.getState().setStatus("connected");
      useRoomStore.getState().setSynced(true);
    });
    expect(status).toHaveTextContent("Connection: Live");
    act(() => useRoomStore.getState().setStatus("connecting"));
    expect(status).toHaveTextContent("Reconnecting…");
  });
});

describe("ConnectionBanner", () => {
  it("explains a slow first connection (cold start) only after a delay", () => {
    vi.useFakeTimers();
    render(<ConnectionBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(SLOW_CONNECT_MS + 10));
    expect(screen.getByRole("status")).toHaveTextContent(/wake up/);
    act(() => useRoomStore.getState().setStatus("connected"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("reassures that edits are kept after a dropped connection", () => {
    useRoomStore.getState().setStatus("connected");
    render(<ConnectionBanner />);
    act(() => useRoomStore.getState().setStatus("disconnected"));
    expect(screen.getByRole("status")).toHaveTextContent(/edits are kept on this device/);
  });
});
