[![CI](https://github.com/jonycheung/deadsimple-less-watch-compiler/actions/workflows/ci.yml/badge.svg)](https://github.com/jonycheung/deadsimple-less-watch-compiler/actions/workflows/ci.yml)
[![Release](https://github.com/jonycheung/deadsimple-less-watch-compiler/actions/workflows/release.yml/badge.svg)](https://github.com/jonycheung/deadsimple-less-watch-compiler/actions/workflows/release.yml)
[![npm version](https://badge.fury.io/js/less-watch-compiler.svg)](https://badge.fury.io/js/less-watch-compiler)
[![npm downloads](https://img.shields.io/npm/dm/less-watch-compiler.svg)](https://www.npmjs.com/package/less-watch-compiler)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![Backers on Open Collective](https://opencollective.com/less-watch-compiler/backers/badge.svg)](#backers)
[![Sponsors on Open Collective](https://opencollective.com/less-watch-compiler/sponsors/badge.svg)](#sponsors)

Dead Simple LESS CSS Watch Compiler
===================

A command that watches folders(and subfolders) for file changes and automatically compile the less css files into css. This is a file system watcher and compiler. It also keep track of a dependency tree and recompiles the parent if an imported (child) LESS file is changed.

Parts of this script is modified from Mikeal Rogers's watch script (https://github.com/mikeal/watch)

## What's new: zero-prerequisite install, in-process compilation, a real API

less-watch-compiler is the most widely used standalone LESS watch/compile CLI on npm (see the downloads badge above), and starting with v1.18 it's also meaningfully better:

- **No more global `lessc` install.** LESS now compiles fully in-process via the bundled `less` package — this previously shelled out to a `lessc` binary you had to install separately. `npm install -g less-watch-compiler` is now the only step.
- **A real programmatic API.** `require('less-watch-compiler')` now exports [`compileFile()` and `watch()`](#programmatic-api) for embedding in build scripts, custom tooling, or test harnesses — it's no longer CLI-only.
- **More correct compiles.** Structured compile errors (file/line/column instead of a raw shell error), quote- and paren-aware `--less-args` parsing (e.g. `modify-var='c=rgba(1, 2, 3, 0.5)'`), correct `source-map-inline` handling, and a fixed subfolder-compilation regression.
- **`--init`** scaffolds a config file for a new project in one command.

All of this is drop-in compatible: every CLI flag, the config file format, and default output are unchanged — verified byte-identical against the previous compiler across the full test suite.

### Why a standalone watcher instead of a bundler plugin?

If your project already runs Vite, webpack, or another bundler, its built-in/plugin LESS support is usually the better fit. **less-watch-compiler is for everything else** — legacy apps, Rails/Django/PHP/Jekyll asset pipelines, design systems, and any `npm run`-script setup that wants a fast, import-aware LESS watcher without adopting a full bundler.

Among standalone (non-bundler) LESS watch/compile tools on npm, it's the clear leader by adoption, and the only one still actively maintained:

| Package                                                                        | Weekly downloads* | GitHub stars | Maintenance              |
| ------------------------------------------------------------------------------ | ----------------- | ------------ | ------------------------ |
| **less-watch-compiler** (this package)                                         | ~13,800           | 285          | **Active**               |
| [`watch-less`](https://www.npmjs.com/package/watch-less)                       | ~91               | 52           | Inactive                 |
| [`less-compiler`](https://www.npmjs.com/package/less-compiler)                 | ~25               | 3            | Inactive                 |
| [`node-less-chokidar`](https://www.npmjs.com/package/node-less-chokidar)       | low               | —            | Unmaintained (~6 years)  |
| [`less-watcher-compiler`](https://www.npmjs.com/package/less-watcher-compiler) | low               | —            | Unmaintained (~3 years)  |
| [`less_watch`](https://www.npmjs.com/package/less_watch)                       | low               | —            | Unmaintained (~12 years) |

<sub>*Approximate npm weekly download counts as of mid-2026 — see the live downloads badge at the top of this README for the current number.</sub>

## Prerequisites

None beyond [Node.js](https://nodejs.org/) (>= 18). [LESS](http://www.lesscss.org/) is bundled as a dependency and compilation happens in-process — a separate global `lessc` installation is no longer required.

## Installation

> The commands below may need to be prefixed with `sudo` depending upon your system

Install the `less-watch-compiler` command globally.

### [yarn](https://yarnpkg.com/)

```bash
yarn global add less-watch-compiler
```

### [npm](https://www.npmjs.com/)

```bash
npm install -g less-watch-compiler
```

## Usage

### With no main file

You need to pass in the minimum 2 parameters - <source_dir> and <destination_dir> . First parameter is the source folder to watch for changes and second is the output folder in which the css files will be compiled

Usage:

```bash
less-watch-compiler [options] <source_dir> <destination_dir>
```

### With main file

If you pass in the 3rd optional parameter, Any file change will trigger only to compile the main file specified in the 3rd parameter.
Assuming the 3rd is "main.less"

Usage:

```bash
less-watch-compiler [options] <source_dir> <destination_dir> [main-file]
```

## Basic example

```
 root
 └──src
 │    └── main.less
 │    └── aux.less
 └──dist
      └── main.css
```

The project can be compiled with the following command:

```bash
less-watch-compiler src dist main.less
```

## Configuration File

By default the the configuration file is loaded from ./less-watch-compiler.config.json but can also be specified by the --config <file> option.

#### Example using the project tree laid out in the previous example

less-watch-compiler.config.json

```json
{
  "watchFolder": "src",
  "outputFolder": "dist",
  "mainFile": "main.less"
}
```

The project can be compiled with the following command:

```bash
less-watch-compiler
```

## All configuration file options

```json
{
  "watchFolder": "<input_folder>",
  "outputFolder": "<output_folder>",
  "mainFile": "<main-file>",
  "includeHidden": false,
  "sourceMap": false,
  "plugins": "plugin1,plugin2",
  "lessArgs": "option1=1,option2=2",
  "runOnce": false,
  "enableJs": true,
  "cache": false,
  "cachePath": "<optional_cache_file_path>",
  "exclude": "<optional_regex_pattern>",
  "banner": false
}
```

## Options:

    -h, --help                                                               output usage information
    -V, --version                                                            output the version number
    --main-file <file>                                                       Specify <file> as the file to always re-compile e.g. '--main-file style.less'.
    --init                                                                   Create a less-watch-compiler.config.json template in the current directory and exit.
    --config <file>                                                          Custom configuration file path. (default: "less-watch-compiler.config.json")
    --run-once                                                               Run the compiler once without waiting for additional changes.
    --include-hidden                                                         Don't ignore files beginning with a '.' or a '_'
    --minified                                                               Less.js Option: Produce compressed output with a '.min.css' extension.
    --enable-js                                                              Less.js Option: To enable inline JavaScript in less files.
    --source-map                                                             Less.js Option: To generate source map for css files.
    --plugins <plugin-a>,<plugin-b>                                          Less.js Option: To specify plugins separated by commas.
    --less-args <less-arg1>=<less-arg1-value>,<less-arg1>=<less-arg2-value>  Less.js Option: To specify any other less options e.g. '--less-args math=strict,strict-units=on,include-path=./dir1\;./dir2'.
    --cache                                                                  Skip recompiling a file (under --run-once) when its content and full @import closure are unchanged since the last cached run.
    --cache-path <file>                                                     Cache file path when --cache is set. Defaults to '<cwd>/.less-watch-compiler-cache.json'.
    --exclude <pattern>                                                     Additional regex pattern for paths to never watch or compile, e.g. '--exclude dist'. node_modules and .git are always excluded.
    --banner                                                                 Prepend a 'generated file, do not edit' comment to compiled CSS.
    --banner-text <text>                                                     Custom banner text to use instead of the default message. Implies --banner.

## Please note:

- By default, "minified" is turned off (full, uncompressed CSS output). Set `"minified":true` in the config file, or pass `--minified` on the CLI, to compress output and write `.min.css` files instead.
- By default, "sourceMap" is turned off. You can generating sourcemap to true by adding `"sourceMap":true` in the config file.
- By default, this script only compiles files with `.less` extension. More file extensions can be added by modifying the `allowedExtensions` array in `config.json`.
- Files that start with underscores `_style.css` or period `.style.css` are ignored. This behavior can be changed by adding `"includeHidden:true` in the config file.
- `node_modules` and `.git` are always excluded from the watch and compile, no flag needed.
- `--exclude <pattern>` (or `"exclude"` in the config file) adds an additional regex pattern for files or directories to keep out of the watch and compile entirely — it doesn't replace the `node_modules`/`.git` default, it adds to it. Unlike `allowedExtensions`, which only narrows which files count as compilable, `exclude` also stops the walk from descending into matching directories at all (e.g. `--exclude dist`). An invalid regex pattern exits with an error.
- `--banner` (or `"banner": true` in the config file) prepends a "generated file, don't edit" comment to every compiled CSS file; off by default. `--banner-text <text>` (or a string value for `"banner"` in the config file) uses custom text instead of the default message — a multi-line string is wrapped as a `/* ... */` block comment. Works correctly together with `--source-map` (both the plain and inline forms): the map is adjusted so it still resolves to the right line in the source `.less` file despite the banner shifting everything below it down.
- When `--run-once` used, compilation will fail on first error

## Incremental compilation for CI

`--run-once` recompiles every matching file on every invocation. For CI, where the same tree is often rebuilt across runs with only a handful of files actually changed, `--cache` (or `"cache": true` in the config file) skips recompiling a file when nothing that affects its output has changed:

```bash
less-watch-compiler --run-once --cache less css
```

- Off by default, and only applies to `--run-once` (and `compileFile()` in the [programmatic API](#programmatic-api)) — a live watch session always recompiles on a real change, so caching has nothing to add there.
- **Content-based, not timestamp-based.** Each file's cache key hashes its own content plus the content of every file it `@import`s, transitively. This is deliberate: CI checkouts and restored caches don't reliably preserve mtimes, so a cache keyed on timestamps would be wrong (or useless) in exactly the environment this feature targets.
- **Whole-cache invalidation on option changes.** Changing any compile-affecting option (`--less-args`, `--plugins`, `--enable-js`, `--source-map`, `--minified`) or upgrading `less`/`less-watch-compiler` invalidates the entire cache at once, rather than trying to track which options affect which files.
- The cache file (default `.less-watch-compiler-cache.json` in the current directory, override with `--cache-path <file>` / `"cachePath"`) is plain JSON. In CI, restore/save it the same way you'd cache `node_modules` (e.g. keyed on a lockfile hash) so it persists across runs.
- **Known limitation:** dependency detection for the cache key covers standard `@import "file"` / `@import (reference) "file"` statements resolved relative to the importing file. It does not currently follow imports that only resolve via `--less-args include-path=...`, or recognize other Less import modifiers (`(less)`, `(css)`, `(inline)`, `(multiple)`, etc.) — a file that depends on something _only_ through one of those won't invalidate the cache when that dependency changes. If your project relies on either, either avoid `--cache` for now or keep an eye on [issue #212](https://github.com/jonycheung/deadsimple-less-watch-compiler/issues/212) for a fix that sources the dependency list from `less.render()`'s own import resolution instead of a custom parser.

## Programmatic API

The package can also be used as a library:

```js
const { compileFile, watch } = require('less-watch-compiler');

// Compile one file (returns a Promise with the output path)
await compileFile('less/style.less', 'css', { minified: true });

// Compile everything under a folder, then keep watching for changes
watch(
  'less',
  'css',
  { sourceMap: true },
  {
    onCompile: (changedFile, outputFilePath) => console.log(changedFile, '->', outputFilePath)
  }
);
```

`compileFile(inputFilePath, outputFolder, options?)` and `watch(watchFolder, outputFolder, options?, listeners?)` accept the same options as the config file (`minified`, `sourceMap`, `enableJs`, `lessArgs`, `plugins`, `cache`, `cachePath`, `banner`, and for `watch` also `mainFile`, `includeHidden`, `allowedExtensions`, `exclude`). `compileFile()` honors `cache`/`cachePath` directly (see [Incremental compilation for CI](#incremental-compilation-for-ci) above); `watch()` accepts them for config-shape parity but doesn't use them, since a live watch session always recompiles on a real change. `watch()` always excludes `node_modules` and `.git`; `exclude` adds to that rather than replacing it, and an invalid pattern throws synchronously. TypeScript definitions are bundled. Note that the compiler keeps its configuration in module-level state, so one configuration per process applies at a time.

### Using the source files

Alternativelly, you can checkout the code and run things locally like this:

```bash
node less-watch-compiler.js [options]
```

To run unit tests: `yarn test` or `npm test` (see the suites under `test/`).

## Contributors

This project exists thanks to all the people who contribute. [[Contribute](CONTRIBUTING.md)].
<a href="https://github.com/jonycheung/deadsimple-less-watch-compiler/graphs/contributors"><img src="https://opencollective.com/less-watch-compiler/contributors.svg?width=890&button=false" /></a>
