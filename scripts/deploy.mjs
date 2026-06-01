#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const gitCommand = process.platform === 'win32' ? 'git.exe' : 'git';
const allowedReleaseTypes = new Set(['patch', 'minor', 'major', 'prerelease']);

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const { release, versionArgs } = parseArgs(args);

main();

function main() {
  console.log(`Preparing ${release} release for npm...`);

  ensureCleanWorkingTree();
  ensureUpstreamBranch();

  run(npmCommand, ['run', 'lint']);
  run(npmCommand, ['run', 'typecheck']);
  run(npmCommand, ['run', 'test']);
  run(npmCommand, ['run', 'build']);

  ensureCleanWorkingTree();

  run(npmCommand, ['version', release, ...versionArgs]);
  run(npmCommand, ['publish', '--access', 'public']);
  run(gitCommand, ['push', '--follow-tags']);

  console.log('Deploy completed.');
}

function parseArgs(input) {
  const [releaseArg = 'patch', ...extraArgs] = input;

  if (!isAllowedRelease(releaseArg)) {
    fail(
      `Invalid release "${releaseArg}". Use patch, minor, major, prerelease, or an exact version like 1.2.3.`,
    );
  }

  if (extraArgs.length > 0 && releaseArg !== 'prerelease') {
    fail(
      'Extra arguments are only supported with prerelease, for example: prerelease --preid beta.',
    );
  }

  validatePrereleaseArgs(extraArgs);

  return {
    release: releaseArg,
    versionArgs: extraArgs,
  };
}

function isAllowedRelease(release) {
  return allowedReleaseTypes.has(release) || isExactVersion(release);
}

function isExactVersion(release) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(release);
}

function validatePrereleaseArgs(extraArgs) {
  if (extraArgs.length === 0) {
    return;
  }

  if (extraArgs.length !== 2 || extraArgs[0] !== '--preid' || !extraArgs[1]) {
    fail('Prerelease only supports "--preid <id>", for example: prerelease --preid beta.');
  }
}

function ensureCleanWorkingTree() {
  const result = spawnSync(gitCommand, ['status', '--porcelain'], {
    cwd: rootDir,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    fail('Unable to read Git status. Make sure this project is inside a Git repository.');
  }

  if (result.stdout.trim().length > 0) {
    fail('Git working tree must be clean before deploy. Commit or stash your changes first.');
  }
}

function ensureUpstreamBranch() {
  const branch = spawnSync(gitCommand, ['branch', '--show-current'], {
    cwd: rootDir,
    encoding: 'utf8',
  });

  if (branch.status !== 0 || branch.stdout.trim().length === 0) {
    fail('Deploy requires a checked-out Git branch with an upstream remote.');
  }

  const upstream = spawnSync(
    gitCommand,
    ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
    {
      cwd: rootDir,
      encoding: 'utf8',
    },
  );

  if (upstream.status !== 0 || upstream.stdout.trim().length === 0) {
    fail('Current branch has no upstream. Run "git push -u origin main" before deploying.');
  }
}

function run(command, commandArgs) {
  console.log(`\n> ${command} ${commandArgs.join(' ')}`);

  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    fail(`Command failed: ${command} ${commandArgs.join(' ')}`);
  }
}

function fail(message) {
  console.error(`\nDeploy aborted: ${message}`);
  process.exit(1);
}

function printHelp() {
  console.log(`Usage:
  npm run deploy
  npm run deploy -- patch
  npm run deploy -- minor
  npm run deploy -- major
  npm run deploy -- 1.2.3
  npm run deploy -- prerelease --preid beta

Default release:
  patch

What deploy does:
  1. Requires a clean Git working tree
  2. Requires the current branch to have an upstream remote
  3. Runs lint, typecheck, test, and build
  4. Runs npm version <release>
  5. Runs npm publish --access public
  6. Runs git push --follow-tags`);
}
