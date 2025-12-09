'use strict';
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function (require){
    const fs = require('fs');
    const path = require('path')

    const filesearch = {
        findLessImportsInFile: function(f){
            let stat;
            try {
                stat = fs.statSync(f);
            } catch (err) {
                if (err.code === 'ENOENT') return [];
                throw err;
            }

            if (stat && stat.isFile() === false) return [];

            let fileContent;
            try {
                fileContent = fs.readFileSync(f, 'utf8');
            } catch (err) {
                if (err.code === 'ENOENT' || err.code === 'EACCES') return [];
                throw err;
            }

            let m, files = [];
            // Support @import with optional (reference), optional url(), flexible whitespace, and optional trailing semicolon
            const re = /@import\s+(?:\(reference\)\s+)?(?:url\(\s*)?['"]([^'"]+)['"]\s*\)?\s*;?/g;
            while (m = re.exec(fileContent)){
                let [ , filename ] = m;
                if (filename) files.push(filename);
            }
            return files;
        },
        isHiddenFile: function (filename) {
            filename = path.basename(filename)
            return filename.substr(0, 1) === '_' || filename.substr(0, 1) === '.';
        }
    }
    return filesearch;
});
