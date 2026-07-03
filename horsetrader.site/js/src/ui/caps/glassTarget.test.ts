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
const appPath = fileURLToPath(new URL("../app.ts", import.meta.url));
const editControlPath = fileURLToPath(new URL("../editControl.ts", import.meta.url));
const cardPath = fileURLToPath(new URL("../views/surfaces/cardSurface.css", import.meta.url));
const cardTsPath = fileURLToPath(new URL("../views/surfaces/cardSurface.ts", import.meta.url));
const planPath = fileURLToPath(new URL("../views/surfaces/planSurface.css", import.meta.url));
const planTsPath = fileURLToPath(new URL("../views/surfaces/planSurface.ts", import.meta.url));
const resourcesPath = fileURLToPath(new URL("../views/surfaces/resourcesSurface.css", import.meta.url));
const resourcesTsPath = fileURLToPath(new URL("../views/surfaces/resourcesSurface.ts", import.meta.url));
const resourcesEditorPath = fileURLToPath(new URL("../views/surfaces/resourcesEditor.css", import.meta.url));
const resourcesEditorTsPath = fileURLToPath(new URL("../views/surfaces/resourcesEditor.ts", import.meta.url));
const resourceLayoutPath = fileURLToPath(new URL("../views/surfaces/resourceLayout.css", import.meta.url));
const limitBreakerPath = fileURLToPath(new URL("../views/widgets/limitBreaker.css", import.meta.url));
const commitPath = fileURLToPath(new URL("../views/surfaces/commitDossier.css", import.meta.url));
const commitTsPath = fileURLToPath(new URL("../views/surfaces/commitDossier.ts", import.meta.url));
const cloudControlsPath = fileURLToPath(new URL("../views/widgets/cloudControls.css", import.meta.url));
const discreteSliderPath = fileURLToPath(new URL("../views/widgets/discreteSlider.css", import.meta.url));
const glass = readFileSync(glassPath, "utf8");
const base = readFileSync(basePath, "utf8");
const typography = readFileSync(typographyPath, "utf8");
const tosen = readFileSync(tosenPath, "utf8");
const menubar = readFileSync(menubarPath, "utf8");
const trainer = readFileSync(trainerPath, "utf8");
const trainerTs = readFileSync(trainerTsPath, "utf8");
const app = readFileSync(appPath, "utf8");
const editControl = readFileSync(editControlPath, "utf8");
const card = readFileSync(cardPath, "utf8");
const cardTs = readFileSync(cardTsPath, "utf8");
const plan = readFileSync(planPath, "utf8");
const planTs = readFileSync(planTsPath, "utf8");
const resources = readFileSync(resourcesPath, "utf8");
const resourcesTs = readFileSync(resourcesTsPath, "utf8");
const resourcesEditor = readFileSync(resourcesEditorPath, "utf8");
const resourcesEditorTs = readFileSync(resourcesEditorTsPath, "utf8");
const resourceLayout = readFileSync(resourceLayoutPath, "utf8");
const limitBreaker = readFileSync(limitBreakerPath, "utf8");
const commitDossier = readFileSync(commitPath, "utf8");
const commitDossierTs = readFileSync(commitTsPath, "utf8");
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
  // The avatar bleeds past its slot by honest dimension (1.3× + negative re-centre),
  // never by `scale` — that would be a C-B4 projection violation on glass.
  assert.match(
    menubar,
    /\.menubar__identity-icon\s*\{[^}]*width:\s*calc\(1\.3 \* var\(--menubar-identity-icon\)\);[^}]*height:\s*calc\(1\.3 \* var\(--menubar-identity-icon\)\)/s,
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
  assert.match(
    trainer,
    /\.mobile-trainer__style-title\s*\{[^}]*font-size:\s*var\(--ht-type-headline-text-size\)/s,
  );
  assert.match(resourcesTs, /class:\s*"resources-surface__carat-total ht-type-headline-text"/);
  assert.match(
    trainerTs,
    /class:\s*"mobile-trainer__name ht-type-headline-text ht-type-edit-control"/,
  );
  assert.match(cardTs, /class:\s*"card-surface__name ht-type-headline-text"/);
  assert.doesNotMatch(
    trainer,
    /\.mobile-trainer__name\s*\{[^}]*font:\s*inherit/s,
  );
});

test("card detail composes semantic type and a coarse phone representation", () => {
  assert.match(cardTs, /class:\s*"card-surface__note-input ht-type-normal-text ht-type-edit-control"/);
  assert.match(app, /title:\s*"Card detail",[\s\S]*?variant:\s*"card-detail"/);
  assert.match(card, /\.surface--card-detail\s*\{[^}]*width:\s*min\(46rem, 55vw,/s);
  assert.match(card, /\.surface-layer--card-detail\s*\{[^}]*z-index:\s*var\(--glass-z-modal\)/s);
  assert.match(
    card,
    /@media \(orientation: portrait\) and \(max-width: 620px\)\s*\{[\s\S]*?\.surface--card-detail\s*\{[^}]*inset:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%/s,
  );
  assert.match(card, /@media \(orientation: landscape\), \(min-width: 900px\)\s*\{[\s\S]*?width:\s*min\(46rem, 88vw\)/s);
  assert.doesNotMatch(card, /\.card-surface__fav:(?:hover|focus-visible)[^{]*\{[^}]*transform:\s*scale/s);
});

test("Plan keeps its desktop Desk and takes over a coarse phone viewport", () => {
  assert.match(app, /title:\s*"The Plan",[\s\S]*?variant:\s*"plan"/);
  assert.match(app, /classList\.toggle\("surface-layer--plan", view\.get\(\)\.plan\)/);
  assert.match(app, /classList\.toggle\("surface-layer--plan-fullscreen", mode === "fullscreen"\)/);
  assert.match(plan, /\.surface--plan\s*\{[^}]*width:\s*min\(calc\(64 \* var\(--glass-u\)\)/s);
  assert.match(plan, /\.surface--plan > \.surface__body\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(plan, /\.plan__rows\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto/s);
  assert.match(
    plan,
    /\.surface-layer--plan\.surface-layer--plan-fullscreen\s*\{[^}]*z-index:\s*var\(--glass-z-modal\)/s,
  );
  assert.match(plan, /\.surface-layer--plan-fullscreen\s*\{[\s\S]*?\.surface--plan\s*\{[^}]*inset:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%/s);
  assert.match(plan, /--plan-cell:\s*var\(--glass-target\)/);
  assert.match(plan, /\.plan__cancel,\s*\n\.plan__update\s*\{[^}]*min-height:\s*var\(--glass-target\)/s);
  assert.match(planTs, /class:\s*"plan__note ht-type-normal-text ht-type-edit-control"/);
  assert.match(planTs, /class:\s*"plan__title ht-type-headline-text"/);
  assert.match(planTs, /class:\s*"plan__count ht-type-focus-text"/);
  assert.match(planTs, /class:\s*"plan__back"[\s\S]*?"aria-label":\s*"Back to timeline"[\s\S]*?click:\s*discard/);
  assert.match(plan, /\.plan__back\s*\{[^}]*width:\s*var\(--glass-target\);[^}]*height:\s*var\(--glass-target\)/s);
  assert.doesNotMatch(planTs, /oshiPortrait|oshiName/);
  assert.doesNotMatch(plan, /\.plan__note\s*\{[^}]*font-size:/s);
  assert.doesNotMatch(plan, /\.plan__(?:title|count)\s*\{[^}]*font-(?:size|weight):/s);
});

test("Record Balance takes over a coarse phone viewport", () => {
  assert.match(app, /title:\s*"Record Balance",[\s\S]*?variant:\s*"balance-editor"/);
  assert.match(app, /classList\.toggle\("surface-layer--balance-fullscreen", mode === "fullscreen"\)/);
  assert.match(app, /classList\.toggle\("surface-layer--balance-editor", view\.get\(\)\.resourcesEditing\)/);
  assert.match(
    resourcesEditor,
    /\.surface-layer--balance-editor\.surface-layer--balance-fullscreen\s*\{[^}]*z-index:\s*var\(--glass-z-modal\)/s,
  );
  assert.match(resourcesEditor, /\.surface-layer--balance-fullscreen\s*\{[\s\S]*?\.surface--balance-editor\s*\{[^}]*inset:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%/s);
  assert.match(resourcesEditorTs, /class:\s*"resources-editor__title ht-type-headline-text"/);
  assert.match(resourcesEditorTs, /class:\s*"resource-field__input ht-type-normal-text ht-type-edit-control"/);
  assert.match(resourcesEditorTs, /class:\s*"resources-editor__pack-days ht-type-normal-text ht-type-edit-control"/);
  assert.match(resourcesEditorTs, /class:\s*"resources-editor__back"[\s\S]*?"aria-label":\s*"Back to resources"/);
});

test("Resources leaves the menubar rail and takes over a coarse phone viewport", () => {
  assert.match(app, /title:\s*"Resources",[\s\S]*?variant:\s*"resources"/);
  assert.match(app, /classList\.toggle\("chrome-dropdowns--resources-fullscreen", mode === "fullscreen"\)/);
  assert.match(app, /classList\.toggle\("chrome-dropdowns--resources", right === "resources"\)/);
  assert.match(
    resources,
    /\.chrome-dropdowns--resources\.chrome-dropdowns--resources-fullscreen\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*z-index:\s*900/s,
  );
  assert.match(resources, /\.chrome-dropdowns--resources-fullscreen\s*\{[\s\S]*?\.surface--resources\s*\{[^}]*inset:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%/s);
  assert.match(resourcesTs, /class:\s*"resources-surface__title ht-type-headline-text"/);
  assert.match(resourcesTs, /class:\s*"resources-surface__back"[\s\S]*?"aria-label":\s*"Back to timeline"/);
});

test("Resources and Record Balance delegate readable type to Tosen roles", () => {
  assert.deepEqual(resources.match(/font-size:/g), ["font-size:"]); // symbolic back chevron only
  assert.deepEqual(resourcesEditor.match(/font-size:/g), ["font-size:"]); // symbolic back chevron only
  for (const css of [resources, resourcesEditor, resourceLayout, limitBreaker]) {
    assert.doesNotMatch(css, /font-weight:/);
    assert.doesNotMatch(css, /line-height:/);
  }
  assert.doesNotMatch(resourceLayout, /font-size:/);
  assert.doesNotMatch(limitBreaker, /font-size:/);
  assert.match(resourcesTs, /resources-surface__edit ht-type-focus-text/);
  assert.match(resourcesEditorTs, /resources-editor__save ht-type-focus-text/);
});

test("commit dossier keeps its layout inside a Tosen-typed phone takeover", () => {
  assert.match(app, /title:\s*commitTitle\(ctx\),[\s\S]*?variant:\s*"commit"/);
  assert.match(app, /classList\.toggle\("surface-layer--commit-fullscreen", mode === "fullscreen"\)/);
  assert.match(app, /classList\.toggle\("surface-layer--commit", committing !== null\)/);
  assert.match(
    commitDossier,
    /\.surface-layer--commit\.surface-layer--commit-fullscreen\s*\{[^}]*z-index:\s*var\(--glass-z-modal\)/s,
  );
  assert.match(commitDossier, /\.surface-layer--commit-fullscreen\s*\{[\s\S]*?\.surface--commit\s*\{[^}]*inset:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%/s);
  assert.match(commitDossierTs, /class:\s*"commit-dossier__title ht-type-headline-text"/);
  assert.match(commitDossierTs, /class:\s*"commit-dossier__dates ht-type-focus-text"/);
  assert.match(commitDossierTs, /class:\s*"commit-dossier__back"[\s\S]*?"aria-label":\s*"Back to timeline"/);
  assert.deepEqual(commitDossier.match(/font-size:/g), ["font-size:"]); // symbolic back chevron only
  assert.doesNotMatch(commitDossier, /font-weight:|line-height:/);
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
