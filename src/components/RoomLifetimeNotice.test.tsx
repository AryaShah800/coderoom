import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoomLifetimeNotice } from "./ExportButton";

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("RoomLifetimeNotice", () => {
  it("dismisses only the current room and remembers it across renders and visits", async () => {
    const user = userEvent.setup();
    const { rerender, unmount } = render(<RoomLifetimeNotice roomId="room-a" ttlMinutes={30} />);

    expect(screen.getByTestId("room-lifetime-notice")).toHaveTextContent("30 minutes");
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByTestId("room-lifetime-notice")).not.toBeInTheDocument();

    rerender(<RoomLifetimeNotice roomId="room-a" ttlMinutes={30} />);
    expect(screen.queryByTestId("room-lifetime-notice")).not.toBeInTheDocument();

    unmount();
    const visit = render(<RoomLifetimeNotice roomId="room-a" ttlMinutes={30} />);
    expect(screen.queryByTestId("room-lifetime-notice")).not.toBeInTheDocument();

    visit.rerender(<RoomLifetimeNotice roomId="room-b" ttlMinutes={30} />);
    expect(screen.getByTestId("room-lifetime-notice")).toBeVisible();

    visit.rerender(<RoomLifetimeNotice roomId="room-a" ttlMinutes={30} />);
    expect(screen.queryByTestId("room-lifetime-notice")).not.toBeInTheDocument();
  });

  it("shows again in a fresh session", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<RoomLifetimeNotice roomId="room-a" ttlMinutes={30} />);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    unmount();

    sessionStorage.clear();
    render(<RoomLifetimeNotice roomId="room-a" ttlMinutes={30} />);
    expect(screen.getByTestId("room-lifetime-notice")).toBeVisible();
  });

  it("can still be dismissed when session storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    const user = userEvent.setup();
    render(<RoomLifetimeNotice roomId="room-a" ttlMinutes={30} />);

    expect(screen.getByTestId("room-lifetime-notice")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByTestId("room-lifetime-notice")).not.toBeInTheDocument();
  });
});
