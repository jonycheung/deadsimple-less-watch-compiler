#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* Copyright 2012, Jonathan Cheung Licensed and released under the MIT
   license. Refer to MIT-LICENSE.txt.

  A nodejs script that watches folders(and subfolders) for changes and automatically compile the less css files into css.

  Always give credit where it is due. Parts of this script is modified from Mikeal Rogers's watch script (https://github.com/mikeal/watch)

   Basic Usage:     less-watch-compiler FOLDER_TO_WATCH FOLDER_TO_OUTPUT
   Example:         'less-watch-compiler less css' will watch ./less folder
                    and compile the less css files into ./css when they are added/updated
*/
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const extend_1 = __importDefault(require("extend"));
const commander_1 = require("commander");
const events_1 = __importDefault(require("events"));
const lessWatchCompilerUtils = require("./lib/lessWatchCompilerUtils");
const packagejson = require('../package.json');
const cwd = process.cwd();
// bypass maxlistener errors because more files means more listeners #90
events_1.default.EventEmitter.defaultMaxListeners = 0;
const program = new commander_1.Command();
program
    .name('less-watch-compiler')
    .version(packagejson.version)
    .usage('[options] <source_dir> <destination_dir> [main_file_name]')
    .option('--main-file <file>', "Specify <file> as the file to always re-compile e.g. '--main-file style.less'.")
    .option('--config <file>', 'Custom configuration file path.', 'less-watch-compiler.config.json')
    .option('--run-once', 'Run the compiler once without waiting for additional changes.')
    .option('--include-hidden', "Don't ignore files beginning with a '.' or a '_'")
    // Less Options
    .option('--enable-js', 'Less.js Option: To enable inline JavaScript in less files.')
    .option('--source-map', 'Less.js Option: To generate source map for css files.')
    .option('--plugins <plugin-a>,<plugin-b>', 'Less.js Option: To specify plugins separated by commas.')
    .option('--less-args <k1>=<v1>,<k2>=<v2>', "Less.js Option: To specify any other less options e.g. '--less-args math=strict,strict-units=on,include-path=.\\/dir1\\;.\\/dir2'.")
    .allowUnknownOption(false)
    .parse(process.argv);
const programOption = program.opts();
// Check if configuration file exists
const configPath = programOption.config
    ? path_1.default.isAbsolute(programOption.config)
        ? programOption.config
        : cwd + path_1.default.sep + programOption.config
    : 'less-watch-compiler.config.json';
const loadConfigAndInit = async () => {
    try {
        await fs_1.default.promises.access(configPath, fs_1.default.constants.F_OK);
        const data = await fs_1.default.promises.readFile(configPath, 'utf8');
        const customConfig = JSON.parse(data.toString());
        console.log('Config file ' + configPath + ' is loaded.');
        (0, extend_1.default)(true, lessWatchCompilerUtils.config, customConfig);
    }
    catch {
        // No config file is fine; proceed with defaults
    }
    init();
};
loadConfigAndInit();
let mainFilePath = undefined;
function init() {
    const args = program.args;
    if (args[0])
        lessWatchCompilerUtils.config.watchFolder = args[0];
    if (args[1])
        lessWatchCompilerUtils.config.outputFolder = args[1];
    if (args[2])
        lessWatchCompilerUtils.config.mainFile = args[2];
    if (programOption.mainFile)
        lessWatchCompilerUtils.config.mainFile = programOption.mainFile;
    if (programOption.sourceMap !== undefined)
        lessWatchCompilerUtils.config.sourceMap = programOption.sourceMap;
    if (programOption.plugins)
        lessWatchCompilerUtils.config.plugins = programOption.plugins;
    if (programOption.runOnce !== undefined)
        lessWatchCompilerUtils.config.runOnce = programOption.runOnce;
    if (programOption.includeHidden !== undefined)
        lessWatchCompilerUtils.config.includeHidden = programOption.includeHidden;
    if (programOption.enableJs !== undefined)
        lessWatchCompilerUtils.config.enableJs = programOption.enableJs;
    if (programOption.lessArgs)
        lessWatchCompilerUtils.config.lessArgs = programOption.lessArgs;
    if (!lessWatchCompilerUtils.config.watchFolder || !lessWatchCompilerUtils.config.outputFolder) {
        console.log('Missing arguments. Example:');
        console.log('\tnode less-watch-compiler.js FOLDER_TO_WATCH FOLDER_TO_OUTPUT');
        console.log('\tExample 1: To watch all files under the folder "less" and compile all into a folder "css".');
        console.log('\t\t less-watch-compiler less css');
        process.exit(1);
    }
    lessWatchCompilerUtils.config.watchFolder = path_1.default.resolve(lessWatchCompilerUtils.config.watchFolder);
    lessWatchCompilerUtils.config.outputFolder = path_1.default.resolve(lessWatchCompilerUtils.config.outputFolder);
    if (lessWatchCompilerUtils.config.mainFile) {
        mainFilePath = path_1.default.resolve(lessWatchCompilerUtils.config.watchFolder, lessWatchCompilerUtils.config.mainFile);
        // Check synchronously so a missing main file aborts before any watcher
        // is registered, instead of racing the walk in a floating promise
        if (!fs_1.default.existsSync(mainFilePath)) {
            console.log('Main file ' + mainFilePath + ' does not exist.');
            process.exit(1);
        }
    }
    if (lessWatchCompilerUtils.config.runOnce === true)
        console.log('Running less-watch-compiler once.');
    else
        console.log('Watching directory for file changes.');
    lessWatchCompilerUtils.watchTree(lessWatchCompilerUtils.config.watchFolder, {
        interval: 200,
        // If we've set --include-hidden, don't ignore dotfiles
        ignoreDotFiles: !lessWatchCompilerUtils.config.includeHidden,
        filter: lessWatchCompilerUtils.filterFiles
    }, function (f, curr, prev, fileimports) {
        if (typeof f === 'object' && prev === null && curr === null) {
            // Finished walking the tree
            return;
        }
        else if (curr.nlink === 0) {
            // f was removed
            console.log(f + ' was removed.');
        }
        else {
            // f is a new file or changed
            let importedFile = false;
            for (const i in fileimports) {
                for (const k in fileimports[i]) {
                    const hasExtension = path_1.default.extname(fileimports[i][k]).length > 1;
                    const importFile = hasExtension ? fileimports[i][k] : fileimports[i][k] + '.less';
                    const normalizedPath = path_1.default.normalize(path_1.default.dirname(i) + path_1.default.sep + importFile);
                    if (f === normalizedPath && !mainFilePath) {
                        const compileResult = lessWatchCompilerUtils.compileCSS(i);
                        console.log('The file: ' +
                            i +
                            ' was changed because ' +
                            JSON.stringify(f) +
                            ' is specified as an import.  Recompiling ' +
                            compileResult.outputFilePath +
                            ' at ' +
                            lessWatchCompilerUtils.getDateTime());
                        importedFile = true;
                    }
                }
            }
            if (!importedFile) {
                const compileResult = lessWatchCompilerUtils.compileCSS(mainFilePath || f);
                console.log('The file: ' + JSON.stringify(f) + ' was changed. Recompiling ' + compileResult.outputFilePath + ' at ' + lessWatchCompilerUtils.getDateTime());
            }
        }
    }, 
    // init function
    function (f) {
        if (!mainFilePath || mainFilePath === f) {
            // compile each file when main file is missing or compile main file only once
            lessWatchCompilerUtils.compileCSS(f);
        }
    });
}
