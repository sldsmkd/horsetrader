/**
 * Ambient declarations for non-code assets imported for their side effects.
 * esbuild resolves these at bundle time (the CSS import injects the stylesheet);
 * TypeScript needs the module shape declared so the import type-checks and the
 * editor doesn't flag it (ts2882). No exports — these are side-effect only.
 */

declare module "*.css";
