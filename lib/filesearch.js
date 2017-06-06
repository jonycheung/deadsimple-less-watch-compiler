if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function (require){
    var  fs = require('fs');
    var filesearch = {
            findLessImportsInFile: function(f){
                    var files = [];
                        var fileContent = fs.readFileSync(f, 'utf8');
                        var re = /@import ['"](.*?)['"];/g;
                        var m;

                        do {
                            m = re.exec(fileContent);
                            if (m) {
                                files[files.length] = m[1];
                            }
                        } while (m);
                    return files;
            }
    }

    return filesearch;
});