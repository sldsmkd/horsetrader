import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const componentRoot = fileURLToPath(new URL("../..", import.meta.url));
const glassPath = fileURLToPath(new URL("../../../../css/glass.css", import.meta.url));
const basePath = fileURLToPath(new URL("../../../../css/base.css", import.meta.url));
const typographyPath = fileURLToPath(new URL("../../../../css/typography.css", import.meta.url));
const tosenPath = fileURLToPath(new URL("../../../../css/tosen.css", import.meta.url));
const menubarPath = fileURLToPath(new URL("../views/menubar.css", import.meta.url));
const trainerPath = fileURLToPath(new URL("../views/trainer/trainerPage.css", import.meta.url));
const trainerTsPath = fileURLToPath(new URL("../views/trainer/trainerPage.ts", import.meta.url));
const editControlPath = fileURLToPath(new URL("../editControl.ts", import.meta.url));
const cardPath = fileURLToPath(new URL("../views/surfaces/cardSurface.css", import.meta.url));
const resourcesPath = fileURLToPath(new URL("../views/surfaces/resourcesSurface.css", import.meta.url));
const cloudControlsPath = fileURLToPath(new URL("../views/widgets/cloudControls.css", import.meta.url));
const discreteSliderPath = fileURLToPath(new URL("../views/widgets/discreteSlider.css", import.meta.url));
const glass = readFileSync(glassPath, "utf8");
const base = readFileSync(basePath, "utf8");
const typography = readFileSync(typographyPath, "utf8");
const tosen = readFileSync(tosenPath, "utf8");
const menubar = readFileSync(menubarPath, "utf8");
const trainer = readFileSync(trainerPath, "utf8");
const trainerTs = readFileSync(trainerTsPath, "utf8");
const editControl = readFileSync(editControlPath, "utf8");
const card = readFileSync(cardPath, "utf8");
const resources = readFileSync(resourcesPath, "utf8");
const cloudControls = readFileSync(cloudControlsPath, "utf8");
const discreteSlider = readFileSync(discreteSliderPath, "utf8");

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.isFile() && entry.name.endsWith(".css") ? [path] : [];
  });
}

test("glass target modes derive from the canonical glass unit", () => {
  assert.match(glass, /--glass-u-device-calibration:\s*clamp\(7px, min\(1svh, 2svw\), 20px\)/);
  assert.match(glass, /--glass-u:\s*var\(--glass-u-device-calibration\)/);
  assert.match(glass, /--glass-target-fine:\s*calc\(3\.5 \* var\(--glass-u\)\)/);
  assert.match(glass, /--glass-target-coarse:\s*calc\(7 \* var\(--glass-u\)\)/);
  assert.match(glass, /--glass-target:\s*var\(--glass-target-fine\)/);
  assert.match(glass, /--glass-control-type-size:\s*calc\(var\(--glass-target\) \/ 3\)/);
  assert.match(glass, /--glass-type-presentation-u:\s*var\(--glass-u\)/);
  assert.match(
    glass,
    /:root\[data-glass-pointer="coarse"\]\s*\{[^}]*--glass-target:\s*var\(--glass-target-coarse\)/s,
  );
  assert.match(
    glass,
    /:root\[data-glass-pointer="coarse"\]\s*\{[^}]*--glass-type-presentation-u:\s*calc\(1\.697 \* var\(--glass-u\)\)/s,
  );
});

test("type tokens derive through the semantic plane unit", () => {
  assert.match(typography, /--ht-type-u:\s*var\(--glass-u\)/);
  assert.match(tosen, /--ht-type-normal-text-size:\s*calc\(1\.2 \* var\(--glass-type-presentation-u\)\)/);
  assert.match(typography, /--ht-type-body-size:\s*var\(--ht-type-normal-text-size\)/);
  assert.match(typography, /--ht-type-label-size:\s*var\(--ht-type-normal-text-size\)/);
  assert.match(typography, /--ht-type-caption-size:\s*var\(--ht-type-normal-text-size\)/);
  assert.match(typography, /--ht-type-control-label-size:\s*var\(--ht-type-normal-text-size\)/);
  assert.match(typography, /--ht-type-chip-subject-size:\s*calc\(1\.3 \* var\(--ht-type-u\)\)/);
  assert.match(typography, /\.ht-type-chip-title\s*\{[^}]*font-size:\s*var\(--ht-type-chip-subject-size\)/s);
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

test("normal text inherits from the application root", () => {
  assert.match(
    base,
    /body\s*\{[^}]*font-size:\s*var\(--ht-type-normal-text-size\);[^}]*font-weight:\s*var\(--ht-type-normal-text-weight\);[^}]*line-height:\s*var\(--ht-type-normal-text-line\)/s,
  );
  assert.doesNotMatch(menubar, /--menubar-control-type-size/);
});

test("focus text shares one optical size across chrome and Trainer", () => {
  assert.match(
    tosen,
    /--ht-type-focus-text-size:\s*calc\(1\.375 \* var\(--glass-type-presentation-u\)\)/,
  );
  assert.match(
    menubar,
    /\.menubar\s*\{[^}]*font-size:\s*var\(--ht-type-focus-text-size\);[^}]*font-weight:\s*var\(--ht-type-focus-text-weight\);[^}]*line-height:\s*var\(--ht-type-focus-text-line\)/s,
  );
  assert.doesNotMatch(menubar, /\.menubar__(?:date|identity-name|balance-primary)\s*\{[^}]*font-size:/s);
  for (const selector of [
    "mobile-trainer__oshi-name",
    "mobile-trainer__club-value",
    "mobile-trainer__style-caption",
    "mobile-trainer__action",
  ]) {
    assert.match(
      trainer,
      new RegExp(`\\.${selector}\\s*\\{[^}]*font-size:\\s*var\\(--ht-type-focus-text-size\\)`, "s"),
    );
  }
  assert.match(
    cloudControls,
    /\.cloud-controls__btn\s*\{[^}]*font-size:\s*var\(--ht-type-focus-text-size\)/s,
  );
});

test("discrete slider values stay normal-sized and right-justified", () => {
  assert.match(
    discreteSlider,
    /\.discrete-slider__header\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/s,
  );
  assert.match(
    discreteSlider,
    /\.discrete-slider__value\s*\{[^}]*text-align:\s*right;[^}]*font-weight:\s*var\(--ht-type-number-weight\)/s,
  );
  assert.doesNotMatch(
    discreteSlider,
    /\.discrete-slider__(?:title|value|description)\s*\{[^}]*font-size:/s,
  );
  assert.doesNotMatch(discreteSlider, /@media[\s\S]*?\.discrete-slider__value\s*\{[^}]*text-align:\s*left/s);
});

test("headline text shares the 1.8u surface calibration", () => {
  assert.match(
    tosen,
    /--ht-type-headline-text-size:\s*calc\(1\.8 \* var\(--glass-type-presentation-u\)\)/,
  );
  for (const [css, selector] of [
    [trainer, "mobile-trainer__style-title"],
    [card, "card-surface__name"],
    [resources, "resources-surface__carat-total"],
  ]) {
    assert.match(
      css,
      new RegExp(`\\.${selector}\\s*\\{[^}]*font-size:\\s*var\\(--ht-type-headline-text-size\\)`, "s"),
    );
  }
  assert.match(
    trainerTs,
    /class:\s*"mobile-trainer__name ht-type-headline-text ht-type-edit-control"/,
  );
  assert.doesNotMatch(
    trainer,
    /\.mobile-trainer__name\s*\{[^}]*font:\s*inherit/s,
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
    /\.mobile-trainer\s*\{[^}]*--trainer-playstyle-glyph:\s*calc\(2\.5 \* var\(--glass-u\)\)/s,
  );
  assert.match(
    trainer,
    /\.mobile-trainer \.playstyle-preset__icon img\s*\{[^}]*width:\s*var\(--trainer-playstyle-glyph\)/s,
  );
  assert.match(
    trainer,
    /:root\[data-glass-pointer="coarse"\] \.mobile-trainer \.playstyle-preset__icon img\s*\{[^}]*width:\s*var\(--trainer-playstyle-glyph\)/s,
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
    /\.mobile-trainer__style-mast img\s*\{[^}]*width:\s*var\(--glass-target\);[^}]*height:\s*var\(--glass-target\);[^}]*padding:\s*calc\(\(var\(--glass-target\) - var\(--trainer-playstyle-glyph\)\) \/ 2\);[^}]*background:\s*transparent;[^}]*box-shadow:/s,
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
    tosen,
    /:root\[data-glass-pointer="coarse"\] \.ht-type-edit-control\s*\{[^}]*font-size:\s*max\(var\(--ht-type-natural-size, 1em\), var\(--glass-control-type-size\)\)/s,
  );
  for (const role of ["normal", "focus", "headline"]) {
    assert.match(
      tosen,
      new RegExp(`\\.ht-type-${role}-text\\s*\\{[^}]*--ht-type-natural-size:\\s*var\\(--ht-type-${role}-text-size\\)`, "s"),
    );
  }
  assert.match(
    trainer,
    /\.mobile-trainer__name\s*\{[^}]*min-height:\s*var\(--glass-target\)/s,
  );
});

test("edit-control spellcheck is active only while editing", () => {
  assert.match(
    editControl,
    /root\.addEventListener\("focusin",[\s\S]*?target\.spellcheck = true;/,
  );
  assert.match(
    editControl,
    /root\.addEventListener\("focusout",[\s\S]*?target\.spellcheck = false;/,
  );
  assert.match(editControl, /target\.classList\.contains\(EDIT_CONTROL\)/);
});
