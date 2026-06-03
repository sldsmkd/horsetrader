---
name: feedback-explicit-contracts
description: Concrete subclasses must declare overrides for abstract base methods even when they just call super() — never suggest removing a trivial-looking override.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c8672395-89f0-4fc9-8db5-957fe790bb0a
---

Concrete subclasses of an abstract base **always declare the override explicitly**, even if the body is `return super().search(query)`. Never flag these as no-op / dead code or suggest removing them.

**Why:** Per [docs/standards.md](docs/standards.md) "Explicit contracts" section — the redundancy is the point. It forces the author to acknowledge the contract for each concrete type, and search-by-grep finds every override. See also `Stories.search`, `Characters.search`, `Trainees.search`, `Supports.search` — all present, all trivial, all intentional.

**How to apply:** In review/cleanup, treat a one-line `return super().X(...)` override as load-bearing. If anything, add it where missing (e.g. a new concrete `Events` subclass without it would be the defect, not the other way round). Same convention applies to other `@abstractmethod` hooks across the codebase, not just `search`.

Related: [[project-docs-pointer]] — standards.md is one of the docs to consult before flagging style.
