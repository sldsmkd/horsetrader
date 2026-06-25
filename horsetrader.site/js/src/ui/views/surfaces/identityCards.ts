import { surface } from "./surface.ts";
import { oshiSelector } from "./oshiSelector.ts";
import { clubSelector } from "./clubSelector.ts";
import type { IdentityController } from "../../identity/controller.ts";

export function buildOshiSelector(
  identity: IdentityController,
  on: { onClose: () => void },
): HTMLElement {
  const selectedOshi = identity.currentOshi();
  return surface({
    title: "Oshi Selector",
    placement: "center",
    headerless: true,
    body: oshiSelector({
      selectedId: selectedOshi.id,
      selected: selectedOshi,
      search: identity.oshiSearch(),
      costumes: identity.oshiCostumes(),
      onCommit: (oshi) => identity.setOshiId(oshi.id),
      onClose: on.onClose,
    }),
    onClose: on.onClose,
  });
}

export function buildClubSelector(
  identity: IdentityController,
  on: { onClose: () => void },
): HTMLElement {
  return surface({
    title: "Club",
    placement: "center",
    headerless: true,
    body: clubSelector({
      club: identity.club(),
      onCommit: (club) => identity.setClub(club.name, club.rank),
      onLeave: () => identity.leaveClub(),
      onClose: on.onClose,
    }),
    onClose: on.onClose,
  });
}
