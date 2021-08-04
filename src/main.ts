#!/usr/bin/env node

/* Copyright 2012, Jonathan Cheung Licensed and released under the MIT
   license. Refer to MIT-LICENSE.txt.

  A nodejs script that watches folders(and subfolders) for changes and automatically compile the less css files into css.

  Always give credit where it is due. Parts of this script is modified from Mikeal Rogers's watch script (https://github.com/mikeal/watch)

   Basic Usage:     less-watch-compiler FOLDER_TO_WATCH FOLDER_TO_OUTPUT
   Example:         'less-watch-compiler less css' will watch ./less folder
                    and compile the less css files into ./css when they are added/updated
*/
import * as fs from "fs";
import * as path from "path";
import * as sh from "shelljs";
import { Command } from "commander";
import * as events from "events";
import { compileCSS, getDateTime, resolveOutputPath } from "./lib/Utils";
import { Options } from "./lib/Options";
import * as child from "child_process";

const cwd = sh.pwd(),
  lessWatchCompilerUtils = require("./lib/lessWatchCompilerUtils.cjs.js"),
  packagejson = require("../package.json"),
  extend = require("extend"),
  program = new Command();

let mainFilePath: string;
//bypass maxlistener errors because more files means more listeners #90
events.EventEmitter.defaultMaxListeners = 0;

program
  .version(
    packagejson.version,
    "-v, -V, --version",
    "Output the current version"
  )
  .usage("[options] <source_dir> <destination_dir> [main_file_name]")
  .option(
    "--main-file <file>",
    "Specify <file> as the file to always re-compile e.g. '--main-file style.less'."
  )
  .option(
    "--config <file>",
    "Custom configuration file path.",
    "less-watch-compiler.config.json"
  )
  .option(
    "--run-once",
    "Run the compiler once without waiting for additional changes."
  )
  .option(
    "--include-hidden",
    "Don't ignore files beginning with a '.' or a '_'"
  )
  //Less Options
  .option(
    "--enable-js",
    "Less.js Option: To enable inline JavaScript in less files."
  )
  .option(
    "--source-map",
    "Less.js Option: To generate source map for css files."
  )
  .option(
    "--plugins <plugin-a>,<plugin-b>",
    "Less.js Option: To specify plugins separated by commas."
  )
  .option(
    "--less-args <less-arg1>=<less-arg1-value>,<less-arg1>=<less-arg2-value>",
    "Less.js Option: To specify any other less options e.g. '--less-args math=strict,strict-units=on,include-path=./dir1\\;./dir2'."
  )
  .parse(process.argv);

const Config = Options.getInstance({ ...program.opts(), args: program.args });

// Check if configuration file exists
const configPath: string = Config.config
  ? path.isAbsolute(Config.config)
    ? Config.config
    : cwd + path.sep + Config.config
  : "less-watch-compiler.config.json";

fs.access(configPath, fs.constants.F_OK, (err) => {
  if (!err) {
    let data = fs.readFileSync(configPath);
    const customConfig = JSON.parse(data.toString());
    console.log("Config file " + configPath + " is loaded.");
    extend(true, Config, customConfig);
  }

  init();
});

function init(): void {
  /*
    3rd parameter is optional, but once you define it, then we will just compile 
    the main and generate as "{main_file_name}.css". All the files that has been 
    referenced from the main one will be minified into it.
    Assuming the 3rd is "main.less"
    - input folder: src
    src
        main.less (import aux.less)
        aux.less
    - output folder: dist
    dist
        main.css
        
    Otherwise, it will behave as previously:
    Assuming the 3rd is empty
    - input folder: src
    src
        main.less (import aux.less)
        aux.less
    - output folder: dist
    dist
        main.css
        aux.css
  */

  if (!Config.watchFolder || !Config.outputFolder) {
    console.log("Missing arguments. Example:");
    console.log(
      "\tnode less-watch-compiler.js FOLDER_TO_WATCH FOLDER_TO_OUTPUT"
    );
    console.log(
      '\tExample 1: To watch all files under the folder "less" and compile all into a folder "css".'
    );
    console.log("\t\t less-watch-compiler less css");
    process.exit(1);
  }

  Config.watchFolder = path.resolve(Config.watchFolder);
  Config.outputFolder = path.resolve(Config.outputFolder);

  if (Config.mainFile) {
    mainFilePath = path.resolve(Config.watchFolder, Config.mainFile);
    fs.access(mainFilePath, fs.constants.F_OK, (err) => {
      console.log(
        `Main file ${mainFilePath} ${err ? "does not exist" : "exists"}`
      );
      if (err) process.exit();
    });
  }

  if (Config.runOnce === true)
    console.log("Running less-watch-compiler only once.");
  else console.log("Watching directory for file changes.");
  lessWatchCompilerUtils.watchTree(
    Config.watchFolder,
    {
      interval: 200,
      // If we've set --include-hidden, don't ignore dotfiles
      ignoreDotFiles: !Config.includeHidden,
      filter: lessWatchCompilerUtils.filterFiles,
    },
    (
      f: string,
      curr: { nlink: number },
      prev: object,
      fileimportlist: string[][]
    ) => {
      if (typeof f == "object" && prev === null && curr === null) {
        // Finished walking the tree
        return;
      } else if (curr.nlink === 0) {
        // f was removed
        console.log(f + " was removed.");
      } else {
        // f is a new file or changed
        // console.log(f)
        let importedFile = false;
        // var filename = f.substring(Config.watchFolder.length+1)
        for (var i in fileimportlist) {
          for (var k in fileimportlist[i]) {
            const hasExtension = path.extname(fileimportlist[i][k]).length > 1,
              importFile = path.join(
                fileimportlist[i][k],
                hasExtension ? "" : ".less"
              ),
              normalizedPath = path.normalize(
                path.dirname(i) + path.sep + importFile
              );

            // console.log('compare ' + f + ' with import #' + k + ' in ' + i + ' value ' + normalized);
            if (f == normalizedPath && !mainFilePath) {
              // Compile changed file only if a main file is there.
              const outputFilePath = resolveOutputPath(i);

              const child_process: child.ChildProcess | undefined =
                compileCSS(outputFilePath);

              if (child_process !== undefined)
                child_process.on("exit", () => {
                  console.log(
                    "The file: " +
                      i +
                      " was changed because " +
                      JSON.stringify(f) +
                      " is specified as an import.  Recompiling " +
                      outputFilePath +
                      " at " +
                      getDateTime()
                  );
                  importedFile = true;
                });
            }
          }
        }
        if (!importedFile) {
          const path = mainFilePath || f;
          const outputFilePath = resolveOutputPath(path);
          const child_process: child.ChildProcess | undefined =
            compileCSS(outputFilePath);
          if (child_process)
            child_process.on("exit", () => {
              console.log(
                "The file: " +
                  JSON.stringify(path) +
                  " was changed. Recompiling " +
                  outputFilePath +
                  " at " +
                  getDateTime()
              );
            });
        }
      }
    },
    // init
    (f: string) => {
      if (!mainFilePath || mainFilePath === f) {
        // compile each file when main file is missing or compile main file only once
        compileCSS(f);
      }
    }
  );
}
