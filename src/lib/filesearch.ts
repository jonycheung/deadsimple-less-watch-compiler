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
    // Support @import with optional (reference), optional url(), flexible whitespace, and optional trailing semicolon
    const re = /@import\s+(?:\(reference\)\s+)?(?:url\(\s*)?['"]([^'"]+)['"]\s*\)?\s*;?/g;
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
  // path is resolved relative to the importing file's directory.
  resolveImportPath(importingFile: string, importSpec: string): string {
    const hasExtension = path.extname(importSpec).length > 1;
    const importFile = hasExtension ? importSpec : importSpec + '.less';
    return path.normalize(path.dirname(importingFile) + path.sep + importFile);
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
