import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const componentRoot = fileURLToPath(new URL("../..", import.meta.url));
const glassPath = fileURLToPath(new URL("../../../../css/glass.css", import.meta.url));
const typographyPath = fileURLToPath(new URL("../../../../css/typography.css", import.meta.url));
const menubarPath = fileURLToPath(new URL("../views/menubar.css", import.meta.url));
const trainerPath = fileURLToPath(new URL("../views/trainer/trainerPage.css", import.meta.url));
const glass = readFileSync(glassPath, "utf8");
const typography = readFileSync(typographyPath, "utf8");
const menubar = readFileSync(menubarPath, "utf8");
const trainer = readFileSync(trainerPath, "utf8");

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

test("the Trainer chip scales its portrait optically by pointer mode", () => {
  assert.match(
    menubar,
    /\.menubar\s*\{[^}]*--menubar-identity-icon:\s*calc\(2\.38 \* var\(--glass-u\)\)/s,
  );
  assert.match(
    menubar,
    /:root\[data-glass-pointer="coarse"\] \.menubar\s*\{[^}]*--menubar-identity-icon:\s*calc\(5 \* var\(--glass-u\)\)/s,
  );
  assert.match(
    menubar,
    /\.menubar__identity-icon\s*\{[^}]*width:\s*var\(--menubar-identity-icon\);[^}]*height:\s*var\(--menubar-identity-icon\)/s,
  );
  assert.match(
    menubar,
    /--menubar-identity-inset:\s*calc\(\(var\(--glass-target\) - var\(--menubar-identity-icon\)\) \/ 2\)/,
  );
  assert.match(
    menubar,
    /\.menubar__identity\s*\{[^}]*padding:\s*var\(--menubar-identity-inset\)[^;]*var\(--menubar-identity-inset\)/s,
  );
  assert.match(
    menubar,
    /:root\[data-glass-pointer="coarse"\] \.menubar__identity::after\s*\{\s*display:\s*none;/,
  );
});

test("Trainer preset rows occupy 42u in both pointer modes", () => {
  assert.match(
    trainer,
    /\.mobile-trainer\s*\{[^}]*--trainer-preset-inline:\s*calc\(2 \* var\(--glass-target\)\)/s,
  );
  assert.match(
    trainer,
    /:root\[data-glass-pointer="coarse"\] \.mobile-trainer\s*\{[^}]*--trainer-preset-inline:\s*var\(--glass-target\)/s,
  );
  assert.match(
    trainer,
    /grid-template-columns:\s*repeat\(6, var\(--trainer-preset-inline\)\)/,
  );
  assert.match(
    trainer,
    /\.mobile-trainer \.playstyle-preset\s*\{[^}]*grid-template-columns:\s*var\(--glass-target\) var\(--glass-target\)/s,
  );
  assert.match(
    trainer,
    /:root\[data-glass-pointer="coarse"\] \.mobile-trainer \.playstyle-preset\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );
  assert.match(
    trainer,
    /\.mobile-trainer \.playstyle-preset__icon img\s*\{[^}]*width:\s*calc\(2\.5 \* var\(--glass-u\)\)/s,
  );
  assert.match(
    trainer,
    /:root\[data-glass-pointer="coarse"\] \.mobile-trainer \.playstyle-preset__icon img\s*\{[^}]*width:\s*min\(2\.75rem, 100%\)/s,
  );
  assert.match(
    trainer,
    /\.mobile-trainer \.playstyle-preset--active::before\s*\{[^}]*background:\s*var\(--ht-colour-interactive\)/s,
  );
  assert.match(
    trainer,
    /:root\[data-glass-pointer="coarse"\] \.mobile-trainer \.playstyle-preset--active::before\s*\{[^}]*display:\s*none/s,
  );
  assert.match(
    trainer,
    /:root\[data-glass-pointer="coarse"\] \.mobile-trainer \.playstyle-preset--active\s*\{[^}]*background:\s*var\(--ht-control-bg\);[^}]*box-shadow:/s,
  );
  assert.match(
    trainer,
    /\.mobile-trainer \.playstyle-preset--active\.playstyle-preset--selected\s*\{[^}]*border-color:\s*var\(--ht-control-selected-border\);[^}]*box-shadow:/s,
  );
  assert.match(
    trainer,
    /\.mobile-trainer__style-mast img\s*\{[^}]*background:\s*transparent;[^}]*box-shadow:/s,
  );
});

test("locking Trainer dims content without fading the glass pane", () => {
  assert.match(
    trainer,
    /\.trainer-page-layer--locked \.mobile-trainer\s*\{[^}]*pointer-events:\s*none;[^}]*\}/s,
  );
  assert.doesNotMatch(
    trainer,
    /\.trainer-page-layer--locked \.mobile-trainer\s*\{[^}]*(?:opacity|filter):/s,
  );
  assert.match(
    trainer,
    /\.trainer-page-layer--locked \.mobile-trainer__header,[\s\S]*?\.trainer-page-layer--locked \.mobile-trainer__actions\s*\{[^}]*opacity:\s*0\.55;[^}]*filter:\s*grayscale\(0\.4\)/s,
  );
});

test("Trainer uses its header for name editing and hides rail navigation", () => {
  assert.doesNotMatch(trainer, /\.mobile-trainer__header-title/);
  assert.match(
    trainer,
    /\.mobile-trainer__header-name\s*\{[^}]*display:\s*grid;[^}]*\}/s,
  );
  assert.match(
    trainer,
    /\.trainer-page-layer--rail \.mobile-trainer__back\s*\{[^}]*display:\s*none;/s,
  );
});

test("Trainer actions are equal on fullscreen and compact on the rail", () => {
  assert.match(
    trainer,
    /\.mobile-trainer__actions\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s,
  );
  assert.match(
    trainer,
    /\.trainer-page-layer--rail \.mobile-trainer__actions\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*center/s,
  );
  assert.match(
    trainer,
    /\.trainer-page-layer--rail \.mobile-trainer__action\s*\{[^}]*min-width:\s*calc\(8\.63 \* var\(--glass-u\)\)/s,
  );
  assert.match(
    trainer,
    /\.mobile-trainer__action:disabled\s*\{[^}]*cursor:\s*not-allowed;/s,
  );
});

test("Trainer prevents accidental tap/focus zoom without disabling pinch zoom", () => {
  assert.match(
    trainer,
    /\.mobile-trainer button,[\s\S]*?\.mobile-trainer select\s*\{[^}]*touch-action:\s*manipulation;/s,
  );
  assert.match(
    typography,
    /:root\[data-glass-pointer="coarse"\]\s*\{[^}]*--ht-type-editable-title-size:\s*calc\(var\(--glass-target\) \/ 3\)/s,
  );
  assert.match(
    trainer,
    /\.mobile-trainer__name\s*\{[^}]*font-size:\s*var\(--ht-type-editable-title-size\)/s,
  );
});
