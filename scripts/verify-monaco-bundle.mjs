// Checks the built browser chunks (not node_modules): Monaco must be bundled from its ESM build,
// and every DOMPurify copy shipped to the browser must be at least MIN_DOMPURIFY.
// Runs after `next build`; exits non-zero on failure so CI catches a regression.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const MIN_DOMPURIFY = [3, 4, 17];
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const staticDir = join(root, ".next", "static");

if (!existsSync(staticDir)) {
  console.error("[verify-monaco-bundle] .next/static not found; run `next build` first.");
  process.exit(1);
}

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name.endsWith(".js")) files.push(path);
  }
};
walk(staticDir);

const atLeast = (v, min) => {
  for (let i = 0; i < 3; i++) if (v[i] !== min[i]) return v[i] > min[i];
  return true;
};

const purifyCopies = [];
let monacoChunks = 0;
for (const file of files) {
  const code = readFileSync(file, "utf8");
  if (code.includes("SAFE_FOR_TEMPLATES") && code.includes("RETURN_TRUSTED_TYPE")) {
    const versions = [...code.matchAll(/\.version\s*=\s*["'](3\.\d+\.\d+)["']/g)].map((m) => m[1]);
    purifyCopies.push({ file: relative(root, file), versions: versions.length ? versions : ["unknown"] });
  }
  if (code.includes("vs.editor.ICodeEditor") || code.includes("editor.action.toggleTabFocusMode")) monacoChunks++;
}

const problems = [];
if (monacoChunks === 0) problems.push("no Monaco editor code found in the browser chunks");
if (purifyCopies.length === 0) problems.push("no DOMPurify copy found (expected Monaco's sanitizer)");
for (const copy of purifyCopies) {
  for (const version of copy.versions) {
    const parts = version.split(".").map(Number);
    if (version === "unknown" || !atLeast(parts, MIN_DOMPURIFY)) {
      problems.push(`${copy.file}: DOMPurify ${version} (need >= ${MIN_DOMPURIFY.join(".")})`);
    }
  }
}

for (const copy of purifyCopies) console.log(`[verify-monaco-bundle] DOMPurify ${copy.versions.join(", ")} in ${copy.file}`);
console.log(`[verify-monaco-bundle] Monaco editor code found in ${monacoChunks} chunk(s)`);
if (problems.length) {
  for (const p of problems) console.error(`[verify-monaco-bundle] FAIL: ${p}`);
  process.exit(1);
}
console.log("[verify-monaco-bundle] OK");
