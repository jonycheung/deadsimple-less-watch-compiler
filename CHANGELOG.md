# Changelog

Auto-generated from commit history by the release-tag workflow.
Contains releases from v1.16.0 onward.

## v1.19.9 - 2026-08-08

### Features

- harden watch startup error handling
- automate release notes and changelog publication

### Fixes

- resolve CI format check failure in test (24)
- forward runtime watcher walk errors
- fail with a message when the watch folder is unusable
- ignore the ../ prefix when matching an external @import
- fail with a message when the watch folder is unusable
- make release retry-safe and backfill changelog
- match exclude against the path relative to watchFolder

### Documentation

- change MIT badge color from yellow to blue

### Chores

- format changelog automation artifacts

### Other

- Potential fix for pull request finding 'CodeQL / Shell command built from environment values'
- Potential fix for pull request finding 'CodeQL / Shell command built from environment values'
- Potential fix for pull request finding
- Potential fix for pull request finding
- Potential fix for pull request finding

## v1.19.8 - 2026-08-08

### Fixes

- propagate systemic failures instead of skipping them as bad entries
- detect cycles by ancestor, not by every directory already seen
- don't dedup directories when the filesystem reports no inode
- rediscover a recreated hidden _partial.less in the directory rescan
- don't abort the whole walk when one entry deeper in the tree fails
- stop descending into symlink loops during the directory walk
- re-watch a .less file that is deleted and then recreated
- correct partial-import plugin sync mode, ordering, and error reporting
- make Less itself resolve _partial imports and ignore commented @imports
- match full @import options grammar and resolve _partial imports (#240)

### Tests

- pin that an unreadable directory stays watchable
- pin transitive tracking through a recreated middle partial

### Chores

- release v1.19.8
- bump fast-uri from 3.1.4 to 3.1.5

### Other

- Update dependency typescript-eslint to v8.66.0
- Update dependency mocha to v11.8.0

## v1.19.7 - 2026-07-29

### Chores

- release v1.19.7
- bump fast-uri from 3.1.3 to 3.1.4
- bump js-yaml from 4.2.0 to 4.3.0

### Other

- Update dependency less to v4.8.1
- Update dependency eslint to v10.8.0
- style: format CLAUDE.md with Prettier
- Add AI guardrails for PR chunking, releases, and API design
- Update dependency less to v4.8.0
- Update dependency prettier to v3.9.6
- Update dependency typescript-eslint to v8.65.0
- Update dependency source-map to ^0.8.0

## v1.19.6 - 2026-07-19

### Chores

- release v1.19.6

### Other

- Fix release workflow: set NODE_AUTH_TOKEN so npm/yarn config resolves (#229)

## v1.19.5 - 2026-07-19

### Chores

- release v1.19.5
- bump fast-uri from 3.1.0 to 3.1.3 (#224)
- update dependency source-map to ^0.7.0 (#221)
- update dependency @types/node to v24 (#182)

### Other

- Update dependency commander to v15 (#227)
- Update dependency less to v4.7.0
- Revert less v4.6.7, typescript v7, and commander v15 bumps (#226)
- Update dependency commander to v15 (#201)
- Update dependency typescript to v7 (#202)
- Update dependency less to v4.6.7 (#193)
- Update dependency glob to v13 (#223)
- Update actions/setup-node action to v7 (#196)
- Update actions/checkout action to v7 (#194)
- Update dependency cliui to v9 (#183)
- Update dependency glob to v10.5.0 [SECURITY] (#180)

## v1.19.4 - 2026-07-18

### Fixes

- don't exit(1) mid-write when one --run-once compile fails

### Chores

- release v1.19.4

### Other

- Add --minified CLI flag (issue #46)
- Address review: include banner in cache fingerprint, escape */ in custom text
- Add --banner flag to prepend a "generated file, do not edit" comment (#82)
- Use execFileSync instead of a shell string in the #213 regression test

## v1.19.3 - 2026-07-18

### Chores

- release v1.19.3

### Other

- Address review: scope @import chase to allowed extensions, avoid O(n^2) BFS
- Recompile every transitive @import ancestor, not just the direct one (#59)

## v1.19.2 - 2026-07-18

### Fixes

- detect new directories created after startup
- ignore a stale removal-debounce timer superseded by a later delete+recreate
- debounce a transient missing-file poll before unwatching
- create the --cache-path parent directory before writing the cache file

### Chores

- release v1.19.2

### Other

- Reject --exclude patterns with catastrophic backtracking potential
- Always exclude node_modules and .git by default
- Apply exclude to @import targets, not just directory rescans
- Add --exclude regex flag to skip whole subtrees from watch/compile (#72)

## v1.19.1 - 2026-07-18

### Features

- add opt-in --cache for incremental --run-once compilation (issue: CI performance)

### Fixes

- address review findings on the incremental compile cache
- address review findings on the external @import directory watch
- watch the containing directory of an @import outside watchFolder

### Documentation

- caveat the --cache dependency-detection gaps, track fix separately

### Chores

- release v1.19.1
- fix markdown formatting (prettier)

## v1.19.0 - 2026-07-18

### Features

- programmatic API, --init scaffolding, and Node 20/22 CI matrix

### Fixes

- do not report a never-existing @import target as 'removed'
- dead onRemove notification path; close core watch-engine test gaps
- watch() validates mainFile exists before watching, matching the CLI

### Documentation

- add standalone-LESS-tool competitive comparison table
- announce v1.18 changes and market position in README

### Tests

- cover the new API surface (makeWatchHandler, watch(), shared CLI logging)

### Chores

- release v1.19.0
- reconcile coverage thresholds after merging master (post-#208)

### Other

- style: fix prettier formatting in test/api.js

## v1.18.1 - 2026-07-18

### Features

- compile LESS in-process via the less API, dropping the global lessc requirement

### Fixes

- correct lessArgs edge cases and a formatted-error off-by-one
- format lessOptions test to satisfy CI format check
- add prepare script so dist/ rebuilds on install, not just npm publish

### Chores

- release v1.18.1
- stop tracking build artifacts (dist/, coverage/)

### Other

- Updated

## v1.18.0 - 2026-07-17

### Chores

- release v1.18.0

## v1.17.9 - 2026-07-17

### Chores

- release v1.17.9

### Other

- Update release.yml

## v1.17.8 - 2026-07-17

### Fixes

- finalize walk after scheduling directory recursion
- deterministic main-file check, drop redundant option copy loop
- restore subfolder compilation and add characterization test suite

### Tests

- prevent duplicate done in watchTree callback test

### CI

- switch npm release workflow to trusted publishing
- add lint, format, typecheck, and coverage quality gates

### Chores

- release v1.17.8
- release v1.17.7
- release v1.17.6
- remove vestigial Netlify and Jekyll config
- remove dead code and unused dependencies

### Other

- Update release workflow for npm trusted publishing
- Potential fix for pull request finding
- Potential fix for pull request finding
- Update dependency mocha to v11.7.6
- Revert "Handle extensionless imports in filesearch (fix #117)"
- Handle extensionless imports in filesearch (fix #117)
- Switch badges to GitHub Actions and add npm/license/downloads

## v1.17.5 - 2025-12-10

### Fixes

- broaden import parsing and modernize fs usage
- honor ignoreDotFiles in walk
- stabilize ts build and tests

### CI

- install dependencies fresh
- reinstall deps in ci
- switch to cimg node image
- use node 18 in circleci

### Chores

- release v1.17.5
- release v1.17.0
- release v1.17.6
- release v1.17.5
- release v1.17.4
- pin deps for node16 ci
- ensure ansi deps installed for tests
- pin ansi deps for mocha/yargs cjs
- pin glob for node16 ci
- relax engine requirement for ci
- set netlify build image
- update node.js to v16.9.1
- update node.js to v16.9.0
- update dependency mocha to v9.1.1

### Other

- Update package version
- Revert to previous minor
- Revert to previous version
- Ensure npm auth config before publish
- Remove broken batches
- Update badges
- Bump to next version
- Use deploy key secret for release tag pushes
- Fix release-tag workflow token handling
- Revert "chore: release v1.17.5"
- Use PAT to push tags so release workflow triggers
- Switch to GitHub Actions for CI and tag-based release
- Run tests on all commits; release only on tags
- Add admin-gated GitHub Action to create release tags
- Make releases tag-driven without context
- Release 1.17.3
- Release 1.17.2
- Configure SSH key for release push and set base version 1.17.1
- Bump version to 1.18.0 to skip unpublished 1.17.0
- Add separate approval paths for patch/minor/major releases
- Always schedule approval-gated release workflow
- Trust github.com host key before pushing releases
- Make release approvals optional via pipeline params
- Add CircleCI approval-gated release workflow
- Add filesearch import coverage and use local lessc
- deps: update mocha to resolve ansi deps
- deps: resolve strip-ansi correctly
- deps: add strip-ansi runtime
- deps: refresh lock to install string-width
- deps: include string-width runtime
- Update node version
- Update src/lib/filesearch.ts
- Update src/lib/filesearch.ts
- Update src/less-watch-compiler.ts
- Update src/less-watch-compiler.ts
- Update src/less-watch-compiler.ts
- Update config.yml
- Update config.yml
- Allow compiling hidden files when includeHidden flag set
- Update README.md

## v1.16.3 - 2021-09-19

### Tests

- update tests
- moved test location and updated test command

### Chores

- remove opencollective-postinstall from CLI
- update node.js to v16.6.1
- update dependency mocha to v9.0.3
- pin dependency @types/commander to 2.12.2
- pin dependency babel-cli to 6.26.0
- update node.js to v16.4.2
- update node.js to v16.4.1
- update dependency mocha to v9.0.2
- update node.js to v16
- update node.js to v15.14.0

### Other

- 1.16.3
- check-in missing tests files
- Update cli tests
- Update cli tests

## v1.16.2 - 2021-07-07

### Fixes

- update dependency commander to v8

### Chores

- update dependency mocha to v9

### Other

- 1.16.2
- 1.16.1
- Update README.md
- Update README.md
- Remove Travis

## v1.16.1 - 2021-07-07

### Fixes

- update dependency commander to v8

### Chores

- update dependency mocha to v9

### Other

- 1.16.1
- Remove Travis

## v1.16.0 - 2021-06-30

### Features

- don't compile hidden files
- if we've set `--include-hidden`, don't ignore dotfiles
- allow inputting file paths not just filenames

### Fixes

- use Object.assign not spread for babel compatibility
- set command-line options in `config`

### Refactors

- factor out isHiddenFile()

### Tests

- add basic cli tests using --include-hidden
- explicitly test files beginning with a dot

### Other

- 1.16.0
- Revert package.json
- Add .circleci/config.yml for CircleCI (#142)
- 1.16.1
- 1.16.0
- Combine CLI tests
- Update .gitignore
- Update less-watch-compiler.js
- Add --include-hidden flag
- Add --include-hidden flag
