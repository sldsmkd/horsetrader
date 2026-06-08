/**
 * Manages aria-pressed + a CSS modifier class across a keyed set of elements,
 * ensuring at most one is pressed at a time.
 *
 * Returns a `select(key)` function. Call it on click or on external state
 * changes. Pass null to deselect all.
 */
export function pressedGroup<K extends string>(
  items: ReadonlyMap<K, HTMLElement>,
  activeClass: string,
): (key: K | null) => void {
  return (key) => {
    for (const [k, el] of items) {
      const on = k === key;
      el.setAttribute("aria-pressed", String(on));
      el.classList.toggle(activeClass, on);
    }
  };
}
