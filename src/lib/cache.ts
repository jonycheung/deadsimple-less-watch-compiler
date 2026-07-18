import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import fileSearch = require('./filesearch');

/**
 * Opt-in on-disk compile cache for one-shot compilation (CLI --run-once and
 * the compileFile() API): skips re-rendering a file when the content of its
 * entire transitive @import closure is unchanged since the last recorded
 * compile, and the previous output file is still present.
 *
 * Invalidation is content-hash based (not mtime based) so the cache is safe
 * to restore across CI runs, where checkouts don't preserve timestamps.
 * Changing any compile option (or the less/tool version) invalidates the
 * whole cache at once, rather than trying to fingerprint each entry
 * individually -- simpler and safer than getting per-option invalidation
 * exactly right.
 */

interface CacheEntry {
  hash: string;
  outputFilePath: string;
}

interface CacheFile {
  schemaVersion: number;
  fingerprint: string;
  entries: Record<string, CacheEntry>;
}

const SCHEMA_VERSION = 1;
const DEFAULT_CACHE_FILENAME = '.less-watch-compiler-cache.json';

let loadedPath: string | undefined;
let store: CacheFile | undefined;
let dirty = false;
let exitHandlerRegistered = false;

function packageVersion(pkgPath: string): string {
  try {
    return (require(pkgPath) as { version?: string }).version || '0';
  } catch {
    return '0';
  }
}

function computeFingerprint(fingerprintInput: Record<string, unknown>): string {
  const hash = crypto.createHash('sha256');
  hash.update(
    JSON.stringify({
      toolVersion: packageVersion('../../package.json'),
      lessVersion: packageVersion('less/package.json'),
      options: fingerprintInput
    })
  );
  return hash.digest('hex');
}

// Cache keys/paths are stored relative to cwd (POSIX-separated) so the cache
// file is portable across machines/checkouts that share the same relative
// project layout, rather than tying entries to an absolute path.
function relativeKey(filePath: string): string {
  return path.relative(process.cwd(), path.resolve(filePath)).split(path.sep).join('/');
}

function registerExitFlush(): void {
  if (exitHandlerRegistered) return;
  exitHandlerRegistered = true;
  process.on('exit', flush);
}

function flush(): void {
  if (!dirty || !loadedPath || !store) return;
  try {
    fs.writeFileSync(loadedPath, JSON.stringify(store), 'utf8');
    dirty = false;
  } catch {
    // Best-effort: a failure to persist the cache must never break compilation.
  }
}

function load(cachePath: string, fingerprint: string): CacheFile {
  if (store && loadedPath === cachePath && store.fingerprint === fingerprint) return store;

  // Flush any pending writes for a previously loaded cache file before
  // switching to a different one (relevant when cachePath itself changes
  // between calls, which is not a normal case but shouldn't lose data).
  flush();

  let onDisk: CacheFile | undefined;
  try {
    onDisk = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as CacheFile;
  } catch {
    onDisk = undefined;
  }

  if (onDisk && onDisk.schemaVersion === SCHEMA_VERSION && onDisk.fingerprint === fingerprint && onDisk.entries) {
    // Prune entries whose source file no longer exists, so a long-lived CI
    // cache doesn't grow unbounded as files get renamed/removed over time.
    const entries: Record<string, CacheEntry> = {};
    for (const [key, entry] of Object.entries(onDisk.entries)) {
      if (fs.existsSync(path.resolve(process.cwd(), key))) entries[key] = entry;
    }
    store = { schemaVersion: SCHEMA_VERSION, fingerprint, entries };
    loadedPath = cachePath;
    // Persist the pruned set so a stale entry doesn't keep reappearing on
    // disk after every load, if pruning actually removed anything.
    dirty = Object.keys(entries).length !== Object.keys(onDisk.entries).length;
  } else {
    // Missing, corrupt, or stale (options/version changed) cache file: start
    // clean. A fingerprint mismatch is a deliberate whole-cache invalidation.
    store = { schemaVersion: SCHEMA_VERSION, fingerprint, entries: {} };
    loadedPath = cachePath;
    dirty = false;
  }

  registerExitFlush();
  return store;
}

// Hashes the file plus its full transitive @import closure. Returns
// undefined if any dependency can't be read, so callers never cache on
// incomplete/uncertain information (a cache miss is always safe; a false
// cache hit is not).
function hashClosure(filePath: string): string | undefined {
  const closure = fileSearch.collectTransitiveImports(filePath).sort();
  const hash = crypto.createHash('sha256');
  for (const f of closure) {
    let content: Buffer;
    try {
      content = fs.readFileSync(f);
    } catch {
      return undefined;
    }
    hash.update(relativeKey(f));
    hash.update(content);
  }
  return hash.digest('hex');
}

const cacheApi = {
  resolvePath(configuredPath?: string): string {
    return configuredPath ? path.resolve(configuredPath) : path.join(process.cwd(), DEFAULT_CACHE_FILENAME);
  },

  // expectedFiles: additional output files (e.g. a .css.map sidecar) that
  // must also exist for a cache hit to be valid. A real compile always
  // produces them together with outputFilePath, so a restored/partial cache
  // that's missing one of them must not be treated as up to date.
  isUpToDate(
    cachePath: string,
    fingerprintInput: Record<string, unknown>,
    inputFilePath: string,
    outputFilePath: string,
    expectedFiles: string[] = []
  ): boolean {
    const fingerprint = computeFingerprint(fingerprintInput);
    const cache = load(cachePath, fingerprint);
    const entry = cache.entries[relativeKey(inputFilePath)];
    if (!entry) return false;
    if (entry.outputFilePath !== relativeKey(outputFilePath)) return false;
    if (!fs.existsSync(outputFilePath)) return false;
    for (const f of expectedFiles) {
      if (!fs.existsSync(f)) return false;
    }
    const hash = hashClosure(inputFilePath);
    return hash !== undefined && hash === entry.hash;
  },

  record(cachePath: string, fingerprintInput: Record<string, unknown>, inputFilePath: string, outputFilePath: string): void {
    const fingerprint = computeFingerprint(fingerprintInput);
    const cache = load(cachePath, fingerprint);
    const hash = hashClosure(inputFilePath);
    if (hash === undefined) return;
    cache.entries[relativeKey(inputFilePath)] = { hash, outputFilePath: relativeKey(outputFilePath) };
    dirty = true;
  },

  // Exposed for tests: forces a synchronous write instead of waiting for
  // process exit.
  flush
};

export = cacheApi;
