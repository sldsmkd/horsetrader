import assert from "node:assert/strict";
import { test } from "node:test";

import { SOCIAL_LINKS } from "./socialLinks.ts";

test("the timeline community card links to the public Discord and repository", () => {
  assert.deepEqual(SOCIAL_LINKS, [
    { brand: "discord", label: "Discord", href: "https://discord.gg/C8GDq8g7f" },
    { brand: "github", label: "GitHub", href: "https://github.com/sldsmkd/horsetrader" },
  ]);
});
