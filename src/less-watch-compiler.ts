#!/usr/bin/env node

/* Copyright 2012, Jonathan Cheung Licensed and released under the MIT
   license. Refer to MIT-LICENSE.txt.

  A nodejs script that watches folders(and subfolders) for changes and automatically compile the less css files into css.

  Always give credit where it is due. Parts of this script is modified from Mikeal Rogers's watch script (https://github.com/mikeal/watch)

   Basic Usage:     less-watch-compiler FOLDER_TO_WATCH FOLDER_TO_OUTPUT
   Example:         'less-watch-compiler less css' will watch ./less folder
                    and compile the less css files into ./css when they are added/updated
*/
import fs from 'fs';
import path from 'path';
import extend from 'extend';
import { Command } from 'commander';
import events from 'events';
import lessWatchCompilerUtils = require('./lib/lessWatchCompilerUtils');

const packagejson = require('../package.json');

const cwd = process.cwd();

// bypass maxlistener errors because more files means more listeners #90
events.EventEmitter.defaultMaxListeners = 0;

const program = new Command();

program
  .name('less-watch-compiler')
  .version(packagejson.version)
  .usage('[options] <source_dir> <destination_dir> [main_file_name]')
  .argument('[source_dir]', 'Folder to watch for .less files.')
  .argument('[destination_dir]', 'Folder to write compiled .css files to.')
  .argument('[main_file_name]', 'Optional: a single file that imports all others; only it will be compiled standalone.')
  .option('--main-file <file>', "Specify <file> as the file to always re-compile e.g. '--main-file style.less'.")
  .option('--init', 'Create a less-watch-compiler.config.json template in the current directory and exit.')
  .option('--config <file>', 'Custom configuration file path.', 'less-watch-compiler.config.json')
  .option('--run-once', 'Run the compiler once without waiting for additional changes.')
  .option('--include-hidden', "Don't ignore files beginning with a '.' or a '_'")
  .option(
    '--cache',
    'Skip recompiling a file (under --run-once) when its content and full @import closure are unchanged since the last cached run. Off by default; for CI, restore the cache file between runs.'
  )
  .option('--cache-path <file>', "Cache file path when --cache is set. Defaults to '<cwd>/.less-watch-compiler-cache.json'.")
  .option(
    '--exclude <pattern>',
    "Additional regex pattern for paths to never watch or compile, e.g. '--exclude dist'. node_modules and .git are always excluded."
  )
  .option('--banner', "Prepend a 'generated file, do not edit' comment to compiled CSS.")
  .option('--banner-text <text>', 'Custom banner text to use instead of the default message. Implies --banner.')
  // Less Options
  .option('--minified', "Less.js Option: Produce compressed output with a '.min.css' extension.")
  .option('--enable-js', 'Less.js Option: To enable inline JavaScript in less files.')
  .option('--source-map', 'Less.js Option: To generate source map for css files.')
  .option('--plugins <plugin-a>,<plugin-b>', 'Less.js Option: To specify plugins separated by commas.')
  .option(
    '--less-args <k1>=<v1>,<k2>=<v2>',
    "Less.js Option: To specify any other less options e.g. '--less-args math=strict,strict-units=on,include-path=.\\/dir1\\;.\\/dir2'."
  )
  .allowUnknownOption(false)
  .parse(process.argv);

const programOption = program.opts<{
  mainFile?: string;
  init?: boolean;
  config?: string;
  runOnce?: boolean;
  includeHidden?: boolean;
  minified?: boolean;
  enableJs?: boolean;
  sourceMap?: boolean;
  plugins?: string;
  lessArgs?: string;
  cache?: boolean;
  cachePath?: string;
  exclude?: string;
  banner?: boolean;
  bannerText?: string;
}>();

if (programOption.init) {
  const scaffoldPath = path.join(cwd, 'less-watch-compiler.config.json');
  if (fs.existsSync(scaffoldPath)) {
    console.log(scaffoldPath + ' already exists; leaving it untouched.');
    process.exit(1);
  }
  const scaffold = {
    watchFolder: 'less',
    outputFolder: 'css',
    runOnce: false,
    sourceMap: false,
    minified: false,
    enableJs: false,
    includeHidden: false,
    cache: false
  };
  fs.writeFileSync(scaffoldPath, JSON.stringify(scaffold, null, 2) + '\n', 'utf8');
  console.log('Created ' + scaffoldPath + '. Adjust watchFolder/outputFolder and run less-watch-compiler.');
  process.exit(0);
}

// Check if configuration file exists
const configPath = programOption.config
  ? path.isAbsolute(programOption.config)
    ? programOption.config
    : cwd + path.sep + programOption.config
  : 'less-watch-compiler.config.json';

const loadConfigAndInit = async (): Promise<void> => {
  try {
    await fs.promises.access(configPath, fs.constants.F_OK);
    const data = await fs.promises.readFile(configPath, 'utf8');
    const customConfig = JSON.parse(data.toString());
    console.log('Config file ' + configPath + ' is loaded.');
    extend(true, lessWatchCompilerUtils.config, customConfig);
  } catch {
    // No config file is fine; proceed with defaults
  }
  init();
};

loadConfigAndInit();

let mainFilePath: string | undefined = undefined;

function init(): void {
  const args = program.args as string[];
  if (args[0]) lessWatchCompilerUtils.config.watchFolder = args[0];
  if (args[1]) lessWatchCompilerUtils.config.outputFolder = args[1];
  if (args[2]) lessWatchCompilerUtils.config.mainFile = args[2];
  if (programOption.mainFile) lessWatchCompilerUtils.config.mainFile = programOption.mainFile;
  if (programOption.sourceMap !== undefined) lessWatchCompilerUtils.config.sourceMap = programOption.sourceMap;
  if (programOption.minified !== undefined) lessWatchCompilerUtils.config.minified = programOption.minified;
  if (programOption.plugins) lessWatchCompilerUtils.config.plugins = programOption.plugins;
  if (programOption.runOnce !== undefined) lessWatchCompilerUtils.config.runOnce = programOption.runOnce;
  if (programOption.includeHidden !== undefined) lessWatchCompilerUtils.config.includeHidden = programOption.includeHidden;
  if (programOption.enableJs !== undefined) lessWatchCompilerUtils.config.enableJs = programOption.enableJs;
  if (programOption.lessArgs) lessWatchCompilerUtils.config.lessArgs = programOption.lessArgs;
  if (programOption.cache !== undefined) lessWatchCompilerUtils.config.cache = programOption.cache;
  if (programOption.cachePath) lessWatchCompilerUtils.config.cachePath = programOption.cachePath;
  if (programOption.exclude) lessWatchCompilerUtils.config.exclude = programOption.exclude;
  if (programOption.bannerText) lessWatchCompilerUtils.config.banner = programOption.bannerText;
  else if (programOption.banner !== undefined) lessWatchCompilerUtils.config.banner = programOption.banner;

  if (!lessWatchCompilerUtils.config.watchFolder || !lessWatchCompilerUtils.config.outputFolder) {
    console.log('Missing arguments. Example:');
    console.log('\tnode less-watch-compiler.js FOLDER_TO_WATCH FOLDER_TO_OUTPUT');
    console.log('\tExample 1: To watch all files under the folder "less" and compile all into a folder "css".');
    console.log('\t\t less-watch-compiler less css');
    process.exit(1);
  }

  lessWatchCompilerUtils.config.watchFolder = path.resolve(lessWatchCompilerUtils.config.watchFolder);
  lessWatchCompilerUtils.config.outputFolder = path.resolve(lessWatchCompilerUtils.config.outputFolder);

  if (lessWatchCompilerUtils.config.mainFile) {
    mainFilePath = path.resolve(lessWatchCompilerUtils.config.watchFolder, lessWatchCompilerUtils.config.mainFile);
    // Check synchronously so a missing main file aborts before any watcher
    // is registered, instead of racing the walk in a floating promise
    if (!fs.existsSync(mainFilePath)) {
      console.log('Main file ' + mainFilePath + ' does not exist.');
      process.exit(1);
    }
  }

  let exclude: RegExp;
  try {
    exclude = lessWatchCompilerUtils.resolveExcludePattern(lessWatchCompilerUtils.config.exclude);
  } catch (err) {
    console.log('Invalid --exclude pattern ' + JSON.stringify(lessWatchCompilerUtils.config.exclude) + ': ' + (err as Error).message);
    process.exit(1);
  }

  if (lessWatchCompilerUtils.config.runOnce === true) console.log('Running less-watch-compiler once.');
  else console.log('Watching directory for file changes.');

  lessWatchCompilerUtils.watchTree(
    lessWatchCompilerUtils.config.watchFolder,
    {
      interval: 200,
      // If we've set --include-hidden, don't ignore dotfiles
      ignoreDotFiles: !lessWatchCompilerUtils.config.includeHidden,
      filter: lessWatchCompilerUtils.filterFiles,
      exclude
    },
    lessWatchCompilerUtils.makeWatchHandler(mainFilePath, {
      onRemove(f) {
        console.log(f + ' was removed.');
      },
      onImportCompile(importingFile, changedFile, compileResult) {
        console.log(
          'The file: ' +
            importingFile +
            ' was changed because ' +
            JSON.stringify(changedFile) +
            ' is specified as an import.  Recompiling ' +
            compileResult.outputFilePath +
            ' at ' +
            lessWatchCompilerUtils.getDateTime()
        );
      },
      onCompile(f, compileResult) {
        console.log(
          'The file: ' + JSON.stringify(f) + ' was changed. Recompiling ' + compileResult.outputFilePath + ' at ' + lessWatchCompilerUtils.getDateTime()
        );
      }
    }),
    // init function
    function (f) {
      if (!mainFilePath || mainFilePath === f) {
        // compile each file when main file is missing or compile main file only once
        lessWatchCompilerUtils.compileCSS(f);
      }
    }
  );
}
