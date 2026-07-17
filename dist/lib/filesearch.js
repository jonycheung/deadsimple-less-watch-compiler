'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const filesearch = {
    findLessImportsInFile(filePath) {
        let stat;
        try {
            stat = fs_1.default.statSync(filePath);
        }
        catch (err) {
            const error = err;
            if (error.code === 'ENOENT')
                return [];
            throw err;
        }
        if (!stat || stat.isFile() === false)
            return [];
        const files = [];
        let fileContent;
        try {
            fileContent = fs_1.default.readFileSync(filePath, 'utf8');
        }
        catch (err) {
            const error = err;
            if (error.code === 'ENOENT' || error.code === 'EACCES') {
                return [];
            }
            throw err;
        }
        // Support @import with optional (reference), optional url(), flexible whitespace, and optional trailing semicolon
        const re = /@import\s+(?:\(reference\)\s+)?(?:url\(\s*)?['"]([^'"]+)['"]\s*\)?\s*;?/g;
        let m;
        while ((m = re.exec(fileContent))) {
            const filename = m[1];
            if (filename)
                files.push(filename);
        }
        return files;
    },
    isHiddenFile(filename) {
        const base = path_1.default.basename(filename);
        return base.substr(0, 1) === '_' || base.substr(0, 1) === '.';
    }
};
module.exports = filesearch;
