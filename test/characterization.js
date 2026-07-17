// Characterization tests: lock in the exact observable behavior of the CLI
// (byte-identical CSS output, exit codes, crash-free watch startup) so that
// internal refactors — in particular swapping the compile engine — can be
// verified against a golden baseline.
const assert = require('assert'),
  path = require('path'),
  fs = require('fs'),
  { execSync, spawn } = require('child_process'),
  cwd = process.cwd(),
  outDir = path.join(cwd, 'test', 'css'),
  cliPath = path.resolve('dist/less-watch-compiler.js');

function cli(...args) {
  return execSync(`node ${cliPath} ${args.join(' ')}`);
}

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

function resetOutDir() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
}

describe('Characterization: golden-file output parity', function () {
  this.timeout(20000);

  describe('recursive compilation of a nested tree', function () {
    const goldenDir = path.join(cwd, 'test', 'examples', 'recursive', 'css');

    it('compiles every non-hidden .less file, preserving the directory structure, byte-identical to the golden output', () => {
      resetOutDir();
      cli('--run-once', 'test/less', 'test/css');

      const goldenFiles = listFilesRecursive(goldenDir)
        .map((f) => path.relative(goldenDir, f))
        .sort();
      const producedFiles = listFilesRecursive(outDir)
        .map((f) => path.relative(outDir, f))
        .sort();

      assert.deepStrictEqual(producedFiles, goldenFiles, 'the set of produced CSS files must match the golden set exactly');
      for (const rel of goldenFiles) {
        const produced = fs.readFileSync(path.join(outDir, rel));
        const golden = fs.readFileSync(path.join(goldenDir, rel));
        assert.ok(produced.equals(golden), `content mismatch for ${rel}`);
      }
      resetOutDir();
    });

    it('includes subdirectory files (regression guard: the walk filter must never skip directories)', () => {
      resetOutDir();
      cli('--run-once', 'test/less', 'test/css');
      assert.ok(fs.existsSync(path.join(outDir, 'lvl2', 'lvl2.css')), 'lvl2/lvl2.css must be produced');
      assert.ok(fs.existsSync(path.join(outDir, 'lvl2', 'lvl3', 'lvl3.css')), 'lvl2/lvl3/lvl3.css must be produced');
      resetOutDir();
    });
  });

  describe('minified config option', function () {
    it('produces a byte-identical .min.css when the config file sets minified: true', () => {
      resetOutDir();
      cli('--config', 'test/examples/with-minified/less-watch-compiler.config.json');
      const produced = fs.readFileSync(path.join(outDir, 'with-minified.min.css'));
      const golden = fs.readFileSync(path.join(cwd, 'test', 'examples', 'with-minified', 'css', 'with-minified.min.css'));
      assert.ok(produced.equals(golden));
      resetOutDir();
    });
  });

  describe('config auto-discovery from cwd (issue #128)', function () {
    it('loads less-watch-compiler.config.json from the working directory when no arguments are given', () => {
      resetOutDir();
      execSync(`node ${cliPath}`, { cwd: path.join(cwd, 'test', 'examples', 'auto-config') });
      const produced = fs.readFileSync(path.join(outDir, 'auto-config.css'));
      const golden = fs.readFileSync(path.join(cwd, 'test', 'examples', 'auto-config', 'css', 'auto-config.css'));
      assert.ok(produced.equals(golden));
      resetOutDir();
    });
  });
});

describe('Characterization: exit codes', function () {
  this.timeout(20000);

  it('exits non-zero when --run-once encounters a LESS compile error', () => {
    resetOutDir();
    assert.throws(
      () => execSync(`node ${cliPath} --run-once test/examples/broken/less test/css`, { stdio: 'pipe' }),
      (err) => err.status !== 0,
      'a compile failure under --run-once must produce a non-zero exit code'
    );
    resetOutDir();
  });

  it('exits non-zero when required folder arguments are missing', () => {
    assert.throws(
      () => execSync(`node ${cliPath} --run-once`, { stdio: 'pipe', cwd: outDir }),
      (err) => err.status !== 0
    );
  });
});

describe('Characterization: watch-mode startup (issue #117)', function () {
  this.timeout(20000);

  it('survives startup with an extensionless @import next to a nested folder', (done) => {
    resetOutDir();
    const child = spawn('node', [cliPath, 'test/examples/issue-117/less', 'test/css', 'site.less'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d));

    setTimeout(() => {
      const crashed = child.exitCode !== null;
      child.kill('SIGTERM');
      if (crashed) {
        done(new Error(`watch mode crashed during startup (exit ${child.exitCode}): ${stderr}`));
      } else {
        done();
      }
    }, 2500);
  });
});
