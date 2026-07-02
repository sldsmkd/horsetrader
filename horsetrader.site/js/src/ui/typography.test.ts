import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = fileURLToPath(new URL("../../../", import.meta.url));
const cssRoot = join(siteRoot, "css");
const uiRoot = fileURLToPath(new URL(".", import.meta.url));
const typographyPath = join(cssRoot, "typography.css");
const timelinePath = join(uiRoot, "views/timeline.css");

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.isFile() && entry.name.endsWith(".css") ? [path] : [];
  });
}

function rel(path: string): string {
  return relative(siteRoot, path);
}

test("semantic type unit is rooted on glass and overridden by the world plane", () => {
  const typography = readFileSync(typographyPath, "utf8");
  const timeline = readFileSync(timelinePath, "utf8");

  assert.match(typography, /--ht-type-u:\s*var\(--glass-u\)/);
  assert.match(timeline, /\.timeline__content\s*\{[^}]*--ht-type-u:\s*calc\(var\(--world-golshi\) \/ 7\)/s);
});

test("readable typography uses semantic tokens; raw font sizes stay named exceptions", () => {
  const allowed = new Set([
    "js/src/ui/views/perfHud.css:28", // debug HUD
    "js/src/ui/views/perfHud.css:46", // debug HUD
    "js/src/ui/umamark/umamark.css:133", // debug benchmark HUD
    "js/src/ui/umamark/umamark.css:144", // debug benchmark HUD
    "js/src/ui/views/filmstrip.css:165", // symbolic star glyph
    "js/src/ui/views/trainer/trainerPage.css:134", // symbolic back chevron
    "js/src/ui/views/surfaces/planSurface.css:43", // symbolic back chevron
    "js/src/ui/views/surfaces/resourcesEditor.css:24", // symbolic back chevron
    "js/src/ui/views/surfaces/resourcesSurface.css:27", // symbolic back chevron
    "js/src/ui/views/surfaces/commitDossier.css:26", // symbolic back chevron
    "js/src/ui/views/surfaces/cardSurface.css:123", // symbolic favourite star
  ]);

  const offenders: string[] = [];
  for (const file of [...cssFiles(cssRoot), ...cssFiles(uiRoot)]) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (!/font-size:\s*/.test(line)) return;
      if (/font-size:\s*var\(--ht-type/.test(line)) return;
      if (/font-size:\s*max\(var\(--ht-type/.test(line)) return;
      if (/font-size:\s*var\(--menubar-control-type-size\)/.test(line)) return;
      const key = `${rel(file)}:${i + 1}`;
      if (!allowed.has(key)) offenders.push(`${key}: ${line.trim()}`);
    });
  }

  assert.deepEqual(offenders, []);
});
