/** Emit the shared app shell at every direct static entry point. */

import { copyFile, mkdir } from "node:fs/promises";

const output = new URL("../../static/", import.meta.url);

await mkdir(new URL("predict/", output), { recursive: true });
await Promise.all([
  copyFile(new URL("../index.html", import.meta.url), new URL("index.html", output)),
  copyFile(new URL("../index.html", import.meta.url), new URL("predict/index.html", output)),
]);
