import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveTrainingPass } from "./trainingpass.ts";

test("resolveTrainingPass: only an explicit `true` enables the premium track", () => {
  assert.equal(resolveTrainingPass({ trainingPass: true }), true);
  assert.equal(resolveTrainingPass({ trainingPass: false }), false);
  assert.equal(resolveTrainingPass({}), false);
  assert.equal(resolveTrainingPass(undefined), false);
  assert.equal(resolveTrainingPass({ trainingPass: "2027-01-01" }), false); // not a bare truthy boolean
});
