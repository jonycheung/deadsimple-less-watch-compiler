import fs from 'fs';
import path from 'path';
import events from 'events';
import sh from 'shelljs';
import extend from 'extend';
import { exec } from 'child_process';
import fileSearch = require('./filesearch');

interface WalkOptions {
  ignoreDotFiles?: boolean;
  filter?: (filePath: string) => boolean;
  interval?: number;
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
  command: string;
  outputFilePath: string;
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
}

type WalkCompleteCallback = (err: NodeJS.ErrnoException | null, files: FilesMap | null) => void;

const cwd = sh.pwd().toString();
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
              const done = state.pending === 0;
              if (!enoent && st) {
                state.files[filePath] = st as fs.Stats;
                if (st.isDirectory()) {
                  processDir(filePath);
                } else {
                  if (options.ignoreDotFiles && path.basename(filePath)[0] === '.') return void (done && callback(null, state.files));
                  if (options.filter && options.filter(filePath)) return void (done && callback(null, state.files));
                  initCallback && initCallback(filePath);
                }
                if (done) callback(null, state.files);
              } else if (done) {
                callback(null, state.files);
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

  getLessArgs(args: string): string {
    const arr = args.split(',');
    return ' --' + arr.join(' --');
  },

  compileCSS(file: string, test?: boolean): CompileResult | undefined {
    const outputFilePath = this.resolveOutputPath(file);

    // Skip compiling hidden files unless includeHidden flag is enabled
    if (fileSearch.isHiddenFile(file) && !lessWatchCompilerUtilsModule.config.includeHidden) return;

    const enableJsFlag = lessWatchCompilerUtilsModule.config.enableJs ? ' --js' : '';
    const minifiedFlag = lessWatchCompilerUtilsModule.config.minified ? ' -x' : '';
    const sourceMap = lessWatchCompilerUtilsModule.config.sourceMap ? ' --source-map' : '';
    const lessArgs = lessWatchCompilerUtilsModule.config.lessArgs ? this.getLessArgs(lessWatchCompilerUtilsModule.config.lessArgs) : '';
    const plugins = lessWatchCompilerUtilsModule.config.plugins ? ' --' + lessWatchCompilerUtilsModule.config.plugins.split(',').join(' --') : '';
    const command = 'lessc' + lessArgs + sourceMap + enableJsFlag + minifiedFlag + plugins + ' ' + JSON.stringify(file) + ' ' + outputFilePath;

    if (!test)
      exec(command, (error, stdout) => {
        if (error !== null) {
          console.log(error);
          if (lessWatchCompilerUtilsModule.config.runOnce) process.exit(1);
        }
        if (stdout) console.error(stdout);
      });

    return { command, outputFilePath };
  },

  resolveOutputPath(filePath: string): string {
    const fullPath = path.resolve(filePath);
    const parsedPath = path.parse(fullPath);

    // Only empty when unit testing it seems
    let relativePath: string | null = null;
    let dirname: string | null = null;
    if (lessWatchCompilerUtilsModule.config.watchFolder) {
      relativePath = path.relative(lessWatchCompilerUtilsModule.config.watchFolder, fullPath);
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
    formatted = formatted.replace(/^(\.\.[\/\\])+/, '');

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
      files[f] = c as fs.Stats;
      if (!files[f].isDirectory()) {
        if (options.ignoreDotFiles && path.basename(f)[0] === '.') return;
        if (options.filter && options.filter(f)) return;
        fs.exists(f, (exists) => {
          if (!exists) {
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
                if (options.filter && options.filter(b)) return;
                fs.exists(file, (exists) => {
                  if (!exists) {
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
      if ((c as fs.Stats).nlink === 0) {
        delete files[f];
        fs.unwatchFile(f);
      }
    });
  },

  fileWatcher(f: string, files: FilesMap, options: WalkOptions, filelistArr: string[], fileimportlistObj: Record<string, string[]>, watchCallback: WatchCallback): void {
    if (filelistArr.indexOf(f) !== -1) return;
    filelistArr[filelistArr.length] = f;

    fileimportlistObj[f] = fileSearch.findLessImportsInFile(f);
    lessWatchCompilerUtilsModule.setupWatcher(f, files, options, watchCallback);
    for (const i in fileimportlistObj[f]) {
      if (filelistArr.indexOf(fileimportlistObj[f][i]) === -1) {
        lessWatchCompilerUtilsModule.setupWatcher(
          path.normalize(path.dirname(f) + path.sep + fileimportlistObj[f][i]),
          files,
          options,
          watchCallback
        );
      }
    }
  }
};

export = lessWatchCompilerUtilsModule;

