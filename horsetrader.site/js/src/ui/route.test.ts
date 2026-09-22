import assert from "node:assert/strict";
import { test } from "node:test";

import { entryRoute } from "./route.ts";

test("predict is a direct entry route with an optional trailing slash", () => {
  assert.equal(entryRoute("/predict"), "predict");
  assert.equal(entryRoute("/predict/"), "predict");
  assert.equal(entryRoute("/"), null);
  assert.equal(entryRoute("/prediction"), null);
});
