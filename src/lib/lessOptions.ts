import path from 'path';
import os from 'os';

/**
 * Translation of this tool's config into options for less.render(), mirroring
 * the argument handling of the lessc CLI (less/bin/lessc) so that compiling
 * in-process produces byte-identical output to shelling out to lessc.
 */

export interface RenderOptionsInput {
  inputFilePath: string;
  outputFilePath: string;
  enableJs?: boolean;
  minified?: boolean;
  sourceMap?: boolean;
  lessArgs?: string;
}

export type LessRenderOptions = Record<string, unknown>;

// Split on commas that are not inside parentheses, so values such as
// modify-var='c=rgba(1, 2, 3, 0.5)' survive intact (issue #103)
export function splitTopLevelCommas(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  let quote: string | undefined;
  let escaped = false;
  for (const ch of value) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      current += ch;
      escaped = true;
      continue;
    }
    if (quote) {
      current += ch;
      if (ch === quote) quote = undefined;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')' && depth > 0) depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current !== '') parts.push(current);
  return parts;
}

function booleanValue(value: string | undefined): boolean {
  if (value === undefined) return true;
  return value !== 'off' && value !== 'false' && value !== '0';
}

// lessc's parseVariableOption: "name=value" into a variables object
function parseVariableOption(option: string, variables: Record<string, string>): void {
  const parts = option.split('=');
  variables[parts[0].trim()] = parts.slice(1).join('=').trim();
}

function camelCase(key: string): string {
  return key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Translate one k=v (or bare-flag) entry from the --less-args list onto the
 * render options object, following lessc's own argument table.
 */
function applyLessArg(options: LessRenderOptions, entry: string): void {
  const eq = entry.indexOf('=');
  const key = (eq === -1 ? entry : entry.slice(0, eq)).trim().replace(/^-+/, '');
  const value = eq === -1 ? undefined : entry.slice(eq + 1).replace(/^['"]|['"]$/g, '');

  switch (key) {
    case 'x':
    case 'compress':
      options.compress = booleanValue(value);
      break;
    case 'js':
      options.javascriptEnabled = true;
      break;
    case 'no-js':
      options.javascriptEnabled = false;
      break;
    case 'include-path':
      // lessc splits on ; (always) and : (except when followed by a backslash, for Windows drive letters)
      options.paths = (value || '').split(os.type().match(/Windows/) ? /:(?!\\)|;/ : /[:;]/).filter((p) => p !== '');
      break;
    case 'strict-imports':
      options.strictImports = true;
      break;
    case 'insecure':
      options.insecure = true;
      break;
    case 'ie-compat':
      options.ieCompat = true;
      break;
    case 'l':
    case 'lint':
      options.lint = true;
      break;
    case 'rp':
    case 'rootpath':
      options.rootpath = (value || '').replace(/\\/g, '/');
      break;
    case 'relative-urls':
      options.rewriteUrls = 'all';
      break;
    case 'ru':
    case 'rewrite-urls':
      options.rewriteUrls = value === undefined ? 'all' : value;
      break;
    case 'sm':
    case 'strict-math':
      options.math = booleanValue(value) ? 'strict' : 'always';
      break;
    case 'm':
    case 'math':
      options.math = value;
      break;
    case 'su':
    case 'strict-units':
      options.strictUnits = booleanValue(value);
      break;
    case 'global-var': {
      const vars = (options.globalVars as Record<string, string>) || {};
      if (value) parseVariableOption(value, vars);
      options.globalVars = vars;
      break;
    }
    case 'modify-var': {
      const vars = (options.modifyVars as Record<string, string>) || {};
      if (value) parseVariableOption(value, vars);
      options.modifyVars = vars;
      break;
    }
    case 'url-args':
      options.urlArgs = value || '';
      break;
    case 'line-numbers':
      options.dumpLineNumbers = value;
      break;
    case 'no-color':
    case 's':
    case 'silent':
    case 'verbose':
      // Presentation-only lessc flags; no render-option equivalent
      break;
    default:
      // Unknown keys pass through camelCased with on/off coercion, matching
      // the permissive spirit of the previous string-built lessc invocation
      options[camelCase(key)] = value === undefined ? true : value === 'on' ? true : value === 'off' ? false : value;
      break;
  }
}

/**
 * Build the full less.render() options object for one compilation, replicating
 * lessc's defaults for source maps (map written next to the output file).
 */
export function buildRenderOptions(input: RenderOptionsInput): LessRenderOptions {
  const options: LessRenderOptions = {
    filename: path.resolve(input.inputFilePath)
  };

  if (input.enableJs) options.javascriptEnabled = true;
  if (input.minified) options.compress = true;

  if (input.lessArgs) {
    for (const entry of splitTopLevelCommas(input.lessArgs)) {
      if (entry.trim() !== '') applyLessArg(options, entry.trim());
    }
  }

  if (input.sourceMap) {
    const output = input.outputFilePath;
    const inputFile = input.inputFilePath;
    const sourceMapOptions: Record<string, unknown> = {
      sourceMapInputFilename: inputFile,
      sourceMapOutputFilename: path.basename(output),
      sourceMapFullFilename: output + '.map',
      sourceMapFilename: path.basename(output + '.map'),
      sourceMapBasepath: path.dirname(inputFile),
      sourceMapRootpath: path.relative(path.dirname(output + '.map'), path.dirname(inputFile))
    };

    // lessc routes source-map-* CLI arguments into the nested sourceMap
    // options object. Move any corresponding values parsed from lessArgs out
    // of the top-level render options so Less applies them to the map.
    const sourceMapArgNames: Record<string, string> = {
      sourceMapRootpath: 'sourceMapRootpath',
      sourceMapBasepath: 'sourceMapBasepath',
      sourceMapUrl: 'sourceMapURL',
      sourceMapIncludeSource: 'outputSourceFiles',
      sourceMapInline: 'sourceMapFileInline'
    };
    for (const [optionName, sourceMapName] of Object.entries(sourceMapArgNames)) {
      if (optionName in options) {
        sourceMapOptions[sourceMapName] = options[optionName];
        delete options[optionName];
      }
    }
    options.sourceMap = sourceMapOptions;
  }

  return options;
}

interface LessApi {
  PluginManager: new (l: unknown) => {
    Loader: {
      loadPlugin: (
        name: string,
        basePath: string,
        context: unknown,
        environment: unknown,
        fileManager: unknown
      ) => Promise<{ contents: string; filename: string }>;
    };
  };
  FileManager: new () => unknown;
  environment: unknown;
}

/**
 * Load plugins by name the way lessc does: resolve each through the plugin
 * manager's loader (which tries the name as given, then with the conventional
 * less-plugin- prefix) and return plugin file descriptors for options.plugins.
 */
export async function loadPlugins(pluginList: string, less: LessApi, renderOptions: LessRenderOptions): Promise<unknown[]> {
  const pluginManager = new less.PluginManager(less);
  const fileManager = new less.FileManager();
  const plugins: unknown[] = [];
  for (const rawName of splitTopLevelCommas(pluginList)) {
    const splitup = rawName.match(/^([^=]+)(=(.*))?/);
    if (!splitup) continue;
    const name = splitup[1].trim();
    const pluginOptions = splitup[3];
    if (name === '') continue;
    let data: { contents: string; filename: string };
    try {
      data = await pluginManager.Loader.loadPlugin(name, process.cwd(), { ...renderOptions }, less.environment, fileManager);
    } catch {
      throw new Error('Unable to load plugin ' + name + ' please make sure that it is installed under or at the same level as less');
    }
    plugins.push({ fileContent: data.contents, filename: data.filename, options: pluginOptions });
  }
  return plugins;
}
