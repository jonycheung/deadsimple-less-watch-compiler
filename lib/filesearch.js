'use strict';
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function (require){
    const fs = require('fs');
    const filesearch = {
        findLessImportsInFile: function(f){
            let m, files = [];
                const fileContent = fs.readFileSync(f, 'utf8');
                const re = /@import ['"](.*?)['"];/g;
                while (m = re.exec(fileContent)){
                    let [ , filename ] = m;
                    if (m) files.push(filename);
                }
            return files;
        }
    }
    return filesearch;
});