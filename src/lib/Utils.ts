"use strict";
import * as path from "path";
import FileSearch from "./fileSearch";
import sh from "shelljs";
const lessWatchCompilerUtilsModule = require("./lessWatchCompilerUtils.cjs.js");
const defaultAllowedExtensions = [".less"],
  fileSearch = new FileSearch();

export function compileCSS(
  file: string,
  test?: boolean
): { command: string; outputFilePath: string } | undefined {
  const outputFilePath = resolveOutputPath(file);
  // As a rule, we don't compile hidden files for now. If we encounter one,
  // just return.
  const exec = require("child_process").exec;
  if (fileSearch.isHiddenFile(outputFilePath)) return undefined;

  const enableJsFlag = lessWatchCompilerUtilsModule.config.enableJs
      ? " --js"
      : "",
    minifiedFlag = lessWatchCompilerUtilsModule.config.minified ? " -x" : "",
    sourceMap = lessWatchCompilerUtilsModule.config.sourceMap
      ? " --source-map"
      : "",
    lessArgs = lessWatchCompilerUtilsModule.config.lessArgs
      ? getLessArgs(lessWatchCompilerUtilsModule.config.lessArgs)
      : "",
    plugins = lessWatchCompilerUtilsModule.config.plugins
      ? " --" +
        lessWatchCompilerUtilsModule.config.plugins.split(",").join(" --")
      : "",
    command =
      "lessc" +
      lessArgs +
      sourceMap +
      enableJsFlag +
      minifiedFlag +
      plugins +
      " " +
      JSON.stringify(file) +
      " " +
      outputFilePath;
  // Run the command
  if (!test)
    exec(command, function (error: string, stdout: string) {
      if (error !== null) {
        console.log(error);
        if (lessWatchCompilerUtilsModule.config.runOnce) process.exit(1);
      }
      if (stdout) console.error(stdout);
    });
  return {
    command: command,
    outputFilePath: outputFilePath,
  };
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
    parsedPath = path.parse(fullPath);

  // Only empty when unit testing it seems
  let relativePath: string, dirname: string;
  if (lessWatchCompilerUtilsModule.config.watchFolder) {
    relativePath = path.relative(
      lessWatchCompilerUtilsModule.config.watchFolder,
      fullPath
    );
    dirname = path.dirname(relativePath);
  } else {
    dirname = path.dirname(filePath);
  }
  const filename = parsedPath.name;

  let formatted: string = path.format({
    dir: dirname,
    name: filename,
    ext: (lessWatchCompilerUtilsModule.config.minified ? ".min" : "") + ".css",
  });

  // No matter the path of the main file, the output must always land in the output folder
  formatted = formatted.replace(/^(\.\.[\/\\])+/, "");

  const finalFullPath = path.resolve(
    lessWatchCompilerUtilsModule.config.outputFolder,
    formatted
  );
  const shortPath = path.relative(cwd, finalFullPath);

  return JSON.stringify(shortPath);
}

export function getLessArgs(args: string) {
  const arr = args.split(",");
  return " --" + arr.join(" --");
}

export function filterFiles(f: string) {
  var filename = path.basename(f);
  var extension = path.extname(f),
    allowedExtensions =
      lessWatchCompilerUtilsModule.config.allowedExtensions ||
      defaultAllowedExtensions;
  if (filename == "" || allowedExtensions.indexOf(extension) == -1) {
    return true;
  } else {
    // If we're including hidden files then don't ignore this file
    if (lessWatchCompilerUtilsModule.config.includeHidden) return false;
    // Otherwise, do ignore this file if it's a hidden file
    else return fileSearch.isHiddenFile(filename);
  }
}
