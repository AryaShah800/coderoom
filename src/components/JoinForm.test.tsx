import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinForm } from "./JoinForm";

describe("JoinForm", () => {
  it("requires a name and links the error to the input", async () => {
    const onJoin = vi.fn();
    render(<JoinForm roomId="abcdefghjk" initialName="" initialColor="" onJoin={onJoin} />);
    await userEvent.type(screen.getByLabelText("Your name"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Join room" }));

    const input = screen.getByLabelText("Your name");
    expect(onJoin).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/Enter a name so others know who is typing/);
  });

  it("submits a cleaned name and the chosen colour", async () => {
    const onJoin = vi.fn();
    render(<JoinForm roomId="abcdefghjk" initialName="" initialColor="#f5a524" onJoin={onJoin} />);
    await userEvent.type(screen.getByLabelText("Your name"), "  Ben   Lee ");
    await userEvent.click(screen.getByRole("radio", { name: "Sky" }));
    await userEvent.click(screen.getByRole("button", { name: "Join room" }));
    expect(onJoin).toHaveBeenCalledWith({ name: "Ben Lee", color: "#38bdf8" });
  });

  it("prefills a remembered identity and supports keyboard colour selection", async () => {
    const onJoin = vi.fn();
    render(<JoinForm roomId="abcdefghjk" initialName="Asha" initialColor="#4ade80" onJoin={onJoin} />);
    expect(screen.getByLabelText("Your name")).toHaveValue("Asha");
    const green = screen.getByRole("radio", { name: "Green" });
    expect(green).toBeChecked();

    green.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Sky" })).toBeChecked();
    await userEvent.keyboard("{Enter}");
    expect(onJoin).toHaveBeenCalledWith({ name: "Asha", color: "#38bdf8" });
  });

  it("shows the room code and groups colours under a legend", () => {
    render(<JoinForm roomId="abcdefghjk" initialName="" initialColor="" onJoin={() => {}} />);
    expect(screen.getByText("Room abcdefghjk")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Cursor colour" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(8);
  });
});
