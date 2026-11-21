/**
 * Languages offered in the selector. `judge0Id` values are Judge0 CE language IDs
 * (https://ce.judge0.com/languages); `monaco` is the Monaco editor language ID.
 */
export const LANGUAGES = [
  {
    key: "javascript",
    label: "JavaScript",
    monaco: "javascript",
    judge0Id: 63,
    runtime: "browser" as const,
    template: `// Welcome to CodeRoom. Share the link and edit together.
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet("CodeRoom"));
`,
  },
  {
    key: "typescript",
    label: "TypeScript",
    monaco: "typescript",
    judge0Id: 74,
    runtime: "browser" as const,
    template: `const greet = (name: string): string => \`Hello, \${name}!\`;

console.log(greet("CodeRoom"));
`,
  },
  {
    key: "python",
    label: "Python 3",
    monaco: "python",
    judge0Id: 71,
    runtime: "browser" as const,
    template: `def greet(name: str) -> str:
    return f"Hello, {name}!"


print(greet("CodeRoom"))
`,
  },
  {
    key: "java",
    label: "Java",
    monaco: "java",
    judge0Id: 62,
    runtime: "judge0" as const,
    template: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, CodeRoom!");
    }
}
`,
  },
  {
    key: "cpp",
    label: "C++",
    monaco: "cpp",
    judge0Id: 54,
    runtime: "judge0" as const,
    template: `#include <iostream>

int main() {
    std::cout << "Hello, CodeRoom!" << std::endl;
    return 0;
}
`,
  },
  {
    key: "c",
    label: "C",
    monaco: "c",
    judge0Id: 50,
    runtime: "judge0" as const,
    template: `#include <stdio.h>

int main(void) {
    printf("Hello, CodeRoom!\\n");
    return 0;
}
`,
  },
  {
    key: "go",
    label: "Go",
    monaco: "go",
    judge0Id: 60,
    runtime: "judge0" as const,
    template: `package main

import "fmt"

func main() {
	fmt.Println("Hello, CodeRoom!")
}
`,
  },
  {
    key: "rust",
    label: "Rust",
    monaco: "rust",
    judge0Id: 73,
    runtime: "judge0" as const,
    template: `fn main() {
    println!("Hello, CodeRoom!");
}
`,
  },
] as const;

export type Runtime = "browser" | "judge0";

export type Language = (typeof LANGUAGES)[number];
export type LanguageKey = Language["key"];

export const DEFAULT_LANGUAGE: LanguageKey = "javascript";

export const LANGUAGE_KEYS = LANGUAGES.map((l) => l.key) as [LanguageKey, ...LanguageKey[]];

export function isLanguageKey(value: unknown): value is LanguageKey {
  return typeof value === "string" && (LANGUAGE_KEYS as readonly string[]).includes(value);
}

export function getLanguage(key: LanguageKey): Language {
  return LANGUAGES.find((l) => l.key === key) ?? LANGUAGES[0];
}

/** True when the code is empty or still the untouched starter template of `key`. */
export function isUntouchedTemplate(code: string, key: LanguageKey): boolean {
  const trimmed = code.trim();
  return trimmed === "" || trimmed === getLanguage(key).template.trim();
}

/**
 * Honest one-line description of where a language runs. Browser languages need no server;
 * everything else needs a Judge0 endpoint configured on the server (JUDGE0_URL).
 */
export function runtimeNote(key: LanguageKey, judge0Configured: boolean | null): string {
  switch (key) {
    case "javascript":
      return "Runs in your browser (Web Worker, 5 s limit). Not Node.js: no require or fs.";
    case "typescript":
      return "Runs in your browser (Web Worker, 5 s limit). Types are stripped, not type-checked.";
    case "python":
      return "Runs in your browser with Pyodide (CPython in WebAssembly, 10 s limit). Loads on the first run.";
    default:
      if (judge0Configured) return "Runs on the server through Judge0.";
      if (judge0Configured === false) return "Editor only here: running this language needs a Judge0 server runner, which is not configured.";
      return "Runs through a Judge0 server runner when one is configured.";
  }
}

export const needsJudge0 = (key: LanguageKey) => getLanguage(key).runtime === "judge0";
