import fs from 'fs';
interface WalkOptions {
    ignoreDotFiles?: boolean;
    filter?: (filePath: string) => boolean;
    interval?: number;
}
interface FilesMap {
    [filePath: string]: fs.Stats;
}
interface WatchCallback {
    (f: string | FilesMap | NodeJS.ErrnoException | null, curr: fs.Stats | null, prev: fs.Stats | null, fileimportlist: Record<string, string[]>): void;
}
interface InitCallback {
    (f: string): void;
}
interface CompileResult {
    command: string;
    outputFilePath: string;
}
interface LessWatchCompilerConfig {
    watchFolder?: string;
    outputFolder?: string;
    mainFile?: string;
    sourceMap?: boolean;
    plugins?: string;
    runOnce?: boolean;
    includeHidden?: boolean;
    enableJs?: boolean;
    lessArgs?: string;
    minified?: boolean;
    allowedExtensions?: string[];
}
type WalkCompleteCallback = (err: NodeJS.ErrnoException | null, files: FilesMap | null) => void;
declare const lessWatchCompilerUtilsModule: {
    config: LessWatchCompilerConfig;
    walk(dir: string, options: WalkOptions, callback: WalkCompleteCallback, initCallback?: InitCallback): void;
    watchTree(root: string, options: WalkOptions | WatchCallback, watchCallback?: WatchCallback, initCallback?: InitCallback): void;
    getLessArgs(args: string): string;
    compileCSS(file: string, test?: boolean): CompileResult | undefined;
    resolveOutputPath(filePath: string): string;
    filterFiles(f: string): boolean;
    getDateTime(): string;
    setupWatcher(f: string, files: FilesMap, options: WalkOptions, watchCallback: WatchCallback): void;
    fileWatcher(f: string, files: FilesMap, options: WalkOptions, filelistArr: string[], fileimportlistObj: Record<string, string[]>, watchCallback: WatchCallback): void;
};
export = lessWatchCompilerUtilsModule;
