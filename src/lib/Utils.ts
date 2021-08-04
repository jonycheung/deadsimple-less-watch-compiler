"use strict";
import * as path from "path";
import FileSearch from "./fileSearch";
import sh from "shelljs";
import { Options } from "./Options";
const fileSearch = new FileSearch();
import * as child from "child_process";
import * as fs from "fs";
// import lessWatchCompilerUtilsModule from "./lessWatchCompilerUtils.cjs.js";

export function compileCSS(
  inputFilePath: string,
  test?: boolean
): child.ChildProcess | undefined {
  // As a rule, we don't compile hidden files for now. If we encounter one,
  // just return.
  const outputFilePath = resolveOutputPath(inputFilePath);
  if (fileSearch.isHiddenFile(outputFilePath)) return undefined;

  const command = getCommand(inputFilePath, outputFilePath);
  // Run the command
  if (!test)
    return child.exec(command)
  else
    return child.exec('');
}

export function getCommand(inputFilePath:string, outputFilePath:string):string{
  const Config = Options.getInstance();
  const enableJsFlag = Config.enableJs ? " --js" : "",
    minifiedFlag = Config.minified ? " -x" : "",
    sourceMap = Config.sourceMap ? " --source-map" : "",
    lessArgs = Config.lessArgs ? getLessArgs(Config.lessArgs) : "",
    plugins = Config.plugins
      ? " --" + Config.plugins.split(",").join(" --")
      : "",
    command =
      "lessc" +
      lessArgs +
      sourceMap +
      enableJsFlag +
      minifiedFlag +
      plugins +
      " " +
      JSON.stringify(inputFilePath) +
      " " +
      JSON.stringify(outputFilePath);
    return command
}

export function getDateTime(): string {
  const date = new Date();
  let displayDate: string = "",
    hour = date.getHours(),
    min = date.getMinutes(),
    sec = date.getSeconds(),
    year = date.getFullYear(),
    month = date.getMonth() + 1,
    day = date.getDate();

  displayDate += (hour < 10 ? "0" : "") + hour;
  displayDate += ":" + (min < 10 ? "0" : "") + min;
  displayDate += ":" + (sec < 10 ? "0" : "") + sec;
  displayDate += " on " + (day < 10 ? "0" : "") + day;
  displayDate += "/" + (month < 10 ? "0" : "") + month + "/" + year;
  return displayDate;
}

export function resolveOutputPath(filePath: string) {
  const cwd = sh.pwd().toString(),
    fullPath = path.resolve(filePath),
    parsedPath = path.parse(fullPath),
    Config = Options.getInstance();

  // Only empty when unit testing it seems
  let relativePath: string, dirname: string;
  if (Config.watchFolder) {
    relativePath = path.relative(Config.watchFolder, fullPath);
    dirname = path.dirname(relativePath);
  } else {
    dirname = path.dirname(filePath);
  }
  const filename = parsedPath.name;
  

  let formatted: string = path.format({
    dir: dirname,
    name: filename,
    ext: (Config.minified ? ".min" : "") + ".css",
  });

  // No matter the path of the main file, the output must always land in the output folder
  formatted = formatted.replace(/^(\.\.[\/\\])+/, "");

  const finalFullPath = path.resolve(Config.outputFolder, formatted);
  const shortPath = path.relative(cwd, finalFullPath);

  return shortPath;
}

export function getLessArgs(args: string) {
  const arr = args.split(",");
  return " --" + arr.join(" --");
}

export function filterFiles(f: string) {
  var filename = path.basename(f),
    extension = path.extname(f),
    Config = Options.getInstance(),
    allowedExtensions = Config.allowedExtensions;

  if (filename == "" || allowedExtensions.indexOf(extension) == -1) {
    return true;
  } else {
    // If we're including hidden files then don't ignore this file
    if (Config.includeHidden) return false;
    // Otherwise, do ignore this file if it's a hidden file
    else {
      return fileSearch.isHiddenFile(filename);
    }
  }
}

export function walk (
  dir: string,
  options: { ignoreDotFiles: boolean, filter: any },
  callback: (err: any, object?: object) => void,
  initCallback: (file:string) => void,
  callbackOptions: { files: { [key: string]: any }; pending: number } = {
    files: {},
    pending: 0,
  }
) {
  callbackOptions.pending += 1;

  fs.stat(dir, function (err, stat) {
    if (err) return callback(err);
    callbackOptions.files[dir] = stat;
    fs.readdir(dir, function (err, files) {
      if (err) return callback(err);
      callbackOptions.pending -= 1;
      files.forEach(function (f, index) {
        f = path.join(dir, f);
        callbackOptions.pending += 1;
        fs.stat(f, function (err, stat) {
          var enoent = false,
            done = false;

          if (err) {
            if (err.code !== "ENOENT") {
              console.log(err.code);
              return callback(err);
            } else {
              enoent = true;
            }
          }
          callbackOptions.pending -= 1;
          done = callbackOptions.pending === 0;
          if (!enoent) {
            callbackOptions.files[f] = stat;
            if (stat.isDirectory()) {
              walk(
                f,
                options,
                callback,
                initCallback
              );
            } else {
              if (options.ignoreDotFiles && path.basename(f)[0] === ".")
                return done && callback(null, callbackOptions.files);
              if (options.filter && options.filter(f))
                return done && callback(null, callbackOptions.files);
              initCallback && initCallback(f);
            }

            if (done) callback(null, callbackOptions.files);
          }
        });
      });
      if (callbackOptions.pending === 0)
        callback(null, callbackOptions.files);
    });
    if (callbackOptions.pending === 0) callback(null, callbackOptions.files);
  });
};