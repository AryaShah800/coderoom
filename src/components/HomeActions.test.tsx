import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { HomeActions } = await import("./HomeActions");

beforeEach(() => push.mockReset());

describe("HomeActions", () => {
  it("creates a room with a fresh, valid ID", async () => {
    render(<HomeActions />);
    await userEvent.click(screen.getByRole("button", { name: /Create a room/ }));
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/room\/[23456789a-hjkmnp-z]{10}$/));
    expect(screen.getByRole("button", { name: /Creating room/ })).toBeDisabled();
  });

  it("joins from a pasted link", async () => {
    render(<HomeActions />);
    await userEvent.type(screen.getByLabelText("Room code or link"), "https://x.example/room/abcdefghjk");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(push).toHaveBeenCalledWith("/room/abcdefghjk");
  });

  it("explains an invalid code instead of navigating", async () => {
    render(<HomeActions />);
    const input = screen.getByLabelText("Room code or link");
    await userEvent.type(input, "hello{Enter}");
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("10-character room code");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});
