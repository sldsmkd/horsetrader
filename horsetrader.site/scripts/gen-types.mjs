// Generates the site's bundle types from the JSON Schemas the ETL publishes
// beside the data in generated/site/static. These types ARE the ETL contract:
// they are derived, never hand-written, so they can't silently drift from the
// baked shape (see docs/architecture.md, "The ETL contract"). Re-run after the
// ETL re-bakes if the schema changed. Output is committed and consumed by core/.
//
// msgspec emits each schema as a root `{ "$ref": "#/$defs/Root", "$defs": {…} }`,
// which json-schema-to-typescript can't resolve directly. We inline the named
// root definition (keeping the remaining `$defs` for nested refs to resolve)
// before compiling.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "json-schema-to-typescript";

const here = dirname(fileURLToPath(import.meta.url));
const staticDir = resolve(here, "../../generated/site/static");
const outDir = resolve(here, "../js/src/core/bundle");

const schemas = [
  { in: "academy.schema.json", out: "academy.gen.ts" },
  { in: "events.schema.json", out: "events.gen.ts" },
];

async function generate({ in: inFile, out: outFile }) {
  const schema = JSON.parse(await readFile(resolve(staticDir, inFile), "utf8"));
  const rootName = schema.$ref.split("/").pop();
  const { [rootName]: rootDef, ...rest } = schema.$defs;
  const root = { title: rootName, ...rootDef, $defs: rest };

  const ts = await compile(root, rootName, {
    additionalProperties: false,
    bannerComment:
      "/* eslint-disable */\n/**\n * Generated from the ETL's published JSON Schema by `npm run gen:types`.\n * DO NOT EDIT BY HAND — re-run generation when the schema changes.\n */",
  });

  await writeFile(resolve(outDir, outFile), ts);
  console.log(`${inFile} → core/bundle/${outFile}`);
}

await mkdir(outDir, { recursive: true });
await Promise.all(schemas.map(generate));
