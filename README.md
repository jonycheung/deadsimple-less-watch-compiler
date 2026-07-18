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
  "enableJs": true
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
    --enable-js                                                              Less.js Option: To enable inline JavaScript in less files.
    --source-map                                                             Less.js Option: To generate source map for css files.
    --plugins <plugin-a>,<plugin-b>                                          Less.js Option: To specify plugins separated by commas.
    --less-args <less-arg1>=<less-arg1-value>,<less-arg1>=<less-arg2-value>  Less.js Option: To specify any other less options e.g. '--less-args math=strict,strict-units=on,include-path=./dir1\;./dir2'.

## Please note:

- By default, "minified" is turned on to always compress/minify output. You can set the minification to false by adding `"minified":false` in the config file.
- By default, "sourceMap" is turned off. You can generating sourcemap to true by adding `"sourceMap":true` in the config file.
- By default, this script only compiles files with `.less` extension. More file extensions can be added by modifying the `allowedExtensions` array in `config.json`.
- Files that start with underscores `_style.css` or period `.style.css` are ignored. This behavior can be changed by adding `"includeHidden:true` in the config file.
- When `--run-once` used, compilation will fail on first error

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

`compileFile(inputFilePath, outputFolder, options?)` and `watch(watchFolder, outputFolder, options?, listeners?)` accept the same options as the config file (`minified`, `sourceMap`, `enableJs`, `lessArgs`, `plugins`, and for `watch` also `mainFile`, `includeHidden`, `allowedExtensions`). TypeScript definitions are bundled. Note that the compiler keeps its configuration in module-level state, so one configuration per process applies at a time.

### Using the source files

Alternativelly, you can checkout the code and run things locally like this:

```bash
node less-watch-compiler.js [options]
```

To run unit tests: `yarn test` or `npm test` (see the suites under `test/`).

## Contributors

This project exists thanks to all the people who contribute. [[Contribute](CONTRIBUTING.md)].
<a href="https://github.com/jonycheung/deadsimple-less-watch-compiler/graphs/contributors"><img src="https://opencollective.com/less-watch-compiler/contributors.svg?width=890&button=false" /></a>
