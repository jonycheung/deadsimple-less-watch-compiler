# AI Guardrails

Working agreement for AI-assisted changes in this repo. Read before opening a
PR or touching the public surface (CLI flags, `src/index.ts`, `package.json`).

## 1. PR chunking

- One logical change per PR: a dependency bump, a bug fix, a new option, a
  refactor, or a docs/CI update — don't mix categories in one diff.
- Dependabot/Renovate PRs stay auto-generated and single-purpose (bump +
  lockfile only). If a bump breaks the build, fix or revert it in its own
  follow-up PR (see #226) rather than folding a fix into the bump PR.
- Never include a `chore: release vX.Y.Z` commit in a feature/fix PR — that
  commit is produced only by the `Create Release Tag` workflow (see below).
- If a feature touches all of: a `src/lib/*` helper, the CLI flag in
  `less-watch-compiler.ts`, the programmatic option in `index.ts`, and the
  README, that's still one PR as long as the whole diff is reviewable in one
  sitting. Split it only when it's genuinely large (rule of thumb: a few
  hundred lines excluding lockfiles/generated files) — e.g. land the internal
  helper with tests first, then wire it into the CLI/API in a second PR.
- Reference the issue number the PR addresses; describe *why*, not just what.

## 2. Release increments (semver)

- Version bumps are a manual, human-triggered `workflow_dispatch`
  (`create-release-tag.yml`, choice of patch/minor/major). Never trigger it
  and never hand-edit the `version` field in `package.json` — that field is
  only ever written by that workflow.
- Commit using the conventional-commit format this repo enforces via
  commitizen (`yarn commit`), and recommend a bump level in the PR
  description so the human picking the workflow input has a basis for it:
  - **patch** — bug fixes, dependency bumps, chores, docs, refactors with no
    externally visible effect.
  - **minor** — a new CLI flag, a new field on `CompileOptions`/
    `WatchOptions`, or any other backward-compatible, additive capability.
  - **major** — removing or renaming a CLI flag or exported symbol, changing
    a default's behavior, dropping Node engine support, or changing output
    file paths/formats.
- CI (`ci.yml`: lint, format check, typecheck, build, coverage) must pass
  before merge. Don't lower the coverage thresholds in `package.json`
  (statements 93 / branches 80 / functions 85 / lines 93) to make a change
  fit — add tests instead.

## 3. API design

This package has two parallel public surfaces that must move together: the
CLI (`less-watch-compiler.ts`, via commander) and the programmatic API
(`src/index.ts`: `compileFile`, `watch`, `CompileOptions`, `WatchOptions`,
`WatchListeners`). A new capability isn't done until it exists in both,
documented in the README.

- Every new option is **optional** with a default that preserves current
  behavior. That's what keeps additions a minor bump instead of a major one.
- Use an options object for anything beyond the required path arguments —
  follow the existing `compileFile(inputFilePath, outputFolder, options)` /
  `watch(watchFolder, outputFolder, options, listeners)` shape rather than
  adding positional parameters.
- Give every exported option field a one-line JSDoc comment stating its
  default and purpose, matching the style already in `index.ts`.
- Don't remove or repurpose an existing exported symbol or interface field.
  Mark it `@deprecated` first and remove it only in a major-bump PR.
- `index.ts` documents that the underlying compiler keeps configuration in
  module-level state, so concurrent compile/watch sessions with different
  configs aren't supported. Don't add new hidden singleton state without
  updating that comment, and don't quietly make it concurrency-safe without
  updating the docstring and adding tests for it.
