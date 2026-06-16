"""Shuttle's JP→EN projection service.

`Translate` is the first entry in the conventional `services/` namespace
(see ``semantics/overview.md``). It owns the JP↔EN seam at the *use-case* level:
given a Japanese string, project its English form mechanically.

`Translate` is a **facade** — the per-surface projection logic lives in sibling
modules (`_missions` for mission titles, `_races` for race names) so the facade
stays thin as coverage grows. Each method is a pure projection:

- `mission` halts the run when a title can't be translated. Mission coverage is
  believed complete (a scratch benchmark against six years of Gametora's own EN
  pages resolves every JP title mechanically), so a miss is a defect, not a gap.
- `race` returns the name unchanged when nothing resolves — many NAR/local races
  legitimately have no EN yet, so the JP-only fall-through is the gap signal.

The model imports the surface modules need (`Races`) are deferred to their call
sites: the mission-build path is the intended caller, so a module-level model
import would close a ``models → services → models`` cycle, and instantiating
`Races` kicks off a Gametora scrape we only want on first real call.
"""

from horsetrader.core import Japlish
from horsetrader.semantics import shuttle

from . import _missions, _races


@shuttle
class Translate:
    def mission(self, title: Japlish) -> Japlish:
        """Project a mission title to canonical EN (halts on an untranslatable
        title — see module docstring)."""
        out = Japlish(title.jp, encoding="jp")
        out.en = _missions.translate(title.jp)
        return out

    def race(self, name: Japlish) -> Japlish:
        """Project a bare race name to its EN form, or return it unchanged when
        nothing resolves (the gap signal stays)."""
        en = _races.resolve_en(name.jp)
        if en is None:
            return name
        out = Japlish(name.jp, encoding="jp")
        out.en = en
        return out
