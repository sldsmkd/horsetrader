import "./scenarioArt.css";

import { h } from "../h.ts";
import type { ScenarioContext } from "../select/scenario.ts";

export interface ScenarioArtHandle {
  readonly el: HTMLElement;
  setScenario(scenario: ScenarioContext | null): void;
}

export function scenarioArt(): ScenarioArtHandle {
  let key: string | null = null;
  let enterTimer = 0;
  const image = h("img", { class: "scenario-art__image", attr: { alt: "", loading: "eager", decoding: "async" } });
  const title = h("figcaption", { class: "scenario-art__title" });
  const el = h("figure", { class: "scenario-art scenario-art--empty", attr: { "aria-hidden": "true" } }, image, title);

  return {
    el,
    setScenario(scenario) {
      if (scenario === null) {
        if (key === null) return;
        key = null;
        if (enterTimer) window.clearTimeout(enterTimer);
        enterTimer = 0;
        image.removeAttribute("src");
        title.textContent = "";
        el.className = "scenario-art scenario-art--empty";
        el.style.setProperty("--scenario-art-brightness", "1");
        el.style.setProperty("--scenario-art-visibility", "1");
        return;
      }
      el.style.setProperty("--scenario-art-brightness", (1 - scenario.fadeToBlack).toFixed(3));
      const visibility = 1 - scenario.fadeToBlack;
      el.style.setProperty("--scenario-art-visibility", visibility.toFixed(3));
      if (scenario.key !== key) {
        key = scenario.key;
        if (enterTimer) window.clearTimeout(enterTimer);
        enterTimer = 0;
        image.src = scenario.image;
        title.textContent = scenario.title;
        el.className = `scenario-art${scenario.predicted ? " scenario-art--predicted" : ""}`;
        if (visibility > 0) {
          el.classList.add("scenario-art--enter");
          enterTimer = window.setTimeout(() => {
            enterTimer = 0;
            el.classList.remove("scenario-art--enter");
          }, 180);
        }
      }
    },
  };
}
