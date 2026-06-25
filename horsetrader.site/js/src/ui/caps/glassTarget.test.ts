import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const componentRoot = fileURLToPath(new URL("../..", import.meta.url));
const glassPath = fileURLToPath(new URL("../../../../css/glass.css", import.meta.url));
const glass = readFileSync(glassPath, "utf8");

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.isFile() && entry.name.endsWith(".css") ? [path] : [];
  });
}

test("glass target modes derive from the canonical glass unit", () => {
  assert.match(glass, /--glass-target-fine:\s*calc\(3\.5 \* var\(--glass-u\)\)/);
  assert.match(glass, /--glass-target-coarse:\s*calc\(7 \* var\(--glass-u\)\)/);
  assert.match(glass, /--glass-target:\s*var\(--glass-target-fine\)/);
  assert.match(
    glass,
    /:root\[data-glass-pointer="coarse"\]\s*\{[^}]*--glass-target:\s*var\(--glass-target-coarse\)/s,
  );
});

test("--glass-u has one root declaration and no component overrides", () => {
  const declarations = [
    ...cssFiles(join(siteRoot, "css")),
    ...cssFiles(componentRoot),
  ].flatMap((path) => {
    const matches = readFileSync(path, "utf8").match(/^\s*--glass-u\s*:/gm) ?? [];
    return matches.map(() => path);
  });
  assert.deepEqual(declarations, [glassPath]);
});
