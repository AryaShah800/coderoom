/**
 * Languages offered in the selector. `judge0Id` values are Judge0 CE language IDs
 * (https://ce.judge0.com/languages); `monaco` is the Monaco editor language ID.
 */
export const LANGUAGES = [
  {
    key: "javascript",
    label: "JavaScript (Node.js)",
    monaco: "javascript",
    judge0Id: 63,
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
    template: `const greet = (name: string): string => \`Hello, \${name}!\`;

console.log(greet("CodeRoom"));
`,
  },
  {
    key: "python",
    label: "Python 3",
    monaco: "python",
    judge0Id: 71,
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
    template: `fn main() {
    println!("Hello, CodeRoom!");
}
`,
  },
] as const;

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
