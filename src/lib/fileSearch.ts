"use strict";
import * as fs from "fs";
import * as path from "path";

export default class FileSearch {

        constructor(){

        }
        
        findLessImportsInFile (f: string): string[] {
            if (fs.statSync(f) && fs.statSync(f).isFile() === false) return [];
            else {
            let m:RegExpExecArray | null,
                files:string[] = [];
            const fileContent = fs.readFileSync(f, "utf8");
            const re = /@import (\(reference\) )?['"](.*?)['"];/g;
            while (m = re.exec(fileContent)) {
                let [, , filename] = m;
                if (filename) files.push(filename);
            };
            return files
            }
        }
        isHiddenFile (filename: string):boolean {
            filename = path.basename(filename);
            return filename.substr(0, 1) === "_" || filename.substr(0, 1) === ".";
        }
};