import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { OutputPanel, summarizeRun } from "./OutputPanel";
import type { SharedRun } from "@/lib/collab";

const accepted: SharedRun = {
  by: "Asha",
  language: "python",
  at: 1,
  result: {
    status: { id: 3, description: "Accepted" },
    stdout: "one\ntwo\n",
    stderr: "",
    compileOutput: "",
    message: "",
    time: 0.0123,
    memory: 2048,
    truncated: false,
  },
};

const liveRegion = () => document.querySelector("p[aria-live='polite']");

describe("output copying", () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const writeText = vi.fn();

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
    else Reflect.deleteProperty(navigator, "clipboard");
  });

  it.each([
    ["stdout", "stdout"],
    ["stderr", "stderr"],
    ["compileOutput", "compiler output"],
    ["message", "message"],
  ] as const)("copies the full %s stream and resets the confirmation after 1.5 seconds", async (stream, label) => {
    vi.useFakeTimers();
    const text = "first line\n  second line\n";
    const run: SharedRun = {
      ...accepted,
      result: { ...accepted.result!, stdout: "", [stream]: text },
    };
    render(<OutputPanel run={run} isRunning={false} configured selfName="Me" />);
    expect(screen.getAllByRole("button", { name: /^Copy / })).toHaveLength(1);
    const button = screen.getByRole("button", { name: `Copy ${label}` });

    await act(async () => fireEvent.click(button));
    expect(writeText).toHaveBeenCalledExactlyOnceWith(text);
    expect(button).toHaveTextContent("Copied");
    act(() => vi.advanceTimersByTime(1499));
    expect(button).toHaveTextContent("Copied");
    act(() => vi.advanceTimersByTime(1));
    expect(button).toHaveTextContent(/^Copy$/);
  });

  it("does not offer copying when all streams are empty", () => {
    render(<OutputPanel run={{ ...accepted, result: { ...accepted.result!, stdout: "" } }} isRunning={false} configured selfName="Me" />);
    expect(screen.queryByRole("button", { name: /^Copy / })).not.toBeInTheDocument();
  });

  it("copies request error text and hides the button for an empty error", async () => {
    const run: SharedRun = { by: "Me", language: "c", at: 1, error: { code: "upstream_timeout", message: "Request timed out.\nTry again." } };
    const { rerender } = render(<OutputPanel run={run} isRunning={false} configured selfName="Me" />);
    const button = screen.getByRole("button", { name: "Copy error" });
    await act(async () => fireEvent.click(button));
    expect(writeText).toHaveBeenCalledExactlyOnceWith(run.error!.message);
    expect(button).toHaveTextContent("Copied");

    rerender(<OutputPanel run={{ ...run, error: { ...run.error!, message: "" } }} isRunning={false} configured selfName="Me" />);
    expect(screen.queryByRole("button", { name: /^Copy / })).not.toBeInTheDocument();
  });

  it.each(["rejected", "unavailable"])("shows a manual-copy fallback when the clipboard is %s", async (failure) => {
    if (failure === "rejected") writeText.mockRejectedValue(new Error("Clipboard denied"));
    else Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    render(<OutputPanel run={accepted} isRunning={false} configured selfName="Me" />);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy stdout" })));
    const output = screen.getByRole("region", { name: "Output" });
    expect(within(output).getByRole("status")).toHaveTextContent("Copy failed. Select the text and copy it manually.");
    expect(within(output).getByRole("status")).toBeVisible();
    expect(within(output).getByText(/one\s+two/)).toBeVisible();
  });
});

describe("OutputPanel", () => {
  it("says up front when Run is not configured", () => {
    render(<OutputPanel run={null} isRunning={false} configured={false} selfName="Me" language="java" />);
    expect(screen.getByText("Run is not configured here")).toBeInTheDocument();
    expect(screen.getByText(/JUDGE0_URL/)).toBeInTheDocument();
  });

  it("does not warn about Judge0 for languages that run in the browser", () => {
    render(<OutputPanel run={null} isRunning={false} configured={false} selfName="Me" language="python" />);
    expect(screen.queryByText("Run is not configured here")).not.toBeInTheDocument();
    expect(screen.getByText(/to execute the code/)).toBeInTheDocument();
  });

  it("shows what a run is waiting on", () => {
    render(<OutputPanel run={null} isRunning={true} configured={null} selfName="Me" phase="Loading the Python runtime (first run only)…" />);
    expect(screen.getByText(/Loading the Python runtime/)).toBeInTheDocument();
  });

  it("shows a hint before the first run", () => {
    render(<OutputPanel run={null} isRunning={false} configured={true} selfName="Me" />);
    expect(screen.getByText(/to execute the code/)).toBeInTheDocument();
    expect(liveRegion()).toHaveTextContent("");
  });

  it("announces running and then the result through a polite live region", () => {
    const { rerender } = render(<OutputPanel run={null} isRunning={true} configured={true} selfName="Me" />);
    expect(liveRegion()).toHaveTextContent("Running code…");

    rerender(<OutputPanel run={accepted} isRunning={false} configured={true} selfName="Me" />);
    expect(liveRegion()).toHaveTextContent("Asha's run finished: Accepted. 2 lines of output.");
    const output = screen.getByRole("region", { name: "Output" });
    expect(within(output).getByText(/one\s+two/)).toBeInTheDocument();
    expect(screen.getByText("0.012 s")).toBeInTheDocument();
    expect(screen.getByText("2.0 MB")).toBeInTheDocument();
    expect(screen.getByText(/Asha, Python 3/)).toBeInTheDocument();
  });

  it("renders compiler output and errors as separate regions", () => {
    const failed: SharedRun = {
      ...accepted,
      by: "Me",
      result: { ...accepted.result!, status: { id: 6, description: "Compilation Error" }, stdout: "", compileOutput: "bad syntax", stderr: "trace" },
    };
    render(<OutputPanel run={failed} isRunning={false} configured={true} selfName="Me" />);
    expect(screen.getByRole("region", { name: "Compiler output" })).toHaveTextContent("bad syntax");
    expect(screen.getByRole("region", { name: "Errors" })).toHaveTextContent("trace");
    expect(screen.queryByRole("region", { name: "Output" })).not.toBeInTheDocument();
    expect(liveRegion()).toHaveTextContent("Your run finished: Compilation Error. 0 lines of output.");
  });

  it("shows request errors as an alert", () => {
    const run: SharedRun = { by: "Me", language: "c", at: 1, error: { code: "rate_limited", message: "Too many runs. Try again in 12 s." } };
    render(<OutputPanel run={run} isRunning={false} configured={true} selfName="Me" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not run the code");
    expect(screen.getByRole("alert")).toHaveTextContent("Too many runs");
  });

  it("flags truncated output", () => {
    render(
      <OutputPanel run={{ ...accepted, result: { ...accepted.result!, truncated: true } }} isRunning={false} configured selfName="Me" />,
    );
    expect(screen.getByText(/Output was cut/)).toBeInTheDocument();
  });

  it("summarizes errors", () => {
    expect(summarizeRun({ by: "Ben", language: "go", at: 1, error: { code: "upstream_timeout", message: "slow" } }, "Me")).toBe(
      "Ben's run failed: slow",
    );
  });
});
