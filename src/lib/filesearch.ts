'use strict';

import fs from 'fs';
import path from 'path';

interface FilesearchApi {
  findLessImportsInFile: (filePath: string) => string[];
  isHiddenFile: (filename: string) => boolean;
  resolveImportPath: (importingFile: string, importSpec: string) => string;
  collectTransitiveImports: (filePath: string, visited?: Set<string>) => string[];
}

const filesearch: FilesearchApi = {
  findLessImportsInFile(filePath: string): string[] {
    let stat: fs.Stats | undefined;

    try {
      stat = fs.statSync(filePath);
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') return [];
      throw err;
    }

    if (!stat || stat.isFile() === false) return [];

    const files: string[] = [];
    let fileContent: string;
    try {
      fileContent = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT' || error.code === 'EACCES') {
        return [];
      }
      throw err;
    }
    // Support @import with an optional (options) clause -- e.g. (reference),
    // (less), or multiple comma-separated keywords like (reference, optional)
    // -- optional url(), flexible whitespace, and optional trailing semicolon.
    const re = /@import\s+(?:\([^)]*\)\s+)?(?:url\(\s*)?['"]([^'"]+)['"]\s*\)?\s*;?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(fileContent))) {
      const filename = m[1];
      if (filename) files.push(filename);
    }
    return files;
  },

  isHiddenFile(filename: string): boolean {
    const base = path.basename(filename);
    return base.substr(0, 1) === '_' || base.substr(0, 1) === '.';
  },

  // Mirrors the import-target resolution in lessWatchCompilerUtils' watch
  // handler: an extensionless import is assumed to be a .less file, and the
  // path is resolved relative to the importing file's directory. For an
  // extensionless import, Less itself will also match a `_`-prefixed
  // partial (e.g. `@import "buttons";` resolving to `_buttons.less`), so
  // prefer whichever of `<name>.less` / `_<name>.less` actually exists on
  // disk; fall back to `<name>.less` when neither exists yet (matching
  // prior behavior for an import target that hasn't been created).
  resolveImportPath(importingFile: string, importSpec: string): string {
    const hasExtension = path.extname(importSpec).length > 1;
    const dir = path.dirname(importingFile);
    if (!hasExtension) {
      const plainPath = path.normalize(dir + path.sep + importSpec + '.less');
      if (fs.existsSync(plainPath)) return plainPath;
      const base = path.basename(importSpec);
      const partialDir = path.dirname(importSpec);
      const partialPath = path.normalize(dir + path.sep + (partialDir === '.' ? '' : partialDir + path.sep) + '_' + base + '.less');
      if (fs.existsSync(partialPath)) return partialPath;
      return plainPath;
    }
    return path.normalize(dir + path.sep + importSpec);
  },

  // Walks @import statements recursively to compute the full set of files
  // (the file itself plus every direct and transitive import) that a
  // compilation of filePath depends on. Used to build a content-hash cache
  // key that reflects changes anywhere in the dependency graph, not just the
  // entry file. Missing/unreadable imports are silently omitted (matching
  // findLessImportsInFile's own handling of broken import targets).
  collectTransitiveImports(filePath: string, visited: Set<string> = new Set()): string[] {
    const resolved = path.resolve(filePath);
    if (visited.has(resolved)) return [];
    visited.add(resolved);
    for (const importSpec of filesearch.findLessImportsInFile(resolved)) {
      filesearch.collectTransitiveImports(filesearch.resolveImportPath(resolved, importSpec), visited);
    }
    return Array.from(visited);
  }
};

export = filesearch;
