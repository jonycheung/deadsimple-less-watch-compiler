"use strict";
import * as path from "path";
import FileSearch from './fileSearch';
import sh from 'shelljs';
const lessWatchCompilerUtilsModule = require('./lessWatchCompilerUtils.cjs.js');
// import * as lessWatchCompilerUtilsModule from './lessWatchCompilerUtils.cjs.js';

export function compileCSS (file:string, test?:boolean): {command:string,outputFilePath:string} | undefined  {

    var outputFilePath = resolveOutputPath(file);
    // As a rule, we don't compile hidden files for now. If we encounter one,
    // just return.
    const fileSearch = new FileSearch(),
           exec = require('child_process').exec
    if (fileSearch.isHiddenFile(outputFilePath)) return undefined

    var enableJsFlag = lessWatchCompilerUtilsModule.config.enableJs ? ' --js' : '';
    var minifiedFlag = lessWatchCompilerUtilsModule.config.minified ? ' -x' : '';
    var sourceMap = (lessWatchCompilerUtilsModule.config.sourceMap) ? ' --source-map' : '';
    var lessArgs = (lessWatchCompilerUtilsModule.config.lessArgs)? getLessArgs(lessWatchCompilerUtilsModule.config.lessArgs): '';
    var plugins = (lessWatchCompilerUtilsModule.config.plugins) ? ' --' + lessWatchCompilerUtilsModule.config.plugins.split(',').join(' --') : '';
    var command = 'lessc' + lessArgs + sourceMap + enableJsFlag + minifiedFlag + plugins + ' ' + JSON.stringify(file) + ' ' + outputFilePath;
    // Run the command
    if (!test)
      exec(command, function (error:string, stdout:string) {
        if (error !== null) {
          console.log(error);
          if (lessWatchCompilerUtilsModule.config.runOnce)
            process.exit(1);
        }
        if (stdout)
          console.error(stdout);
      });
    return {
      "command": command,
      "outputFilePath": outputFilePath
    };

  };



export function resolveOutputPath (filePath:string) {
    const cwd = sh.pwd().toString();
    var fullPath = path.resolve(filePath);
    var parsedPath = path.parse(fullPath);

    // Only empty when unit testing it seems
    var relativePath = null;
    var dirname = null;
    if (lessWatchCompilerUtilsModule.config.watchFolder) {
      relativePath = path.relative(lessWatchCompilerUtilsModule.config.watchFolder, fullPath);
      dirname = path.dirname(relativePath);
    } else {
      dirname = path.dirname(filePath);
    }
    var filename = parsedPath.name;

    var formatted = path.format({
      dir: dirname,
      name: filename,
      ext: (lessWatchCompilerUtilsModule.config.minified ? '.min' : '') + '.css',
    });

    // No matter the path of the main file, the output must always land in the output folder
    formatted = formatted.replace(/^(\.\.[\/\\])+/, '');

    var finalFullPath = path.resolve(lessWatchCompilerUtilsModule.config.outputFolder, formatted);
    var shortPath = path.relative(cwd, finalFullPath);

    return JSON.stringify(shortPath);
  }

  export function getLessArgs(args:string) {
    var arr = args.split(',');
    return " --" + arr.join(' --');
  }