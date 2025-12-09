'use strict';

import fs from 'fs';
import path from 'path';

interface FilesearchApi {
  findLessImportsInFile: (filePath: string) => string[];
  isHiddenFile: (filename: string) => boolean;
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
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const re = /@import (\(reference\) )?['"](.*?)['"];/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(fileContent))) {
      const filename = m[2];
      if (filename) files.push(filename);
    }
    return files;
  },

  isHiddenFile(filename: string): boolean {
    const base = path.basename(filename);
    return base.substr(0, 1) === '_' || base.substr(0, 1) === '.';
  }
};

export = filesearch;

