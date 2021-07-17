"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var FileSearch = /** @class */ (function () {
    function FileSearch() {
    }
    FileSearch.prototype.findLessImportsInFile = function (f) {
        if (fs.statSync(f) && fs.statSync(f).isFile() === false)
            return [];
        else {
            var m = void 0, files = [];
            var fileContent = fs.readFileSync(f, "utf8");
            var re = /@import (\(reference\) )?['"](.*?)['"];/g;
            while (m = re.exec(fileContent)) {
                var filename = m[2];
                if (filename)
                    files.push(filename);
            }
            ;
            return files;
        }
    };
    FileSearch.prototype.isHiddenFile = function (filename) {
        filename = path.basename(filename);
        return filename.substr(0, 1) === "_" || filename.substr(0, 1) === ".";
    };
    return FileSearch;
}());
;
exports.default = FileSearch;
