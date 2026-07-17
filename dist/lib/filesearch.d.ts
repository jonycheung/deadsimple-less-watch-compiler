interface FilesearchApi {
    findLessImportsInFile: (filePath: string) => string[];
    isHiddenFile: (filename: string) => boolean;
}
declare const filesearch: FilesearchApi;
export = filesearch;
