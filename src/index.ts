/**
 * Programmatic API for less-watch-compiler.
 *
 * Note: the underlying compiler keeps its configuration in module-level state,
 * so concurrent compile/watch sessions with different configurations within
 * one process are not supported.
 */
import fs from 'fs';
import path from 'path';
import lessWatchCompilerUtils = require('./lib/lessWatchCompilerUtils');
import filesearch = require('./lib/filesearch');
import lessOptions = require('./lib/lessOptions');

export interface CompileOptions {
  /** Produce minified output with a .min.css extension */
  minified?: boolean;
  /** Generate a source map next to the output file */
  sourceMap?: boolean;
  /** Enable inline JavaScript in less files */
  enableJs?: boolean;
  /** Extra lessc-style arguments, e.g. 'math=strict,include-path=./lib' */
  lessArgs?: string;
  /** Comma-separated less plugin names, e.g. 'clean-css' */
  plugins?: string;
}

export interface WatchOptions extends CompileOptions {
  /** Always (re)compile this file instead of the changed one */
  mainFile?: string;
  /** Also process files starting with '_' or '.' */
  includeHidden?: boolean;
  /** File extensions to consider (default ['.less']) */
  allowedExtensions?: string[];
}

export interface WatchListeners {
  onCompile?: (changedFile: string, outputFilePath: string) => void;
  onImportCompile?: (importingFile: string, changedFile: string, outputFilePath: string) => void;
  onRemove?: (file: string) => void;
}

/**
 * Compile a single .less file into outputFolder. Resolves with the output
 * file path (relative to the current working directory) once written.
 */
export async function compileFile(inputFilePath: string, outputFolder: string, options: CompileOptions = {}): Promise<string> {
  const input = path.resolve(inputFilePath);
  lessWatchCompilerUtils.config = {
    watchFolder: path.dirname(input),
    outputFolder: path.resolve(outputFolder),
    ...options
  };
  const outputFilePath: string = JSON.parse(lessWatchCompilerUtils.resolveOutputPath(input));
  const renderOptions = lessOptions.buildRenderOptions({
    inputFilePath: input,
    outputFilePath,
    enableJs: options.enableJs,
    minified: options.minified,
    sourceMap: options.sourceMap,
    lessArgs: options.lessArgs
  });
  await lessWatchCompilerUtils.renderLess(input, outputFilePath, renderOptions);
  return outputFilePath;
}

/**
 * Compile every .less file under watchFolder into outputFolder, then keep
 * watching for changes (equivalent to running the CLI without --run-once).
 */
export function watch(watchFolder: string, outputFolder: string, options: WatchOptions = {}, listeners: WatchListeners = {}): void {
  const resolvedWatchFolder = path.resolve(watchFolder);
  lessWatchCompilerUtils.config = {
    watchFolder: resolvedWatchFolder,
    outputFolder: path.resolve(outputFolder),
    ...options
  };
  const mainFilePath = options.mainFile ? path.resolve(resolvedWatchFolder, options.mainFile) : undefined;
  if (mainFilePath && !fs.existsSync(mainFilePath)) {
    throw new Error('Main file ' + mainFilePath + ' does not exist.');
  }

  lessWatchCompilerUtils.watchTree(
    resolvedWatchFolder,
    {
      interval: 200,
      ignoreDotFiles: !options.includeHidden,
      filter: lessWatchCompilerUtils.filterFiles
    },
    lessWatchCompilerUtils.makeWatchHandler(mainFilePath, {
      onRemove: listeners.onRemove,
      onCompile: listeners.onCompile ? (f, result) => listeners.onCompile!(f, result.outputFilePath) : undefined,
      onImportCompile: listeners.onImportCompile ? (i, f, result) => listeners.onImportCompile!(i, f, result.outputFilePath) : undefined
    }),
    function (f: string) {
      if (!mainFilePath || mainFilePath === f) {
        lessWatchCompilerUtils.compileCSS(f);
      }
    }
  );
}

export const findLessImportsInFile = filesearch.findLessImportsInFile;
export const buildRenderOptions = lessOptions.buildRenderOptions;
