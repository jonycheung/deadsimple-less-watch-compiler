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
import sh from 'shelljs';
import extend from 'extend';
import { Command } from 'commander';
import events from 'events';
import lessWatchCompilerUtils = require('./lib/lessWatchCompilerUtils');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packagejson = require('../package.json');

const cwd = sh.pwd().toString();

// bypass maxlistener errors because more files means more listeners #90
events.EventEmitter.defaultMaxListeners = 0;

const program = new Command();

program
  .name('less-watch-compiler')
  .version(packagejson.version)
  .usage('[options] <source_dir> <destination_dir> [main_file_name]')
  .option('--main-file <file>', "Specify <file> as the file to always re-compile e.g. '--main-file style.less'. (comma-separated supported)'")
  .option('--main-files <files>', 'Comma-separated list of main files to re-compile on any change.')
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

const programOption = program.opts<{
  mainFile?: string;
  mainFiles?: string;
  config?: string;
  runOnce?: boolean;
  includeHidden?: boolean;
  enableJs?: boolean;
  sourceMap?: boolean;
  plugins?: string;
  lessArgs?: string;
}>();

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
  } catch (err) {
    // No config file is fine; proceed with defaults
  }
  init();
};

loadConfigAndInit();

let mainFilePaths: string[] = [];

function init(): void {
  const args = program.args as string[];
  if (args[0]) lessWatchCompilerUtils.config.watchFolder = args[0];
  if (args[1]) lessWatchCompilerUtils.config.outputFolder = args[1];
  if (args[2]) lessWatchCompilerUtils.config.mainFile = args[2];
  if (programOption.mainFile) lessWatchCompilerUtils.config.mainFile = programOption.mainFile;
  if (programOption.mainFiles) lessWatchCompilerUtils.config.mainFiles = programOption.mainFiles.split(',').map((f) => f.trim()).filter(Boolean);
  if (programOption.sourceMap !== undefined) lessWatchCompilerUtils.config.sourceMap = programOption.sourceMap;
  if (programOption.plugins) lessWatchCompilerUtils.config.plugins = programOption.plugins;
  if (programOption.runOnce !== undefined) lessWatchCompilerUtils.config.runOnce = programOption.runOnce;
  if (programOption.includeHidden !== undefined) lessWatchCompilerUtils.config.includeHidden = programOption.includeHidden;
  if (programOption.enableJs !== undefined) lessWatchCompilerUtils.config.enableJs = programOption.enableJs;
  if (programOption.lessArgs) lessWatchCompilerUtils.config.lessArgs = programOption.lessArgs;

  const cliOptions = program.opts();
  Object.keys(cliOptions).forEach((key) => {
    const value = (cliOptions as any)[key];
    if (value !== undefined) {
      (lessWatchCompilerUtils.config as any)[key] = value;
    }
  });

  if (!lessWatchCompilerUtils.config.watchFolder || !lessWatchCompilerUtils.config.outputFolder) {
    console.log('Missing arguments. Example:');
    console.log('\tnode less-watch-compiler.js FOLDER_TO_WATCH FOLDER_TO_OUTPUT');
    console.log('\tExample 1: To watch all files under the folder "less" and compile all into a folder "css".');
    console.log('\t\t less-watch-compiler less css');
    process.exit(1);
  }

  lessWatchCompilerUtils.config.watchFolder = path.resolve(lessWatchCompilerUtils.config.watchFolder);
  lessWatchCompilerUtils.config.outputFolder = path.resolve(lessWatchCompilerUtils.config.outputFolder);

  const collectMainFiles = (): string[] => {
    const mainFiles: string[] = [];
    if (lessWatchCompilerUtils.config.mainFile) {
      mainFiles.push(lessWatchCompilerUtils.config.mainFile);
    }
    if (lessWatchCompilerUtils.config.mainFiles && lessWatchCompilerUtils.config.mainFiles.length > 0) {
      mainFiles.push(...lessWatchCompilerUtils.config.mainFiles);
    }
    return mainFiles
      .join(',')
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean)
      .map((f) => path.resolve(lessWatchCompilerUtils.config.watchFolder as string, f));
  };

  mainFilePaths = collectMainFiles();

  if (mainFilePaths.length > 0) {
    for (const p of mainFilePaths) {
      try {
        fs.accessSync(p, fs.constants.F_OK);
      } catch {
        console.log('Main file ' + p + ' does not exist.');
        process.exit(1);
      }
    }
  }

  if (lessWatchCompilerUtils.config.runOnce === true) console.log('Running less-watch-compiler once.');
  else console.log('Watching directory for file changes.');

  const compileMainFiles = () => {
    mainFilePaths.forEach((mf) => {
      const compileResult = lessWatchCompilerUtils.compileCSS(mf)!;
      console.log('Recompiling ' + compileResult.outputFilePath + ' at ' + lessWatchCompilerUtils.getDateTime());
    });
  };

  if (mainFilePaths.length > 0) {
    compileMainFiles();
  }

  lessWatchCompilerUtils.watchTree(
    lessWatchCompilerUtils.config.watchFolder,
    {
      interval: 200,
      // If we've set --include-hidden, don't ignore dotfiles
      ignoreDotFiles: !lessWatchCompilerUtils.config.includeHidden,
      filter: lessWatchCompilerUtils.filterFiles
    },
    function (f, curr, prev, fileimports) {
      if (typeof f === 'object' && prev === null && curr === null) {
        // Finished walking the tree
        return;
      } else if ((curr as fs.Stats).nlink === 0) {
        // f was removed
        console.log((f as string) + ' was removed.');
      } else {
        // f is a new file or changed
        if (mainFilePaths.length > 0) {
          compileMainFiles();
        } else {
          let importedFile = false;
          for (const i in fileimports) {
            for (const k in fileimports[i]) {
              const hasExtension = path.extname(fileimports[i][k]).length > 1;
              const importFile = hasExtension ? fileimports[i][k] : fileimports[i][k] + '.less';
              const normalizedPath = path.normalize(path.dirname(i) + path.sep + importFile);

              if (f === normalizedPath) {
                const compileResult = lessWatchCompilerUtils.compileCSS(i)!;
                console.log(
                  'The file: ' +
                    i +
                    ' was changed because ' +
                    JSON.stringify(f) +
                    ' is specified as an import.  Recompiling ' +
                    compileResult.outputFilePath +
                    ' at ' +
                    lessWatchCompilerUtils.getDateTime()
                );
                importedFile = true;
              }
            }
          }
          if (!importedFile) {
            const compileResult = lessWatchCompilerUtils.compileCSS(f as string)!;
            console.log(
              'The file: ' + JSON.stringify(f) + ' was changed. Recompiling ' + compileResult.outputFilePath + ' at ' + lessWatchCompilerUtils.getDateTime()
            );
          }
        }
      }
    },
    // init function
    function (f) {
      if (mainFilePaths.length === 0) {
        lessWatchCompilerUtils.compileCSS(f);
      }
    }
  );
}
