/** Small entry-route parser. Routes seed an initial surface; they do not replace
 * the planner's persistent timeline with a screen router. */

export type EntryRoute = "predict" | null;

export function entryRoute(pathname: string): EntryRoute {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return path === "/predict" ? "predict" : null;
}
