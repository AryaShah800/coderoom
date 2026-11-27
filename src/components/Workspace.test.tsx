import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRoomStore } from "@/store/room";
import { Workspace } from "./Workspace";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/hooks/use-collaboration", () => ({ useCollaboration: () => null }));
vi.mock("@/hooks/use-run-code", () => ({
  useRunAvailability: () => true,
  useRunCode: () => ({ run: vi.fn(), cancel: vi.fn() }),
}));

const stdinNote = "JavaScript and TypeScript run in your browser and don't read stdin.";

beforeEach(() => useRoomStore.getState().leave());

describe("Workspace stdin", () => {
  it.each(["javascript", "typescript"] as const)("explains the stdin limitation for %s", async (language) => {
    useRoomStore.getState().setLanguage(language);
    const user = userEvent.setup();
    render(<Workspace roomId="room-a" identity={{ name: "Me", color: "#f5a524" }} />);
    await user.click(screen.getByText("Program input (stdin)"));

    expect(screen.getByText(stdinNote)).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Program input" })).toHaveAccessibleDescription(stdinNote);

    act(() => useRoomStore.getState().setLanguage("python"));
    expect(screen.queryByText(stdinNote)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Program input" })).not.toHaveAttribute("aria-describedby");
  });

  it("does not show the limitation for Python", async () => {
    useRoomStore.getState().setLanguage("python");
    const user = userEvent.setup();
    render(<Workspace roomId="room-a" identity={{ name: "Me", color: "#f5a524" }} />);
    await user.click(screen.getByText("Program input (stdin)"));

    expect(screen.getByRole("textbox", { name: "Program input" })).toBeVisible();
    expect(screen.queryByText(stdinNote)).not.toBeInTheDocument();
  });
});
