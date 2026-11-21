import { describe, expect, it, vi } from "vitest";
import { downloadTextFile, exportFilename } from "./export-file";
import { LANGUAGE_KEYS } from "./languages";

describe("exportFilename", () => {
  it("uses the room id and a matching extension", () => {
    expect(exportFilename("abcdefghjk", "javascript")).toBe("coderoom-abcdefghjk.js");
    expect(exportFilename("abcdefghjk", "python")).toBe("coderoom-abcdefghjk.py");
    expect(exportFilename("abcdefghjk", "rust")).toBe("coderoom-abcdefghjk.rs");
  });

  it("names Java files after the public class so they compile", () => {
    expect(exportFilename("abcdefghjk", "java")).toBe("Main.java");
  });

  it("has an extension for every language the editor offers", () => {
    for (const key of LANGUAGE_KEYS) expect(exportFilename("abcdefghjk", key)).toMatch(/\.[a-z]+$/);
  });
});

describe("downloadTextFile", () => {
  it("saves the exact text through a temporary link and cleans up", async () => {
    const created: Blob[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      created.push(blob as Blob);
      return "blob:test";
    });
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    let clicked: { href: string; download: string } | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked = { href: this.href, download: this.download };
    });
    vi.useFakeTimers();

    downloadTextFile("console.log('é');\n", "x.js");

    expect(clicked).toEqual({ href: "blob:test", download: "x.js" });
    expect(created).toHaveLength(1);
    expect(await created[0]!.text()).toBe("console.log('é');\n");
    expect(document.querySelector("a[download]")).toBeNull();
    vi.advanceTimersByTime(1_100);
    expect(revoke).toHaveBeenCalledWith("blob:test");
    vi.useRealTimers();
  });
});
