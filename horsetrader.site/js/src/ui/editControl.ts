const EDIT_CONTROL = "ht-type-edit-control";

/** Bind editing-only browser assistance to the shared edit-control class.
 * Delegation covers controls mounted and replaced after app startup. */
export function installEditControlBehavior(root: Document = document): void {
  root.addEventListener("focusin", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.classList.contains(EDIT_CONTROL)) {
      target.spellcheck = true;
    }
  });
  root.addEventListener("focusout", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.classList.contains(EDIT_CONTROL)) {
      target.spellcheck = false;
    }
  });
}
