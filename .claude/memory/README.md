# Agent memory — lives HERE, in the repo

This is the source of truth for Claude's persistent memory for this project.
It lives **in the repo but stays local** — `.claude/` (and `.copilot/`) are
gitignored, so these notes are not pushed to GitHub; they're knowledge *about
this repo* kept on the user's machine.

## How it's wired

- The harness auto-memory path — `~/.claude/projects/-home-kris-code-horsetrader/memory`
  — is a **symlink to this directory**. Reads and writes through either path hit
  the same files, so there is no "wrong path" to write to.
- `MEMORY.md` is the index loaded into context each session: one line per memory.
- Each `*.md` is one fact with frontmatter (`name`, `description`, `metadata.type`
  of `user`/`feedback`/`project`/`reference`). Bodies link with `[[name]]`.

## Handoff to another tool (e.g. Copilot when tokens run out)

Point it at this directory: "here's what Claude knew about this repo." Start with
`MEMORY.md` (the index), then the individual files.
