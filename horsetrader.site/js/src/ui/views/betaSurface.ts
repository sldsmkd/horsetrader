/**
 * The beta surface — Unity's in-app isolation chamber (design.md §9). The cloud
 * save/load UI proves out here before graduating to the main menubar. Two buttons,
 * separated by concern:
 *
 *   [ Cloud ] — connect: opens a panel listing providers (Google for now). The
 *               richer connected-state flow (status, disconnect options) is
 *               deferred — for now it's a provider list plus a stopgap Sign out so
 *               the connect path is re-testable in the chamber.
 *   [ Sync ]  — the data action, and only that. Greyed until connected (and until
 *               there are local changes). Runs the real reconcile (`syncNow`): clean
 *               → fast-forward, dirty → conditional push, and a true conflict (both
 *               diverged) raises the Steam-style pick-a-side dialog. See
 *               unity/resolution.md.
 *
 * The app shell rebuilds this surface on every coordinator notify, and an async
 * action (sync/auth) can land *after* such a rebuild — so all transient state
 * (auth, last outcome, panel open) is module-scoped to survive the rebuild, and a
 * module-level `rerender()` always targets the *current* live surface (not the
 * closure that kicked the action off). `liveRoot`/`liveCoord` are that target.
 */

import "./betaSurface.css";

import { h } from "../h.ts";
import { fetchAuth, startGoogleSignIn, signOut } from "../../core/cloud/client.ts";
import type { AuthState } from "../../core/cloud/client.ts";
import { syncNow } from "../../core/cloud/sync.ts";
import { presentCloudConflict } from "./cloudConflict.ts";
import type { Coordinator } from "../../core/engine/index.ts";

// Module-scoped so it survives the app's rebuild-on-notify.
let auth: AuthState = { authenticated: false };
let panelOpen = false;
let lastSyncOutcome = "no sync yet";
// The currently-mounted surface + its coordinator. A rebuild replaces `liveRoot`;
// `rerender` rebuilds whatever is live now, so an async outcome lands on the
// on-screen surface even when a notify swapped it mid-flight.
let liveRoot: HTMLElement | null = null;
let liveCoord: Coordinator | null = null;

function planSummary(coord: Coordinator): Record<string, unknown> {
  const doc = coord.document();
  const { etag, dirty } = coord.syncMeta();
  return {
    etag,
    dirty,
    username: coord.username() || "(none)",
    commitments: Object.keys(doc.commitments ?? {}).length,
    favourites: Object.keys(doc.favourites ?? {}).length,
    snapshot: doc.snapshot ? `${doc.snapshot.date} (${doc.snapshot.resources["free_carats"] ?? "?"} carats)` : "none",
  };
}

function rerender(): void {
  if (liveRoot && liveCoord) liveRoot.replaceChildren(...build(liveCoord));
}

const button = (label: string, onClick: () => void): HTMLButtonElement =>
  h("button", { class: "beta-surface__btn", attr: { type: "button" }, on: { click: onClick } }, label);

export function betaSurface(coord: Coordinator): HTMLElement {
  const root = h("section", { class: "beta-surface" });
  liveRoot = root;
  liveCoord = coord;
  rerender();
  // Resolve the session in the background (no coordinator notify, so this must
  // re-render imperatively when it lands).
  void (async () => {
    auth = await fetchAuth();
    rerender();
  })();
  return root;
}

function build(coord: Coordinator): Node[] {
  const connected = auth.authenticated;

  const cloud = button("Cloud", () => {
    panelOpen = !panelOpen;
    rerender();
  });
  // Sync lights up only when connected AND there's something to send. The signal we
  // have client-side is `dirty` (local diverged since the last sync) — we can't know
  // the cloud advanced without a GET, so "no changes" means "no local changes".
  const dirty = coord.syncMeta().dirty;
  const sync = button("Sync", () => void doSync(coord));
  sync.disabled = !connected || !dirty;
  sync.title = !connected
    ? "Connect a cloud first"
    : !dirty
      ? "Nothing to sync — no local changes since the last sync"
      : "Sync your plan with the cloud";

  const children: Node[] = [
    h("h3", { class: "beta-surface__group" }, "Unity — cloud save"),
    h(
      "p",
      { class: "beta-surface__note" },
      "Cloud connects an account; Sync saves/loads your plan to it (disabled until connected). Naive resolution for now — pushes local edits, else pulls; conflicts just report.",
    ),
    h("div", { class: "beta-surface__row beta-surface__row--inline" }, sync, cloud),
  ];

  if (panelOpen) {
    const panel = h("div", { class: "beta-surface__panel" });
    if (connected) {
      panel.append(
        h("p", { class: "beta-surface__note" }, `Connected — ${auth.identity.provider}:${auth.identity.sub}`),
        // Disconnect flow is deferred; this is the chamber stopgap so connect is re-testable.
        button("Sign out", () => void doSignOut()),
      );
    } else {
      panel.append(
        h("p", { class: "beta-surface__note" }, "Pick a cloud to connect:"),
        button("Google", startGoogleSignIn),
      );
    }
    children.push(panel);
  }

  children.push(
    h("pre", { class: "beta-surface__status" }, `${lastSyncOutcome}\n\n${JSON.stringify(planSummary(coord), null, 2)}`),
  );
  return children;
}

async function doSync(coord: Coordinator): Promise<void> {
  lastSyncOutcome = "syncing…";
  rerender();
  // The real reconcile (resolution.md): clean → fast-forward, dirty → conditional
  // push, and a 412 (both diverged) → the pick-a-side conflict dialog.
  const result = await syncNow(coord);
  if (result.kind === "conflict") {
    lastSyncOutcome = "conflict — choose a version to keep";
    rerender();
    presentCloudConflict(coord, result.conflict, (outcome) => {
      lastSyncOutcome = `conflict resolved — ${outcome}`;
      rerender();
    });
    return;
  }
  lastSyncOutcome = `sync → ${JSON.stringify(result)}`;
  rerender();
}

async function doSignOut(): Promise<void> {
  await signOut();
  auth = { authenticated: false };
  rerender();
}
