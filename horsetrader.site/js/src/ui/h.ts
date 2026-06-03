/**
 * h() — the typed element helper every view builds on. The single home for DOM
 * creation, so views read as data (nested calls mirroring the tree) instead of
 * imperative node-by-node mutation, and the `createElement` / `querySelector`
 * typing friction lives in exactly one place.
 *
 * Contract:
 *   - `h(tag, attrs?, ...children)` returns the precisely-typed element for
 *     `tag` — `h("a", …)` is an `HTMLAnchorElement`, no cast at the call site.
 *   - `attrs` is optional: a second argument that is a string / number / Node is
 *     treated as the first child, so `h("span", "hi")` needs no empty `{}`.
 *   - children append in order; `null` / `undefined` / `false` are skipped (so
 *     `cond && h(...)` inlines cleanly), strings and numbers become text nodes.
 *   - **No `innerHTML`.** There is deliberately no string-HTML channel
 *     (conventions.md) — structure is always real nodes.
 *
 * Deliberately tiny. Add a field to `Attrs` when a real need appears (the
 * "complexity only when warranted" rule), never in anticipation.
 */

export interface Attrs {
  /** Set as `className` — the one styling hook common enough to be first-class. */
  class?: string;
  /** Typed event listeners, keyed by DOM event name. */
  on?: Partial<{ [E in keyof HTMLElementEventMap]: (ev: HTMLElementEventMap[E]) => void }>;
  /** Verbatim attributes — the escape hatch for `aria-*`, `role`, `data-*`, …. */
  attr?: Record<string, string | number | boolean>;
}

type Child = Node | string | number | false | null | undefined;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, ...children: Child[]): HTMLElementTagNameMap[K];
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs, ...children: Child[]): HTMLElementTagNameMap[K];
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrsOrChild?: Attrs | Child,
  ...rest: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const children = isAttrs(attrsOrChild) ? (apply(el, attrsOrChild), rest) : [attrsOrChild, ...rest];
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === "number" ? String(child) : child);
  }
  return el;
}

/**
 * Typed `querySelector` that throws if nothing matches. A missing element is a
 * wiring bug surfaced in dev, not a runtime condition every caller must guard —
 * so the return type stays non-null and call sites read clean.
 */
export function qs<E extends Element = HTMLElement>(selector: string, root: ParentNode = document): E {
  const el = root.querySelector<E>(selector);
  if (!el) throw new Error(`qs: no element matches ${selector}`);
  return el;
}

/** A non-null, non-Node object in the attrs slot is `Attrs`; everything else is a child. */
function isAttrs(value: Attrs | Child): value is Attrs {
  return typeof value === "object" && value !== null && !(value instanceof Node);
}

function apply(el: HTMLElement, attrs: Attrs): void {
  if (attrs.class !== undefined) el.className = attrs.class;
  if (attrs.on) {
    for (const [name, handler] of Object.entries(attrs.on)) {
      el.addEventListener(name, handler as EventListener);
    }
  }
  if (attrs.attr) {
    for (const [name, value] of Object.entries(attrs.attr)) {
      el.setAttribute(name, String(value));
    }
  }
}
