#!/usr/bin/env node

const { execSync } = require('node:child_process');
const fs = require('node:fs');

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1];
}

const sinceVersion = getArg('--since', '1.16.0');
const nextVersion = getArg('--next', '');
const outputPath = getArg('--output', 'CHANGELOG.md');

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return match.slice(1).map((part) => Number(part));
}

function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

function run(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
  } catch {
    return '';
  }
}

function getSemverTags() {
  const raw = run("git tag -l 'v*' --sort=v:refname");
  if (!raw) return [];
  return raw
    .split('\n')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.replace(/^v/, ''))
    .filter((version) => parseVersion(version))
    .sort(compareVersions);
}

function categorizeCommit(subject) {
  const match = subject.match(/^(feat|fix|perf|refactor|docs|test|build|ci|chore)(\(.+\))?!?:\s*(.+)$/i);
  if (!match) {
    return { type: 'Other', text: subject };
  }

  const type = match[1].toLowerCase();
  const text = match[3];
  switch (type) {
    case 'feat':
      return { type: 'Features', text };
    case 'fix':
      return { type: 'Fixes', text };
    case 'perf':
      return { type: 'Performance', text };
    case 'refactor':
      return { type: 'Refactors', text };
    case 'docs':
      return { type: 'Documentation', text };
    case 'test':
      return { type: 'Tests', text };
    case 'build':
      return { type: 'Build', text };
    case 'ci':
      return { type: 'CI', text };
    case 'chore':
      return { type: 'Chores', text };
    default:
      return { type: 'Other', text: subject };
  }
}

function getCommits(rangeExpression) {
  const raw = run(`git log --no-merges --pretty=format:%s ${rangeExpression}`);
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function renderSection({ version, date, commits }) {
  const buckets = new Map([
    ['Features', []],
    ['Fixes', []],
    ['Performance', []],
    ['Refactors', []],
    ['Documentation', []],
    ['Tests', []],
    ['Build', []],
    ['CI', []],
    ['Chores', []],
    ['Other', []]
  ]);

  for (const commit of commits) {
    const categorized = categorizeCommit(commit);
    buckets.get(categorized.type).push(categorized.text);
  }

  const lines = [`## v${version} - ${date}`];

  if (commits.length === 0) {
    lines.push('', '- No user-facing changes captured for this release.');
    return lines.join('\n');
  }

  const orderedBuckets = [...buckets.entries()].filter(([, entries]) => entries.length > 0);
  for (const [name, entries] of orderedBuckets) {
    lines.push('', `### ${name}`);
    for (const entry of entries) {
      lines.push(`- ${entry}`);
    }
  }

  return lines.join('\n');
}

const allTags = getSemverTags();
const scopedTags = allTags.filter((version) => compareVersions(version, sinceVersion) >= 0);
const currentDate = new Date().toISOString().slice(0, 10);

const sections = [];

if (nextVersion) {
  const latestKnownTag = allTags.length > 0 ? `v${allTags[allTags.length - 1]}` : '';
  const rangeExpression = latestKnownTag ? `${latestKnownTag}..HEAD` : 'HEAD';
  const commits = getCommits(rangeExpression);
  sections.push(
    renderSection({
      version: nextVersion,
      date: currentDate,
      commits
    })
  );
}

for (let i = scopedTags.length - 1; i >= 0; i -= 1) {
  const version = scopedTags[i];
  const tagName = `v${version}`;
  const previousTag = run(`git describe --tags --abbrev=0 ${tagName}^`);
  const rangeExpression = previousTag ? `${previousTag}..${tagName}` : tagName;
  const commits = getCommits(rangeExpression);
  const date = run(`git log -1 --format=%cs ${tagName}`) || currentDate;

  sections.push(
    renderSection({
      version,
      date,
      commits
    })
  );
}

const header = [
  '# Changelog',
  '',
  'Auto-generated from commit history by the release-tag workflow.',
  `Contains releases from v${sinceVersion} onward.`,
  ''
].join('\n');

fs.writeFileSync(outputPath, `${header}${sections.join('\n\n')}\n`, 'utf8');
