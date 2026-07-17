"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const fileSearch = require("./filesearch");
const lessOptions = require("./lessOptions");
// The less package ships no type definitions
const less = require('less');
const cwd = process.cwd();
const defaultAllowedExtensions = ['.less'];
const filelist = [];
const fileimportlist = {};
const lessWatchCompilerUtilsModule = {
    config: {},
    walk(dir, options, callback, initCallback) {
        const state = { files: {}, pending: 0 };
        const finalize = (err) => {
            if (state.pending === 0)
                callback(err, state.files);
        };
        const processDir = (directory) => {
            state.pending += 1;
            fs_1.default.stat(directory, (err, stat) => {
                if (err)
                    return callback(err, null);
                state.files[directory] = stat;
                fs_1.default.readdir(directory, (readErr, files) => {
                    state.pending -= 1;
                    if (readErr)
                        return callback(readErr, null);
                    files.forEach((entry) => {
                        const filePath = path_1.default.join(directory, entry);
                        state.pending += 1;
                        fs_1.default.stat(filePath, (statErr, st) => {
                            let enoent = false;
                            if (statErr) {
                                if (statErr.code !== 'ENOENT') {
                                    console.log(statErr.code);
                                    return callback(statErr, null);
                                }
                                else {
                                    enoent = true;
                                }
                            }
                            state.pending -= 1;
                            const done = state.pending === 0;
                            if (!enoent && st) {
                                // Dotfile/dotfolder skipping applies to everything; the extension
                                // filter must only apply to files, or directories never recurse
                                if (options.ignoreDotFiles && path_1.default.basename(filePath)[0] === '.')
                                    return void (done && callback(null, state.files));
                                if (!st.isDirectory() && options.filter && options.filter(filePath))
                                    return void (done && callback(null, state.files));
                                state.files[filePath] = st;
                                if (st.isDirectory()) {
                                    processDir(filePath);
                                }
                                else {
                                    if (initCallback)
                                        initCallback(filePath);
                                }
                                if (done)
                                    callback(null, state.files);
                            }
                            else if (done) {
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
    watchTree(root, options, watchCallback, initCallback) {
        let opts;
        let cb;
        if (typeof options === 'function') {
            cb = options;
            opts = {};
        }
        else {
            opts = options;
            cb = watchCallback;
        }
        lessWatchCompilerUtilsModule.walk(root, opts, (err, files) => {
            if (err)
                throw err;
            if (!files)
                return;
            const filesMap = files;
            lessWatchCompilerUtilsModule.fileWatcher(root, filesMap, opts, filelist, fileimportlist, cb);
            for (const i in filesMap) {
                lessWatchCompilerUtilsModule.fileWatcher(i, filesMap, opts, filelist, fileimportlist, cb);
            }
            cb(filesMap, null, null, fileimportlist);
        }, initCallback);
    },
    compileCSS(file, test) {
        const outputFilePath = this.resolveOutputPath(file);
        // Skip compiling hidden files unless includeHidden flag is enabled
        if (fileSearch.isHiddenFile(file) && !lessWatchCompilerUtilsModule.config.includeHidden)
            return;
        const outPath = JSON.parse(outputFilePath);
        const options = lessOptions.buildRenderOptions({
            inputFilePath: file,
            outputFilePath: outPath,
            enableJs: lessWatchCompilerUtilsModule.config.enableJs,
            minified: lessWatchCompilerUtilsModule.config.minified,
            sourceMap: lessWatchCompilerUtilsModule.config.sourceMap,
            lessArgs: lessWatchCompilerUtilsModule.config.lessArgs
        });
        if (!test) {
            lessWatchCompilerUtilsModule
                .renderLess(file, outPath, options)
                .catch((error) => {
                console.log(lessWatchCompilerUtilsModule.formatLessError(error));
                if (lessWatchCompilerUtilsModule.config.runOnce)
                    process.exit(1);
            });
        }
        return { outputFilePath, options };
    },
    async renderLess(file, outPath, options) {
        const renderOptions = { ...options };
        if (lessWatchCompilerUtilsModule.config.plugins) {
            renderOptions.plugins = await lessOptions.loadPlugins(lessWatchCompilerUtilsModule.config.plugins, less, renderOptions);
        }
        const input = await fs_1.default.promises.readFile(file, 'utf8');
        const result = await less.render(input, renderOptions);
        await fs_1.default.promises.mkdir(path_1.default.dirname(path_1.default.resolve(outPath)), { recursive: true });
        await fs_1.default.promises.writeFile(outPath, result.css, 'utf8');
        if (result.map) {
            await fs_1.default.promises.writeFile(outPath + '.map', result.map, 'utf8');
        }
    },
    formatLessError(error) {
        if (error.line === undefined && error.filename === undefined)
            return String(error.stack || error.message || error);
        const kind = error.type ? error.type + 'Error' : 'Error';
        let message = kind + ': ' + error.message;
        if (error.filename) {
            message += ' in ' + error.filename;
            if (error.line !== undefined)
                message += ' on line ' + error.line + ', column ' + error.column + ':';
        }
        if (error.extract) {
            const firstLine = error.line !== undefined ? error.line - 1 : 0;
            message +=
                '\n' +
                    error.extract
                        .filter((line) => line !== undefined)
                        .map((line, index) => firstLine + index + ' ' + line)
                        .join('\n');
        }
        return message;
    },
    resolveOutputPath(filePath) {
        const fullPath = path_1.default.resolve(filePath);
        const parsedPath = path_1.default.parse(fullPath);
        // Only empty when unit testing it seems
        let dirname;
        if (lessWatchCompilerUtilsModule.config.watchFolder) {
            const relativePath = path_1.default.relative(lessWatchCompilerUtilsModule.config.watchFolder, fullPath);
            dirname = path_1.default.dirname(relativePath);
        }
        else {
            dirname = path_1.default.dirname(filePath);
        }
        const filename = parsedPath.name;
        let formatted = path_1.default.format({
            dir: dirname || '',
            name: filename,
            ext: (lessWatchCompilerUtilsModule.config.minified ? '.min' : '') + '.css'
        });
        // No matter the path of the main file, the output must always land in the output folder
        formatted = formatted.replace(/^(\.\.[/\\])+/, '');
        const finalFullPath = path_1.default.resolve(lessWatchCompilerUtilsModule.config.outputFolder || '', formatted);
        const shortPath = path_1.default.relative(cwd, finalFullPath);
        return JSON.stringify(shortPath);
    },
    filterFiles(f) {
        const filename = path_1.default.basename(f);
        const extension = path_1.default.extname(f);
        const allowedExtensions = lessWatchCompilerUtilsModule.config.allowedExtensions || defaultAllowedExtensions;
        if (filename === '' || allowedExtensions.indexOf(extension) === -1) {
            return true;
        }
        else {
            if (lessWatchCompilerUtilsModule.config.includeHidden)
                return false;
            return fileSearch.isHiddenFile(filename);
        }
    },
    getDateTime() {
        const date = new Date();
        let hour = date.getHours();
        hour = (hour < 10 ? '0' : '') + hour;
        let min = date.getMinutes();
        min = (min < 10 ? '0' : '') + min;
        let sec = date.getSeconds();
        sec = (sec < 10 ? '0' : '') + sec;
        const year = date.getFullYear();
        let month = date.getMonth() + 1;
        month = (month < 10 ? '0' : '') + month;
        let day = date.getDate();
        day = (day < 10 ? '0' : '') + day;
        return hour + ':' + min + ':' + sec + ' on ' + day + '/' + month + '/' + year;
    },
    setupWatcher(f, files, options, watchCallback) {
        if (lessWatchCompilerUtilsModule.config.runOnce === true)
            return;
        const watchOptions = {
            bigint: false
        };
        if (options.interval !== undefined)
            watchOptions.interval = options.interval;
        fs_1.default.watchFile(f, watchOptions, (c, p) => {
            if (files[f] && !files[f].isDirectory() && c.nlink !== 0 && files[f].mtime.getTime() === c.mtime.getTime())
                return;
            files[f] = c;
            if (!files[f].isDirectory()) {
                if (options.ignoreDotFiles && path_1.default.basename(f)[0] === '.')
                    return;
                if (options.filter && options.filter(f))
                    return;
                fs_1.default.access(f, fs_1.default.constants.F_OK, (accessErr) => {
                    if (accessErr) {
                        console.log('Does not exist : ' + f);
                    }
                    else {
                        fileimportlist[f] = fileSearch.findLessImportsInFile(f);
                        watchCallback(f, c, p, fileimportlist);
                    }
                });
            }
            else {
                fs_1.default.readdir(f, (err, nfiles) => {
                    if (err)
                        return;
                    nfiles.forEach((b) => {
                        const file = path_1.default.join(f, b);
                        if (!files[file]) {
                            fs_1.default.stat(file, (err, stat) => {
                                if (options.ignoreDotFiles && path_1.default.basename(b)[0] === '.')
                                    return;
                                if (options.filter && options.filter(b))
                                    return;
                                fs_1.default.access(file, fs_1.default.constants.F_OK, (accessErr) => {
                                    if (accessErr) {
                                        console.log('Does not exist : ' + f);
                                    }
                                    else {
                                        fileimportlist[file] = fileSearch.findLessImportsInFile(file);
                                        watchCallback(file, stat, null, fileimportlist);
                                        files[file] = stat;
                                        lessWatchCompilerUtilsModule.fileWatcher(file, files, options, filelist, fileimportlist, watchCallback);
                                    }
                                });
                            });
                        }
                    });
                });
            }
            if (c.nlink === 0) {
                delete files[f];
                fs_1.default.unwatchFile(f);
            }
        });
    },
    fileWatcher(f, files, options, filelistArr, fileimportlistObj, watchCallback) {
        if (filelistArr.indexOf(f) !== -1)
            return;
        filelistArr[filelistArr.length] = f;
        fileimportlistObj[f] = fileSearch.findLessImportsInFile(f);
        lessWatchCompilerUtilsModule.setupWatcher(f, files, options, watchCallback);
        for (const i in fileimportlistObj[f]) {
            if (filelistArr.indexOf(fileimportlistObj[f][i]) === -1) {
                lessWatchCompilerUtilsModule.setupWatcher(path_1.default.normalize(path_1.default.dirname(f) + path_1.default.sep + fileimportlistObj[f][i]), files, options, watchCallback);
            }
        }
    }
};
module.exports = lessWatchCompilerUtilsModule;
