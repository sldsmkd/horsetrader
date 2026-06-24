/**
 * The image broker — the one seam that turns a baked image url into an `<img>`.
 *
 * Every image the UI renders comes from the bake, and Eishin publishes each
 * image's intrinsic dimensions in `images.json` (see the ETL `ImageRegistry`).
 * Routing all `<img>` creation through here lets the broker stamp explicit
 * `width`/`height` on every element from those baked dims, so:
 *   - the browser reserves the right aspect-ratio box before the pixels load
 *     (no cumulative layout shift), and
 *   - an image element carries a definite intrinsic, never a surprise.
 *
 * NB this is NOT what fixes the `max-content` overflow (Godolphin F10) — that's a
 * *container* sizing problem cured by a definite width in CSS; width/height
 * attributes are presentational hints a `width:100%` rule overrides, so they
 * don't bound an image's max-content contribution (verified in Firefox). The
 * broker's job is layout-shift + a single creation seam, not that bug.
 *
 * `initImages` is called once at startup with the fetched `images.json` dims;
 * thereafter `img(src, …)` resolves dims from the in-memory map. A url with no
 * baked entry still renders — it just omits the dims (graceful: the bake covers
 * every published image, so a miss is a non-baked/edge url, not worth throwing).
 */

import { h } from "./h.ts";
import type { Attrs } from "./h.ts";
import type { ImagesBundle } from "../core/bundle/images.gen.ts";

let DIMS: ImagesBundle["dims"] = {};

/** Load the baked image dimensions once (main.ts, after fetching images.json). */
export function initImages(dims: ImagesBundle["dims"]): void {
  DIMS = dims;
}

export interface ImgOpts {
  class?: string;
  /** Defaults to `""` (decorative — the surrounding label carries the meaning). */
  alt?: string;
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync";
  draggable?: boolean;
}

/**
 * Build an `<img>` for a baked url, stamping `width`/`height` from the baked dims
 * when known. The single channel for image elements — views call this instead of
 * `h("img", …)` so the dims (and any future image policy) land in one place.
 */
export function img(src: string, opts: ImgOpts = {}): HTMLImageElement {
  const attr: Record<string, string | number | boolean> = { src, alt: opts.alt ?? "" };
  if (opts.loading) attr.loading = opts.loading;
  if (opts.decoding) attr.decoding = opts.decoding;
  if (opts.draggable !== undefined) attr.draggable = opts.draggable;
  const dims = DIMS[src];
  if (dims) {
    attr.width = dims[0];
    attr.height = dims[1];
  }
  const attrs: Attrs = { attr };
  if (opts.class !== undefined) attrs.class = opts.class;
  return h("img", attrs);
}
