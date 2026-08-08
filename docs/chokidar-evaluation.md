# Evaluation: migrating the watcher to chokidar

Tracks issue [#242](https://github.com/jonycheung/deadsimple-less-watch-compiler/issues/242),
which asks us to _evaluate_ replacing the hand-rolled watcher in
`src/lib/lessWatchCompilerUtils.ts` with [chokidar](https://github.com/paulmillr/chokidar).
This document is that evaluation. It is not a migration — no source files
change in this PR.

## Bottom line

**Worth doing, but not as a drop-in swap, and not right now as a single PR.**
The current watcher is small, well-tested, and its idiosyncrasies are almost
all deliberate fixes for filed bugs (see the table below) — not incidental
complexity chokidar happens to clean up. A wholesale rewrite risks
regressing several of those specific issues silently, and current chokidar
(v5, see below) is ESM-only, which is a real integration cost for this
CommonJS package, not just a dependency bump.

The recommended path is a **staged, opt-in migration**:

1. **Stage 1 (this issue's natural follow-up):** land chokidar-backed
   watching behind an experimental, undocumented-by-default flag (e.g.
   `--experimental-watcher` / `CompileOptions.experimentalWatcher`), with the
   hand-rolled watcher remaining the default. Scope: swap only `setupWatcher`
   - the low-level `fs.watchFile` polling loop for a chokidar instance; keep
     `walk`, `fileWatcher`, `watchExternalImportDir`, and `makeWatchHandler`'s
     import-graph logic unchanged — chokidar just becomes a new event source
     feeding the same `WatchCallback` shape. This bounds the diff to roughly
     one file and is reviewable in one sitting, per this repo's PR-chunking
     rule.
2. **Stage 2:** once Stage 1 has shipped in a release and gotten real-world
   use, add regression tests reproducing each edge case in the table below
   against the chokidar code path specifically (not just against the
   existing suite, which was written against the current watcher's
   behavior and may not exercise the same code paths under chokidar).
3. **Stage 3 (major-version bump):** if Stage 1/2 hold up, flip the default
   to chokidar and deprecate the flag. This is a major bump only because
   dropping the old watcher path outright, or changing its default
   behavior, is a user-visible change per this repo's semver rules — keeping
   both paths available a while longer is itself an option if regressions
   surface late.

Each stage fits standalone within this repo's normal PR size and semver
guidance; nothing here proposes doing the rewrite in one shot.

## What the current watcher actually does

`src/lib/lessWatchCompilerUtils.ts` (~710 lines) is not just "an old watch
library vendored in" — most of its logic exists because of specific,
citable bugs. Grepping the file for `issue #` surfaces at least seven:

| Behavior                                                         | Where                                                         | Issue | What breaks without it                                                                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Debounced delete-vs-recreate detection                           | `setupWatcher`'s `nlink === 0` branch                         | #197  | Editors that save via delete+recreate (instead of atomic rename) caused files to be silently, permanently unwatched after every save.                             |
| Transitive `@import` recompile (BFS over a reverse import index) | `makeWatchHandler`                                            | #59   | Editing a file imported N levels deep (e.g. `homepage.less → theme.less → colors.less`) only recompiled the direct importer, not the whole chain.                 |
| `exclude` pattern applies to directories, not just files         | `walk`, `setupWatcher`'s readdir-rescan branch, `fileWatcher` | #72   | `--exclude node_modules` had to be spelled out by hand and a reappearing `node_modules` (e.g. after reinstall) would silently start being watched again.          |
| New-directory recursive discovery on create                      | `setupWatcher`'s directory branch calling `walk`              | #73   | A directory created together with files already inside it (scaffolds, editor batch ops) would miss those files entirely.                                          |
| Opt-in output banner, off by default                             | `LessWatchCompilerConfig.banner`                              | #82   | Not watcher logic per se, but documents the general "changes must be opt-in" discipline this codebase applies everywhere, watcher included.                       |
| Watching `@import` targets that live _outside_ `watchFolder`     | `watchExternalImportDir`                                      | #209  | An external import target, once deleted and recreated, had nothing watching its containing directory to notice the recreate — it stayed unwatched forever.        |
| Non-blocking compile-error exit under `--run-once`               | `compileCSS`'s `.catch`                                       | #213  | `process.exit(1)` mid-batch killed other in-flight `renderLess()` calls, leaving truncated `.css`/`.map` files for files that would otherwise have compiled fine. |

None of these are watcher-library trivia — they're the accumulated fix
history of a tool that has been in production since well before chokidar
was the default choice it is today. A migration has to either prove
chokidar handles each of these out of the box, or re-implement the
handling on top of it. Below is that accounting.

## chokidar: current API and behavior

Verified against the live chokidar `master` README and npm registry at the
time of writing (2026-07-30) rather than solely from training-data
knowledge, since a library's current major version and defaults are exactly
the kind of thing that goes stale:

- **Current major version: 5.0.0.** Confirmed via `npm view chokidar` /
  the npm registry — `"type": "module"`, i.e. **chokidar 5 is ESM-only.**
  It also declares `"engines": { "node": ">=20.19.0" }`.
- **Dependency footprint dropped sharply after v3.** v3.x pulled in glob
  matching and around a dozen transitive dependencies; v4 removed built-in
  glob support and cut that down to a single dependency (`readdirp`); v5
  keeps the single-dependency shape. This part is corroborated by the
  chokidar project's own v4 release notes, which I'm confident about; the
  precise dependency _count_ for older minor versions is from training
  knowledge and not independently re-verified line by line here.
- **`usePolling`** (default `false`) selects `fs.watchFile`-style polling
  instead of native `fs.watch`/FSEvents/inotify; **`interval`** (default
  100ms, distinct from `binaryInterval`) controls polling frequency when
  `usePolling` is on.
- **`awaitWriteFinish`** (default off) can hold `add`/`change` events until
  a file's size stops changing for `stabilityThreshold` ms — this is
  chokidar's built-in answer to partial-write/atomic-save noise, though its
  design target is large files written in chunks, not specifically the
  delete+recreate pattern issue #197 fixes.
- **`atomic`** (default `true` on most platforms) coalesces an
  unlink-then-add happening within a short window (historically ~100ms,
  configurable) into a single `change` event — this is the option closest
  in spirit to #197, though its window is much shorter than the
  `max(interval, 300)` debounce this codebase uses today, and I have not
  verified whether its detection window is user-tunable to the same effect
  across all chokidar 5 platforms/backends.
- **`ignored`** accepts a function, regex, or glob-like path list for
  exclusion, roughly analogous to today's `exclude` option — but chokidar's
  matching semantics (anymatch-based in earlier versions; simplified in
  v4+) are not identical to this repo's single compiled `RegExp` tested with
  `safeRegex2`, so `resolveExcludePattern`'s catastrophic-backtracking guard
  and defaults would need to be re-derived against whatever `ignored`
  actually does in v5, not assumed compatible.
- **`followSymlinks`** (default `true`) is chokidar's dedicated symlink
  option — genuinely something the current hand-rolled walker does not
  address explicitly (issue #242's own premise, "better symlink handling,"
  is plausible here), though this repo has no open issue describing a
  concrete symlink failure to compare against, so the claimed improvement
  is currently more theoretical than #59/#72/#73/#197/#209/#213 were before
  their fixes landed.
- Native backends (`fs.watch`/FSEvents/inotify) are event-driven rather
  than polling, which is the headline reliability/perf claim in the issue
  — fewer missed events on large trees, lower CPU than polling every file
  individually the way `fs.watchFile` does per-path today.

**Caveat on version currency:** because chokidar has moved fast (v3 → v4 →
v5 each changed dependency shape and, with v5, module format), any future
implementation PR should re-run this registry check rather than trust the
version numbers in this document — they reflect chokidar's state as of
2026-07-30 and are exactly the sort of detail that dates quickly.

## Edge-case-by-edge-case assessment

| Edge case                                                    | chokidar native?      | Assessment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #197 delete-vs-recreate debounce                             | Partial               | `atomic: true` covers the common case but with a shorter, less-documented-as-tunable window than this repo's `max(interval, 300)`. Needs verification against real editor save patterns before trusting it to fully replace the current debounce, not just assumed equivalent.                                                                                                                                                                                                                                                    |
| #59 transitive `@import` recompile                           | No                    | Out of scope for any file watcher — this is `makeWatchHandler`'s import-graph BFS, unrelated to which library emits the underlying `change` event. Carries over unchanged in any migration.                                                                                                                                                                                                                                                                                                                                       |
| #72 exclude applies to dirs, unconditional node_modules/.git | Mostly                | `ignored` covers this in spirit; the `safeRegex2`-guarded custom-pattern-plus-default-union behavior is bespoke and would need to be reimplemented on top of `ignored`, not dropped.                                                                                                                                                                                                                                                                                                                                              |
| #73 new-directory recursive discovery                        | Yes (native backends) | This is exactly what native `fs.watch`/inotify are good at — a likely genuine improvement over the current manual `readdir` rescan.                                                                                                                                                                                                                                                                                                                                                                                               |
| #82 opt-in banner                                            | N/A                   | Unrelated to the watcher; not affected either way.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| #209 external import-dir watching                            | No                    | Bespoke to this project's import-graph model (watch a directory outside `watchFolder` because something inside `watchFolder` imports a file in it). Chokidar can watch arbitrary paths, but the "notice when _this specific_ external file comes back after being deleted" logic (`watchExternalImportDir`) has to be re-implemented on top of it, not replaced by it.                                                                                                                                                            |
| #213 non-blocking `--run-once` exit                          | N/A                   | Unrelated to the watcher; not affected either way.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Symlink handling (issue #242's own claim)                    | Yes, if wanted        | `followSymlinks` is real chokidar functionality with no equivalent today — a genuine, currently-absent capability, not just a reliability fix.                                                                                                                                                                                                                                                                                                                                                                                    |
| EMFILE / listener-limit handling                             | Unclear               | Native `fs.watch` backends still need one file-descriptor/watch-handle per watched entry; chokidar doesn't eliminate the constraint, it can only fail more gracefully or expose configuration for it. This repo's current design (one `fs.watchFile` call per file, no OS-level watch-descriptor limit since polling doesn't consume inotify watches) sidesteps EMFILE by construction — switching to native events on very large trees could _reintroduce_ it as a new failure mode that has to be verified, not assumed solved. |

Net: of the seven cited issues, roughly two (#73, arguably #197) are things
chokidar plausibly does better out of the box; the rest are import-graph or
project-specific logic that sits on top of whichever watcher is
underneath, and would need to be carried over regardless of what emits the
raw file events.

## Practical tradeoffs

- **New runtime dependency.** Currently zero watch-library dependencies —
  `fs.watchFile` is Node built-in. chokidar 5 adds one direct dependency
  (`readdirp`) plus chokidar itself. This is a small footprint by chokidar's
  historical standards (v3 pulled in far more), but it is still a new
  supply-chain surface and a new thing to keep patched, where today there
  is none.
- **ESM-only is the sharpest practical blocker.** This repo is CommonJS
  end to end (`"module": "CommonJS"` in `tsconfig.json`, `export =` module
  syntax, `require('less')`). chokidar 5 ships `"type": "module"` with no
  CJS entry point. Consuming it from this codebase means either a dynamic
  `import()` inside otherwise-synchronous CJS code (workable, but a real
  shape change to `setupWatcher`'s call sites) or pinning to an older
  chokidar major that still shipped CJS — trading "latest chokidar" for
  "chokidar 4.x or earlier," which changes the dependency/version-currency
  argument in the issue's own favor calculus. This needs an explicit
  decision, not a silent `^5.0.0` in `package.json`.
- **Node engine compatibility is fine either way.** This repo requires
  `engines: ">=22.12.0"`; chokidar 5 requires `>=20.19.0`. No conflict.
- **Polling vs `interval` semantics differ, not just in name.** Today,
  `WalkOptions.interval` (default 200ms, wired through
  `less-watch-compiler.ts` and `src/index.ts`) is passed straight to
  `fs.watchFile`'s own `interval` option — this project polls every
  watched file unconditionally, there is no native-events code path today.
  chokidar defaults to native events (`usePolling: false`) and only polls
  when explicitly told to (or when it detects it needs to, e.g. certain
  network filesystems); its own polling `interval` default is 100ms, not
  200ms. Preserving today's `--interval`/`interval` option's meaning across
  a migration means deciding whether it should keep forcing
  `usePolling: true` (matching current behavior/performance exactly, but
  forfeiting the native-events reliability win that's the whole point of
  this issue) or gets redefined to mean something else under native events
  (a user-visible behavior change, which per this repo's semver rules pushes
  any such redefinition into a major bump, not a drop-in swap).
- **Maintenance burden cuts both ways.** chokidar is actively maintained by
  paulmillr with wide industry adoption (it's the underlying watcher in
  Vite, webpack's `chokidar`-based watchers historically, VS Code, and
  others), which is a real reliability signal. Against that: this project's
  current watcher is fully self-contained and every one of its edge cases
  is already understood and tested in-house; a migration trades "we
  understand 100% of our watcher's behavior" for "we understand our
  integration code, and trust an upstream dependency for the rest,"
  which is a reasonable trade but not a free one.

## Recommendation, restated

Move forward, but only as the staged plan above — Stage 1 (opt-in flag,
narrow diff, hand-rolled watcher stays default) is the concrete next PR
this evaluation recommends, not a full replacement. Given the ESM-only
status of current chokidar and the several bespoke behaviors (#59, #72,
#209, and the import-graph logic in general) that don't go away regardless
of watch backend, this is a multi-PR effort spread across at least one
future minor release (the opt-in flag) and a later major release (flipping
the default), consistent with this repo's PR-chunking and semver rules —
not something to attempt in one pass.
