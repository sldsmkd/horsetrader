/* eslint-disable */
/**
 * Generated from the ETL's published JSON Schema by `npm run gen:types`.
 * DO NOT EDIT BY HAND — re-run generation when the schema changes.
 */

/**
 * Top-level shape of ``images.json`` — every published image's intrinsic
 * dimensions, keyed by its published url (the same string each image field in
 * the other bundles serialises). Each value is a ``[width, height]`` pair. The
 * front-end's image broker resolves dims by url, so every ``<img>`` can carry
 * explicit ``width``/``height`` (no max-content intrinsic surprises, no layout
 * shift). Populated by Curren Chan as she publishes; see ``ImageRegistry``.
 *
 * Each value is a ``[width, height]`` list (not a 2-tuple: the tuple schema
 * generates as ``never[]`` in json-schema-to-typescript; a list emits clean
 * ``number[]``, and the one consumer — the FE broker — destructures it).
 */
export interface ImagesBundle {
  dims: {
    [k: string]: number[];
  };
}
