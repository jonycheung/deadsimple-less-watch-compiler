import fs from 'fs';
import path from 'path';
import fileSearch = require('./filesearch');
import lessOptions = require('./lessOptions');
import cache = require('./cache');

// The less package ships no type definitions
const less = require('less');

interface WalkOptions {
  ignoreDotFiles?: boolean;
  filter?: (filePath: string) => boolean;
  interval?: number;
  // Unlike filter (which only ever applies to files -- see #73), exclude
  // applies to both files and directories: it's for keeping the walk out of
  // whole subtrees entirely (e.g. node_modules, #72), not for narrowing
  // which files within an otherwise-watched directory count as compilable.
  exclude?: RegExp;
}

interface FilesMap {
  [filePath: string]: fs.Stats;
}

interface WatchCallback {
  (f: string | FilesMap | NodeJS.ErrnoException | null, curr: fs.Stats | null, prev: fs.Stats | null, fileimportlist: Record<string, string[]>): void;
}

interface InitCallback {
  (f: string): void;
}

interface CompileResult {
  outputFilePath: string;
  options: lessOptions.LessRenderOptions;
  cached?: boolean;
}

interface LessWatchCompilerConfig {
  watchFolder?: string;
  outputFolder?: string;
  mainFile?: string;
  sourceMap?: boolean;
  plugins?: string;
  runOnce?: boolean;
  includeHidden?: boolean;
  enableJs?: boolean;
  lessArgs?: string;
  minified?: boolean;
  allowedExtensions?: string[];
  cache?: boolean;
  cachePath?: string;
  exclude?: string;
}

type WalkCompleteCallback = (err: NodeJS.ErrnoException | null, files: FilesMap | null) => void;

const cwd = process.cwd();
const defaultAllowedExtensions = ['.less'];

const filelist: string[] = [];
const fileimportlist: Record<string, string[]> = {};

const lessWatchCompilerUtilsModule = {
  config: {} as LessWatchCompilerConfig,

  walk(dir: string, options: WalkOptions, callback: WalkCompleteCallback, initCallback?: InitCallback): void {
    const state = { files: {} as FilesMap, pending: 0 };

    const finalize = (err: NodeJS.ErrnoException | null) => {
      if (state.pending === 0) callback(err, state.files);
    };

    const processDir = (directory: string) => {
      state.pending += 1;
      fs.stat(directory, (err, stat) => {
        if (err) return callback(err as NodeJS.ErrnoException, null);

        state.files[directory] = stat as fs.Stats;
        fs.readdir(directory, (readErr, files) => {
          state.pending -= 1;
          if (readErr) return callback(readErr as NodeJS.ErrnoException, null);

          files.forEach((entry) => {
            const filePath = path.join(directory, entry);
            state.pending += 1;
            fs.stat(filePath, (statErr, st) => {
              let enoent = false;
              if (statErr) {
                if ((statErr as NodeJS.ErrnoException).code !== 'ENOENT') {
                  console.log((statErr as NodeJS.ErrnoException).code);
                  return callback(statErr as NodeJS.ErrnoException, null);
                } else {
                  enoent = true;
                }
              }

              state.pending -= 1;
              if (!enoent && st) {
                // Dotfile/dotfolder skipping and the exclude pattern apply to
                // everything (a directory match keeps the walk from ever
                // descending into it); the extension filter must only apply
                // to files, or directories never recurse
                if (options.ignoreDotFiles && path.basename(filePath)[0] === '.') return void finalize(null);
                if (options.exclude && options.exclude.test(filePath)) return void finalize(null);
                if (!st.isDirectory() && options.filter && options.filter(filePath)) return void finalize(null);

                state.files[filePath] = st as fs.Stats;
                if (st.isDirectory()) {
                  processDir(filePath);
                } else {
                  if (initCallback) initCallback(filePath);
                }
                finalize(null);
              } else {
                finalize(null);
              }
            });
          });

          finalize(null);
        });
      });
    };

    processDir(dir);
  },

  watchTree(root: string, options: WalkOptions | WatchCallback, watchCallback?: WatchCallback, initCallback?: InitCallback): void {
    let opts: WalkOptions;
    let cb: WatchCallback;
    if (typeof options === 'function') {
      cb = options as WatchCallback;
      opts = {};
    } else {
      opts = options as WalkOptions;
      cb = watchCallback as WatchCallback;
    }
    lessWatchCompilerUtilsModule.walk(
      root,
      opts,
      (err: NodeJS.ErrnoException | null, files: FilesMap | null) => {
        if (err) throw err as any;
        if (!files) return;
        const filesMap = files as FilesMap;
        lessWatchCompilerUtilsModule.fileWatcher(root, filesMap, opts, filelist, fileimportlist, cb);
        for (const i in filesMap) {
          lessWatchCompilerUtilsModule.fileWatcher(i, filesMap, opts, filelist, fileimportlist, cb);
        }
        cb(filesMap, null, null, fileimportlist);
      },
      initCallback
    );
  },

  /**
   * Build the standard change handler shared by the CLI and the programmatic
   * API: recompiles the importing parent when a changed file is someone's
   * @import, otherwise compiles the main file (when set) or the changed file.
   */
  makeWatchHandler(
    mainFilePath: string | undefined,
    notify: {
      onRemove?: (file: string) => void;
      onCompile?: (file: string, result: CompileResult) => void;
      onImportCompile?: (importingFile: string, changedFile: string, result: CompileResult) => void;
    }
  ): WatchCallback {
    return function (f, curr, prev, fileimports) {
      if (typeof f === 'object' && prev === null && curr === null) {
        // Finished walking the tree
        return;
      } else if ((curr as fs.Stats).nlink === 0) {
        // f was removed
        if (notify.onRemove) notify.onRemove(f as string);
      } else {
        // f is a new file or changed
        let importedFile = false;
        for (const i in fileimports) {
          for (const k in fileimports[i]) {
            const hasExtension = path.extname(fileimports[i][k]).length > 1;
            const importFile = hasExtension ? fileimports[i][k] : fileimports[i][k] + '.less';
            const normalizedPath = path.normalize(path.dirname(i) + path.sep + importFile);

            if (f === normalizedPath && !mainFilePath) {
              const compileResult = lessWatchCompilerUtilsModule.compileCSS(i);
              if (compileResult && notify.onImportCompile) notify.onImportCompile(i, f as string, compileResult);
              importedFile = true;
            }
          }
        }
        if (!importedFile) {
          const compileResult = lessWatchCompilerUtilsModule.compileCSS(mainFilePath || (f as string));
          if (compileResult && notify.onCompile) notify.onCompile(f as string, compileResult);
        }
      }
    };
  },

  compileCSS(file: string, test?: boolean): CompileResult | undefined {
    const outputFilePath = this.resolveOutputPath(file);

    // Skip compiling hidden files unless includeHidden flag is enabled
    if (fileSearch.isHiddenFile(file) && !lessWatchCompilerUtilsModule.config.includeHidden) return;

    const outPath: string = JSON.parse(outputFilePath);
    const config = lessWatchCompilerUtilsModule.config;
    const options = lessOptions.buildRenderOptions({
      inputFilePath: file,
      outputFilePath: outPath,
      enableJs: config.enableJs,
      minified: config.minified,
      sourceMap: config.sourceMap,
      lessArgs: config.lessArgs
    });

    if (!test) {
      // Caching only applies to one-shot compilation (--run-once): that's the
      // scenario the cache targets (CI, restored across runs) and the only
      // one where "was this file actually recompiled" isn't reported back to
      // the caller, so a cache hit can't produce a misleading log line.
      const cacheEnabled = config.cache === true && config.runOnce === true;
      let cachePath: string | undefined;
      let fingerprintInput: Record<string, unknown> | undefined;
      if (cacheEnabled) {
        cachePath = cache.resolvePath(config.cachePath);
        fingerprintInput = {
          enableJs: config.enableJs,
          minified: config.minified,
          sourceMap: config.sourceMap,
          lessArgs: config.lessArgs,
          plugins: config.plugins
        };
        const mapPath = lessOptions.sourceMapFilePath(options, outPath);
        if (cache.isUpToDate(cachePath, fingerprintInput, file, outPath, mapPath ? [mapPath] : [])) {
          return { outputFilePath, options, cached: true };
        }
      }
      lessWatchCompilerUtilsModule
        .renderLess(file, outPath, options)
        .then(() => {
          if (cacheEnabled && cachePath && fingerprintInput) cache.record(cachePath, fingerprintInput, file, outPath);
        })
        .catch((error: Error & { line?: number; column?: number; filename?: string; extract?: string[] }) => {
          console.log(lessWatchCompilerUtilsModule.formatLessError(error));
          if (config.runOnce) process.exit(1);
        });
    }

    return { outputFilePath, options };
  },

  async renderLess(file: string, outPath: string, options: lessOptions.LessRenderOptions): Promise<void> {
    const renderOptions = { ...options };
    if (lessWatchCompilerUtilsModule.config.plugins) {
      renderOptions.plugins = await lessOptions.loadPlugins(lessWatchCompilerUtilsModule.config.plugins, less, renderOptions);
    }
    const input = await fs.promises.readFile(file, 'utf8');
    const result = await less.render(input, renderOptions);
    await fs.promises.mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
    await fs.promises.writeFile(outPath, result.css, 'utf8');
    // When sourceMapFileInline is set, the map is embedded as a data URI in
    // result.css already; a separate .map file would be redundant (and
    // lessc itself never writes one in that mode).
    const mapPath = lessOptions.sourceMapFilePath(options, outPath);
    if (result.map && mapPath) {
      await fs.promises.writeFile(mapPath, result.map, 'utf8');
    }
  },

  formatLessError(error: Error & { line?: number; column?: number; filename?: string; extract?: string[]; type?: string }): string {
    if (error.line === undefined && error.filename === undefined) return String(error.stack || error.message || error);
    const kind = error.type ? error.type + 'Error' : 'Error';
    let message = kind + ': ' + error.message;
    if (error.filename) {
      message += ' in ' + error.filename;
      if (error.line !== undefined) message += ' on line ' + error.line + ', column ' + error.column + ':';
    }
    if (error.extract) {
      const firstLine = error.line !== undefined ? error.line - 1 : 0;
      message +=
        '\n' +
        error.extract
          .map((line: string, index: number) => (line !== undefined ? firstLine + index + ' ' + line : undefined))
          .filter((line): line is string => line !== undefined)
          .join('\n');
    }
    return message;
  },

  resolveOutputPath(filePath: string): string {
    const fullPath = path.resolve(filePath);
    const parsedPath = path.parse(fullPath);

    // Only empty when unit testing it seems
    let dirname: string;
    if (lessWatchCompilerUtilsModule.config.watchFolder) {
      const relativePath = path.relative(lessWatchCompilerUtilsModule.config.watchFolder, fullPath);
      dirname = path.dirname(relativePath);
    } else {
      dirname = path.dirname(filePath);
    }
    const filename = parsedPath.name;

    let formatted = path.format({
      dir: dirname || '',
      name: filename,
      ext: (lessWatchCompilerUtilsModule.config.minified ? '.min' : '') + '.css'
    });

    // No matter the path of the main file, the output must always land in the output folder
    formatted = formatted.replace(/^(\.\.[/\\])+/, '');

    const finalFullPath = path.resolve(lessWatchCompilerUtilsModule.config.outputFolder || '', formatted);
    const shortPath = path.relative(cwd, finalFullPath);
    return JSON.stringify(shortPath);
  },

  filterFiles(f: string): boolean {
    const filename = path.basename(f);
    const extension = path.extname(f);
    const allowedExtensions = lessWatchCompilerUtilsModule.config.allowedExtensions || defaultAllowedExtensions;
    if (filename === '' || allowedExtensions.indexOf(extension) === -1) {
      return true;
    } else {
      if (lessWatchCompilerUtilsModule.config.includeHidden) return false;
      return fileSearch.isHiddenFile(filename);
    }
  },

  getDateTime(): string {
    const date = new Date();
    let hour: number | string = date.getHours();
    hour = (hour < 10 ? '0' : '') + hour;
    let min: number | string = date.getMinutes();
    min = (min < 10 ? '0' : '') + min;
    let sec: number | string = date.getSeconds();
    sec = (sec < 10 ? '0' : '') + sec;
    const year = date.getFullYear();
    let month: number | string = date.getMonth() + 1;
    month = (month < 10 ? '0' : '') + month;
    let day: number | string = date.getDate();
    day = (day < 10 ? '0' : '') + day;
    return hour + ':' + min + ':' + sec + ' on ' + day + '/' + month + '/' + year;
  },

  setupWatcher(f: string, files: FilesMap, options: WalkOptions, watchCallback: WatchCallback): void {
    if (lessWatchCompilerUtilsModule.config.runOnce === true) return;
    const watchOptions: fs.WatchFileOptions & { bigint?: false } = {
      bigint: false
    };
    if (options.interval !== undefined) watchOptions.interval = options.interval;
    fs.watchFile(f, watchOptions, (c: fs.Stats, p: fs.Stats) => {
      if (files[f] && !files[f].isDirectory() && c.nlink !== 0 && files[f].mtime.getTime() === c.mtime.getTime()) return;
      if ((c as fs.Stats).nlink === 0) {
        // The file (or directory) appears gone. Some editors save by
        // deleting the original path and recreating it a moment later
        // (rather than an atomic rename), so a single missing poll doesn't
        // necessarily mean a real removal (issue #197: treating it as one
        // used to unwatch the file permanently, silently, right after such
        // a save). fs.watchFile only invokes this callback once on the
        // exists->gone transition -- it will not fire again while the path
        // stays missing -- so a second poll can't be used to confirm this;
        // recheck for real with our own fs.access after one poll interval
        // instead of acting immediately.
        //
        // If the recheck finds the path back, do nothing here: we never
        // unwatched, so fs.watchFile's own next poll independently detects
        // the reappearance (a new mtime) as a normal change below and
        // triggers a recompile through the existing path.
        //
        // Snapshot the last-confirmed-present stat (undefined if the path
        // was never confirmed) so a stale timer can tell it's stale: if a
        // recreate is observed before this timer fires, files[f] is
        // reassigned to a new object below, and this timer's snapshot no
        // longer matches. Without this, a second, unrelated missing poll
        // (e.g. rapid consecutive non-atomic saves) landing just as this
        // timer checks could be mistaken for confirmation of the original
        // poll's removal and unwatch a file that's still actively in use.
        const lastKnownStat = files[f];
        const debounceMs = Math.max(options.interval !== undefined ? options.interval : 0, 300);
        setTimeout(() => {
          if (files[f] !== lastKnownStat) return;
          fs.access(f, fs.constants.F_OK, (accessErr) => {
            if (!accessErr) return;
            if (files[f] !== lastKnownStat) return;
            // A path that never existed also fires this callback once, on
            // its very first poll (e.g. a broken/not-yet-created @import
            // target watched preemptively) -- not a removal, and there's
            // nothing to notify since files[f] was never confirmed present.
            const existed = !!lastKnownStat;
            delete files[f];
            fs.unwatchFile(f);
            if (existed && !(options.ignoreDotFiles && path.basename(f)[0] === '.') && !(options.filter && options.filter(f))) {
              watchCallback(f, c as fs.Stats, p as fs.Stats, fileimportlist);
            }
          });
        }, debounceMs);
        return;
      }
      files[f] = c as fs.Stats;
      if (!files[f].isDirectory()) {
        if (options.ignoreDotFiles && path.basename(f)[0] === '.') return;
        if (options.filter && options.filter(f)) return;
        fs.access(f, fs.constants.F_OK, (accessErr) => {
          if (accessErr) {
            console.log('Does not exist : ' + f);
          } else {
            fileimportlist[f] = fileSearch.findLessImportsInFile(f);
            watchCallback(f, c as fs.Stats, p as fs.Stats, fileimportlist);
          }
        });
      } else {
        fs.readdir(f, (err, nfiles) => {
          if (err) return;
          nfiles.forEach((b) => {
            const file = path.join(f, b);
            if (!files[file]) {
              fs.stat(file, (err, stat) => {
                if (options.ignoreDotFiles && path.basename(b)[0] === '.') return;
                // Unlike the extension filter below, exclude applies to
                // directories too -- a newly-created excluded directory
                // (e.g. node_modules reappearing after a reinstall) must
                // never start being watched, the same way walk() already
                // keeps the initial scan out of it entirely.
                if (options.exclude && options.exclude.test(file)) return;
                if (options.filter && options.filter(b)) return;
                fs.access(file, fs.constants.F_OK, (accessErr) => {
                  if (accessErr) {
                    console.log('Does not exist : ' + f);
                  } else {
                    fileimportlist[file] = fileSearch.findLessImportsInFile(file);
                    watchCallback(file, stat as fs.Stats, null, fileimportlist);
                    files[file] = stat as fs.Stats;
                    lessWatchCompilerUtilsModule.fileWatcher(file, files, options, filelist, fileimportlist, watchCallback);
                  }
                });
              });
            }
          });
        });
      }
    });
  },

  fileWatcher(
    f: string,
    files: FilesMap,
    options: WalkOptions,
    filelistArr: string[],
    fileimportlistObj: Record<string, string[]>,
    watchCallback: WatchCallback
  ): void {
    if (filelistArr.indexOf(f) !== -1) return;
    filelistArr[filelistArr.length] = f;

    fileimportlistObj[f] = fileSearch.findLessImportsInFile(f);
    lessWatchCompilerUtilsModule.setupWatcher(f, files, options, watchCallback);
    for (const i in fileimportlistObj[f]) {
      const importSpec = fileimportlistObj[f][i];
      const hasExtension = path.extname(importSpec).length > 1;
      const importFile = hasExtension ? importSpec : importSpec + '.less';
      const importPath = path.normalize(path.dirname(f) + path.sep + importFile);
      if (filelistArr.indexOf(importPath) === -1) {
        filelistArr[filelistArr.length] = importPath;
        lessWatchCompilerUtilsModule.setupWatcher(importPath, files, options, watchCallback);
      }
      lessWatchCompilerUtilsModule.watchExternalImportDir(importPath, files, options, filelistArr, fileimportlistObj, watchCallback);
    }
  },

  /**
   * An @import target inside watchFolder gets directory-level recreate
   * detection for free: walk() discovers every directory up front, and each
   * one is handed to fileWatcher()/setupWatcher(), whose directory branch
   * notices new files via a readdir rescan. An @import target that resolves
   * outside watchFolder never goes through that walk, so it's watched as a
   * lone file above -- and setupWatcher's removal branch unwatches a deleted
   * file permanently, with nothing watching its directory to notice it come
   * back (issue #209). Mirror the in-root behavior by explicitly watching
   * the external target's containing directory the same way, scoped to just
   * that one directory (not a recursive walk of the external tree).
   */
  watchExternalImportDir(
    importPath: string,
    files: FilesMap,
    options: WalkOptions,
    filelistArr: string[],
    fileimportlistObj: Record<string, string[]>,
    watchCallback: WatchCallback
  ): void {
    const watchFolder = lessWatchCompilerUtilsModule.config.watchFolder;
    if (!watchFolder) return;
    const relative = path.relative(watchFolder, importPath);
    const isExternal = relative.startsWith('..') || path.isAbsolute(relative);
    if (!isExternal) return;

    const importDir = path.dirname(importPath);
    if (filelistArr.indexOf(importDir) !== -1) return;
    let stat: fs.Stats;
    let existingEntries: string[];
    try {
      stat = fs.statSync(importDir);
      existingEntries = fs.readdirSync(importDir);
    } catch {
      // The directory doesn't exist yet; nothing to watch until it does.
      return;
    }
    files[importDir] = stat;
    // Seed every file already in the directory into `files`, mirroring what
    // walk() does up front for directories inside watchFolder. Without this,
    // setupWatcher's directory branch (`if (!files[file])`) would treat each
    // pre-existing sibling as newly added the first time anything else in
    // the directory changes, firing a spurious watchCallback/compile for
    // files that were never touched and aren't anyone's @import.
    for (const entry of existingEntries) {
      const entryPath = path.join(importDir, entry);
      if (files[entryPath]) continue;
      try {
        files[entryPath] = fs.statSync(entryPath);
      } catch {
        // Raced with a delete between readdir and stat; nothing to seed.
      }
    }
    lessWatchCompilerUtilsModule.fileWatcher(importDir, files, options, filelistArr, fileimportlistObj, watchCallback);
  }
};

export = lessWatchCompilerUtilsModule;
